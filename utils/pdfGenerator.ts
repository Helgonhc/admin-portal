import { supabase } from '../lib/supabase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Formatar data/hora
const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '-'; }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch { return '-'; }
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

// Converter imagem para base64
async function imageToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return url; }
}


// ============================================
// GERAR PDF DA ORDEM DE SERVIÇO
// ============================================
export async function generateServiceOrderPDF(order: any) {
  // Criar loading
  const loadingDiv = document.createElement('div');
  loadingDiv.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999;">
      <div style="background:white;padding:30px 50px;border-radius:12px;text-align:center;">
        <div style="width:40px;height:40px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 15px;"></div>
        <p style="font-size:16px;color:#333;">Gerando PDF...</p>
      </div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(loadingDiv);

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

    // Converter imagens para base64
    let logoBase64 = '';
    if (company.logo) logoBase64 = await imageToBase64(company.logo);
    
    let techSigBase64 = '';
    if (techSig) techSigBase64 = await imageToBase64(techSig);
    
    let clientSigBase64 = '';
    if (order.signature_url) clientSigBase64 = await imageToBase64(order.signature_url);
    
    const photosBase64: string[] = [];
    for (const photo of photos) {
      photosBase64.push(await imageToBase64(photo));
    }

    // Criar container invisível
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:white;';
    
    container.innerHTML = createPDFHTML(
      company, order, osNumber, techName, techSigBase64, techDoc, 
      tasks || [], report, photosBase64, logoBase64, clientSigBase64
    );
    
    document.body.appendChild(container);

    // Aguardar renderização
    await new Promise(r => setTimeout(r, 500));

    // Gerar PDF com html2canvas + jsPDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // Capturar página 1 (dados)
    const page1 = container.querySelector('#page1') as HTMLElement;
    if (page1) {
      const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true, logging: false });
      const imgData1 = canvas1.toDataURL('image/jpeg', 0.95);
      const imgHeight1 = (canvas1.height * contentWidth) / canvas1.width;
      pdf.addImage(imgData1, 'JPEG', margin, margin, contentWidth, imgHeight1);
    }

    // Capturar página 2 (fotos + assinaturas) se existir
    const page2 = container.querySelector('#page2') as HTMLElement;
    if (page2 && photos.length > 0) {
      pdf.addPage();
      const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, logging: false });
      const imgData2 = canvas2.toDataURL('image/jpeg', 0.95);
      const imgHeight2 = (canvas2.height * contentWidth) / canvas2.width;
      pdf.addImage(imgData2, 'JPEG', margin, margin, contentWidth, imgHeight2);
    }

    // Baixar PDF
    pdf.save(`OS_${osNumber}.pdf`);

    // Limpar
    document.body.removeChild(container);
    document.body.removeChild(loadingDiv);

  } catch (error) {
    console.error('Erro PDF:', error);
    document.body.removeChild(loadingDiv);
    alert('Erro ao gerar PDF. Tente novamente.');
  }
}


