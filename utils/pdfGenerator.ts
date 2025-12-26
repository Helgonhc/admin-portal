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
    name: config?.company_name || 'PRESTADOR DE SERVIÇOS',
    cnpj: config?.company_cnpj || config?.cnpj || '',
    address: config?.company_address || config?.address || '',
    phone: config?.company_phone || config?.phone || '',
    email: config?.company_email || config?.email || '',
    logo: config?.company_logo || config?.logo_url || '',
    color: config?.primary_color || '#1e40af'
  };
}

const getCommonCSS = (color: string) => `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  
  @page { size: A4; margin: 8mm; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
  }
  
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  body { font-family: 'Inter', sans-serif; font-size: 10px; color: #334155; line-height: 1.3; background: #fff; }
  
  .container { width: 100%; margin: 0 auto; }
  
  /* HEADER V5 - LOGO MÁXIMA E LIMPEZA */
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${color}; padding-bottom: 15px; margin-bottom: 15px; }
  .logo-box { width: 280px; min-height: 80px; display: flex; align-items: center; justify-content: flex-start; }
  .logo-box img { max-width: 100%; max-height: 100px; object-fit: contain; }
  
  .header-meta { text-align: right; }
  .header-meta h1 { font-size: 16px; font-weight: 800; color: ${color}; text-transform: uppercase; }
  .os-badge { margin-top: 8px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 12px; display: inline-block; }
  .os-badge span { font-size: 12px; font-weight: 700; color: #0f172a; }

  /* SECTIONS ULTRA-COMPACT */
  .section { margin-bottom: 12px; }
  .section-h { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #f1f5f9; padding-bottom: 3px; margin-bottom: 6px; }

  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
  .info-table td { padding: 4px 0; border-bottom: 1px solid #f8fafc; }
  .lbl { font-size: 8px; font-weight: 600; color: #94a3b8; text-transform: uppercase; width: 80px; }
  .val { font-size: 10px; color: #1e293b; font-weight: 500; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

  /* CHECKLIST MINIMALISTA */
  .checklist { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .check-item { display: flex; align-items: center; padding: 4px 8px; background: #f8fafc; border-radius: 3px; }
  .dot { width: 12px; height: 12px; border: 1.5px solid #cbd5e1; border-radius: 2px; margin-right: 6px; display: flex; align-items: center; justify-content: center; }
  .dot.done { background: ${color}; border-color: ${color}; }
  .dot.done::after { content: "✓"; color: white; font-size: 8px; font-weight: 900; }

  /* REPORT BOX V5 */
  .report-view { background: #fff; border: 1px solid #f1f5f9; padding: 12px; border-radius: 4px; font-size: 10px; line-height: 1.5; color: #334155; white-space: pre-wrap; }

  /* FOTOS V5 - 5 POR LINHA / SEM CORTES */
  .photos-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 5px; }
  .photo-box { border: 1px solid #f1f5f9; border-radius: 4px; overflow: hidden; aspect-ratio: 1/1; background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 2px; }
  .photo-box img { max-width: 100%; max-height: 100%; object-fit: contain; } /* GARANTE QUE A FOTO INTEIRA APAREÇA */

  /* SIGS ULTRA-COMPACT */
  .sigs { display: flex; justify-content: space-between; margin-top: 25px; page-break-inside: avoid; }
  .sig-col { width: 45%; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; }
  .sig-img { height: 50px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px; }
  .sig-img img { max-height: 45px; max-width: 100%; mix-blend-mode: multiply; }
  .sig-name { font-size: 10px; font-weight: 700; color: #0f172a; }
  .sig-lbl { font-size: 8px; color: #94a3b8; text-transform: uppercase; }

  .footer { margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 8px; display: flex; justify-content: space-between; color: #94a3b8; font-size: 8px; }
  
  .print-btn { position: fixed; bottom: 20px; right: 20px; background: ${color}; color: white; border: none; padding: 10px 20px; border-radius: 4px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.1); z-index: 1000; }
`;

