import { supabase } from '../lib/supabase';

// Formatar data/hora - extrai DIRETO da string sem conversão
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

const getCommonStyles = (color: string) => `
  @page { size: A4; margin: 10mm; }
  @media print {
    html, body { height: auto !important; }
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.5; background: white; padding: 0; }
  .container { padding: 20px; }
  .header { display: flex; align-items: center; border-bottom: 3px solid ${color}; padding-bottom: 15px; margin-bottom: 20px; }
  .logo { width: 80px; height: 60px; display: flex; align-items: center; justify-content: center; }
  .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .company { flex: 1; padding: 0 20px; }
  .company h1 { font-size: 18px; color: ${color}; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .company p { font-size: 10px; color: #666; margin: 2px 0; }
  .doc-info { background: ${color}; color: white; padding: 12px 20px; border-radius: 8px; text-align: center; min-width: 150px; }
  .doc-info small { font-size: 8px; display: block; opacity: 0.9; text-transform: uppercase; margin-bottom: 2px; }
  .doc-info strong { font-size: 16px; }
  .doc-date { font-size: 10px; color: #666; margin-top: 8px; text-align: right; font-weight: 500; }
  
  .section { margin-bottom: 20px; }
  .section-title { background: #f8fafc; border-left: 4px solid ${color}; padding: 8px 12px; font-size: 11px; font-weight: bold; color: #1e293b; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .grid { display: flex; gap: 20px; }
  .col { flex: 1; }
  .field { display: flex; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .field:last-child { border-bottom: none; }
  .label { width: 80px; font-weight: 600; color: #64748b; font-size: 10px; }
  .value { flex: 1; font-size: 10px; color: #1e293b; }
  
  .checklist { display: flex; flex-wrap: wrap; gap: 8px; }
  .check-item { width: calc(50% - 4px); display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; font-size: 10px; border: 1px solid #e2e8f0; }
  .check-item.done { color: #059669; background: #f0fdf4; border-color: #bcf0da; }
  .check-item.pending { color: #94a3b8; }
  
  .report-text { font-size: 11px; color: #334155; line-height: 1.6; white-space: pre-wrap; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
  
  .photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 10px; }
  .photo-item { aspect-ratio: 1; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
  .photo-item img { width: 100%; height: 100%; object-fit: cover; }
  
  .signatures { display: flex; justify-content: space-around; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; page-break-inside: avoid; }
  .signature-box { text-align: center; width: 220px; }
  .sig-img { height: 50px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 8px; }
  .sig-img img { max-height: 50px; max-width: 150px; }
  .sig-line { border-top: 1.5px solid #1e293b; margin-bottom: 6px; }
  .sig-name { font-weight: bold; font-size: 11px; color: #1e293b; }
  .sig-role { font-size: 9px; color: #64748b; margin-bottom: 2px; }
  .sig-doc { font-size: 8px; color: #94a3b8; }
  
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; }
  .print-btn { position: fixed; top: 20px; right: 20px; background: ${color}; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; z-index: 9999; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: transform 0.2s; }
  .print-btn:hover { transform: scale(1.05); }
`;

