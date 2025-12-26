import { supabase } from '../lib/supabase';

// Formatar data/hora - SEMPRE extrai direto da string, sem conversão de timezone
const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  try {
    // Remove Z ou +00:00 do final se existir (ignora timezone)
    let cleanDate = dateString.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '').replace(/\.\d+$/, '');
    
    // Se tem T, extrai data e hora diretamente
    if (cleanDate.includes('T')) {
      const [datePart, timePart] = cleanDate.split('T');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = (timePart || '00:00').split(':');
      return `${day}/${month}/${year} ${hour}:${minute}`;
    }
    
    // Se não tem T, tenta parsear como data simples
    const [year, month, day] = cleanDate.split('-');
    return `${day}/${month}/${year}`;
  } catch { return dateString; }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch { return dateString; }
};

const formatOrderId = (id: string, dateString: string) => {
  if (!id) return 'OS';
  if (!dateString) return id.slice(0, 6).toUpperCase();
  try {
    const d = new Date(dateString);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${id.slice(0, 4).toUpperCase()}`;
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


// ============================================
// GERAR PDF DA ORDEM DE SERVIÇO - TUDO EM UMA PÁGINA
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
    const report = order.execution_report || order.description || 'Nenhuma observação registrada.';
    const color = company.color || '#1e40af';

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>OS #${osNumber}</title>
<style>
/* PÁGINA ÚNICA - SEM QUEBRAS */
@page { size: auto; margin: 8mm; }
@media print {
  html, body { height: auto !important; }
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .no-print { display: none !important; }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 10px; color: #333; line-height: 1.3; background: white; }

/* HEADER */
.header { display: flex; align-items: center; border-bottom: 3px solid ${color}; padding-bottom: 10px; margin-bottom: 12px; }
.header-logo img { max-width: 60px; max-height: 45px; }
.header-company { flex: 1; padding: 0 12px; }
.header-company h1 { font-size: 14px; color: ${color}; margin-bottom: 2px; }
.header-company p { font-size: 8px; color: #555; margin: 1px 0; }
.os-box { background: ${color}; color: white; padding: 8px 12px; border-radius: 5px; display: inline-block; text-align: center; }
.os-box small { font-size: 7px; display: block; opacity: 0.9; }
.os-box strong { font-size: 12px; }
.os-date { font-size: 8px; color: #666; margin-top: 4px; text-align: right; }

/* GRID 2 COLUNAS */
.grid-2 { display: flex; gap: 12px; margin-bottom: 10px; }
.grid-2 > div { flex: 1; }

/* SECTIONS */
.section { margin-bottom: 10px; }
.section-title { background: #f0f0f0; border-left: 3px solid ${color}; padding: 4px 8px; font-size: 9px; font-weight: bold; margin-bottom: 6px; }

/* DATA */
.data-box { background: #fafafa; border-radius: 4px; padding: 8px; }
.data-row { display: flex; padding: 3px 0; border-bottom: 1px solid #eee; font-size: 9px; }
.data-row:last-child { border-bottom: none; }
.data-label { width: 65px; color: #666; font-weight: 600; }

/* CHECKLIST */
.checklist { display: flex; flex-wrap: wrap; gap: 4px; }
.check-item { width: calc(50% - 2px); display: flex; align-items: center; gap: 4px; padding: 3px 6px; background: #f9f9f9; border-radius: 3px; font-size: 8px; }
.check-done { color: #16a34a; }
.check-pending { color: #999; }

/* REPORT */
.report-box { background: #fafafa; border: 1px solid #e0e0e0; padding: 8px; border-radius: 4px; font-size: 9px; line-height: 1.5; }

/* FOTOS - SEM CAIXA, SÓ IMAGEM COM CANTOS ARREDONDADOS */
.photos-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.photos-grid img { 
  width: 120px; 
  height: 120px; 
  object-fit: contain; 
  border-radius: 15px;
}

/* ASSINATURAS */
.signatures { display: flex; justify-content: space-around; margin-top: 15px; }
.sig-col { text-align: center; width: 40%; }
.sig-img { height: 35px; display: flex; align-items: flex-end; justify-content: center; }
.sig-img img { max-height: 35px; max-width: 100px; }
.sig-line { border-top: 1px solid #333; margin: 4px 0; }
.sig-name { font-weight: bold; font-size: 9px; }
.sig-role { font-size: 8px; color: #666; }
.sig-doc { font-size: 7px; color: #999; }

/* FOOTER */
.footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #ddd; text-align: center; font-size: 7px; color: #999; }

/* BOTÃO IMPRIMIR */
.print-btn { position: fixed; top: 10px; right: 10px; background: ${color}; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; cursor: pointer; z-index: 1000; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">🖨️ Salvar PDF</button>

<!-- HEADER -->
<div class="header">
  <div class="header-logo">
    ${company.logo ? `<img src="${company.logo}">` : ''}
  </div>
  <div class="header-company">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
  </div>
  <div>
    <div class="os-box">
      <small>ORDEM DE SERVIÇO</small>
      <strong>#${osNumber}</strong>
    </div>
    <div class="os-date">${formatDate(order.created_at)}</div>
  </div>
</div>

<!-- DADOS EM 2 COLUNAS -->
<div class="grid-2">
  <div class="section">
    <div class="section-title">DADOS DO CLIENTE</div>
    <div class="data-box">
      <div class="data-row"><span class="data-label">Cliente:</span><span><b>${order.clients?.name || '-'}</b></span></div>
      <div class="data-row"><span class="data-label">CNPJ/CPF:</span><span>${order.clients?.cnpj_cpf || '-'}</span></div>
      <div class="data-row"><span class="data-label">Endereço:</span><span>${order.clients?.address || '-'}</span></div>
      <div class="data-row"><span class="data-label">Contato:</span><span>${order.clients?.phone || '-'}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">DADOS DA EXECUÇÃO</div>
    <div class="data-box">
      <div class="data-row"><span class="data-label">Serviço:</span><span><b>${order.title || '-'}</b></span></div>
      <div class="data-row"><span class="data-label">Técnico:</span><span>${techName}</span></div>
      <div class="data-row"><span class="data-label">Início:</span><span>${formatDateTime(order.checkin_at)}</span></div>
      <div class="data-row"><span class="data-label">Término:</span><span>${formatDateTime(order.completed_at)}</span></div>
    </div>
  </div>
</div>

<!-- CHECKLIST -->
${tasks && tasks.length > 0 ? `
<div class="section">
  <div class="section-title">CHECKLIST</div>
  <div class="checklist">
    ${tasks.map((t: any) => `<div class="check-item ${t.is_completed ? 'check-done' : 'check-pending'}">${t.is_completed ? '✓' : '○'} ${t.title}</div>`).join('')}
  </div>
</div>
` : ''}

<!-- RELATÓRIO -->
<div class="section">
  <div class="section-title">RELATÓRIO TÉCNICO</div>
  <div class="report-box">${report.replace(/\n/g, '<br>')}</div>
</div>

<!-- FOTOS - SEM CAIXA, SÓ IMAGEM ARREDONDADA -->
${photos.length > 0 ? `
<div class="section">
  <div class="section-title">FOTOS (${photos.length})</div>
  <div class="photos-grid">
    ${photos.map((p: string) => `<img src="${p}">`).join('')}
  </div>
</div>
` : ''}

<!-- ASSINATURAS -->
<div class="signatures">
  <div class="sig-col">
    <div class="sig-img">${techSig ? `<img src="${techSig}">` : ''}</div>
    <div class="sig-line"></div>
    <div class="sig-name">${techName}</div>
    <div class="sig-role">Técnico Responsável</div>
    ${techDoc ? `<div class="sig-doc">CPF: ${techDoc}</div>` : ''}
  </div>
  <div class="sig-col">
    <div class="sig-img">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
    <div class="sig-line"></div>
    <div class="sig-name">${order.signer_name || 'Responsável'}</div>
    <div class="sig-role">Responsável pelo Cliente</div>
    ${order.signer_doc ? `<div class="sig-doc">CPF: ${order.signer_doc}</div>` : ''}
  </div>
</div>

<div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>

</body>
</html>`;

    w.document.write(html);
    w.document.close();

  } catch (error) {
    console.error('Erro PDF:', error);
    alert('Erro ao gerar PDF');
  }
}


