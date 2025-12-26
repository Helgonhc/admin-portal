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
  body { font-family: 'Inter', sans-serif; font-size: 10px; color: #334155; line-height: 1.4; background: #fff; }
  
  .container { width: 100%; margin: 0 auto; }
  
  /* HEADER V7 TECHNICAL - PRÁTICO E DIRETO */
  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid ${color}; padding-bottom: 20px; margin-bottom: 20px; }
  .logo-box { width: 250px; min-height: 80px; display: flex; align-items: center; justify-content: flex-start; }
  .logo-box img { max-width: 100%; max-height: 100px; object-fit: contain; }
  
  .header-meta { text-align: right; flex: 1; }
  .header-meta h1 { font-size: 18px; font-weight: 800; color: ${color}; text-transform: uppercase; margin-bottom: 4px; }
  .os-info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; display: inline-block; margin-top: 5px; }
  .os-info-box span { font-size: 12px; font-weight: 700; color: #1e293b; }

  /* TECHNICAL SECTIONS */
  .section { margin-bottom: 15px; }
  .section-h { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
  .section-h h2 { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }

  .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #fdfdfd; border: 1px solid #f1f5f9; border-radius: 8px; padding: 12px; }
  .data-item { display: flex; border-bottom: 1px solid #f8fafc; padding: 4px 0; }
  .data-item:last-child { border-bottom: none; }
  .lbl { font-size: 8px; font-weight: 600; color: #94a3b8; text-transform: uppercase; width: 90px; }
  .val { font-size: 10px; color: #0f172a; font-weight: 500; flex: 1; }

  /* RELATORIO TECNICO V7 - FOCO EM CLAREZA INDUSTRIAL */
  .technical-report { background: #fff; border: 1.5px solid #e2e8f0; padding: 15px; border-radius: 8px; font-size: 10.5px; line-height: 1.5; color: #334155; white-space: pre-wrap; text-align: left; }

  /* PHOTOS V7 - 5 POR LINHA ARREDONDADAS SUTILMENTE */
  .photos-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 5px; }
  .photo-frame { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; aspect-ratio: 1; background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 2px; }
  .photo-frame img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; }

  /* SIGNATURES TECHNICAL */
  .sigs { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; }
  .sig-col { width: 45%; border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; }
  .sig-img { height: 50px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px; }
  .sig-img img { max-height: 48px; max-width: 100%; mix-blend-mode: multiply; }
  .sig-name { font-size: 10px; font-weight: 700; color: #0f172a; }
  .sig-lbl { font-size: 8px; color: #94a3b8; text-transform: uppercase; }

  .footer { margin-top: 25px; border-top: 1px solid #f1f5f9; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; color: #94a3b8; font-size: 8.5px; }
  
  .print-btn { position: fixed; bottom: 20px; right: 20px; background: ${color}; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-family: 'Inter', sans-serif; font-weight: 700; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.1); z-index: 1000; }
`;

export async function generateServiceOrderPDF(order: any) {
  try {
    const company = await getCompanyConfig();
    let techName = 'Ponto Focal Técnico', techSig = '';

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
  <title>ORDEM DE SERVIÇO TÉCNICO #${osNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">IMPRIMIR RELATÓRIO TÉCNICO</button>
  <div class="container">
    <div class="header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="header-meta">
        <h1>RELATÓRIO TÉCNICO</h1>
        <div class="os-info-box"><span>OS Nº ${osNumber} • Emitido em: ${formatDate(order.created_at)}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-h"><h2>Identificação e Campo</h2></div>
      <div class="data-grid">
        <div>
          <div class="data-item"><span class="lbl">Cliente</span><span class="val">${order.clients?.name || '-'}</span></div>
          <div class="data-item"><span class="lbl">CNPJ/CPF</span><span class="val">${order.clients?.cnpj_cpf || '-'}</span></div>
          <div class="data-item"><span class="lbl">Endereço</span><span class="val">${order.clients?.address || '-'}</span></div>
        </div>
        <div>
          <div class="data-item"><span class="lbl">Técnico</span><span class="val">${techName}</span></div>
          <div class="data-item"><span class="lbl">Check-in</span><span class="val">${formatDateTime(order.checkin_at)}</span></div>
          <div class="data-item"><span class="lbl">Conclusão</span><span class="val">${formatDateTime(order.completed_at)}</span></div>
        </div>
      </div>
    </div>

    ${tasks && tasks.length > 0 ? `
    <div class="section">
      <div class="section-h"><h2>Checklist de Verificação</h2></div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;">
        ${tasks.map((t: any) => `
          <div style="display: flex; align-items: center; padding: 4px 8px; background: #f8fafc; border-radius: 4px; border: 1px solid #f1f5f9;">
            <div style="width:12px; height:12px; border:1.5px solid ${t.is_completed ? color : '#cbd5e1'}; border-radius:2px; margin-right:8px; display:flex; align-items:center; justify-content:center; background:${t.is_completed ? color : 'transparent'};">
              ${t.is_completed ? '<span style="color:white; font-size:8px;">✓</span>' : ''}
            </div>
            <span style="font-size:9.5px;">${t.title}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="section">
      <div class="section-h"><h2>Parecer Técnico e Execução</h2></div>
      <div class="technical-report">${order.execution_report || order.description || 'Nenhum relatório textual foi registrado para este atendimento.'}</div>
    </div>

    ${photos.length > 0 ? `
    <div class="section">
      <div class="section-h"><h2>Evidências de Campo (5x1)</h2></div>
      <div class="photos-grid">
        ${photos.map((url: string) => `<div class="photo-frame"><img src="${url}"></div>`).join('')}
      </div>
    </div>` : ''}

    <div class="sigs">
      <div class="sig-col">
        <div class="sig-img">${techSig ? `<img src="${techSig}">` : ''}</div>
        <div class="sig-name">${techName}</div>
        <div class="sig-lbl">Assinatura do Técnico</div>
      </div>
      <div class="sig-col">
        <div class="sig-img">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
        <div class="sig-name">${order.signer_name || 'Representante Legal'}</div>
        <div class="sig-lbl">Assinatura do Cliente / Recebedor</div>
      </div>
    </div>

    <div class="footer">
      <span>${company.name} • Sistema de Gestão Técnica</span>
      <span>${new Date().toLocaleDateString('pt-BR')} • Página 01/01</span>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar RELATÓRIO TÉCNICO'); }
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
        <div class="header-meta"><h1>ORÇAMENTO TÉCNICO</h1><div class="os-info-box"><span>COT: #${quoteNumber}</span></div></div>
      </div>
      <div class="section"><div class="section-h"><h2>Cliente Destinatário</h2></div><p class="val" style="font-size:13px;">${quote.clients?.name || '-'}</p></div>
      <div class="section"><div class="section-h"><h2>Especificação dos Serviços</h2></div><div class="technical-report">${quote.description || 'Sem descrição.'}</div></div>
      <div style="background:#f8fafc; padding:20px; border-radius:8px; border:1px solid #e2e8f0; text-align:right; margin-top:20px;">
        <p class="lbl">TOTAL DA PROPOSTA</p>
        <h2 style="font-size:24px; color:${color}; font-weight:800;">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
      </div>
    </div>
  </body></html>`);
  w.document.close();
}

export async function generateOvertimePDF(overtime: any) { }
