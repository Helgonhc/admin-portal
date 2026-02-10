'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { File, Download, Search, Folder, Calendar, HardDrive, ChevronRight, Home, ArrowLeft, Users, Building2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type DocFile = {
    id: string;
    title: string;
    file_url: string;
    file_type: string;
    file_size: number;
    category: string;
    subcategory: string | null;
    reference_date: string;
    created_at: string;
    client_id: string;
};

type Client = {
    id: string;
    name: string;
    client_logo_url?: string | null;
    doc_count?: number;
};

const CATEGORY_COLORS: any = {
    'ART': 'text-blue-600 bg-blue-50',
    'Laudo': 'text-orange-600 bg-orange-50',
    'Ordem de Serviço': 'text-gray-600 bg-gray-50',
    'Nota Fiscal': 'text-green-600 bg-green-50',
    'Orçamento': 'text-emerald-600 bg-emerald-50',
    'Outros': 'text-purple-600 bg-purple-50',
};

export default function GlobalDocumentsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [documents, setDocuments] = useState<DocFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Navigation State
    // Level 0: null (Show Clients)
    // Level 1: client_id (Show Years)
    // Level 2: Year (Show Categories)
    // Level 3: Category (Show Subcategories or Months)
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [currentPath, setCurrentPath] = useState<string[]>([]);

    useEffect(() => {
        loadClients();
    }, []);

    // Load documents when a client is selected
    useEffect(() => {
        if (selectedClient) {
            loadClientDocuments(selectedClient.id);
        } else {
            setDocuments([]); // Clear docs when back to root
        }
    }, [selectedClient]);

    async function loadClients() {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('id, name, client_logo_url')
                .order('name');

            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            toast.error('Erro ao carregar clientes');
        } finally {
            setLoading(false);
        }
    }

    async function loadClientDocuments(clientId: string) {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('client_documents')
                .select('*')
                .eq('client_id', clientId)
                .order('reference_date', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error) {
            toast.error('Erro ao carregar documentos do cliente');
        } finally {
            setLoading(false);
        }
    }

    async function handleDownload(doc: DocFile) {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(doc.file_url, 60, {
                    download: doc.title || 'documento'
                });

            if (error) throw error;

            // Create a temporary link to force download
            const link = document.createElement('a');
            link.href = data.signedUrl;
            link.download = doc.title || 'documento';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Erro ao baixar documento');
        }
    }

    async function handleDelete(id: string, filePath: string) {
        if (!confirm('Tem certeza que deseja excluir este documento?')) return;
        try {
            const { error: storageError } = await supabase.storage.from('documents').remove([filePath]);
            const { error: dbError } = await supabase.from('client_documents').delete().eq('id', id);

            if (dbError) throw dbError;
            toast.success('Documento excluído');
            setDocuments(documents.filter(d => d.id !== id));
        } catch (error) {
            toast.error('Erro ao excluir');
        }
    }

    function getMonthName(month: string) {
        const months: Record<string, string> = {
            '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril', '05': 'Maio', '06': 'Junho',
            '07': 'Julho', '08': 'Agosto', '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro', '00': 'Geral'
        };
        return months[month] || month;
    }

    // --- NEW LOGIC: YEAR > CATEGORY > ...
    const getCurrentItems = () => {
        // LEVEL 0: CLIENT LIST
        if (!selectedClient) {
            return clients
                .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(c => ({ type: 'client-folder', ...c }));
        }

        let docs = documents;

        // LEVEL 1: YEARS (Root of Client)
        if (currentPath.length === 0) {
            const currentYear = new Date().getFullYear();
            const allowedYears = [currentYear.toString(), (currentYear + 1).toString()]; // Filter 2 years

            const years = Array.from(new Set(docs.map(d => d.reference_date ? d.reference_date.substring(0, 4) : 'Sem Data')))
                .filter(y => allowedYears.includes(y));

            return years.sort().reverse().map(year => ({
                type: 'folder',
                name: year,
                count: docs.filter(d => (d.reference_date?.substring(0, 4) || 'Sem Data') === year).length
            }));
        }

        // Filter valid docs for subsequent levels (By Year)
        const year = currentPath[0];
        docs = docs.filter(d => (d.reference_date?.substring(0, 4) || 'Sem Data') === year);

        // LEVEL 2: CATEGORIES
        if (currentPath.length === 1) {
            const categories = Array.from(new Set(docs.map(d => d.category || 'Outros')));
            return categories.map(cat => ({
                type: 'folder',
                name: cat,
                count: docs.filter(d => (d.category || 'Outros') === cat).length
            }));
        }

        const category = currentPath[1];
        docs = docs.filter(d => (d.category || 'Outros') === category);

        // LEVEL 3: SUBCATEGORY (if Laudo) OR MONTH (if others)
        // Adjusting logic: User said "Year first".
        // If Category is Laudo -> Subcategory -> Month? Or just Subcategory?
        // Let's assume: Year > Laudo > Subcategory > Month > Files
        // And: Year > ART > Month > Files

        if (category === 'Laudo') {
            if (currentPath.length === 2) {
                const subcategories = Array.from(new Set(docs.map(d => d.subcategory || 'Geral')));
                return subcategories.map(sub => ({
                    type: 'folder',
                    name: sub,
                    count: docs.filter(d => (d.subcategory || 'Geral') === sub).length
                }));
            }

            const subcategory = currentPath[2];
            docs = docs.filter(d => (d.subcategory || 'Geral') === subcategory);

            if (currentPath.length === 3) {
                const months = Array.from(new Set(docs.map(d => d.reference_date ? d.reference_date.substring(5, 7) : '00')));
                return months.sort().reverse().map(month => ({ type: 'folder', name: getMonthName(month), id: month, count: docs.filter(d => (d.reference_date ? d.reference_date.substring(5, 7) : '00') === month).length }));
            }

            const monthName = currentPath[3];
            return docs.filter(d => getMonthName(d.reference_date ? d.reference_date.substring(5, 7) : '00') === monthName).map(d => ({ type: 'file', ...d }));
        }

        // Generic Category (ART, NF...) -> Month -> Files
        if (currentPath.length === 2) {
            const months = Array.from(new Set(docs.map(d => d.reference_date ? d.reference_date.substring(5, 7) : '00')));
            return months.sort().reverse().map(month => ({ type: 'folder', name: getMonthName(month), id: month, count: docs.filter(d => (d.reference_date ? d.reference_date.substring(5, 7) : '00') === month).length }));
        }

        const monthName = currentPath[2];
        return docs.filter(d => getMonthName(d.reference_date ? d.reference_date.substring(5, 7) : '00') === monthName).map(d => ({ type: 'file', ...d }));
    };

    const items = getCurrentItems();

    function navigateTo(item: any) {
        if (item.type === 'client-folder') {
            setSelectedClient(item);
            setCurrentPath([]);
        } else {
            setCurrentPath([...currentPath, item.name]);
        }
    }

    function navigateUp() {
        if (currentPath.length > 0) {
            setCurrentPath(currentPath.slice(0, -1));
        } else {
            setSelectedClient(null); // Back to client list
        }
    }

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Folder className="text-indigo-600" />
                        {selectedClient ? `Documentos: ${selectedClient.name}` : 'Todos os Documentos'}
                    </h1>
                    <p className="text-gray-500">
                        {selectedClient
                            ? 'Navegue por Ano > Categoria.'
                            : 'Selecione um cliente para visualizar seus documentos.'}
                    </p>
                </div>

                {!selectedClient && (
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                    </div>
                )}
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500 overflow-x-auto pb-2 border-b border-gray-100 mb-4">
                <button
                    onClick={() => setSelectedClient(null)}
                    className={`flex items-center gap-1 hover:text-indigo-600 transition-colors ${!selectedClient ? 'text-indigo-600 font-bold' : ''}`}
                >
                    <Users size={16} /> Clientes
                </button>
                {selectedClient && (
                    <>
                        <ChevronRight size={14} className="text-gray-300" />
                        <button
                            onClick={() => setCurrentPath([])}
                            className={`hover:text-indigo-600 transition-colors ${currentPath.length === 0 ? 'text-indigo-600 font-bold' : ''}`}
                        >
                            {selectedClient.name}
                        </button>
                    </>
                )}
                {currentPath.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 whitespace-nowrap">
                        <ChevronRight size={14} className="text-gray-300" />
                        <button
                            onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                            className={`hover:text-indigo-600 transition-colors ${index === currentPath.length - 1 ? 'text-indigo-600 font-bold' : ''}`}
                        >
                            {item}
                        </button>
                    </div>
                ))}
            </div>

            {/* Back Button */}
            {(selectedClient) && (
                <button onClick={navigateUp} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4">
                    <ArrowLeft size={16} /> Voltar
                </button>
            )}

            {/* Content Grid */}
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>)}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {items.map((item: any, idx) => {
                        if (item.type === 'client-folder') {
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => navigateTo(item)}
                                    className="cursor-pointer p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:scale-105 transition-all flex flex-col items-center justify-center text-center gap-3 bg-white"
                                >
                                    <div className="w-16 h-16 mb-2 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
                                        {item.client_logo_url ? (
                                            <img
                                                src={item.client_logo_url.startsWith('http') ? item.client_logo_url : supabase.storage.from('os-photos').getPublicUrl(item.client_logo_url).data.publicUrl}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).parentElement?.classList.add('bg-indigo-50');
                                                    // Force rendering of the fallback icon by manipulating DOM or state (simplified here by just hiding img)
                                                }}
                                            />
                                        ) : (
                                            <Building2 size={32} className="text-indigo-600" />
                                        )}
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-sm line-clamp-2">{item.name}</h3>
                                </div>
                            )
                        } else if (item.type === 'folder') {
                            return (
                                <div
                                    key={idx}
                                    onClick={() => navigateTo(item)}
                                    className="cursor-pointer p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:scale-105 transition-all flex flex-col items-center justify-center text-center gap-3 bg-white"
                                >
                                    <div className={`p-3 rounded-full ${CATEGORY_COLORS[currentPath[1] || item.name] || 'bg-indigo-50 text-indigo-600'}`}>
                                        <Folder size={32} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-sm">{item.name}</h3>
                                        <p className="text-xs text-gray-400">{item.count} arquivos</p>
                                    </div>
                                </div>
                            );
                        } else {
                            // File
                            return (
                                <div
                                    key={item.id}
                                    className="group relative bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="p-2 bg-gray-50 text-indigo-600 rounded-lg">
                                                <File size={24} />
                                            </div>
                                            <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                                {item.file_type}
                                            </span>
                                        </div>
                                        <h4 className="font-semibold text-gray-800 text-sm line-clamp-2 mb-1" title={item.title}>{item.title}</h4>
                                        <div className="text-xs text-gray-500 flex items-center gap-1 mb-4">
                                            <Calendar size={10} /> {new Date(item.created_at).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDownload(item)}
                                            className="flex-1 py-2 flex items-center justify-center gap-1 bg-indigo-50 text-indigo-600 rounded-lg font-medium text-xs hover:bg-indigo-100 transition-colors"
                                            title="Baixar"
                                        >
                                            <Download size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id, item.file_url)}
                                            className="flex-1 py-2 flex items-center justify-center gap-1 bg-red-50 text-red-600 rounded-lg font-medium text-xs hover:bg-red-100 transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        }
                    })}

                    {items.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400">
                            <Folder className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>Esta pasta está vazia.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
