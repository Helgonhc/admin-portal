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
  
  @page { size: A4; margin: 10mm; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
  }
  
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  body { font-family: 'Inter', sans-serif; font-size: 10.5px; color: #334155; line-height: 1.4; background: #fff; }
  
  .container { width: 100%; max-width: 800px; margin: 0 auto; }
  
  /* HEADER V4 - LOGO MAIOR */
  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid ${color}; padding-bottom: 25px; margin-bottom: 25px; }
  .logo-box { width: 220px; min-height: 100px; display: flex; align-items: center; justify-content: flex-start; }
  .logo-box img { max-width: 100%; max-height: 110px; object-fit: contain; }
  
  .company-meta { text-align: right; flex: 1; padding-left: 30px; }
  .company-meta h1 { font-size: 18px; font-weight: 800; color: ${color}; text-transform: uppercase; margin-bottom: 4px; }
  .company-meta p { font-size: 10px; color: #64748b; margin-top: 2px; }
  .doc-info { margin-top: 15px; display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 15px; text-align: right; }
  .doc-info span { font-size: 11px; font-weight: 700; color: #1e293b; display: block; }
  .doc-info label { font-size: 8.5px; font-weight: 600; color: #94a3b8; text-transform: uppercase; }

  /* SECTION STYLING COMPACTO */
  .section { margin-bottom: 20px; }
  .section-h { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; }
  .section-h h2 { font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
  .section-h .line { flex: 1; height: 1px; background: #f1f5f9; }

  /* INFO GRID */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .info-block { background: #fff; }
  .info-row { display: flex; padding: 6px 0; border-bottom: 1px solid #f8fafc; }
  .info-row .lbl { font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; width: 90px; }
  .info-row .val { font-size: 10.5px; color: #1e293b; font-weight: 500; flex: 1; }

  /* CHECKLIST COMPACTO */
  .checklist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .check-item { display: flex; align-items: center; padding: 6px 10px; background: #f8fafc; border-radius: 4px; border: 1px solid #f1f5f9; }
  .dot { width: 14px; height: 14px; border: 1.5px solid #cbd5e1; border-radius: 3px; margin-right: 8px; display: flex; align-items: center; justify-content: center; }
  .dot.done { background: ${color}; border-color: ${color}; }
  .dot.done::after { content: "✓"; color: white; font-size: 9px; font-weight: 900; }

  /* REPORT BOX */
  .report-view { background: #fdfdfd; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; font-size: 11px; line-height: 1.6; color: #334155; white-space: pre-wrap; }

  /* PHOTOS V4 - 3 POR LINHA (COMPACTO) */
  .photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 5px; }
  .photo-item { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; aspect-ratio: 1/1; background: #f1f5f9; }
  .photo-item img { width: 100%; height: 100%; object-fit: cover; }

  /* SIGNATURES COMPACTAS */
  .sigs { display: flex; justify-content: space-between; margin-top: 35px; page-break-inside: avoid; }
  .sig-col { width: 45%; border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center; }
  .sig-img { height: 70px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px; }
  .sig-img img { max-height: 60px; max-width: 100%; }
  .sig-name { font-size: 11px; font-weight: 700; color: #0f172a; }
  .sig-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; }

  .footer { margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; color: #94a3b8; font-size: 9px; }
  
  .print-btn { position: fixed; bottom: 25px; right: 25px; background: ${color}; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-family: 'Inter', sans-serif; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; }
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
    const report = order.execution_report || order.description || 'Nenhum relatório técnico registrado.';
    const color = company.color;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OS #${osNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">IMPRIMIR RELATÓRIO</button>
  <div class="container">
    <div class="header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="company-meta">
        <h1>${company.name}</h1>
        <p>${company.address}</p>
        <p>${company.email} • ${company.phone}</p>
        <div class="doc-info">
          <label>ORDEM DE SERVIÇO</label>
          <span>#${osNumber}</span>
          <label style="margin-top:2px; display:block;">Data: ${formatDate(order.created_at)}</label>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-h"><h2>Identificação Cliente</h2><div class="line"></div></div>
      <div class="info-grid">
        <div class="info-block">
          <div class="info-row"><span class="lbl">Cliente</span><span class="val">${order.clients?.name || '-'}</span></div>
          <div class="info-row"><span class="lbl">CPF/CNPJ</span><span class="val">${order.clients?.cnpj_cpf || '-'}</span></div>
        </div>
        <div class="info-block">
          <div class="info-row"><span class="lbl">Local</span><span class="val">${order.clients?.address || '-'}</span></div>
          <div class="info-row"><span class="lbl">Contato</span><span class="val">${order.clients?.phone || '-'}</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-h"><h2>Execução Técnica</h2><div class="line"></div></div>
      <div class="info-grid">
        <div class="info-block">
          <div class="info-row"><span class="lbl">Título</span><span class="val">${order.title || '-'}</span></div>
          <div class="info-row"><span class="lbl">Técnico</span><span class="val">${techName}</span></div>
        </div>
        <div class="info-block">
          <div class="info-row"><span class="lbl">Início</span><span class="val">${formatDateTime(order.checkin_at)}</span></div>
          <div class="info-row"><span class="lbl">Término</span><span class="val">${formatDateTime(order.completed_at)}</span></div>
        </div>
      </div>
    </div>

    ${tasks && tasks.length > 0 ? `
    <div class="section">
      <div class="section-h"><h2>Itens Verificados</h2><div class="line"></div></div>
      <div class="checklist">
        ${tasks.map((t: any) => `
          <div class="check-item"><div class="dot ${t.is_completed ? 'done' : ''}"></div><span style="font-size:10px;">${t.title}</span></div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="section">
      <div class="section-h"><h2>Relatório Técnico</h2><div class="line"></div></div>
      <div class="report-view">${report}</div>
    </div>

    ${photos.length > 0 ? `
    <div class="section">
      <div class="section-h"><h2>Evidências Fotográficas</h2><div class="line"></div></div>
      <div class="photos-grid">
        ${photos.map((url: string) => `<div class="photo-item"><img src="${url}"></div>`).join('')}
      </div>
    </div>` : ''}

    <div class="sigs">
      <div class="sig-col">
        <div class="sig-img">${techSig ? `<img src="${techSig}">` : ''}</div>
        <div class="sig-name">${techName}</div>
        <div class="sig-label">Técnico Responsável</div>
      </div>
      <div class="sig-col">
        <div class="sig-img">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
        <div class="sig-name">${order.signer_name || 'Responsável'}</div>
        <div class="sig-label">Assinatura Cliente</div>
      </div>
    </div>

    <div class="footer">
      <span>${company.name} • Gerado via ChameiApp</span>
      <span>Pág 01/01</span>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar PDF Compacto'); }
}

export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    const quoteNumber = quote.quote_number || quote.id?.slice(0, 8).toUpperCase() || 'ORC';
    const color = company.color;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Orçamento #${quoteNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="company-meta">
        <h1>${company.name}</h1>
        <div class="doc-info">
          <label>PROPOSTA COMERCIAL</label>
          <span>#${quoteNumber}</span>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-h"><h2>DADOS DO CLIENTE</h2><div class="line"></div></div>
      <div class="info-row"><span class="lbl">Cliente</span><span class="val">${quote.clients?.name || '-'}</span></div>
    </div>
    <div class="section">
      <div class="section-h"><h2>ESCOPO DE TRABALHO</h2><div class="line"></div></div>
      <div class="report-view">${quote.description || 'Proposta de serviços técnicos.'}</div>
    </div>
    <div style="background:#f1f5f9; padding:20px; border-radius:8px; border-left:4px solid ${color}; text-align:right;">
      <p style="font-size:11px; font-weight:700;">VALOR TOTAL DO INVESTIMENTO</p>
      <h2 style="font-size:24px; color:${color}; font-weight:800;">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar orçamento'); }
}

export async function generateOvertimePDF(overtime: any) {
  try {
    const company = await getCompanyConfig();
    const color = company.color;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><style>${getCommonCSS(color)}</style></head><body>
      <div class="container">
        <div class="header"><div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div></div>
        <div class="section">
          <div class="section-h"><h2>CONTROLE DE HORAS</h2><div class="line"></div></div>
          <div class="info-row"><span class="lbl">Data</span><span class="val">${formatDate(overtime.date || overtime.created_at)}</span></div>
          <div class="info-row"><span class="lbl">Carga Horária</span><span class="val"><strong>${overtime.hours || 0} HORAS</strong></span></div>
        </div>
      </div>
    </body></html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar banco de horas'); }
}
