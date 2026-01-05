'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { File, Download, Search, FolderOpen, Building2, Calendar, HardDrive, Trash2, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function GlobalDocumentsPage() {
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            // Load Clients for filter
            const { data: clientsData } = await supabase.from('clients').select('id, name').order('name');
            setClients(clientsData || []);

            // Load Documents with Client info
            let query = supabase
                .from('client_documents')
                .select('*, client:clients(name)')
                .order('created_at', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;
            setDocuments(data || []);
        } catch (error) {
            console.error('Erro ao carregar documentos:', error);
            toast.error('Erro ao carregar lista de documentos');
        } finally {
            setLoading(false);
        }
    }

    async function handleDownload(doc: any) {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(doc.file_url, 60);

            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (error) {
            toast.error('Erro ao gerar link de download');
        }
    }

    async function handleDelete(id: string, filePath: string) {
        if (!confirm('Tem certeza que deseja excluir este documento?')) return;

        try {
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([filePath]);

            if (storageError) console.warn('Erro storage:', storageError);

            const { error: dbError } = await supabase
                .from('client_documents')
                .delete()
                .eq('id', id);

            if (dbError) throw dbError;

            toast.success('Documento excluído');
            setDocuments(documents.filter(d => d.id !== id));
        } catch (error) {
            toast.error('Erro ao excluir documento');
        }
    }

    const filteredDocs = documents.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClient = selectedClient ? doc.client_id === selectedClient : true;
        return matchesSearch && matchesClient;
    });

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FolderOpen className="text-indigo-600" />
                        Todos os Documentos
                    </h1>
                    <p className="text-gray-500">Gerencie arquivos enviados para todos os clientes.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nome do arquivo ou cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                </div>
                <div className="w-full md:w-64 relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        value={selectedClient}
                        onChange={(e) => setSelectedClient(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none appearance-none bg-white"
                    >
                        <option value="">Todos os Clientes</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>)}
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Nenhum documento encontrado.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-3">Arquivo</th>
                                <th className="px-6 py-3">Cliente</th>
                                <th className="px-6 py-3">Data/Tamanho</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredDocs.map((doc) => (
                                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                <File size={18} />
                                            </div>
                                            <span className="font-medium text-gray-800">{doc.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Building2 size={16} />
                                            {doc.client?.name || 'Cliente desconhecido'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-500">
                                            <div className="flex items-center gap-1"><Calendar size={12} /> {new Date(doc.created_at).toLocaleDateString()}</div>
                                            <div className="flex items-center gap-1"><HardDrive size={12} /> {(doc.file_size / 1024).toFixed(1)} KB</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => handleDownload(doc)} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50" title="Baixar">
                                            <Download size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(doc.id, doc.file_url)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Excluir">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