// ============================================
// GERAR PDF DE ORÇAMENTO
// ============================================
export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    const quoteNumber = quote.id?.slice(0, 8).toUpperCase() || 'ORC';
    const color = company.color || '#1e40af';

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups'); return; }

    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Orçamento #${quoteNumber}</title>
<style>
@page { size: auto; margin: 8mm; }
@media print { body { -webkit-print-color-adjust: exact !important; } .no-print { display: none !important; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
.header { display: flex; align-items: center; border-bottom: 3px solid ${color}; padding-bottom: 10px; margin-bottom: 12px; }
.header-logo img { max-width: 60px; max-height: 45px; }
.header-company { flex: 1; padding: 0 12px; }
.header-company h1 { font-size: 14px; color: ${color}; }
.header-company p { font-size: 8px; color: #555; }
.section { margin-bottom: 10px; }
.section-title { background: #f0f0f0; border-left: 3px solid ${color}; padding: 4px 8px; font-size: 9px; font-weight: bold; margin-bottom: 6px; }
.data-box { background: #fafafa; border-radius: 4px; padding: 8px; }
.data-row { display: flex; padding: 3px 0; border-bottom: 1px solid #eee; font-size: 9px; }
.data-label { width: 65px; color: #666; font-weight: 600; }
.total-box { background: ${color}; color: white; padding: 12px; border-radius: 6px; text-align: right; margin-top: 15px; }
.total-box span { font-size: 10px; opacity: 0.9; }
.total-box strong { font-size: 18px; display: block; margin-top: 3px; }
.footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #ddd; text-align: center; font-size: 7px; color: #999; }
.print-btn { position: fixed; top: 10px; right: 10px; background: ${color}; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Salvar PDF</button>
<div class="header">
  <div class="header-logo">${company.logo ? `<img src="${company.logo}">` : ''}</div>
  <div class="header-company">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
  </div>
  <div>
    <div style="background:${color};color:white;padding:8px 12px;border-radius:5px;text-align:center;">
      <small style="font-size:7px;display:block;">ORÇAMENTO</small>
      <strong style="font-size:12px;">#${quoteNumber}</strong>
    </div>
    <div style="font-size:8px;color:#666;margin-top:4px;text-align:right;">${formatDate(quote.created_at)}</div>
  </div>
</div>
<div class="section">
  <div class="section-title">DADOS DO CLIENTE</div>
  <div class="data-box">
    <div class="data-row"><span class="data-label">Cliente:</span><span><b>${quote.clients?.name || '-'}</b></span></div>
    <div class="data-row"><span class="data-label">CNPJ/CPF:</span><span>${quote.clients?.cnpj_cpf || '-'}</span></div>
    <div class="data-row"><span class="data-label">Contato:</span><span>${quote.clients?.phone || '-'}</span></div>
  </div>
</div>
<div class="section">
  <div class="section-title">DESCRIÇÃO DO SERVIÇO</div>
  <div class="data-box"><p style="line-height:1.4;">${quote.description || quote.title || 'Serviço técnico'}</p></div>
</div>
<div class="total-box">
  <span>VALOR TOTAL</span>
  <strong>R$ ${(quote.total_value || quote.value || 0).toFixed(2)}</strong>
</div>
<div class="footer">Orçamento válido por 30 dias • Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
</body></html>`);
    w.document.close();
  } catch (error) { console.error('Erro:', error); alert('Erro ao gerar PDF'); }
}

// ============================================
// GERAR PDF DE BANCO DE HORAS
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
    const color = company.color || '#1e40af';

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups'); return; }

    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Banco de Horas #${overtimeNumber}</title>
<style>
@page { size: auto; margin: 8mm; }
@media print { body { -webkit-print-color-adjust: exact !important; } .no-print { display: none !important; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
.header { display: flex; align-items: center; border-bottom: 3px solid ${color}; padding-bottom: 10px; margin-bottom: 12px; }
.section { margin-bottom: 10px; }
.section-title { background: #f0f0f0; border-left: 3px solid #f59e0b; padding: 4px 8px; font-size: 9px; font-weight: bold; margin-bottom: 6px; }
.data-box { background: #fafafa; border-radius: 4px; padding: 8px; }
.data-row { display: flex; padding: 3px 0; border-bottom: 1px solid #eee; font-size: 9px; }
.data-label { width: 65px; color: #666; font-weight: 600; }
.hours-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; text-align: center; margin: 15px 0; }
.hours-box span { font-size: 10px; color: #92400e; }
.hours-box strong { font-size: 24px; color: #d97706; display: block; margin-top: 4px; }
.sig-grid { display: flex; justify-content: space-around; margin-top: 30px; }
.sig-col { text-align: center; width: 35%; }
.sig-line { border-top: 1px solid #333; margin: 30px 0 6px; }
.footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #ddd; text-align: center; font-size: 7px; color: #999; }
.print-btn { position: fixed; top: 10px; right: 10px; background: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Salvar PDF</button>
<div class="header">
  <div style="width:60px;">${company.logo ? `<img src="${company.logo}" style="max-width:60px;max-height:45px;">` : ''}</div>
  <div style="flex:1;padding:0 12px;">
    <h1 style="font-size:14px;color:${color};">${company.name}</h1>
    ${company.cnpj ? `<p style="font-size:8px;color:#555;"><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
  </div>
  <div>
    <div style="background:#f59e0b;color:white;padding:8px 12px;border-radius:5px;text-align:center;">
      <small style="font-size:7px;display:block;">BANCO DE HORAS</small>
      <strong style="font-size:12px;">#${overtimeNumber}</strong>
    </div>
  </div>
</div>
<div class="section">
  <div class="section-title">INFORMAÇÕES</div>
  <div class="data-box">
    <div class="data-row"><span class="data-label">Técnico:</span><span><b>${techName}</b></span></div>
    <div class="data-row"><span class="data-label">Cliente:</span><span>${overtime.clients?.name || '-'}</span></div>
    <div class="data-row"><span class="data-label">Data:</span><span>${formatDate(overtime.date || overtime.created_at)}</span></div>
    <div class="data-row"><span class="data-label">Tipo:</span><span>${overtime.type === 'extra' ? 'Hora Extra' : 'Compensação'}</span></div>
  </div>
</div>
<div class="hours-box">
  <span>TOTAL DE HORAS</span>
  <strong>${overtime.hours || overtime.total_hours || 0}h</strong>
</div>
${overtime.description ? `<div class="section"><div class="section-title">DESCRIÇÃO</div><div class="data-box"><p style="line-height:1.4;">${overtime.description}</p></div></div>` : ''}
<div class="sig-grid">
  <div class="sig-col"><div class="sig-line"></div><div style="font-weight:bold;font-size:9px;">${techName}</div><div style="font-size:8px;color:#666;">Técnico</div></div>
  <div class="sig-col"><div class="sig-line"></div><div style="font-weight:bold;font-size:9px;">Responsável</div><div style="font-size:8px;color:#666;">Aprovação</div></div>
</div>
<div class="footer">Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
</body></html>`);
    w.document.close();
  } catch (error) { console.error('Erro:', error); alert('Erro ao gerar PDF'); }
}
