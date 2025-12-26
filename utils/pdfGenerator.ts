import { supabase } from '../lib/supabase';

// Função para formatar data e hora
const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })}hs`;
};

// Função para ID bonito
const formatOrderId = (id: string, dateString: string) => {
  if (!dateString) return id.slice(0, 6).toUpperCase();
  const d = new Date(dateString);
  const yearMonth = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const suffix = id.slice(0, 4).toUpperCase();
  return `${yearMonth}-${suffix}`;
};

// Buscar configurações da empresa
async function getCompanyConfig() {
  const { data: config } = await supabase
    .from('app_config')
    .select('*')
    .limit(1)
    .maybeSingle();

  return {
    name: config?.company_name || 'PRESTADOR DE SERVIÇOS',
    cnpj: config?.company_cnpj || config?.cnpj || '',
    address: config?.company_address || config?.address || '',
    phone: config?.company_phone || config?.phone || '',
    email: config?.company_email || config?.email || '',
    logo: config?.company_logo || config?.logo_url || '',
    color: config?.primary_color || '#6366F1'
  };
}

// =====================================================
// GERAR PDF DE ORDEM DE SERVIÇO
// =====================================================
export async function generateServiceOrderPDF(order: any) {
  try {
    const company = await getCompanyConfig();

    // Buscar dados do técnico
    let technicianName = 'Técnico Responsável';
    let technicianSignature = '';
    let technicianDoc = '';
    
    if (order.technician_id) {
      const { data: tech } = await supabase
        .from('profiles')
        .select('full_name, signature_url, cpf')
        .eq('id', order.technician_id)
        .maybeSingle();

      if (tech) {
        technicianName = tech.full_name || technicianName;
        technicianSignature = tech.signature_url || '';
        technicianDoc = tech.cpf || '';
      }
    }

    // Buscar Checklist
    const { data: tasks } = await supabase
      .from('order_tasks')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at');

    const osNumber = formatOrderId(order.id, order.created_at);
    const reportContent = order.execution_report || order.description || '<i>Nenhuma observação registrada.</i>';
    const photos = order.photos_url || order.photos || [];

    const html = generateOrderHTML(company, order, osNumber, technicianName, technicianSignature, technicianDoc, tasks || [], reportContent, photos);
    openPrintWindow(html);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('Erro ao gerar PDF. Tente novamente.');
  }
}

// =====================================================
// GERAR PDF DE ORÇAMENTO
// =====================================================
export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();

    // Buscar dados do cliente se não vier completo
    let clientData = quote.clients;
    if (!clientData && quote.client_id) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', quote.client_id)
        .single();
      clientData = data;
    }

    const quoteNumber = `ORC-${new Date(quote.created_at).getFullYear()}${String(new Date(quote.created_at).getMonth() + 1).padStart(2, '0')}-${quote.id.slice(0, 4).toUpperCase()}`;
    
    const html = generateQuoteHTML(company, quote, clientData, quoteNumber);
    openPrintWindow(html);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('Erro ao gerar PDF. Tente novamente.');
  }
}

// =====================================================
// HTML DA ORDEM DE SERVIÇO
// =====================================================
function generateOrderHTML(company: any, order: any, osNumber: string, technicianName: string, technicianSignature: string, technicianDoc: string, tasks: any[], reportContent: string, photos: string[]) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>OS #${osNumber}</title>
<style>
@page { margin: 20px 25px; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 9px; color: #333; line-height: 1.3; -webkit-print-color-adjust: exact; }
.header { display: table; width: 100%; border-bottom: 3px solid ${company.color}; padding-bottom: 12px; margin-bottom: 15px; }
.header-left { display: table-cell; width: 80px; vertical-align: middle; }
.header-left img { max-width: 75px; max-height: 60px; }
.header-center { display: table-cell; vertical-align: middle; padding: 0 15px; }
.header-center h1 { font-size: 15px; color: ${company.color}; margin-bottom: 4px; }
.header-center p { font-size: 8px; color: #555; margin: 1px 0; }
.header-right { display: table-cell; width: 130px; vertical-align: middle; text-align: right; }
.os-box { background: ${company.color}; color: #fff; padding: 8px 12px; border-radius: 6px; display: inline-block; }
.os-box small { font-size: 7px; display: block; opacity: 0.9; }
.os-box strong { font-size: 14px; }
.os-date { font-size: 8px; color: #666; margin-top: 5px; }
.section { margin-bottom: 12px; }
.section-title { background: #f5f5f5; border-left: 3px solid ${company.color}; padding: 6px 10px; font-size: 10px; font-weight: bold; color: #333; margin-bottom: 8px; }
.two-cols { display: table; width: 100%; }
.col { display: table-cell; width: 50%; vertical-align: top; padding-right: 10px; }
.col:last-child { padding-right: 0; padding-left: 10px; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table td { padding: 4px 0; border-bottom: 1px solid #eee; font-size: 9px; }
.data-table .label { color: #666; width: 80px; font-weight: 600; }
.data-table .value { color: #222; }
.checklist { margin: 8px 0; }
.check-item { padding: 4px 0; border-bottom: 1px solid #f0f0f0; font-size: 9px; }
.check-done { color: #16a34a; }
.check-done::before { content: "✓ "; font-weight: bold; }
.check-pending { color: #999; }
.check-pending::before { content: "○ "; }
.report-box { background: #fafafa; border: 1px solid #ddd; padding: 10px; border-radius: 4px; font-size: 9px; line-height: 1.5; white-space: pre-wrap; min-height: 50px; }
.photos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 10px; }
.photo-item { border-radius: 8px; overflow: hidden; border: 1px solid #ddd; background: #f5f5f5; }
.photo-item img { width: 100%; height: auto; max-height: 200px; object-fit: contain; display: block; }
.signatures { display: table; width: 100%; margin-top: 25px; page-break-inside: avoid; }
.sig-col { display: table-cell; width: 50%; text-align: center; padding: 0 20px; }
.sig-img { height: 45px; margin-bottom: -5px; }
.sig-line { border-top: 1px solid #333; margin: 5px 0; }
.sig-name { font-weight: bold; font-size: 9px; }
.sig-role { font-size: 8px; color: #666; }
.sig-doc { font-size: 7px; color: #999; margin-top: 2px; }
.footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 7px; color: #888; }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">${company.logo ? `<img src="${company.logo}" />` : ''}</div>
  <div class="header-center">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' | ')}</p>
  </div>
  <div class="header-right">
    <div class="os-box"><small>ORDEM DE SERVIÇO</small><strong>#${osNumber}</strong></div>
    <div class="os-date">${new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
  </div>
</div>

<div class="two-cols">
  <div class="col">
    <div class="section">
      <div class="section-title">DADOS DO CLIENTE</div>
      <table class="data-table">
        <tr><td class="label">Cliente:</td><td class="value"><b>${order.clients?.name || '-'}</b></td></tr>
        <tr><td class="label">CNPJ/CPF:</td><td class="value">${order.clients?.cnpj || order.clients?.cnpj_cpf || '-'}</td></tr>
        <tr><td class="label">Endereço:</td><td class="value">${order.clients?.address || '-'}</td></tr>
        <tr><td class="label">Contato:</td><td class="value">${order.clients?.phone || '-'}</td></tr>
      </table>
    </div>
  </div>
  <div class="col">
    <div class="section">
      <div class="section-title">DADOS DA EXECUÇÃO</div>
      <table class="data-table">
        <tr><td class="label">Serviço:</td><td class="value"><b>${order.title}</b></td></tr>
        <tr><td class="label">Técnico:</td><td class="value">${technicianName}</td></tr>
        <tr><td class="label">Início:</td><td class="value">${formatDateTime(order.started_at || order.checkin_at)}</td></tr>
        <tr><td class="label">Término:</td><td class="value">${formatDateTime(order.completed_at)}</td></tr>
      </table>
    </div>
  </div>
</div>

${tasks.length > 0 ? `
<div class="section">
  <div class="section-title">CHECKLIST DE VERIFICAÇÃO</div>
  <div class="checklist">
    ${tasks.map((t: any) => `<div class="check-item ${t.is_completed ? 'check-done' : 'check-pending'}">${t.title}</div>`).join('')}
  </div>
