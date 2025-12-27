import { supabase } from '../lib/supabase';

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

const formatOrderId = (id: string, dateString: string) => {
    if (!id) return 'OS';
    try {
        const s = String(dateString).split('T')[0];
        const [y, m] = s.split('-');
        return `${y}${m}-${id.slice(0, 4).toUpperCase()}`;
    } catch { return id.slice(0, 6).toUpperCase(); }
};

async function getCompanyConfig() {
    const { data: config } = await supabase.from('app_config').select('*').limit(1).maybeSingle();
    return {
        name: config?.company_name || 'CHAMEI TECNOLOGIA',
        cnpj: config?.company_cnpj || config?.cnpj || '00.000.000/0000-00',
        address: config?.company_address || config?.address || 'Endereço não configurado',
        phone: config?.company_phone || config?.phone || '',
        email: config?.company_email || config?.email || '',
        logo: config?.company_logo || config?.logo_url || '',
        color: config?.primary_color || '#4f46e5'
    };
}

const getCommonCSS = (color: string) => `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@700;800&display=swap');

    :root {
        --primary: ${color};
        --slate-900: #0f172a;
        --slate-700: #334155;
        --slate-500: #64748b;
        --slate-200: #e2e8f0;
        --slate-50: #f8fafc;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
    
    body { 
        font-family: 'Inter', sans-serif; 
        background-color: #f1f5f9; 
        color: var(--slate-900); 
        padding: 40px 0;
    }

    /* Page Setup */
    .page-container {
        width: 210mm;
        margin: 0 auto;
        padding: 0;
        page-break-after: always;
    }
    .page-container:last-child { page-break-after: auto; }

    .a4-page {
        background: white;
        min-height: 297mm;
        padding: 15mm;
        box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        border: 1px solid var(--slate-200);
        display: flex;
        flex-direction: column;
        position: relative;
    }

    /* Header */
    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 3px solid var(--primary);
    }
    
    .company-brand img { max-height: 60px; margin-bottom: 10px; display: block; }
    .company-name { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; color: var(--primary); text-transform: uppercase; }
    .company-meta { font-size: 9px; color: var(--slate-500); line-height: 1.4; margin-top: 4px; }

    .doc-info { text-align: right; }
    .doc-type { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 800; color: var(--slate-500); text-transform: uppercase; letter-spacing: 2px; }
    .doc-id { font-size: 32px; font-weight: 900; color: var(--slate-900); line-height: 1; margin: 4px 0; }
    .doc-date { font-size: 10px; font-weight: 600; color: var(--slate-500); }

    /* Sections */
    .section { margin-bottom: 25px; }
    .section-title { 
        font-family: 'Montserrat', sans-serif; 
        font-size: 11px; 
        font-weight: 800; 
        color: var(--primary); 
        text-transform: uppercase; 
        letter-spacing: 1px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .section-title::after { content: ''; flex: 1; height: 1px; background: var(--slate-200); }

    .info-grid { 
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 20px; 
    }
    
    .info-card { 
        background: var(--slate-50); 
        border: 1px solid var(--slate-200); 
        border-radius: 8px; 
        padding: 12px; 
    }

    .field { margin-bottom: 8px; }
    .field:last-child { margin-bottom: 0; }
    .label { font-size: 8px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; display: block; margin-bottom: 2px; }
    .value { font-size: 10px; font-weight: 600; color: var(--slate-700); }

    /* Content Area */
    .content-box {
        background: white;
        border: 1px solid var(--slate-200);
        border-radius: 8px;
        padding: 15px;
        font-size: 10.5px;
        line-height: 1.6;
        color: var(--slate-700);
        white-space: pre-wrap;
        min-height: 80px;
    }

    /* Table */
    .clean-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    .clean-table th { background: var(--slate-50); padding: 10px; font-size: 8.5px; font-weight: 800; color: var(--slate-500); text-align: left; border-bottom: 2px solid var(--slate-200); text-transform: uppercase; }
    .clean-table td { padding: 12px 10px; font-size: 10px; border-bottom: 1px solid var(--slate-50); color: var(--slate-700); }
    .clean-table tr:nth-child(even) td { background: #fafbfc; }
    
    .total-bar { 
        background: var(--slate-900); 
        color: white; 
        margin-top: 2px;
        border-radius: 6px;
        padding: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .total-label { font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .total-value { font-size: 18px; font-weight: 900; }

    /* Signatures */
    .signature-row { 
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 40px; 
        margin-top: auto; 
        padding-top: 40px;
        page-break-inside: avoid;
    }
    .sign-box { text-align: center; }
    .sign-line { border-bottom: 1px solid var(--slate-500); height: 60px; margin-bottom: 10px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px; }
    .sign-line img { max-height: 55px; max-width: 100%; mix-blend-mode: multiply; }
    .sign-name { font-size: 11px; font-weight: 700; color: var(--slate-900); }
    .sign-meta { font-size: 8px; font-weight: 600; color: var(--slate-500); text-transform: uppercase; }

    /* Footer */
    .footer {
        margin-top: 30px;
        padding-top: 15px;
        border-top: 1px solid var(--slate-200);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 8.5px;
        color: var(--slate-500);
    }

    /* Photos */
    .photo-mosaic { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .photo-card { border: 1px solid var(--slate-200); border-radius: 8px; overflow: hidden; }
    .photo-card img { width: 100%; height: 200px; object-fit: cover; border-bottom: 1px solid var(--slate-50); }
    .photo-caption { padding: 8px; text-align: center; font-size: 9px; font-weight: 500; color: var(--slate-500); }

    .print-button {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--primary);
        color: white;
        border: none;
        padding: 15px 35px;
        border-radius: 50px;
        font-family: 'Montserrat', sans-serif;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 10px 20px rgba(0,0,0,0.15);
        z-index: 9999;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    @media print {
        body { background: white; padding: 0; }
        .no-print { display: none !important; }
        .page-container { margin: 0; width: 210mm; }
        .a4-page { box-shadow: none; border: none; padding: 15mm; }
    }
`;