export async function generateServiceOrderPDF(order: any) {
  try {
    const company = await getCompanyConfig();
    let techName = 'Técnico Responsável', techSig = '', techDoc = '';
    
    if (order.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name, signature_url, cpf').eq('id', order.technician_id).maybeSingle();
      if (tech) { techName = tech.full_name || techName; techSig = tech.signature_url || ''; techDoc = tech.cpf || ''; }
    }

    const { data: tasks } = await supabase.from('order_tasks').select('*').eq('order_id', order.id).order('created_at');
    const osNumber = formatOrderId(order.id, order.created_at);
    const photos = order.photos_url || order.photos || [];
    const report = order.execution_report || order.description || 'Nenhuma observação registrada.';
    const color = company.color;

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }

    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>OS #${osNumber}</title>
<style>${getCommonStyles(color)}</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
<div class="container">
  <div class="header">
    <div class="logo">${company.logo ? `<img src="${company.logo}" alt="Logo">` : ''}</div>
    <div class="company">
      <h1>${company.name}</h1>
      ${company.cnpj ? `<p><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
      ${company.address ? `<p>${company.address}</p>` : ''}
      <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
    </div>
    <div>
      <div class="doc-info">
        <small>ORDEM DE SERVIÇO</small>
        <strong>#${osNumber}</strong>
      </div>
      <div class="doc-date">${formatDate(order.created_at)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="col">
      <div class="section-title">👤 Dados do Cliente</div>
      <div class="box">
        <div class="field"><span class="label">Cliente:</span><span class="value"><b>${order.clients?.name || '-'}</b></span></div>
        <div class="field"><span class="label">CNPJ/CPF:</span><span class="value">${order.clients?.cnpj_cpf || '-'}</span></div>
        <div class="field"><span class="label">Endereço:</span><span class="value">${order.clients?.address || '-'}</span></div>
        <div class="field"><span class="label">Contato:</span><span class="value">${order.clients?.phone || '-'}</span></div>
      </div>
    </div>
    <div class="col">
      <div class="section-title">🔧 Execução e Técnico</div>
      <div class="box">
        <div class="field"><span class="label">Serviço:</span><span class="value"><b>${order.title || '-'}</b></span></div>
        <div class="field"><span class="label">Técnico:</span><span class="value">${techName}</span></div>
        <div class="field"><span class="label">Início:</span><span class="value"><b>${formatDateTime(order.checkin_at)}</b></span></div>
        <div class="field"><span class="label">Término:</span><span class="value"><b>${formatDateTime(order.completed_at)}</b></span></div>
      </div>
    </div>
  </div>

  ${tasks && tasks.length > 0 ? `
  <div class="section">
    <div class="section-title">✅ Checklist de Verificação</div>
    <div class="checklist">
      ${tasks.map((t: any) => `
        <div class="check-item ${t.is_completed ? 'done' : 'pending'}">
          ${t.is_completed ? '☑' : '☐'} ${t.title}
        </div>`).join('')}
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">📝 Relatório Técnico</div>
    <div class="report-text">${report}</div>
  </div>

  ${photos.length > 0 ? `
  <div class="section">
    <div class="section-title">📷 Registro Fotográfico (${photos.length})</div>
    <div class="photo-grid">
      ${photos.map((url: string) => `<div class="photo-item"><img src="${url}"></div>`).join('')}
    </div>
  </div>` : ''}

  <div class="signatures">
    <div class="signature-box">
      <div class="sig-img">${techSig ? `<img src="${techSig}" alt="Assinatura">` : ''}</div>
      <div class="sig-line"></div>
      <div class="sig-name">${techName}</div>
      <div class="sig-role">Técnico Responsável</div>
      ${techDoc ? `<div class="sig-doc">CPF: ${techDoc}</div>` : ''}
    </div>
    <div class="signature-box">
      <div class="sig-img">${order.signature_url ? `<img src="${order.signature_url}" alt="Assinatura">` : ''}</div>
      <div class="sig-line"></div>
      <div class="sig-name">${order.signer_name || 'Responsável'}</div>
      <div class="sig-role">Responsável pelo Cliente</div>
      ${order.signer_doc ? `<div class="sig-doc">CPF: ${order.signer_doc}</div>` : ''}
    </div>
  </div>

  <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')} • ${company.name}</div>
</div>
</body>
</html>`);
    w.document.close();
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}

export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    const quoteNumber = quote.quote_number || quote.id?.slice(0, 8).toUpperCase() || 'ORC';
    const color = company.color;

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups'); return; }

    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Orçamento #${quoteNumber}</title>
<style>${getCommonStyles(color)}
  .total-card { background: ${color}; color: white; padding: 20px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .total-label { font-size: 14px; opacity: 0.9; }
  .total-value { font-size: 24px; font-weight: bold; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
<div class="container">
  <div class="header">
    <div class="logo">${company.logo ? `<img src="${company.logo}">` : ''}</div>
    <div class="company">
      <h1>${company.name}</h1>
      <p><b>CNPJ:</b> ${company.cnpj}</p>
      <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
    </div>
    <div>
      <div class="doc-info">
        <small>ORÇAMENTO</small>
        <strong>#${quoteNumber}</strong>
      </div>
      <div class="doc-date">${formatDate(quote.created_at)}</div>
    </div>
  </div>

  <div class="section-title">👤 Dados do Cliente</div>
  <div class="box">
    <div class="field"><span class="label">Cliente:</span><span class="value"><b>${quote.clients?.name || '-'}</b></span></div>
    <div class="field"><span class="label">CNPJ/CPF:</span><span class="value">${quote.clients?.cnpj_cpf || '-'}</span></div>
    <div class="field"><span class="label">Endereço:</span><span class="value">${quote.clients?.address || '-'}</span></div>
  </div>

  <div class="section-title">📜 Descrição do Orçamento</div>
  <div class="report-text">${quote.description || quote.title || 'Serviço técnico especializado.'}</div>

  <div class="total-card">
    <span class="total-label">VALOR TOTAL DO INVESTIMENTO</span>
    <span class="total-value">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
  </div>

  <div class="section" style="margin-top: 30px;">
    <p style="font-size: 10px; color: #64748b;">* Orçamento válido por 15 dias a partir da data de emissão.</p>
    <p style="font-size: 10px; color: #64748b;">* Condições de pagamento a combinar.</p>
  </div>

  <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')} • ${company.name}</div>
</div>
</body>
</html>`);
    w.document.close();
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}

