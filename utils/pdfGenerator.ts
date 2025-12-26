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

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>OS #${osNumber}</title>
<style>
@page { margin: 12mm; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 9pt; color: #333; line-height: 1.4; }

.header { display: table; width: 100%; border-bottom: 2px solid ${c}; padding-bottom: 10px; margin-bottom: 15px; }
.header-logo { display: table-cell; width: 60px; vertical-align: middle; }
.header-logo img { max-width: 55px; max-height: 55px; }
.header-info { display: table-cell; vertical-align: middle; padding-left: 10px; }
.header-info h1 { font-size: 14pt; color: ${c}; }
.header-info p { font-size: 7pt; color: #666; }
.header-os { display: table-cell; width: 120px; vertical-align: middle; text-align: right; }
.os-box { background: ${c}; color: #fff; padding: 8px 12px; border-radius: 5px; display: inline-block; }
.os-box small { font-size: 6pt; display: block; }
.os-box strong { font-size: 12pt; }

.row { display: table; width: 100%; margin-bottom: 12px; }
.col { display: table-cell; width: 50%; vertical-align: top; }
.col:first-child { padding-right: 8px; }
.col:last-child { padding-left: 8px; }

.box { background: #f5f5f5; border: 1px solid #ddd; border-radius: 5px; padding: 10px; height: 100%; }
.box-title { font-size: 9pt; font-weight: bold; color: ${c}; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 8px; }
.box-row { font-size: 8pt; padding: 3px 0; }
.box-row b { color: #222; }

.section { margin-bottom: 15px; }
.section-title { background: ${c}; color: #fff; padding: 6px 10px; font-size: 9pt; font-weight: bold; border-radius: 4px 4px 0 0; }
.section-body { background: #f9f9f9; border: 1px solid #ddd; border-top: none; border-radius: 0 0 4px 4px; padding: 10px; }

.checklist { display: table; width: 100%; }
.check-col { display: table-cell; width: 50%; vertical-align: top; }
.check-item { font-size: 8pt; padding: 2px 0; }
.check-ok { color: #16a34a; }
.check-no { color: #999; }

.report { font-size: 9pt; line-height: 1.6; white-space: pre-wrap; }

.photos { display: table; width: 100%; }
.photo-row { display: table-row; }
.photo-cell { display: table-cell; width: 25%; padding: 4px; vertical-align: top; }
.photo-box { background: #eee; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; text-align: center; }
.photo-box img { width: 100%; height: auto; max-height: 120px; object-fit: contain; display: block; }

.sigs { display: table; width: 100%; margin-top: 20px; }
.sig { display: table-cell; width: 50%; text-align: center; padding: 0 20px; }
.sig-img { height: 40px; }
.sig-line { border-top: 1px solid #333; margin: 5px 20px; }
.sig-name { font-size: 8pt; font-weight: bold; }
.sig-role { font-size: 7pt; color: #666; }

.footer { margin-top: 15px; text-align: center; font-size: 6pt; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
</style>
</head>
<body>

<div class="header">
  <div class="header-logo">${company.logo ? `<img src="${company.logo}"/>` : ''}</div>
  <div class="header-info">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p>CNPJ: ${company.cnpj}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' | ')}</p>
  </div>
  <div class="header-os">
    <div class="os-box"><small>ORDEM DE SERVIÇO</small><strong>#${osNumber}</strong></div>
    <p style="font-size:7pt;color:#666;margin-top:4px">${new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
  </div>
</div>

<div class="row">
  <div class="col">
    <div class="box">
      <div class="box-title">CLIENTE</div>
      <div class="box-row"><b>${order.clients?.name || '-'}</b></div>
      <div class="box-row">${order.clients?.cnpj || order.clients?.cnpj_cpf || '-'}</div>
      <div class="box-row">${order.clients?.address || '-'}</div>
      <div class="box-row">${order.clients?.phone || '-'}</div>
    </div>
  </div>
  <div class="col">
    <div class="box">
      <div class="box-title">SERVIÇO</div>
      <div class="box-row"><b>${order.title}</b></div>
      <div class="box-row">Técnico: ${techName}</div>
      <div class="box-row">Início: ${formatDateTime(order.checkin_at)}</div>
      <div class="box-row">Término: ${formatDateTime(order.completed_at)}</div>
    </div>
  </div>
</div>

${tasks.length > 0 ? `
<div class="section">
  <div class="section-title">CHECKLIST</div>
  <div class="section-body">
    <div class="checklist">
      <div class="check-col">${tasks.slice(0, Math.ceil(tasks.length/2)).map(t => `<div class="check-item ${t.is_completed ? 'check-ok' : 'check-no'}">${t.is_completed ? '✓' : '○'} ${t.title}</div>`).join('')}</div>
      <div class="check-col">${tasks.slice(Math.ceil(tasks.length/2)).map(t => `<div class="check-item ${t.is_completed ? 'check-ok' : 'check-no'}">${t.is_completed ? '✓' : '○'} ${t.title}</div>`).join('')}</div>
    </div>
  </div>
</div>
` : ''}

<div class="section">
  <div class="section-title">RELATÓRIO TÉCNICO</div>
  <div class="section-body">
    <div class="report">${report || 'Nenhuma observação registrada.'}</div>
  </div>
</div>

${photos.length > 0 ? `
<div class="section">
  <div class="section-title">FOTOS (${photos.length})</div>
  <div class="section-body">
    <div class="photos">
      ${(() => {
        let html = '';
        for (let i = 0; i < photos.length; i += 4) {
          html += '<div class="photo-row">';
          for (let j = i; j < i + 4 && j < photos.length; j++) {
            html += `<div class="photo-cell"><div class="photo-box"><img src="${photos[j]}"/></div></div>`;
          }
          // Preencher células vazias
          for (let k = photos.length; k < i + 4; k++) {
            html += '<div class="photo-cell"></div>';
          }
          html += '</div>';
        }
        return html;
      })()}
    </div>
  </div>
</div>
` : ''}

<div class="sigs">
  <div class="sig">
    ${techSig ? `<img src="${techSig}" class="sig-img"/>` : '<div style="height:35px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${techName}</div>
    <div class="sig-role">Técnico Responsável</div>
    ${techDoc ? `<p style="font-size:6pt;color:#999">CPF: ${techDoc}</p>` : ''}
  </div>
  <div class="sig">
    ${order.signature_url ? `<img src="${order.signature_url}" class="sig-img"/>` : '<div style="height:35px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${order.signer_name || 'Responsável'}</div>
    <div class="sig-role">Cliente</div>
    ${order.signer_doc ? `<p style="font-size:6pt;color:#999">CPF: ${order.signer_doc}</p>` : ''}
  </div>
</div>

<div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>

</body>
</html>`;
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