export async function generateServiceOrderPDF(order: any) {
    try {
        const company = await getCompanyConfig();
        let techName = '-', techSig = '';

        if (order.technician_id) {
            const { data: tech } = await supabase.from('profiles').select('full_name, signature_url').eq('id', order.technician_id).maybeSingle();
            if (tech) {
                techName = tech.full_name || '-';
                techSig = tech.signature_url || '';
            }
        }

        const { data: orderItems } = await supabase.from('service_order_items').select('*').eq('order_id', order.id).order('created_at');
        const osNumber = formatOrderId(order.id, order.created_at);
        const photos = order.photos_url || order.photos || [];
        const color = company.color;
        const totalItems = orderItems?.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0) || 0;

        const w = window.open('', '_blank');
        if (!w) return;

        w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>ORDEM DE SERVIÇO - #${osNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">Gerar PDF Final 📄</button>
  
  <div class="page-container">
    <div class="a4-page">
      <div class="header">
        <div class="company-brand">
          ${company.logo ? `<img src="${company.logo}">` : ''}
          <div class="company-name">${company.name}</div>
          <div class="company-meta">
            CNPJ: ${company.cnpj}<br>
            ${company.address}<br>
            ${company.phone} ${company.email ? `• ${company.email}` : ''}
          </div>
        </div>
        <div class="doc-info">
          <div class="doc-type">ORDEM DE SERVIÇO</div>
          <div class="doc-id">#${osNumber}</div>
          <div class="doc-date">EMITIDO EM: ${formatDate(order.created_at)}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DADOS DO ATENDIMENTO</div>
        <div class="info-grid">
          <div class="info-card">
            <div class="field"><span class="label">CLIENTE</span><span class="value">${order.clients?.name || '-'}</span></div>
            <div class="field"><span class="label">CONTATO / CNPJ</span><span class="value">${order.clients?.cnpj_cpf || '-'}</span></div>
            <div class="field"><span class="label">ENDEREÇO</span><span class="value">${order.clients?.address || '-'}</span></div>
          </div>
          <div class="info-card">
            <div class="field"><span class="label">PROFISSIONAL RESPONSÁVEL</span><span class="value">${techName}</span></div>
            <div class="field"><span class="label">DATA/HORA INÍCIO</span><span class="value">${formatDateTime(order.checkin_at)}</span></div>
            <div class="field"><span class="label">DATA/HORA FIM</span><span class="value">${formatDateTime(order.completed_at || order.updated_at)}</span></div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">EQUIPAMENTO</div>
        <div class="info-card" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="field"><span class="label">NOME / DESCRIÇÃO</span><span class="value">${order.equipments?.name || '-'}</span></div>
          <div class="field"><span class="label">MARCA / MODELO</span><span class="value">${order.equipments?.model || '-'}</span></div>
          <div class="field"><span class="label">Nº DE SÉRIE</span><span class="value">${order.equipments?.serial_number || '-'}</span></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DESCRIÇÃO DOS SERVIÇOS / RELATÓRIO</div>
        <div class="content-box">${order.execution_report || order.description || 'Nenhum relatório técnico registrado.'}</div>
      </div>

      ${orderItems && orderItems.length > 0 ? `
      <div class="section">
        <div class="section-title">MATERIAIS E SERVIÇOS</div>
        <table class="clean-table">
          <thead>
            <tr>
              <th style="width: 50%;">DESCRIÇÃO</th>
              <th style="text-align: center;">QTD</th>
              <th style="text-align: right;">VALOR UNIT.</th>
              <th style="text-align: right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${orderItems.map((item: any) => `
              <tr>
                <td>${item.description}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">R$ ${item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-weight: 700;">R$ ${(item.quantity * item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total-bar">
          <span class="total-label">INVESTIMENTO TOTAL</span>
          <span class="total-value">R$ ${totalItems.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>` : ''}

      <div class="signature-row">
        <div class="sign-box">
          <div class="sign-line">${techSig ? `<img src="${techSig}">` : ''}</div>
          <div class="sign-name">${techName}</div>
          <div class="sign-meta">TÉCNICO RESPONSÁVEL</div>
        </div>
        <div class="sign-box">
          <div class="sign-line">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
          <div class="sign-name">${order.signer_name || 'REPRESENTANTE DO CLIENTE'}</div>
          <div class="sign-meta">ACEITE E RECEBIMENTO</div>
        </div>
      </div>

      <div class="footer">
        <div>CHAMEI APP • SISTEMA DE GESTÃO PARA PRESTADORES</div>
        <div>Página 01 / ${photos.length > 0 ? '02' : '01'}</div>
      </div>
    </div>
  </div>

  ${photos.length > 0 ? `
  <div class="page-container">
    <div class="a4-page">
      <div class="header">
        <div class="company-brand">
          <div class="company-name">${company.name}</div>
        </div>
        <div class="doc-info">
          <div class="doc-type">ANEXO FOTOGRÁFICO</div>
          <div class="doc-id">#${osNumber}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="photo-mosaic">
          ${photos.map((url: string, i: number) => `
            <div class="photo-card">
              <img src="${url}">
              <div class="photo-caption">REGISTRO FOTOGRÁFICO #${i + 1}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="footer" style="margin-top: auto;">
        <div>DOCUMENTO DE EVIDÊNCIAS DE CAMPO</div>
        <div>Página 02 / 02</div>
      </div>
    </div>
  </div>` : ''}
</body>
</html>`);
        w.document.close();
    } catch (error) {
        console.error('PDF Error:', error);
        alert('Erro ao gerar RELATÓRIO TÉCNICO');
    }
}

export async function generateQuotePDF(quote: any) {
    try {
        const company = await getCompanyConfig();
        const quoteNumber = quote.quote_number || quote.id?.slice(0, 8).toUpperCase() || 'ORC';
        const color = company.color;
        const w = window.open('', '_blank');
        if (!w) return;

        w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>ORÇAMENTO - #${quoteNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">Gerar PDF do Orçamento 📄</button>
  
  <div class="page-container">
    <div class="a4-page">
      <div class="header">
        <div class="company-brand">
          ${company.logo ? `<img src="${company.logo}">` : ''}
          <div class="company-name">${company.name}</div>
        </div>
        <div class="doc-info">
          <div class="doc-type">ORÇAMENTO / PROPOSTA</div>
          <div class="doc-id">#${quoteNumber}</div>
          <div class="doc-date">DATA: ${formatDate(new Date().toISOString())}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">DESTINATÁRIO</div>
        <div class="info-card">
          <div class="field"><span class="label">CLIENTE</span><span class="value" style="font-size: 14px; color: var(--primary);">${quote.clients?.name || '-'}</span></div>
          <div class="field"><span class="label">ENDEREÇO</span><span class="value">${quote.clients?.address || '-'}</span></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">ESCOPO DOS SERVIÇOS</div>
        <div class="content-box">${quote.description || 'Especificações de serviços conforme solicitação.'}</div>
      </div>

      <div style="background: var(--slate-900); color: white; border-radius: 12px; padding: 30px; margin-top: 40px; text-align: right;">
        <p style="text-transform: uppercase; font-size: 8px; font-weight: 800; letter-spacing: 2.5px; opacity: 0.6; margin-bottom: 5px;">Investimento Total Estimado</p>
        <h2 style="font-size: 36px; font-weight: 900; letter-spacing: -1px;">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
        <p style="font-size: 9px; margin-top: 10px; opacity: 0.5;">PROPOSTA VÁLIDA POR 07 DIAS • CONDICIONADO À DISPONIBILIDADE.</p>
      </div>

      <div class="signature-row" style="margin-top: 80px;">
        <div class="sign-box">
          <div class="sign-line"></div>
          <div class="sign-name">${company.name}</div>
          <div class="sign-meta">DEPARTAMENTO COMERCIAL</div>
        </div>
        <div class="sign-box">
          <div class="sign-line"></div>
          <div class="sign-name">ACEITE DO CLIENTE</div>
          <div class="sign-meta">DATA E ASSINATURA</div>
        </div>
      </div>

      <div class="footer" style="margin-top: auto;">
        <div>DOCUMENTO COM CARÁTER DE PROPOSTA COMERCIAL</div>
        <div>EMITIDO EM: ${new Date().toLocaleDateString('pt-BR')}</div>
      </div>
    </div>
  </div>
</body>
</html>`);
        w.document.close();
    } catch (error) {
        console.error('PDF Error:', error);
        alert('Erro ao gerar ORÇAMENTO');
    }
}

export async function generateOvertimePDF(overtime: any) { }