</div>
` : ''}

<div class="section">
  <div class="section-title">RELATÓRIO TÉCNICO / OBSERVAÇÕES</div>
  <div class="report-box">${reportContent}</div>
</div>

${photos.length > 0 ? `
<div class="section">
  <div class="section-title">REGISTRO FOTOGRÁFICO (${photos.length} foto${photos.length > 1 ? 's' : ''})</div>
  <div class="photos-grid">
    ${photos.map((u: string) => `<div class="photo-item"><img src="${u}" /></div>`).join('')}
  </div>
</div>
` : ''}

<div class="signatures">
  <div class="sig-col">
    ${technicianSignature ? `<img src="${technicianSignature}" class="sig-img" />` : '<div style="height:35px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${technicianName}</div>
    <div class="sig-role">Técnico Responsável</div>
    ${technicianDoc ? `<div class="sig-doc">CPF: ${technicianDoc}</div>` : ''}
  </div>
  <div class="sig-col">
    ${order.signature_url ? `<img src="${order.signature_url}" class="sig-img" />` : '<div style="height:35px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${order.signer_name || order.clients?.responsible_name || 'Responsável'}</div>
    <div class="sig-role">Responsável pelo Cliente</div>
    ${order.signer_doc ? `<div class="sig-doc">CPF: ${order.signer_doc}</div>` : ''}
  </div>
</div>

<div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')} | Portal Admin</div>
</body>
</html>`;
}

