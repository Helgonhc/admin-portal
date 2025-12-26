import { supabase } from '../lib/supabase';

// Formatar data/hora no timezone de Brasília
const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const formatOrderId = (id: string, dateString: string) => {
  if (!dateString) return id.slice(0, 6).toUpperCase();
  const d = new Date(dateString);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${id.slice(0, 4).toUpperCase()}`;
};

// Função para formatar texto em parágrafos HTML
const formatReportText = (text: string) => {
  if (!text || text.trim() === '') {
    return '<p><i>Nenhuma observação registrada.</i></p>';
  }
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => p.replace(/\n/g, '<br>'));
  if (paragraphs.length === 0) {
    return '<p><i>Nenhuma observação registrada.</i></p>';
  }
  return paragraphs.map(p => `<p>${p}</p>`).join('');
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


// ============================================
// FUNÇÃO PRINCIPAL - GERAR PDF DA OS
// ============================================
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
    const report = order.execution_report || order.description || '';

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }
    
    const html = generateHTML(company, order, osNumber, techName, techSig, techDoc, tasks || [], report, photos);
    w.document.write(html);
    w.document.close();
    
    // Aguardar imagens carregarem
    const images = w.document.querySelectorAll('img');
    let loaded = 0;
    const checkLoad = () => { if (++loaded >= images.length || loaded > 20) setTimeout(() => w.print(), 500); };
    if (images.length === 0) setTimeout(() => w.print(), 500);
    else images.forEach(img => { img.onload = checkLoad; img.onerror = checkLoad; });
    setTimeout(() => w.print(), 4000); // Fallback
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}


// ============================================
// FUNÇÃO QUE GERA O HTML DO PDF - LAYOUT PROFISSIONAL
// ============================================
function generateHTML(
  company: any, 
  order: any, 
  osNumber: string, 
  techName: string, 
  techSig: string, 
  techDoc: string, 
  tasks: any[], 
  report: string, 
  photos: string[]
) {
  const reportContent = formatReportText(report);
  const hasPhotos = photos.length > 0;
  
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>OS #${osNumber}</title>
<style>
@page { margin: 15mm 12mm; size: A4; }
@media print {
  .page-break { page-break-before: always; }
  .no-break { page-break-inside: avoid; }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', Arial, sans-serif;
  font-size: 10px;
  color: #333;
  line-height: 1.4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ===== HEADER ===== */
.header {
  display: flex;
  align-items: center;
  border-bottom: 3px solid ${company.color};
  padding-bottom: 15px;
  margin-bottom: 20px;
}
.logo { width: 80px; flex-shrink: 0; }
.logo img { max-width: 70px; max-height: 55px; }
.company-info { flex: 1; padding: 0 20px; }
.company-info h1 { font-size: 18px; color: ${company.color}; margin-bottom: 5px; font-weight: 700; }
.company-info p { font-size: 9px; color: #555; margin: 2px 0; }
.os-badge { text-align: right; }
.os-box {
  background: linear-gradient(135deg, ${company.color}, ${company.color}dd);
  color: #fff;
  padding: 12px 18px;
  border-radius: 8px;
  display: inline-block;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.os-box small { font-size: 8px; display: block; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; }
.os-box strong { font-size: 16px; font-weight: 700; }
.os-date { font-size: 9px; color: #666; margin-top: 8px; }

/* ===== SEÇÕES ===== */
.section { margin-bottom: 18px; }
.section-title {
  background: linear-gradient(90deg, #f8f9fa, #fff);
  border-left: 4px solid ${company.color};
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  color: #333;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* ===== GRID 2 COLUNAS ===== */
.two-cols { display: flex; gap: 20px; margin-bottom: 18px; }
.col { flex: 1; }

/* ===== TABELA DE DADOS ===== */
.data-table { width: 100%; border-collapse: collapse; }
.data-table td { padding: 6px 0; border-bottom: 1px solid #eee; font-size: 10px; vertical-align: top; }
.data-table .label { color: #666; width: 85px; font-weight: 600; }
.data-table .value { color: #222; }
.data-table .value b { color: #111; }

/* ===== CHECKLIST ===== */
.checklist { 
  display: grid; 
  grid-template-columns: repeat(2, 1fr); 
  gap: 6px 20px;
  padding: 10px;
  background: #fafafa;
  border-radius: 6px;
}
.check-item { 
  padding: 5px 0; 
  font-size: 10px; 
  display: flex;
  align-items: center;
  gap: 6px;
}
.check-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex-shrink: 0;
}
.check-done .check-icon { background: #dcfce7; color: #16a34a; }
.check-pending .check-icon { background: #f3f4f6; color: #9ca3af; }

/* ===== RELATÓRIO ===== */
.report-box {
  background: #fafafa;
  border: 1px solid #e5e7eb;
  padding: 15px 18px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 1.7;
  min-height: 80px;
}
.report-box p {
  margin-bottom: 10px;
  text-indent: 1.5em;
  text-align: justify;
}
.report-box p:last-child { margin-bottom: 0; }

/* ===== FOTOS - GRID 3x3 ===== */
.photos-section { margin-top: 25px; }
.photos-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}
.photo-item {
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
}
.photo-item img { 
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 4px;
}

/* ===== ASSINATURAS ===== */
.signatures {
  display: flex;
  justify-content: space-around;
  margin-top: 30px;
  padding-top: 20px;
}
.sig-col { 
  text-align: center; 
  width: 45%;
}
.sig-img-container {
  height: 50px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  margin-bottom: 5px;
}
.sig-img { max-height: 50px; max-width: 150px; }
.sig-line { 
  border-top: 1px solid #333; 
  margin: 8px 20px;
}
.sig-name { font-weight: 700; font-size: 10px; color: #111; }
.sig-role { font-size: 9px; color: #666; margin-top: 2px; }
.sig-doc { font-size: 8px; color: #999; margin-top: 3px; }

/* ===== FOOTER ===== */
.footer {
  margin-top: 25px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  text-align: center;
  font-size: 8px;
  color: #9ca3af;
}
</style>
</head>
<body>

<!-- ========== PÁGINA 1: DADOS + CHECKLIST + RELATÓRIO ========== -->
<div class="header">
  <div class="logo">
    ${company.logo ? `<img src="${company.logo}" alt="Logo" />` : ''}
  </div>
  <div class="company-info">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p><strong>CNPJ:</strong> ${company.cnpj}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
  </div>
  <div class="os-badge">
    <div class="os-box">
      <small>Ordem de Serviço</small>
      <strong>#${osNumber}</strong>
    </div>
    <div class="os-date">${formatDate(order.created_at)}</div>
  </div>
</div>

<div class="two-cols">
  <div class="col">
    <div class="section">
      <div class="section-title">Dados do Cliente</div>
      <table class="data-table">
        <tr><td class="label">Cliente:</td><td class="value"><b>${order.clients?.name || '-'}</b></td></tr>
        <tr><td class="label">CNPJ/CPF:</td><td class="value">${order.clients?.cnpj_cpf || '-'}</td></tr>
        <tr><td class="label">Endereço:</td><td class="value">${order.clients?.address || '-'}</td></tr>
        <tr><td class="label">Contato:</td><td class="value">${order.clients?.phone || '-'}</td></tr>
      </table>
    </div>
  </div>
  <div class="col">
    <div class="section">
      <div class="section-title">Dados da Execução</div>
      <table class="data-table">
        <tr><td class="label">Serviço:</td><td class="value"><b>${order.title || '-'}</b></td></tr>
        <tr><td class="label">Técnico:</td><td class="value">${techName}</td></tr>
        <tr><td class="label">Início:</td><td class="value">${formatDateTime(order.checkin_at)}</td></tr>
        <tr><td class="label">Término:</td><td class="value">${formatDateTime(order.completed_at)}</td></tr>
      </table>
    </div>
  </div>
</div>

${tasks && tasks.length > 0 ? `
<div class="section no-break">
  <div class="section-title">Checklist de Verificação</div>
  <div class="checklist">
    ${tasks.map((t: any) => `
      <div class="check-item ${t.is_completed ? 'check-done' : 'check-pending'}">
        <span class="check-icon">${t.is_completed ? '✓' : '○'}</span>
        <span>${t.title}</span>
      </div>
    `).join('')}
  </div>
</div>
` : ''}

<div class="section no-break">
  <div class="section-title">Relatório Técnico / Observações</div>
  <div class="report-box">${reportContent}</div>
</div>

${hasPhotos ? `
<!-- ========== PÁGINA 2: FOTOS + ASSINATURAS ========== -->
<div class="page-break"></div>

<div class="photos-section">
  <div class="section-title">Registro Fotográfico (${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'})</div>
  <div class="photos-grid">
    ${photos.map((url: string) => `
      <div class="photo-item">
        <img src="${url}" alt="Foto" />
      </div>
    `).join('')}
  </div>
</div>
` : ''}

<div class="signatures no-break">
  <div class="sig-col">
    <div class="sig-img-container">
      ${techSig ? `<img src="${techSig}" class="sig-img" alt="Assinatura Técnico" />` : ''}
    </div>
    <div class="sig-line"></div>
    <div class="sig-name">${techName}</div>
    <div class="sig-role">Técnico Responsável</div>
    ${techDoc ? `<div class="sig-doc">CPF: ${techDoc}</div>` : ''}
  </div>
  <div class="sig-col">
    <div class="sig-img-container">
      ${order.signature_url ? `<img src="${order.signature_url}" class="sig-img" alt="Assinatura Cliente" />` : ''}
    </div>
    <div class="sig-line"></div>
    <div class="sig-name">${order.signer_name || order.clients?.responsible_name || 'Responsável'}</div>
    <div class="sig-role">Responsável pelo Cliente</div>
    ${order.signer_doc ? `<div class="sig-doc">CPF: ${order.signer_doc}</div>` : ''}
  </div>
</div>

<div class="footer">
  Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • Sistema Chamei
</div>

</body>
</html>`;
}


// ============================================
// FUNÇÃO PARA GERAR PDF DE ORÇAMENTO
// ============================================
export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    const quoteNumber = quote.id?.slice(0, 8).toUpperCase() || 'ORC';
    
    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }
    
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Orçamento #${quoteNumber}</title>
<style>
@page { margin: 15mm; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.5; }
.header { display: flex; align-items: center; border-bottom: 3px solid ${company.color}; padding-bottom: 15px; margin-bottom: 25px; }
.logo { width: 80px; }
.logo img { max-width: 70px; max-height: 55px; }
.company-info { flex: 1; padding: 0 20px; }
.company-info h1 { font-size: 18px; color: ${company.color}; margin-bottom: 5px; }
.company-info p { font-size: 9px; color: #555; margin: 2px 0; }
.quote-badge { text-align: right; }
.quote-box { background: ${company.color}; color: #fff; padding: 12px 18px; border-radius: 8px; display: inline-block; }
.quote-box small { font-size: 8px; display: block; opacity: 0.9; }
.quote-box strong { font-size: 16px; }
.section { margin-bottom: 20px; }
.section-title { background: #f5f5f5; border-left: 4px solid ${company.color}; padding: 8px 12px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table td { padding: 8px; border-bottom: 1px solid #eee; }
.data-table .label { color: #666; width: 120px; font-weight: 600; }
.items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
.items-table th { background: ${company.color}; color: #fff; padding: 10px; text-align: left; font-size: 10px; }
.items-table td { padding: 10px; border-bottom: 1px solid #eee; }
.items-table .total-row { background: #f9fafb; font-weight: 700; }
.total-box { background: ${company.color}; color: #fff; padding: 15px 20px; border-radius: 8px; text-align: right; margin-top: 20px; }
.total-box span { font-size: 12px; opacity: 0.9; }
.total-box strong { font-size: 22px; display: block; margin-top: 5px; }
.footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 9px; color: #888; }
</style>
</head>
<body>
<div class="header">
  <div class="logo">${company.logo ? `<img src="${company.logo}" />` : ''}</div>
  <div class="company-info">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p><strong>CNPJ:</strong> ${company.cnpj}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
  </div>
  <div class="quote-badge">
    <div class="quote-box">
      <small>ORÇAMENTO</small>
      <strong>#${quoteNumber}</strong>
    </div>
    <div style="font-size:9px;color:#666;margin-top:8px;">${formatDate(quote.created_at)}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Dados do Cliente</div>
  <table class="data-table">
    <tr><td class="label">Cliente:</td><td><b>${quote.clients?.name || quote.client_name || '-'}</b></td></tr>
    <tr><td class="label">CNPJ/CPF:</td><td>${quote.clients?.cnpj_cpf || '-'}</td></tr>
    <tr><td class="label">Endereço:</td><td>${quote.clients?.address || '-'}</td></tr>
    <tr><td class="label">Contato:</td><td>${quote.clients?.phone || '-'}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">Descrição do Serviço</div>
  <p style="padding:10px;background:#fafafa;border-radius:6px;">${quote.description || quote.title || 'Serviço técnico especializado'}</p>
</div>

${quote.items && quote.items.length > 0 ? `
<div class="section">
  <div class="section-title">Itens do Orçamento</div>
  <table class="items-table">
    <thead>
      <tr><th>Descrição</th><th style="width:80px;text-align:center;">Qtd</th><th style="width:100px;text-align:right;">Valor Unit.</th><th style="width:100px;text-align:right;">Total</th></tr>
    </thead>
    <tbody>
      ${quote.items.map((item: any) => `
        <tr>
          <td>${item.description || item.name}</td>
          <td style="text-align:center;">${item.quantity || 1}</td>
          <td style="text-align:right;">R$ ${(item.unit_price || item.price || 0).toFixed(2)}</td>
          <td style="text-align:right;">R$ ${((item.quantity || 1) * (item.unit_price || item.price || 0)).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>
` : ''}

<div class="total-box">
  <span>VALOR TOTAL</span>
  <strong>R$ ${(quote.total_value || quote.value || 0).toFixed(2)}</strong>
</div>

${quote.notes ? `
<div class="section" style="margin-top:25px;">
  <div class="section-title">Observações</div>
  <p style="padding:10px;background:#fafafa;border-radius:6px;">${quote.notes}</p>
</div>
` : ''}

<div class="footer">
  Orçamento válido por 30 dias • Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
</div>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}


// ============================================
// FUNÇÃO PARA GERAR PDF DE BANCO DE HORAS
// ============================================
export async function generateOvertimePDF(overtime: any) {
  try {
    const company = await getCompanyConfig();
    const overtimeNumber = overtime.id?.slice(0, 8).toUpperCase() || 'BH';
    
    let techName = 'Técnico';
    if (overtime.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name').eq('id', overtime.technician_id).maybeSingle();
      if (tech) techName = tech.full_name || techName;
    }
    
    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }
    
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Banco de Horas #${overtimeNumber}</title>
<style>
@page { margin: 15mm; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.5; }
.header { display: flex; align-items: center; border-bottom: 3px solid ${company.color}; padding-bottom: 15px; margin-bottom: 25px; }
.logo { width: 80px; }
.logo img { max-width: 70px; max-height: 55px; }
.company-info { flex: 1; padding: 0 20px; }
.company-info h1 { font-size: 18px; color: ${company.color}; margin-bottom: 5px; }
.company-info p { font-size: 9px; color: #555; margin: 2px 0; }
.ot-badge { text-align: right; }
.ot-box { background: #f59e0b; color: #fff; padding: 12px 18px; border-radius: 8px; display: inline-block; }
.ot-box small { font-size: 8px; display: block; opacity: 0.9; }
.ot-box strong { font-size: 16px; }
.section { margin-bottom: 20px; }
.section-title { background: #f5f5f5; border-left: 4px solid #f59e0b; padding: 8px 12px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table td { padding: 8px; border-bottom: 1px solid #eee; }
.data-table .label { color: #666; width: 120px; font-weight: 600; }
.hours-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
.hours-box span { font-size: 12px; color: #92400e; }
.hours-box strong { font-size: 32px; color: #d97706; display: block; margin-top: 5px; }
.signatures { display: flex; justify-content: space-around; margin-top: 40px; }
.sig-col { text-align: center; width: 40%; }
.sig-line { border-top: 1px solid #333; margin: 40px 0 8px; }
.sig-name { font-weight: 700; font-size: 11px; }
.sig-role { font-size: 9px; color: #666; }
.footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 9px; color: #888; }
</style>
</head>
<body>
<div class="header">
  <div class="logo">${company.logo ? `<img src="${company.logo}" />` : ''}</div>
  <div class="company-info">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p><strong>CNPJ:</strong> ${company.cnpj}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
  </div>
  <div class="ot-badge">
    <div class="ot-box">
      <small>BANCO DE HORAS</small>
      <strong>#${overtimeNumber}</strong>
    </div>
    <div style="font-size:9px;color:#666;margin-top:8px;">${formatDate(overtime.date || overtime.created_at)}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Informações do Registro</div>
  <table class="data-table">
    <tr><td class="label">Técnico:</td><td><b>${techName}</b></td></tr>
    <tr><td class="label">Cliente:</td><td>${overtime.clients?.name || overtime.client_name || '-'}</td></tr>
    <tr><td class="label">Data:</td><td>${formatDate(overtime.date || overtime.created_at)}</td></tr>
    <tr><td class="label">Tipo:</td><td>${overtime.type === 'extra' ? 'Hora Extra' : overtime.type === 'compensation' ? 'Compensação' : overtime.type || '-'}</td></tr>
  </table>
</div>

<div class="hours-box">
  <span>TOTAL DE HORAS</span>
  <strong>${overtime.hours || overtime.total_hours || 0}h</strong>
</div>

${overtime.description || overtime.notes ? `
<div class="section">
  <div class="section-title">Descrição / Justificativa</div>
  <p style="padding:15px;background:#fafafa;border-radius:6px;line-height:1.7;">${overtime.description || overtime.notes}</p>
</div>
` : ''}

<div class="signatures">
  <div class="sig-col">
    <div class="sig-line"></div>
    <div class="sig-name">${techName}</div>
    <div class="sig-role">Técnico</div>
  </div>
  <div class="sig-col">
    <div class="sig-line"></div>
    <div class="sig-name">Responsável</div>
    <div class="sig-role">Aprovação</div>
  </div>
</div>

<div class="footer">
  Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • Sistema Chamei
</div>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}
