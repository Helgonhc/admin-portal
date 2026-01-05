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
    website: config?.company_website || '',
    logo: config?.company_logo || config?.logo_url || '',
    color: config?.primary_color || '#1e3a8a'
  };
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    let s = String(dateString).split('T')[0];
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  } catch { return String(dateString); }
};

export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();

    // Preparar Dados
    const items = quote.items ? [...quote.items].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)) : [];

    // Totals
    const subtotal = quote.subtotal || items.reduce((acc: number, item: any) => acc + (item.total || (item.quantity * item.unit_price)), 0);
    const discountVal = quote.discount || 0;
    const discountAmount = quote.discount_type === 'percentage' ? subtotal * (discountVal / 100) : discountVal;
    const tax = quote.tax || 0;
    const total = quote.total || (subtotal - discountAmount + tax);

    const quoteNumber = quote.quote_number || `ORC-${quote.id?.slice(0, 4).toUpperCase()}`;

    // Valor por extenso (simples ou placeholder se não tiver lib)
    const amountExtenso = 'Reais'; // Idealmente usaria uma lib, mas manteremos simples por enquanto

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proposta ${quoteNumber}</title>
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Bibliotecas de Geração de PDF -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    
    <!-- Fonte 'Lato' -->
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
    
    <style>
      .font-sans { font-family: 'Lato', sans-serif; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .animate-spin { animation: spin 1s linear infinite; }
    </style>
</head>
<body class="min-h-screen bg-slate-100 font-sans text-slate-800 pb-32">

    <!-- LOADER -->
    <div id="pdf-loader" class="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 z-[10000] justify-center items-center text-white font-sans flex-col" style="display: none;">
        <div class="border-4 border-t-4 border-t-blue-500 border-gray-200 rounded-full w-10 h-10 animate-spin mb-4"></div>
        <p>Gerando PDF, por favor aguarde...</p>
    </div>

    <main class="max-w-5xl mx-auto p-4 flex justify-center">
        <!-- DOCUMENTO VISUAL (A4) -->
        <div 
             id="document-to-print" 
             class="bg-white shadow-2xl relative text-black box-border mx-auto"
             style="
               width: 794px; 
               min-height: 1123px; /* Altura mínima A4 */
               height: auto; 
               padding: 45px 45px 100px 45px;
               overflow: visible;
             "
           >
              <!-- Cabeçalho -->
              <div class="flex flex-row justify-between items-start border-b-2 border-blue-900 pb-4 mb-6 w-full">
                <div class="w-[60%] pr-4">
                   <div class="mb-4 h-24 flex items-start"> 
                     ${company.logo ? `<img src="${company.logo}" class="h-full w-auto object-contain" crossorigin="anonymous" alt="Logo">` : ''}
                   </div>
                   <h1 class="text-xl font-black text-blue-900 uppercase leading-none mb-1">${company.name}</h1>
                   <p class="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">${company.subtitle}</p>
                   <div class="pl-2 border-l-4 border-blue-600">
                      <p class="text-[10px] font-bold uppercase text-gray-800">MATRIZ ${company.city}</p>
                      <p class="text-[10px] uppercase text-gray-600">${company.address}</p>
                   </div>
                </div>
                <div class="w-[40%] flex flex-col items-end text-right">
                   <div class="bg-gray-100 border-l-4 border-blue-900 p-3 w-full text-left mb-3">
                    <h2 class="font-bold text-blue-900 text-xs uppercase mb-2">Proposta Comercial</h2>
                    <div class="text-[10px] space-y-1">
                       <div class="flex justify-between border-b border-gray-300 pb-0.5"><span class="font-bold text-gray-600">Nº:</span> <span>${quoteNumber}</span></div>
                       <div class="flex justify-between border-b border-gray-300 pb-0.5"><span class="font-bold text-gray-600">DATA:</span> <span>${formatDate(quote.created_at)}</span></div>
                       <div class="flex justify-between"><span class="font-bold text-gray-600">STATUS:</span> 
                          <span class="${quote.status === 'approved' ? 'text-green-600' : 'text-gray-800'} font-bold uppercase">${quote.status === 'pending' ? 'Pendente' : quote.status}</span>
                       </div>
                      </div>
                   </div>
                   <div class="text-[9px] text-gray-500 leading-tight">
                      <p>${company.email}</p>
                      <p>${company.website || ''}</p>
                      <p>${company.phone}</p>
                   </div>
                </div>
              </div>
              
              <!-- Cliente -->
              <section class="mb-8">
                 <h2 class="text-xl font-bold text-gray-900 leading-tight">${quote.clients?.name || 'Cliente'}</h2>
                 <p class="text-sm text-gray-600 mb-2">
                    ${quote.clients?.address || ''}<br>
                    ${quote.clients?.phone || ''} ${quote.clients?.email ? `• ${quote.clients.email}` : ''}
                 </p>
                 <div class="bg-blue-50 border border-blue-100 px-3 py-2 rounded-sm w-full">
                    <p class="text-xs text-blue-900"><strong class="font-bold uppercase mr-1">Objeto:</strong> <span>${quote.title || 'Prestação de Serviços'}</span></p>
                 </div>
              </section>

              <!-- Descrição / Notes -->
               ${quote.description ? `
               <section class="mb-6">
                  <h3 class="font-bold text-blue-900 text-sm uppercase mb-2">Descrição / Escopo</h3>
                  <div class="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">${quote.description}</div>
               </section>` : ''}
              
              <!-- Itens -->
              <section class="mb-8">
                 ${items.map((item: any, idx: number) => `
                 <div class="break-inside-avoid bg-gray-50 border border-gray-200 rounded-r-lg p-4 mb-4 border-l-4 border-blue-800 shadow-sm">
                    <div class="flex justify-between items-baseline mb-2">
                       <div class="flex items-baseline gap-3">
                          <span class="font-black text-lg text-blue-800">ITEM ${idx + 1}</span>
                          <h3 class="font-bold text-blue-900 text-base py-1">${item.name}</h3>
                       </div>
                       <div class="text-right">
                          <div class="text-xs text-gray-500 uppercase font-bold">Total Item</div>
                          <div class="font-bold text-gray-900">R$ ${Number(item.total || (item.quantity * item.unit_price)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                       </div>
                    </div>
                    <p class="text-xs text-gray-700 whitespace-pre-wrap text-left leading-relaxed">${item.description || ''}</p>
                    <div class="mt-2 text-[10px] text-gray-500 font-mono">Qtd: ${item.quantity} x Unit: R$ ${Number(item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                 </div>
                 `).join('')}
              </section>

              <!-- Fechamento (Investimento, Validade) -->
              <div class="break-inside-avoid mt-auto">
                 <div class="mb-6">
                    <h3 class="font-black text-gray-600 text-sm uppercase tracking-wider mb-2">Investimento Total</h3>
                    <div class="bg-gray-50 p-4 border-l-4 border-green-600 flex items-center justify-between">
                      <div class="flex flex-col">
                         <div class="flex items-baseline gap-3">
                             <span class="text-sm text-gray-500 font-bold">TOTAL:</span>
                             <p class="text-xl font-black text-gray-900">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                         </div>
                         ${(discountAmount > 0 || tax > 0) ? `
                             <div class="text-[10px] text-gray-500 mt-1">
                                Subtotal: R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                ${discountAmount > 0 ? `| Desc: -R$ ${discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                                ${tax > 0 ? `| Taxa: +R$ ${tax.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                             </div>
                         ` : ''}
                      </div>
                    </div>
                    
                    ${(quote.notes || quote.terms) ? `
                    <div class="mt-4 bg-gray-100 p-3 rounded-md">
                      <p class="text-xs text-gray-700">
                        <span class="font-bold text-gray-800 uppercase block mb-1">Termos e Condições:</span> 
                        ${quote.notes ? `${quote.notes}\n` : ''}
                        ${quote.terms || ''}
                      </p>
                    </div>` : ''}
                 </div>
                 
                 <div class="mb-8 bg-gray-100 p-3 rounded-lg flex justify-between items-center shadow-sm">
                    <span class="text-xs font-bold text-gray-700 uppercase">Validade da Proposta:</span>
                    <span class="text-sm text-gray-900 font-bold">${formatDate(quote.valid_until)}</span>
                 </div>

                 <!-- Footer Assinaturas -->
                 <footer class="pt-8 relative">
                    <div class="flex justify-between items-end gap-10">
                      <div class="flex-1 border-t border-gray-800 pt-2">
                          <p class="font-bold text-gray-900 text-base">${company.name}</p>
                          <p class="text-[10px] text-gray-600 uppercase font-bold">Departamento Comercial</p>
                      </div>
                      <div class="flex-1 border-t border-gray-800 pt-2">
                          <p class="font-bold text-gray-900 text-base">Aceite do Cliente</p>
                          <p class="text-[10px] text-gray-600 uppercase font-bold">Data e Assinatura</p>
                      </div>
                    </div>
                 </footer>
              </div>

              <!-- RODAPÉ FIXO -->
              <div class="absolute left-0 w-full" style="padding: 0 45px 30px 45px; bottom: 0px;">
                <div class="border-t border-gray-200 py-3 text-center">
                  <p class="text-[9px] text-gray-500">${company.address} • ${company.city} • CEP ${company.cep}</p>
                  <p class="text-[9px] text-blue-900 font-bold mt-0.5">${company.phone} | ${company.email}</p>
                </div>
              </div>
        </div>
    </main>

    <!-- BOTÃO FLUTUANTE DE DOWNLOAD -->
    <div id="generate-pdf-btn-container" class="fixed bottom-6 right-6 z-50 animate-bounce-slow">
      <button id="generate-pdf-btn" class="flex items-center gap-3 bg-green-600 text-white pl-6 pr-8 py-4 rounded-full shadow-2xl font-bold text-lg transition-all transform hover:scale-105 active:scale-95 border-4 border-white">
         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
         <span>Baixar PDF</span>
      </button>
      <div id="generate-pdf-btn-loading" class="hidden items-center gap-3 bg-green-600 text-white pl-6 pr-8 py-4 rounded-full shadow-2xl font-bold text-lg opacity-75 cursor-wait border-4 border-white">
         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M3 12a9 9 0 0 1 9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
         <span>Gerando PDF...</span>
      </div>
    </div>

<script>
    const pdfBtn = document.getElementById('generate-pdf-btn');
    const pdfBtnLoading = document.getElementById('generate-pdf-btn-loading');
    const loader = document.getElementById('pdf-loader');

    pdfBtn.addEventListener('click', async () => {
        loader.style.display = 'flex';
        pdfBtn.classList.add('hidden');
        pdfBtnLoading.classList.remove('hidden');

        setTimeout(async () => {
            try {
                const { jsPDF } = window.jspdf;
                const element = document.getElementById('document-to-print');
                
                const canvas = await window.html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    windowWidth: 794
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdfWidth = 210; 
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save('Proposta_${quoteNumber}.pdf');

            } catch (err) {
                console.error("Erro ao gerar PDF:", err);
                alert("Erro ao gerar PDF.");
            } finally {
                loader.style.display = 'none';
                pdfBtn.classList.remove('hidden');
                pdfBtnLoading.classList.add('hidden');
            }
        }, 500);
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
