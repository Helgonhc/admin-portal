'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2, Building2, ClipboardList, Ticket, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export function GlobalSearchModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{
        clients: any[];
        orders: any[];
        tickets: any[];
    }>({ clients: [], orders: [], tickets: [] });
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSearch = useCallback(async (text: string) => {
        if (text.length < 2) {
            setResults({ clients: [], orders: [], tickets: [] });
            return;
        }

        setLoading(true);
        try {
            const [clientsRes, ordersRes, ticketsRes] = await Promise.all([
                supabase.from('clients').select('id, name').ilike('name', `%${text}%`).limit(3),
                supabase.from('service_orders').select('id, title').ilike('title', `%${text}%`).limit(3),
                supabase.from('tickets').select('id, title').ilike('title', `%${text}%`).limit(3),
            ]);

            setResults({
                clients: clientsRes.data || [],
                orders: ordersRes.data || [],
                tickets: ticketsRes.data || [],
            });
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, handleSearch]);

    const navigateTo = (path: string) => {
        router.push(path);
        onClose();
        setQuery('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 sm:px-0">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-scaleIn">
                <div className="p-4 border-b dark:border-gray-800 flex items-center gap-3">
                    <Search className="text-gray-400" size={20} />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Buscar clientes, ordens, chamados..."
                        className="flex-1 bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && onClose()}
                    />
                    {loading ? (
                        <Loader2 className="animate-spin text-indigo-500" size={18} />
                    ) : (
                        <div className="text-[10px] font-medium text-gray-400 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded uppercase">ESC</div>
                    )}
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {query.length < 2 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            Digite pelo menos 2 caracteres para pesquisar...
                        </div>
                    ) : (
                        <>
                            {results.clients.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Clientes</h4>
                                    {results.clients.map(c => (
                                        <button key={c.id} onClick={() => navigateTo(`/dashboard/clients`)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                                                <Building2 size={18} />
                                            </div>
                                            <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300">{c.name}</span>
                                            <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {results.orders.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ordens de Serviço</h4>
                                    {results.orders.map(o => (
                                        <button key={o.id} onClick={() => navigateTo(`/dashboard/orders/${o.id}`)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600">
                                                <ClipboardList size={18} />
                                            </div>
                                            <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300">{o.title}</span>
                                            <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {results.tickets.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Chamados</h4>
                                    {results.tickets.map(t => (
                                        <button key={t.id} onClick={() => navigateTo(`/dashboard/tickets/${t.id}`)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                                                <Ticket size={18} />
                                            </div>
                                            <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300">{t.title}</span>
                                            <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {results.clients.length === 0 && results.orders.length === 0 && results.tickets.length === 0 && (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    Nenhum resultado encontrado para "{query}"
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-800 flex items-center justify-between text-[10px] text-gray-400">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><span className="border px-1 rounded bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700">ESC</span> fechar</span>
                        <span className="flex items-center gap-1"><span className="border px-1 rounded bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700">↵</span> selecionar</span>
                    </div>
                    <div>Admin Portal v2.0</div>
                </div>
            </div>
        </div>
    );
}
