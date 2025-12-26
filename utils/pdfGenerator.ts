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
    name: config?.company_name || 'PRESTADOR DE SERVIÇOS',
    cnpj: config?.company_cnpj || config?.cnpj || '',
    address: config?.company_address || config?.address || '',
    phone: config?.company_phone || config?.phone || '',
    email: config?.company_email || config?.email || '',
    logo: config?.company_logo || config?.logo_url || '',
    color: config?.primary_color || '#1e40af'
  };
}

const getCommonCSS = (color: string) => `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  
  @page { size: A4; margin: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
  }
  
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1e293b; line-height: 1.4; background: #fff; }
  
  .document { width: 100%; min-height: 297mm; background: white; position: relative; }
  
  /* CORPORATE HEADER V3 */
  .corporate-header { background: ${color}; color: white; padding: 40px 50px; display: flex; justify-content: space-between; align-items: center; }
  .logo-box { width: 150px; height: 80px; background: white; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .header-info { text-align: right; }
  .header-info h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 5px; text-transform: uppercase; }
  .header-info p { font-size: 11px; opacity: 0.9; font-weight: 400; }
  .header-info .doc-id { margin-top: 10px; font-size: 14px; font-weight: 700; background: rgba(255,255,255,0.2); padding: 5px 12px; border-radius: 4px; display: inline-block; }

  .content-wrapper { padding: 40px 50px; }

  /* SECTION STYLING */
  .section { margin-bottom: 30px; }
  .section-header { display: flex; align-items: center; margin-bottom: 12px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; }
  .section-header .bar { width: 4px; height: 18px; background: ${color}; margin-right: 10px; border-radius: 2px; }
  .section-header h2 { font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }

  /* DATA GRID */
  .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .info-table { width: 100%; border-collapse: collapse; }
  .info-table tr { border-bottom: 1px solid #f1f5f9; }
  .info-table tr:last-child { border-bottom: none; }
  .info-table td { padding: 10px 0; vertical-align: top; }
  .info-table .label { font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; width: 100px; }
  .info-table .value { font-size: 11px; font-weight: 500; color: #1e293b; }

  /* CHECKLIST V3 */
  .checklist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .check-item { display: flex; align-items: center; padding: 10px 15px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
  .check-box { width: 16px; height: 16px; border: 2px solid ${color}40; border-radius: 4px; margin-right: 12px; display: flex; align-items: center; justify-content: center; }
  .check-box.checked { background: ${color}; border-color: ${color}; }
  .check-box.checked::after { content: "✓"; color: white; font-size: 12px; font-weight: 800; }
  .check-text { font-size: 10.5px; font-weight: 500; color: #334155; }

  /* TEXT REPORT */
  .report-box { background: #fdfdfd; border: 1.5px solid #f1f5f9; padding: 25px; border-radius: 10px; font-size: 12px; line-height: 1.6; color: #334155; white-space: pre-wrap; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }

  /* PHOTOS V3 - LARGER AND MORE IMPACTFUL */
  .photo-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 10px; }
  .photo-container { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #f1f5f9; aspect-ratio: 16/10; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
  .photo-container img { width: 100%; height: 100%; object-fit: cover; }

  /* SIGNATURES V3 EXECUTIVE */
  .signature-area { margin-top: 60px; display: flex; justify-content: space-between; page-break-inside: avoid; }
  .sig-box { width: 45%; }
  .sig-img-wrap { height: 100px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 12px; }
  .sig-img-wrap img { max-height: 80px; max-width: 100%; filter: grayscale(1) contrast(1.2); }
  .sig-line { border-top: 2px solid #0f172a; margin-bottom: 8px; }
  .sig-name { font-size: 12px; font-weight: 700; color: #0f172a; text-align: center; }
  .sig-role { font-size: 10px; font-weight: 500; color: #64748b; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

  /* FOOTER */
  .footer { position: absolute; bottom: 30px; left: 50px; right: 50px; border-top: 1px solid #f1f5f9; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; color: #94a3b8; font-size: 9px; }
  
  /* QUOTE SPECIFIC */
  .investment-summary { background: #f8fafc; border: 2px solid ${color}; padding: 30px; border-radius: 12px; margin-top: 30px; display: flex; justify-content: space-between; align-items: center; }
  .investment-label { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
  .investment-value { font-size: 28px; font-weight: 800; color: ${color}; }
  
  .print-btn { position: fixed; bottom: 30px; right: 30px; background: #0f172a; color: white; border: none; padding: 15px 30px; border-radius: 50px; font-family: 'Inter', sans-serif; font-weight: 700; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 9999; }
`;

