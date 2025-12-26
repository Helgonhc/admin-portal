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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  @page { size: A4; margin: 12mm; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
  }
  
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1e293b; line-height: 1.5; background: white; }
  
  .container { width: 100%; max-width: 800px; margin: 0 auto; }
  
  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${color}; padding-bottom: 20px; margin-bottom: 25px; }
  .logo-box { width: 120px; height: 70px; display: flex; align-items: center; }
  .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .company-info { flex: 1; padding: 0 25px; }
  .company-info h1 { font-size: 16px; font-weight: 700; color: ${color}; margin-bottom: 5px; text-transform: uppercase; }
  .company-info p { font-size: 10px; color: #64748b; margin: 1px 0; }
  
  .doc-badge { background: #f1f5f9; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #e2e8f0; min-width: 140px; }
  .doc-badge span { font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; }
  .doc-badge strong { font-size: 15px; color: #1e293b; font-weight: 700; }
  
  /* Layout Grid */
  .grid { display: flex; gap: 20px; margin-bottom: 20px; }
  .col { flex: 1; }
  
  /* Sections */
  .section-title { font-size: 10px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
  
  .data-row { display: flex; margin-bottom: 6px; border-bottom: 1px solid #f8fafc; padding-bottom: 4px; }
  .data-row:last-child { border-bottom: none; margin-bottom: 0; }
  .label { font-size: 9px; font-weight: 600; color: #94a3b8; width: 85px; text-transform: uppercase; }
  .value { font-size: 10px; font-weight: 500; color: #1e293b; flex: 1; }
  
  /* Report / Description */
  .text-box { font-size: 11px; line-height: 1.6; color: #334155; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; white-space: pre-wrap; }
  
  /* Checklist */
  .checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .check-item { display: flex; align-items: center; gap: 8px; font-size: 10px; padding: 6px 10px; background: #fff; border: 1px solid #f1f5f9; border-radius: 4px; }
  .check-box { width: 14px; height: 14px; border: 1.5px solid #cbd5e1; border-radius: 3px; display: flex; align-items: center; justify-content: center; }
  .check-box.checked { background: ${color}; border-color: ${color}; }
  .check-box.checked::after { content: ''; width: 4px; height: 8px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); margin-bottom: 2px; }
  
  /* Photos */
  .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 10px; }
  .photo-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; aspect-ratio: 4/3; }
  .photo-card img { width: 100%; height: 100%; object-fit: cover; }
  
  /* Signatures */
  .signatures-section { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
  .sig-block { width: 45%; text-align: center; }
  .sig-inner { min-height: 80px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 10px; }
  .sig-inner img { max-height: 70px; max-width: 100%; }
  .sig-line { border-top: 1.5px solid #1e293b; margin-bottom: 8px; }
  .sig-details p { font-size: 10px; font-weight: 600; color: #1e293b; }
  .sig-details span { font-size: 9px; color: #64748b; }
  
  /* Quote Specifics */
  .total-card { margin-top: 25px; background: ${color}; color: white; padding: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
  .total-label { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
  .total-value { font-size: 20px; font-weight: 700; }
  
  /* Utility */
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 9px; color: #94a3b8; }
  .print-btn { position: fixed; bottom: 30px; right: 30px; background: ${color}; color: white; border: none; padding: 12px 25px; border-radius: 30px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 1000; transition: all 0.2s; }
  .print-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(0,0,0,0.2); }
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
  <button class="print-btn no-print" onclick="window.print()">IMPRIMIR DOCUMENTO</button>
  <div class="container">
    <div class="header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="company-info">
        <h1>${company.name}</h1>
        ${company.cnpj ? `<p>CNPJ: ${company.cnpj}</p>` : ''}
        ${company.address ? `<p>${company.address}</p>` : ''}
        <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
      </div>
      <div class="doc-badge">
        <span>ORDEM DE SERVIÇO</span>
        <strong>#${osNumber}</strong>
        <p style="font-size:8px; color:#94a3b8; margin-top:5px;">Emissão: ${formatDate(order.created_at)}</p>
      </div>
    </div>

    <div class="grid">
      <div class="col">
        <div class="section-title">CLIENTE</div>
        <div class="card">
          <div class="data-row"><div class="label">NOME</div><div class="value">${order.clients?.name || '-'}</div></div>
          <div class="data-row"><div class="label">CNPJ/CPF</div><div class="value">${order.clients?.cnpj_cpf || '-'}</div></div>
          <div class="data-row"><div class="label">ENDEREÇO</div><div class="value">${order.clients?.address || '-'}</div></div>
          <div class="data-row"><div class="label">TELEFONE</div><div class="value">${order.clients?.phone || '-'}</div></div>
        </div>
      </div>
      <div class="col">
        <div class="section-title">DETALHES DO SERVIÇO</div>
        <div class="card">
          <div class="data-row"><div class="label">TÍTULO</div><div class="value">${order.title || '-'}</div></div>
          <div class="data-row"><div class="label">TÉCNICO</div><div class="value">${techName}</div></div>
          <div class="data-row"><div class="label">INÍCIO</div><div class="value">${formatDateTime(order.checkin_at)}</div></div>
          <div class="data-row"><div class="label">TÉRMINO</div><div class="value">${formatDateTime(order.completed_at)}</div></div>
        </div>
      </div>
    </div>

    ${tasks && tasks.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div class="section-title">CHECKLIST DE VERIFICAÇÃO</div>
      <div class="checklist">
        ${tasks.map((t: any) => `
          <div class="check-item">
            <div class="check-box ${t.is_completed ? 'checked' : ''}"></div>
            ${t.title}
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div style="margin-bottom:20px;">
      <div class="section-title">RELATÓRIO TÉCNICO</div>
      <div class="text-box">${report}</div>
    </div>

    ${photos.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div class="section-title">REGISTRO FOTOGRÁFICO</div>
      <div class="photo-grid">
        ${photos.map((url: string) => `<div class="photo-card"><img src="${url}"></div>`).join('')}
      </div>
    </div>` : ''}

    <div class="signatures-section">
      <div class="sig-block">
        <div class="sig-inner">${techSig ? `<img src="${techSig}">` : ''}</div>
        <div class="sig-line"></div>
        <div class="sig-details">
          <p>${techName}</p>
          <span>Assinatura do Técnico</span>
        </div>
      </div>
      <div class="sig-block">
        <div class="sig-inner">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
        <div class="sig-line"></div>
        <div class="sig-details">
          <p>${order.signer_name || 'Responsável'}</p>
          <span>Responsável pelo Cliente</span>
        </div>
      </div>
    </div>

    <div class="footer">Este documento é um relatório técnico oficial de prestação de serviços • ${company.name}</div>
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
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Orçamento #${quoteNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">IMPRIMIR ORÇAMENTO</button>
  <div class="container">
    <div class="header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="company-info">
        <h1>${company.name}</h1>
        <p>CNPJ: ${company.cnpj}</p>
        <p>${company.email} • ${company.phone}</p>
      </div>
      <div class="doc-badge">
        <span>ORÇAMENTO</span>
        <strong>#${quoteNumber}</strong>
        <p style="font-size:8px; color:#94a3b8; margin-top:5px;">Válido até: ${formatDate(new Date(new Date(quote.created_at).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString())}</p>
      </div>
    </div>

    <div class="section-title">DADOS DO CLIENTE</div>
    <div class="card" style="margin-bottom:20px;">
      <div class="data-row"><div class="label">CLIENTE</div><div class="value">${quote.clients?.name || '-'}</div></div>
      <div class="data-row"><div class="label">CNPJ/CPF</div><div class="value">${quote.clients?.cnpj_cpf || '-'}</div></div>
      <div class="data-row"><div class="label">ENDEREÇO</div><div class="value">${quote.clients?.address || '-'}</div></div>
    </div>

    <div class="section-title">DESCRIÇÃO DOS SERVIÇOS / PRODUTOS</div>
    <div class="text-box" style="margin-bottom:20px;">${quote.description || 'Serviços técnicos especializados conforme solicitação.'}</div>

    <div class="total-card">
      <span class="total-label">INVESTIMENTO TOTAL</span>
      <span class="total-value">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
    </div>

    <div style="margin-top:30px; font-size:9px; color:#64748b;">
      <p>* Pagamento conforme condições comerciais acordadas.</p>
      <p>* Este orçamento é preliminar e está sujeito a alterações após visita técnica.</p>
    </div>

    <div class="footer">${company.name} • Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar orçamento'); }
}

export async function generateOvertimePDF(overtime: any) {
  try {
    const company = await getCompanyConfig();
    const ovNumber = overtime.id?.slice(0, 8).toUpperCase() || 'BH';
    const color = company.color;
    let techName = 'Colaborador';
    const { data: tech } = await supabase.from('profiles').select('full_name').eq('id', overtime.technician_id).maybeSingle();
    if (tech) techName = tech.full_name;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Banco de Horas #${ovNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">IMPRIMIR REGISTRO</button>
  <div class="container">
    <div class="header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="company-info">
        <h1>${company.name}</h1>
        <p>RELATÓRIO DE BANCO DE HORAS</p>
      </div>
      <div class="doc-badge" style="border-color:#facc15;">
        <span>REGISTRO</span>
        <strong>#${ovNumber}</strong>
      </div>
    </div>

    <div class="section-title">INFORMAÇÕES</div>
    <div class="card" style="margin-bottom:20px;">
      <div class="data-row"><div class="label">COLABORADOR</div><div class="value">${techName}</div></div>
      <div class="data-row"><div class="label">CLIENTE</div><div class="value">${overtime.clients?.name || '-'}</div></div>
      <div class="data-row"><div class="label">DATA</div><div class="value">${formatDate(overtime.date || overtime.created_at)}</div></div>
      <div class="data-row"><div class="label">TIPO</div><div class="value">${overtime.type === 'extra' ? 'HORA EXTRA' : 'COMPENSAÇÃO'}</div></div>
    </div>

    <div style="background:#fefce8; border:1px solid #fde047; padding:20px; border-radius:8px; text-align:center; margin-bottom:20px;">
      <p style="font-size:11px; color:#854d0e; font-weight:600; margin-bottom:5px;">TOTAL DE HORAS REGISTRADAS</p>
      <h2 style="font-size:28px; color:#854d0e;">${overtime.hours || 0} HORAS</h2>
    </div>

    ${overtime.description ? `
    <div class="section-title">JUSTIFICATIVA</div>
    <div class="text-box" style="margin-bottom:20px;">${overtime.description}</div>` : ''}

    <div class="signatures-section">
      <div class="sig-block">
        <div class="sig-inner"></div>
        <div class="sig-line"></div>
        <p style="font-size:10px; font-weight:600;">${techName}</p>
        <span style="font-size:9px; color:#64748b;">Assinatura do Colaborador</span>
      </div>
      <div class="sig-block">
        <div class="sig-inner"></div>
        <div class="sig-line"></div>
        <p style="font-size:10px; font-weight:600;">Responsável</p>
        <span style="font-size:9px; color:#64748b;">Visto da Empresa</span>
      </div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar banco de horas'); }
}
