import { supabase } from '../lib/supabase';

// --- Configuração da Empresa ---
async function getCompanyConfig() {
  const { data: config } = await supabase.from('app_config').select('*').limit(1).maybeSingle();
  return {
    name: config?.company_name || 'CHAMEI TECNOLOGIA',
    subtitle: config?.company_subtitle || 'Soluções Integradas',
    cnpj: config?.company_cnpj || config?.cnpj || '00.000.000/0000-00',
    address: config?.company_address || config?.address || 'Endereço não configurado',
    city: config?.company_city || 'Cidade - UF',
    cep: config?.company_cep || '00000-000',
    phone: config?.company_phone || config?.phone || '',
    email: config?.company_email || config?.email || '',
    website: config?.company_website || 'www.chameiapp.com',
    logo: config?.company_logo || config?.logo_url || ''
  };
}

const formatDate = (dateString: string) => {
  if (!dateString) return new Date().toISOString().split('T')[0];
  try {
    return String(dateString).split('T')[0];
  } catch { return String(dateString); }
};

export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();

    // Sort Items
    const items = quote.items ? [...quote.items].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)) : [];

    // Calculate Values
    const subtotal = quote.subtotal || items.reduce((acc: number, item: any) => acc + (item.total || (item.quantity * item.unit_price)), 0);
    const discountVal = quote.discount || 0;
    const discountAmount = quote.discount_type === 'percentage' ? subtotal * (discountVal / 100) : discountVal;
    const tax = quote.tax || 0;
    const total = quote.total || (subtotal - discountAmount + tax);

    const quoteNumber = quote.quote_number || `ORC-${quote.id?.slice(0, 4).toUpperCase()}`;

    // Construct JSON for initialData
    // We escape special characters in descriptions to avoid breaking the JS script string
    const safeString = (str: string) => (str || '').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    const itemsJson = items.map((item: any) => ({
      id: item.id || Math.random(),
      title: safeString(item.name || 'Serviço'),
      text: safeString(`${item.description || ''}\n(Qtd: ${item.quantity} x R$ ${Number(item.unit_price).toFixed(2)})`)
    }));

    const initialData = {
      company: {
        logo: company.logo,
        name: safeString(company.name),
        subtitle: safeString(company.subtitle),
        address: safeString(company.address),
        city: safeString(company.city),
        cep: safeString(company.cep),
        phone: safeString(company.phone),
        email: safeString(company.email),
        site: safeString(company.website)
      },
      proposal: {
        number: safeString(quoteNumber),
        date: formatDate(quote.created_at),
        rev: "01",
        type: safeString(quote.title || 'Orçamento')
      },
      client: {
        name: safeString(quote.clients?.name || 'Cliente'),
        contact: safeString(quote.clients?.phone || ''),
        reference: safeString(quote.description || 'Proposta Comercial')
      },
      items: itemsJson,
      values: {
        amount: total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        amountExtenso: "Reais (Preencher)", // Placeholder logic
        obs: safeString(quote.notes || 'Valores sujeitos a alteração.'),
      },
      validity: quote.valid_until ? formatDate(quote.valid_until) : "15 dias",
      signer: {
        name: safeString(quote.created_by_name || company.name),
        role: "Responsável",
        phones: safeString(company.phone)
      }
    };

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gerador de Proposta</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
      .font-sans { font-family: 'Lato', sans-serif; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .animate-spin { animation: spin 1s linear infinite; }
      .hidden { display: none; }
    </style>
</head>
<body class="min-h-screen bg-slate-100 font-sans text-slate-800 pb-32">
    <!-- LOADER -->
    <div id="pdf-loader" class="hidden fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 z-[10000] justify-center items-center text-white font-sans flex-col">
        <div class="border-4 border-t-4 border-t-blue-500 border-gray-200 rounded-full w-10 h-10 animate-spin mb-4"></div>
        <p>Gerando PDF, por favor aguarde...</p>
    </div>

    <!-- NAVBAR -->
    <nav class="bg-blue-900 text-white shadow-lg sticky top-0 z-50">
      <div class="max-w-5xl mx-auto p-3 flex flex-col md:flex-row justify-between items-center gap-3">
        <div class="flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
           <span class="font-bold text-lg">Gerador de Proposta</span>
        </div>
        <div class="flex flex-wrap justify-center gap-2">
           <button id="save-json-btn" class="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 rounded text-xs font-semibold border border-blue-700 transition-colors" title="Salvar arquivo para editar depois">
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
             Salvar Backup
           </button>
           <button id="import-json-btn" class="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 rounded text-xs font-semibold border border-blue-700 transition-colors" title="Carregar arquivo salvo">
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/></svg>
             Restaurar
           </button>
           <input type="file" id="import-file-input" accept=".json" class="hidden">
           <button id="edit-btn" class="px-4 py-1.5 rounded text-sm font-bold transition-colors bg-white text-blue-900">Editar</button>
           <button id="preview-btn" class="px-4 py-1.5 rounded text-sm font-bold transition-colors text-blue-100 hover:bg-blue-800">Visualizar</button>
        </div>
      </div>
    </nav>

    <main class="max-w-5xl mx-auto p-4">
        <!-- EDIT MODE -->
        <div id="edit-view" class="space-y-6 animate-fade-in">
          <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
            <h3 class="text-blue-900 font-bold text-base mb-5 border-b border-slate-100 pb-2 flex items-center gap-2">1. Identidade Visual</h3>
            <div class="flex flex-col md:flex-row gap-6 mb-6 items-center">
              <div class="w-full md:w-1/2">
                 <label for="company-logo-input" class="cursor-pointer flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors relative overflow-hidden shadow-inner group">
                    <div id="company-logo-edit-preview" class="h-full w-full"></div>
                    <button id="company-logo-remove-btn" class="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow hover:bg-red-600 hidden">X</button>
                    <input type="file" id="company-logo-input" class="hidden" accept="image/*">
                 </label>
              </div>
              <div class="w-full md:w-1/2 space-y-3">
                 <div><label class="block text-[10px] uppercase font-bold text-gray-400">Nome da Empresa</label><input type="text" id="company-name" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
                 <div><label class="block text-[10px] uppercase font-bold text-gray-400">Subtítulo</label><input type="text" id="company-subtitle" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
               <div><label class="block text-[10px] uppercase font-bold text-gray-400">Telefone</label><input type="text" id="company-phone" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
               <div><label class="block text-[10px] uppercase font-bold text-gray-400">Email</label><input type="text" id="company-email" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
               <div><label class="block text-[10px] uppercase font-bold text-gray-400">Site</label><input type="text" id="company-site" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
               <div><label class="block text-[10px] uppercase font-bold text-gray-400">Endereço</label><input type="text" id="company-address" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
               <div class="flex gap-2">
                 <div class="flex-1"><label class="block text-[10px] uppercase font-bold text-gray-400">Cidade</label><input type="text" id="company-city" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
                 <div class="w-1/3"><label class="block text-[10px] uppercase font-bold text-gray-400">CEP</label><input type="text" id="company-cep" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
               </div>
            </div>
          </div>
          
          <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
             <h3 class="text-blue-900 font-bold text-base mb-5 border-b border-slate-100 pb-2">2. Dados da Proposta</h3>
             <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div><label class="block text-[10px] uppercase font-bold text-gray-400">Nº Proposta</label><input type="text" id="proposal-number" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
                <div><label class="block text-[10px] uppercase font-bold text-gray-400">Data</label><input type="date" id="proposal-date" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
                <div><label class="block text-[10px] uppercase font-bold text-gray-400">Revisão</label><input type="text" id="proposal-rev" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
                <div><label class="block text-[10px] uppercase font-bold text-gray-400">Tipo</label><input type="text" id="proposal-type" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
             </div>
             <div class="bg-slate-50 p-4 rounded border">
                <h3 class="text-sm font-bold text-blue-900 mb-3 block">Cliente</h3>
                <div class="space-y-3">
                   <div><label class="block text-[10px] uppercase font-bold text-gray-400">Nome</label><input type="text" id="client-name" class="w-full p-2 text-sm border bg-state-50 rounded"></div>
                   <div><label class="block text-[10px] uppercase font-bold text-gray-400">Contato</label><input type="text" id="client-contact" class="w-full p-2 text-sm border bg-state-50 rounded"></div>
                   <div><label class="block text-[10px] uppercase font-bold text-gray-400">Referência</label><input type="text" id="client-reference" class="w-full p-2 text-sm border bg-state-50 rounded"></div>
                </div>
             </div>
          </div>

          <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
             <h3 class="text-blue-900 font-bold text-base mb-5 border-b border-slate-100 pb-2">3. Itens</h3>
             <div id="items-container" class="space-y-4"></div>
             <button id="add-item-btn" class="w-full mt-4 py-3 border-2 border-dashed border-blue-300 text-blue-600 font-bold rounded hover:bg-blue-50 flex justify-center items-center gap-2">Adicionar Novo Item</button>
          </div>

          <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
             <h3 class="text-blue-900 font-bold text-base mb-5 border-b border-slate-100 pb-2">4. Fechamento</h3>
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div><label class="block text-[10px] uppercase font-bold text-gray-400">Total (R$)</label><input type="text" id="values-amount" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
                <div><label class="block text-[10px] uppercase font-bold text-gray-400">Extenso</label><input type="text" id="values-amountExtenso" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
             </div>
             <div class="mb-4"><label class="block text-[10px] uppercase font-bold text-gray-400">Obs</label><textarea id="values-obs" class="w-full p-2 text-sm border bg-slate-50 rounded" rows="2"></textarea></div>
             <div class="mb-4"><label class="block text-[10px] uppercase font-bold text-gray-400">Validade</label><input type="text" id="values-validity" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
             <div class="mt-4 border-t border-dashed pt-4">
               <h4 class="text-sm font-bold text-gray-700 mb-2">Assinatura</h4>
               <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label class="block text-[10px] uppercase font-bold text-gray-400">Nome</label><input type="text" id="signer-name" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
                  <div><label class="block text-[10px] uppercase font-bold text-gray-400">Cargo</label><input type="text" id="signer-role" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
                  <div><label class="block text-[10px] uppercase font-bold text-gray-400">Contatos</label><input type="text" id="signer-phones" class="w-full p-2 text-sm border bg-slate-50 rounded"></div>
               </div>
             </div>
          </div>
        </div>

        <!-- PREVIEW MODE -->
        <div id="preview-view" class="hidden justify-start mt-4 mb-24 overflow-auto">
           <div id="document-to-print" class="bg-white shadow-2xl relative text-black box-border mx-auto" style="width: 794px; height: auto; padding: 45px 45px 100px 45px; overflow: visible;">
              
              <!-- Header -->
              <div class="flex flex-row justify-between items-start border-b-2 border-blue-900 pb-4 mb-6 w-full">
                <div class="w-[60%] pr-4">
                   <div id="preview-logo-container" class="mb-4 h-64 flex items-start"></div>
                   <h1 id="preview-company-name" class="text-xl font-black text-blue-900 uppercase leading-none mb-1"></h1>
                   <p id="preview-company-subtitle" class="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3"></p>
                   <div class="pl-2 border-l-4 border-blue-600">
                      <p class="text-[10px] font-bold uppercase text-gray-800">MATRIZ <span id="preview-company-city"></span></p>
                      <p class="text-[10px] uppercase text-gray-600">ELÉTRICA / MANUTENÇÃO</p>
                   </div>
                </div>
                <div class="w-[40%] flex flex-col items-end text-right">
                   <div class="bg-gray-100 border-l-4 border-blue-900 p-3 w-full text-left mb-3">
                    <h2 class="font-bold text-blue-900 text-xs uppercase mb-2">Proposta Comercial</h2>
                    <div class="text-[10px] space-y-1">
                       <div class="flex justify-between border-b border-gray-300 pb-0.5"><span class="font-bold text-gray-600">Nº:</span> <span id="preview-proposal-number"></span></div>
                         <div class="flex justify-between border-b border-gray-300 pb-0.5"><span class="font-bold text-gray-600">DATA:</span> <span id="preview-proposal-date"></span></div>
                         <div class="flex justify-between"><span class="font-bold text-gray-600">REV:</span> <span id="preview-proposal-rev"></span></div>
                      </div>
                   </div>
                   <div class="text-[9px] text-gray-500 leading-tight">
                      <p id="preview-company-email"></p>
                      <p id="preview-company-site"></p>
                      <p id="preview-company-phone"></p>
                   </div>
                </div>
              </div>
              
              <!-- Client -->
              <section class="mb-8">
                 <h2 id="preview-client-name" class="text-xl font-bold text-gray-900 leading-tight"></h2>
                 <p id="preview-client-contact" class="text-sm text-gray-600 mb-2"></p>
                 <div class="bg-blue-50 border border-blue-100 px-3 py-2 rounded-sm w-full">
                    <p class="text-xs text-blue-900"><strong class="font-bold uppercase mr-1">Referência:</strong> <span id="preview-client-reference"></span></p>
                 </div>
              </section>
              
              <!-- Items -->
              <section id="preview-items-container" class="mb-8"></section>

              <!-- Footer Block -->
              <div class="break-inside-avoid mt-auto">
                 <div class="mb-6">
                    <h3 class="font-black text-gray-600 text-sm uppercase tracking-wider mb-2">Investimento</h3>
                    <div class="bg-gray-50 p-4 border-l-4 border-green-600 flex items-center justify-between">
                      <div class="flex items-baseline gap-3">
                         <span class="text-sm text-gray-500 font-bold">TOTAL:</span>
                         <p class="text-xl font-black text-gray-900">R$ <span id="preview-values-amount"></span></p>
                      </div>
                       <span class="text-xs text-gray-500 italic">(<span id="preview-values-amountExtenso"></span>)</span>
                    </div>
                    <div id="preview-obs-container" class="mt-2 bg-gray-100 p-3 rounded-md hidden">
                      <p class="text-xs text-gray-700"><span class="font-bold text-gray-800">OBS:</span> <span id="preview-values-obs"></span></p>
                    </div>
                 </div>
                 <div class="mb-8 bg-gray-100 p-3 rounded-lg flex justify-between items-center shadow-sm">
                    <span class="text-xs font-bold text-gray-700 uppercase">Validade da Proposta:</span>
                    <span id="preview-values-validity" class="text-sm text-gray-900 font-bold"></span>
                 </div>
                 <footer class="pt-8 relative">
                    <p class="text-xs text-gray-600 mb-8">Atenciosamente,</p>
                    <div class="flex justify-between items-end">
                      <div class="w-56 border-t border-gray-800 pt-2">
                          <p id="preview-signer-name" class="font-bold text-gray-900 text-base"></p>
                          <p id="preview-signer-role" class="text-[10px] text-gray-600 uppercase font-bold"></p>
                          <p id="preview-signer-phones" class="text-[10px] text-gray-500"></p>
                      </div>
                      <div class="opacity-20 grayscale">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                      </div>
                    </div>
                 </footer>
              </div>

              <!-- Fixed Footer -->
              <div class="absolute left-0 w-full" style="padding: 0 45px 30px 45px; bottom: 0px;">
                <div class="border-t border-gray-200 py-3 text-center">
                  <p class="text-[9px] text-gray-500"><span id="preview-footer-address"></span> • <span id="preview-footer-city"></span> • CEP <span id="preview-footer-cep"></span></p>
                  <p class="text-[9px] text-blue-900 font-bold mt-0.5"><span id="preview-footer-phone"></span> | <span id="preview-footer-email"></span></p>
                </div>
              </div>
           </div>
        </div>
    </main>

    <!-- Floating PDF Button -->
    <div id="generate-pdf-btn-container" class="fixed bottom-6 right-6 z-50 animate-bounce-slow hidden">
      <button id="generate-pdf-btn" class="flex items-center gap-3 bg-green-600 text-white pl-6 pr-8 py-4 rounded-full shadow-2xl font-bold text-lg border-4 border-white">Baixar PDF</button>
      <div id="generate-pdf-btn-loading" class="hidden items-center gap-3 bg-green-600 text-white pl-6 pr-8 py-4 rounded-full shadow-2xl font-bold text-lg opacity-75 border-4 border-white">Gerando PDF...</div>
    </div>

<script>
    // DYNAMIC DATA INJECTION
    let data = ${JSON.stringify(initialData)};
    let view = 'edit';
    let isGenerating = false;

    // ... (Existing User Script Logic, simplified for brevity but functional) ...
    document.addEventListener('DOMContentLoaded', () => {
        const editView = document.getElementById('edit-view');
        const previewView = document.getElementById('preview-view');
        const saveJsonBtn = document.getElementById('save-json-btn');
        const importJsonBtn = document.getElementById('import-json-btn');
        const importFileInput = document.getElementById('import-file-input');
        const editBtn = document.getElementById('edit-btn');
        const previewBtn = document.getElementById('preview-btn');
        const pdfBtnContainer = document.getElementById('generate-pdf-btn-container');
        const pdfBtn = document.getElementById('generate-pdf-btn');
        const pdfBtnLoading = document.getElementById('generate-pdf-btn-loading');
        const loader = document.getElementById('pdf-loader');
        const itemsContainer = document.getElementById('items-container');
        const addItemBtn = document.getElementById('add-item-btn');

        function syncView() {
            if (view === 'edit') {
                editView.classList.remove('hidden');
                previewView.classList.add('hidden');
                pdfBtnContainer.classList.add('hidden');
                editBtn.classList.add('bg-white', 'text-blue-900');
                editBtn.classList.remove('text-blue-100', 'hover:bg-blue-800');
                previewBtn.classList.add('text-blue-100', 'hover:bg-blue-800');
                previewBtn.classList.remove('bg-white', 'text-blue-900');
            } else {
                editView.classList.add('hidden');
                previewView.classList.remove('hidden');
                pdfBtnContainer.classList.remove('hidden');
                editBtn.classList.remove('bg-white', 'text-blue-900');
                editBtn.classList.add('text-blue-100', 'hover:bg-blue-800');
                previewBtn.classList.remove('text-blue-100', 'hover:bg-blue-800');
                previewBtn.classList.add('bg-white', 'text-blue-900');
            }
        }

        function syncDataFromInputs() {
            data.company.name = document.getElementById('company-name').value;
            data.company.subtitle = document.getElementById('company-subtitle').value;
            data.company.phone = document.getElementById('company-phone').value;
            data.company.email = document.getElementById('company-email').value;
            data.company.site = document.getElementById('company-site').value;
            data.company.address = document.getElementById('company-address').value;
            data.company.city = document.getElementById('company-city').value;
            data.company.cep = document.getElementById('company-cep').value;
            
            data.proposal.number = document.getElementById('proposal-number').value;
            data.proposal.date = document.getElementById('proposal-date').value;
            data.proposal.rev = document.getElementById('proposal-rev').value;
            data.proposal.type = document.getElementById('proposal-type').value;

            data.client.name = document.getElementById('client-name').value;
            data.client.contact = document.getElementById('client-contact').value;
            data.client.reference = document.getElementById('client-reference').value;

            data.items = [];
            document.querySelectorAll('.item-editor').forEach(el => {
                data.items.push({
                    id: el.dataset.id,
                    title: el.querySelector('.item-title-input').value,
                    text: el.querySelector('.item-text-input').value
                });
            });

            data.values.amount = document.getElementById('values-amount').value;
            data.values.amountExtenso = document.getElementById('values-amountExtenso').value;
            data.values.obs = document.getElementById('values-obs').value;
            data.validity = document.getElementById('values-validity').value;

            data.signer.name = document.getElementById('signer-name').value;
            data.signer.role = document.getElementById('signer-role').value;
            data.signer.phones = document.getElementById('signer-phones').value;
        }

        function renderForm() {
            document.getElementById('company-name').value = data.company.name || '';
            document.getElementById('company-subtitle').value = data.company.subtitle || '';
            document.getElementById('company-phone').value = data.company.phone || '';
            document.getElementById('company-email').value = data.company.email || '';
            document.getElementById('company-site').value = data.company.site || '';
            document.getElementById('company-address').value = data.company.address || '';
            document.getElementById('company-city').value = data.company.city || '';
            document.getElementById('company-cep').value = data.company.cep || '';

            document.getElementById('proposal-number').value = data.proposal.number || '';
            document.getElementById('proposal-date').value = data.proposal.date || '';
            document.getElementById('proposal-rev').value = data.proposal.rev || '';
            document.getElementById('proposal-type').value = data.proposal.type || '';

            document.getElementById('client-name').value = data.client.name || '';
            document.getElementById('client-contact').value = data.client.contact || '';
            document.getElementById('client-reference').value = data.client.reference || '';

            renderItemsList();

            document.getElementById('values-amount').value = data.values.amount || '';
            document.getElementById('values-amountExtenso').value = data.values.amountExtenso || '';
            document.getElementById('values-obs').value = data.values.obs || '';
            document.getElementById('values-validity').value = data.validity || '';

            document.getElementById('signer-name').value = data.signer.name || '';
            document.getElementById('signer-role').value = data.signer.role || '';
            document.getElementById('signer-phones').value = data.signer.phones || '';
            
            renderLogoPreview('company-logo-edit-preview', 'company-logo-remove-btn');
        }

        function renderItemsList() {
            itemsContainer.innerHTML = '';
            data.items.forEach((item, idx) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'item-editor bg-white shadow-sm p-4 rounded border-l-4 border-blue-500 mb-4 relative group';
                itemEl.dataset.id = item.id;
                itemEl.innerHTML = \`
                    <button class="remove-item-btn absolute top-3 right-3 text-red-300 hover:text-red-600 p-1">X</button>
                    <span class="text-xs font-bold text-blue-500 mb-2 block uppercase">Item \${idx + 1}</span>
                    <div><label class="block text-[10px] uppercase text-gray-400 font-bold">Título</label><input type="text" value="\${item.title}" class="item-title-input w-full p-2 border text-sm rounded"></div>
                    <div class="mt-3"><label class="block text-[10px] uppercase text-gray-400 font-bold">Descrição</label><textarea class="item-text-input w-full p-2 border text-sm rounded min-h-[80px]">\${item.text}</textarea></div>
                \`;
                itemEl.querySelector('.remove-item-btn').addEventListener('click', (e) => {
                    data.items = data.items.filter(i => i.id != item.id);
                    renderItemsList();
                });
                itemsContainer.appendChild(itemEl);
            });
        }

        function renderPreview() {
            renderLogoPreview('preview-logo-container');
            document.getElementById('preview-company-name').textContent = data.company.name;
            document.getElementById('preview-company-subtitle').textContent = data.company.subtitle;
            document.getElementById('preview-company-city').textContent = data.company.city;
            document.getElementById('preview-company-email').textContent = data.company.email;
            document.getElementById('preview-company-site').textContent = data.company.site;
            document.getElementById('preview-company-phone').textContent = data.company.phone;

            document.getElementById('preview-proposal-number').textContent = data.proposal.number;
            document.getElementById('preview-proposal-date').textContent = data.proposal.date;
            document.getElementById('preview-proposal-rev').textContent = data.proposal.rev;

            document.getElementById('preview-client-name').textContent = data.client.name;
            document.getElementById('preview-client-contact').textContent = data.client.contact;
            document.getElementById('preview-client-reference').textContent = data.client.reference;

            const pic = document.getElementById('preview-items-container');
            pic.innerHTML = '';
            data.items.forEach((item, idx) => {
                pic.innerHTML += \`
                    <div class="break-inside-avoid bg-gray-50 border border-gray-200 rounded-r-lg p-4 mb-4 border-l-4 border-blue-800 shadow-sm">
                       <div class="flex items-baseline gap-3 mb-2">
                          <span class="font-black text-lg text-blue-800">ITEM \${idx + 1}</span>
                          <h3 class="font-bold text-blue-900 text-base">\${item.title}</h3>
                       </div>
                       <p class="text-xs text-gray-700 whitespace-pre-wrap text-left leading-relaxed">\${item.text}</p>
                    </div>
                \`;
            });

            document.getElementById('preview-values-amount').textContent = data.values.amount;
            document.getElementById('preview-values-amountExtenso').textContent = data.values.amountExtenso;
            const obsContainer = document.getElementById('preview-obs-container');
            if (data.values.obs) {
                document.getElementById('preview-values-obs').textContent = data.values.obs;
                obsContainer.classList.remove('hidden');
            } else {
                obsContainer.classList.add('hidden');
            }
            document.getElementById('preview-values-validity').textContent = data.validity;
            
            document.getElementById('preview-signer-name').textContent = data.signer.name;
            document.getElementById('preview-signer-role').textContent = data.signer.role;
            document.getElementById('preview-signer-phones').textContent = data.signer.phones;

            document.getElementById('preview-footer-address').textContent = data.company.address;
            document.getElementById('preview-footer-city').textContent = data.company.city;
            document.getElementById('preview-footer-cep').textContent = data.company.cep;
            document.getElementById('preview-footer-phone').textContent = data.company.phone;
            document.getElementById('preview-footer-email').textContent = data.company.email;
        }

        function renderLogoPreview(cid, bid) {
            const container = document.getElementById(cid);
            const btn = bid ? document.getElementById(bid) : null;
            container.innerHTML = '';
            if (data.company.logo) {
                container.innerHTML = \`<img src="\${data.company.logo}" class="h-full object-contain \${cid.includes('edit') ? 'w-full p-4' : 'w-auto'}" alt="Logo">\`;
                if(btn) btn.classList.remove('hidden');
            } else if (cid.includes('edit')) {
                container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-blue-400"><span class="font-bold text-sm">Adicionar Logo</span></div>';
                if(btn) btn.classList.add('hidden');
            }
        }

        const generatePDF = async () => {
            if (isGenerating) return;
            isGenerating = true;
            loader.style.display = 'flex';
            pdfBtn.classList.add('hidden');
            pdfBtnLoading.classList.remove('hidden');

            setTimeout(async () => {
                try {
                    const { jsPDF } = window.jspdf;
                    const element = document.getElementById('document-to-print');
                    const canvas = await window.html2canvas(element, { scale: 3, useCORS: true, logging: false, windowWidth: 794 });
                    const imgData = canvas.toDataURL('image/jpeg', 0.98);
                    const pdfWidth = 210;
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save(\`Proposta_\${data.proposal.number}.pdf\`);
                } catch (err) {
                    console.error(err);
                    alert("Erro ao gerar PDF.");
                } finally {
                    loader.style.display = 'none';
                    pdfBtn.classList.remove('hidden');
                    pdfBtnLoading.classList.add('hidden');
                    isGenerating = false;
                }
            }, 800);
        };

        const handleLogoUpload = (e) => {
            const file = e.target.files[0];
            if (file) {
                const r = new FileReader();
                r.onloadend = () => {
                    data.company.logo = r.result;
                    renderLogoPreview('company-logo-edit-preview', 'company-logo-remove-btn');
                    renderLogoPreview('preview-logo-container');
                };
                r.readAsDataURL(file);
            }
        };

        saveJsonBtn.addEventListener('click', () => {
            syncDataFromInputs();
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'backup.json'; a.click();
        });

        importJsonBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', (e) => {
           const f = e.target.files[0];
           if(!f) return;
           const r = new FileReader();
           r.onload = (evt) => {
               try {
                   data = JSON.parse(evt.target.result);
                   renderForm(); renderPreview(); alert('Backup restaurado!');
               } catch { alert('Erro no arquivo.'); }
           };
           r.readAsText(f);
        });

        addItemBtn.addEventListener('click', () => {
            data.items.push({ id: Date.now(), title: "Novo Serviço", text: "Descrição..." });
            renderItemsList();
        });

        editBtn.addEventListener('click', () => { view = 'edit'; syncView(); });
        previewBtn.addEventListener('click', () => { syncDataFromInputs(); renderPreview(); view = 'preview'; syncView(); });
        pdfBtn.addEventListener('click', () => { syncDataFromInputs(); renderPreview(); generatePDF(); });
        document.getElementById('company-logo-input').addEventListener('change', handleLogoUpload);
        document.getElementById('company-logo-remove-btn').addEventListener('click', () => { data.company.logo = null; renderLogoPreview('company-logo-edit-preview', 'company-logo-remove-btn'); renderLogoPreview('preview-logo-container'); });

        renderForm();
        renderPreview();
        syncView();
    });
</script>
</body>
</html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('Erro ao gerar PDF do orçamento.');
  }
}

export async function generateServiceOrderPDF(order: any) { }
