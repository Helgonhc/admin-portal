'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import {
  History, Building2, Wrench, AlertCircle, Calendar, X, Check, RefreshCw, Trash2, Loader2, User, Clock,
  ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminTicketChat from '@/components/AdminTicketChat';
import { usePermissions } from '@/hooks/usePermissions';

// Função auxiliar para labels (pode estar em utils, mas coloco aqui para garantir)
const getPriorityLabel = (p: string) => {
  const map: any = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
  return map[p] || p;
};

const getStatusLabel = (s: string) => {
  const map: any = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    resolvido: 'Resolvido',
    fechado: 'Fechado',
    cancelado: 'Cancelado',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado'
  };
  return map[s] || s;
};

export default function TicketDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { can } = usePermissions();

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modals state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadTicket();
      loadTechnicians();
    }
  }, [params.id]);

  async function loadTicket() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          clients (id, name, email, phone, address),
          equipments (id, name, model, serial_number),
          profiles:created_by (id, full_name)
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setTicket(data);
    } catch (error: any) {
      console.error('Erro ao carregar ticket:', error);
      toast.error('Erro ao carregar detalhes do chamado');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id (full_name)
        `)
        .eq('table_name', 'tickets')
        .eq('record_id', params.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadTechnicians() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['technician', 'admin'])
      .eq('is_active', true);
    setTechnicians(data || []);
  }

  async function handleApprove() {
    if (!confirm('Tem certeza que deseja aprovar este chamado?')) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'aprovado' })
        .eq('id', ticket.id);

      if (error) throw error;

      toast.success('Chamado aprovado!');
      loadTicket();
    } catch (error) {
      toast.error('Erro ao aprovar chamado');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'rejeitado',
          rejection_reason: rejectReason
        })
        .eq('id', ticket.id);

      if (error) throw error;

      toast.success('Chamado rejeitado.');
      setShowRejectModal(false);
      loadTicket();
    } catch (error) {
      toast.error('Erro ao rejeitar chamado');
    } finally {
      setProcessing(false);
    }
  }

  async function handleConvertToOrder() {
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('convert_ticket_to_order', {
        p_ticket_id: ticket.id,
        p_technician_id: selectedTechnician,
        p_converted_by: profile?.id
      });

      if (error) throw error;

      toast.success('Chamado convertido em OS com sucesso!');
      setShowConvertModal(false);
      router.push(`/dashboard/orders/${data}`); // Redireciona para a nova OS
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao converter: ' + error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('ATENÇÃO: Isso excluirá o chamado permanentemente. Continuar?')) return;
    setProcessing(true);
    try {
      const { error } = await supabase.from('tickets').delete().eq('id', ticket.id);
      if (error) throw error;
      toast.success('Chamado excluído.');
      router.push('/dashboard/tickets');
    } catch (error) {
      toast.error('Erro ao excluir.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">Chamado não encontrado</h2>
        <button onClick={() => router.back()} className="btn btn-secondary mt-4">
          Voltar
        </button>
      </div>
    );
  }

  const canApprove = ticket.status === 'pendente';
  const canReject = ticket.status === 'pendente';
  const canConvert = ticket.status === 'aprovado' && !ticket.converted_to_order_id;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Chamado #{ticket.ticket_number || ticket.id.slice(0, 6)}
            </h1>
            <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full bg-gray-100 text-gray-600`}>
              {getStatusLabel(ticket.status)}
            </span>
          </div>
          <p className="text-gray-500 text-sm">Criado em {new Date(ticket.created_at).toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'details'
            ? 'text-indigo-600 border-b-2 border-indigo-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          Detalhes
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'chat'
            ? 'text-indigo-600 border-b-2 border-indigo-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          Chat & Notas
        </button>
        <button
          onClick={() => { setActiveTab('history'); loadHistory(); }}
          className={`px-6 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'history'
            ? 'text-indigo-600 border-b-2 border-indigo-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <History size={16} /> Histórico
        </button>
      </div>

      {activeTab === 'details' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Info */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{ticket.title}</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Cliente */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3 text-indigo-500 font-semibold">
                <Building2 size={20} /> Cliente
              </div>
              <p className="text-lg font-bold dark:text-white">{ticket.clients?.name || 'Cliente Removido'}</p>
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mt-2">
                {ticket.clients?.email && <p>📧 {ticket.clients.email}</p>}
                {ticket.clients?.phone && <p>📱 {ticket.clients.phone}</p>}
                {ticket.clients?.address && <p>📍 {ticket.clients.address}</p>}
              </div>
            </div>

            {/* Equipamento */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3 text-emerald-500 font-semibold">
                <Wrench size={20} /> Equipamento
              </div>
              {ticket.equipments ? (
                <>
                  <p className="text-lg font-bold dark:text-white">{ticket.equipments.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {ticket.equipments.model} {ticket.equipments.serial_number && `(S/N: ${ticket.equipments.serial_number})`}
                  </p>
                </>
              ) : (
                <p className="text-gray-400 italic">Nenhum equipamento vinculado</p>
              )}
            </div>

            {/* Prioridade */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3 text-orange-500 font-semibold">
                <AlertCircle size={20} /> Prioridade
              </div>
              <p className="text-lg font-medium dark:text-white capitalize">{getPriorityLabel(ticket.priority)}</p>
            </div>

            {/* Datas */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3 text-blue-500 font-semibold">
                <Calendar size={20} /> Datas
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Aberto em:</strong> {new Date(ticket.created_at).toLocaleString()}
              </p>
              {ticket.updated_at && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  <strong>Atualizado em:</strong> {new Date(ticket.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {ticket.status === 'rejeitado' && ticket.rejection_reason && (
            <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-200 dark:border-red-800">
              <h3 className="text-red-700 dark:text-red-400 font-bold flex items-center gap-2 mb-2">
                <X size={20} /> Motivo da Rejeição
              </h3>
              <p className="text-red-600 dark:text-red-300">{ticket.rejection_reason}</p>
            </div>
          )}

          {/* Fotos */}
          {ticket.photos && ticket.photos.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Fotos Anexadas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {ticket.photos.map((url: string, idx: number) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-xl overflow-hidden border dark:border-gray-700 hover:opacity-80 transition-opacity">
                    <img src={url} alt="Anexo" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4">
            {canApprove && (
              <button onClick={handleApprove} disabled={processing} className="btn bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-green-500/20">
                <Check size={20} /> Aprovar Chamado
              </button>
            )}
            {canConvert && (
              <button onClick={() => setShowConvertModal(true)} disabled={processing} className="btn bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20">
                <RefreshCw size={20} /> Criar Ordem de Serviço
              </button>
            )}
            {canReject && (
              <button onClick={() => setShowRejectModal(true)} disabled={processing} className="btn border-2 border-red-100 text-red-600 hover:bg-red-50 flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all">
                <X size={20} /> Rejeitar
              </button>
            )}

            <div className="flex-1"></div>

            <button onClick={handleDelete} disabled={processing} className="btn text-red-500 hover:bg-red-50 px-4 rounded-xl transition-colors flex items-center gap-2">
              <Trash2 size={18} /> Excluir
            </button>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[500px]">
          <AdminTicketChat ticketId={params.id as string} />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4 animate-fadeIn">
          {loadingHistory ? (
            <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-indigo-500" /></div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum registro de atividade.</p>
            </div>
          ) : (
            <div className="space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700 ml-4">
              {auditLogs.map((log) => (
                <div key={log.id} className="relative pl-6 pb-2">
                  <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-gray-900 shadow-sm"></div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <User size={14} className="text-gray-400" /> {log.profiles?.full_name || 'Sistema'}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={12} /> {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{log.description || `Ação: ${log.action}`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowConvertModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-gray-800">
              <h3 className="text-xl font-bold dark:text-white">Criar Ordem de Serviço</h3>
              <p className="text-sm text-gray-500">Selecione o técnico responsável</p>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
              <button
                onClick={() => setSelectedTechnician(profile?.id || '')}
                className={`w-full p-4 rounded-xl border mb-3 flex items-center gap-3 transition-colors ${selectedTechnician === profile?.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">EU</div>
                <div className="text-left">
                  <p className="font-bold dark:text-white">Atribuir a mim</p>
                  <p className="text-xs text-gray-500">Você será o responsável</p>
                </div>
              </button>

              {technicians.filter(t => t.id !== profile?.id).map(tech => (
                <button
                  key={tech.id}
                  onClick={() => setSelectedTechnician(tech.id)}
                  className={`w-full p-3 rounded-xl border mb-2 flex items-center gap-3 transition-colors ${selectedTechnician === tech.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-500">
                    {tech.full_name?.[0]}
                  </div>
                  <div className="text-left">
                    <p className="font-medium dark:text-gray-200 text-sm">{tech.full_name}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-6 border-t dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowConvertModal(false)} className="btn hover:bg-gray-100 dark:hover:bg-gray-800 px-4 py-2 rounded-lg">Cancelar</button>
              <button onClick={handleConvertToOrder} disabled={!selectedTechnician || processing} className="btn bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-gray-800">
              <h3 className="text-xl font-bold text-red-600">Rejeitar Chamado</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">Motivo da rejeição</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full h-32 p-3 rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                placeholder="Explique por que o chamado está sendo rejeitado..."
              ></textarea>
            </div>
            <div className="p-6 border-t dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowRejectModal(false)} className="btn hover:bg-gray-100 dark:hover:bg-gray-800 px-4 py-2 rounded-lg">Cancelar</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || processing} className="btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold">
                Rejeitar Chamado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
