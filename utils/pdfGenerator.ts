import { supabase } from '../lib/supabase';

const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatOrderId = (id: string, dateString: string) => {
  if (!dateString) return id.slice(0, 6).toUpperCase();
  const d = new Date(dateString);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${id.slice(0, 4).toUpperCase()}`;
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
    color: config?.primary_color || '#2563eb'
  };
}

export async function generateServiceOrderPDF(order: any) {
  try {
    const company = await getCompanyConfig();
    let technicianName = 'Técnico Responsável', technicianSignature = '', technicianDoc = '';
    
    if (order.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name, signature_url, cpf').eq('id', order.technician_id).maybeSingle();
      if (tech) { technicianName = tech.full_name || technicianName; technicianSignature = tech.signature_url || ''; technicianDoc = tech.cpf || ''; }
    }

    const { data: tasks } = await supabase.from('order_tasks').select('*').eq('order_id', order.id).order('created_at');
    const osNumber = formatOrderId(order.id, order.created_at);
    const photos = order.photos_url || order.photos || [];
    const report = order.execution_report || order.description || '';

    const html = buildOrderPDF(company, order, osNumber, technicianName, technicianSignature, technicianDoc, tasks || [], report, photos);
    openPrint(html);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}

function buildOrderPDF(company: any, order: any, osNumber: string, techName: string, techSig: string, techDoc: string, tasks: any[], report: string, photos: string[]) {
  const c = company.color;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OS #${osNumber}</title>
<style>
@page{margin:15mm 12mm;size:A4}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;color:#333;line-height:1.4}
.header{display:flex;align-items:center;border-bottom:3px solid ${c};padding-bottom:10px;margin-bottom:12px}
.logo{width:60px;height:60px;margin-right:12px}
.logo img{max-width:100%;max-height:100%;object-fit:contain}
.company{flex:1}
.company h1{font-size:14pt;color:${c};margin-bottom:2px}
.company p{font-size:7pt;color:#666;margin:1px 0}
.os-badge{background:${c};color:#fff;padding:8px 14px;border-radius:6px;text-align:center}
.os-badge small{font-size:6pt;display:block;opacity:.8}
.os-badge strong{font-size:12pt}
.os-date{font-size:7pt;color:#666;margin-top:4px;text-align:center}
.grid{display:flex;gap:12px;margin-bottom:10px;page-break-inside:avoid}
.grid .box{flex:1;background:#f8f9fa;border:1px solid #e9ecef;border-radius:6px;padding:10px}
.box-title{font-size:8pt;font-weight:700;color:${c};border-bottom:1px solid #dee2e6;padding-bottom:4px;margin-bottom:6px}
.box p{font-size:8pt;margin:3px 0}
.box p strong{color:#222}
.section{margin-bottom:10px}
.section-title{background:linear-gradient(90deg,${c},${c}dd);color:#fff;padding:6px 10px;font-size:9pt;font-weight:600;border-radius:4px;margin-bottom:8px}
.checklist{columns:2;column-gap:15px}
.check-item{font-size:8pt;padding:3px 0;break-inside:avoid}
.check-done{color:#16a34a}
.check-done::before{content:"✓ ";font-weight:700}
.check-pending{color:#9ca3af}
.check-pending::before{content:"○ "}
.report{background:#fff;border:1px solid #ddd;border-left:3px solid ${c};padding:12px;font-size:9pt;line-height:1.6;white-space:pre-wrap;min-height:40px}
.photos{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.photo{aspect-ratio:1;border-radius:16px;overflow:hidden;border:1px solid #ddd;background:#f5f5f5;display:flex;align-items:center;justify-content:center}
.photo img{max-width:100%;max-height:100%;object-fit:contain;border-radius:14px}
.signatures{display:flex;margin-top:20px;page-break-inside:avoid}
.sig{flex:1;text-align:center;padding:0 20px}
.sig-img{height:40px;margin-bottom:-5px}
.sig-line{border-top:1px solid #333;margin:5px 0}
.sig-name{font-size:8pt;font-weight:600}
.sig-role{font-size:7pt;color:#666}
.sig-doc{font-size:6pt;color:#999}
.footer{margin-top:15px;padding-top:8px;border-top:1px solid #ddd;text-align:center;font-size:6pt;color:#999}
</style></head><body>

<div class="header">
  <div class="logo">${company.logo ? `<img src="${company.logo}"/>` : ''}</div>
  <div class="company">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p>CNPJ: ${company.cnpj}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
  </div>
  <div>
    <div class="os-badge"><small>ORDEM DE SERVIÇO</small><strong>#${osNumber}</strong></div>
    <div class="os-date">${new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
  </div>
</div>

<div class="grid">
  <div class="box">
    <div class="box-title">👤 CLIENTE</div>
    <p><strong>${order.clients?.name || '-'}</strong></p>
    <p>${order.clients?.cnpj || order.clients?.cnpj_cpf || '-'}</p>
    <p>${order.clients?.address || '-'}</p>
    <p>${order.clients?.phone || '-'}</p>
  </div>
  <div class="box">
    <div class="box-title">🔧 SERVIÇO</div>
    <p><strong>${order.title}</strong></p>
    <p>Técnico: ${techName}</p>
    <p>Início: ${formatDateTime(order.checkin_at)}</p>
    <p>Término: ${formatDateTime(order.completed_at)}</p>
  </div>
</div>

${tasks.length > 0 ? `
<div class="section">
  <div class="section-title">✅ CHECKLIST</div>
  <div class="checklist">${tasks.map(t => `<div class="check-item ${t.is_completed ? 'check-done' : 'check-pending'}">${t.title}</div>`).join('')}</div>
</div>` : ''}

<div class="section">
  <div class="section-title">📝 RELATÓRIO TÉCNICO</div>
  <div class="report">${report || 'Nenhuma observação registrada.'}</div>
</div>

${photos.length > 0 ? `
<div class="section">
  <div class="section-title">📷 FOTOS (${photos.length})</div>
  <div class="photos">${photos.map(p => `<div class="photo"><img src="${p}"/></div>`).join('')}</div>
</div>` : ''}

<div class="signatures">
  <div class="sig">
    ${techSig ? `<img src="${techSig}" class="sig-img"/>` : '<div style="height:30px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${techName}</div>
    <div class="sig-role">Técnico Responsável</div>
    ${techDoc ? `<div class="sig-doc">CPF: ${techDoc}</div>` : ''}
  </div>
  <div class="sig">
    ${order.signature_url ? `<img src="${order.signature_url}" class="sig-img"/>` : '<div style="height:30px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${order.signer_name || 'Responsável'}</div>
    <div class="sig-role">Cliente</div>
    ${order.signer_doc ? `<div class="sig-doc">CPF: ${order.signer_doc}</div>` : ''}
  </div>
</div>

<div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;
}


export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    let clientData = quote.clients;
    if (!clientData && quote.client_id) {
      const { data } = await supabase.from('clients').select('*').eq('id', quote.client_id).single();
      clientData = data;
    }
    const quoteNumber = `ORC-${new Date(quote.created_at).getFullYear()}${String(new Date(quote.created_at).getMonth() + 1).padStart(2, '0')}-${quote.id.slice(0, 4).toUpperCase()}`;
    const html = buildQuotePDF(company, quote, clientData, quoteNumber);
    openPrint(html);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}

function buildQuotePDF(company: any, quote: any, client: any, quoteNumber: string) {
  const c = company.color;
  const items = quote.items || [];
  const total = quote.total || items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
  const validUntil = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('pt-BR') : '-';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orçamento #${quoteNumber}</title>
<style>
@page{margin:15mm 12mm;size:A4}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;color:#333;line-height:1.4}
.header{display:flex;align-items:center;border-bottom:3px solid ${c};padding-bottom:10px;margin-bottom:15px}
.logo{width:60px;height:60px;margin-right:12px}
.logo img{max-width:100%;max-height:100%;object-fit:contain}
.company{flex:1}
.company h1{font-size:14pt;color:${c};margin-bottom:2px}
.company p{font-size:7pt;color:#666;margin:1px 0}
.badge{background:${c};color:#fff;padding:8px 14px;border-radius:6px;text-align:center}
.badge small{font-size:6pt;display:block;opacity:.8}
.badge strong{font-size:12pt}
.grid{display:flex;gap:12px;margin-bottom:12px}
.grid .box{flex:1;background:#f8f9fa;border:1px solid #e9ecef;border-radius:6px;padding:10px}
.box-title{font-size:8pt;font-weight:700;color:${c};border-bottom:1px solid #dee2e6;padding-bottom:4px;margin-bottom:6px}
.box p{font-size:8pt;margin:3px 0}
table{width:100%;border-collapse:collapse;margin:10px 0}
th{background:${c};color:#fff;padding:8px;text-align:left;font-size:8pt}
td{padding:8px;border-bottom:1px solid #eee;font-size:8pt}
tr:nth-child(even){background:#f9f9f9}
.total{background:#f0f0f0;font-weight:700}
.total td{font-size:10pt;color:${c}}
.validity{text-align:center;padding:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;margin-top:15px}
.footer{margin-top:20px;padding-top:8px;border-top:1px solid #ddd;text-align:center;font-size:6pt;color:#999}
</style></head><body>

<div class="header">
  <div class="logo">${company.logo ? `<img src="${company.logo}"/>` : ''}</div>
  <div class="company">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p>CNPJ: ${company.cnpj}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
  </div>
  <div class="badge"><small>ORÇAMENTO</small><strong>#${quoteNumber}</strong></div>
</div>

<div class="grid">
  <div class="box">
    <div class="box-title">👤 CLIENTE</div>
    <p><strong>${client?.name || '-'}</strong></p>
    <p>${client?.cnpj || '-'}</p>
    <p>${client?.phone || '-'} • ${client?.email || '-'}</p>
  </div>
  <div class="box">
    <div class="box-title">📋 ORÇAMENTO</div>
    <p><strong>${quote.title || 'Orçamento de Serviços'}</strong></p>
    <p>Status: ${quote.status === 'approved' ? '✅ Aprovado' : quote.status === 'rejected' ? '❌ Rejeitado' : '📝 Pendente'}</p>
    <p>Validade: ${validUntil}</p>
  </div>
</div>

<table>
  <thead><tr><th>Descrição</th><th style="width:60px;text-align:right">Qtd</th><th style="width:90px;text-align:right">Valor Unit.</th><th style="width:90px;text-align:right">Subtotal</th></tr></thead>
  <tbody>
    ${items.length > 0 ? items.map((i: any) => `<tr><td>${i.description || i.name || '-'}</td><td style="text-align:right">${i.quantity || 1}</td><td style="text-align:right">R$ ${(i.unit_price || 0).toFixed(2)}</td><td style="text-align:right">R$ ${((i.quantity || 1) * (i.unit_price || 0)).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#999">Nenhum item</td></tr>'}
    <tr class="total"><td colspan="3" style="text-align:right">TOTAL:</td><td style="text-align:right">R$ ${total.toFixed(2)}</td></tr>
  </tbody>
</table>

${quote.description ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:10px;border-radius:6px;font-size:8pt"><strong>Observações:</strong> ${quote.description}</div>` : ''}

<div class="validity"><p style="font-size:9pt;color:#166534">⏰ Orçamento válido até <strong>${validUntil}</strong></p></div>

<div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;
}


export async function generateOvertimePDF(entry: any) {
  try {
    const company = await getCompanyConfig();
    const entryNumber = `BH-${new Date(entry.entry_date).getFullYear()}${String(new Date(entry.entry_date).getMonth() + 1).padStart(2, '0')}-${entry.id.slice(0, 4).toUpperCase()}`;
    const html = buildOvertimePDF(company, entry, entryNumber);
    openPrint(html);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}

function buildOvertimePDF(company: any, entry: any, entryNumber: string) {
  const c = company.color;
  const typeLabel = entry.entry_type === 'overtime' ? 'HORA EXTRA' : entry.entry_type === 'compensation' ? 'COMPENSAÇÃO' : 'AUSÊNCIA';
  const statusLabel = entry.status === 'aprovado' ? '✅ APROVADO' : entry.status === 'rejeitado' ? '❌ REJEITADO' : '⏳ PENDENTE';
  const statusColor = entry.status === 'aprovado' ? '#16a34a' : entry.status === 'rejeitado' ? '#dc2626' : '#f59e0b';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Banco de Horas #${entryNumber}</title>
<style>
@page{margin:15mm 12mm;size:A4}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;color:#333;line-height:1.4}
.header{display:flex;align-items:center;border-bottom:3px solid ${c};padding-bottom:10px;margin-bottom:15px}
.logo{width:60px;height:60px;margin-right:12px}
.logo img{max-width:100%;max-height:100%;object-fit:contain}
.company{flex:1}
.company h1{font-size:14pt;color:${c};margin-bottom:2px}
.company p{font-size:7pt;color:#666;margin:1px 0}
.badge{background:${c};color:#fff;padding:8px 14px;border-radius:6px;text-align:center}
.badge small{font-size:6pt;display:block;opacity:.8}
.badge strong{font-size:12pt}
.status{text-align:center;padding:10px;background:${statusColor}15;border:2px solid ${statusColor};border-radius:6px;margin-bottom:15px}
.status p{font-size:12pt;font-weight:700;color:${statusColor}}
.hours{text-align:center;padding:20px;background:linear-gradient(135deg,${c}15,${c}05);border-radius:10px;margin-bottom:15px}
.hours .value{font-size:36pt;font-weight:700;color:${c}}
.hours .label{font-size:10pt;color:#666}
.hours .type{font-size:11pt;color:#333;font-weight:600;margin-top:5px}
.grid{display:flex;gap:12px;margin-bottom:12px}
.grid .box{flex:1;background:#f8f9fa;border:1px solid #e9ecef;border-radius:6px;padding:10px}
.box-title{font-size:8pt;font-weight:700;color:${c};border-bottom:1px solid #dee2e6;padding-bottom:4px;margin-bottom:6px}
.box p{font-size:8pt;margin:3px 0}
.signatures{display:flex;margin-top:25px}
.sig{flex:1;text-align:center;padding:0 20px}
.sig-img{height:40px;margin-bottom:-5px}
.sig-line{border-top:1px solid #333;margin:5px 0}
.sig-name{font-size:8pt;font-weight:600}
.sig-role{font-size:7pt;color:#666}
.footer{margin-top:20px;padding-top:8px;border-top:1px solid #ddd;text-align:center;font-size:6pt;color:#999}
</style></head><body>

<div class="header">
  <div class="logo">${company.logo ? `<img src="${company.logo}"/>` : ''}</div>
  <div class="company">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p>CNPJ: ${company.cnpj}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
  </div>
  <div class="badge"><small>BANCO DE HORAS</small><strong>#${entryNumber}</strong></div>
</div>

<div class="status"><p>${statusLabel}</p></div>

<div class="hours">
  <div class="value">${entry.total_hours}h</div>
  <div class="label">Total de Horas</div>
  <div class="type">${typeLabel}</div>
</div>

<div class="grid">
  <div class="box">
    <div class="box-title">👤 FUNCIONÁRIO</div>
    <p><strong>${entry.profiles?.full_name || '-'}</strong></p>
    <p>CPF: ${entry.profiles?.cpf || '-'}</p>
  </div>
  <div class="box">
    <div class="box-title">📅 LANÇAMENTO</div>
    <p>Data: ${new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
    <p>Entrada: ${entry.start_time?.substring(0, 5) || '-'} • Saída: ${entry.end_time?.substring(0, 5) || '-'}</p>
  </div>
</div>

${entry.reason ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:10px;border-radius:6px;font-size:8pt;margin-bottom:12px"><strong>Motivo:</strong> ${entry.reason}</div>` : ''}

<div class="signatures">
  <div class="sig">
    ${entry.employee_signature ? `<img src="${entry.employee_signature}" class="sig-img"/>` : '<div style="height:30px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${entry.profiles?.full_name || 'Funcionário'}</div>
    <div class="sig-role">Funcionário</div>
  </div>
  <div class="sig">
    ${entry.admin_signature ? `<img src="${entry.admin_signature}" class="sig-img"/>` : '<div style="height:30px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${entry.approver?.full_name || 'Responsável'}</div>
    <div class="sig-role">Aprovador</div>
  </div>
</div>

<div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;
}

function openPrint(html: string) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }
  w.document.write(html);
  w.document.close();
  const waitImages = () => new Promise<void>(resolve => {
    const imgs = w.document.querySelectorAll('img');
    if (!imgs.length) { resolve(); return; }
    let loaded = 0;
    const check = () => { if (++loaded >= imgs.length) resolve(); };
    imgs.forEach(img => { if (img.complete) check(); else { img.onload = check; img.onerror = check; } });
    setTimeout(resolve, 3000);
  });
  w.onload = async () => { await waitImages(); setTimeout(() => w.print(), 200); };
}