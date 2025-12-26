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
  
  @page { size: A4; margin: 12mm; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
  }
  
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  body { font-family: 'Inter', sans-serif; font-size: 10.5px; color: #1e293b; line-height: 1.4; background: #fff; }
  
  .container { width: 100%; max-width: 800px; margin: 0 auto; }
  
  /* HEADER V6 PREMIUM */
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${color}; padding-bottom: 25px; margin-bottom: 30px; }
  .logo-box { width: 280px; min-height: 90px; display: flex; align-items: center; justify-content: flex-start; }
  .logo-box img { max-width: 100%; max-height: 110px; object-fit: contain; }
  
  .header-meta { text-align: right; flex: 1; }
  .header-meta h1 { font-size: 18px; font-weight: 800; color: ${color}; text-transform: uppercase; margin-bottom: 6px; }
  .os-label { background: #f1f5f9; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 6px 15px; display: inline-block; }
  .os-label span { font-size: 13px; font-weight: 800; color: #0f172a; }

  /* SECTIONS V6 REFINED */
  .section { margin-bottom: 25px; }
  .section-h { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .section-h h2 { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1.2px; white-space: nowrap; }
  .section-h .line { flex: 1; height: 1.5px; background: #f1f5f9; }

  .info-card { background: #fff; border: 1.5px solid #f1f5f9; border-radius: 12px; padding: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
  .info-item { border-bottom: 1px solid #f8fafc; padding: 5px 0; }
  .info-item:last-child { border-bottom: none; }
  .lbl { font-size: 8.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px; display: block; }
  .val { font-size: 10.5px; color: #1e293b; font-weight: 600; }

  /* CHECKLIST MODERN */
  .checklist { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .check-card { display: flex; align-items: center; padding: 8px 12px; background: #f8fafc; border: 1.5px solid #f1f5f9; border-radius: 10px; transition: all 0.2s; }
  .check-mark { width: 14px; height: 14px; border: 2px solid #cbd5e1; border-radius: 4px; margin-right: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .check-mark.checked { background: ${color}; border-color: ${color}; }
  .check-mark.checked::after { content: "✓"; color: white; font-size: 10px; font-weight: 900; }

  /* RELATORIO TECNICO REFINADO - FOCO EM LEGIBILIDADE */
  .report-box { background: #fdfdfd; border: 2px solid #f1f5f9; padding: 25px; border-radius: 16px; position: relative; overflow: hidden; }
  .report-box::before { content: ""; position: absolute; left: 0; top: 0; width: 5px; height: 100%; background: ${color}; opacity: 0.6; }
  .report-text { font-size: 11.5px; line-height: 1.7; color: #334155; white-space: pre-wrap; font-weight: 400; text-align: justify; }

  /* FOTOS V6 - ARREDONDADAS E INTEGRAL */
  .photos-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .photo-frame { border: 1.5px solid #f1f5f9; border-radius: 14px; overflow: hidden; aspect-ratio: 1; background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 3px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
  .photo-frame img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 10px; } /* ARREDONDA A FOTO DENTRO DO FRAME */

  /* SIGNATURES PREMIUM */
  .sigs { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
  .sig-box { width: 45%; border-top: 2px solid #e2e8f0; padding-top: 15px; text-align: center; }
  .sig-content { height: 60px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 8px; }
  .sig-content img { max-height: 55px; max-width: 100%; mix-blend-mode: multiply; }
  .sig-name { font-size: 11px; font-weight: 800; color: #0f172a; }
  .sig-role { font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }

  .footer { margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 15px; display: flex; justify-content: space-between; color: #94a3b8; font-size: 9px; font-weight: 500; }
  
  .print-action { position: fixed; bottom: 30px; right: 30px; background: #0f172a; color: white; border: none; padding: 15px 30px; border-radius: 12px; font-family: 'Inter', sans-serif; font-weight: 700; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 1000; transition: transform 0.2s; }
  .print-action:hover { transform: scale(1.05); }
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
  <button class="print-action no-print" onclick="window.print()">FINALIZAR E IMPRIMIR</button>
  <div class="container">
    <div class="header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="header-meta">
        <h1>RELATÓRIO EXECUTIVO</h1>
        <div class="os-label"><span>OS Nº ${osNumber}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-h"><h2>Dados da Ordem</h2><div class="line"></div></div>
      <div class="info-card">
        <div>
          <div class="info-item"><label class="lbl">Identificação Cliente</label><span class="val">${order.clients?.name || '-'}</span></div>
          <div class="info-item"><label class="lbl">Endereço de Execução</label><span class="val">${order.clients?.address || '-'}</span></div>
        </div>
        <div>
          <div class="info-item"><label class="lbl">Responsável Técnico</label><span class="val">${techName}</span></div>
          <div class="info-item"><label class="lbl">Data de Conclusão</label><span class="val">${formatDateTime(order.completed_at)}</span></div>
        </div>
      </div>
    </div>

    ${tasks && tasks.length > 0 ? `
    <div class="section">
      <div class="section-h"><h2>Listagem de Verificação</h2><div class="line"></div></div>
      <div class="checklist">
        ${tasks.map((t: any) => `
          <div class="check-card"><div class="check-mark ${t.is_completed ? 'checked' : ''}"></div><span style="font-size:9.5px; font-weight:500;">${t.title}</span></div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="section">
      <div class="section-h"><h2>Relatório Detalhado</h2><div class="line"></div></div>
      <div class="report-box">
        <div class="report-text">${order.execution_report || order.description || 'Nenhum registro textual registrado para esta ordem de serviço.'}</div>
      </div>
    </div>

    ${photos.length > 0 ? `
    <div class="section">
      <div class="section-h"><h2>Evidências de Execução</h2><div class="line"></div></div>
      <div class="photos-grid">
        ${photos.map((url: string) => `<div class="photo-frame"><img src="${url}"></div>`).join('')}
      </div>
    </div>` : ''}

    <div class="sigs">
      <div class="sig-box">
        <div class="sig-content">${techSig ? `<img src="${techSig}">` : ''}</div>
        <div class="sig-name">${techName}</div>
        <div class="sig-role">Certificação de Serviço</div>
      </div>
      <div class="sig-box">
        <div class="sig-content">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
        <div class="sig-name">${order.signer_name || 'Representante do Cliente'}</div>
        <div class="sig-role">Aceite e Conformidade</div>
      </div>
    </div>

    <div class="footer">
      <span>${company.name} • Documento Inteligente</span>
      <span>${new Date().toLocaleDateString('pt-BR')} • Página 1/1</span>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar relatório Premium V6'); }
}

export async function generateQuotePDF(quote: any) {
  const company = await getCompanyConfig();
  const quoteNumber = quote.quote_number || quote.id?.slice(0, 8).toUpperCase() || 'ORC';
  const color = company.color;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><style>${getCommonCSS(color)}</style></head><body>
    <div class="container">
      <div class="header">
        <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
        <div class="header-meta"><h1>PROPOSTA COMERCIAL</h1><div class="os-label"><span>REF: #${quoteNumber}</span></div></div>
      </div>
      <div class="section"><div class="section-h"><h2>Identificação Cliente</h2><div class="line"></div></div><p class="val" style="font-size:14px;">${quote.clients?.name || '-'}</p></div>
      <div class="section"><div class="section-h"><h2>Escopo e Detalhamento</h2><div class="line"></div></div><div class="report-box"><div class="report-text">${quote.description || 'Descrição comercial pendente.'}</div></div></div>
      <div style="background:#f8fafc; padding:25px; border-radius:16px; border:2px solid ${color}; text-align:right; margin-top:30px;">
        <p class="lbl" style="font-size:11px;">VALOR DO INVESTIMENTO</p>
        <h2 style="font-size:28px; color:${color}; font-weight:800;">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
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
  w.document.write(`<!DOCTYPE html><html><head><style>${getCommonCSS(color)}</style></head><body>
      <div class="container">
        <div class="header"><div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div></div>
        <div class="section">
          <div class="section-h"><h2>REGISTRO DE JORNADA</h2><div class="line"></div></div>
          <p class="val">Data: ${formatDate(overtime.date || overtime.created_at)}</p>
          <div style="background:#fefce8; padding:30px; border-radius:16px; text-align:center; margin-top:20px;">
            <p class="lbl">TOTAL REGISTRADO</p>
            <h2 style="font-size:40px; color:#854d0e;">${overtime.hours || 0} Horas</h2>
          </div>
        </div>
      </div>
    </body></html>`);
  w.document.close();
}
