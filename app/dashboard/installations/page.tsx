'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, LayoutGrid, Calendar as CalendarIcon, Loader2, Search, Filter, X, ChevronRight, List, Globe, Plane, Droplets } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BRAZIL_STATES = [
    { value: 'AC', label: 'Acre' }, { value: 'AL', label: 'Alagoas' }, { value: 'AP', label: 'Amapá' },
    { value: 'AM', label: 'Amazonas' }, { value: 'BA', label: 'Bahia' }, { value: 'CE', label: 'Ceará' },
    { value: 'DF', label: 'Distrito Federal' }, { value: 'ES', label: 'Espírito Santo' }, { value: 'GO', label: 'Goiás' },
    { value: 'MA', label: 'Maranhão' }, { value: 'MT', label: 'Mato Grosso' }, { value: 'MS', label: 'Mato Grosso do Sul' },
    { value: 'MG', label: 'Minas Gerais' }, { value: 'PA', label: 'Pará' }, { value: 'PB', label: 'Paraíba' },
    { value: 'PR', label: 'Paraná' }, { value: 'PE', label: 'Pernambuco' }, { value: 'PI', label: 'Piauí' },
    { value: 'RJ', label: 'Rio de Janeiro' }, { value: 'RN', label: 'Rio Grande do Norte' }, { value: 'RS', label: 'Rio Grande do Sul' },
    { value: 'RO', label: 'Rondônia' }, { value: 'RR', label: 'Roraima' }, { value: 'SC', label: 'Santa Catarina' },
    { value: 'SP', label: 'São Paulo' }, { value: 'SE', label: 'Sergipe' }, { value: 'TO', label: 'Tocantins' }
].map(s => ({ ...s, flag: `https://cdn.jsdelivr.net/gh/arthurreira/br-state-flags@main/svgs/optimized/${s.value.toLowerCase()}.svg` }));
import InstallationForm from '../../../components/installations/InstallationForm';
import InstallationKanban from '../../../components/installations/InstallationKanban';
import InstallationDocuments from '../../../components/installations/InstallationDocuments';
import { generateInstallationPDF } from '../../../utils/pdfGenerator';
import './TelemetryPrint.css';
import { FileDown, Printer, File } from 'lucide-react';

