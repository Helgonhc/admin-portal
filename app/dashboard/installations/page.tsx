'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, LayoutGrid, Calendar as CalendarIcon, Loader2, Search, Filter, X, ChevronRight, List, Globe, Plane, Droplets } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
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
import './TelemetryPrint.css';
import { FileDown, Printer } from 'lucide-react';

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

    useEffect(() => {
        loadInstallations();
    }, []);

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
                .select('id, name, is_telemetry_client');

            const mergedData = instData.map(inst => ({
                ...inst,
                clients: clientsData?.find(c => c.id === inst.client_id) || null
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
            const { error } = await supabase
                .from('installations')
                .update({ status: newStatus })
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

    // Função para exportar para Excel (CSV)
    const handleExportExcel = () => {
        if (filteredInstallations.length === 0) {
            toast.error('Nenhum dado para exportar');
            return;
        }

        // Cabeçalho do CSV
        const headers = ['Título', 'Cliente', 'Estado', 'Cidade', 'Endereço', 'Data Início', 'Data Fim', 'Status', 'Técnico', 'Necessita Viagem'];

        // Mapear dados
        const rows = filteredInstallations.map(inst => [
            inst.title || '',
            inst.clients?.name || '',
            inst.state || '',
            inst.city || '',
            `"${inst.location_address || ''}"`, // Aspas para endereços com vírgula
            inst.start_date ? format(new Date(inst.start_date), 'dd/MM/yyyy HH:mm') : '',
            inst.end_date ? format(new Date(inst.end_date), 'dd/MM/yyyy HH:mm') : '',
            inst.status || '',
            inst.technician_name || '',
            inst.requires_travel ? 'Sim' : 'Não'
        ]);

        // Gerar string CSV (separado por ponto e vírgula para abrir direto no Excel PT-BR)
        const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

        // Criar blob e link de download
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `agenda_telemetria_${format(new Date(), 'dd_MM_yyyy')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success('Excel exportado com sucesso!');
    };

    // Função para imprimir
    const handlePrint = () => {
        window.print();
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
                            Fluxo de Operações Ativo
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
                        onClick={handleExportExcel}
                        className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl hover:bg-emerald-100 transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border border-emerald-100 dark:border-emerald-800"
                        title="Exportar para Excel"
                    >
                        <FileDown size={20} />
                        Excel
                    </button>

                    <button
                        onClick={handlePrint}
                        className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-100 transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border border-slate-100 dark:border-slate-800"
                        title="Imprimir Agenda"
                    >
                        <Printer size={20} />
                        Papel
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

            {/* Conteúdo Principal */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/50 dark:bg-gray-900/50 rounded-3xl animate-pulse">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                    <p className="text-gray-500 font-medium font-bold uppercase tracking-widest text-[10px]">Sincronizando cronograma...</p>
                </div>
            ) : (
                <div className="min-h-[600px]">
                    {view === 'kanban' ? (
                        <InstallationKanban
                            installations={filteredInstallations}
                            onEdit={(item) => {
                                setSelectedInstallation(item);
                                setShowForm(true);
                            }}
                            onStatusChange={handleStatusChange}
                            onViewDocuments={(item) => {
                                setSelectedInstallation(item);
                                setShowDocuments(true);
                            }}
                        />
                    ) : (
                        <div className="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden relative">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mb-6 rotate-6 group">
                                    <CalendarIcon className="w-12 h-12 text-indigo-500 -rotate-6 group-hover:rotate-0 transition-transform" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Agenda Técnica</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mt-3 font-bold text-sm">
                                    Acompanhe as próximas instalações <br />
                                    <span className="text-indigo-500 font-black">Organização por data e horário.</span>
                                </p>
                            </div>

                            <div className="mt-12 w-full max-w-4xl mx-auto space-y-4">
                                {filteredInstallations
                                    .filter(i => (i.start_date || i.scheduled_date) && i.status !== 'completed')
                                    .sort((a, b) => {
                                        const dateA = new Date(a.start_date || a.scheduled_date).getTime();
                                        const dateB = new Date(b.start_date || b.scheduled_date).getTime();
                                        return dateA - dateB;
                                    })
                                    .map(item => {
                                        const date = item.start_date || item.scheduled_date;
                                        return (
                                            <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-6 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 transition-all text-left group">
                                                <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 w-20 h-20 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 shrink-0 group-hover:scale-105 transition-transform">
                                                    <span className="text-[10px] font-black underline uppercase text-indigo-500">
                                                        {date ? format(new Date(date), 'MMM', { locale: ptBR }) : '-'}
                                                    </span>
                                                    <span className="text-2xl font-black text-slate-800 dark:text-white">
                                                        {date ? format(new Date(date), 'dd') : '-'}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${item.status === 'pending' ? 'bg-slate-100 text-slate-600' :
                                                            item.status === 'scheduled' ? 'bg-blue-100 text-blue-600' :
                                                                item.status === 'in_progress' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                                            }`}>
                                                            {item.status}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            {date ? format(new Date(date), 'HH:mm') : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-lg truncate flex items-center gap-2">
                                                        {item.title}
                                                        {item.state && (
                                                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500 font-black text-[10px]">
                                                                <img src={`https://raw.githubusercontent.com/stefanocurvello/flags-br/master/svg/${item.state.toLowerCase()}.svg`} className="w-3.5 h-2.5 object-cover rounded-[1px]" alt={item.state} />
                                                                {item.state}
                                                            </div>
                                                        )}
                                                        {item.requires_travel && <Plane size={14} className="text-blue-500 animate-pulse" />}
                                                    </h4>
                                                    <p className="text-sm text-slate-500 truncate flex items-center gap-1">
                                                        {item.location_address}
                                                    </p>
                                                    {item.start_date && (
                                                        <p className="text-[10px] font-bold text-indigo-500 mt-1 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-lg w-fit">
                                                            Período: {format(new Date(item.start_date), 'dd/MM HH:mm')} → {item.end_date ? format(new Date(item.end_date), 'dd/MM HH:mm') : 'Indefinido'}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedInstallation(item);
                                                        setShowForm(true);
                                                    }}
                                                    className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all"
                                                >
                                                    Detalhes
                                                </button>
                                            </div>
                                        );
                                    })}
                                {filteredInstallations.filter(i => (i.start_date || i.scheduled_date) && i.status !== 'completed').length === 0 && (
                                    <div className="py-20 text-center text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
                                        Nenhuma instalação agendada para os próximos dias
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

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
