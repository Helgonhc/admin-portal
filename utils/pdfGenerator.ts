import { supabase } from '../lib/supabase';

// Formatar data/hora - trata datas locais sem timezone
const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  try {
    // Se não tem Z ou offset, é data local - extrair direto
    if (dateString.includes('T') && !dateString.includes('Z') && !dateString.includes('+')) {
      const [datePart, timePart] = dateString.split('T');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = (timePart || '00:00').split(':');
      return `${day}/${month}/${year} ${hour}:${minute}`;
    }
    return new Date(dateString).toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
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
// GERAR PDF DA ORDEM DE SERVIÇO
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

    // Abrir nova janela
    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>OS #${osNumber} - ${company.name}</title>
<style>
@page { size: A4; margin: 10mm 12mm; }
@media print {
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .no-print { display: none !important; }
  .page-break { page-break-before: always; }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #333; line-height: 1.4; background: #f5f5f5; }
.container { max-width: 210mm; margin: 0 auto; background: white; }
.page { padding: 8mm 10mm; background: white; min-height: auto; }

/* HEADER */
.header { display: flex; align-items: center; border-bottom: 3px solid ${color}; padding-bottom: 12px; margin-bottom: 15px; }
.header-logo { width: 70px; }
.header-logo img { max-width: 65px; max-height: 50px; }
.header-company { flex: 1; padding: 0 15px; }
.header-company h1 { font-size: 16px; color: ${color}; margin-bottom: 3px; }
.header-company p { font-size: 9px; color: #555; margin: 1px 0; }
.header-os { text-align: right; }
.os-box { background: ${color}; color: white; padding: 10px 15px; border-radius: 6px; display: inline-block; }
.os-box small { font-size: 8px; display: block; opacity: 0.9; }
.os-box strong { font-size: 14px; }
.os-date { font-size: 9px; color: #666; margin-top: 6px; }

/* SECTIONS */
.section { margin-bottom: 12px; }
.section-title { background: #f5f5f5; border-left: 3px solid ${color}; padding: 6px 10px; font-size: 10px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }

/* GRID */
.grid-2 { display: flex; gap: 15px; margin-bottom: 12px; }
.grid-2 > div { flex: 1; }

/* DATA BOX */
.data-box { background: #fafafa; border-radius: 6px; padding: 10px; }
.data-row { display: flex; padding: 5px 0; border-bottom: 1px solid #eee; font-size: 10px; }
.data-row:last-child { border-bottom: none; }
.data-label { width: 75px; color: #666; font-weight: 600; }
.data-value { flex: 1; color: #222; }

/* CHECKLIST */
.checklist { display: flex; flex-wrap: wrap; gap: 5px; }
.check-item { width: calc(50% - 3px); display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: #f9fafb; border-radius: 4px; font-size: 9px; }
.check-icon { width: 14px; height: 14px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; }
.check-done .check-icon { background: #dcfce7; color: #16a34a; }
.check-pending .check-icon { background: #f3f4f6; color: #9ca3af; }

/* REPORT */
.report-box { background: #fafafa; border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; font-size: 10px; line-height: 1.6; min-height: 50px; }

/* PHOTOS */
.photos-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-start; }
.photo-item img { width: 150px; height: 150px; object-fit: contain; border-radius: 12px; background: #f9f9f9; }

/* SIGNATURES */
.signatures { display: flex; justify-content: space-around; margin-top: 25px; padding: 0 20px; }
.sig-col { text-align: center; width: 45%; }
.sig-img { height: 40px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px; }
.sig-img img { max-height: 40px; max-width: 120px; }
.sig-line { border-top: 1px solid #333; margin: 5px 0; }
.sig-name { font-weight: bold; font-size: 10px; }
.sig-role { font-size: 9px; color: #666; }
.sig-doc { font-size: 8px; color: #999; margin-top: 2px; }

/* FOOTER */
.footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 8px; color: #999; }

/* PRINT BUTTON */
.print-btn { position: fixed; top: 15px; right: 15px; background: ${color}; color: white; border: none; padding: 12px 25px; border-radius: 8px; font-size: 14px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 1000; }
.print-btn:hover { opacity: 0.9; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>

<div class="container">
  <!-- PÁGINA 1 -->
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="header-logo">
        ${company.logo ? `<img src="${company.logo}" alt="Logo">` : ''}
      </div>
      <div class="header-company">
        <h1>${company.name}</h1>
        ${company.cnpj ? `<p><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
        ${company.address ? `<p>${company.address}</p>` : ''}
        <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
      </div>
      <div class="header-os">
        <div class="os-box">
          <small>ORDEM DE SERVIÇO</small>
          <strong>#${osNumber}</strong>
        </div>
        <div class="os-date">${formatDate(order.created_at)}</div>
      </div>
    </div>

    <!-- Dados em 2 colunas -->
    <div class="grid-2">
      <div class="section">
        <div class="section-title">Dados do Cliente</div>
        <div class="data-box">
          <div class="data-row"><span class="data-label">Cliente:</span><span class="data-value"><b>${order.clients?.name || '-'}</b></span></div>
          <div class="data-row"><span class="data-label">CNPJ/CPF:</span><span class="data-value">${order.clients?.cnpj_cpf || '-'}</span></div>
          <div class="data-row"><span class="data-label">Endereço:</span><span class="data-value">${order.clients?.address || '-'}</span></div>
          <div class="data-row"><span class="data-label">Contato:</span><span class="data-value">${order.clients?.phone || '-'}</span></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Dados da Execução</div>
        <div class="data-box">
          <div class="data-row"><span class="data-label">Serviço:</span><span class="data-value"><b>${order.title || '-'}</b></span></div>
          <div class="data-row"><span class="data-label">Técnico:</span><span class="data-value">${techName}</span></div>
          <div class="data-row"><span class="data-label">Início:</span><span class="data-value">${formatDateTime(order.checkin_at)}</span></div>
          <div class="data-row"><span class="data-label">Término:</span><span class="data-value">${formatDateTime(order.completed_at)}</span></div>
        </div>
      </div>
    </div>

    <!-- Checklist -->
    ${tasks && tasks.length > 0 ? `
    <div class="section">
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

    <!-- Relatório -->
    <div class="section">
      <div class="section-title">Relatório Técnico / Observações</div>
      <div class="report-box">${report.replace(/\n/g, '<br>')}</div>
    </div>

    ${photos.length === 0 ? `
    <!-- Assinaturas (se não tem fotos) -->
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
    ` : ''}
  </div>

  ${photos.length > 0 ? `
  <!-- PÁGINA 2: FOTOS + ASSINATURAS -->
  <div class="page page-break">
    <div class="section">
      <div class="section-title">Registro Fotográfico (${photos.length} foto${photos.length > 1 ? 's' : ''})</div>
      <div class="photos-grid">
        ${photos.map((p: string, i: number) => `<div class="photo-item"><img src="${p}" alt="Foto ${i+1}"></div>`).join('')}
      </div>
    </div>

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
  </div>
  ` : ''}
</div>

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
@page { size: A4; margin: 12mm; }
@media print { body { -webkit-print-color-adjust: exact !important; } .no-print { display: none !important; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #333; background: #f5f5f5; }
.container { max-width: 210mm; margin: 0 auto; background: white; padding: 10mm; }
.header { display: flex; align-items: center; border-bottom: 3px solid ${color}; padding-bottom: 12px; margin-bottom: 20px; }
.header-logo img { max-width: 65px; max-height: 50px; }
.header-company { flex: 1; padding: 0 15px; }
.header-company h1 { font-size: 16px; color: ${color}; }
.header-company p { font-size: 9px; color: #555; }
.section { margin-bottom: 15px; }
.section-title { background: #f5f5f5; border-left: 3px solid ${color}; padding: 6px 10px; font-size: 10px; font-weight: bold; margin-bottom: 10px; }
.data-box { background: #fafafa; border-radius: 6px; padding: 10px; }
.data-row { display: flex; padding: 5px 0; border-bottom: 1px solid #eee; font-size: 10px; }
.data-label { width: 80px; color: #666; font-weight: 600; }
.total-box { background: ${color}; color: white; padding: 15px; border-radius: 8px; text-align: right; margin-top: 20px; }
.total-box span { font-size: 12px; opacity: 0.9; }
.total-box strong { font-size: 22px; display: block; margin-top: 5px; }
.footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 8px; color: #999; }
.print-btn { position: fixed; top: 15px; right: 15px; background: ${color}; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir</button>
<div class="container">
  <div class="header">
    <div class="header-logo">${company.logo ? `<img src="${company.logo}">` : ''}</div>
    <div class="header-company">
      <h1>${company.name}</h1>
      ${company.cnpj ? `<p><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
      <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
    </div>
    <div style="text-align:right;">
      <div style="background:${color};color:white;padding:10px 15px;border-radius:6px;display:inline-block;">
        <small style="font-size:8px;display:block;">ORÇAMENTO</small>
        <strong style="font-size:14px;">#${quoteNumber}</strong>
      </div>
      <div style="font-size:9px;color:#666;margin-top:6px;">${formatDate(quote.created_at)}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="data-box">
      <div class="data-row"><span class="data-label">Cliente:</span><span><b>${quote.clients?.name || '-'}</b></span></div>
      <div class="data-row"><span class="data-label">CNPJ/CPF:</span><span>${quote.clients?.cnpj_cpf || '-'}</span></div>
      <div class="data-row"><span class="data-label">Contato:</span><span>${quote.clients?.phone || '-'}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Descrição do Serviço</div>
    <div class="data-box"><p style="line-height:1.5;">${quote.description || quote.title || 'Serviço técnico'}</p></div>
  </div>
  <div class="total-box">
    <span>VALOR TOTAL</span>
    <strong>R$ ${(quote.total_value || quote.value || 0).toFixed(2)}</strong>
  </div>
  <div class="footer">Orçamento válido por 30 dias • Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
</div>
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
@page { size: A4; margin: 12mm; }
@media print { body { -webkit-print-color-adjust: exact !important; } .no-print { display: none !important; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #333; background: #f5f5f5; }
.container { max-width: 210mm; margin: 0 auto; background: white; padding: 10mm; }
.header { display: flex; align-items: center; border-bottom: 3px solid ${color}; padding-bottom: 12px; margin-bottom: 20px; }
.section { margin-bottom: 15px; }
.section-title { background: #f5f5f5; border-left: 3px solid #f59e0b; padding: 6px 10px; font-size: 10px; font-weight: bold; margin-bottom: 10px; }
.data-box { background: #fafafa; border-radius: 6px; padding: 10px; }
.data-row { display: flex; padding: 5px 0; border-bottom: 1px solid #eee; font-size: 10px; }
.data-label { width: 80px; color: #666; font-weight: 600; }
.hours-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
.hours-box span { font-size: 12px; color: #92400e; }
.hours-box strong { font-size: 28px; color: #d97706; display: block; margin-top: 5px; }
.sig-grid { display: flex; justify-content: space-around; margin-top: 40px; }
.sig-col { text-align: center; width: 40%; }
.sig-line { border-top: 1px solid #333; margin: 40px 0 8px; }
.footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 8px; color: #999; }
.print-btn { position: fixed; top: 15px; right: 15px; background: #f59e0b; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir</button>
<div class="container">
  <div class="header">
    <div style="width:70px;">${company.logo ? `<img src="${company.logo}" style="max-width:65px;max-height:50px;">` : ''}</div>
    <div style="flex:1;padding:0 15px;">
      <h1 style="font-size:16px;color:${color};">${company.name}</h1>
      ${company.cnpj ? `<p style="font-size:9px;color:#555;"><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="background:#f59e0b;color:white;padding:10px 15px;border-radius:6px;display:inline-block;">
        <small style="font-size:8px;display:block;">BANCO DE HORAS</small>
        <strong style="font-size:14px;">#${overtimeNumber}</strong>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Informações do Registro</div>
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
  ${overtime.description ? `<div class="section"><div class="section-title">Descrição</div><div class="data-box"><p style="line-height:1.5;">${overtime.description}</p></div></div>` : ''}
  <div class="sig-grid">
    <div class="sig-col"><div class="sig-line"></div><div style="font-weight:bold;">${techName}</div><div style="font-size:9px;color:#666;">Técnico</div></div>
    <div class="sig-col"><div class="sig-line"></div><div style="font-weight:bold;">Responsável</div><div style="font-size:9px;color:#666;">Aprovação</div></div>
  </div>
  <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
</div>
</body></html>`);
    w.document.close();
  } catch (error) { console.error('Erro:', error); alert('Erro ao gerar PDF'); }
}
