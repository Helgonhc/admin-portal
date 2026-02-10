'use client';

import { useState } from 'react';
import { MapPin, User, Clock, MoreVertical, Plus, CheckCircle2, AlertCircle, FileText, Building2, Clipboard, Plane, Droplets, ChevronRight, LayoutList, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InstallationKanbanProps {
    installations: any[];
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onEdit: (installation: any) => void;
    onStatusChange: (id: string, newStatus: string) => void;
    onViewDocuments: (installation: any) => void;
    onExportPDF?: (installation: any) => void;
}

const COLUMNS = [
    { id: 'pendente', title: 'Pendentes', subtitle: 'Aguardando ação inicial', color: 'indigo', iconColor: 'text-indigo-600', bgColor: 'bg-indigo-50', darkBg: 'dark:bg-indigo-900/20', borderColor: 'border-indigo-200' },
    { id: 'agendada', title: 'Agendados', subtitle: 'Prontos para execução', color: 'blue', iconColor: 'text-blue-600', bgColor: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20', borderColor: 'border-blue-200' },
    { id: 'em_andamento', title: 'Em Andamento', subtitle: 'Operações em campo', color: 'amber', iconColor: 'text-amber-600', bgColor: 'bg-amber-50', darkBg: 'dark:bg-amber-900/20', borderColor: 'border-amber-200' },
    { id: 'concluida', title: 'Concluídas', subtitle: 'Histórico de sucesso', color: 'emerald', iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50', darkBg: 'dark:bg-emerald-900/20', borderColor: 'border-emerald-200' },
    { id: 'cancelada', title: 'Canceladas', subtitle: 'Serviços cancelados', color: 'red', iconColor: 'text-red-600', bgColor: 'bg-red-50', darkBg: 'dark:bg-red-900/20', borderColor: 'border-red-200' },
];

export default function InstallationKanban({ installations, selectedIds, onToggleSelection, onEdit, onStatusChange, onViewDocuments, onExportPDF }: InstallationKanbanProps) {
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        pendente: true,
        agendada: true,
        em_andamento: true,
        concluida: true
    });

    const toggleSection = (id: string) => {
        setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getInstallationsByStatus = (status: string) => {
        return installations.filter(i => {
            const s = i.status?.toLowerCase();
            if (status === 'pendente') return s === 'pending' || s === 'pendente' || !s;
            if (status === 'agendada') return s === 'scheduled' || s === 'agendada' || s === 'agendado';
            if (status === 'em_andamento') return s === 'in_progress' || s === 'em_andamento' || s === 'executando';
            if (status === 'concluida') return s === 'completed' || s === 'concluida' || s === 'concluído' || s === 'concluido' || s === 'feito' || s === 'concluída';
            return s === status;
        });
    };

    return (
        <div className="space-y-12 pb-12 animate-fadeIn">
            {COLUMNS.map(column => {
                const items = getInstallationsByStatus(column.id);
                if (items.length === 0 && column.id === 'completed') return null;

                const isCollapsed = collapsedSections[column.id];

                const statusColorClass = column.iconColor;
                const statusBgClass = column.bgColor;
                const statusDarkBgClass = column.darkBg;
                const statusBorderClass = column.borderColor;

                return (
                    <div key={column.id} className="relative">
                        {/* Header da Seção de Fluxo */}
                        <div
                            className="flex items-center justify-between mb-4 px-2 cursor-pointer group/header hover:opacity-80 transition-all select-none"
                            onClick={() => toggleSection(column.id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${statusBgClass} ${statusDarkBgClass} ${statusColorClass} transition-transform duration-500 ${isCollapsed ? '' : 'rotate-12'}`}>
                                    {column.id === 'pending' && <AlertCircle size={24} />}
                                    {column.id === 'scheduled' && <Calendar size={24} />}
                                    {column.id === 'in_progress' && <Droplets size={24} />}
                                    {column.id === 'completed' && <CheckCircle2 size={24} />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                                        {column.title}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBgClass} ${statusColorClass} border ${statusBorderClass} font-black`}>
                                            {items.length} ITENS
                                        </span>
                                        <ChevronRight size={18} className={`text-slate-300 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-90'}`} />
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{column.subtitle}</p>
                                </div>
                            </div>
                        </div>

                        {/* List Area */}
                        <div className={`space-y-3 overflow-hidden transition-all duration-500 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0 mb-0' : 'max-h-[5000px] opacity-100 mb-8'}`}>
                            {items.length === 0 ? (
                                <div className="py-10 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/30 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                                    <LayoutList className="text-slate-200 mb-2" size={32} />
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhum serviço nesta fase</span>
                                </div>
                            ) : (
                                items.map(item => (
                                    <div
                                        key={item.id}
                                        className={`group bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-[1.5rem] p-4 border transition-all duration-300 hover:shadow-xl relative overflow-hidden
                                            ${selectedIds.has(item.id)
                                                ? 'border-indigo-500 bg-indigo-50/10 dark:bg-indigo-900/10'
                                                : 'border-slate-100 dark:border-slate-800'}`}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                            {/* CHECKBOX DE SELEÇÃO ELITE */}
                                            <div className="shrink-0 flex items-center pr-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleSelection(item.id);
                                                    }}
                                                    className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all duration-300
                                                        ${selectedIds.has(item.id)
                                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 rotate-12'
                                                            : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800 hover:border-indigo-300'}`}
                                                >
                                                    {selectedIds.has(item.id) && <CheckCircle2 size={16} />}
                                                </button>
                                            </div>


                                            {/* Col 1: Identificação Principal */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {item.state && (
                                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm">
                                                            <img src={`https://raw.githubusercontent.com/stefanocurvello/flags-br/master/svg/${item.state.toLowerCase()}.svg`} className="w-3.5 h-2.5 object-cover rounded-[1px]" alt={item.state} />
                                                            <span className="text-[9px] font-black text-slate-500 uppercase">{item.state}</span>
                                                        </div>
                                                    )}
                                                    {item.clients?.is_telemetry_client && (
                                                        <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-lg border border-indigo-100">TELEMETRIA</span>
                                                    )}
                                                    {item.requires_travel && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-rose-50 text-rose-500 rounded-lg border border-rose-100">
                                                            <Plane size={10} /> VIAGEM
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-lg font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                                                    {item.title}
                                                </h4>
                                                <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wide flex items-center gap-2">
                                                    <Building2 size={12} className="text-slate-300" />
                                                    {item.clients?.name || 'Cliente Avulso'}
                                                </p>
                                            </div>

                                            {/* Col 2: Logística e Técnico */}
                                            <div className="lg:w-72 space-y-2">
                                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                        <Clock size={16} className="text-indigo-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[9px] font-black text-slate-300 uppercase leading-none mb-1">Agendamento</p>
                                                        <p className="text-xs font-black truncate">
                                                            {item.start_date ? format(new Date(item.start_date), "dd/MM/yyyy HH:mm") : 'A definir'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                        <User size={16} className="text-emerald-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[9px] font-black text-slate-300 uppercase leading-none mb-1">Responsável</p>
                                                        <p className="text-xs font-black truncate uppercase">
                                                            {item.technician_name || 'PENDENTE'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Col 3: Localização */}
                                            <div className="lg:w-64 flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-1">
                                                    <MapPin size={16} className="text-rose-500" />
                                                </div>
                                                <div className="min-w-0 overflow-hidden">
                                                    <p className="text-[9px] font-black text-slate-300 uppercase leading-none mb-1">Local da Operação</p>
                                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                                                        {item.location_address || 'Endereço não informado'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Col 4: Ações de Fluxo Elite */}
                                            <div className="flex items-center gap-2 lg:ml-auto">
                                                {column.id === 'concluida' && onExportPDF && (
                                                    <button
                                                        onClick={() => onExportPDF(item)}
                                                        className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-100 rounded-2xl shadow-sm transition-all active:scale-90"
                                                        title="Gerar Relatório Final"
                                                    >
                                                        <FileText size={20} />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => onViewDocuments(item)}
                                                    className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-2xl shadow-sm transition-all active:scale-90"
                                                    title="Documentos"
                                                >
                                                    <FileText size={20} />
                                                </button>

                                                <button
                                                    onClick={() => onEdit(item)}
                                                    className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-2xl shadow-sm transition-all active:scale-90"
                                                    title="Ajustar"
                                                >
                                                    <MoreVertical size={20} />
                                                </button>

                                                <div className="w-[1px] h-10 bg-slate-100 dark:bg-slate-800 mx-1 hidden lg:block" />

                                                {column.id !== 'concluida' && (
                                                    <button
                                                        onClick={() => onStatusChange(item.id,
                                                            column.id === 'pendente' ? 'agendada' :
                                                                column.id === 'agendada' ? 'em_andamento' : 'concluida'
                                                        )}
                                                        className={`h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 text-white min-w-[140px]
                                                            ${column.id === 'pending' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none' :
                                                                column.id === 'scheduled' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100 dark:shadow-none' :
                                                                    'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 dark:shadow-none'
                                                            }`}
                                                    >
                                                        {column.id === 'pending' ? 'Agendar' :
                                                            column.id === 'scheduled' ? 'Iniciar Operação' : 'Finalizar Serviço'}
                                                        <ChevronRight size={16} className="animate-pulse" />
                                                    </button>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
