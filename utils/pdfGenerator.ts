import { supabase } from '../lib/supabase';

// --- Formatação de Data e Hora ---
const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  try {
    let s = String(dateString).replace('Z', '').replace(/\+\d{2}:\d{2}$/, '').replace(/\.\d+$/, '');
    if (s.includes('T')) {
      const parts = s.split('T');
      const [y, m, d] = parts[0].split('-');
      const time = parts[1] || '00:00';
      const [h, min] = time.split(':');
      return `${d}/${m}/${y} ${h}:${min}`;
    }
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  } catch { return String(dateString); }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    let s = String(dateString).split('T')[0];
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  } catch { return String(dateString); }
};

// --- Configuração da Empresa ---
async function getCompanyConfig() {
  const { data: config } = await supabase.from('app_config').select('*').limit(1).maybeSingle();
  return {
    name: config?.company_name || 'CHAMEI TECNOLOGIA',
    cnpj: config?.company_cnpj || config?.cnpj || '00.000.000/0000-00',
    address: config?.company_address || config?.address || 'Endereço não configurado',
    phone: config?.company_phone || config?.phone || '',
    email: config?.company_email || config?.email || '',
    website: config?.company_website || '',
    logo: config?.company_logo || config?.logo_url || '',
    color: config?.primary_color || '#0f172a'
  };
}

// --- CSS Elite (Super Premium) ---
const getEliteCSS = (primaryColor: string) => `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

    :root {
        --primary: ${primaryColor};
        --slate-900: #0f172a;
        --slate-800: #1e293b;
        --slate-600: #475569;
        --slate-400: #94a3b8;
        --slate-200: #e2e8f0;
        --slate-50: #f8fafc;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; }

    body {
        font-family: 'Plus Jakarta Sans', sans-serif;
        background-color: #f1f5f9;
        color: var(--slate-900);
        padding: 40px;
    }

    .page-container {
        width: 210mm;
        margin: 0 auto;
        background: white;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);
        min-height: 297mm;
        position: relative;
    }

    .header-bar {
        height: 6px;
        background: var(--primary);
        width: 100%;
        position: absolute;
        top: 0;
        left: 0;
    }

    .padding-wrap {
        padding: 45px;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    /* Header Structure */
    .header-grid {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 40px;
        margin-bottom: 50px;
        align-items: start;
    }

    .company-branding img {
        height: 60px;
        object-fit: contain;
        display: block;
        margin-bottom: 12px;
    }

    .company-branding h1 {
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.5px;
        color: var(--slate-900);
        margin-bottom: 6px;
    }

    .company-details {
        font-size: 9px;
        color: var(--slate-600);
        line-height: 1.5;
    }

    .doc-meta {
        text-align: right;
    }

    .doc-type {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 2px;
        color: var(--slate-400);
        text-transform: uppercase;
        margin-bottom: 4px;
    }

    /* MENOR TAMANHO NO NÚMERO DO ORÇAMENTO */
    .doc-number {
        font-size: 22px; /* Reduzido de 32px para 22px */
        font-weight: 700;
        color: var(--primary);
        letter-spacing: -0.5px;
        margin-bottom: 15px;
    }

    .meta-table {
        margin-left: auto;
        border-collapse: collapse;
    }
    .meta-table td {
        padding: 3px 0 3px 15px;
        font-size: 10px;
        color: var(--slate-600);
        text-align: right;
    }
    .meta-label { font-weight: 600; color: var(--slate-400); text-transform: uppercase; }
    .meta-value { font-weight: 700; color: var(--slate-900); }

    /* Client Box */
    .client-box {
        background: var(--slate-50);
        border: 1px solid var(--slate-200);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 40px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
    }

    .box-col-label {
        font-size: 9px;
        font-weight: 700;
        color: var(--slate-400);
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
    }

    .box-col-value {
        font-size: 12px;
        font-weight: 600;
        color: var(--slate-900);
        margin-bottom: 4px;
    }

    .box-col-sub {
        font-size: 10px;
        color: var(--slate-600);
        line-height: 1.5;
    }

    /* Items Table */
    .items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
    }

    .items-table th {
        text-align: left;
        padding: 12px 10px;
        font-size: 9px;
        font-weight: 800;
        color: var(--slate-400);
        text-transform: uppercase;
        border-bottom: 2px solid var(--slate-200);
    }

    .items-table td {
        padding: 16px 10px;
        font-size: 11px;
        color: var(--slate-900);
        border-bottom: 1px solid var(--slate-200);
    }

    .items-table tr:last-child td { border-bottom: none; }

    .col-r { text-align: right; }
    .col-c { text-align: center; }
    .item-name { font-weight: 700; margin-bottom: 3px; }
    .item-desc { font-size: 10px; color: var(--slate-600); max-width: 400px; }

    /* Financial Summary */
    .financial-grid {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 45px;
    }

    .summary-box {
        width: 280px;
    }

    .sum-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 11px;
        color: var(--slate-600);
    }

    .sum-row.total {
        border-top: 2px solid var(--slate-900);
        margin-top: 10px;
        padding-top: 12px;
        font-size: 14px;
        font-weight: 800;
        color: var(--slate-900);
    }

    /* Terms */
    .terms-section {
        border-top: 1px solid var(--slate-200);
        padding-top: 25px;
        margin-bottom: 40px;
    }

    .terms-title {
        font-size: 10px;
        font-weight: 800;
        color: var(--slate-900);
        text-transform: uppercase;
        margin-bottom: 10px;
    }

    .terms-content {
        font-size: 10px;
        color: var(--slate-600);
        line-height: 1.6;
        white-space: pre-wrap;
        columns: 2;
        column-gap: 30px;
    }

    /* Signatures */
    .signatures {
        margin-top: auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 60px;
        padding-top: 40px;
        page-break-inside: avoid;
    }

    .sign-line {
        border-top: 1px solid var(--slate-300);
        padding-top: 10px;
        margin-top: 40px;
    }

    .sign-name {
        font-size: 11px;
        font-weight: 700;
        color: var(--slate-900);
    }

    .sign-role {
        font-size: 9px;
        font-weight: 600;
        color: var(--slate-400); 
        text-transform: uppercase;
        margin-top: 2px;
    }

    .print-btn {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--slate-900);
        color: white;
        padding: 14px 28px;
        border-radius: 8px;
        border: none;
        font-family: inherit;
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
        box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        z-index: 100;
        transition: all 0.2s;
    }
    .print-btn:hover { background: black; transform: translateY(-2px); }

    @media print {
        body { padding: 0; background: white; }
        .page-container { margin: 0; box-shadow: none; min-height: 100vh; }
        .print-btn { display: none; }
    }
`;

