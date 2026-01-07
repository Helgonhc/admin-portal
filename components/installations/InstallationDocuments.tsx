'use client';

import { useState, useEffect } from 'react';
import { X, Upload, File, Trash2, Loader2, Download, Search, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface InstallationDocumentsProps {
    installation: any;
    onClose: () => void;
}

export default function InstallationDocuments({ installation, onClose }: InstallationDocumentsProps) {
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadDocuments();
    }, [installation.id]);

    async function loadDocuments() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('installation_documents')
                .select('*')
                .eq('installation_id', installation.id)
                .order('uploaded_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error: any) {
            toast.error('Erro ao carregar documentos');
        } finally {
            setLoading(false);
        }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            toast.error('Arquivo muito grande (máx 10MB)');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `installations/${installation.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('installation-documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase
                .from('installation_documents')
                .insert([{
                    installation_id: installation.id,
                    file_name: file.name,
                    file_path: filePath,
                    file_type: file.type,
                }]);

            if (dbError) throw dbError;

            toast.success('Documento enviado!');
            loadDocuments();
        } catch (error: any) {
            console.error(error);
            toast.error('Erro ao enviar documento');
        } finally {
            setUploading(false);
        }
    }

    async function handleDelete(doc: any) {
        if (!confirm('Tem certeza que deseja excluir este documento?')) return;

        try {
            const { error: storageError } = await supabase.storage
                .from('installation-documents')
                .remove([doc.file_path]);

            if (storageError) throw storageError;

            const { error: dbError } = await supabase
                .from('installation_documents')
                .delete()
                .eq('id', doc.id);

            if (dbError) throw dbError;

            toast.success('Documento excluído');
            setDocuments(prev => prev.filter(d => d.id !== doc.id));
        } catch (error: any) {
            toast.error('Erro ao excluir documento');
        }
    }

    async function handleDownload(doc: any) {
        try {
            const { data, error } = await supabase.storage
                .from('installation-documents')
                .download(doc.file_path);

            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', doc.file_name);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error: any) {
            toast.error('Erro ao baixar documento');
        }
    }

    const filteredDocs = documents.filter(d =>
        d.file_name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-gray-950 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-white/10">
                {/* Header */}
                <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-br from-indigo-600/10 to-purple-600/10 dark:from-indigo-600/5 dark:to-purple-600/5">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                            <FileText className="text-white" size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                Documentos do Projeto
                            </h2>
                            <p className="text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                                {installation.title}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-white dark:hover:bg-gray-800 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* Upload Section */}
                    <div className="lg:w-72 p-6 bg-gray-50/50 dark:bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Adicionar Novo</h3>
                        <label className={`
              relative group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer
              ${uploading ? 'bg-indigo-50 border-indigo-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50/30'}
            `}>
                            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                            {uploading ? (
                                <>
                                    <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                                    <span className="text-sm font-bold text-indigo-700 animate-pulse">Enviando...</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Upload className="text-indigo-600" size={24} />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 text-center">Clique para Upload</span>
                                    <span className="text-[10px] text-gray-400 mt-2">Max 10MB (PDF, JPG, PNG)</span>
                                </>
                            )}
                        </label>

                        <div className="mt-8">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Informações</h3>
                            <div className="space-y-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <div className="text-[11px]">
                                    <p className="text-gray-400 font-bold uppercase mb-1">Local da Instalação</p>
                                    <p className="text-gray-700 dark:text-gray-300 font-medium">{installation.location_address}</p>
                                </div>
                                <div className="text-[11px]">
                                    <p className="text-gray-400 font-bold uppercase mb-1">Total de Arquivos</p>
                                    <p className="text-indigo-600 font-black">{documents.length} itens</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Documents List Area */}
                    <div className="flex-1 p-8 flex flex-col min-h-0 bg-white dark:bg-gray-950">
                        {/* Search */}
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Pesquisar nos documentos..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900 h-12 pl-12 pr-4 rounded-2xl border-none focus:ring-2 ring-indigo-500/20 text-sm font-medium transition-all"
                            />
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                    <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                                    <p className="font-bold text-gray-400">Escaneando documentos...</p>
                                </div>
                            ) : filteredDocs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                                    <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                        <File className="text-gray-300" size={32} />
                                    </div>
                                    <p className="text-gray-500 font-bold">Nenhum documento encontrado</p>
                                    <p className="text-xs text-gray-400 mt-1">Faça o upload do primeiro projeto para começar.</p>
                                </div>
                            ) : (
                                filteredDocs.map(doc => {
                                    const isImage = doc.file_type?.startsWith('image/');
                                    return (
                                        <div
                                            key={doc.id}
                                            className="group flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-900/30 hover:shadow-lg transition-all"
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center shadow-sm relative overflow-hidden group-hover:scale-105 transition-transform
                          ${isImage ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}
                        `}>
                                                    {isImage ? (
                                                        <ImageIcon className="text-purple-600" size={20} />
                                                    ) : (
                                                        <File className="text-indigo-600" size={20} />
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate group-hover:text-indigo-600 transition-colors">
                                                        {doc.file_name}
                                                    </span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                                        {new Date(doc.uploaded_at).toLocaleDateString()} • {doc.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => handleDownload(doc)}
                                                    className="p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 rounded-xl transition-colors"
                                                    title="Download"
                                                >
                                                    <Download size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(doc)}
                                                    className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm active:scale-95"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
