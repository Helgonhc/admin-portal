'use client';

import { useState } from 'react';
import { MapPin, User, Clock, MoreVertical, Plus, CheckCircle2, AlertCircle, FileText, Building2, Clipboard, Plane, Droplets } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InstallationKanbanProps {
    installations: any[];
    onEdit: (installation: any) => void;
    onStatusChange: (id: string, newStatus: string) => void;
    onViewDocuments: (installation: any) => void;
}

const COLUMNS = [
    { id: 'pending', title: 'Pendente', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    { id: 'scheduled', title: 'Agendado', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'in_progress', title: 'Em Andamento', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'completed', title: 'Concluído', color: 'bg-green-50 text-green-700 border-green-200' },
];

export default function InstallationKanban({ installations, onEdit, onStatusChange, onViewDocuments }: InstallationKanbanProps) {
    const getInstallationsByStatus = (status: string) => {
        return installations.filter(i => i.status === status);
    };

    return (
        <div className="flex gap-6 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            {COLUMNS.map(column => {
                const items = getInstallationsByStatus(column.id);
                return (
                    <div key={column.id} className="flex-shrink-0 w-[22rem] flex flex-col group/column">
                        {/* Header Column */}
                        <div className={`flex items-center justify-between p-4 rounded-2xl mb-4 border ${column.color} shadow-sm backdrop-blur-sm`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${column.id === 'pending' ? 'bg-gray-400' : column.id === 'scheduled' ? 'bg-blue-500' : column.id === 'in_progress' ? 'bg-amber-500' : 'bg-emerald-500'} ring-4 ring-white/50`} />
                                <span className="font-black text-sm uppercase tracking-widest">{column.title}</span>
                            </div>
                            <span className="bg-white/80 px-3 py-1 rounded-lg text-xs font-black shadow-sm">
                                {items.length}
                            </span>
                        </div>

                        {/* Items Area */}
                        <div className="flex-1 space-y-4 min-h-[500px]">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 opacity-30 border-2 border-dashed border-slate-200 rounded-3xl">
                                    <Clipboard size={32} className="mb-2" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Sem itens</span>
                                </div>
                            ) : (
                                items.map(item => (
                                    <div
                                        key={item.id}
                                        className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-5 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1 transition-all group duration-300"
                                    >
                                        <div className="flex flex-col gap-4">
                                            {/* Header do Card */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {item.state && (
                                                            <div className="px-2 py-0.5 bg-slate-100 rounded-md flex items-center gap-1.5 border border-slate-200">
                                                                <img src={`https://cdn.jsdelivr.net/gh/arthurreira/br-state-flags@main/svgs/optimized/${item.state.toLowerCase()}.svg`} className="w-3.5 h-2.5 object-cover rounded-[1px]" alt={item.state} />
                                                                <span className="text-[9px] font-black text-slate-500">{item.state}</span>
                                                            </div>
                                                        )}
                                                        {item.clients?.is_telemetry_client && (
                                                            <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-md text-[9px] font-black border border-purple-100">
                                                                TELEMETRIA
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-black text-slate-800 dark:text-white text-base leading-snug line-clamp-2" title={item.title}>
                                                        {item.title}
                                                    </h4>
                                                    <p className="text-xs text-slate-400 font-medium mt-1 truncate">{item.clients?.name || 'Cliente Avulso'}</p>
                                                </div>
                                                <button
                                                    onClick={() => onEdit(item)}
                                                    className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 hover:text-indigo-600 transition-colors"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>

                                            {/* Info Técnica */}
                                            <div className="grid grid-cols-2 gap-2 py-3 border-y border-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-bold text-slate-300 uppercase">Data/Hora</span>
                                                    <div className="flex items-center gap-1.5 text-slate-600">
                                                        <Clock size={14} className="text-indigo-500" />
                                                        <span className="text-xs font-bold">
                                                            {item.start_date
                                                                ? format(new Date(item.start_date), "dd/MM HH:mm")
                                                                : item.scheduled_date ? format(new Date(item.scheduled_date), "dd/MM HH:mm") : '--/--'
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-bold text-slate-300 uppercase">Local</span>
                                                    <div className="flex items-center gap-1.5 text-slate-600">
                                                        <MapPin size={14} className="text-rose-500" />
                                                        <span className="text-xs font-medium truncate" title={item.location_address}>
                                                            {item.city || 'Ver endereço'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions Footer */}
                                            <div className="flex items-center gap-2 pt-1">
                                                <button
                                                    onClick={() => onViewDocuments(item)}
                                                    className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-xl font-bold text-[10px] uppercase transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <FileText size={14} /> Docs
                                                </button>

                                                {column.id !== 'completed' && (
                                                    <button
                                                        onClick={() => onStatusChange(item.id,
                                                            column.id === 'pending' ? 'scheduled' :
                                                                column.id === 'scheduled' ? 'in_progress' : 'completed'
                                                        )}
                                                        className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-white
                                                            ${column.id === 'pending' ? 'bg-blue-500 hover:bg-blue-600' :
                                                                column.id === 'scheduled' ? 'bg-amber-500 hover:bg-amber-600' :
                                                                    'bg-emerald-500 hover:bg-emerald-600'
                                                            }`}
                                                    >
                                                        {column.id === 'pending' ? 'Agendar' :
                                                            column.id === 'scheduled' ? 'Iniciar' : 'Concluir'}
                                                        <CheckCircle2 size={14} />
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