// ============================================
// HTML DO PDF - DESIGN PROFISSIONAL
// ============================================
function createPDFHTML(
  company: any, order: any, osNumber: string, techName: string, 
  techSig: string, techDoc: string, tasks: any[], report: string,
  photos: string[], logo: string, clientSig: string
): string {
  const color = company.color || '#1e40af';
  const hasPhotos = photos.length > 0;
  
  return `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
  .page { width: 794px; min-height: 1123px; padding: 40px; background: white; }
  
  /* Header */
  .header { display: flex; align-items: center; border-bottom: 4px solid ${color}; padding-bottom: 20px; margin-bottom: 25px; }
  .logo { width: 90px; }
  .logo img { max-width: 80px; max-height: 65px; }
  .company { flex: 1; padding: 0 25px; }
  .company h1 { font-size: 22px; color: ${color}; margin-bottom: 6px; font-weight: 700; }
  .company p { font-size: 11px; color: #555; margin: 2px 0; }
  .os-badge { text-align: right; }
  .os-box { background: linear-gradient(135deg, ${color}, ${color}dd); color: white; padding: 15px 22px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
  .os-box small { font-size: 10px; display: block; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }
  .os-box strong { font-size: 20px; font-weight: 700; }
  .os-date { font-size: 11px; color: #666; margin-top: 10px; }
  
  /* Sections */
  .section { margin-bottom: 22px; }
  .section-title { background: linear-gradient(90deg, #f8f9fa, white); border-left: 5px solid ${color}; padding: 10px 15px; font-size: 13px; font-weight: 700; color: #333; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
  
  /* Grid */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 22px; }
  
  /* Data Table */
  .data-box { background: #fafafa; border-radius: 8px; padding: 15px; }
  .data-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
  .data-row:last-child { border-bottom: none; }
  .data-label { width: 100px; color: #666; font-weight: 600; font-size: 11px; }
  .data-value { flex: 1; color: #222; font-size: 12px; }
  .data-value strong { color: #111; }
  
  /* Checklist */
  .checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .check-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f9fafb; border-radius: 6px; font-size: 11px; }
  .check-icon { width: 20px; height: 20px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
  .check-done .check-icon { background: #dcfce7; color: #16a34a; }
  .check-pending .check-icon { background: #f3f4f6; color: #9ca3af; }
  
  /* Report */
  .report-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 10px; font-size: 12px; line-height: 1.8; min-height: 100px; }
  .report-box p { margin-bottom: 12px; text-indent: 25px; text-align: justify; }
  
  /* Photos - SEM CAIXA, CANTOS ARREDONDADOS, SEM CORTAR */
  .photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 15px; }
  .photo-item { width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; }
  .photo-item img { max-width: 200px; max-height: 200px; object-fit: contain; border-radius: 20px; }
  
  /* Signatures */
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 40px; padding: 0 40px; }
  .sig-col { text-align: center; }
  .sig-img-box { height: 60px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 8px; }
  .sig-img-box img { max-height: 55px; max-width: 160px; }
  .sig-line { border-top: 2px solid #333; margin: 10px 0; }
  .sig-name { font-weight: 700; font-size: 12px; color: #111; }
  .sig-role { font-size: 11px; color: #666; margin-top: 3px; }
  .sig-doc { font-size: 10px; color: #999; margin-top: 4px; }
  
  /* Footer */
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
</style>

<!-- PÁGINA 1: DADOS -->
<div id="page1" class="page">
  <div class="header">
    <div class="logo">
      ${logo ? `<img src="${logo}" alt="Logo">` : ''}
    </div>
    <div class="company">
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

  <div class="grid-2">
    <div class="section">
      <div class="section-title">Dados do Cliente</div>
      <div class="data-box">
        <div class="data-row"><span class="data-label">Cliente:</span><span class="data-value"><strong>${order.clients?.name || '-'}</strong></span></div>
        <div class="data-row"><span class="data-label">CNPJ/CPF:</span><span class="data-value">${order.clients?.cnpj_cpf || '-'}</span></div>
        <div class="data-row"><span class="data-label">Endereço:</span><span class="data-value">${order.clients?.address || '-'}</span></div>
        <div class="data-row"><span class="data-label">Contato:</span><span class="data-value">${order.clients?.phone || '-'}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Dados da Execução</div>
      <div class="data-box">
        <div class="data-row"><span class="data-label">Serviço:</span><span class="data-value"><strong>${order.title || '-'}</strong></span></div>
        <div class="data-row"><span class="data-label">Técnico:</span><span class="data-value">${techName}</span></div>
        <div class="data-row"><span class="data-label">Início:</span><span class="data-value">${formatDateTime(order.checkin_at)}</span></div>
        <div class="data-row"><span class="data-label">Término:</span><span class="data-value">${formatDateTime(order.completed_at)}</span></div>
      </div>
    </div>
  </div>

  ${tasks.length > 0 ? `
  <div class="section">
    <div class="section-title">Checklist de Verificação</div>
    <div class="checklist">
      ${tasks.map(t => `
        <div class="check-item ${t.is_completed ? 'check-done' : 'check-pending'}">
          <span class="check-icon">${t.is_completed ? '✓' : '○'}</span>
          <span>${t.title}</span>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Relatório Técnico / Observações</div>
    <div class="report-box">
      ${report.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('') || '<p><em>Nenhuma observação registrada.</em></p>'}
    </div>
  </div>

  ${!hasPhotos ? `
  <div class="signatures">
    <div class="sig-col">
      <div class="sig-img-box">${techSig ? `<img src="${techSig}" alt="Assinatura">` : ''}</div>
      <div class="sig-line"></div>
      <div class="sig-name">${techName}</div>
      <div class="sig-role">Técnico Responsável</div>
      ${techDoc ? `<div class="sig-doc">CPF: ${techDoc}</div>` : ''}
    </div>
    <div class="sig-col">
      <div class="sig-img-box">${clientSig ? `<img src="${clientSig}" alt="Assinatura">` : ''}</div>
      <div class="sig-line"></div>
      <div class="sig-name">${order.signer_name || 'Responsável'}</div>
      <div class="sig-role">Responsável pelo Cliente</div>
      ${order.signer_doc ? `<div class="sig-doc">CPF: ${order.signer_doc}</div>` : ''}
    </div>
  </div>
  <div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
  ` : ''}
</div>

${hasPhotos ? `
<!-- PÁGINA 2: FOTOS + ASSINATURAS -->
<div id="page2" class="page">
  <div class="section">
    <div class="section-title">Registro Fotográfico (${photos.length} foto${photos.length > 1 ? 's' : ''})</div>
    <div class="photos-grid">
      ${photos.map((p, i) => `<div class="photo-item"><img src="${p}" alt="Foto ${i+1}"></div>`).join('')}
    </div>
  </div>

  <div class="signatures">
    <div class="sig-col">
      <div class="sig-img-box">${techSig ? `<img src="${techSig}" alt="Assinatura">` : ''}</div>
      <div class="sig-line"></div>
      <div class="sig-name">${techName}</div>
      <div class="sig-role">Técnico Responsável</div>
      ${techDoc ? `<div class="sig-doc">CPF: ${techDoc}</div>` : ''}
    </div>
    <div class="sig-col">
      <div class="sig-img-box">${clientSig ? `<img src="${clientSig}" alt="Assinatura">` : ''}</div>
      <div class="sig-line"></div>
      <div class="sig-name">${order.signer_name || 'Responsável'}</div>
      <div class="sig-role">Responsável pelo Cliente</div>
      ${order.signer_doc ? `<div class="sig-doc">CPF: ${order.signer_doc}</div>` : ''}
    </div>
  </div>

  <div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
</div>
` : ''}
`;
}


// ============================================
// GERAR PDF DE ORÇAMENTO
// ============================================
export async function generateQuotePDF(quote: any) {
  const loadingDiv = document.createElement('div');
  loadingDiv.innerHTML = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999;"><div style="background:white;padding:30px 50px;border-radius:12px;text-align:center;"><div style="width:40px;height:40px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 15px;"></div><p>Gerando PDF...</p></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  document.body.appendChild(loadingDiv);

  try {
    const company = await getCompanyConfig();
    const quoteNumber = quote.id?.slice(0, 8).toUpperCase() || 'ORC';
    let logo = '';
    if (company.logo) logo = await imageToBase64(company.logo);

    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:white;';
    container.innerHTML = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
  .page { width: 794px; padding: 40px; background: white; }
  .header { display: flex; align-items: center; border-bottom: 4px solid ${company.color}; padding-bottom: 20px; margin-bottom: 25px; }
  .logo img { max-width: 80px; max-height: 65px; }
  .company { flex: 1; padding: 0 25px; }
  .company h1 { font-size: 22px; color: ${company.color}; }
  .company p { font-size: 11px; color: #555; }
  .section { margin-bottom: 22px; }
  .section-title { background: #f8f9fa; border-left: 5px solid ${company.color}; padding: 10px 15px; font-size: 13px; font-weight: 700; margin-bottom: 15px; }
  .data-box { background: #fafafa; border-radius: 8px; padding: 15px; }
  .data-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
  .data-label { width: 100px; color: #666; font-weight: 600; font-size: 11px; }
  .data-value { flex: 1; font-size: 12px; }
  .total-box { background: ${company.color}; color: white; padding: 20px; border-radius: 10px; text-align: right; margin-top: 25px; }
  .total-box span { font-size: 14px; opacity: 0.9; }
  .total-box strong { font-size: 28px; display: block; margin-top: 5px; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #999; }
</style>
<div id="page1" class="page">
  <div class="header">
    <div class="logo">${logo ? `<img src="${logo}">` : ''}</div>
    <div class="company">
      <h1>${company.name}</h1>
      ${company.cnpj ? `<p><strong>CNPJ:</strong> ${company.cnpj}</p>` : ''}
      <p>${[company.phone, company.email].filter(Boolean).join(' • ')}</p>
    </div>
    <div style="text-align:right;">
      <div style="background:${company.color};color:white;padding:15px 22px;border-radius:10px;display:inline-block;">
        <small style="font-size:10px;display:block;opacity:0.9;">ORÇAMENTO</small>
        <strong style="font-size:20px;">#${quoteNumber}</strong>
      </div>
      <div style="font-size:11px;color:#666;margin-top:10px;">${formatDate(quote.created_at)}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="data-box">
      <div class="data-row"><span class="data-label">Cliente:</span><span class="data-value"><strong>${quote.clients?.name || '-'}</strong></span></div>
      <div class="data-row"><span class="data-label">CNPJ/CPF:</span><span class="data-value">${quote.clients?.cnpj_cpf || '-'}</span></div>
      <div class="data-row"><span class="data-label">Contato:</span><span class="data-value">${quote.clients?.phone || '-'}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Descrição do Serviço</div>
    <div class="data-box"><p style="font-size:12px;line-height:1.6;">${quote.description || quote.title || 'Serviço técnico'}</p></div>
  </div>
  <div class="total-box">
    <span>VALOR TOTAL</span>
    <strong>R$ ${(quote.total_value || quote.value || 0).toFixed(2)}</strong>
  </div>
  <div class="footer">Orçamento válido por 30 dias • Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
</div>`;
    document.body.appendChild(container);
    await new Promise(r => setTimeout(r, 300));

    const pdf = new jsPDF('p', 'mm', 'a4');
    const page1 = container.querySelector('#page1') as HTMLElement;
    const canvas = await html2canvas(page1, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const imgHeight = (canvas.height * 190) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 10, 10, 190, imgHeight);
    pdf.save(`Orcamento_${quoteNumber}.pdf`);

    document.body.removeChild(container);
    document.body.removeChild(loadingDiv);
  } catch (error) {
    console.error('Erro:', error);
    document.body.removeChild(loadingDiv);
    alert('Erro ao gerar PDF');
  }
}

// ============================================
// GERAR PDF DE BANCO DE HORAS
// ============================================
export async function generateOvertimePDF(overtime: any) {
  const loadingDiv = document.createElement('div');
  loadingDiv.innerHTML = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999;"><div style="background:white;padding:30px 50px;border-radius:12px;text-align:center;"><div style="width:40px;height:40px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 15px;"></div><p>Gerando PDF...</p></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  document.body.appendChild(loadingDiv);

  try {
    const company = await getCompanyConfig();
    const overtimeNumber = overtime.id?.slice(0, 8).toUpperCase() || 'BH';
    let techName = 'Técnico';
    if (overtime.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name').eq('id', overtime.technician_id).maybeSingle();
      if (tech) techName = tech.full_name || techName;
    }
    let logo = '';
    if (company.logo) logo = await imageToBase64(company.logo);

    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:white;';
    container.innerHTML = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
  .page { width: 794px; padding: 40px; background: white; }
  .header { display: flex; align-items: center; border-bottom: 4px solid ${company.color}; padding-bottom: 20px; margin-bottom: 25px; }
  .section { margin-bottom: 22px; }
  .section-title { background: #f8f9fa; border-left: 5px solid #f59e0b; padding: 10px 15px; font-size: 13px; font-weight: 700; margin-bottom: 15px; }
  .data-box { background: #fafafa; border-radius: 8px; padding: 15px; }
  .data-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
  .data-label { width: 100px; color: #666; font-weight: 600; font-size: 11px; }
  .data-value { flex: 1; font-size: 12px; }
  .hours-box { background: #fef3c7; border: 3px solid #f59e0b; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0; }
  .hours-box span { font-size: 14px; color: #92400e; }
  .hours-box strong { font-size: 36px; color: #d97706; display: block; margin-top: 8px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 50px; padding: 0 40px; }
  .sig-col { text-align: center; }
  .sig-line { border-top: 2px solid #333; margin: 50px 0 10px; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #999; }
</style>
<div id="page1" class="page">
  <div class="header">
    <div style="width:90px;">${logo ? `<img src="${logo}" style="max-width:80px;max-height:65px;">` : ''}</div>
    <div style="flex:1;padding:0 25px;">
      <h1 style="font-size:22px;color:${company.color};">${company.name}</h1>
      ${company.cnpj ? `<p style="font-size:11px;color:#555;"><strong>CNPJ:</strong> ${company.cnpj}</p>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="background:#f59e0b;color:white;padding:15px 22px;border-radius:10px;display:inline-block;">
        <small style="font-size:10px;display:block;opacity:0.9;">BANCO DE HORAS</small>
        <strong style="font-size:20px;">#${overtimeNumber}</strong>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Informações do Registro</div>
    <div class="data-box">
      <div class="data-row"><span class="data-label">Técnico:</span><span class="data-value"><strong>${techName}</strong></span></div>
      <div class="data-row"><span class="data-label">Cliente:</span><span class="data-value">${overtime.clients?.name || '-'}</span></div>
      <div class="data-row"><span class="data-label">Data:</span><span class="data-value">${formatDate(overtime.date || overtime.created_at)}</span></div>
      <div class="data-row"><span class="data-label">Tipo:</span><span class="data-value">${overtime.type === 'extra' ? 'Hora Extra' : 'Compensação'}</span></div>
    </div>
  </div>
  <div class="hours-box">
    <span>TOTAL DE HORAS</span>
    <strong>${overtime.hours || overtime.total_hours || 0}h</strong>
  </div>
  ${overtime.description ? `<div class="section"><div class="section-title">Descrição</div><div class="data-box"><p style="font-size:12px;line-height:1.6;">${overtime.description}</p></div></div>` : ''}
  <div class="sig-grid">
    <div class="sig-col"><div class="sig-line"></div><div style="font-weight:700;">${techName}</div><div style="font-size:11px;color:#666;">Técnico</div></div>
    <div class="sig-col"><div class="sig-line"></div><div style="font-weight:700;">Responsável</div><div style="font-size:11px;color:#666;">Aprovação</div></div>
  </div>
  <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
</div>`;
    document.body.appendChild(container);
    await new Promise(r => setTimeout(r, 300));

    const pdf = new jsPDF('p', 'mm', 'a4');
    const page1 = container.querySelector('#page1') as HTMLElement;
    const canvas = await html2canvas(page1, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const imgHeight = (canvas.height * 190) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 10, 10, 190, imgHeight);
    pdf.save(`BancoHoras_${overtimeNumber}.pdf`);

    document.body.removeChild(container);
    document.body.removeChild(loadingDiv);
  } catch (error) {
    console.error('Erro:', error);
    document.body.removeChild(loadingDiv);
    alert('Erro ao gerar PDF');
  }
}
