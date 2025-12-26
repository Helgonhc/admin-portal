import { supabase } from '../lib/supabase';

// Formatar data/hora - CORRIGIDO para lidar com datas do banco
const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  try {
    // Se a data não tem timezone, adicionar
    let date: Date;
    if (dateString.includes('T') && !dateString.includes('Z') && !dateString.includes('+')) {
      // Data local sem timezone - interpretar como horário local
      date = new Date(dateString);
    } else {
      date = new Date(dateString);
    }
    
    return date.toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return dateString;
  }
};

const formatOrderId = (id: string, dateString: string) => {
  if (!dateString) return id?.slice(0, 6).toUpperCase() || 'OS';
  try {
    const d = new Date(dateString);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${id.slice(0, 4).toUpperCase()}`;
  } catch {
    return id?.slice(0, 6).toUpperCase() || 'OS';
  }
};

const formatReportText = (text: string) => {
  if (!text || text.trim() === '') return '<em>Nenhuma observação registrada.</em>';
  return text.split(/\n+/).filter(p => p.trim()).map(p => `<p style="margin:0 0 8px 0;text-indent:20px;">${p.trim()}</p>`).join('');
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
    console.log('=== DEBUG PDF ===');
    console.log('checkin_at:', order.checkin_at);
    console.log('completed_at:', order.completed_at);
    
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
    const reportHTML = formatReportText(report);
    const hasTasks = tasks && tasks.length > 0;
    const hasPhotos = photos.length > 0;

    // Abrir janela
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }
    
    // HTML usando TABELAS para compatibilidade máxima com impressão
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>OS #${osNumber}</title>
<style>
@page { size: A4; margin: 12mm; }
@media print { 
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.4; }
table { border-collapse: collapse; width: 100%; }
td, th { vertical-align: top; }

/* Header */
.header-table { margin-bottom: 15px; border-bottom: 3px solid ${company.color}; padding-bottom: 12px; }
.logo-cell { width: 80px; }
.logo-cell img { max-width: 70px; max-height: 55px; }
.company-cell { padding: 0 15px; }
.company-name { font-size: 16px; font-weight: bold; color: ${company.color}; margin-bottom: 4px; }
.company-info { font-size: 9px; color: #555; }
.os-cell { width: 140px; text-align: right; }
.os-badge { background: ${company.color}; color: white; padding: 10px 15px; border-radius: 6px; display: inline-block; }
.os-badge small { font-size: 8px; display: block; opacity: 0.9; }
.os-badge strong { font-size: 15px; }
.os-date { font-size: 9px; color: #666; margin-top: 6px; }

/* Sections */
.section { margin-bottom: 15px; }
.section-title { background: #f5f5f5; border-left: 4px solid ${company.color}; padding: 6px 10px; font-size: 11px; font-weight: bold; margin-bottom: 10px; }
.data-table td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
.data-table .label { color: #666; width: 90px; font-weight: 600; background: #fafafa; }
.data-table .value { color: #222; }

/* Checklist */
.checklist-table td { padding: 4px 8px; font-size: 10px; border-bottom: 1px solid #f0f0f0; }
.check-done { color: #16a34a; }
.check-pending { color: #999; }

/* Report */
.report-box { background: #fafafa; border: 1px solid #ddd; padding: 12px; border-radius: 4px; font-size: 10px; line-height: 1.6; min-height: 60px; }

/* Photos */
.photos-table { margin-top: 10px; }
.photos-table td { padding: 5px; text-align: center; }
.photo-cell { width: 33.33%; }
.photo-img { width: 100%; max-width: 180px; height: 140px; object-fit: contain; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; }

/* Signatures */
.sig-table { margin-top: 25px; }
.sig-cell { width: 50%; text-align: center; padding: 0 30px; }
.sig-img { max-height: 45px; max-width: 140px; }
.sig-line { border-top: 1px solid #333; margin: 8px 0; }
.sig-name { font-weight: bold; font-size: 10px; }
.sig-role { font-size: 9px; color: #666; }
.sig-doc { font-size: 8px; color: #999; margin-top: 2px; }

/* Footer */
.footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 8px; color: #888; }

/* Page break */
.page-break { page-break-before: always; margin-top: 0; padding-top: 15px; }

/* Print button */
.print-btn { position: fixed; top: 10px; right: 10px; background: ${company.color}; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 1000; }
.print-btn:hover { opacity: 0.9; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir PDF</button>

<!-- ===== CABEÇALHO ===== -->
<table class="header-table">
<tr>
  <td class="logo-cell">${company.logo ? `<img src="${company.logo}" alt="Logo">` : ''}</td>
  <td class="company-cell">
    <div class="company-name">${company.name}</div>
    <div class="company-info">
      ${company.cnpj ? `<strong>CNPJ:</strong> ${company.cnpj}<br>` : ''}
      ${company.address ? `${company.address}<br>` : ''}
      ${[company.phone, company.email].filter(Boolean).join(' • ')}
    </div>
  </td>
  <td class="os-cell">
    <div class="os-badge">
      <small>ORDEM DE SERVIÇO</small>
      <strong>#${osNumber}</strong>
    </div>
    <div class="os-date">${formatDate(order.created_at)}</div>
  </td>
</tr>
</table>

<!-- ===== DADOS EM 2 COLUNAS ===== -->
<table style="width:100%;margin-bottom:15px;">
<tr>
  <td style="width:50%;padding-right:10px;vertical-align:top;">
    <div class="section">
      <div class="section-title">DADOS DO CLIENTE</div>
      <table class="data-table">
        <tr><td class="label">Cliente:</td><td class="value"><strong>${order.clients?.name || '-'}</strong></td></tr>
        <tr><td class="label">CNPJ/CPF:</td><td class="value">${order.clients?.cnpj_cpf || '-'}</td></tr>
        <tr><td class="label">Endereço:</td><td class="value">${order.clients?.address || '-'}</td></tr>
        <tr><td class="label">Contato:</td><td class="value">${order.clients?.phone || '-'}</td></tr>
      </table>
    </div>
  </td>
  <td style="width:50%;padding-left:10px;vertical-align:top;">
    <div class="section">
      <div class="section-title">DADOS DA EXECUÇÃO</div>
      <table class="data-table">
        <tr><td class="label">Serviço:</td><td class="value"><strong>${order.title || '-'}</strong></td></tr>
        <tr><td class="label">Técnico:</td><td class="value">${techName}</td></tr>
        <tr><td class="label">Início:</td><td class="value">${formatDateTime(order.checkin_at)}</td></tr>
        <tr><td class="label">Término:</td><td class="value">${formatDateTime(order.completed_at)}</td></tr>
      </table>
    </div>
  </td>
</tr>
</table>

${hasTasks ? `
<!-- ===== CHECKLIST ===== -->
<div class="section">
  <div class="section-title">CHECKLIST DE VERIFICAÇÃO</div>
  <table class="checklist-table">
    ${tasks.map((t: any, i: number) => `
      <tr>
        <td style="width:20px;" class="${t.is_completed ? 'check-done' : 'check-pending'}">${t.is_completed ? '✓' : '○'}</td>
        <td class="${t.is_completed ? 'check-done' : ''}">${t.title}</td>
      </tr>
    `).join('')}
  </table>
</div>
` : ''}

<!-- ===== RELATÓRIO ===== -->
<div class="section">
  <div class="section-title">RELATÓRIO TÉCNICO / OBSERVAÇÕES</div>
  <div class="report-box">${reportHTML}</div>
</div>

${hasPhotos ? `
<!-- ===== PÁGINA 2: FOTOS + ASSINATURAS ===== -->
<div class="page-break">
  <div class="section">
    <div class="section-title">REGISTRO FOTOGRÁFICO (${photos.length} foto${photos.length > 1 ? 's' : ''})</div>
    <table class="photos-table">
      ${(() => {
        let rows = '';
        for (let i = 0; i < photos.length; i += 3) {
          rows += '<tr>';
          for (let j = 0; j < 3; j++) {
            if (photos[i + j]) {
              rows += `<td class="photo-cell"><img src="${photos[i + j]}" class="photo-img" alt="Foto ${i + j + 1}"></td>`;
            } else {
              rows += '<td class="photo-cell"></td>';
            }
          }
          rows += '</tr>';
        }
        return rows;
      })()}
    </table>
  </div>
</div>
` : ''}

<!-- ===== ASSINATURAS ===== -->
<table class="sig-table">
<tr>
  <td class="sig-cell">
    <div style="height:50px;display:flex;align-items:flex-end;justify-content:center;">
      ${techSig ? `<img src="${techSig}" class="sig-img" alt="Assinatura Técnico">` : ''}
    </div>
    <div class="sig-line"></div>
    <div class="sig-name">${techName}</div>
    <div class="sig-role">Técnico Responsável</div>
    ${techDoc ? `<div class="sig-doc">CPF: ${techDoc}</div>` : ''}
  </td>
  <td class="sig-cell">
    <div style="height:50px;display:flex;align-items:flex-end;justify-content:center;">
      ${order.signature_url ? `<img src="${order.signature_url}" class="sig-img" alt="Assinatura Cliente">` : ''}
    </div>
    <div class="sig-line"></div>
    <div class="sig-name">${order.signer_name || order.clients?.responsible_name || 'Responsável'}</div>
    <div class="sig-role">Responsável pelo Cliente</div>
    ${order.signer_doc ? `<div class="sig-doc">CPF: ${order.signer_doc}</div>` : ''}
  </td>
</tr>
</table>

<div class="footer">
  Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
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
    
    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }
    
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Orçamento #${quoteNumber}</title>
<style>
@page { size: A4; margin: 15mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
table { border-collapse: collapse; width: 100%; }
.header { border-bottom: 3px solid ${company.color}; padding-bottom: 12px; margin-bottom: 20px; }
.section { margin-bottom: 20px; }
.section-title { background: #f5f5f5; border-left: 4px solid ${company.color}; padding: 8px 12px; font-weight: bold; margin-bottom: 10px; }
.data-table td { padding: 6px 8px; border-bottom: 1px solid #eee; }
.data-table .label { color: #666; width: 100px; font-weight: 600; }
.items-table th { background: ${company.color}; color: white; padding: 8px; text-align: left; }
.items-table td { padding: 8px; border-bottom: 1px solid #eee; }
.total-box { background: ${company.color}; color: white; padding: 15px; border-radius: 6px; text-align: right; margin-top: 20px; }
.total-box strong { font-size: 20px; display: block; margin-top: 5px; }
.footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 9px; color: #888; }
</style>
</head>
<body>
<table class="header">
<tr>
  <td style="width:80px;">${company.logo ? `<img src="${company.logo}" style="max-width:70px;max-height:55px;">` : ''}</td>
  <td style="padding:0 15px;">
    <div style="font-size:16px;font-weight:bold;color:${company.color};">${company.name}</div>
    <div style="font-size:9px;color:#555;">
      ${company.cnpj ? `<strong>CNPJ:</strong> ${company.cnpj}<br>` : ''}
      ${company.address || ''}<br>
      ${[company.phone, company.email].filter(Boolean).join(' • ')}
    </div>
  </td>
  <td style="width:140px;text-align:right;">
    <div style="background:${company.color};color:white;padding:10px 15px;border-radius:6px;display:inline-block;">
      <small style="font-size:8px;display:block;opacity:0.9;">ORÇAMENTO</small>
      <strong style="font-size:15px;">#${quoteNumber}</strong>
    </div>
    <div style="font-size:9px;color:#666;margin-top:6px;">${formatDate(quote.created_at)}</div>
  </td>
</tr>
</table>

<div class="section">
  <div class="section-title">DADOS DO CLIENTE</div>
  <table class="data-table">
    <tr><td class="label">Cliente:</td><td><strong>${quote.clients?.name || quote.client_name || '-'}</strong></td></tr>
    <tr><td class="label">CNPJ/CPF:</td><td>${quote.clients?.cnpj_cpf || '-'}</td></tr>
    <tr><td class="label">Endereço:</td><td>${quote.clients?.address || '-'}</td></tr>
    <tr><td class="label">Contato:</td><td>${quote.clients?.phone || '-'}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">DESCRIÇÃO DO SERVIÇO</div>
  <p style="padding:10px;background:#fafafa;border-radius:4px;">${quote.description || quote.title || 'Serviço técnico especializado'}</p>
</div>

${quote.items && quote.items.length > 0 ? `
<div class="section">
  <div class="section-title">ITENS DO ORÇAMENTO</div>
  <table class="items-table">
    <thead><tr><th>Descrição</th><th style="width:60px;text-align:center;">Qtd</th><th style="width:90px;text-align:right;">Valor Unit.</th><th style="width:90px;text-align:right;">Total</th></tr></thead>
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
<div class="section" style="margin-top:20px;">
  <div class="section-title">OBSERVAÇÕES</div>
  <p style="padding:10px;background:#fafafa;border-radius:4px;">${quote.notes}</p>
</div>
` : ''}

<div class="footer">
  Orçamento válido por 30 dias • Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
</div>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
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
    
    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }
    
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Banco de Horas #${overtimeNumber}</title>
<style>
@page { size: A4; margin: 15mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
table { border-collapse: collapse; width: 100%; }
.header { border-bottom: 3px solid ${company.color}; padding-bottom: 12px; margin-bottom: 20px; }
.section { margin-bottom: 20px; }
.section-title { background: #f5f5f5; border-left: 4px solid #f59e0b; padding: 8px 12px; font-weight: bold; margin-bottom: 10px; }
.data-table td { padding: 6px 8px; border-bottom: 1px solid #eee; }
.data-table .label { color: #666; width: 100px; font-weight: 600; }
.hours-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0; }
.hours-box strong { font-size: 28px; color: #d97706; display: block; margin-top: 5px; }
.sig-table { margin-top: 40px; }
.sig-cell { width: 50%; text-align: center; padding: 0 30px; }
.sig-line { border-top: 1px solid #333; margin: 40px 0 8px; }
.footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 9px; color: #888; }
</style>
</head>
<body>
<table class="header">
<tr>
  <td style="width:80px;">${company.logo ? `<img src="${company.logo}" style="max-width:70px;max-height:55px;">` : ''}</td>
  <td style="padding:0 15px;">
    <div style="font-size:16px;font-weight:bold;color:${company.color};">${company.name}</div>
    <div style="font-size:9px;color:#555;">
      ${company.cnpj ? `<strong>CNPJ:</strong> ${company.cnpj}<br>` : ''}
      ${company.address || ''}<br>
      ${[company.phone, company.email].filter(Boolean).join(' • ')}
    </div>
  </td>
  <td style="width:140px;text-align:right;">
    <div style="background:#f59e0b;color:white;padding:10px 15px;border-radius:6px;display:inline-block;">
      <small style="font-size:8px;display:block;opacity:0.9;">BANCO DE HORAS</small>
      <strong style="font-size:15px;">#${overtimeNumber}</strong>
    </div>
    <div style="font-size:9px;color:#666;margin-top:6px;">${formatDate(overtime.date || overtime.created_at)}</div>
  </td>
</tr>
</table>

<div class="section">
  <div class="section-title">INFORMAÇÕES DO REGISTRO</div>
  <table class="data-table">
    <tr><td class="label">Técnico:</td><td><strong>${techName}</strong></td></tr>
    <tr><td class="label">Cliente:</td><td>${overtime.clients?.name || overtime.client_name || '-'}</td></tr>
    <tr><td class="label">Data:</td><td>${formatDate(overtime.date || overtime.created_at)}</td></tr>
    <tr><td class="label">Tipo:</td><td>${overtime.type === 'extra' ? 'Hora Extra' : overtime.type === 'compensation' ? 'Compensação' : overtime.type || '-'}</td></tr>
  </table>
</div>

<div class="hours-box">
  <span style="font-size:12px;color:#92400e;">TOTAL DE HORAS</span>
  <strong>${overtime.hours || overtime.total_hours || 0}h</strong>
</div>

${overtime.description || overtime.notes ? `
<div class="section">
  <div class="section-title">DESCRIÇÃO / JUSTIFICATIVA</div>
  <p style="padding:15px;background:#fafafa;border-radius:4px;line-height:1.6;">${overtime.description || overtime.notes}</p>
</div>
` : ''}

<table class="sig-table">
<tr>
  <td class="sig-cell">
    <div class="sig-line"></div>
    <div style="font-weight:bold;">${techName}</div>
    <div style="font-size:9px;color:#666;">Técnico</div>
  </td>
  <td class="sig-cell">
    <div class="sig-line"></div>
    <div style="font-weight:bold;">Responsável</div>
    <div style="font-size:9px;color:#666;">Aprovação</div>
  </td>
</tr>
</table>

<div class="footer">
  Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
</div>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}
