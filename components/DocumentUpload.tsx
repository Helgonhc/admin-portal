'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { FileUp, File, Download, Trash2, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface DocumentUploadProps {
    clientId: string;
}

export default function DocumentUpload({ clientId }: DocumentUploadProps) {
    const [documents, setDocuments] = useState<any[]>([]);
    const [telemetryDocuments, setTelemetryDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [category, setCategory] = useState('Outros');
    const [subcategory, setSubcategory] = useState('');
    const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split('T')[0]);

    const CATEGORIES = [
        { id: 'ART', label: 'ART', color: 'bg-blue-100 text-blue-700' },
        { id: 'Laudo', label: 'Laudo Técnico', color: 'bg-orange-100 text-orange-700' },
        { id: 'Ordem de Serviço', label: 'Ordem de Serviço', color: 'bg-gray-100 text-gray-700' },
        { id: 'Nota Fiscal', label: 'Nota Fiscal', color: 'bg-green-100 text-green-700' },
        { id: 'Orçamento', label: 'Orçamento', color: 'bg-emerald-100 text-emerald-700' },
        { id: 'Outros', label: 'Outros', color: 'bg-gray-50 text-gray-500' }
    ];

    const SUBCATEGORIES: Record<string, string[]> = {
        'Laudo': ['Cabine Primária', 'Termografia', 'SPDA', 'Quadros Elétricos', 'NR-10', 'Análise de Óleo', 'Outros'],
    };

    useEffect(() => {
        loadDocuments();
    }, [clientId]);

    async function loadDocuments() {
        try {
            const [clientDocsRes, telemetryDocsRes] = await Promise.all([
                supabase.from('client_documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
                supabase.from('installation_documents')
                    .select('*, installations!inner(client_id, title)')
                    .eq('installations.client_id', clientId)
                    .order('created_at', { ascending: false })
            ]);

            if (clientDocsRes.error) throw clientDocsRes.error;
            setDocuments(clientDocsRes.data || []);
            setTelemetryDocuments(telemetryDocsRes.data || []);
        } catch (error) {
            console.error('Erro ao carregar documentos:', error);
            toast.error('Erro ao carregar lista de documentos');
        } finally {
            setLoading(false);
        }
    }

    async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file size (e.g., max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('O arquivo deve ter no máximo 10MB');
            return;
        }

        if (category === 'Laudo' && !subcategory) {
            toast.error('Selecione uma subcategoria para o Laudo');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();

            // Sanitize category for the storage path (no accents or special chars)
            const sanitizedCategory = category
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '-')
                .replace(/[^a-zA-Z0-9-]/g, '');

            const fileName = `${clientId}/${sanitizedCategory}/${Date.now()}.${fileExt}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 2. Insert into Database
            const { error: dbError } = await supabase.from('client_documents').insert({
                client_id: clientId,
                title: file.name,
                file_url: fileName,
                file_type: fileExt,
                file_size: file.size,
                category: category,
                subcategory: category === 'Laudo' ? subcategory : null,
                reference_date: referenceDate
            });

            if (dbError) throw dbError;

            toast.success('Documento enviado com sucesso!');
            loadDocuments();
            // Reset fields
            setSubcategory('');
            setCategory('Outros');
        } catch (error: any) {
            console.error('Erro no upload:', error);
            toast.error(`Erro ao enviar: ${error.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function handleDownload(doc: any) {
        try {
            const { data, error } = await supabase.storage
                .from(doc.installations ? 'installation-documents' : 'documents')
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

            if (storageError) console.warn('Erro ao deletar arquivo do storage:', storageError);

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

    return (
        <div className="space-y-6">
            {/* Upload Area & Inputs */}
            <div className="bg-white border rounded-xl p-4 shadow-sm space-y-4">
                <h3 className="font-semibold text-gray-800">Novo Documento</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                        <select
                            value={category}
                            onChange={(e) => {
                                setCategory(e.target.value);
                                setSubcategory('');
                            }}
                            className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </div>

                    {category === 'Laudo' && (
                        <div className="animate-fadeIn">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Laudo</label>
                            <select
                                value={subcategory}
                                onChange={(e) => setSubcategory(e.target.value)}
                                className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">Selecione...</option>
                                {SUBCATEGORIES['Laudo'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data de Referência</label>
                        <input
                            type="date"
                            value={referenceDate}
                            onChange={(e) => setReferenceDate(e.target.value)}
                            className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                    />
                    <div className="flex flex-col items-center gap-2">
                        {uploading ? <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /> : <FileUp className="w-8 h-8 text-indigo-600" />}
                        <div>
                            <span className="text-indigo-600 font-bold hover:underline">Clique para enviar</span>
                            <span className="text-gray-500"> ou arraste</span>
                        </div>
                        <p className="text-xs text-gray-400">PDF, DOC, JPG (Máx 10MB)</p>
                    </div>
                </div>
            </div>

            {/* Documents List */}
            <div>
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <File className="w-5 h-5 text-gray-500" />
                    Documentos Compartilhados ({documents.length})
                </h3>

                {loading ? (
                    <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
                ) : documents.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 bg-gray-50 rounded-lg">Nenhum documento compartilhado ainda.</p>
                ) : (
                    <div className="grid gap-3">
                        {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <File size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-800 text-sm">{doc.title}</h4>
                                        <p className="text-xs text-gray-500">
                                            Enviado em {new Date(doc.created_at).toLocaleDateString('pt-BR')} • {(doc.file_size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDownload(doc)}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Baixar"
                                    >
                                        <Download size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(doc.id, doc.file_url)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Telemetry Documents Section */}
            {telemetryDocuments.length > 0 && (
                <div className="pt-6 border-t border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-indigo-500" />
                        Documentos de Telemetria ({telemetryDocuments.length})
                    </h3>

                    <div className="grid gap-3">
                        {telemetryDocuments.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl hover:shadow-md transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                        <File size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-800 text-sm">{doc.name || doc.title}</h4>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <span className="font-bold text-indigo-500">{doc.installations?.title}</span>
                                            <span>•</span>
                                            <span>{new Date(doc.created_at).toLocaleDateString('pt-BR')}</span>
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDownload(doc)}
                                    className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                    title="Baixar"
                                >
                                    <Download size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
