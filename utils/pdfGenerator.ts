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
    color: config?.primary_color || '#312e81'
  };
}

const getCommonCSS = (color: string) => `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800&family=Merriweather:ital,wght@0,400;1,400&display=swap');

    :root {
        --primary-color: ${color};
        --dark-gray: #111827;
        --medium-gray: #d1d5db;
        --light-gray: #f3f4f6;
    }

    /* Reset e Base */
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
    body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; color: var(--dark-gray); padding: 20px 0; }

    /* Estrutura de Folha A4 */
    .report-page-container {
        width: 100%;
        max-width: 210mm;
        margin: 0 auto 20px auto;
        page-break-after: always;
    }
    .report-page-container:last-child { page-break-after: auto; }

    .report-page {
        background: white;
        width: 100%;
        min-height: 297mm;
        height: auto;
        box-shadow: 0 0 15px rgba(0,0,0,0.1);
        display: flex;
        flex-direction: column;
        position: relative;
        border: 1px solid #e5e7eb;
        font-size: 10pt;
    }

    /* Cabeçalho Técnico */
    .report-header {
        padding: 8mm 12mm;
        flex-shrink: 0;
    }
    .header-table {
        width: 100%;
        border-collapse: collapse;
        border: 2px solid #111827;
    }
    .header-table td {
        padding: 6px 10px;
        border: 1.5px solid #111827;
        font-size: 8pt;
        vertical-align: middle;
    }
    .header-logo { width: 30%; text-align: center; }
    .header-logo img { max-height: 60px; max-width: 180px; object-fit: contain; }
    .header-title { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 11pt; text-align: center; text-transform: uppercase; }
    .header-label { font-weight: 800; text-transform: uppercase; color: #374151; font-size: 7.5pt; }

    /* Conteúdo */
    .report-content {
        flex-grow: 1;
        padding: 5mm 12mm 10mm 12mm;
        font-family: 'Inter', sans-serif;
    }
    .text-body { font-family: 'Merriweather', serif; font-size: 10pt; text-align: justify; line-height: 1.6; margin-bottom: 1.5rem; }

    .section-title {
        font-family: 'Montserrat', sans-serif;
        font-size: 12pt;
        font-weight: 800;
        color: var(--primary-color);
        margin-bottom: 10px;
        padding-bottom: 4px;
        border-bottom: 2px solid var(--primary-color);
        display: flex;
        align-items: center;
        gap: 10px;
    }

    /* Tabelas e Dados */
    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0 20px 0;
        font-size: 9pt;
    }
    .data-table th { background: #f9fafb; font-weight: 700; text-align: left; padding: 10px; border: 1px solid #e5e7eb; color: #4b5563; text-transform: uppercase; font-size: 7.5pt; }
    .data-table td { padding: 10px; border: 1px solid #e5e7eb; vertical-align: top; }
    .data-table tr:nth-child(even) { background-color: #fcfcfc; }
    .total-row { background: var(--primary-color) !important; color: white !important; font-weight: 800; }
    .total-row td { border-color: var(--primary-color); }

    /* Assinaturas */
    .signature-section {
        margin-top: 30px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        page-break-inside: avoid;
    }
    .signature-box { text-align: center; }
    .signature-img-wrap { height: 70px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 5px; }
    .signature-img-wrap img { max-height: 65px; max-width: 100%; mix-blend-mode: multiply; }
    .signature-name { font-weight: 700; color: #0f172a; font-size: 9pt; }
    .signature-label { font-size: 8pt; color: #64748b; font-weight: 500; }

    /* Footer */
    .report-footer {
        padding: 6mm 12mm;
        flex-shrink: 0;
        border-top: 1px solid var(--medium-gray);
        margin-top: auto;
        text-align: center;
        font-size: 7.5pt;
        color: #6b7280;
    }
    .footer-line { width: 100%; height: 1px; background: #d1d5db; margin-bottom: 10px; }
    .footer-flex { display: flex; justify-content: space-between; text-align: left; }

    /* Fotos */
    .photos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
    .photo-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 5px; background: #fff; }
    .photo-item img { width: 100%; height: 160px; object-fit: cover; border-radius: 4px; }
    .photo-caption { font-size: 8pt; italic; text-align: center; margin-top: 5px; color: #4b5563; }

    .print-btn {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 50px;
        font-weight: 800;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 10px 15px rgba(0,0,0,0.2);
        z-index: 1000;
    }

    @media print {
        body { background-color: #fff; padding: 0; }
        .no-print { display: none !important; }
        .report-page { box-shadow: none; border: none; width: 210mm; min-height: 297mm; }
        .report-page-container { margin: 0; box-shadow: none; border: none; }
    }
`;

