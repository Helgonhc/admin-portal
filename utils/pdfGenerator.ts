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
    let techName = 'Técnico Responsável', techSig = '', techDoc = '';
    
    if (order.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name, signature_url, cpf').eq('id', order.technician_id).maybeSingle();
      if (tech) { techName = tech.full_name || techName; techSig = tech.signature_url || ''; techDoc = tech.cpf || ''; }
    }

    const { data: tasks } = await supabase.from('order_tasks').select('*').eq('order_id', order.id).order('created_at');
    const osNumber = formatOrderId(order.id, order.created_at);
    const photos = order.photos_url || order.photos || [];
    const report = order.execution_report || order.description || '';
    const c = company.color;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>OS #${osNumber}</title>
<style>
@page { size: A4; margin: 10mm; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
</style></head><body>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups'); return; }
    
    w.document.write(html);
    w.document.write(buildPage1(company, order, osNumber, techName, tasks || [], report, c));
    if (photos.length > 0) {
      w.document.write(buildPage2(photos, techName, techSig, techDoc, order, c));
    } else {
      w.document.write(buildSignatures(techName, techSig, techDoc, order));
    }
    w.document.write(`<div style="text-align:center;font-size:9px;color:#999;margin-top:20px;border-top:1px solid #ddd;padding-top:8px">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div></body></html>`);
    w.document.close();
    
    setTimeout(() => w.print(), 500);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}


function buildPage1(company: any, order: any, osNumber: string, techName: string, tasks: any[], report: string, c: string) {
  return `
<!-- CABEÇALHO -->
<table style="width:100%;border-bottom:2px solid ${c};padding-bottom:8px;margin-bottom:12px">
<tr>
<td style="width:60px;vertical-align:middle">${company.logo ? `<img src="${company.logo}" style="max-width:50px;max-height:50px">` : ''}</td>
<td style="vertical-align:middle;padding-left:8px">
<div style="font-size:16px;font-weight:bold;color:${c}">${company.name}</div>
${company.cnpj ? `<div style="font-size:9px;color:#666">CNPJ: ${company.cnpj}</div>` : ''}
${company.address ? `<div style="font-size:9px;color:#666">${company.address}</div>` : ''}
<div style="font-size:9px;color:#666">${[company.phone, company.email].filter(Boolean).join(' | ')}</div>
</td>
<td style="width:120px;text-align:right;vertical-align:middle">
<div style="background:${c};color:#fff;padding:8px 12px;border-radius:5px;display:inline-block">
<div style="font-size:8px">ORDEM DE SERVIÇO</div>
<div style="font-size:14px;font-weight:bold">#${osNumber}</div>
</div>
<div style="font-size:9px;color:#666;margin-top:4px">${new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
</td>
</tr>
</table>

<!-- CLIENTE E SERVIÇO -->
<table style="width:100%;margin-bottom:12px">
<tr>
<td style="width:50%;vertical-align:top;padding-right:6px">
<div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:10px">
<div style="font-size:10px;font-weight:bold;color:${c};border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:6px">CLIENTE</div>
<div style="font-size:10px;font-weight:bold">${order.clients?.name || '-'}</div>
<div style="font-size:9px;color:#555">${order.clients?.cnpj || order.clients?.cnpj_cpf || '-'}</div>
<div style="font-size:9px;color:#555">${order.clients?.address || '-'}</div>
<div style="font-size:9px;color:#555">${order.clients?.phone || '-'}</div>
</div>
</td>
<td style="width:50%;vertical-align:top;padding-left:6px">
<div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:10px">
<div style="font-size:10px;font-weight:bold;color:${c};border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:6px">SERVIÇO</div>
<div style="font-size:10px;font-weight:bold">${order.title || '-'}</div>
<div style="font-size:9px;color:#555">Técnico: ${techName}</div>
<div style="font-size:9px;color:#555">Início: ${formatDateTime(order.checkin_at)}</div>
<div style="font-size:9px;color:#555">Término: ${formatDateTime(order.completed_at)}</div>
</div>
</td>
</tr>
</table>

${tasks.length > 0 ? `
<!-- CHECKLIST -->
<div style="margin-bottom:12px">
<div style="background:${c};color:#fff;padding:5px 10px;font-size:10px;font-weight:bold;border-radius:4px 4px 0 0">CHECKLIST</div>
<div style="background:#f9f9f9;border:1px solid #ddd;border-top:none;border-radius:0 0 4px 4px;padding:8px">
<table style="width:100%"><tr>
<td style="width:50%;vertical-align:top">${tasks.slice(0, Math.ceil(tasks.length/2)).map(t => `<div style="font-size:9px;padding:2px 0;color:${t.is_completed ? '#16a34a' : '#999'}">${t.is_completed ? '✓' : '○'} ${t.title}</div>`).join('')}</td>
<td style="width:50%;vertical-align:top">${tasks.slice(Math.ceil(tasks.length/2)).map(t => `<div style="font-size:9px;padding:2px 0;color:${t.is_completed ? '#16a34a' : '#999'}">${t.is_completed ? '✓' : '○'} ${t.title}</div>`).join('')}</td>
</tr></table>
</div>
</div>
` : ''}

<!-- RELATÓRIO -->
<div style="margin-bottom:12px">
<div style="background:${c};color:#fff;padding:5px 10px;font-size:10px;font-weight:bold;border-radius:4px 4px 0 0">RELATÓRIO TÉCNICO</div>
<div style="background:#f9f9f9;border:1px solid #ddd;border-top:none;border-radius:0 0 4px 4px;padding:10px;font-size:10px;line-height:1.5;white-space:pre-wrap;min-height:50px">${report || 'Nenhuma observação registrada.'}</div>
</div>
`;
}


