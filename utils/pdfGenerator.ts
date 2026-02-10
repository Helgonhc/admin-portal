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

// --- Conversão de Imagem para Base64 (Garante renderização no PDF sem falhas) ---
async function urlToBase64(url: string): Promise<string> {
  if (!url) return '';
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn(`Erro ao converter ${url} para Base64:`, e);
    return url; // Retorna URL original se falhar, permitindo tentativa do browser
  }
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

    const signerProfile = quote.profiles;
    const signerSigB64 = await urlToBase64(signerProfile?.signature_url);

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
        site: safeString(company.website), cnpj: safeString(company.cnpj)
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
        name: safeString(signerProfile?.full_name || quote.created_by_name || 'Helgon Henrique'),
        role: "Operações",
        phones: safeString(company.phone || '(31) 99770-5904 | (31) 99333-8026'),
        signature: signerSigB64
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
    
    <!-- Fonte 'Inter' para consistência com o APK -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    
    <style>
      .font-sans {
        font-family: 'Inter', sans-serif;
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
        <div class="w-64 bg-gray-700/50 rounded-full h-2 mb-4 overflow-hidden border border-white/10">
            <div id="pdf-progress-bar" class="bg-blue-500 h-full transition-all duration-[400ms]" style="width: 0%"></div>
        </div>
        <p class="font-bold text-lg mb-1"><span id="pdf-percentage">0</span>%</p>
        <p class="text-sm text-gray-300 animate-pulse">Processando alta fidelidade...</p>
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
              <!-- Cabeçalho Estilo APK -->
              <div class="flex flex-row justify-between items-start border-b-2 border-[#1e3a8a] pb-6 mb-8 w-full">
                <div class="w-[65%] text-left">
                   <div id="preview-logo-container" class="mb-4 h-16 flex items-start"> 
                     <!-- Logo entra aqui -->
                   </div>
                   <h1 id="preview-company-name" class="text-xl font-extrabold text-[#1e3a8a] uppercase leading-none mb-2 tracking-tight"></h1>
                   <div class="text-[10px] text-gray-500 font-medium leading-relaxed">
                      <p id="preview-company-subtitle" class="font-bold text-[#1e3a8a] text-[11px] mb-1"></p>
                      <p><strong class="text-gray-700">CNPJ:</strong> <span id="preview-company-cnpj"></span></p>
                      <p id="preview-company-address"></p>
                      <p><span id="preview-company-city"></span> • CEP <span id="preview-company-cep"></span></p>
                   </div>
                </div>
                <div class="w-[35%] flex flex-col items-end text-right">
                   <div class="bg-slate-50 border-l-4 border-[#1e3a8a] p-4 w-full text-left mb-4 shadow-sm rounded-r">
                    <h2 class="font-bold text-[#1e3a8a] text-[10px] uppercase tracking-widest mb-2">Proposta Comercial</h2>
                    <div class="text-[10px] space-y-1.5">
                       <div class="flex justify-between border-b border-gray-200 pb-1"><span class="font-bold text-gray-500">Nº:</span> <span id="preview-proposal-number" class="font-extrabold text-[#1e3a8a]"></span></div>
                       <div class="flex justify-between border-b border-gray-200 pb-1"><span class="font-bold text-gray-500">DATA:</span> <span id="preview-proposal-date"></span></div>
                       <div class="flex justify-between"><span class="font-bold text-gray-500">REV:</span> <span id="preview-proposal-rev"></span></div>
                    </div>
                   </div>
                   <div class="text-[9px] text-gray-500 font-medium space-y-1">
                      <p id="preview-company-email" class="flex items-center justify-end gap-1"><span id="preview-company-site"></span></p>
                      <p id="preview-company-phone"></p>
                   </div>
                </div>
              </div>
              
              <!-- Título do Documento com Badge -->
              <div class="bg-slate-50 p-4 border-l-4 border-[#1e3a8a] rounded-r mb-8 flex justify-between items-center">
                 <h2 class="text-lg font-extrabold text-slate-900 uppercase">Proposta de Manutenção Elétrica</h2>
                 <span class="bg-emerald-50 text-emerald-700 text-[8px] font-extrabold px-2 py-1 rounded border border-emerald-100 uppercase tracking-tighter">✓ Autenticado</span>
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
                      <div class="w-56 text-center">
                          <div class="h-10 flex items-end justify-center mb-1">
                            ${initialData.signer.signature ? `<img src="${initialData.signer.signature}" style="max-height: 40px; width: auto;">` : '<div style="height: 20px; border-bottom: 1px dashed #cbd5e1; width: 100%;"></div>'}
                          </div>
                          <div class="border-t border-gray-800 pt-1">
                            <p id="preview-signer-name" class="font-bold text-gray-900 text-[11px]"></p>
                            <p id="preview-signer-role" class="text-[9px] text-gray-600 uppercase font-bold"></p>
                            <p id="preview-signer-phones" class="text-[9px] text-gray-500"></p>
                          </div>
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
      const loader = document.getElementById('pdf-loader');
      const progressBar = document.getElementById('pdf-progress-bar');
      const percentageText = document.getElementById('pdf-percentage');

      let progress = 0;
      const interval = setInterval(() => {
        if (progress < 90) {
          progress += Math.random() * 5;
          if (progress > 90) progress = 90;
          progressBar.style.width = progress + '%';
          percentageText.innerText = Math.round(progress);
        }
      }, 400);

      try {
        const canvas = await window.html2canvas(element, {
          scale: 2.2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          letterRendering: true,
          windowWidth: 794
        });

        const mmWidth = 210;
        const mmHeight = (canvas.height * mmWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/jpeg', 0.90);

        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: [mmWidth, mmHeight],
          compress: true
        });

        clearInterval(interval);
        progressBar.style.width = '100%';
        percentageText.innerText = '100';

        pdf.addImage(imgData, 'JPEG', 0, 0, mmWidth, mmHeight, undefined, 'FAST');
        pdf.save('Proposta_' + data.proposal.number + '.pdf');
        
      } catch (err) {
        clearInterval(interval);
        console.error(err);
        alert("Erro ao gerar o PDF.");
      } finally {
        clearInterval(interval);
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

export async function generateServiceOrderPDF(order: any) {
  try {
    const company = await getCompanyConfig();

    const formatDateFull = (dateString: string) => {
      if (!dateString) return '-';
      try {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR');
      } catch { return String(dateString); }
    };

    const safeString = (str: string) => (str || '').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    const formatOrderNumber = (orderNumber: string, createdAt: string) => {
      if (!orderNumber) return 'OS';
      try {
        const d = new Date(createdAt);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const seq = orderNumber.slice(-3).toUpperCase();
        return `${year}-${month}-${seq}`;
      } catch { return orderNumber.slice(0, 8).toUpperCase(); }
    };

    // Carregar dados extras (Tarefas e Itens)
    const [tasksRes, itemsRes] = await Promise.all([
      supabase.from('order_tasks').select('*').eq('order_id', order.id).order('created_at'),
      supabase.from('service_order_items').select('*').eq('order_id', order.id)
    ]);

    const tasks = tasksRes.data || [];
    const items = itemsRes.data || [];
    const osId = formatOrderNumber(order.id, order.created_at);
    const rawPhotos = order.photos_url || order.photos || [];
    const reportText = order.execution_report || order.description || 'Nenhum relatório registrado.';

    // --- CONVERSÃO PARA BASE64 EM PARALELO ---
    const [logoB64, clientSigB64, techSigB64, ...photosB64] = await Promise.all([
      urlToBase64(company.logo),
      urlToBase64(order.signature_url),
      urlToBase64(order.technician?.signature_url || order.technician_signature_url),
      ...rawPhotos.map((p: string) => urlToBase64(p))
    ]);

    const techName = order.technician?.full_name || 'Técnico Responsável';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    @page { 
      size: A4; 
      margin: 8mm;
    }
    
    * { margin:0; padding:0; box-sizing:border-box; }
    
    body { 
      font-family: 'Inter', sans-serif; 
      font-size: 10px; 
      color: #1a1a1a; 
      line-height: 1.4;
      background: white;
    }

    /* Estrutura para repetição de cabeçalho e rodapé */
    table.report-container { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead.report-header { display: table-header-group; }
    tfoot.report-footer { display: table-footer-group; }

    .page-padding { padding: 0 10mm; }

    /* CABEÇALHO PREMIUM */
    .header-box {
      padding: 10px 0;
      margin-bottom: 10px;
      border-bottom: 1.5px solid #1e3a8a15;
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
    }
    .header-logo { width: 110px; height: 60px; object-fit: contain; }
    .header-info { flex: 1; padding-left: 20px; }
    .company-name { font-size: 16px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin-bottom: 2px; }
    .company-details { font-size: 9px; color: #64748b; }
    
    .os-badge {
      text-align: right;
      background: #1e3a8a;
      color: white;
      padding: 10px 18px;
      border-radius: 8px;
    }
    .os-label { font-size: 8px; opacity: 0.85; text-transform: uppercase; font-weight: 700; }
    .os-num { font-size: 14px; font-weight: 800; display: block; margin-top: 1px; }

    /* RODAPÉ PREMIUM */
    .footer-box {
      padding: 10px 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      background: #f8fafc;
    }
    .footer-text { font-size: 7px; color: #64748b; line-height: 1.4; }
    .footer-highlight { font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin-bottom: 1px; }

    /* SEÇÕES */
    .section { margin-bottom: 15px; page-break-inside: avoid; }
    .section-title {
      background: #1e3a8a;
      color: white;
      padding: 8px 15px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .data-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 8px; }
    .info-card { background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #f1f5f9; }
    .info-label { font-size: 8px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 3px; }
    .info-value { font-size: 11px; color: #1e293b; font-weight: 600; }

    /* CHECKLIST */
    .checklist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .check-item { 
      padding: 8px 12px; 
      background: white; 
      border: 1px solid #f1f5f9; 
      border-radius: 6px; 
      display: flex; 
      align-items: center; 
      gap: 10px;
    }
    .check-box { 
      width: 14px; height: 14px; border-radius: 50%; 
      border: 1.5px solid #cbd5e1; 
      display: flex; align-items: center; justify-content: center;
    }
    .check-box.done { background: #10b981; border-color: #10b981; }
    .check-icon { color: white; font-size: 9px; font-weight: 900; }
    .check-text { font-size: 10px; color: #475569; }

    /* RELATÓRIO */
    .report-content {
      padding: 15px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #1e3a8a;
      border-radius: 6px;
      font-size: 10px;
      white-space: pre-wrap;
      color: #334155;
      line-height: 1.5;
    }

    /* ITENS */
    .items-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    .items-table th { background: #f8fafc; color: #64748b; font-size: 8px; text-transform: uppercase; padding: 10px; text-align: left; border-bottom: 1.5px solid #e2e8f0; }
    .items-table td { border-bottom: 1px solid #f1f5f9; padding: 10px; font-size: 10px; }
    .total-row { background: #f8fafc; font-weight: 800; color: #1e3a8a; font-size: 11px; }

    /* FOTOS */
    .photos-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .photo-card {
      background: #ffffff;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      aspect-ratio: 1/1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .photo-img { width: 100%; height: 100%; object-fit: cover; }

    /* ASSINATURAS */
    .signature-container { 
      page-break-inside: avoid;
      margin-top: 15px;
      padding: 0 10mm;
    }
    .signature-section { 
      display: flex; 
      justify-content: space-between; 
      gap: 40px; 
      margin-top: 10px;
    }
    .sig-box { flex: 1; text-align: center; }
    .sig-img { height: 60px; object-fit: contain; margin-bottom: 8px; }
    .sig-line { border-top: 1px solid #0f172a; margin-bottom: 5px; width: 100%; }
    .sig-name { font-weight: 700; font-size: 10px; text-transform: uppercase; color: #0f172a; }
    .sig-role { font-size: 8px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
    <div id="pdf-loader" class="fixed inset-0 bg-gray-900/80 z-50 flex flex-col items-center justify-center text-white hidden backdrop-blur-sm">
        <div class="w-64 bg-gray-700/50 rounded-full h-2 mb-4 overflow-hidden border border-white/10">
            <div id="pdf-progress-bar" class="bg-blue-500 h-full transition-all duration-[400ms]" style="width: 0%"></div>
        </div>
        <p class="font-bold text-lg mb-1"><span id="pdf-percentage">0</span>%</p>
        <p class="text-sm text-gray-300 animate-pulse">Processando alta fidelidade...</p>
    </div>

    <div class="fixed top-6 left-1/2 -translate-x-1/2 z-40 no-print">
        <button id="btn-download" class="bg-blue-900 hover:bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-all flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            BAIXAR RELATÓRIO PDF
        </button>
    </div>

    <table id="print-area" class="report-container" style="width: 794px; margin: 0 auto;">
    <thead class="report-header">
      <tr>
        <td>
          <div class="page-padding">
            <div class="header-box">
              <div class="header-content">
                ${logoB64 ? `<img src="${logoB64}" class="header-logo">` : '<div class="header-logo" style="background:#ddd; display: flex; align-items: center; justify-content: center; color: #999; font-weight: bold;">LOGO</div>'}
                <div class="header-info">
                  <div class="company-name">${company.name}</div>
                  <div class="company-details">
                    CNPJ: ${company.cnpj}<br>
                    ${company.address} • ${company.city}
                  </div>
                </div>
                <div class="os-badge">
                  <span class="os-label">ORDEM DE SERVIÇO</span>
                  <span class="os-num">#${osId}</span>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </thead>

    <tbody class="report-body">
      <tr>
        <td>
          <div class="page-padding">
            <div class="section">
              <div class="section-title">Dados Gerais e Localização</div>
              <div class="data-grid">
                <div class="info-card">
                  <div class="info-label">Cliente / Razão Social</div>
                  <div class="info-value">${order.clients?.name || '-'}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Técnico Responsável</div>
                  <div class="info-value">${techName}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Datas do Atendimento</div>
                  <div class="info-value" style="font-size: 10px;">
                    Abertura: ${formatDateFull(order.created_at)}<br>
                    Conclusão: ${formatDateFull(order.completed_at || order.updated_at)}
                  </div>
                </div>
                <div class="info-card">
                  <div class="info-label">Assunto / Título</div>
                  <div class="info-value">${order.title || 'Manutenção Corretiva/Preventiva'}</div>
                </div>
              </div>
            </div>

            ${tasks.length > 0 ? `
            <div class="section">
              <div class="section-title">Checklist Técnica de Execução</div>
              <div class="checklist-grid">
                ${tasks.map((t: any) => `
                <div class="check-item">
                  <div class="check-box ${t.is_completed ? 'done' : ''}">
                    ${t.is_completed ? '<span class="check-icon">✓</span>' : ''}
                  </div>
                  <span class="check-text">${t.title}</span>
                </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <div class="section">
              <div class="section-title">Relatório de Atendimento e Conclusão</div>
              <div class="report-content">${reportText}</div>
            </div>

            ${items.length > 0 ? `
            <div class="section">
              <div class="section-title">Lista de Peças e Serviços</div>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Descrição do Item/Serviço</th>
                    <th style="width: 80px; text-align:center">Qtd</th>
                    <th style="width: 120px; text-align:right">Total (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((i: any) => `
                  <tr>
                    <td>${i.description || 'Item de Manutenção'}</td>
                    <td style="text-align:center">${i.quantity}</td>
                    <td style="text-align:right">${((Number(i.unit_price) || 0) * (Number(i.quantity) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  `).join('')}
                  <tr class="total-row">
                    <td colspan="2" style="text-align:right; text-transform: uppercase;">Total do Investimento</td>
                    <td style="text-align:right">R$ ${items.reduce((acc: number, i: any) => acc + ((Number(i.unit_price) || 0) * (Number(i.quantity) || 1)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ` : ''}

            ${photosB64.length > 0 ? `
            <div class="section">
              <div class="section-title">Evidências Fotográficas</div>
              <div class="photos-grid">
                ${photosB64.map((p: string) => `
                <div class="photo-card">
                  <img src="${p}" class="photo-img">
                </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <!-- Seção de Assinaturas (DENTRO DO TBODY PARA GARANTIR CAPTURA) -->
            <div class="signature-container" style="margin-top: 30px; margin-bottom: 20px;">
              <div class="signature-section">
                <div class="sig-box">
                  ${clientSigB64 ? `<img src="${clientSigB64}" class="sig-img">` : '<div style="height:80px"></div>'}
                  <div class="sig-line"></div>
                  <div class="sig-name">${order.signer_name || 'Assinatura do Cliente'}</div>
                  <div class="sig-role">${order.signer_doc ? 'Doc: ' + order.signer_doc : 'Responsável pelo Recebimento'}</div>
                </div>
                <div class="sig-box">
                  ${techSigB64 ? `<img src="${techSigB64}" class="sig-img">` : '<div style="height:80px"></div>'}
                  <div class="sig-line"></div>
                  <div class="sig-name">${techName}</div>
                  <div class="sig-role">Técnico Responsável</div>
                </div>
              </div>
            </div>
        </td>
      </tr>
    </tbody>

    <tfoot class="report-footer">
      <tr>
        <td>
          <div class="footer-box">
            <div class="footer-text">
              <div class="footer-highlight">${company.name} • ENGENHARIA E MANUTENÇÃO</div>
              ${company.cnpj} • ${company.address} • ${company.city} • CEP: ${company.cep}<br>
              Portal Corporativo: ${company.website || 'www.eletricom.me'} • Contato: ${company.phone} • ${company.email}
            </div>
          </div>
        </td>
      </tr>
    </tfoot>
  </table>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script>
    document.getElementById('btn-download').addEventListener('click', async () => {
      const btn = document.getElementById('btn-download');
      const loader = document.getElementById('pdf-loader');
      const progressBar = document.getElementById('pdf-progress-bar');
      const percentageText = document.getElementById('pdf-percentage');
      btn.style.display = 'none';
      loader.classList.remove('hidden');

      let progress = 0;
      const interval = setInterval(() => {
        if (progress < 92) {
          progress += Math.random() * 4;
          if (progress > 92) progress = 92;
          progressBar.style.width = progress + '%';
          percentageText.innerText = Math.round(progress);
        }
      }, 400);

      try {
        const element = document.getElementById('print-area');
        const canvas = await html2canvas(element, {
          scale: 2.2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          letterRendering: true,
          windowWidth: 794
        });

        const mmWidth = 210;
        const mmHeight = (canvas.height * mmWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/jpeg', 0.90);
        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: [mmWidth, mmHeight],
          compress: true
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, mmWidth, mmHeight, undefined, 'FAST');
        pdf.save('Relatorio_OS_' + "${osId}" + '.pdf');

        setTimeout(() => window.close(), 500);
      } catch (err) {
        console.error(err);
        alert('Erro ao gerar PDF: ' + err.message);
      } finally {
        loader.classList.add('hidden');
        btn.style.display = 'flex';
      }
    });
  </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }

  } catch (error) {
    console.error('Erro ao gerar relatório OS Premium:', error);
    alert('Erro ao gerar o PDF. Verifique o console.');
  }
}

export async function generateInstallationPDF(inst: any) {
  try {
    const company = await getCompanyConfig();

    const formatDateFull = (dateString: string) => {
      if (!dateString) return '-';
      try {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR');
      } catch { return String(dateString); }
    };

    const safeString = (str: string) => (str || '').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    const techSigB64 = await urlToBase64(inst.technician?.signature_url || inst.technician_signature);

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
        site: safeString(company.website), cnpj: safeString(company.cnpj)
      },
      installation: {
        id: safeString(inst.id?.slice(0, 8).toUpperCase()),
        title: safeString(inst.title),
        status: safeString(inst.status),
        created_at: formatDateFull(inst.created_at),
        scheduled_date: formatDateFull(inst.scheduled_date || inst.start_date),
        start_date: formatDateFull(inst.start_date),
        end_date: formatDateFull(inst.end_date),
        description: safeString(inst.description)
      },
      client: {
        name: safeString(inst.clients?.name),
        cnpj: safeString(inst.cnpj || inst.clients?.cnpj_cpf),
        address: safeString(inst.location_address)
      },
      technical: {
        technician: safeString(inst.technician?.full_name || inst.technician_name || 'Não atribuído'),
        wifi_ssid: safeString(inst.wifi_ssid),
        wifi_password: safeString(inst.wifi_password)
      },
      telemetry: (inst.telemetry_levels || []).map((level: any) => ({
        name: safeString(level.name),
        quantity: level.quantity
      })),
      signatures: {
        customer: inst.customer_signature,
        technician: techSigB64
      }
    };

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório Técnico - ${initialData.installation.id}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      @page {
        size: A4;
        margin: 10mm;
      }
      body { 
        font-family: 'Inter', system-ui, -apple-system, sans-serif; 
        margin: 0; 
        padding: 0;
        color: #1e293b;
        background: white;
        -webkit-print-color-adjust: exact;
      }
      .page-padding { padding: 0; }
      .report-container {
        width: 100%;
        border-collapse: collapse;
        background: white;
      }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      
      .header-wrapper {
        padding: 40px 40px 20px 40px;
        border-bottom: 2px solid #111827;
        margin-bottom: 20px;
        background: white;
      }
      .footer-wrapper {
        padding: 20px 40px 40px 40px;
        border-top: 1px solid #e5e7eb;
        margin-top: 20px;
        text-align: center;
        background: white;
      }
      .content-wrapper {
        padding: 0 40px;
        background: white;
      }

      .field-label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6b7280;
        font-weight: 600;
        margin-bottom: 2px;
      }
      .field-value {
        font-size: 11px;
        color: #111827;
        font-weight: 500;
        line-height: 1.4;
      }
      .section-title {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #374151;
        font-weight: 700;
        padding-bottom: 8px;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 12px;
      }

      .corporate-footer {
        font-size: 8px;
        color: #6b7280;
        line-height: 1.6;
      }
      .corporate-brand {
        font-weight: 800;
        color: #111827;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 4px;
      }

      .status-badge { 
        padding: 4px 10px; 
        border-radius: 4px; 
        font-size: 10px; 
        font-weight: 600; 
        text-transform: uppercase; 
        display: inline-block;
      }
      .status-concluido, .status-concluida { background: #ecfdf5; color: #047857; border: 1px solid #d1fae5; }
      .status-pendente { background: #fffbeb; color: #b45309; border: 1px solid #fef3c7; }
      .status-em_andamento { background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; }
      
      .signature-img {
        height: 60px;
        width: auto;
        max-width: 100%;
        object-fit: contain;
        margin: 0 auto 8px;
      }
      
      @media print {
        body { background: white; padding: 0; }
        .no-print { display: none !important; }
      }
    </style>
</head>
<body class="py-10">
    <div id="pdf-loader" class="fixed inset-0 bg-gray-900/80 z-50 flex flex-col items-center justify-center text-white hidden backdrop-blur-sm">
        <div class="w-10 h-10 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin mb-4"></div>
        <p class="font-medium text-sm">Gerando PDF...</p>
    </div>

    <div class="fixed top-6 left-1/2 -translate-x-1/2 z-40 no-print">
        <button id="btn-download" class="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-all flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Baixar PDF
        </button>
    </div>

    <table id="print-area" class="report-container mx-auto" style="width: 794px;">
        <thead>
            <tr>
                <td>
                    <div class="header-wrapper">
                        <div class="flex justify-between items-start">
                            <div class="flex gap-4 items-center">
                                <div class="w-16 h-16 flex items-center justify-center p-1 bg-white border border-gray-100 rounded-lg">
                                    ${initialData.company.logo ? `<img src="${initialData.company.logo}" class="max-w-full max-h-full object-contain">` : `<div class="bg-gray-100 w-full h-full flex items-center justify-center text-gray-400 font-bold rounded">LOGO</div>`}
                                </div>
                                <div>
                                    <h1 class="text-xl font-bold text-gray-900 leading-tight mb-1">${initialData.company.name}</h1>
                                    <div class="text-[10px] text-gray-500 space-y-0.5">
                                        <p>${initialData.company.subtitle}</p>
                                        <p>${initialData.company.address} - ${initialData.company.city}</p>
                                        <p>${initialData.company.phone} • ${initialData.company.email}</p>
                                    </div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="mb-2">
                                    <p class="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Identificador</p>
                                    <p class="text-lg font-mono font-bold text-gray-800">#${initialData.installation.id}</p>
                                </div>
                                <span class="status-badge status-${initialData.installation.status}">${initialData.installation.status.replace('_', ' ')}</span>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        </thead>

        <tfoot>
            <tr>
                <td>
                    <div class="footer-wrapper">
                        <div class="corporate-brand">${initialData.company.name} - ENGENHARIA E MANUTENÇÃO</div>
                        <div class="corporate-footer">
                            ${initialData.company.address} • ${initialData.company.city} • CNPJ: ${initialData.company.cnpj}<br>
                            Contato: ${initialData.company.phone} • ${initialData.company.email}<br>
                            <strong>Especialistas em Engenharia Elétrica e Manutenção Predial</strong>
                        </div>
                    </div>
                </td>
            </tr>
        </tfoot>

        <tbody>
            <tr>
                <td>
                    <div class="content-wrapper">
                        <div class="mb-8">
                            <p class="text-[10px] uppercase text-gray-500 font-bold mb-1">Objeto do Serviço</p>
                            <h2 class="text-xl font-bold text-gray-900">${initialData.installation.title}</h2>
                        </div>

                        <div class="grid grid-cols-2 gap-x-12 gap-y-8 mb-8">
                            <div>
                                <h3 class="section-title">Dados do Cliente</h3>
                                <div class="space-y-3">
                                    <div>
                                        <p class="field-label">Nome / Razão Social</p>
                                        <p class="field-value text-sm">${initialData.client.name}</p>
                                    </div>
                                    <div>
                                        <p class="field-label">Documento (CNPJ/CPF)</p>
                                        <p class="field-value">${initialData.client.cnpj}</p>
                                    </div>
                                    <div>
                                        <p class="field-label">Endereço de Instalação</p>
                                        <p class="field-value">${initialData.client.address || 'Não informado'}</p>
                                    </div>
                                </div>

                                <h3 class="section-title mt-8">Configurações de Rede</h3>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <p class="field-label">Rede WiFi (SSID)</p>
                                        <p class="field-value font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100 inline-block">${initialData.technical.wifi_ssid || '-'}</p>
                                    </div>
                                    <div>
                                        <p class="field-label">Senha WiFi</p>
                                        <p class="field-value font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100 inline-block">${initialData.technical.wifi_password || '-'}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 class="section-title">Dados da Execução</h3>
                                <div class="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p class="field-label">Data de Início</p>
                                        <p class="field-value">${initialData.installation.start_date}</p>
                                    </div>
                                    <div>
                                        <p class="field-label">Data de Conclusão</p>
                                        <p class="field-value">${initialData.installation.end_date}</p>
                                    </div>
                                </div>
                                <div class="mb-4">
                                    <p class="field-label">Técnico Responsável</p>
                                    <p class="field-value uppercase text-gray-900">${initialData.technical.technician}</p>
                                </div>
                                
                                ${initialData.telemetry.length > 0 ? `
                                <div class="mt-6">
                                    <p class="field-label mb-2">Itens de Telemetria</p>
                                    <table class="w-full text-xs border border-gray-200 rounded overflow-hidden">
                                        <thead class="bg-gray-50">
                                            <tr>
                                                <th class="text-left py-1.5 px-3 text-gray-500 font-semibold border-b border-gray-200">Item</th>
                                                <th class="text-right py-1.5 px-3 text-gray-500 font-semibold border-b border-gray-200 w-20">Qtd</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-100">
                                            ${initialData.telemetry.map((t: any) => `
                                            <tr>
                                                <td class="py-1.5 px-3 text-gray-700">${t.name}</td>
                                                <td class="py-1.5 px-3 text-right font-medium text-gray-900">${t.quantity}</td>
                                            </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                ` : ''}
                            </div>
                        </div>

                        <div class="mb-8">
                            <h3 class="section-title">Observações Técnicas</h3>
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[60px]">
                                <p class="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">${initialData.installation.description || 'Nenhum registro adicional.'}</p>
                            </div>
                        </div>

                        <div class="mt-8 pt-8 border-t border-gray-200 grid grid-cols-2 gap-12" style="page-break-inside: avoid;">
                            <div class="text-center">
                                <div class="h-16 flex items-end justify-center mb-1">
                                    ${initialData.signatures.customer ? `<img src="${initialData.signatures.customer}" class="signature-img">` : `<div class="w-full text-[9px] text-gray-400 italic">Não assinado</div>`}
                                </div>
                                <div class="h-px bg-gray-300 w-32 mx-auto mb-1"></div>
                                <p class="text-[10px] font-bold text-gray-800 uppercase">${initialData.client.name.split(' ')[0]} (Cliente)</p>
                            </div>
                            <div class="text-center">
                                <div class="h-16 flex items-end justify-center mb-1">
                                    ${initialData.signatures.technician ? `<img src="${initialData.signatures.technician}" class="signature-img">` : `<div class="w-full text-[9px] text-gray-400 italic">Não assinado</div>`}
                                </div>
                                <div class="h-px bg-gray-300 w-32 mx-auto mb-1"></div>
                                <p class="text-[10px] font-bold text-gray-800 uppercase">Técnico Responsável</p>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>
    <div id="pdf-loader" class="fixed inset-0 bg-gray-900/80 z-50 flex flex-col items-center justify-center text-white hidden backdrop-blur-sm">
        <div class="w-64 bg-gray-700/50 rounded-full h-2 mb-4 overflow-hidden border border-white/10">
            <div id="pdf-progress-bar" class="bg-blue-500 h-full transition-all duration-[400ms]" style="width: 0%"></div>
        </div>
        <p class="font-bold text-lg mb-1"><span id="pdf-percentage">0</span>%</p>
        <p class="text-sm text-gray-300 animate-pulse">Processando alta fidelidade...</p>
    </div>
</body>

    <script>
        const loadScript = (src) => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    document.getElementById('btn-download').addEventListener('click', async () => {
      const btn = document.getElementById('btn-download');
      const loader = document.getElementById('pdf-loader');
      const progressBar = document.getElementById('pdf-progress-bar');
      const percentageText = document.getElementById('pdf-percentage');

      btn.style.display = 'none';
      loader.classList.remove('hidden');

      let progress = 0;
      const interval = setInterval(() => {
        if (progress < 92) {
          progress += Math.random() * 4;
          if (progress > 92) progress = 92;
          progressBar.style.width = progress + '%';
          percentageText.innerText = Math.round(progress);
        }
      }, 400);

      try {
        if (typeof window.html2canvas === 'undefined') {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        }
        if (typeof window.jspdf === 'undefined') {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }

        const element = document.getElementById('print-area');
        const canvas = await html2canvas(element, {
          scale: 2.2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          letterRendering: true,
          windowWidth: 794
        });

        const mmWidth = 210;
        const mmHeight = (canvas.height * mmWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/jpeg', 0.900);
        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: [mmWidth, mmHeight],
          compress: true
        });

        progressBar.style.width = '100%';
        percentageText.innerText = '100';
        clearInterval(interval);
        
        pdf.addImage(imgData, 'JPEG', 0, 0, mmWidth, mmHeight, undefined, 'FAST');
        pdf.save('Relatorio_' + initialData.installation.id + '.pdf');

        setTimeout(() => window.close(), 500);
      } catch (err) {
        clearInterval(interval);
        console.error(err);
        alert('Erro ao gerar PDF: ' + err.message);
      } finally {
        clearInterval(interval);
        loader.classList.add('hidden');
        btn.style.display = 'flex';
      }
    });
    </script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  } catch (error) {
    console.error('Error generating installation PDF:', error);
    throw error;
  }
}

export async function generateLoadSurveyPDF(survey: any) {
  try {
    const company = await getCompanyConfig();
    const safeString = (str: string) => (str || '').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    // Sort items if needed
    const items = survey.items || [];
    const totals = survey.totals || { watts: 0 };

    // Engineering Calculations (Summary)
    // Engineering Calculations (Summary by Voltage)
    let watts127 = 0;
    let watts220 = 0;
    let watts380 = 0;

    items.forEach((item: any) => {
      const subtotal = item.quantity * item.power;
      const v = Number(item.voltage);
      if (v === 127) watts127 += subtotal;
      else if (v === 380) watts380 += subtotal;
      else watts220 += subtotal; // Default to 220V
    });

    const amps127 = watts127 > 0 ? (watts127 / 127).toFixed(1) : '0';
    const amps220 = watts220 > 0 ? (watts220 / 220).toFixed(1) : '0';
    // For 380V (Three-phase typically), I = P / (V * sqrt(3))
    const amps380 = watts380 > 0 ? (watts380 / (380 * 1.73205)).toFixed(1) : '0';

    const kwTotal = (totals.watts / 1000).toFixed(2);

    // Breaker Estimations (Per phase/voltage typically, but we'll show a general guide)
    const getBreaker = (amps: number) => {
      if (amps === 0) return '-';
      if (amps <= 16) return '20A';
      if (amps <= 25) return '32A';
      if (amps <= 32) return '40A';
      if (amps <= 40) return '50A';
      if (amps <= 50) return '63A';
      if (amps <= 63) return '70A';
      if (amps <= 80) return '80A';
      if (amps <= 100) return '100A';
      return 'CONSULTAR';
    };

    const breaker127 = getBreaker(Number(amps127));
    const breaker220 = getBreaker(Number(amps220));
    const breaker380 = getBreaker(Number(amps380));

    const techSigB64 = await urlToBase64(survey.technician?.signature_url);

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
        cnpj: safeString(company.cnpj)
      },
      client: {
        name: safeString(survey.clients?.name || 'Cliente Particular'),
        cnpj: safeString(survey.clients?.document || '00.000.000/0000-00'),
        address: safeString([survey.clients?.street, survey.clients?.number, survey.clients?.city].filter(Boolean).join(', ') || 'Não informado'),
        phone: safeString(survey.clients?.phone || 'Não informado')
      },
      survey: {
        id: survey.id?.slice(0, 8).toUpperCase() || 'NOVO',
        date: formatDate(survey.created_at),
        items: items.map((item: any) => ({
          name: safeString(item.equipmentId === 'custom' ? item.customName : item.name),
          quantity: item.quantity,
          voltage: item.voltage,
          power: item.power,
          subtotal: (item.quantity * item.power)
        })),
        totals: {
          watts: totals.watts,
          kw: kwTotal,
          breakdown: {
            v127: { watts: watts127, amps: amps127, breaker: breaker127 },
            v220: { watts: watts220, amps: amps220, breaker: breaker220 },
            v380: { watts: watts380, amps: amps380, breaker: breaker380 }
          }
        }
      },
      signatures: {
        customer: null,
        technician: techSigB64,
        technician_name: safeString(survey.technician?.full_name || 'Técnico Responsável')
      }
    };

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Levantamento de Cargas - ${initialData.company.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 0; }
      .report-container { background: white; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
      
      .header-bar { background: #1e3a8a; height: 8px; width: 100%; }
      .top-header { padding: 25px 45px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; }
      .company-info { text-align: center; flex: 1; }
      .company-name { color: #1e3a8a; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
      .company-details { font-size: 7px; color: #4b5563; font-weight: 500; line-height: 1.1; }
      
      .document-title { 
        background-color: #f8fafc; 
        color: #1e3a8a; 
        font-size: 16px; 
        font-weight: 800; 
        text-align: center; 
        padding: 8px; 
        text-transform: uppercase; 
        letter-spacing: 1px;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .content-body { padding: 25px 35px; }
      
      .info-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 4px; }
      .info-label { font-size: 8px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; display: block; }
      .info-value { font-size: 10px; font-weight: 600; color: #111827; }

      .table-header { background: #1e3a8a; color: white; border: 1px solid #1e3a8a; }
      th { padding: 8px 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; text-align: center; border: 1px solid #1e3a8a; }
      td { padding: 6px; font-size: 9px; border: 1px solid #e5e7eb; text-align: center; color: #374151; }
      .text-left { text-align: left; }
      .font-bold { font-weight: 700; }
      
      .engineering-summary { 
        margin-top: 30px; 
        background: #f8fafc; 
        border: 2px solid #e2e8f0;
        padding: 0;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .summary-header {
        background: #1e3a8a;
        color: white;
        padding: 10px;
        text-align: center;
        font-weight: 800;
        font-size: 12px;
        text-transform: uppercase;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        divide-x: 1px solid #e2e8f0;
      }

      .summary-col {
        padding: 15px 10px;
        text-align: center;
        border-right: 1px solid #e2e8f0;
      }

      .summary-col:last-child {
        border-right: none;
      }

      .voltage-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 800;
        margin-bottom: 8px;
      }

      .v127 { background: #fee2e2; color: #991b1b; }
      .v220 { background: #e0f2fe; color: #075985; }
      .v380 { background: #fef9c3; color: #854d0e; }
      .vTotal { background: #dcfce7; color: #166534; }

      .sum-label { font-size: 8px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 6px; }
      .sum-val { font-size: 14px; color: #1e293b; font-weight: 800; }
      .sum-amp { font-size: 12px; color: #0f172a; font-weight: 700; }

      .footer-note { margin-top: 40px; font-size: 10px; color: #9ca3af; text-align: center; font-style: italic; }
      
      /* Utilities previously from Tailwind */
      .text-center { text-align: center; }
      .uppercase { text-transform: uppercase; }
      .font-bold { font-weight: 700; }
      .flex { display: flex; }
      .flex-col { flex-direction: column; }
      .items-center { align-items: center; }
      .justify-center { justify-content: center; }
      .hidden { display: none; }
      .fixed { position: fixed; }
      .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
      .z-50 { z-index: 50; }
      .bg-gray-900\/80 { background-color: rgba(17, 24, 39, 0.8); }
      .text-white { color: white; }
      .text-sm { font-size: 0.875rem; }
      .mb-4 { margin-bottom: 1rem; }
      .w-10 { width: 2.5rem; }
      .h-10 { height: 2.5rem; }
      .rounded-full { border-radius: 9999px; }
      .border-4 { border-width: 4px; }
      .border-gray-200 { border-color: #e5e7eb; }
      .border-t-blue-500 { border-top-color: #3b82f6; }
      .animate-spin { animation: spin 1s linear infinite; }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @media print {
        body { background: white; }
        .no-print { display: none !important; }
      }
    </style>
</head>
<body class="py-10">
    <div id="pdf-loader" class="fixed inset-0 bg-gray-900/80 z-50 flex flex-col items-center justify-center text-white hidden backdrop-blur-sm">
        <div class="w-64 bg-gray-700/50 rounded-full h-2 mb-4 overflow-hidden border border-white/10">
            <div id="pdf-progress-bar" class="bg-blue-500 h-full transition-all duration-[400ms]" style="width: 0%"></div>
        </div>
        <p class="font-bold text-lg mb-1"><span id="pdf-percentage">0</span>%</p>
        <p class="text-sm text-gray-300 animate-pulse">Processando alta fidelidade...</p>
    </div>

    <div class="fixed top-6 left-1/2 -translate-x-1/2 z-40 no-print">
        <button id="btn-download" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            BAIXAR LEVANTAMENTO PDF
        </button>
    </div>

    <div id="print-area" class="report-container" style="width: 794px; min-height: 1123px;">
        <div class="header-bar"></div>
        
        <div class="top-header">
            <div style="width: 150px;">
                ${initialData.company.logo ? `<img src="${initialData.company.logo}" style="max-height: 60px; width: auto;">` : `<div style="font-weight: 800; color: #1e3a8a;">ELETRICOM</div>`}
            </div>
            <div class="company-info">
                <div class="company-name">${initialData.company.name}</div>
                <div class="company-details">
                    CNPJ: ${initialData.company.cnpj} | TEL: ${initialData.company.phone} | EMAIL: ${initialData.company.email}<br>
                    ENDEREÇO: ${initialData.company.address.toUpperCase()}
                </div>
            </div>
            <div style="width: 150px; text-align: right; font-size: 10px; color: #6b7280; font-weight: 600;">
                EMISSÃO: ${initialData.survey.date}
            </div>
        </div>

        <div class="document-title">
            Levantamento de Cargas Elétricas
        </div>

        <div class="content-body">
            <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                <div class="info-box" style="flex: 2;">
                    <span class="info-label">Cliente / Razão Social</span>
                    <span class="info-value" style="font-size: 14px;">${initialData.client.name}</span>
                </div>
                <div class="info-box" style="flex: 1;">
                    <span class="info-label">CNPJ / CPF</span>
                    <span class="info-value">${initialData.client.cnpj}</span>
                </div>
            </div>

            <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                <div class="info-box" style="flex: 2;">
                    <span class="info-label">Endereço da Instalação</span>
                    <span class="info-value" style="font-size: 11px; text-transform: uppercase;">${initialData.client.address}</span>
                </div>
                <div class="info-box" style="flex: 1;">
                    <span class="info-label">Contato</span>
                    <span class="info-value">${initialData.client.phone}</span>
                </div>
            </div>

            <table style="width: 100%; border: 1px solid #1e3a8a;">
                <thead class="table-header">
                    <tr>
                        <th class="text-left" style="width: 40%">EQUIPAMENTO</th>
                        <th style="width: 15%">VOLTAGEM</th>
                        <th style="width: 15%">POTÊNCIA (W)</th>
                        <th style="width: 10%">QTD</th>
                        <th style="width: 20%">SUBTOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${initialData.survey.items.map((item: any) => `
                    <tr>
                        <td class="text-left font-bold uppercase">${item.name}</td>
                        <td>${item.voltage}V</td>
                        <td>${item.power} W</td>
                        <td class="font-bold">${item.quantity}</td>
                        <td class="font-bold">${item.subtotal} W</td>
                    </tr>
                    `).join('')}
                </tbody>
                <tfoot style="background-color: #f8fafc;">
                    <tr>
                        <td colspan="4" style="text-align: right; font-weight: 800; font-size: 12px; color: #1e3a8a; padding: 15px;">CARGA TOTAL INSTALADA:</td>
                        <td style="font-weight: 900; font-size: 14px; color: #1e3a8a; padding: 15px; border: 2px solid #1e3a8a; background: #eff6ff;">${initialData.survey.totals.watts} W</td>
                    </tr>
                </tfoot>
            </table>

            <div class="engineering-summary">
                <div class="summary-header">Quadro Resumo de Cargas (Separação por Tensão)</div>
                <div class="summary-grid">
                    <div class="summary-col">
                        <span class="voltage-badge v127">127V</span>
                        <div>
                            <div class="sum-label">Potência</div>
                            <div class="sum-val">${initialData.survey.totals.breakdown.v127.watts} W</div>
                        </div>
                        <div style="margin-top: 8px;">
                            <div class="sum-label">Corrente Est.</div>
                            <div class="sum-amp">${initialData.survey.totals.breakdown.v127.amps} A</div>
                        </div>
                         <div style="margin-top: 8px;">
                            <div class="sum-label">Disjuntor</div>
                            <div class="sum-amp">${initialData.survey.totals.breakdown.v127.breaker}</div>
                        </div>
                    </div>
                    
                    <div class="summary-col">
                        <span class="voltage-badge v220">220V</span>
                        <div>
                            <div class="sum-label">Potência</div>
                            <div class="sum-val">${initialData.survey.totals.breakdown.v220.watts} W</div>
                        </div>
                        <div style="margin-top: 8px;">
                            <div class="sum-label">Corrente Est.</div>
                            <div class="sum-amp">${initialData.survey.totals.breakdown.v220.amps} A</div>
                        </div>
                         <div style="margin-top: 8px;">
                            <div class="sum-label">Disjuntor</div>
                            <div class="sum-amp">${initialData.survey.totals.breakdown.v220.breaker}</div>
                        </div>
                    </div>

                    <div class="summary-col">
                        <span class="voltage-badge v380">380V</span>
                        <div>
                            <div class="sum-label">Potência</div>
                            <div class="sum-val">${initialData.survey.totals.breakdown.v380.watts} W</div>
                        </div>
                        <div style="margin-top: 8px;">
                            <div class="sum-label">Corrente Est. (3F)</div>
                            <div class="sum-amp">${initialData.survey.totals.breakdown.v380.amps} A</div>
                        </div>
                         <div style="margin-top: 8px;">
                            <div class="sum-label">Disjuntor</div>
                            <div class="sum-amp">${initialData.survey.totals.breakdown.v380.breaker}</div>
                        </div>
                    </div>

                    <div class="summary-col" style="background: #f0fdf4;">
                        <span class="voltage-badge vTotal">TOTAL GERAL</span>
                        <div>
                            <div class="sum-label">Potência Total</div>
                            <div class="sum-val" style="color: #15803d;">${initialData.survey.totals.watts} W</div>
                        </div>
                        <div style="margin-top: 8px;">
                            <div class="sum-label">Total kW</div>
                            <div class="sum-amp" style="color: #15803d; font-size: 14px;">${initialData.survey.totals.kw} kW</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 50px; display: flex; justify-content: center; page-break-inside: avoid;">
              <div style="text-align: center; width: 300px;">
                <div style="height: 60px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
                  ${initialData.signatures.technician ? `<img src="${initialData.signatures.technician}" style="max-height: 50px; width: auto;">` : '<div style="height: 40px; border-bottom: 1px dashed #cbd5e1; width: 100%;"></div>'}
                </div>
                <div style="font-size: 10px; font-weight: 800; color: #1e293b; text-transform: uppercase;">${initialData.signatures.technician_name}</div>
                <div style="font-size: 8px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px;">Responsável Técnico</div>
              </div>
            </div>

            <div class="footer-note">
                Este documento é um levantamento técnico preliminar e não substitui um projeto elétrico formal assinado por engenheiro habilitado.
            </div>

            <!-- Footer with Company Details -->
            <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; paddingTop: 8px; text-align: center; color: #64748b; font-size: 8px;">
                <p style="margin: 0; font-weight: bold; color: #1e293b; font-size: 9px;">${initialData.company.name?.toUpperCase() || 'AEC SERVIÇOS - ELETRICOM'}</p>
                <p style="margin: 2px 0;">
                    ${initialData.company.address} - ${initialData.company.city}
                </p>
                <p style="margin: 0;">
                    ${initialData.company.cnpj ? `CNPJ: ${initialData.company.cnpj}` : 'CNPJ: 07.456.654/0001-08'}
                    ${initialData.company.phone ? ` | Tel: ${initialData.company.phone}` : ''}
                    ${initialData.company.email ? ` | Email: ${initialData.company.email}` : ''}
                </p>
            </div>
        </div>
    </div>

    <script>
        const loadScript = (src) => new Promise((resolve, reject) => {
          if (window.html2canvas && src.includes('html2canvas')) return resolve();
          if (window.jspdf && src.includes('jspdf')) return resolve();
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });

        const btn = document.getElementById('btn-download');
        const loader = document.getElementById('pdf-loader');
        const progressBar = document.getElementById('pdf-progress-bar');
        const percentageText = document.getElementById('pdf-percentage');

        btn.style.display = 'none';
        loader.classList.remove('hidden');

        let progress = 0;
        const interval = setInterval(() => {
          if (progress < 92) {
            progress += Math.random() * 4;
            if (progress > 92) progress = 92;
            progressBar.style.width = progress + '%';
            percentageText.innerText = Math.round(progress);
          }
        }, 400);

        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

            const element = document.getElementById('print-area');
            const canvas = await html2canvas(element, {
              scale: 2.2,
              useCORS: true,
              allowTaint: false,
              logging: false,
              backgroundColor: '#ffffff',
              letterRendering: true,
              windowWidth: 794
            });

            const mmWidth = 210;
            const mmHeight = (canvas.height * mmWidth) / canvas.width;
            const imgData = canvas.toDataURL('image/jpeg', 0.90);
            const { jsPDF } = window.jspdf;

            const pdf = new jsPDF({
              orientation: 'p',
              unit: 'mm',
              format: [mmWidth, mmHeight],
              compress: true
            });

            clearInterval(interval);
            progressBar.style.width = '100%';
            percentageText.innerText = '100';

            pdf.addImage(imgData, 'JPEG', 0, 0, mmWidth, mmHeight, undefined, 'FAST');
            pdf.save('Levantamento_Cargas_' + initialData.survey.id + '.pdf');

            setTimeout(() => window.close(), 1000);
          } catch (err) {
            clearInterval(interval);
            console.error(err);
            alert('Erro ao gerar PDF: ' + err.message);
          } finally {
            clearInterval(interval);
            loader.classList.add('hidden');
            btn.style.display = 'flex';
          }
        });
    </script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  } catch (error) {
    console.error('Error generating load survey PDF:', error);
    throw error;
  }
}