export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    const style = getEliteCSS(company.color);

    // Sort items if available
    const items = quote.items ? [...quote.items].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)) : [];

    // Calculate Values
    const subtotal = quote.subtotal || items.reduce((acc: number, item: any) => acc + (item.total || (item.quantity * item.unit_price)), 0);
    const discountVal = quote.discount || 0;
    const discountAmount = quote.discount_type === 'percentage'
      ? subtotal * (discountVal / 100)
      : discountVal;

    const tax = quote.tax || 0;
    const total = quote.total || (subtotal - discountAmount + tax);

    const quoteNumber = quote.quote_number || `ORC-${quote.id?.slice(0, 4).toUpperCase()}`;

    // Helper status badge text
    const getStatusText = (s: string) => {
      switch (s) {
        case 'approved': return 'APROVADO';
        case 'rejected': return 'RECUSADO';
        case 'pending': return 'PENDENTE';
        case 'converted': return 'CONVERTIDO EM OS';
        default: return 'RASCUNHO';
      }
    };

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Proposta ${quoteNumber}</title>
        <style>${style}</style>
      </head>
      <body>
        <button class="print-btn" onclick="window.print()">Imprimir Proposta</button>
        
        <div class="page-container">
          <div class="header-bar"></div>
          <div class="padding-wrap">

            <!-- HEADER -->
            <div class="header-grid">
               <div class="company-branding">
                  ${company.logo ? `<img src="${company.logo}" alt="Company Logo">` : ''}
                  <h1>${company.name}</h1>
                  <div class="company-details">
                    CNPJ: ${company.cnpj}<br>
                    ${company.address}<br>
                    ${company.phone} • ${company.email}
                  </div>
               </div>

               <div class="doc-meta">
                 <div class="doc-type">Proposta Comercial</div>
                 <div class="doc-number">#${quoteNumber}</div>
                 
                 <table class="meta-table">
                    <tr>
                        <td class="meta-label">Data:</td>
                        <td class="meta-value">${formatDate(quote.created_at)}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Validade:</td>
                        <td class="meta-value" style="color: var(--primary)">${formatDate(quote.valid_until)}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Status:</td>
                        <td class="meta-value">${getStatusText(quote.status)}</td>
                    </tr>
                 </table>
               </div>
            </div>

            <!-- CLIENT BOX -->
            <div class="client-box">
                <div>
                    <div class="box-col-label">Prestador de Serviço</div>
                    <div class="box-col-value">${company.name}</div>
                    <div class="box-col-sub">
                        Resp. Técnico: ${quote.created_by_name || 'Equipe Técnica'}<br>
                        ${company.email}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="box-col-label">Cliente</div>
                    <div class="box-col-value">${quote.clients?.name || 'Cliente'}</div>
                    <div class="box-col-sub">
                        ${quote.clients?.address || 'Endereço não informado'}<br>
                        ${quote.clients?.cnpj_cpf ? `CPF/CNPJ: ${quote.clients.cnpj_cpf}<br>` : ''}
                        ${quote.clients?.phone || ''} • ${quote.clients?.email || ''}
                    </div>
                </div>
            </div>

            <!-- DESCRIPTION -->
            ${quote.description ? `
            <div style="margin-bottom: 40px;">
                <div class="terms-title">Objeto da Proposta</div>
                <div style="font-size: 11px; color: var(--slate-600); line-height: 1.6;">${quote.description}</div>
            </div>` : ''}

            <!-- ITEMS TABLE -->
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Descrição do Serviço / Item</th>
                        <th class="col-c">Qtd</th>
                        <th class="col-r">Valor Unit.</th>
                        <th class="col-r">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.length > 0 ? items.map((item: any) => `
                        <tr>
                            <td>
                                <div class="item-name">${item.name}</div>
                                ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
                            </td>
                            <td class="col-c">${item.quantity}</td>
                            <td class="col-r">R$ ${Number(item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td class="col-r" style="font-weight: 700;">R$ ${Number(item.total || (item.quantity * item.unit_price)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    `).join('') : `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum item adicionado.</td></tr>`}
                </tbody>
            </table>

            <!-- FINANCIAL SUMMARY -->
            <div class="financial-grid">
                <div class="summary-box">
                    <div class="sum-row">
                        <span>Subtotal</span>
                        <span>R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    ${discountAmount > 0 ? `
                    <div class="sum-row">
                        <span>Desconto (${quote.discount_type === 'percentage' ? `${quote.discount}%` : 'Fixo'})</span>
                        <span style="color: #ef4444;">- R$ ${discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>` : ''}

                    ${tax > 0 ? `
                    <div class="sum-row">
                        <span>Taxas / Impostos</span>
                        <span>+ R$ ${tax.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>` : ''}

                    <div class="sum-row total">
                        <span>TOTAL</span>
                        <span style="color: var(--primary)">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>

            <!-- TERMS -->
            ${(quote.notes || quote.terms) ? `
            <div class="terms-section">
                <div class="terms-title">Termos, Condições e Observações</div>
                <div class="terms-content">
                    ${quote.notes ? `${quote.notes}\n\n` : ''}
                    ${quote.terms || ''}
                </div>
            </div>` : ''}

            <!-- SIGNATURES -->
            <div class="signatures">
                <div class="sign-box">
                    <div class="sign-line">
                         <div class="sign-name">${company.name}</div>
                         <div class="sign-role">Prestador de Serviço</div>
                    </div>
                </div>
                <div class="sign-box">
                    <div class="sign-line">
                         <div class="sign-name">${quote.clients?.name || 'Cliente'}</div>
                         <div class="sign-role">Aprovado por</div>
                    </div>
                </div>
            </div>

            <!-- FOOTER -->
            <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid var(--slate-200); text-align: center; font-size: 8px; color: var(--slate-400);">
                Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')} • ${company.name} • ${company.website || 'chameiapp.com'}
            </div>

          </div>
        </div>
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
