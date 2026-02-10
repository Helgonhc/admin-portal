'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import {
    Package, Clock, CheckCircle2, AlertCircle,
    MapPin, Phone, MessageCircle, PenTool,
    Download, FileText, Check, ShieldCheck,
    Smartphone, User, Calendar, Loader2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function ClientPortalPage() {
    const params = useParams();
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSignature, setShowSignature] = useState(false);
    const [signerName, setSignerName] = useState('');
    const [signerDoc, setSignerDoc] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        loadOrder();
    }, [params.id]);

    async function loadOrder() {
        try {
            // Buscar OS sem autenticação (RLS público deve estar habilitado)
            const { data: orderData, error: orderError } = await supabase
                .from('service_orders')
                .select(`
          *,
          clients (name, phone, email, address),
          equipments (name, model, serial_number, brand),
          technician:profiles!service_orders_technician_id_fkey (full_name, avatar_url)
        `)
                .eq('id', params.id)
                .single();

            if (orderError) throw orderError;
            setOrder(orderData);

            // Buscar itens da OS
            const { data: itemsData } = await supabase
                .from('service_order_items')
                .select('*')
                .eq('order_id', params.id);

            setItems(itemsData || []);
        } catch (error: any) {
            console.error('Erro:', error);
            toast.error('Não conseguimos localizar seu chamado.');
        } finally {
            setLoading(false);
        }
    }

    // Lógica de Assinatura (Simples para MVP)
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => setIsDrawing(false);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    async function handleApprove() {
        if (!signerName || !signerDoc) {
            toast.error('Por favor, preencha seu nome e documento.');
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const signatureBase64 = canvas.toDataURL();

        setSaving(true);
        try {
            const { error } = await supabase
                .from('service_orders')
                .update({
                    status: 'em_andamento', // Ao aprovar, entra em execução
                    signature_url: signatureBase64,
                    signer_name: signerName,
                    signer_doc: signerDoc,
                    completed_at: new Date().toISOString() // Data da aprovação/assinatura
                })
                .eq('id', params.id);

            if (error) throw error;

            toast.success('Orçamento aprovado com sucesso!');
            setShowSignature(false);
            loadOrder();
        } catch (error: any) {
            toast.error('Erro ao aprovar: ' + error.message);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-4 animate-bounce">
                    <Package className="text-indigo-600 w-8 h-8" />
                </div>
                <p className="text-gray-500 font-medium animate-pulse">Carregando seu portal...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle size={64} className="text-red-400 mb-4" />
                <h1 className="text-2xl font-bold text-gray-800">Chamado não encontrado</h1>
                <p className="text-gray-500 mt-2">O link pode estar expirado ou incorreto.</p>
            </div>
        );
    }

    const total = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-600 via-indigo-600 to-gray-50 pb-20">
            <Toaster position="top-center" />

            {/* Header Premium */}
            <div className="p-6 text-white text-center">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-lg">
                    <ShieldCheck size={24} />
                </div>
                <h1 className="text-xl font-black uppercase tracking-tighter">Portal de Aprovação</h1>
                <p className="text-indigo-100/70 text-sm">CHAMEI - Ordem de Serviço #{order.id.slice(0, 8)}</p>
            </div>

            <div className="px-4 -mt-4 space-y-4 max-w-xl mx-auto">

                {/* Card de Status */}
                <div className="bg-white rounded-3xl shadow-xl p-6 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${order.status === 'concluido' ? 'bg-emerald-100 text-emerald-600' :
                                order.status === 'cancelado' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                }`}>
                                {order.status === 'concluido' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status Atual</p>
                                <h2 className="text-lg font-bold text-gray-800 uppercase">
                                    {order.status === 'pendente' ? 'Aguardando Aprovação' :
                                        order.status === 'em_andamento' ? 'Em Execução' :
                                            order.status === 'concluido' ? 'Concluído' : 'Cancelado'}
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Simples */}
                    <div className="flex items-center justify-between px-2">
                        {[
                            { label: 'Aberto', active: true },
                            { label: 'Aprovação', active: ['em_andamento', 'concluido'].includes(order.status) },
                            { label: 'Conclusão', active: order.status === 'concluido' }
                        ].map((step, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-1">
                                <div className={`w-3 h-3 rounded-full ${step.active ? 'bg-indigo-600 scale-125 shadow-lg shadow-indigo-200' : 'bg-gray-200'}`} />
                                <span className={`text-[10px] font-bold uppercase transition-colors ${step.active ? 'text-indigo-600' : 'text-gray-400'}`}>{step.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="absolute top-[108px] left-[15%] right-[15%] h-[2px] bg-gray-100 -z-10" />
                </div>

                {/* Info do Cliente & Equipamento */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <User size={14} className="text-indigo-500" /> Informações do Cliente
                        </h3>
                        <p className="font-bold text-gray-800 text-lg">{order.clients?.name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <MapPin size={14} /> {order.clients?.address || 'Endereço não informado'}
                        </p>
                    </div>

                    <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Smartphone size={14} className="text-indigo-500" /> Equipamento sob Reparo
                        </h3>
                        <p className="font-bold text-gray-800 text-lg">{order.equipments?.name || 'Não informado'}</p>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Modelo</p>
                                <p className="text-sm font-medium text-gray-700">{order.equipments?.model || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Série</p>
                                <p className="text-sm font-medium text-gray-700">{order.equipments?.serial_number || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Itens / Orçamento */}
                <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100">
                    <div className="p-6 pb-2 border-b border-gray-50">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <FileText size={14} className="text-indigo-500" /> Detalhamento do Orçamento
                        </h3>
                    </div>

                    <div className="p-6 space-y-4">
                        {items.map((item, id) => (
                            <div key={id} className="flex justify-between items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                <div>
                                    <p className="font-bold text-gray-800">{item.description}</p>
                                    <p className="text-xs text-gray-500 font-medium">{item.quantity}x • R$ {item.unit_price.toFixed(2)}</p>
                                </div>
                                <p className="font-black text-gray-900">R$ {(item.quantity * item.unit_price).toFixed(2)}</p>
                            </div>
                        ))}

                        {items.length === 0 && (
                            <p className="text-center py-4 text-gray-400 italic text-sm">Nenhum item adicionado ao orçamento ainda.</p>
                        )}

                        <div className="pt-4 mt-4 bg-gray-50 rounded-2xl p-4 flex justify-between items-center">
                            <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Total Geral</span>
                            <span className="text-2xl font-black text-indigo-600">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                {/* Botão de Ação */}
                {order.status === 'pendente' && (
                    <button
                        onClick={() => setShowSignature(true)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all active:scale-95"
                    >
                        <PenTool size={24} />
                        APROVAR ORÇAMENTO AGORA
                    </button>
                )}

                {/* Informações Técnicas */}
                <div className="bg-indigo-900 rounded-3xl p-6 text-white shadow-lg">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-4">Suporte ao Cliente</h3>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                            <User size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-indigo-200"> Técnico Responsável</p>
                            <p className="font-bold">{order.technician?.full_name || 'Aguardando Atribuição'}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <button className="flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-bold transition-all">
                            <Phone size={14} /> Ligar
                        </button>
                        <button className="flex items-center justify-center gap-2 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold transition-all border border-emerald-500/30">
                            <MessageCircle size={14} /> WhatsApp
                        </button>
                    </div>
                </div>

                <p className="text-center text-[10px] text-gray-400 uppercase font-bold tracking-widest py-6">
                    © 2024 CHAMEI APP • Sistema de Gestão Inteligente
                </p>
            </div>

            {/* Modal de Assinatura */}
            {showSignature && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-scaleIn">
                        <div className="p-8 text-center bg-indigo-50 border-b border-indigo-100">
                            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Assine para Aprovar</h2>
                            <p className="text-gray-500 text-sm mt-1">Sua assinatura valida este orçamento legalmente.</p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={signerName}
                                        onChange={(e) => setSignerName(e.target.value)}
                                        className="w-full bg-gray-50 border-gray-100 focus:border-indigo-300 focus:ring-0 rounded-2xl p-4 text-sm font-bold"
                                        placeholder="Quem está assinando?"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2">CPF / Documento</label>
                                    <input
                                        type="text"
                                        value={signerDoc}
                                        onChange={(e) => setSignerDoc(e.target.value)}
                                        className="w-full bg-gray-50 border-gray-100 focus:border-indigo-300 focus:ring-0 rounded-2xl p-4 text-sm font-bold"
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Assinatura Digital</label>
                                    <button onClick={clearCanvas} className="text-[10px] font-black uppercase text-red-500 hover:bg-red-50 px-2 py-1 rounded">Limpar</button>
                                </div>
                                <div className="border-4 border-dashed border-gray-100 rounded-3xl overflow-hidden bg-gray-50/50">
                                    <canvas
                                        ref={canvasRef}
                                        width={500}
                                        height={200}
                                        className="w-full h-40 touch-none cursor-crosshair"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-gray-50 flex gap-3">
                            <button
                                onClick={() => setShowSignature(false)}
                                className="flex-1 py-4 text-gray-500 font-bold text-sm uppercase"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={saving}
                                className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                CONFIRMAR E APROVAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Estilos Adicionais */}
            <style jsx global>{`
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        canvas { touch-action: none; }
      `}</style>
        </div>
    );
}
