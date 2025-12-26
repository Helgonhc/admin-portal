import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

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

// Converter hex para RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [37, 99, 235];
}

// Carregar imagem como base64
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateServiceOrderPDF(order: any) {
  try {
    const company = await getCompanyConfig();
    let technicianName = 'Técnico Responsável', technicianSignature = '', technicianDoc = '';
    
    if (order.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name, signature_url, cpf').eq('id', order.technician_id).maybeSingle();
      if (tech) { 
        technicianName = tech.full_name || technicianName; 
        technicianSignature = tech.signature_url || ''; 
        technicianDoc = tech.cpf || ''; 
      }
    }

    const { data: tasks } = await supabase.from('order_tasks').select('*').eq('order_id', order.id).order('created_at');
    const osNumber = formatOrderId(order.id, order.created_at);
    const photos = order.photos_url || order.photos || [];
    const report = order.execution_report || order.description || '';

    // Criar PDF
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const rgb = hexToRgb(company.color);
    let y = margin;

    // ========== CABEÇALHO ==========
    // Logo
    if (company.logo) {
      try {
        const logoBase64 = await loadImageAsBase64(company.logo);
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', margin, y, 20, 20);
        }
      } catch (e) { console.log('Erro ao carregar logo'); }
    }

    // Nome da empresa
    doc.setFontSize(16);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(company.name, margin + 25, y + 7);

    // Dados da empresa
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    let companyY = y + 12;
    if (company.cnpj) { doc.text(`CNPJ: ${company.cnpj}`, margin + 25, companyY); companyY += 4; }
    if (company.address) { doc.text(company.address, margin + 25, companyY); companyY += 4; }
    doc.text([company.phone, company.email].filter(Boolean).join(' | '), margin + 25, companyY);

    // Badge OS (direita)
    const badgeWidth = 45;
    const badgeX = pageWidth - margin - badgeWidth;
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(badgeX, y, badgeWidth, 18, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text('ORDEM DE SERVIÇO', badgeX + badgeWidth/2, y + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`#${osNumber}`, badgeX + badgeWidth/2, y + 13, { align: 'center' });
    
    // Data abaixo do badge
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(order.created_at).toLocaleDateString('pt-BR'), badgeX + badgeWidth/2, y + 22, { align: 'center' });

    // Linha separadora
    y += 28;
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ========== DADOS CLIENTE E SERVIÇO ==========
    const boxWidth = (contentWidth - 5) / 2;
    const boxHeight = 32;

    // Box Cliente
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2, 'FD');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text('CLIENTE', margin + 5, y + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(order.clients?.name || '-', margin + 5, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(order.clients?.cnpj || order.clients?.cnpj_cpf || '-', margin + 5, y + 18);
    doc.text(order.clients?.address || '-', margin + 5, y + 23, { maxWidth: boxWidth - 10 });
    doc.text(order.clients?.phone || '-', margin + 5, y + 28);

    // Box Serviço
    const boxX2 = margin + boxWidth + 5;
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(boxX2, y, boxWidth, boxHeight, 2, 2, 'FD');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text('SERVIÇO', boxX2 + 5, y + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(order.title || '-', boxX2 + 5, y + 13, { maxWidth: boxWidth - 10 });
    doc.setFont('helvetica', 'normal');
    doc.text(`Técnico: ${technicianName}`, boxX2 + 5, y + 18);
    doc.text(`Início: ${formatDateTime(order.checkin_at)}`, boxX2 + 5, y + 23);
    doc.text(`Término: ${formatDateTime(order.completed_at)}`, boxX2 + 5, y + 28);

    y += boxHeight + 8;

    // ========== CHECKLIST ==========
    if (tasks && tasks.length > 0) {
      // Título
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.roundedRect(margin, y, contentWidth, 7, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('CHECKLIST', margin + 5, y + 5);
      y += 9;

      // Items em 2 colunas
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8);
      const half = Math.ceil(tasks.length / 2);
      const col1 = tasks.slice(0, half);
      const col2 = tasks.slice(half);
      
      let checkY = y;
      col1.forEach((t: any, i: number) => {
        const icon = t.is_completed ? '✓' : '○';
        doc.setTextColor(t.is_completed ? 22 : 150, t.is_completed ? 163 : 150, t.is_completed ? 74 : 150);
        doc.text(`${icon} ${t.title}`, margin + 3, checkY + (i * 5));
      });
      col2.forEach((t: any, i: number) => {
        const icon = t.is_completed ? '✓' : '○';
        doc.setTextColor(t.is_completed ? 22 : 150, t.is_completed ? 163 : 150, t.is_completed ? 74 : 150);
        doc.text(`${icon} ${t.title}`, margin + contentWidth/2, checkY + (i * 5));
      });
      
      y += Math.max(col1.length, col2.length) * 5 + 5;
    }

    // ========== RELATÓRIO TÉCNICO ==========
    // Título
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(margin, y, contentWidth, 7, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO TÉCNICO', margin + 5, y + 5);
    y += 9;

    // Conteúdo do relatório
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const reportText = report || 'Nenhuma observação registrada.';
    const splitReport = doc.splitTextToSize(reportText, contentWidth - 10);
    
    // Verificar se precisa de nova página
    const reportHeight = splitReport.length * 4.5 + 10;
    if (y + reportHeight > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }
    
    // Box do relatório
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, y, contentWidth, reportHeight, 2, 2, 'FD');
    doc.text(splitReport, margin + 5, y + 6);
    y += reportHeight + 5;

    // ========== FOTOS ==========
    if (photos.length > 0) {
      // Verificar espaço
      if (y + 50 > pageHeight - 50) {
        doc.addPage();
        y = margin;
      }

      // Título
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.roundedRect(margin, y, contentWidth, 7, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`FOTOS (${photos.length})`, margin + 5, y + 5);
      y += 10;

      // Grid de fotos - 4 por linha
      const photoSize = (contentWidth - 15) / 4;
      let photoX = margin;
      let photoY = y;
      
      for (let i = 0; i < photos.length; i++) {
        // Nova linha a cada 4 fotos
        if (i > 0 && i % 4 === 0) {
          photoX = margin;
          photoY += photoSize + 5;
          
          // Nova página se necessário
          if (photoY + photoSize > pageHeight - 50) {
            doc.addPage();
            photoY = margin;
          }
        }

        try {
          const imgBase64 = await loadImageAsBase64(photos[i]);
          if (imgBase64) {
            // Borda arredondada (simulada com retângulo)
            doc.setFillColor(245, 245, 245);
            doc.setDrawColor(200, 200, 200);
            doc.roundedRect(photoX, photoY, photoSize, photoSize, 3, 3, 'FD');
            doc.addImage(imgBase64, 'JPEG', photoX + 2, photoY + 2, photoSize - 4, photoSize - 4);
          }
        } catch (e) {
          // Placeholder se falhar
          doc.setFillColor(240, 240, 240);
          doc.roundedRect(photoX, photoY, photoSize, photoSize, 3, 3, 'F');
        }
        
        photoX += photoSize + 5;
      }
      
      y = photoY + photoSize + 10;
    }

    // ========== ASSINATURAS ==========
    // Verificar espaço
    if (y + 45 > pageHeight - 20) {
      doc.addPage();
      y = margin;
    }

    const sigWidth = (contentWidth - 20) / 2;
    const sigY = y + 5;

    // Assinatura Técnico
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, sigY, sigWidth, 40, 2, 2, 'F');
    
    if (technicianSignature) {
      try {
        const sigBase64 = await loadImageAsBase64(technicianSignature);
        if (sigBase64) {
          doc.addImage(sigBase64, 'PNG', margin + sigWidth/2 - 20, sigY + 3, 40, 15);
        }
      } catch (e) {}
    }
    
    doc.setDrawColor(50, 50, 50);
    doc.line(margin + 15, sigY + 22, margin + sigWidth - 15, sigY + 22);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(technicianName, margin + sigWidth/2, sigY + 28, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Técnico Responsável', margin + sigWidth/2, sigY + 33, { align: 'center' });
    if (technicianDoc) {
      doc.text(`CPF: ${technicianDoc}`, margin + sigWidth/2, sigY + 37, { align: 'center' });
    }

    // Assinatura Cliente
    const sig2X = margin + sigWidth + 20;
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(sig2X, sigY, sigWidth, 40, 2, 2, 'F');
    
    if (order.signature_url) {
      try {
        const sigBase64 = await loadImageAsBase64(order.signature_url);
        if (sigBase64) {
          doc.addImage(sigBase64, 'PNG', sig2X + sigWidth/2 - 20, sigY + 3, 40, 15);
        }
      } catch (e) {}
    }
    
    doc.setDrawColor(50, 50, 50);
    doc.line(sig2X + 15, sigY + 22, sig2X + sigWidth - 15, sigY + 22);
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(order.signer_name || 'Responsável', sig2X + sigWidth/2, sigY + 28, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Cliente', sig2X + sigWidth/2, sigY + 33, { align: 'center' });
    if (order.signer_doc) {
      doc.text(`CPF: ${order.signer_doc}`, sig2X + sigWidth/2, sigY + 37, { align: 'center' });
    }

    // ========== RODAPÉ ==========
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth/2, pageHeight - 10, { align: 'center' });

    // Salvar/Abrir PDF
    doc.save(`OS_${osNumber}.pdf`);

  } catch (error) { 
    console.error('Erro PDF:', error); 
    alert('Erro ao gerar PDF'); 
  }
}


// ========== ORÇAMENTO PDF (mantém HTML por simplicidade) ==========
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
<style>
@page{margin:15mm;size:A4}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10pt;color:#333}
.header{display:flex;align-items:center;border-bottom:2px solid ${c};padding-bottom:10px;margin-bottom:15px}
.logo{width:50px;height:50px;margin-right:10px}.logo img{max-width:100%;max-height:100%}
.company{flex:1}.company h1{font-size:14pt;color:${c}}.company p{font-size:8pt;color:#666}
.badge{background:${c};color:#fff;padding:10px 15px;border-radius:5px;text-align:center}
.badge small{font-size:7pt;display:block}.badge strong{font-size:12pt}
.grid{display:flex;gap:10px;margin-bottom:15px}.box{flex:1;background:#f5f5f5;border:1px solid #ddd;border-radius:5px;padding:10px}
.box-title{font-size:9pt;font-weight:bold;color:${c};border-bottom:1px solid #ddd;padding-bottom:5px;margin-bottom:8px}
.box p{font-size:8pt;margin:3px 0}
table{width:100%;border-collapse:collapse;margin:15px 0}th{background:${c};color:#fff;padding:8px;text-align:left;font-size:9pt}
td{padding:8px;border-bottom:1px solid #eee;font-size:9pt}.total{background:#f0f0f0;font-weight:bold}
.total td{font-size:11pt;color:${c}}.validity{text-align:center;padding:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:5px;margin-top:15px}
.footer{margin-top:20px;text-align:center;font-size:7pt;color:#999;border-top:1px solid #ddd;padding-top:10px}
</style></head><body>
<div class="header">
<div class="logo">${company.logo ? `<img src="${company.logo}"/>` : ''}</div>
<div class="company"><h1>${company.name}</h1>${company.cnpj ? `<p>CNPJ: ${company.cnpj}</p>` : ''}<p>${[company.phone, company.email].filter(Boolean).join(' | ')}</p></div>
<div class="badge"><small>ORÇAMENTO</small><strong>#${quoteNumber}</strong></div>
</div>
<div class="grid">
<div class="box"><div class="box-title">CLIENTE</div><p><strong>${clientData?.name || '-'}</strong></p><p>${clientData?.cnpj || '-'}</p><p>${clientData?.phone || '-'} | ${clientData?.email || '-'}</p></div>
<div class="box"><div class="box-title">ORÇAMENTO</div><p><strong>${quote.title || 'Orçamento de Serviços'}</strong></p><p>Status: ${quote.status === 'approved' ? 'Aprovado' : quote.status === 'rejected' ? 'Rejeitado' : 'Pendente'}</p><p>Validade: ${validUntil}</p></div>
</div>
<table><thead><tr><th>Descrição</th><th style="width:60px;text-align:right">Qtd</th><th style="width:90px;text-align:right">Valor Unit.</th><th style="width:90px;text-align:right">Subtotal</th></tr></thead>
<tbody>${items.length > 0 ? items.map((i: any) => `<tr><td>${i.description || i.name || '-'}</td><td style="text-align:right">${i.quantity || 1}</td><td style="text-align:right">R$ ${(i.unit_price || 0).toFixed(2)}</td><td style="text-align:right">R$ ${((i.quantity || 1) * (i.unit_price || 0)).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#999">Nenhum item</td></tr>'}
<tr class="total"><td colspan="3" style="text-align:right">TOTAL:</td><td style="text-align:right">R$ ${total.toFixed(2)}</td></tr></tbody></table>
${quote.description ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:10px;border-radius:5px;font-size:9pt"><strong>Observações:</strong> ${quote.description}</div>` : ''}
<div class="validity"><p style="font-size:10pt;color:#166534">Orçamento válido até <strong>${validUntil}</strong></p></div>
<div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;

    openPrintWindow(html);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}

// ========== BANCO DE HORAS PDF ==========
export async function generateOvertimePDF(entry: any) {
  try {
    const company = await getCompanyConfig();
    const entryNumber = `BH-${new Date(entry.entry_date).getFullYear()}${String(new Date(entry.entry_date).getMonth() + 1).padStart(2, '0')}-${entry.id.slice(0, 4).toUpperCase()}`;
    const c = company.color;
    const typeLabel = entry.entry_type === 'overtime' ? 'HORA EXTRA' : entry.entry_type === 'compensation' ? 'COMPENSAÇÃO' : 'AUSÊNCIA';
    const statusLabel = entry.status === 'aprovado' ? 'APROVADO' : entry.status === 'rejeitado' ? 'REJEITADO' : 'PENDENTE';
    const statusColor = entry.status === 'aprovado' ? '#16a34a' : entry.status === 'rejeitado' ? '#dc2626' : '#f59e0b';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Banco de Horas</title>
<style>
@page{margin:15mm;size:A4}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10pt;color:#333}
.header{display:flex;align-items:center;border-bottom:2px solid ${c};padding-bottom:10px;margin-bottom:15px}
.logo{width:50px;height:50px;margin-right:10px}.logo img{max-width:100%;max-height:100%}
.company{flex:1}.company h1{font-size:14pt;color:${c}}.company p{font-size:8pt;color:#666}
.badge{background:${c};color:#fff;padding:10px 15px;border-radius:5px;text-align:center}
.badge small{font-size:7pt;display:block}.badge strong{font-size:12pt}
.status{text-align:center;padding:12px;background:${statusColor}20;border:2px solid ${statusColor};border-radius:5px;margin-bottom:15px}
.status p{font-size:14pt;font-weight:bold;color:${statusColor}}
.hours{text-align:center;padding:25px;background:#f5f5f5;border-radius:8px;margin-bottom:15px}
.hours .value{font-size:40pt;font-weight:bold;color:${c}}.hours .label{font-size:11pt;color:#666}.hours .type{font-size:12pt;color:#333;font-weight:600;margin-top:5px}
.grid{display:flex;gap:10px;margin-bottom:15px}.box{flex:1;background:#f5f5f5;border:1px solid #ddd;border-radius:5px;padding:10px}
.box-title{font-size:9pt;font-weight:bold;color:${c};border-bottom:1px solid #ddd;padding-bottom:5px;margin-bottom:8px}.box p{font-size:8pt;margin:3px 0}
.sigs{display:flex;margin-top:25px}.sig{flex:1;text-align:center;padding:0 20px}
.sig-img{height:40px}.sig-line{border-top:1px solid #333;margin:5px 20px}.sig-name{font-size:9pt;font-weight:bold}.sig-role{font-size:8pt;color:#666}
.footer{margin-top:20px;text-align:center;font-size:7pt;color:#999;border-top:1px solid #ddd;padding-top:10px}
</style></head><body>
<div class="header">
<div class="logo">${company.logo ? `<img src="${company.logo}"/>` : ''}</div>
<div class="company"><h1>${company.name}</h1>${company.cnpj ? `<p>CNPJ: ${company.cnpj}</p>` : ''}<p>${[company.phone, company.email].filter(Boolean).join(' | ')}</p></div>
<div class="badge"><small>BANCO DE HORAS</small><strong>#${entryNumber}</strong></div>
</div>
<div class="status"><p>${statusLabel}</p></div>
<div class="hours"><div class="value">${entry.total_hours}h</div><div class="label">Total de Horas</div><div class="type">${typeLabel}</div></div>
<div class="grid">
<div class="box"><div class="box-title">FUNCIONÁRIO</div><p><strong>${entry.profiles?.full_name || '-'}</strong></p><p>CPF: ${entry.profiles?.cpf || '-'}</p></div>
<div class="box"><div class="box-title">LANÇAMENTO</div><p>Data: ${new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p><p>Entrada: ${entry.start_time?.substring(0, 5) || '-'} | Saída: ${entry.end_time?.substring(0, 5) || '-'}</p></div>
</div>
${entry.reason ? `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:10px;border-radius:5px;font-size:9pt;margin-bottom:15px"><strong>Motivo:</strong> ${entry.reason}</div>` : ''}
<div class="sigs">
<div class="sig">${entry.employee_signature ? `<img src="${entry.employee_signature}" class="sig-img"/>` : '<div style="height:35px"></div>'}<div class="sig-line"></div><div class="sig-name">${entry.profiles?.full_name || 'Funcionário'}</div><div class="sig-role">Funcionário</div></div>
<div class="sig">${entry.admin_signature ? `<img src="${entry.admin_signature}" class="sig-img"/>` : '<div style="height:35px"></div>'}<div class="sig-line"></div><div class="sig-name">${entry.approver?.full_name || 'Responsável'}</div><div class="sig-role">Aprovador</div></div>
</div>
<div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;

    openPrintWindow(html);
  } catch (error) { console.error('Erro PDF:', error); alert('Erro ao gerar PDF'); }
}

function openPrintWindow(html: string) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups para gerar o PDF'); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 300);
}