function getFooterHTML(data: any) {
  return `
        <div class="report-footer">
            <div class="footer-line"></div>
            <div class="footer-flex">
                <div style="width: 60%;">
                    <strong style="color: #374151;">${data.companyName}</strong><br>
                    ${data.companyAddress}
                </div>
                <div style="width: 40%; text-align: right;">
                    📞 ${data.companyPhone}<br>
                    ✉️ ${data.companyEmail}
                </div>
            </div>
            <p style="margin-top: 5px; font-size: 7pt; opacity: 0.7;">Documento gerado via Chamei Portal em ${new Date().toLocaleString('pt-BR')}</p>
        </div>
    `;
}

function getHeaderHTML(data: any, page: number) {
  return `
        <div class="report-header">
            <table class="header-table">
                <tbody>
                    <tr>
                        <td class="header-logo" rowspan="4">
                            ${data.companyLogoUrl ? `<img src="${data.companyLogoUrl}">` : `<span style="font-weight: 900; color: #ddd; font-size: 20pt;">LOGO</span>`}
                        </td>
                        <td class="header-title" colspan="2">${data.reportType}</td>
                    </tr>
                    <tr>
                        <td colspan="2"><span class="header-label">Solicitante:</span> <span style="font-weight: 600;">${data.clientName}</span></td>
                    </tr>
                    <tr>
                        <td colspan="2"><span class="header-label">Endereço:</span> <span style="font-size: 7.5pt;">${data.clientAddress}</span></td>
                    </tr>
                    <tr>
                        <td style="width: 40%;"><span class="header-label">ID Documento:</span> <span style="font-weight: 700;">#${data.docId}</span></td>
                        <td style="width: 30%; border-left: 2px solid #111827;"><span class="header-label">Página:</span> ${page}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

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

    const data = {
      companyLogoUrl: company.logo,
      companyName: company.name,
      companyAddress: company.address,
      companyPhone: company.phone,
      companyEmail: company.email,
      reportType: 'RELATÓRIO DE ATENDIMENTO TÉCNICO',
      clientName: order.clients?.name || '-',
      clientAddress: order.clients?.address || '-',
      docId: osNumber,
      reportDate: formatDate(order.created_at)
    };

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>OS #${osNumber} - RELATÓRIO PRESTADOR</title>
  <style>${getCommonCSS(color)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimir Documento 📄</button>
  
  <div class="container">
    <div class="report-page-container">
        <div class="report-page">
            ${getHeaderHTML(data, 1)}
            <div class="report-content">
                <div class="section-title">1. OBJETO DO CHAMADO</div>
                <div class="text-body">${order.description || 'Não especificado.'}</div>

                <div class="section-title">2. DETALHAMENTO DA EXECUÇÃO</div>
                <div class="text-body">${order.execution_report || 'Nenhum parecer técnico textual anexado.'}</div>

                <div class="section-title">3. PROFISSIONAL RESPONSÁVEL</div>
                <table class="data-table">
                    <tr>
                        <td style="width: 50%;"><span class="header-label">Técnico Integrador:</span><br><strong>${techName}</strong></td>
                        <td style="width: 50%;"><span class="header-label">Horários:</span><br>Início: ${formatDateTime(order.checkin_at)}<br>Fim: ${formatDateTime(order.completed_at || order.updated_at)}</td>
                    </tr>
                </table>

                ${orderItems && orderItems.length > 0 ? `
                <div class="section-title">4. MATERIAIS E SERVIÇOS APLICADOS</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Descrição</th>
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
                </table>` : ''}
            </div>
            ${getFooterHTML(data)}
        </div>
    </div>

    ${photos.length > 0 ? `
    <div class="report-page-container">
        <div class="report-page">
            ${getHeaderHTML(data, 2)}
            <div class="report-content">
                <div class="section-title">5. ANEXO FOTOGRÁFICO DE EVIDÊNCIAS</div>
                <div class="photos-grid">
                    ${photos.map((url: string, idx: number) => `
                        <div class="photo-item">
                            <img src="${url}">
                            <div class="photo-caption">Evidência #${idx + 1}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ${getFooterHTML(data)}
        </div>
    </div>` : ''}

    <div class="report-page-container">
        <div class="report-page">
            ${getHeaderHTML(data, photos.length > 0 ? 3 : 2)}
            <div class="report-content">
                <div class="section-title">6. FORMALIZAÇÃO E CIÊNCIA</div>
                <div class="text-body" style="font-size: 9pt;">
                    Declaramos para os devidos fins que os serviços acima descritos foram realizados e equipamentos testados em conformidade. O aceite deste documento via assinatura digital ou física comprova a prestação do serviço.
                </div>
                
                <div class="signature-section">
                    <div class="signature-box">
                        <div class="signature-img-wrap">${techSig ? `<img src="${techSig}">` : ''}</div>
                        <div class="signature-name">${techName}</div>
                        <div class="signature-label">Prestador Responsável</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-img-wrap">${order.signature_url ? `<img src="${order.signature_url}">` : ''}</div>
                        <div class="signature-name">${order.signer_name || 'Representante do Cliente'}</div>
                        <div class="signature-label">Aceite e Recebimento</div>
                    </div>
                </div>
                
                <div style="margin-top: 40px; text-align: center;">
                    <p style="font-size: 10pt; color: #1e293b; font-weight: 600;">
                        ${company.address.split('-')[0]}, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
                    </p>
                </div>
            </div>
            ${getFooterHTML(data)}
        </div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
  } catch (error) {
    console.error('PDF Error:', error);
    alert('Erro ao gerar RELATÓRIO PREMIUM');
  }
}

