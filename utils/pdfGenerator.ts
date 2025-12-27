import { supabase } from '../lib/supabase';

const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  try {
    let s = String(dateString).replace('Z', '').replace(/\+\d{2}:\d{2}$/, '').replace(/\.\d+$/, '');
    if (s.includes('T')) {
      const parts = s.split('T');
      const [y, m, d] = parts[0].split('-');
      const time = parts[1] || '00:00';
      const [h, min] = time.split(':');
      return `${d}/${m}/${y} ${h}:${min}`;
    }
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  } catch { return String(dateString); }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    let s = String(dateString).split('T')[0];
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  } catch { return String(dateString); }
};

const formatOrderId = (id: string, dateString: string) => {
  if (!id) return 'OS';
  try {
    const s = String(dateString).split('T')[0];
    const [y, m] = s.split('-');
    return `${y}${m}-${id.slice(0, 4).toUpperCase()}`;
  } catch { return id.slice(0, 6).toUpperCase(); }
};

async function getCompanyConfig() {
  const { data: config } = await supabase.from('app_config').select('*').limit(1).maybeSingle();
  return {
    name: config?.company_name || 'CHAMEI TECNOLOGIA',
    cnpj: config?.company_cnpj || config?.cnpj || '00.000.000/0000-00',
    address: config?.company_address || config?.address || 'Endereço não configurado',
    phone: config?.company_phone || config?.phone || '',
    email: config?.company_email || config?.email || '',
    logo: config?.company_logo || config?.logo_url || '',
    color: config?.primary_color || '#4f46e5'
  };
}

const getCommonCSS = (color: string) => `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  
  @page { size: A4; margin: 15mm; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
  }
  
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  body { font-family: 'Inter', sans-serif; font-size: 10px; color: #1e293b; line-height: 1.5; background: #fff; }
  
  .container { width: 100%; max-width: 800px; margin: 0 auto; }
  
  /* HEADER PREMIUM */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 4px solid ${color}; padding-bottom: 20px; }
  .company-info-box { flex: 1; }
  .company-name { font-size: 22px; font-weight: 800; color: ${color}; letter-spacing: -1px; margin-bottom: 4px; text-transform: uppercase; }
  .company-details { font-size: 8.5px; color: #64748b; font-weight: 500; line-height: 1.3; }
  
  .document-meta { text-align: right; }
  .document-type { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px; }
  .document-id { font-size: 28px; font-weight: 900; color: #0f172a; line-height: 1; letter-spacing: -1px; }
  .document-date { font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 5px; }

  /* BLOCKS & GRIDS */
  .section { margin-bottom: 25px; }
  .section-title { font-size: 10px; font-weight: 800; color: ${color}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .section-title::after { content: ''; flex: 1; height: 1px; background: #f1f5f9; }

  .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
  .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
  
  .info-row { display: flex; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
  .info-row:last-child { margin-bottom:0; border-bottom:0; padding-bottom:0; }
  .info-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; width: 100px; }
  .info-value { font-size: 10px; font-weight: 600; color: #334155; flex: 1; }

  /* TABLE DESIGN */
  .data-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .data-table th { background: #f8fafc; padding: 12px 15px; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; text-align: left; border-bottom: 1px solid #e2e8f0; }
  .data-table td { padding: 12px 15px; font-size: 10px; font-weight: 500; color: #334155; border-bottom: 1px solid #f1f5f9; }
  .data-table tr:last-child td { border-bottom: 0; }
  .data-table tr:nth-child(even) { background-color: #fafbfc; }

  .total-row { background: ${color} !important; color: white !important; }
  .total-row td { color: white !important; font-size: 12px !important; font-weight: 800 !important; border: 0 !important; padding: 15px !important; }

  /* TECH REPORT */
  .report-container { background: #fff; border: 2px solid #f1f5f9; border-left: 5px solid ${color}; border-radius: 8px; padding: 20px; font-size: 11px; color: #334155; line-height: 1.6; min-height: 120px; white-space: pre-wrap; }

  /* PHOTOS */
  .photos-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 10px; }
  .photo-item { aspect-ratio: 1; border-radius: 10px; overflow: hidden; border: 2px solid #f1f5f9; background: #f8fafc; }
  .photo-item img { width: 100%; height: 100%; object-fit: cover; }

  /* SIGNATURES */
  .signature-area { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; page-break-inside: avoid; }
  .sig-box { text-align: center; }
  .sig-image-wrap { height: 80px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 10px; border-bottom: 2px solid #f1f5f9; padding-bottom: 5px; }
  .sig-image-wrap img { max-height: 75px; max-width: 100%; mix-blend-mode: multiply; }
  .sig-info { font-size: 10px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
  .sig-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }

  /* FOOTER */
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
  .footer-text { font-size: 8px; color: #94a3b8; font-weight: 500; }
  
  .print-btn { position: fixed; bottom: 30px; right: 30px; background: ${color}; color: white; border: none; padding: 16px 32px; border-radius: 50px; font-family: 'Inter', sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2); z-index: 1000; transition: transform 0.2s; }
  .print-btn:hover { transform: translateY(-2px); }
`;