export async function generateServiceOrderPDF(order: any) {
  try {
    const company = await getCompanyConfig();
    let techName = 'Colaborador Técnico', techSig = '';

    if (order.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name, signature_url').eq('id', order.technician_id).maybeSingle();
      if (tech) { techName = tech.full_name || techName; techSig = tech.signature_url || ''; }
    }

    const { data: tasks } = await supabase.from('order_tasks').select('*').eq('order_id', order.id).order('created_at');
    const osNumber = formatOrderId(order.id, order.created_at);
    const photos = order.photos_url || order.photos || [];
    const color = company.color;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>RELATÓRIO OS #${osNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">GERAR PDF / IMPRIMIR</button>
  <div class="container">
    <div class="header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="header-meta">
        <h1>RELATÓRIO TÉCNICO</h1>
        <div class="os-badge"><span>ORDEM DE SERVIÇO Nº ${osNumber}</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="section">
        <div class="section-h">Informações do Cliente</div>
        <table class="info-table">
          <tr><td class="lbl">Cliente</td><td class="val">${order.clients?.name || '-'}</td></tr>
          <tr><td class="lbl">Localização</td><td class="val">${order.clients?.address || '-'}</td></tr>
        </table>
      </div>
      <div class="section">
        <div class="section-h">Execução e Prazos</div>
        <table class="info-table">
          <tr><td class="lbl">Técnico</td><td class="val">${techName}</td></tr>
          <tr><td class="lbl">Concluído</td><td class="val">${formatDateTime(order.completed_at)}</td></tr>
        </table>
      </div>
    </div>

    ${tasks && tasks.length > 0 ? `
    <div class="section">
      <div class="section-h">Checklist de Conformidade</div>
      <div class="checklist">
        ${tasks.map((t: any) => `
          <div class="check-item"><div class="dot ${t.is_completed ? 'done' : ''}"></div><span style="font-size:9px;">${t.title}</span></div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="section">
      <div class="section-h">Descrição dos Serviços Executados</div>
      <div class="report-view">${order.execution_report || order.description || 'Serviço executado conforme solicitação do cliente.'}</div>
    </div>

    ${photos.length > 0 ? `
    <div class="section">
      <div class="section-h">Evidências Fotográficas (Visualização Integral)</div>
      <div class="photos-grid">
        ${photos.map((url: string) => `<div class="photo-box"><img src="${url}"></div>`).join('')}
      </div>
    </div>` : ''}

    <div class="sigs">
      <div class="sig-col">
        <div class="sig-img">${techSig ? `<img src="${techSig}">` : ''}</div>
        <div class="sig-name">${techName}</div>
        <div class="sig-lbl">Responsável Técnico</div>
      </div>
      <div class="sig-col">
        <div class="sig-img">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
        <div class="sig-name">${order.signer_name || 'Representante Cliente'}</div>
        <div class="sig-lbl">Assinatura Cliente</div>
      </div>
    </div>

    <div class="footer">
      <span>${company.name} • Oficial Intelligence Document</span>
      <span>Impressão: ${new Date().toLocaleDateString('pt-BR')}</span>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar relatório ultra-compacto'); }
}

export async function generateQuotePDF(quote: any) {
  // Padronizar conforme V5 para Admin
  const company = await getCompanyConfig();
  const quoteNumber = quote.quote_number || quote.id?.slice(0, 8).toUpperCase() || 'ORC';
  const color = company.color;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><style>${getCommonCSS(color)}</style></head><body>
    <div class="container">
      <div class="header">
        <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
        <div class="header-meta"><h1>PROPOSTA COMERCIAL</h1><div class="os-badge"><span>#${quoteNumber}</span></div></div>
      </div>
      <div class="section"><div class="section-h">Cliente</div><p class="val">${quote.clients?.name || '-'}</p></div>
      <div class="section"><div class="section-h">Escopo</div><div class="report-view">${quote.description || '-'}</div></div>
      <div style="background:#f8fafc; padding:15px; border-radius:4px; border:1px solid #e2e8f0; text-align:right;">
        <p class="lbl">INVESTIMENTO TOTAL</p>
        <h2 style="font-size:22px; color:${color};">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
      </div>
    </div>
  </body></html>`);
  w.document.close();
}

export async function generateOvertimePDF(overtime: any) {
  const company = await getCompanyConfig();
  const color = company.color;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><style>${getCommonCSS(color)}</style></head><body>
      <div class="container">
        <div class="header"><div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div></div>
        <div class="section">
          <div class="section-h">CONTROLE DE HORAS</div>
          <p class="val">Data: ${formatDate(overtime.date || overtime.created_at)}</p>
          <p class="val" style="font-size:18px; color:${color};"><strong>Total: ${overtime.hours || 0} horas</strong></p>
        </div>
      </div>
    </body></html>`);
  w.document.close();
}