export async function generateQuotePDF(quote: any) {
  try {
    const company = await getCompanyConfig();
    const quoteNumber = quote.quote_number || quote.id?.slice(0, 8).toUpperCase() || 'ORC';
    const color = company.color;

    const data = {
      companyLogoUrl: company.logo,
      companyName: company.name,
      companyAddress: company.address,
      companyPhone: company.phone,
      companyEmail: company.email,
      reportType: 'ORÇAMENTO / PROPOSTA COMERCIAL',
      clientName: quote.clients?.name || '-',
      clientAddress: quote.clients?.address || '-',
      docId: quoteNumber,
      reportDate: formatDate(new Date().toISOString())
    };

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
  <button class="print-btn no-print" onclick="window.print()">Imprimir Proposta 📄</button>
  
  <div class="container">
    <div class="report-page-container">
        <div class="report-page">
            ${getHeaderHTML(data, 1)}
            <div class="report-content">
                <div class="section-title">DESCRIÇÃO DA PROPOSTA</div>
                <div class="text-body">${quote.description || 'Especificações detalhadas conforme conversado.'}</div>

                <div style="background: var(--primary-color); color: white; border-radius: 12px; padding: 30px; margin-top: 40px; text-align: right; box-shadow: 0 10px 25px -10px ${color};">
                    <p style="text-transform: uppercase; font-size: 8pt; font-weight: 800; letter-spacing: 2px; opacity: 0.8; margin-bottom: 5px;">Investimento Total Estimado</p>
                    <h2 style="font-size: 36px; font-weight: 900; letter-spacing: -1.5px; font-family: 'Montserrat', sans-serif;">R$ ${(quote.total_value || quote.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                    <p style="font-size: 9pt; margin-top: 10px; opacity: 0.7; font-weight: 500;">Validade da proposta: 07 dias corridos.</p>
                </div>

                <div class="signature-section" style="margin-top: 60px;">
                    <div class="signature-box">
                        <div class="signature-img-wrap"></div>
                        <div class="signature-name">${company.name}</div>
                        <div class="signature-label">Representante Comercial</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-img-wrap"></div>
                        <div class="signature-name">Aceite do Cliente</div>
                        <div class="signature-label">Data e Assinatura</div>
                    </div>
                </div>
            </div>
            ${getFooterHTML(data)}
        </div>
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
