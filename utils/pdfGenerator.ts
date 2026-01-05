import { supabase } from '../lib/supabase';

// --- Configuração da Empresa ---
async function getCompanyConfig() {
  const { data: config } = await supabase.from('app_config').select('*').limit(1).maybeSingle();
  return {
    name: config?.company_name || 'ELETRICOM',
    subtitle: config?.company_subtitle || 'manutenção especializada',
    cnpj: config?.company_cnpj || config?.cnpj || '00.000.000/0000-00',
    address: config?.company_address || config?.address || 'Av Diamante 485-SL 01, Bairro Sapucaias II',
    city: config?.company_city || 'Contagem - MG',
    cep: config?.company_cep || '32073-151',
    phone: config?.company_phone || config?.phone || '(31) 2572-0156',
    email: config?.company_email || config?.email || 'operacaomg@eletricom.me',
    website: config?.company_website || 'www.eletricom.me',
    logo: config?.company_logo || config?.logo_url || null
  };
}

const formatDate = (dateString: string) => {
  if (!dateString) return new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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
    const safeString = (str: string) => (str || '').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    const itemsJson = items.map((item: any, idx: number) => ({
      id: item.id || idx + 1,
      title: safeString(item.name || 'Serviço'),
      text: safeString(item.description || '')
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
        rev: "A",
        type: safeString(quote.title || 'Manutenção')
      },
      client: {
        name: safeString(quote.clients?.name || 'Cliente'),
        contact: safeString(quote.clients?.phone || ''),
        reference: safeString(quote.description || 'Proposta Comercial')
      },
      items: itemsJson,
      values: {
        amount: total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        amountExtenso: "três mil e quinhentos reais", // Placeholder ou lógica de extenso se necessário
        obs: safeString(quote.notes || 'Este valor contempla exclusivamente o custo da mão de obra. Os materiais e eventuais peças de reposição necessários serão fornecidos pela contratante.')
      },
      validity: quote.valid_until ? formatDate(quote.valid_until) : "30 (trinta) dias",
      signer: {
        name: safeString(quote.created_by_name || 'Helgon Henrique'),
        role: "Operações",
        phones: safeString(company.phone || '(31) 99770-5904 | (31) 99333-8026')
      }
    };

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gerador de Proposta Eletricom</title>
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Bibliotecas de Geração de PDF -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    
    <!-- Fonte 'Lato' que você gostou -->
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
    
    <style>
      /* Injecção da fonte 'Lato' */
      .font-sans {
        font-family: 'Lato', sans-serif;
      }
      /* Animação do Loader */
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .animate-spin {
        animation: spin 1s linear infinite;
      }
      /* Ocultar elementos */
      .hidden {
        display: none;
      }
    </style>
</head>
<body class="min-h-screen bg-slate-100 font-sans text-slate-800 pb-32">

    <!-- LOADER (Inspirado no seu exemplo) -->
    <div id="pdf-loader" class="hidden fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 z-[10000] justify-center items-center text-white font-sans flex-col" style="display: none;">
        <div class="border-4 border-t-4 border-t-blue-500 border-gray-200 rounded-full w-10 h-10 animate-spin mb-4"></div>
        <p>Gerando PDF, por favor aguarde...</p>
    </div>

    <!-- NAVBAR -->
    <nav class="bg-blue-900 text-white shadow-lg sticky top-0 z-50">
      <div class="max-w-5xl mx-auto p-3 flex flex-col md:flex-row justify-between items-center gap-3">
        <div class="flex items-center gap-2">
           <!-- Icone: FileText -->
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
           <span class="font-bold text-lg">Gerador Eletricom</span>
        </div>
        <div class="flex flex-wrap justify-center gap-2">
           <button id="save-json-btn" class="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 rounded text-xs font-semibold border border-blue-700 transition-colors" title="Salvar arquivo para editar depois">
             <!-- Icone: Save -->
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
             Salvar Backup
           </button>
           <button id="import-json-btn" class="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 rounded text-xs font-semibold border border-blue-700 transition-colors" title="Carregar arquivo salvo">
             <!-- Icone: FolderOpen -->
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/></svg>
             Restaurar
           </button>
           <input type="file" id="import-file-input" accept=".json" class="hidden">
           <div class="w-px h-6 bg-blue-700 mx-1 hidden sm:block"></div>
           <button id="edit-btn" class="px-4 py-1.5 rounded text-sm font-bold transition-colors bg-white text-blue-900">
             Editar
           </button>
           <button id="preview-btn" class="px-4 py-1.5 rounded text-sm font-bold transition-colors text-blue-100 hover:bg-blue-800">
             Visualizar
           </button>
        </div>
      </div>
    </nav>

    <main class="max-w-5xl mx-auto p-4">
        
        <!-- === MODO DE EDIÇÃO === -->
        <div id="edit-view" class="space-y-6 animate-fade-in">
          
          <!-- Card: Identidade Visual -->
          <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
            <h3 class="text-blue-900 font-bold text-base mb-5 border-b border-slate-100 pb-2 flex items-center gap-2">1. Identidade Visual (Logo)</h3>
            <div class="flex flex-col md:flex-row gap-6 mb-6 items-center">
              <div class="w-full md:w-1/2">
                 <!-- CORREÇÃO 1: Adicionado for="company-logo-input" -->
                 <label for="company-logo-input" class="cursor-pointer flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors relative overflow-hidden shadow-inner group">
                    <div id="company-logo-edit-preview" class="h-full w-full">
                      <!-- A pré-visualização da logo (no editor) aparece aqui -->
                      <div class="flex flex-col items-center justify-center h-full">
                        <!-- Icone: Upload -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400 mb-2 group-hover:scale-110 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        <span class="text-sm text-blue-600 font-bold">Toque para adicionar Logo</span>
                        <span class="text-xs text-blue-400 mt-1">Recomendado: Fundo transparente</span>
                      </div>
                    </div>
                    <button id="company-logo-remove-btn" class="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow hover:bg-red-600 hidden">
                      <!-- Icone: X -->
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <input type="file" id="company-logo-input" class="hidden" accept="image/*">
                 </label>
              </div>
              <div class="w-full md:w-1/2 space-y-3">
                 <p class="text-sm text-gray-500 italic mb-2">Preencha os dados da sua empresa que aparecerão no cabeçalho.</p>
                 <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Nome da Empresa</label>
                    <input type="text" id="company-name" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                  </div>
                 <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Subtítulo</label>
                    <input type="text" id="company-subtitle" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                  </div>
              </div>
            </div>
            <h4 class="text-xs font-bold text-gray-400 uppercase mb-3 border-b pb-1">Endereço e Contato</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
               <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Telefone</label>
                  <input type="text" id="company-phone" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
               <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Email</label>
                  <input type="text" id="company-email" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
               <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Site</label>
                  <input type="text" id="company-site" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
               <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Endereço</label>
                  <input type="text" id="company-address" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
               <div class="flex gap-2">
                  <div class="flex-1">
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Cidade</label>
                    <input type="text" id="company-city" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                  </div>
                  <div class="w-1/3">
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">CEP</label>
                    <input type="text" id="company-cep" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                  </div>
               </div>
            </div>
          </div>

          <!-- Card: Dados da Proposta -->
          <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
            <h3 class="text-blue-900 font-bold text-base mb-5 border-b border-slate-100 pb-2 flex items-center gap-2">2. Dados da Proposta</h3>
             <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Nº Proposta</label>
                  <input type="text" id="proposal-number" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Data</label>
                  <input type="date" id="proposal-date" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Revisão</label>
                  <input type="text" id="proposal-rev" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Tipo</label>
                  <input type="text" id="proposal-type" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
             </div>
             <div class="bg-slate-50 p-4 rounded border border-slate-200">
                <h3 class="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2"><span class="w-2 h-2 bg-blue-500 rounded-full"></span> Cliente</h3>
                <div class="space-y-3">
                  <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Nome do Cliente</label>
                    <input type="text" id="client-name" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Contato (Pessoa)</label>
                        <input type="text" id="client-contact" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                      </div>
                      <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Referência / Objeto</label>
                        <input type="text" id="client-reference" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                      </div>
                  </div>
                </div>
             </div>
          </div>

          <!-- Card: Itens do Orçamento -->
          <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
            <h3 class="text-blue-900 font-bold text-base mb-5 border-b border-slate-100 pb-2 flex items-center gap-2">3. Itens do Orçamento</h3>
             <div id="items-container" class="space-y-4">
                <!-- Itens dinâmicos entram aqui -->
             </div>
             <button id="add-item-btn" class="w-full mt-4 py-3 border-2 border-dashed border-blue-300 text-blue-600 font-bold rounded-lg hover:bg-blue-50 flex justify-center items-center gap-2 transition-all hover:scale-[1.01]">
                <!-- Icone: Plus -->
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Adicionar Novo Item
             </button>
          </div>

          <!-- Card: Fechamento -->
          <div class="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
            <h3 class="text-blue-900 font-bold text-base mb-5 border-b border-slate-100 pb-2 flex items-center gap-2">4. Fechamento e Assinatura</h3>
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Valor Total (R$)</label>
                  <input type="text" id="values-amount" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Valor por Extenso</label>
                  <input type="text" id="values-amountExtenso" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                </div>
             </div>
             <div class="mb-4">
                <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Observações Finais</label>
                <textarea id="values-obs" class="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none" rows="2"></textarea>
             </div>
             <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Validade da Proposta</label>
                <input type="text" id="values-validity" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
              </div>
             <div class="mt-6 border-t border-dashed pt-4">
               <h4 class="text-sm font-bold text-gray-700 mb-2">Responsável Técnico (Assinatura)</h4>
               <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Nome</label>
                    <input type="text" id="signer-name" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Cargo</label>
                    <input type="text" id="signer-role" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Contatos</label>
                    <input type="text" id="signer-phones" class="w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
                  </div>
               </div>
             </div>
          </div>
        </div>

        <!-- === MODO VISUALIZAÇÃO (PREVIEW HTML) === -->
        <div id="preview-view" class="hidden justify-start mt-4 mb-24 overflow-auto">
           
           <!-- O "MOLDE" A4: width: '794px' -->
           <!-- CORREÇÃO 3: Voltamos ao "height: auto" (PDF esticado) -->
           <div 
             id="document-to-print" 
             class="bg-white shadow-2xl relative text-black box-border mx-auto"
             style="
               width: 794px; 
               height: auto; 
               padding-top: 45px;
               padding-left: 45px;
               padding-right: 45px;
               padding-bottom: 100px; 
               overflow: visible;
             "
           >
              <!-- Cabeçalho -->
              <div class="flex flex-row justify-between items-start border-b-2 border-blue-900 pb-4 mb-6 w-full">
                <div class="w-[60%] pr-4">
                   <!-- CORREÇÃO 4: h-64 (256px) para a logo -->
                   <div id="preview-logo-container" class="mb-4 h-64 flex items-start"> 
                     <!-- Logo entra aqui -->
                   </div>
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
              
              <!-- Cliente -->
              <section class="mb-8">
                 <h2 id="preview-client-name" class="text-xl font-bold text-gray-900 leading-tight"></h2>
                 <p id="preview-client-contact" class="text-sm text-gray-600 mb-2"></p>
                 <div class="bg-blue-50 border border-blue-100 px-3 py-2 rounded-sm w-full">
                    <p class="text-xs text-blue-900"><strong class="font-bold uppercase mr-1">Referência:</strong> <span id="preview-client-reference"></span></p>
                 </div>
              </section>
              
              <!-- Itens -->
              <section id="preview-items-container" class="mb-8">
                 <!-- Itens dinâmicos da pré-visualização entram aqui -->
              </section>

              <!-- Fechamento (Investimento, Validade, Assinatura) -->
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
                      <p class="text-xs text-gray-700">
                        <span class="font-bold text-gray-800">OBS:</span> <span id="preview-values-obs"></span>
                      </p>
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
                        <!-- Icone: FileText -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                      </div>
                    </div>
                 </footer>
              </div>

              <!-- RODAPÉ FIXO -->
              <div class="absolute left-0 w-full" style="padding: 0 45px 30px 45px; bottom: 0px;">
                <div class="border-t border-gray-200 py-3 text-center">
                  <p class="text-[9px] text-gray-500"><span id="preview-footer-address"></span> • <span id="preview-footer-city"></span> • CEP <span id="preview-footer-cep"></span></p>
                  <p class="text-[9px] text-blue-900 font-bold mt-0.5"><span id="preview-footer-phone"></span> | <span id="preview-footer-email"></span></p>
                </div>
              </div>
           </div>
        </div>

    </main>

    <!-- BOTÃO FLUTUANTE DE DOWNLOAD -->
    <div id="generate-pdf-btn-container" class="fixed bottom-6 right-6 z-50 animate-bounce-slow hidden">
      <button id="generate-pdf-btn" class="flex items-center gap-3 bg-green-600 text-white pl-6 pr-8 py-4 rounded-full shadow-2xl font-bold text-lg transition-all transform hover:scale-105 active:scale-95 border-4 border-white">
         <!-- Icone: Download -->
         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
         <span>Baixar PDF</span>
      </button>
      <div id="generate-pdf-btn-loading" class="hidden items-center gap-3 bg-green-600 text-white pl-6 pr-8 py-4 rounded-full shadow-2xl font-bold text-lg opacity-75 cursor-wait border-4 border-white">
         <!-- Icone: RefreshCw -->
         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M3 12a9 9 0 0 1 9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
         <span>Gerando PDF...</span>
      </div>
      <p class="text-center text-[10px] text-gray-500 mt-2 bg-white/80 px-2 py-1 rounded backdrop-blur-sm shadow-sm">
         (Modo de Captura Fiel)
      </p>
    </div>

<script>
// --- LÓGICA JAVASCRIPT PURA ---

// --- DADOS DINÂMICOS INJETADOS ---
let data = ${JSON.stringify(initialData)}; 

let view = 'edit';
let isGenerating = false;

// --- FUNÇÃO PRINCIPAL (EQUIVALENTE A useEffect) ---
document.addEventListener('DOMContentLoaded', () => {

  // --- SELETORES DE ELEMENTOS ---
  const editView = document.getElementById('edit-view');
  const previewView = document.getElementById('preview-view');
  
  // Botões Navbar
  const saveJsonBtn = document.getElementById('save-json-btn');
  const importJsonBtn = document.getElementById('import-json-btn');
  const importFileInput = document.getElementById('import-file-input');
  const editBtn = document.getElementById('edit-btn');
  const previewBtn = document.getElementById('preview-btn');

  // Botão Flutuante
  const pdfBtnContainer = document.getElementById('generate-pdf-btn-container');
  const pdfBtn = document.getElementById('generate-pdf-btn');
  const pdfBtnLoading = document.getElementById('generate-pdf-btn-loading');
  const loader = document.getElementById('pdf-loader');
  
  // Container de Itens
  const itemsContainer = document.getElementById('items-container');
  const addItemBtn = document.getElementById('add-item-btn');

  // --- FUNÇÕES DE SINCRONIZAÇÃO DE UI ---
  
  // Sincroniza a visualização (qual tela mostrar)
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
  
  // Pega os dados dos inputs do formulário e salva no objeto 'data'
  function syncDataFromInputs() {
    // Empresa
    data.company.name = document.getElementById('company-name').value;
    data.company.subtitle = document.getElementById('company-subtitle').value;
    data.company.phone = document.getElementById('company-phone').value;
    data.company.email = document.getElementById('company-email').value;
    data.company.site = document.getElementById('company-site').value;
    data.company.address = document.getElementById('company-address').value;
    data.company.city = document.getElementById('company-city').value;
    data.company.cep = document.getElementById('company-cep').value;
    // Proposta
    data.proposal.number = document.getElementById('proposal-number').value;
    data.proposal.date = document.getElementById('proposal-date').value;
    data.proposal.rev = document.getElementById('proposal-rev').value;
    data.proposal.type = document.getElementById('proposal-type').value;
    // Cliente
    data.client.name = document.getElementById('client-name').value;
    data.client.contact = document.getElementById('client-contact').value;
    data.client.reference = document.getElementById('client-reference').value;
    // Itens (lógica de loop)
    data.items = [];
    const itemElements = itemsContainer.querySelectorAll('.item-editor');
    itemElements.forEach(itemEl => {
      const id = itemEl.dataset.id;
      const title = itemEl.querySelector('.item-title-input').value;
      const text = itemEl.querySelector('.item-text-input').value;
      data.items.push({ id, title, text });
    });
    // Valores
    data.values.amount = document.getElementById('values-amount').value;
    data.values.amountExtenso = document.getElementById('values-amountExtenso').value;
    data.values.obs = document.getElementById('values-obs').value;
    data.validity = document.getElementById('values-validity').value;
    // Assinatura
    data.signer.name = document.getElementById('signer-name').value;
    data.signer.role = document.getElementById('signer-role').value;
    data.signer.phones = document.getElementById('signer-phones').value;
  }

  // Pega os dados do objeto 'data' e preenche o formulário
  function renderForm() {
    // Empresa
    document.getElementById('company-name').value = data.company.name || '';
    document.getElementById('company-subtitle').value = data.company.subtitle || '';
    document.getElementById('company-phone').value = data.company.phone || '';
    document.getElementById('company-email').value = data.company.email || '';
    document.getElementById('company-site').value = data.company.site || '';
    document.getElementById('company-address').value = data.company.address || '';
    document.getElementById('company-city').value = data.company.city || '';
    document.getElementById('company-cep').value = data.company.cep || '';
    // Proposta
    document.getElementById('proposal-number').value = data.proposal.number || '';
    document.getElementById('proposal-date').value = data.proposal.date || '';
    document.getElementById('proposal-rev').value = data.proposal.rev || '';
    document.getElementById('proposal-type').value = data.proposal.type || '';
    // Cliente
    document.getElementById('client-name').value = data.client.name || '';
    document.getElementById('client-contact').value = data.client.contact || '';
    document.getElementById('client-reference').value = data.client.reference || '';
    // Itens
    renderItemsList();
    // Valores
    document.getElementById('values-amount').value = data.values.amount || '';
    document.getElementById('values-amountExtenso').value = data.values.amountExtenso || '';
    document.getElementById('values-obs').value = data.values.obs || '';
    document.getElementById('values-validity').value = data.validity || '';
    // Assinatura
    document.getElementById('signer-name').value = data.signer.name || '';
    document.getElementById('signer-role').value = data.signer.role || '';
    document.getElementById('signer-phones').value = data.signer.phones || '';
    // Logo (pré-visualização do editor)
    renderLogoPreview('company-logo-edit-preview', 'company-logo-remove-btn');
  }
  
  // Renderiza a lista de itens no EDITOR
  function renderItemsList() {
    itemsContainer.innerHTML = ''; // Limpa
    data.items.forEach((item, idx) => {
      const id = item.id;
      const itemEl = document.createElement('div');
      itemEl.className = 'item-editor bg-white shadow-sm p-4 rounded border-l-4 border-blue-500 mb-4 relative group';
      itemEl.dataset.id = id;
      
      itemEl.innerHTML = \`
        <button data-id="\${id}" class="remove-item-btn absolute top-3 right-3 text-red-300 hover:text-red-600 p-1 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
        <span class="text-xs font-bold text-blue-500 mb-2 block uppercase tracking-wide">Item \${idx + 1}</span>
        <div>
          <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Título do Serviço</label>
          <input type="text" value="\${item.title}" class="item-title-input w-full p-2 text-sm border border-gray-300 rounded bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all">
        </div>
        <div class="mt-3">
           <label class="text-[10px] font-bold text-gray-500 uppercase">Descrição Detalhada</label>
           <textarea class="item-text-input w-full p-3 text-sm border border-gray-200 bg-slate-50 rounded focus:border-blue-500 outline-none resize-y min-h-[100px]" rows="4">\${item.text}</textarea>
        </div>
      \`;
      
      itemEl.querySelector('.remove-item-btn').addEventListener('click', (e) => {
        const idToRemove = e.currentTarget.dataset.id;
        data.items = data.items.filter(i => i.id.toString() !== idToRemove.toString());
        renderItemsList();
      });
      
      itemsContainer.appendChild(itemEl);
    });
  }

  // Pega os dados do objeto 'data' e preenche a PRÉ-VISUALIZAÇÃO
  function renderPreview() {
    // Cabeçalho
    renderLogoPreview('preview-logo-container');
    document.getElementById('preview-company-name').innerText = data.company.name;
    document.getElementById('preview-company-subtitle').innerText = data.company.subtitle;
    document.getElementById('preview-company-city').innerText = data.company.city;
    document.getElementById('preview-company-email').innerText = data.company.email;
    document.getElementById('preview-company-site').innerText = data.company.site;
    document.getElementById('preview-company-phone').innerText = data.company.phone;
    // Proposta
    document.getElementById('preview-proposal-number').innerText = data.proposal.number;
    document.getElementById('preview-proposal-date').innerText = data.proposal.date;
    document.getElementById('preview-proposal-rev').innerText = data.proposal.rev;
    // Cliente
    document.getElementById('preview-client-name').innerText = data.client.name;
    document.getElementById('preview-client-contact').innerText = data.client.contact;
    document.getElementById('preview-client-reference').innerText = data.client.reference;
    // Itens (loop)
    const previewItemsContainer = document.getElementById('preview-items-container');
    previewItemsContainer.innerHTML = ''; // Limpa
    data.items.forEach((item, idx) => {
      previewItemsContainer.innerHTML += \`
        <div class="break-inside-avoid bg-gray-50 border border-gray-200 rounded-r-lg p-4 mb-4 border-l-4 border-blue-800 shadow-sm">
           <div class="flex items-baseline gap-3 mb-2">
              <span class="font-black text-lg text-blue-800">ITEM \${idx + 1}</span>
              <h3 class="font-bold text-blue-900 text-base">\${item.title}</h3>
           </div>
           <p class="text-xs text-gray-700 whitespace-pre-wrap text-left leading-relaxed">\${item.text}</p>
        </div>
      \`;
    });
    // Valores
    document.getElementById('preview-values-amount').innerText = data.values.amount;
    document.getElementById('preview-values-amountExtenso').innerText = data.values.amountExtenso;
    const obsContainer = document.getElementById('preview-obs-container');
    if (data.values.obs) {
      document.getElementById('preview-values-obs').innerText = data.values.obs;
      obsContainer.classList.remove('hidden');
    } else {
      obsContainer.classList.add('hidden');
    }
    document.getElementById('preview-values-validity').innerText = data.validity;
    // Assinatura
    document.getElementById('preview-signer-name').innerText = data.signer.name;
    document.getElementById('preview-signer-role').innerText = data.signer.role;
    document.getElementById('preview-signer-phones').innerText = data.signer.phones;
    // Rodapé Fixo
    document.getElementById('preview-footer-address').innerText = data.company.address;
    document.getElementById('preview-footer-city').innerText = data.company.city;
    document.getElementById('preview-footer-cep').innerText = data.company.cep;
    document.getElementById('preview-footer-phone').innerText = data.company.phone;
    document.getElementById('preview-footer-email').innerText = data.company.email;
  }
  
  function renderLogoPreview(containerId, removeBtnId = null) {
      const logoContainer = document.getElementById(containerId);
      const removeBtn = removeBtnId ? document.getElementById(removeBtnId) : null;
      
      logoContainer.innerHTML = ''; 
      
      if (data.company.logo) {
          if (containerId === 'company-logo-edit-preview') {
              logoContainer.innerHTML = \`<img src="\${data.company.logo}" class="h-full w-full object-contain p-4" alt="Logo">\`;
          } else {
              logoContainer.innerHTML = \`<img src="\${data.company.logo}" class="h-full w-auto object-contain" alt="Logo" crossorigin="anonymous">\`;
          }
          if (removeBtn) removeBtn.classList.remove('hidden');
      } else if (containerId === 'company-logo-edit-preview') {
          logoContainer.innerHTML = \`
            <div class="flex flex-col items-center justify-center h-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400 mb-2 group-hover:scale-110 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span class="text-sm text-blue-600 font-bold">Toque para adicionar Logo</span>
            </div>
          \`;
          if (removeBtn) removeBtn.classList.add('hidden');
      }
  }


  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(\`script[src="\${src}"]\`)) {
        return resolve();
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(\`Script load error for \${src}\`));
      document.body.appendChild(script);
    });
  };

  const generatePDF = async () => {
    if (isGenerating) return;
    isGenerating = true;
    loader.style.display = 'flex';
    pdfBtn.classList.add('hidden');
    pdfBtnLoading.classList.remove('hidden');

    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar bibliotecas.");
      isGenerating = false;
      loader.style.display = 'none';
      pdfBtn.classList.remove('hidden');
      pdfBtnLoading.classList.add('hidden');
      return;
    }
      
    setTimeout(async () => {
      const { jsPDF } = window.jspdf;
      const element = document.getElementById('document-to-print');

      try {
        const canvas = await window.html2canvas(element, {
          scale: 3, 
          useCORS: true,
          logging: false,
          windowWidth: 794
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasHeight / canvasWidth;
        const pdfWidth = 210; 
        const pdfHeight = pdfWidth * ratio; 

        const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(\`Proposta_\${data.proposal.number}.pdf\`);
        
      } catch (err) {
        console.error(err);
        alert("Erro ao gerar o PDF.");
      } finally {
        loader.style.display = 'none';
        pdfBtn.classList.remove('hidden');
        pdfBtnLoading.classList.add('hidden');
        isGenerating = false;
      }
    }, 800);
  };
  
  const handleExportJSON = () => {
    syncDataFromInputs();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = \`Backup_Proposta_\${data.proposal.number || 'Nova'}.json\`;
    link.click();
  };

  const handleImportJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData.company && importedData.items) {
          data = importedData;
          renderForm();
          renderPreview();
          alert("Backup restaurado!");
        }
      } catch { alert("Erro ao ler o arquivo."); }
    };
    reader.readAsText(file);
    event.target.value = null; 
  };
  
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        data.company.logo = reader.result;
        renderLogoPreview('company-logo-edit-preview', 'company-logo-remove-btn');
        renderLogoPreview('preview-logo-container');
      };
      reader.readAsDataURL(file);
    }
  };
  
  const removeLogo = () => {
      data.company.logo = null;
      renderLogoPreview('company-logo-edit-preview', 'company-logo-remove-btn');
      renderLogoPreview('preview-logo-container');
  };

  const addItem = () => {
      const newId = Date.now();
      data.items.push({ id: newId, title: "Novo Serviço", text: "Descrição..." });
      renderItemsList();
  };


  editBtn.addEventListener('click', () => { view = 'edit'; syncView(); });
  previewBtn.addEventListener('click', () => { syncDataFromInputs(); renderPreview(); view = 'preview'; syncView(); });
  pdfBtn.addEventListener('click', () => { syncDataFromInputs(); renderPreview(); generatePDF(); });
  saveJsonBtn.addEventListener('click', handleExportJSON);
  importJsonBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', handleImportJSON);
  addItemBtn.addEventListener('click', addItem);
  document.getElementById('company-logo-input').addEventListener('change', handleLogoUpload);
  document.getElementById('company-logo-remove-btn').addEventListener('click', removeLogo);

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