// =====================================================
// HTML DO ORÇAMENTO
// =====================================================
function generateQuoteHTML(company: any, quote: any, client: any, quoteNumber: string) {
  const items = quote.items || [];
  const total = quote.total || items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
  const validUntil = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('pt-BR') : '-';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Orçamento #${quoteNumber}</title>
<style>
@page { margin: 20px 25px; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 10px; color: #333; line-height: 1.4; -webkit-print-color-adjust: exact; }
.header { display: table; width: 100%; border-bottom: 3px solid ${company.color}; padding-bottom: 12px; margin-bottom: 20px; }
.header-left { display: table-cell; width: 80px; vertical-align: middle; }
.header-left img { max-width: 75px; max-height: 60px; }
.header-center { display: table-cell; vertical-align: middle; padding: 0 15px; }
.header-center h1 { font-size: 16px; color: ${company.color}; margin-bottom: 4px; }
.header-center p { font-size: 8px; color: #555; margin: 1px 0; }
.header-right { display: table-cell; width: 140px; vertical-align: middle; text-align: right; }
.quote-box { background: ${company.color}; color: #fff; padding: 10px 14px; border-radius: 6px; display: inline-block; }
.quote-box small { font-size: 7px; display: block; opacity: 0.9; }
.quote-box strong { font-size: 14px; }
.quote-date { font-size: 8px; color: #666; margin-top: 5px; }
.section { margin-bottom: 15px; }
.section-title { background: #f5f5f5; border-left: 3px solid ${company.color}; padding: 8px 12px; font-size: 11px; font-weight: bold; color: #333; margin-bottom: 10px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.info-box { background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #eee; }
.info-box h4 { font-size: 10px; color: ${company.color}; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
.info-box p { font-size: 9px; margin: 3px 0; }
.info-box strong { color: #222; }
.items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
.items-table th { background: ${company.color}; color: #fff; padding: 8px 10px; text-align: left; font-size: 9px; }
.items-table td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 9px; }
.items-table tr:nth-child(even) { background: #fafafa; }
.items-table .text-right { text-align: right; }
.total-row { background: #f0f0f0 !important; font-weight: bold; }
.total-row td { font-size: 11px; color: ${company.color}; }
.notes-box { background: #fffbeb; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; margin-top: 15px; }
.notes-box h4 { font-size: 10px; color: #92400e; margin-bottom: 6px; }
.notes-box p { font-size: 9px; color: #78350f; }
.validity { text-align: center; margin-top: 20px; padding: 10px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; }
.validity p { font-size: 10px; color: #166534; }
.footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 8px; color: #888; }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">${company.logo ? `<img src="${company.logo}" />` : ''}</div>
  <div class="header-center">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' | ')}</p>
  </div>
  <div class="header-right">
    <div class="quote-box"><small>ORÇAMENTO</small><strong>#${quoteNumber}</strong></div>
    <div class="quote-date">${new Date(quote.created_at).toLocaleDateString('pt-BR')}</div>
  </div>
</div>

<div class="info-grid">
  <div class="info-box">
    <h4>📋 DADOS DO ORÇAMENTO</h4>
    <p><strong>Título:</strong> ${quote.title || 'Orçamento de Serviços'}</p>
    <p><strong>Status:</strong> ${quote.status === 'approved' ? '✅ Aprovado' : quote.status === 'rejected' ? '❌ Rejeitado' : quote.status === 'sent' ? '📤 Enviado' : '📝 Rascunho'}</p>
    <p><strong>Validade:</strong> ${validUntil}</p>
  </div>
  <div class="info-box">
    <h4>👤 DADOS DO CLIENTE</h4>
    <p><strong>Nome:</strong> ${client?.name || '-'}</p>
    <p><strong>CNPJ/CPF:</strong> ${client?.cnpj || client?.cnpj_cpf || '-'}</p>
    <p><strong>Telefone:</strong> ${client?.phone || '-'}</p>
    <p><strong>Email:</strong> ${client?.email || '-'}</p>
  </div>
</div>

<div class="section">
  <div class="section-title">📦 ITENS DO ORÇAMENTO</div>
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 40%">Descrição</th>
        <th class="text-right" style="width: 15%">Qtd</th>
        <th class="text-right" style="width: 20%">Valor Unit.</th>
        <th class="text-right" style="width: 25%">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${items.length > 0 ? items.map((item: any) => `
        <tr>
          <td>${item.description || item.name || '-'}</td>
          <td class="text-right">${item.quantity || 1}</td>
          <td class="text-right">R$ ${(item.unit_price || 0).toFixed(2)}</td>
          <td class="text-right">R$ ${((item.quantity || 1) * (item.unit_price || 0)).toFixed(2)}</td>
        </tr>
      `).join('') : '<tr><td colspan="4" style="text-align: center; color: #999;">Nenhum item adicionado</td></tr>'}
      <tr class="total-row">
        <td colspan="3" class="text-right"><strong>TOTAL:</strong></td>
        <td class="text-right"><strong>R$ ${total.toFixed(2)}</strong></td>
      </tr>
    </tbody>
  </table>
</div>

${quote.description ? `
<div class="notes-box">
  <h4>📝 Observações</h4>
  <p>${quote.description}</p>
</div>
` : ''}

<div class="validity">
  <p>⏰ Este orçamento é válido até <strong>${validUntil}</strong></p>
</div>

<div class="footer">
  Documento gerado em ${new Date().toLocaleString('pt-BR')} | Portal Admin<br>
  ${company.name} - ${company.phone} - ${company.email}
</div>
</body>
</html>`;
}

// =====================================================
// ABRIR JANELA DE IMPRESSÃO
// =====================================================
// =====================================================
// GERAR PDF DE BANCO DE HORAS
// =====================================================
export async function generateOvertimePDF(entry: any) {
  try {
    const company = await getCompanyConfig();

    const entryNumber = `BH-${new Date(entry.entry_date).getFullYear()}${String(new Date(entry.entry_date).getMonth() + 1).padStart(2, '0')}-${entry.id.slice(0, 4).toUpperCase()}`;
    
    const html = generateOvertimeHTML(company, entry, entryNumber);
    openPrintWindow(html);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('Erro ao gerar PDF. Tente novamente.');
  }
}

// =====================================================
// HTML DO BANCO DE HORAS
// =====================================================
function generateOvertimeHTML(company: any, entry: any, entryNumber: string) {
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'overtime': return 'HORA EXTRA';
      case 'compensation': return 'COMPENSAÇÃO';
      case 'absence': return 'AUSÊNCIA';
      default: return type?.toUpperCase() || 'LANÇAMENTO';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aprovado': return '✅ APROVADO';
      case 'rejeitado': return '❌ REJEITADO';
      default: return '⏳ PENDENTE';
    }
  };

  const statusColor = entry.status === 'aprovado' ? '#16a34a' : entry.status === 'rejeitado' ? '#dc2626' : '#f59e0b';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Banco de Horas #${entryNumber}</title>
<style>
@page { margin: 25px 30px; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.4; -webkit-print-color-adjust: exact; }
.header { display: table; width: 100%; border-bottom: 3px solid ${company.color}; padding-bottom: 15px; margin-bottom: 20px; }
.header-left { display: table-cell; width: 80px; vertical-align: middle; }
.header-left img { max-width: 75px; max-height: 60px; }
.header-center { display: table-cell; vertical-align: middle; padding: 0 15px; }
.header-center h1 { font-size: 16px; color: ${company.color}; margin-bottom: 4px; }
.header-center p { font-size: 9px; color: #555; margin: 2px 0; }
.header-right { display: table-cell; width: 150px; vertical-align: middle; text-align: right; }
.doc-box { background: ${company.color}; color: #fff; padding: 10px 14px; border-radius: 6px; display: inline-block; }
.doc-box small { font-size: 8px; display: block; opacity: 0.9; }
.doc-box strong { font-size: 13px; }
.doc-date { font-size: 9px; color: #666; margin-top: 6px; }
.section { margin-bottom: 20px; }
.section-title { background: #f5f5f5; border-left: 3px solid ${company.color}; padding: 8px 12px; font-size: 11px; font-weight: bold; color: #333; margin-bottom: 12px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.info-box { background: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
.info-box h4 { font-size: 10px; color: ${company.color}; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
.info-box p { font-size: 10px; margin: 4px 0; }
.info-box strong { color: #222; }
.hours-display { text-align: center; padding: 25px; background: linear-gradient(135deg, ${company.color}15, ${company.color}05); border-radius: 12px; margin-bottom: 20px; }
.hours-display .value { font-size: 48px; font-weight: bold; color: ${company.color}; }
.hours-display .label { font-size: 12px; color: #666; margin-top: 5px; }
.hours-display .type { font-size: 14px; color: #333; font-weight: 600; margin-top: 8px; }
.status-box { text-align: center; padding: 12px; background: ${statusColor}15; border: 2px solid ${statusColor}; border-radius: 8px; margin-bottom: 20px; }
.status-box p { font-size: 14px; font-weight: bold; color: ${statusColor}; }
.signatures { display: table; width: 100%; margin-top: 40px; page-break-inside: avoid; }
.sig-col { display: table-cell; width: 50%; text-align: center; padding: 0 25px; }
.sig-img { height: 50px; margin-bottom: -5px; }
.sig-line { border-top: 1px solid #333; margin: 8px 0; }
.sig-name { font-weight: bold; font-size: 10px; }
.sig-role { font-size: 9px; color: #666; }
.sig-doc { font-size: 8px; color: #999; margin-top: 3px; }
.footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 8px; color: #888; }
.reason-box { background: #fffbeb; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; }
.reason-box h4 { font-size: 10px; color: #92400e; margin-bottom: 6px; }
.reason-box p { font-size: 10px; color: #78350f; }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">${company.logo ? `<img src="${company.logo}" />` : ''}</div>
  <div class="header-center">
    <h1>${company.name}</h1>
    ${company.cnpj ? `<p><b>CNPJ:</b> ${company.cnpj}</p>` : ''}
    ${company.address ? `<p>${company.address}</p>` : ''}
    <p>${[company.phone, company.email].filter(Boolean).join(' | ')}</p>
  </div>
  <div class="header-right">
    <div class="doc-box"><small>BANCO DE HORAS</small><strong>#${entryNumber}</strong></div>
    <div class="doc-date">${new Date(entry.created_at).toLocaleDateString('pt-BR')}</div>
  </div>
</div>

<div class="status-box">
  <p>${getStatusLabel(entry.status)}</p>
</div>

<div class="hours-display">
  <div class="value">${entry.total_hours}h</div>
  <div class="label">Total de Horas</div>
  <div class="type">${getTypeLabel(entry.entry_type)}</div>
</div>

<div class="info-grid">
  <div class="info-box">
    <h4>👤 DADOS DO FUNCIONÁRIO</h4>
    <p><strong>Nome:</strong> ${entry.profiles?.full_name || '-'}</p>
    <p><strong>CPF:</strong> ${entry.profiles?.cpf || '-'}</p>
    <p><strong>Cargo:</strong> ${entry.profiles?.cargo || '-'}</p>
  </div>
  <div class="info-box">
    <h4>📅 DADOS DO LANÇAMENTO</h4>
    <p><strong>Data:</strong> ${new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
    <p><strong>Entrada:</strong> ${entry.start_time?.substring(0, 5) || '-'}</p>
    <p><strong>Saída:</strong> ${entry.end_time?.substring(0, 5) || '-'}</p>
  </div>
</div>

${entry.reason ? `
<div class="section" style="margin-top: 20px;">
  <div class="reason-box">
    <h4>📝 Motivo / Justificativa</h4>
    <p>${entry.reason}</p>
  </div>
</div>
` : ''}

${entry.status !== 'pendente' ? `
<div class="section" style="margin-top: 20px;">
  <div class="section-title">${entry.status === 'aprovado' ? '✅ APROVAÇÃO' : '❌ REJEIÇÃO'}</div>
  <div class="info-box">
    <p><strong>Responsável:</strong> ${entry.approver?.full_name || '-'}</p>
    <p><strong>Data/Hora:</strong> ${entry.approved_at ? new Date(entry.approved_at).toLocaleString('pt-BR') : '-'}</p>
    ${entry.rejection_reason ? `<p><strong>Motivo:</strong> ${entry.rejection_reason}</p>` : ''}
  </div>
</div>
` : ''}

<div class="signatures">
  <div class="sig-col">
    ${entry.employee_signature ? `<img src="${entry.employee_signature}" class="sig-img" />` : '<div style="height:40px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${entry.profiles?.full_name || 'Funcionário'}</div>
    <div class="sig-role">Funcionário</div>
    ${entry.profiles?.cpf ? `<div class="sig-doc">CPF: ${entry.profiles.cpf}</div>` : ''}
  </div>
  <div class="sig-col">
    ${entry.admin_signature ? `<img src="${entry.admin_signature}" class="sig-img" />` : '<div style="height:40px"></div>'}
    <div class="sig-line"></div>
    <div class="sig-name">${entry.approver?.full_name || 'Responsável'}</div>
    <div class="sig-role">Aprovador</div>
  </div>
</div>

<div class="footer">
  Documento gerado em ${new Date().toLocaleString('pt-BR')} | Portal Admin<br>
  ${company.name} - ${company.phone} - ${company.email}
</div>
</body>
</html>`;
}

// =====================================================
// ABRIR JANELA DE IMPRESSÃO
// =====================================================
function openPrintWindow(html: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para gerar o PDF');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  const waitForImages = () => {
    return new Promise<void>((resolve) => {
      const images = printWindow.document.querySelectorAll('img');
      if (images.length === 0) { resolve(); return; }
      let loaded = 0;
      const check = () => { if (++loaded >= images.length) resolve(); };
      images.forEach((img) => {
        if (img.complete) check();
        else { img.onload = check; img.onerror = check; }
      });
      setTimeout(resolve, 5000);
    });
  };

  printWindow.onload = async () => {
    await waitForImages();
    setTimeout(() => printWindow.print(), 300);
  };
}