export default function InstallationsPage() {
    const [loading, setLoading] = useState(true);
    const [installations, setInstallations] = useState<any[]>([]);
    const [view, setView] = useState<'kanban' | 'calendar'>('kanban');
    const [showForm, setShowForm] = useState(false);
    const [showDocuments, setShowDocuments] = useState(false);
    const [selectedInstallation, setSelectedInstallation] = useState<any | null>(null);
    const [search, setSearch] = useState('');
    const [filterState, setFilterState] = useState('');
    const [isStateOpen, setIsStateOpen] = useState(false);
    const [companyConfig, setCompanyConfig] = useState<any>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());
    const selectAllVisible = () => setSelectedIds(new Set(filteredInstallations.map(i => i.id)));

    // Mapeamento de Status para PT-BR (Compartilhado)
    const statusMap: Record<string, string> = {
        pendente: 'PENDENTE',
        agendada: 'AGENDADA',
        em_andamento: 'EM ANDAMENTO',
        concluida: 'CONCLUÍDA',
        cancelada: 'CANCELADA'
    };

    // Mapeamento para garantir que o banco receba somente os status permitidos pelo constraint
    const dbStatusMap: Record<string, string> = {
        pending: 'pendente',
        scheduled: 'agendada',
        in_progress: 'em_andamento',
        completed: 'concluida',
        cancelled: 'cancelada',

        pendente: 'pendente',
        agendada: 'agendada',
        em_andamento: 'em_andamento',
        concluida: 'concluida',
        cancelada: 'cancelada'
    };

    useEffect(() => {
        loadInstallations();
        loadCompanyConfig();
    }, []);

    async function loadCompanyConfig() {
        try {
            const { data } = await supabase.from('app_config').select('*').single();
            if (data) setCompanyConfig(data);
        } catch (error) {
            console.error('Erro ao carregar branding:', error);
        }
    }

    async function loadInstallations() {
        setLoading(true);
        try {
            // Robust manual join fetch
            const { data: instData, error: instError } = await supabase
                .from('installations')
                .select('*')
                .order('created_at', { ascending: false });

            if (instError) throw instError;

            // Fetch clients separately to bypass FK relationship issues in Supabase
            const { data: clientsData } = await supabase
                .from('clients')
                .select('id, name, is_telemetry_client, cnpj_cpf');

            // Fetch technicians (profiles) separately as well
            const { data: techsData } = await supabase
                .from('profiles')
                .select('id, full_name, signature_url');

            const mergedData = instData.map(inst => ({
                ...inst,
                clients: clientsData?.find(c => c.id === inst.client_id) || null,
                technician: techsData?.find(t => t.id === inst.technician_id) || null
            }));

            setInstallations(mergedData);
        } catch (error: any) {
            console.error('Error loading installations:', error);
            toast.error('Erro ao carregar instalações');
        } finally {
            setLoading(false);
        }
    }

    async function handleStatusChange(id: string, newStatus: string) {
        try {
            const statusDb = dbStatusMap[newStatus] ?? 'pendente';

            const { error } = await supabase
                .from('installations')
                .update({ status: statusDb })
                .eq('id', id);

            if (error) throw error;
            toast.success('Status atualizado!');
            loadInstallations();
        } catch (error: any) {
            toast.error('Erro ao atualizar status');
        }
    }

    const filteredInstallations = installations.filter(i => {
        const matchesSearch = (i.title?.toLowerCase().includes(search.toLowerCase()) || '') ||
            (i.location_address?.toLowerCase().includes(search.toLowerCase()) || '') ||
            (i.clients?.name?.toLowerCase().includes(search.toLowerCase()) || '');

        const matchesState = filterState === '' || i.state === filterState;

        return matchesSearch && matchesState;
    });

    // Função para exportar para Excel (Ultra-Premium com ExcelJS)
    const handleExportExcel = async () => {
        if (filteredInstallations.length === 0) {
            toast.error('Nenhum dado para exportar');
            return;
        }

        toast.loading('Preparando Excel Corporativo...');
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            // aba principal: AGENDA TÉCNICA
            const worksheet = workbook.addWorksheet('AGENDA TÉCNICA');

            // --- FILTER BY SELECTION IF ANY ---
            const dataToExport = selectedIds.size > 0
                ? filteredInstallations.filter(i => selectedIds.has(i.id))
                : filteredInstallations;

            // Ordenação Cronológica (Mais antigo primeiro = Ordem da Agenda)
            const sortedData = [...dataToExport].sort((a, b) => {
                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                return dateA - dateB;
            });

            // --- CONSTRUÇÃO DA AGENDA (Mesa de Operações) ---
            const rows = sortedData.map(inst => [
                inst.start_date ? format(new Date(inst.start_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
                inst.end_date ? format(new Date(inst.end_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '---',
                (inst.technician_name || 'PENDENTE').toUpperCase(),
                statusMap[inst.status] || inst.status.toUpperCase(),
                (inst.clients?.name || 'CLIENTE AVULSO').toUpperCase(),
                inst.cnpj || inst.clients?.cnpj_cpf || '',
                (inst.title || '').toUpperCase(),
                inst.location_address || '',
                (inst.neighborhood || '').toUpperCase(),
                (inst.city || '').toUpperCase(),
                (inst.state || '').toUpperCase(),
                (inst.contact_name || '').toUpperCase(),
                inst.contact_phone || '',
                inst.id?.substring(0, 8).toUpperCase() || ''
            ]);

            // Definição Manual de Cabeçalhos (Para evitar conflitos do addTable)
            const headerNames = ['DATA INÍCIO', 'DATA FIM', 'TÉCNICO', 'STATUS', 'CLIENTE', 'CNPJ', 'TÍTULO DO SERVIÇO', 'LOGRADOURO/Nº', 'BAIRRO', 'CIDADE', 'UF', 'CONTATO', 'TELEFONE', 'ID SERVIÇO'];
            const headerRow = worksheet.getRow(1);
            headerRow.values = headerNames;
            headerRow.height = 40;
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Slate 900
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12, name: 'Segoe UI' };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = { bottom: { style: 'thick', color: { argb: 'FF334155' } } };
            });

            // Adicionar Dados
            worksheet.addRows(rows);

            // Ativar Filtros Automáticos
            worksheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: 1, column: headerNames.length }
            };

            // Ajuste de Larguras (Premium Spacing)
            const columnWidths = [24, 24, 28, 22, 42, 22, 48, 42, 28, 28, 12, 28, 22, 18];
            columnWidths.forEach((width, i) => {
                worksheet.getColumn(i + 1).width = width;
            });

            // ESTILO DE ELITE: TIPOGRAFIA SEGURA E NEUTRA
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber === 1) return; // Pular cabeçalho já estilizado

                row.height = 36; // Altura Master para elegância

                const statusValue = (row.getCell(4).value?.toString() || '').trim().toUpperCase(); // Coluna D (STATUS)

                row.eachCell((cell, colNumber) => {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    cell.font = { size: 11, name: 'Segoe UI', color: { argb: 'FF334155' } }; // Slate 700
                    cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };

                    // Zebrado suave
                    if (rowNumber % 2 === 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                    }

                    // --- COLORIZAÇÃO ABSOLUTA DA CÉLULA DE STATUS (COLUNA D) ---
                    // Forçamos o fundo colorido de TODOS os status durante o export para impacto imediato
                    if (colNumber === 4) {
                        cell.font = { ...cell.font, bold: true };
                        if (statusValue === 'CONCLUÍDO' || statusValue === 'CONCLUÍDA') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald 500
                            cell.font = { ...cell.font, color: { argb: 'FFFFFFFF' } };
                        } else if (statusValue === 'EM ANDAMENTO') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } }; // Amber 500
                            cell.font = { ...cell.font, color: { argb: 'FFFFFFFF' } };
                        } else if (statusValue === 'AGENDADO' || statusValue === 'AGENDADA') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }; // Blue 500
                            cell.font = { ...cell.font, color: { argb: 'FFFFFFFF' } };
                        } else if (statusValue === 'CANCELADO' || statusValue === 'CANCELADA') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }; // Red 500
                            cell.font = { ...cell.font, color: { argb: 'FFFFFFFF' } };
                        } else if (statusValue === 'PENDENTE') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } }; // Slate 500
                            cell.font = { ...cell.font, color: { argb: 'FFFFFFFF' } };
                        }
                    }

                    // Centralização de colunas de metadados
                    if ([1, 2, 4, 11, 14].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                });
            });

            // REGRAS DE FORMATAÇÃO CONDICIONAL - PARA MUDANÇAS DENTRO DO EXCEL
            // Aplicamos uma faixa larga (500 linhas) para garantir que funcione se o usuário adicionar dados.
            worksheet.addConditionalFormatting({
                ref: `D2:D500`,
                rules: [
                    {
                        priority: 1, type: 'cellIs', operator: 'equal', formulae: ['"CONCLUÍDO"'],
                        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }, font: { color: { argb: 'FFFFFFFF' }, bold: true } }
                    },
                    {
                        priority: 2, type: 'cellIs', operator: 'equal', formulae: ['"EM ANDAMENTO"'],
                        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } }, font: { color: { argb: 'FFFFFFFF' }, bold: true } }
                    },
                    {
                        priority: 3, type: 'cellIs', operator: 'equal', formulae: ['"PENDENTE"'],
                        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } }, font: { color: { argb: 'FFFFFFFF' }, bold: true } }
                    },
                    {
                        priority: 4, type: 'cellIs', operator: 'equal', formulae: ['"AGENDADO"'],
                        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }, font: { color: { argb: 'FFFFFFFF' }, bold: true } }
                    },
                    {
                        priority: 5, type: 'cellIs', operator: 'equal', formulae: ['"CANCELADO"'],
                        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }, font: { color: { argb: 'FFFFFFFF' }, bold: true } }
                    }
                ]
            });

            // Data Validation (Status) na Coluna D
            // Aplicamos também a uma faixa larga para consistência com as cores
            for (let i = 2; i <= 500; i++) {
                worksheet.getCell(`D${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"PENDENTE,AGENDADO,EM ANDAMENTO,CONCLUÍDO,CANCELADO"`],
                    showErrorMessage: true,
                    errorTitle: 'Status Inválido',
                    error: 'Selecione um status da lista.'
                };
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `AGENDA_TECNICA_${format(new Date(), 'dd_MM_yyyy_HHmm')}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);

            toast.dismiss();
            toast.success('Excel ELETRICOM OS gerado!');
        } catch (error) {
            console.error('Erro Excel:', error);
            toast.dismiss();
            toast.error('Erro ao gerar Excel Corporativo');
        }
    };

    // Função para imprimir
    const handlePrint = () => {
        window.print();
    };

    // Função para exportar PDF Definitivo (Premium Logo & Precision Columns V24)
    const handleExportPDF = async () => {
        if (filteredInstallations.length === 0) {
            toast.error('Nenhum dado para exportar');
            return;
        }

        toast.loading('Gerando PDF de Alta Definição...');
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF('l', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 10;

            // --- FILTER BY SELECTION IF ANY ---
            const dataToExport = selectedIds.size > 0
                ? filteredInstallations.filter(i => selectedIds.has(i.id))
                : filteredInstallations;

            // Ordenação Cronológica
            const sortedData = [...dataToExport].sort((a, b) => {
                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                return dateA - dateB;
            });

            // Função para desenhar Header e Footer (Versão Premium V24)
            const drawHeaderFooter = (data: any) => {
                // 1. Barra de Acentuação Premium (Indigo)
                doc.setFillColor(30, 58, 138);
                doc.rect(0, 0, pageWidth, 5, 'F');

                // 2. Fundo de Header
                doc.setFillColor(248, 250, 252);
                doc.rect(0, 5, pageWidth, 30, 'F');

                // 3. LOGO (Esquerda - OTIMIZADA V24)
                if (companyConfig?.logo_url) {
                    try {
                        // Posicionamento Centralizado Verticalmente (Header: 30mm | Logo: 20mm | Y Start: 10)
                        doc.addImage(companyConfig.logo_url, 'PNG', margin + 2, 10, 32, 20, undefined, 'SLOW');
                    } catch (e) {
                        console.error('Logo error:', e);
                    }
                }

                // 4. BLOCO CENTRAL - DADOS DA EMPRESA (DINÂMICO)
                const cName = (companyConfig?.company_name || 'AEC SERVIÇOS - ELETRICOM').toUpperCase();
                const cCNPJ = companyConfig?.cnpj ? `CNPJ: ${companyConfig.cnpj}` : 'CNPJ: 07.456.654/0001-08';
                const cPhone = companyConfig?.phone ? ` | TEL: ${companyConfig.phone}` : '';
                const cEmail = companyConfig?.email ? ` | EMAIL: ${companyConfig.email}` : '';

                const addressParts = [
                    companyConfig?.street,
                    companyConfig?.number,
                    companyConfig?.neighborhood,
                    companyConfig?.city,
                    companyConfig?.state
                ].filter(Boolean).join(', ');
                const cAddress = addressParts || 'AV. DIAMANTE, 485 - CONTAGEM/MG';

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(15, 23, 42);
                doc.text(cName, pageWidth / 2, 12, { align: 'center' });

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(71, 85, 105);
                doc.text(`${cCNPJ}${cPhone}${cEmail}`, pageWidth / 2, 17, { align: 'center' });
                doc.text(`ENDEREÇO: ${cAddress.toUpperCase()}`, pageWidth / 2, 21, { align: 'center' });

                // 5. TÍTULO DO RELATÓRIO
                doc.setFont('helvetica', 'black');
                doc.setFontSize(15);
                doc.setTextColor(30, 58, 138);
                doc.text('CRONOGRAMA DE INSTALAÇÃO DE TELEMETRIA', pageWidth / 2, 29, { align: 'center' });

                // 6. METADADOS (Direita - Compacto)
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text(`EMISSÃO: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - margin, 10, { align: 'right' });

                // 7. LINHA DIVISÓRIA
                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.3);
                doc.line(margin, 35, pageWidth - margin, 35);

                // 8. FOOTER (Limpo - Sem Créditos)
                doc.setDrawColor(226, 232, 240);
                doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

                doc.setFontSize(8);
                doc.setTextColor(71, 85, 105);
                doc.setFont('helvetica', 'bold');
                doc.text(cName, margin, pageHeight - 8);

                const pg = `PÁGINA ${data.pageNumber} DE ${doc.getNumberOfPages()}`;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(148, 163, 184);
                doc.text(pg, pageWidth - margin, pageHeight - 8, { align: 'right' });
            };

            const tableRows = sortedData.map(inst => [
                inst.start_date ? format(new Date(inst.start_date), 'dd/MM/yyyy HH:mm') : '',
                inst.end_date ? format(new Date(inst.end_date), 'dd/MM/yyyy HH:mm') : '---',
                (inst.technician_name || 'PENDENTE').toUpperCase(),
                (inst.clients?.name || 'VULSO').toUpperCase(),
                (inst.cnpj || inst.clients?.cnpj_cpf || '---'),
                (inst.title || '').toUpperCase(),
                (inst.state || '---').toUpperCase(),
                (inst.contact_name || '').toUpperCase(),
                statusMap[inst.status] || (inst.status || '').toUpperCase()
            ]);

            autoTable(doc, {
                startY: 38,
                head: [['INÍCIO', 'FIM', 'TÉCNICO', 'CLIENTE', 'CNPJ/CPF', 'SERVIÇO', 'UF', 'CONTATO', 'STATUS']],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [30, 58, 138],
                    textColor: [255, 255, 255],
                    fontSize: 8.2,
                    fontStyle: 'bold',
                    halign: 'center',
                    cellPadding: 2,
                    lineWidth: 0.1,
                    lineColor: [255, 255, 255]
                },
                bodyStyles: {
                    fontSize: 7.2,
                    valign: 'middle',
                    cellPadding: 1.5,
                    textColor: [15, 23, 42]
                },
                columnStyles: {
                    0: { cellWidth: 24 }, // Início
                    1: { cellWidth: 24 }, // Fim
                    2: { cellWidth: 48 }, // Técnico (H. HENRIQUE DA CRUZ Z - Zero-Break)
                    3: { cellWidth: 35 }, // Cliente
                    4: { cellWidth: 30 }, // CNPJ
                    5: { cellWidth: 50 }, // Serviço
                    6: { cellWidth: 12, halign: 'center' }, // UF (Single Line)
                    7: { cellWidth: 28 }, // Contato
                    8: { cellWidth: 26, halign: 'center' } // Status
                },
                alternateRowStyles: {
                    fillColor: [250, 251, 253]
                },
                margin: { left: margin, right: margin, bottom: 15 },
                didDrawPage: drawHeaderFooter,
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 8) {
                        const statusText = data.cell.text[0];
                        data.cell.styles.textColor = [255, 255, 255];
                        data.cell.styles.fontStyle = 'bold';

                        if (statusText === 'CONCLUÍDO' || statusText === 'CONCLUÍDA') {
                            data.cell.styles.fillColor = [16, 185, 129];
                        } else if (statusText === 'EM ANDAMENTO') {
                            data.cell.styles.fillColor = [245, 158, 11];
                        } else if (statusText === 'AGENDADO' || statusText === 'AGENDADA') {
                            data.cell.styles.fillColor = [37, 99, 235];
                        } else if (statusText === 'CANCELADO' || statusText === 'CANCELADA') {
                            data.cell.styles.fillColor = [220, 38, 38];
                        } else if (statusText === 'PENDENTE') {
                            data.cell.styles.fillColor = [100, 116, 139];
                        }
                    }
                }
            });

            doc.save(`AEC_AGENDA_TELEMETRIA_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
            toast.dismiss();
            toast.success('PDF V24 Gerado com Sucesso!');
        } catch (error) {
            console.error('Erro PDF:', error);
            toast.dismiss();
            toast.error('Erro ao gerar PDF');
        }
    };

    // Função para exportar Relatório Final Individual (Premium HTML)
    const handleExportIndividualPDF = async (inst: any) => {
        try {
            toast.loading(`Gerando Relatório: ${inst.title}...`);
            await generateInstallationPDF(inst);
            toast.dismiss();
            toast.success('Relatório Final Gerado!');
        } catch (error) {
            console.error('Individual PDF Error:', error);
            toast.dismiss();
            toast.error('Erro ao gerar relatório');
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-10 px-4 sm:px-0">
            {/* Header Estilizado */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none rotate-3">
                        <Droplets className="text-white -rotate-3" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                            Gestão de Telemetria
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 font-bold text-xs uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            ELETRICOM OS - Operações
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Toggle de Visualização */}
                    <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex items-center shadow-inner border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setView('kanban')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'kanban'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <LayoutGrid size={14} />
                            Fluxo
                        </button>
                        <button
                            onClick={() => setView('calendar')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'calendar'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <CalendarIcon size={14} />
                            Agenda
                        </button>
                    </div>

                    <button
                        onClick={selectAllVisible}
                        className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 dark:border-indigo-800"
                    >
                        Selecionar Tudo
                    </button>

                    <button
                        onClick={handleExportPDF}
                        className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl hover:bg-red-100 transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border border-red-100 dark:border-red-800"
                        title="Exportar PDF Profissional"
                    >
                        <File size={20} />
                        PDF
                    </button>

                    <button
                        onClick={handleExportExcel}
                        className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl hover:bg-emerald-100 transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border border-emerald-100 dark:border-emerald-800"
                        title="Exportar para Excel"
                    >
                        <FileDown size={20} />
                        Excel
                    </button>

                    <button
                        onClick={() => {
                            setSelectedInstallation(null);
                            setShowForm(true);
                        }}
                        className="btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none hover:scale-105 transition-all flex items-center gap-3 font-black text-xs uppercase tracking-widest"
                    >
                        <Plus size={20} />
                        Novo Agendamento
                    </button>
                </div>
            </div>

            {/* BARRA DE SELEÇÃO FLUTUANTE */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] animate-slideUp">
                    <div className="bg-slate-900 dark:bg-slate-800 text-white px-8 py-5 rounded-[2rem] shadow-2xl border border-slate-700 flex items-center gap-8 backdrop-blur-xl bg-opacity-90">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black">
                                {selectedIds.size}
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Itens Selecionados</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Exportação Filtrada Ativa</p>
                            </div>
                        </div>

                        <div className="w-[1px] h-10 bg-slate-700" />

                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-700 rounded-xl transition-all text-xs font-black uppercase tracking-widest"
                            >
                                <File size={16} className="text-red-400" />
                                PDF
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-700 rounded-xl transition-all text-xs font-black uppercase tracking-widest"
                            >
                                <FileDown size={16} className="text-emerald-400" />
                                EXCEL
                            </button>

                            <div className="w-[1px] h-6 bg-slate-700" />

                            <button
                                onClick={clearSelection}
                                className="px-4 py-2 bg-slate-700 hover:bg-red-600 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
                            >
                                Limpar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barra de Filtros e Busca */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="relative flex-1 w-full group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors pointer-events-none z-10">
                        <Search size={22} />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por local ou título..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-16 pr-5 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 dark:focus:border-indigo-500 rounded-3xl outline-none transition-all font-bold text-sm text-slate-800 dark:text-white placeholder:text-slate-300 placeholder:font-medium shadow-none"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    {/* Custom State Filter */}
                    <div className="relative min-w-[240px]">
                        <button
                            onClick={() => setIsStateOpen(!isStateOpen)}
                            className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold text-xs flex items-center gap-2 group shadow-sm hover:bg-white dark:hover:bg-slate-700"
                        >
                            {filterState ? (
                                <>
                                    <img src={`https://cdn.jsdelivr.net/gh/arthurreira/br-state-flags@main/svgs/optimized/${filterState.toLowerCase()}.svg`} className="w-5 h-3.5 object-cover rounded-[1px]" alt={filterState} />
                                    <span>{filterState}</span>
                                </>
                            ) : (
                                <>
                                    <img src="https://cdn.jsdelivr.net/gh/lipis/flag-icons@main/flags/4x3/br.svg" className="w-5 h-3.5 object-cover rounded-[1px] shadow-sm" alt="Brasil" />
                                    <span>Brasil</span>
                                </>
                            )}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-300" style={{ transform: isStateOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)' }}>
                                <ChevronRight size={14} className="rotate-90" />
                            </div>
                        </button>

                        {isStateOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto animate-slideUp p-1">
                                <button
                                    onClick={() => {
                                        setFilterState('');
                                        setIsStateOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors text-xs font-bold"
                                >
                                    <img src="https://cdn.jsdelivr.net/gh/lipis/flag-icons@main/flags/4x3/br.svg" className="w-5 h-3.5 object-cover rounded-[1px] shadow-sm" alt="Brasil" />
                                    <span>Brasil (Todos)</span>
                                </button>
                                {BRAZIL_STATES.map(state => (
                                    <button
                                        key={state.value}
                                        onClick={() => {
                                            setFilterState(state.value);
                                            setIsStateOpen(false);
                                        }}
                                        className={`w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors text-xs font-bold ${filterState === state.value ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600' : ''}`}
                                    >
                                        <img src={state.flag} className="w-5 h-3.5 object-cover rounded-[1px] shadow-sm" alt={state.value} />
                                        <span>{state.value} - {state.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button className="btn btn-secondary flex-1 md:flex-none">
                        <Filter size={18} />
                        Filtros
                    </button>
                    {(search || filterState) && (
                        <button
                            onClick={() => {
                                setSearch('');
                                setFilterState('');
                            }}
                            className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Conteúdo Principal para Captura de PDF */}
            <div id="agenda-content" className="bg-white dark:bg-transparent rounded-[2.5rem]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/50 dark:bg-gray-900/50 rounded-3xl animate-pulse">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                        <p className="text-gray-500 font-medium font-bold uppercase tracking-widest text-[10px]">Sincronizando ELETRICOM OS...</p>
                    </div>
                ) : (
                    <div className="min-h-[600px]">
                        {view === 'kanban' ? (
                            <InstallationKanban
                                installations={filteredInstallations}
                                selectedIds={selectedIds}
                                onToggleSelection={toggleSelection}
                                onEdit={(item) => {
                                    setSelectedInstallation(item);
                                    setShowForm(true);
                                }}
                                onStatusChange={handleStatusChange}
                                onViewDocuments={(item) => {
                                    setSelectedInstallation(item);
                                    setShowDocuments(true);
                                }}
                                onExportPDF={handleExportIndividualPDF}
                            />
                        ) : (
                            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden relative animate-fadeIn">
                                {/* Header do Calendário */}
                                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                                            <CalendarIcon className="text-indigo-600" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Agenda Técnica de Operações</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500 hover:text-indigo-600">
                                            <ChevronRight className="rotate-180" size={20} />
                                        </button>
                                        <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"> Hoje </button>
                                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500 hover:text-indigo-600">
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Grade do Calendário */}
                                <div className="grid grid-cols-7 gap-[1px] bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                    {/* Dias da Semana */}
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                        <div key={day} className="bg-slate-50 dark:bg-slate-900/50 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                            {day}
                                        </div>
                                    ))}

                                    {/* Células dos Dias */}
                                    {(() => {
                                        const monthStart = startOfMonth(currentMonth);
                                        const monthEnd = endOfMonth(monthStart);
                                        const startDate = startOfWeek(monthStart);
                                        const endDate = endOfWeek(monthEnd);
                                        const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

                                        return calendarDays.map((day, idx) => {
                                            const dayInst = filteredInstallations.filter(inst => {
                                                const instDate = inst.start_date || inst.scheduled_date;
                                                return instDate && isSameDay(new Date(instDate), day);
                                            });

                                            const isToday = isSameDay(day, new Date());
                                            const isMonth = isSameMonth(day, monthStart);

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`min-h-[140px] p-2 transition-all bg-white dark:bg-slate-900 flex flex-col gap-1 hover:z-10 hover:shadow-2xl hover:scale-[1.02] cursor-default border-slate-50 dark:border-slate-800
                                                        ${!isMonth ? 'opacity-30 bg-slate-50/50 dark:bg-slate-950/20' : ''}
                                                        ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}
                                                    `}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`text-sm font-black w-8 h-8 flex items-center justify-center rounded-xl transition-all
                                                            ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : isMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300'}
                                                        `}>
                                                            {format(day, 'd')}
                                                        </span>
                                                        {dayInst.length > 0 && (
                                                            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[9px] font-black px-1.5 py-0.5 rounded-lg border border-indigo-200/50">
                                                                {dayInst.length}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1 pb-1">
                                                        {dayInst.map(inst => (
                                                            <div
                                                                key={inst.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedInstallation(inst);
                                                                    setShowForm(true);
                                                                }}
                                                                className={`p-1.5 rounded-lg text-[9px] font-bold truncate cursor-pointer transition-all border group relative
                                                                    ${selectedIds.has(inst.id) ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-lg' :
                                                                        inst.status === 'concluida' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-100 dark:border-emerald-800/30' :
                                                                            inst.status === 'em_andamento' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-100 dark:border-amber-800/30' :
                                                                                'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-100 dark:border-slate-700'}
                                                                    hover:shadow-md hover:-translate-y-0.5
                                                                `}
                                                            >
                                                                {/* MINI CHECKBOX CALENDÁRIO */}
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleSelection(inst.id);
                                                                    }}
                                                                    className={`absolute right-1 top-1 w-3 h-3 rounded-full border border-current flex items-center justify-center
                                                                        ${selectedIds.has(inst.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-800'}
                                                                    `}
                                                                >
                                                                    {selectedIds.has(inst.id) && <div className="w-1 h-1 bg-white rounded-full" />}
                                                                </div>

                                                                <div className="flex items-center gap-1">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 shrink-0" />
                                                                    <span className="shrink-0 opacity-60">[{format(new Date(inst.start_date || inst.scheduled_date), 'HH:mm')}]</span>
                                                                    <span className="truncate pr-3">{inst.clients?.name || inst.title}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showForm && (
                <InstallationForm
                    installation={selectedInstallation}
                    onClose={() => setShowForm(false)}
                    onSuccess={() => {
                        setShowForm(false);
                        loadInstallations();
                    }}
                />
            )}

            {showDocuments && selectedInstallation && (
                <InstallationDocuments
                    installation={selectedInstallation}
                    onClose={() => setShowDocuments(false)}
                />
            )}
        </div>
    );
}