function buildPage2(photos: string[], techName: string, techSig: string, techDoc: string, order: any, c: string) {
  return `
<!-- QUEBRA DE PÁGINA -->
<div style="page-break-before:always"></div>

<!-- FOTOS -->
<div style="margin-bottom:15px">
<div style="background:${c};color:#fff;padding:5px 10px;font-size:10px;font-weight:bold;border-radius:4px 4px 0 0">REGISTRO FOTOGRÁFICO (${photos.length} foto${photos.length > 1 ? 's' : ''})</div>
<div style="background:#f9f9f9;border:1px solid #ddd;border-top:none;border-radius:0 0 4px 4px;padding:10px">
<table style="width:100%">
${(() => {
  let html = '';
  for (let i = 0; i < photos.length; i += 4) {
    html += '<tr>';
    for (let j = i; j < i + 4; j++) {
      if (j < photos.length) {
        html += `<td style="width:25%;padding:4px;vertical-align:top"><div style="background:#eee;border:1px solid #ddd;border-radius:8px;overflow:hidden;text-align:center"><img src="${photos[j]}" style="width:100%;height:auto;max-height:100px;object-fit:contain;display:block"></div></td>`;
      } else {
        html += '<td style="width:25%;padding:4px"></td>';
      }
    }
    html += '</tr>';
  }
  return html;
})()}
</table>
</div>
</div>

${buildSignatures(techName, techSig, techDoc, order)}
`;
}

function buildSignatures(techName: string, techSig: string, techDoc: string, order: any) {
  return `
<!-- ASSINATURAS -->
<table style="width:100%;margin-top:20px">
<tr>
<td style="width:50%;text-align:center;padding:0 15px">
<div style="background:#f5f5f5;border-radius:5px;padding:10px">
${techSig ? `<img src="${techSig}" style="height:35px;margin-bottom:5px">` : '<div style="height:30px"></div>'}
<div style="border-top:1px solid #333;margin:5px 15px"></div>
<div style="font-size:9px;font-weight:bold">${techName}</div>
<div style="font-size:8px;color:#666">Técnico Responsável</div>
${techDoc ? `<div style="font-size:7px;color:#999">CPF: ${techDoc}</div>` : ''}
</div>
</td>
<td style="width:50%;text-align:center;padding:0 15px">
<div style="background:#f5f5f5;border-radius:5px;padding:10px">
${order.signature_url ? `<img src="${order.signature_url}" style="height:35px;margin-bottom:5px">` : '<div style="height:30px"></div>'}
<div style="border-top:1px solid #333;margin:5px 15px"></div>
<div style="font-size:9px;font-weight:bold">${order.signer_name || 'Responsável'}</div>
<div style="font-size:8px;color:#666">Cliente</div>
${order.signer_doc ? `<div style="font-size:7px;color:#999">CPF: ${order.signer_doc}</div>` : ''}
</div>
</td>
</tr>
</table>
`;
}


// ========== ORÇAMENTO ==========
export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    let clientData = quote.clients;
    if (!clientData && quote.client_id) {
      const { data } = await supabase.from('clients').select('*').eq('id', quote.client_id).single();
      clientData = data;
    }
    const quoteNumber = `ORC-${new Date(quote.created_at).getFullYear()}${String(new Date(quote.created_at).getMonth() + 1).padStart(2, '0')}-${quote.id.slice(0, 4).toUpperCase()}`;
    const c = company.color;
    const items = quote.items || [];
    const total = quote.total || items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
    const validUntil = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('pt-BR') : '-';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orçamento</title>