export async function generateServiceOrderPDF(order: any) {
  try {
    const company = await getCompanyConfig();
    let techName = '-', techSig = '';

    if (order.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name, signature_url').eq('id', order.technician_id).maybeSingle();
      if (tech) {
        techName = tech.full_name || '-';
        techSig = tech.signature_url || '';
      }
    }

    const { data: orderItems } = await supabase.from('service_order_items').select('*').eq('order_id', order.id).order('created_at');
    const osNumber = formatOrderId(order.id, order.created_at);
    const photos = order.photos_url || order.photos || [];
    const color = company.color;
    const totalItems = orderItems?.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0) || 0;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>ORDEM DE SERVIÇO - #${osNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimir PDF 📄</button>
  
  <div class="container">
    <div class="header">
      <div class="company-info-box">
        ${company.logo ? `<img src="${company.logo}" style="max-height: 60px; margin-bottom: 10px; display: block;">` : ''}
        <h1 class="company-name">${company.name}</h1>
        <div class="company-details">
          CNPJ: ${company.cnpj}<br>
          ${company.address}<br>
          Contato: ${company.phone} ${company.email ? `• ${company.email}` : ''}
        </div>
      </div>
      <div class="document-meta">
        <div class="document-type">Relatório de Atendimento</div>
        <div class="document-id">OS #${osNumber}</div>
        <div class="document-date">Emitido em ${formatDate(new Date().toISOString())}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Informações do Cliente</div>
      <div class="card-grid">
        <div class="info-card">
          <div class="info-row"><span class="info-label">Cliente</span><span class="info-value">${order.clients?.name || '-'}</span></div>
          <div class="info-row"><span class="info-label">Documento</span><span class="info-value">${order.clients?.cnpj_cpf || '-'}</span></div>
          <div class="info-row"><span class="info-label">Endereço</span><span class="info-value">${order.clients?.address || '-'}</span></div>
        </div>
        <div class="info-card">
          <div class="info-row"><span class="info-label">Técnico Resp.</span><span class="info-value">${techName}</span></div>
          <div class="info-row"><span class="info-label">Início</span><span class="info-value">${formatDateTime(order.checkin_at)}</span></div>
          <div class="info-row"><span class="info-label">Finalização</span><span class="info-value">${formatDateTime(order.completed_at || order.updated_at)}</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Equipamento / Ativo</div>
      <div class="info-card" style="width: 100%;">
        <div class="card-grid" style="grid-template-columns: repeat(3, 1fr);">
          <div class="info-row"><span class="info-label" style="width: 60px;">Nome</span><span class="info-value">${order.equipments?.name || '-'}</span></div>
          <div class="info-row"><span class="info-label" style="width: 60px;">Modelo</span><span class="info-value">${order.equipments?.model || '-'}</span></div>
          <div class="info-row"><span class="info-label" style="width: 60px;">Série</span><span class="info-value">${order.equipments?.serial_number || '-'}</span></div>
        </div>
      </div>
    </div>

    ${orderItems && orderItems.length > 0 ? `
    <div class="section">
      <div class="section-title">Peças, Materiais e Mão de Obra</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 50%;">Item / Serviço</th>
            <th style="text-align: center;">Qtd</th>
            <th style="text-align: right;">v. Unitário</th>
            <th style="text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${orderItems.map((item: any) => `
            <tr>
              <td>${item.description}</td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">R$ ${item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td style="text-align: right; font-weight: 700;">R$ ${(item.quantity * item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">VALOR TOTAL DO ATENDIMENTO</td>
            <td style="text-align: right;">R$ ${totalItems.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
    </div>` : ''}

    <div class="section">
      <div class="section-title">Parecer Técnico / Relatório de Execução</div>
      <div class="report-container">${order.execution_report || order.description || 'Nenhum relatório técnico textual foi anexado a este atendimento.'}</div>
    </div>

    ${photos.length > 0 ? `
    <div class="section" style="page-break-before: auto;">
      <div class="section-title">Evidências Fotográficas</div>
      <div class="photos-grid">
        ${photos.map((url: string) => `
          <div class="photo-item"><img src="${url}"></div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="signature-area">
      <div class="sig-box">
        <div class="sig-image-wrap">${techSig ? `<img src="${techSig}">` : ''}</div>
        <div class="sig-info">${techName}</div>
        <div class="sig-label">Técnico Responsável</div>
      </div>
      <div class="sig-box">
        <div class="sig-image-wrap">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
        <div class="sig-info">${order.signer_name || 'Representante Autorizado'}</div>
        <div class="sig-label">Assinatura do Cliente</div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-text">
        Relatório gerado via Chamei App em ${new Date().toLocaleString('pt-BR')}<br>
        Digitalmente assinado e verificado.
      </div>
      <div class="footer-text" style="text-align: right;">
        Folha 01 / 01
      </div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) {
    console.error('PDF Error:', error);
    alert('Erro ao gerar RELATÓRIO TÉCNICO PREMIUM');
  }
}

export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    const quoteNumber = quote.quote_number || quote.id?.slice(0, 8).toUpperCase() || 'ORC';
    const color = company.color;
    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>ORÇAMENTO - #${quoteNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimir Orçamento 📄</button>
  
  <div class="container">
    <div class="header">
      <div class="company-info-box">
        ${company.logo ? `<img src="${company.logo}" style="max-height: 60px; margin-bottom: 10px; display: block;">` : ''}
        <h1 class="company-name">${company.name}</h1>
        <div class="company-details">
          CNPJ: ${company.cnpj}<br>
          ${company.address}<br>
          Contato: ${company.phone} ${company.email ? `• ${company.email}` : ''}
        </div>
      </div>
      <div class="document-meta">
        <div class="document-type">Proposta Comercial</div>
        <div class="document-id">COT #${quoteNumber}</div>
        <div class="document-date">Emitido em ${formatDate(new Date().toISOString())}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Destinatário</div>
      <div class="info-card">
        <div class="info-row"><span class="info-label">Cliente</span><span class="info-value" style="font-size: 14px; color: ${color};">${quote.clients?.name || '-'}</span></div>
        <div class="info-row"><span class="info-label">Endereço</span><span class="info-value">${quote.clients?.address || '-'}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Escopo dos Serviços / Produtos</div>
      <div class="report-container">${quote.description || 'Nenhuma especificação detalhada fornecida.'}</div>
    </div>

    <div style="background: ${color}; border-radius: 12px; padding: 25px; text-align: right; color: white; margin-top: 30px; box-shadow: 0 10px 15px -10px ${color};">
      <p style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Investimento Total da Proposta</p>
      <h2 style="font-size: 32px; font-weight: 900; letter-spacing: -1px;">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
      <p style="font-size: 9px; margin-top: 5px; opacity: 0.7;">Válido por 07 dias • Condições conforme contrato.</p>
    </div>

    <div class="signature-area" style="margin-top: 60px;">
      <div class="sig-box">
        <div class="sig-image-wrap" style="border-bottom: 1px solid #e2e8f0; width: 250px; margin: 0 auto 10px;"></div>
        <div class="sig-info">${company.name}</div>
        <div class="sig-label">Departamento Comercial</div>
      </div>
      <div class="sig-box">
        <div class="sig-image-wrap" style="border-bottom: 1px solid #e2e8f0; width: 250px; margin: 0 auto 10px;"></div>
        <div class="sig-info">Aceite do Cliente</div>
        <div class="sig-label">Data e Assinatura</div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-text">Orçamento gerado via Chamei Portal em ${new Date().toLocaleDateString('pt-BR')}</div>
      <div class="footer-text">Este documento tem caráter de proposta comercial.</div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) {
    console.error('PDF Error:', error);
    alert('Erro ao gerar ORÇAMENTO PREMIUM');
  }
}

export async function generateOvertimePDF(overtime: any) { }