export async function generateOvertimePDF(overtime: any) {
  try {
    const company = await getCompanyConfig();
    const overtimeNumber = overtime.id?.slice(0, 8).toUpperCase() || 'BH';
    const color = company.color;
    
    let techName = 'Colaborador';
    if (overtime.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name').eq('id', overtime.technician_id).maybeSingle();
      if (tech) techName = tech.full_name || techName;
    }

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups'); return; }

    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Banco de Horas #${overtimeNumber}</title>
<style>${getCommonStyles(color)}
  .hours-box { background: #fefce8; border: 2px dashed #facc15; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
  .hours-val { font-size: 32px; font-weight: bold; color: #854d0e; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
<div class="container">
  <div class="header">
    <div class="logo">${company.logo ? `<img src="${company.logo}">` : ''}</div>
    <div class="company">
      <h1>${company.name}</h1>
      <p><b>CNPJ:</b> ${company.cnpj}</p>
    </div>
    <div>
      <div class="doc-info" style="background:#ca8a04">
        <small>BANCO DE HORAS</small>
        <strong>#${overtimeNumber}</strong>
      </div>
    </div>
  </div>

  <div class="section-title">📋 Informações do Registro</div>
  <div class="box">
    <div class="field"><span class="label">Colaborador:</span><span class="value"><b>${techName}</b></span></div>
    <div class="field"><span class="label">Cliente:</span><span class="value">${overtime.clients?.name || '-'}</span></div>
    <div class="field"><span class="label">Data:</span><span class="value">${formatDate(overtime.date || overtime.created_at)}</span></div>
    <div class="field"><span class="label">Tipo:</span><span class="value"><b>${overtime.type === 'extra' ? 'HORA EXTRA' : 'COMPENSAÇÃO'}</b></span></div>
  </div>

  <div class="hours-box">
    <div style="font-size: 12px; color: #854d0e; margin-bottom: 5px;">TOTAL DE HORAS</div>
    <div class="hours-val">${overtime.hours || overtime.total_hours || 0} horas</div>
  </div>

  ${overtime.description ? `
  <div class="section-title">📝 Justificativa / Observação</div>
  <div class="report-text">${overtime.description}</div>` : ''}

  <div class="signatures">
     <div class="signature-box">
      <div class="sig-line" style="margin-top: 50px;"></div>
      <div class="sig-name">${techName}</div>
      <div class="sig-role">Assinatura do Colaborador</div>
    </div>
    <div class="signature-box">
      <div class="sig-line" style="margin-top: 50px;"></div>
      <div class="sig-name">Responsável</div>
      <div class="sig-role">Visto da Empresa</div>
    </div>
  </div>

  <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')} • ${company.name}</div>
</div>
</body>
</html>`);
    w.document.close();
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}