<style>@page{margin:12mm;size:A4}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#333}</style></head><body>
<table style="width:100%;border-bottom:2px solid ${c};padding-bottom:8px;margin-bottom:12px">
<tr>
<td style="width:60px;vertical-align:middle">${company.logo ? `<img src="${company.logo}" style="max-width:50px;max-height:50px">` : ''}</td>
<td style="vertical-align:middle;padding-left:8px">
<div style="font-size:16px;font-weight:bold;color:${c}">${company.name}</div>
${company.cnpj ? `<div style="font-size:9px;color:#666">CNPJ: ${company.cnpj}</div>` : ''}
<div style="font-size:9px;color:#666">${[company.phone, company.email].filter(Boolean).join(' | ')}</div>
</td>
<td style="width:120px;text-align:right;vertical-align:middle">
<div style="background:${c};color:#fff;padding:8px 12px;border-radius:5px;display:inline-block">
<div style="font-size:8px">ORÇAMENTO</div>
<div style="font-size:14px;font-weight:bold">#${quoteNumber}</div>
</div>
</td>
</tr>
</table>
<table style="width:100%;margin-bottom:12px">
<tr>
<td style="width:50%;vertical-align:top;padding-right:6px">
<div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:10px">
<div style="font-size:10px;font-weight:bold;color:${c};border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:6px">CLIENTE</div>
<div style="font-size:10px;font-weight:bold">${clientData?.name || '-'}</div>
<div style="font-size:9px;color:#555">${clientData?.cnpj || '-'}</div>
<div style="font-size:9px;color:#555">${clientData?.phone || '-'} | ${clientData?.email || '-'}</div>
</div>
</td>
<td style="width:50%;vertical-align:top;padding-left:6px">
<div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:10px">
<div style="font-size:10px;font-weight:bold;color:${c};border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:6px">ORÇAMENTO</div>
<div style="font-size:10px;font-weight:bold">${quote.title || 'Orçamento de Serviços'}</div>
<div style="font-size:9px;color:#555">Status: ${quote.status === 'approved' ? 'Aprovado' : quote.status === 'rejected' ? 'Rejeitado' : 'Pendente'}</div>
<div style="font-size:9px;color:#555">Validade: ${validUntil}</div>
</div>
</td>
</tr>
</table>
<table style="width:100%;border-collapse:collapse;margin-bottom:12px">
<tr style="background:${c};color:#fff"><th style="padding:6px;text-align:left;font-size:10px">Descrição</th><th style="padding:6px;text-align:right;width:50px;font-size:10px">Qtd</th><th style="padding:6px;text-align:right;width:80px;font-size:10px">Valor Unit.</th><th style="padding:6px;text-align:right;width:80px;font-size:10px">Subtotal</th></tr>
${items.length > 0 ? items.map((i: any, idx: number) => `<tr style="background:${idx % 2 ? '#f9f9f9' : '#fff'}"><td style="padding:6px;font-size:10px">${i.description || i.name || '-'}</td><td style="padding:6px;text-align:right;font-size:10px">${i.quantity || 1}</td><td style="padding:6px;text-align:right;font-size:10px">R$ ${(i.unit_price || 0).toFixed(2)}</td><td style="padding:6px;text-align:right;font-size:10px">R$ ${((i.quantity || 1) * (i.unit_price || 0)).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="4" style="padding:10px;text-align:center;color:#999;font-size:10px">Nenhum item</td></tr>'}
<tr style="background:#f0f0f0;font-weight:bold"><td colspan="3" style="padding:8px;text-align:right;font-size:11px">TOTAL:</td><td style="padding:8px;text-align:right;font-size:12px;color:${c}">R$ ${total.toFixed(2)}</td></tr>
</table>
${quote.description ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:10px;border-radius:4px;font-size:10px;margin-bottom:12px"><strong>Observações:</strong> ${quote.description}</div>` : ''}
<div style="text-align:center;padding:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px"><span style="font-size:11px;color:#166534">Orçamento válido até <strong>${validUntil}</strong></span></div>
<div style="text-align:center;font-size:9px;color:#999;margin-top:20px;border-top:1px solid #ddd;padding-top:8px">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}