export async function generateServiceOrderPDF(order: any) {
  try {
    const company = await getCompanyConfig();
    let techName = 'Colaborador Técnico', techSig = '', techDoc = '';

    if (order.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('full_name, signature_url, cpf').eq('id', order.technician_id).maybeSingle();
      if (tech) { techName = tech.full_name || techName; techSig = tech.signature_url || ''; techDoc = tech.cpf || ''; }
    }

    const { data: tasks } = await supabase.from('order_tasks').select('*').eq('order_id', order.id).order('created_at');
    const osNumber = formatOrderId(order.id, order.created_at);
    const photos = order.photos_url || order.photos || [];
    const report = order.execution_report || order.description || 'Nenhum relatório detalhado foi registrado para esta ordem de serviço.';
    const color = company.color;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OS | ${osNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">IMPRIMIR DOCUMENTO</button>
  <div class="document">
    <div class="corporate-header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : '<div style="font-weight:800; color:' + color + '">EXECUTIVE PRO</div>'}</div>
      <div class="header-info">
        <h1>RELATÓRIO TÉCNICO</h1>
        <p>${company.name} | CNPJ: ${company.cnpj}</p>
        <div class="doc-id">Nº ORDEM: ${osNumber}</div>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="section">
        <div class="section-header"><div class="bar"></div><h2>Informações do Cliente</h2></div>
        <div class="data-grid">
          <table class="info-table">
            <tr><td class="label">Razão Social</td><td class="value">${order.clients?.name || '-'}</td></tr>
            <tr><td class="label">CPF/CNPJ</td><td class="value">${order.clients?.cnpj_cpf || '-'}</td></tr>
          </table>
          <table class="info-table">
            <tr><td class="label">Endereço</td><td class="value">${order.clients?.address || '-'}</td></tr>
            <tr><td class="label">Contato</td><td class="value">${order.clients?.phone || '-'}</td></tr>
          </table>
        </div>
      </div>

      <div class="section">
        <div class="section-header"><div class="bar"></div><h2>Execução do Serviço</h2></div>
        <div class="data-grid">
          <table class="info-table">
            <tr><td class="label">Título do Serviço</td><td class="value">${order.title || '-'}</td></tr>
            <tr><td class="label">Responsável</td><td class="value">${techName}</td></tr>
          </table>
          <table class="info-table">
            <tr><td class="label">Início</td><td class="value">${formatDateTime(order.checkin_at)}</td></tr>
            <tr><td class="label">Término</td><td class="value">${formatDateTime(order.completed_at)}</td></tr>
          </table>
        </div>
      </div>

      ${tasks && tasks.length > 0 ? `
      <div class="section">
        <div class="section-header"><div class="bar"></div><h2>Checklist de Verificação</h2></div>
        <div class="checklist-grid">
          ${tasks.map((t: any) => `
            <div class="check-item">
              <div class="check-box ${t.is_completed ? 'checked' : ''}"></div>
              <div class="check-text">${t.title}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="section">
        <div class="section-header"><div class="bar"></div><h2>Relatório Técnico Detalhado</h2></div>
        <div class="report-box">${report}</div>
      </div>

      ${photos.length > 0 ? `
      <div class="section" style="page-break-before: auto;">
        <div class="section-header"><div class="bar"></div><h2>Evidências Fotográficas</h2></div>
        <div class="photo-row">
          ${photos.map((url: string) => `<div class="photo-container"><img src="${url}"></div>`).join('')}
        </div>
      </div>` : ''}

      <div class="signature-area">
        <div class="sig-box">
          <div class="sig-img-wrap">${techSig ? `<img src="${techSig}">` : ''}</div>
          <div class="sig-line"></div>
          <div class="sig-name">${techName}</div>
          <div class="sig-role">Certificação Técnica</div>
        </div>
        <div class="sig-box">
          <div class="sig-img-wrap">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
          <div class="sig-line"></div>
          <div class="sig-name">${order.signer_name || 'Responsável Cliente'}</div>
          <div class="sig-role">Aceite e Conformidade</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>Gerado em ${new Date().toLocaleString('pt-BR')} • ${company.name}</div>
      <div>Página 1 de 1</div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { console.error('Erro PDF:', error); alert('Erro crítico ao gerar PDF'); }
}

export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    const quoteNumber = quote.quote_number || quote.id?.slice(0, 8).toUpperCase() || 'ORC';
    const color = company.color;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proposta Comercial | ${quoteNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">IMPRIMIR PROPOSTA</button>
  <div class="document">
    <div class="corporate-header">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="header-info">
        <h1>PROPOSTA COMERCIAL</h1>
        <p>${company.name} | ${company.email}</p>
        <div class="doc-id">Nº PROPOSTA: ${quoteNumber}</div>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="section">
        <div class="section-header"><div class="bar"></div><h2>Direcionado a</h2></div>
        <div class="data-grid">
          <table class="info-table">
            <tr><td class="label">Cliente</td><td class="value">${quote.clients?.name || '-'}</td></tr>
            <tr><td class="label">CNPJ/CPF</td><td class="value">${quote.clients?.cnpj_cpf || '-'}</td></tr>
          </table>
          <table class="info-table">
            <tr><td class="label">Endereço</td><td class="value">${quote.clients?.address || '-'}</td></tr>
            <tr><td class="label">Data Emissão</td><td class="value">${formatDate(quote.created_at)}</td></tr>
          </table>
        </div>
      </div>

      <div class="section">
        <div class="section-header"><div class="bar"></div><h2>Escopo dos Serviços</h2></div>
        <div class="report-box">${quote.description || 'Descrição detalhada dos serviços a serem prestados conforme acordado.'}</div>
      </div>

      <div class="investment-summary">
        <div class="investment-label">Investimento Total do Projeto</div>
        <div class="investment-value">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      </div>

      <div class="section" style="margin-top:40px;">
        <div class="section-header"><div class="bar"></div><h2>Notas Comerciais</h2></div>
        <p style="font-size:11px; color:#64748b; line-height:1.6;">* Esta proposta tem validade de 15 dias corridos.<br>* O faturamento será realizado conforme os termos estabelecidos em contrato principal.<br>* Insumos não previstos serão orçados separadamente caso necessário.</p>
      </div>

      <div class="signature-area" style="margin-top:100px;">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">${company.name}</div>
          <div class="sig-role">Departamento Comercial</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">Favor assinar para De-Acordo</div>
          <div class="sig-role">Assinatura do Cliente</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar orçamento'); }
}

export async function generateOvertimePDF(overtime: any) {
  try {
    const company = await getCompanyConfig();
    const ovNumber = overtime.id?.slice(0, 8).toUpperCase() || 'BH';
    const color = company.color;
    let techName = 'Colaborador';
    const { data: tech } = await supabase.from('profiles').select('full_name, signature_url').eq('id', overtime.technician_id).maybeSingle();
    if (tech) techName = tech.full_name;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Registro | ${ovNumber}</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <div class="document">
    <div class="corporate-header" style="background: #334155;">
      <div class="logo-box">${company.logo ? `<img src="${company.logo}">` : ''}</div>
      <div class="header-info">
        <h1>CONTROLE DE HORAS</h1>
        <p>${company.name}</p>
        <div class="doc-id">REGISTRO: ${ovNumber}</div>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="section">
        <div class="section-header"><div class="bar"></div><h2>Dados do Registro</h2></div>
        <div class="data-grid">
          <table class="info-table">
            <tr><td class="label">Colaborador</td><td class="value">${techName}</td></tr>
            <tr><td class="label">Cliente / Projeto</td><td class="value">${overtime.clients?.name || '-'}</td></tr>
          </table>
          <table class="info-table">
            <tr><td class="label">Data Registro</td><td class="value">${formatDate(overtime.date || overtime.created_at)}</td></tr>
            <tr><td class="label">Tipo de Hora</td><td class="value">${overtime.type === 'extra' ? 'Adicional Extraordinário' : 'Compensação de Horas'}</td></tr>
          </table>
        </div>
      </div>

      <div style="background:#fefce8; border:2px solid #facc15; padding:40px; border-radius:15px; text-align:center; margin: 20px 0;">
        <p style="text-transform:uppercase; font-size:12px; font-weight:700; color:#854d0e; letter-spacing:1px;">Carga Horária Registrada</p>
        <h2 style="font-size:45px; font-weight:800; color:#854d0e; margin-top:10px;">${overtime.hours || 0}h 00min</h2>
      </div>

      ${overtime.description ? `
      <div class="section">
        <div class="section-header"><div class="bar"></div><h2>Justificativa / Atividades</h2></div>
        <div class="report-box">${overtime.description}</div>
      </div>` : ''}

      <div class="signature-area" style="margin-top:80px;">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">${techName}</div>
          <div class="sig-role">Assinatura Colaborador</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">Gestão Administrativa</div>
          <div class="sig-role">Visto da Empresa</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) { alert('Erro ao gerar banco de horas'); }
}