// ========== BANCO DE HORAS ==========
export async function generateOvertimePDF(entry: any) {
  try {
    const company = await getCompanyConfig();
    const entryNumber = `BH-${new Date(entry.entry_date).getFullYear()}${String(new Date(entry.entry_date).getMonth() + 1).padStart(2, '0')}-${entry.id.slice(0, 4).toUpperCase()}`;
    const c = company.color;
    const typeLabel = entry.entry_type === 'overtime' ? 'HORA EXTRA' : entry.entry_type === 'compensation' ? 'COMPENSAÇÃO' : 'AUSÊNCIA';
    const statusLabel = entry.status === 'aprovado' ? 'APROVADO' : entry.status === 'rejeitado' ? 'REJEITADO' : 'PENDENTE';
    const statusColor = entry.status === 'aprovado' ? '#16a34a' : entry.status === 'rejeitado' ? '#dc2626' : '#f59e0b';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Banco de Horas</title>
<style>@page{margin:12mm;size:A4}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#333}</style></head><body>
<table style="width:100%;border-bottom:2px solid ${c};padding-bottom:8px;margin-bottom:12px">
<tr>
<td style="width:60px;vertical-align:middle">${company.logo ? `<img src="${company.logo}" style="max-width:50px;max-height:50px">` : ''}</td>
<td style="vertical-align:middle;padding-left:8px">
<div style="font-size:16px;font-weight:bold;color:${c}">${company.name}</div>
${company.cnpj ? `<div style="font-size:9px;color:#666">CNPJ: ${company.cnpj}</div>` : ''}
<div style="font-size:9px;color:#666">${[company.phone, company.email].filter(Boolean).join(' | ')}</div>
</td>
<td style="width:120px;text-align:right;vertical-align:middle">
<div style="background:${c};color:#fff;padding:8px 12px;border-radius:5px;display:inline-block">
<div style="font-size:8px">BANCO DE HORAS</div>
<div style="font-size:14px;font-weight:bold">#${entryNumber}</div>
</div>
</td>
</tr>
</table>
<div style="text-align:center;padding:12px;background:${statusColor}20;border:2px solid ${statusColor};border-radius:5px;margin-bottom:12px">
<span style="font-size:16px;font-weight:bold;color:${statusColor}">${statusLabel}</span>
</div>
<div style="text-align:center;padding:20px;background:#f5f5f5;border-radius:8px;margin-bottom:12px">
<div style="font-size:40px;font-weight:bold;color:${c}">${entry.total_hours}h</div>
<div style="font-size:12px;color:#666">Total de Horas</div>
<div style="font-size:13px;color:#333;font-weight:600;margin-top:5px">${typeLabel}</div>
</div>
<table style="width:100%;margin-bottom:12px">
<tr>
<td style="width:50%;vertical-align:top;padding-right:6px">
<div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:10px">
<div style="font-size:10px;font-weight:bold;color:${c};border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:6px">FUNCIONÁRIO</div>
<div style="font-size:10px;font-weight:bold">${entry.profiles?.full_name || '-'}</div>
<div style="font-size:9px;color:#555">CPF: ${entry.profiles?.cpf || '-'}</div>
</div>
</td>
<td style="width:50%;vertical-align:top;padding-left:6px">
<div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:10px">
<div style="font-size:10px;font-weight:bold;color:${c};border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:6px">LANÇAMENTO</div>
<div style="font-size:9px;color:#555">Data: ${new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
<div style="font-size:9px;color:#555">Entrada: ${entry.start_time?.substring(0, 5) || '-'} | Saída: ${entry.end_time?.substring(0, 5) || '-'}</div>
</div>
</td>
</tr>
</table>
${entry.reason ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:10px;border-radius:4px;font-size:10px;margin-bottom:12px"><strong>Motivo:</strong> ${entry.reason}</div>` : ''}
<table style="width:100%;margin-top:20px">
<tr>
<td style="width:50%;text-align:center;padding:0 15px">
<div style="background:#f5f5f5;border-radius:5px;padding:10px">
${entry.employee_signature ? `<img src="${entry.employee_signature}" style="height:35px;margin-bottom:5px">` : '<div style="height:30px"></div>'}
<div style="border-top:1px solid #333;margin:5px 15px"></div>
<div style="font-size:9px;font-weight:bold">${entry.profiles?.full_name || 'Funcionário'}</div>
<div style="font-size:8px;color:#666">Funcionário</div>
</div>
</td>
<td style="width:50%;text-align:center;padding:0 15px">
<div style="background:#f5f5f5;border-radius:5px;padding:10px">
${entry.admin_signature ? `<img src="${entry.admin_signature}" style="height:35px;margin-bottom:5px">` : '<div style="height:30px"></div>'}
<div style="border-top:1px solid #333;margin:5px 15px"></div>
<div style="font-size:9px;font-weight:bold">${entry.approver?.full_name || 'Responsável'}</div>
<div style="font-size:8px;color:#666">Aprovador</div>
</div>
</td>
</tr>
</table>
<div style="text-align:center;font-size:9px;color:#999;margin-top:20px;border-top:1px solid #ddd;padding-top:8px">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}
