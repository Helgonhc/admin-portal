'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/authStore';
import { ArrowLeft, Trash2, Loader2, Calendar, Clock, Check, X, RefreshCw, User, Building2, Wrench, AlertCircle, History } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createAuditLog } from '../../../../utils/auditUtils';

export default function TicketDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadTicket();
    loadTechnicians();
    setAuditLogs([]);
  }, [params.id]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id(full_name)
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

  async function loadTicket() {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, clients(name, phone, email, address), creator:profiles!tickets_created_by_fkey(full_name), equipments(name, model, serial_number)')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setTicket(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
      router.push('/dashboard/tickets');
    } finally {
      setLoading(false);
    }
  }

  async function loadTechnicians() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['admin', 'technician'])
      .eq('is_active', true)
      .order('full_name');
    setTechnicians(data || []);
  }

  async function updateStatus(newStatus: string) {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', params.id);
      if (error) throw error;

      // Auditoria
      if (profile?.id) {
        await createAuditLog({
          userId: profile.id,
          action: 'UPDATE',
          table: 'tickets',
          recordId: params.id as string,
          oldData: { status: ticket.status },
          newData: { status: newStatus },
          description: `Status do chamado #${ticket.ticket_number || params.id.slice(0, 6)} alterado para ${newStatus}.`
        });
      }

      toast.success('Status atualizado!');
      loadTicket();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleApprove() {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'aprovado' })
        .eq('id', params.id);
      if (error) throw error;

      // Auditoria
      if (profile?.id) {
        await createAuditLog({
          userId: profile.id,
          action: 'UPDATE',
          table: 'tickets',
          recordId: params.id as string,
          oldData: { status: ticket.status },
          newData: { status: 'aprovado' },
          description: `Chamado #${ticket.ticket_number || params.id.slice(0, 6)} aprovado pelo admin.`
        });
      }

      toast.success('Chamado aprovado!');
      loadTicket();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'rejeitado',
          rejection_reason: rejectReason.trim()
        })
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Chamado rejeitado');
      setShowRejectModal(false);
      loadTicket();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleConvertToOrder() {
    if (!selectedTechnician) {
      toast.error('Selecione um técnico');
      return;
    }
    setProcessing(true);
    try {
      console.log('🔄 Convertendo ticket para OS...');
      console.log('Dados:', {
        client_id: ticket.client_id,
        technician_id: selectedTechnician,
        title: ticket.title,
        priority: ticket.priority
      });

      // Mapear prioridade se necessário
      const priorityMap: Record<string, string> = {
        low: 'baixa', medium: 'media', high: 'alta', urgent: 'urgente',
        baixa: 'baixa', media: 'media', alta: 'alta', urgente: 'urgente'
      };

      // Criar ordem de serviço
      const { data: newOrder, error: orderError } = await supabase
        .from('service_orders')
        .insert([{
          client_id: ticket.client_id,
          equipment_id: ticket.equipment_id || null,
          technician_id: selectedTechnician,
          title: ticket.title,
          description: ticket.description || '',
          priority: priorityMap[ticket.priority] || 'media',
          status: 'pendente',
        }])
        .select()
        .single();

      console.log('Resultado:', { newOrder, orderError });
      if (orderError) throw orderError;

      // Atualizar ticket
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({
          status: 'convertido',
          converted_to_order_id: newOrder.id,
          converted_by: profile?.id
        })
        .eq('id', params.id);

      console.log('Ticket atualizado:', { ticketError });
      if (ticketError) throw ticketError;

      // Auditoria
      if (profile?.id) {
        await createAuditLog({
          userId: profile.id,
          action: 'UPDATE',
          table: 'tickets',
          recordId: params.id as string,
          oldData: { status: ticket.status },
          newData: { status: 'convertido', converted_to_order_id: newOrder.id },
          description: `Chamado #${ticket.ticket_number || params.id.slice(0, 6)} convertido em OS #${newOrder.id.slice(0, 6).toUpperCase()}.`
        });
      }

      toast.success('Convertido em OS com sucesso!');
      setShowConvertModal(false);
      router.push(`/dashboard/orders/${newOrder.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir este chamado permanentemente?')) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Excluído!');
      router.push('/dashboard/tickets');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'convertido': return 'badge-success';
      case 'aprovado': return 'badge-info';
      case 'em_analise': return 'badge-warning';
      case 'aberto': return 'badge-warning';
      case 'rejeitado': return 'badge-danger';
      default: return 'badge-gray';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      aberto: 'Aberto',
      em_analise: 'Em Análise',
      aprovado: 'Aprovado',
      convertido: 'Convertido em OS',
      rejeitado: 'Rejeitado',
      resolved: 'Resolvido',
      closed: 'Fechado',
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      baixa: '🟢 Baixa',
      media: '🟡 Média',
      alta: '🟠 Alta',
      urgente: '🔴 Urgente',
      low: '🟢 Baixa',
      medium: '🟡 Média',
      high: '🟠 Alta',
      urgent: '🔴 Urgente',
    };
    return labels[priority] || priority;
  };

  const canConvert = ticket?.status === 'aberto' || ticket?.status === 'aprovado';
  const canApprove = ticket?.status === 'aberto' || ticket?.status === 'em_analise';
  const canReject = ticket?.status === 'aberto' || ticket?.status === 'em_analise';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/tickets" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-800">{ticket.ticket_number || `#${ticket.id.slice(0, 6).toUpperCase()}`}</h1>
          </div>
          <p className="text-gray-500">{ticket.clients?.name}</p>
        </div>
        <span className={`badge ${getStatusColor(ticket.status)}`}>
          {getStatusLabel(ticket.status)}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'details'
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          Detalhes do Chamado
          {activeTab === 'details' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            loadHistory();
          }}
          className={`px-6 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'history'
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          <History size={16} />
          Histórico
          {activeTab === 'history' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
          )}
        </button>
      </div>

      {activeTab === 'details' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Título e Descrição */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{ticket.title}</h2>
            <p className="text-gray-600 dark:text-gray-400">{ticket.description}</p>
          </div>

          {/* Info Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Cliente */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="text-indigo-500" size={20} />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Cliente</h3>
              </div>
              <p className="font-medium text-lg dark:text-gray-100">{ticket.clients?.name}</p>
              {ticket.clients?.email && <p className="text-sm text-gray-500 dark:text-gray-400">📧 {ticket.clients.email}</p>}
              {ticket.clients?.phone && <p className="text-sm text-gray-500 dark:text-gray-400">📱 {ticket.clients.phone}</p>}
              {ticket.clients?.address && <p className="text-sm text-gray-500 dark:text-gray-400">📍 {ticket.clients.address}</p>}
            </div>

            {/* Equipamento */}
            {ticket.equipments && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="text-emerald-500" size={20} />
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">Equipamento</h3>
                </div>
                <p className="font-medium text-lg dark:text-gray-100">{ticket.equipments.name}</p>
                {ticket.equipments.model && <p className="text-sm text-gray-500 dark:text-gray-400">Modelo: {ticket.equipments.model}</p>}
                {ticket.equipments.serial_number && <p className="text-sm text-gray-500 dark:text-gray-400">SN: {ticket.equipments.serial_number}</p>}
              </div>
            )}

            {/* Prioridade */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-orange-500" size={20} />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Prioridade</h3>
              </div>
              <p className="text-lg font-medium dark:text-gray-100">{getPriorityLabel(ticket.priority)}</p>
            </div>

            {/* Data */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="text-blue-500" size={20} />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Criado em</h3>
              </div>
              <p className="text-lg font-medium dark:text-gray-100">{new Date(ticket.created_at).toLocaleString('pt-BR')}</p>
            </div>
          </div>

          {/* Motivo da Rejeição */}
          {ticket.status === 'rejeitado' && ticket.rejection_reason && (
            <div className="card bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <X className="text-red-500" size={20} />
                <h3 className="font-semibold text-red-700 dark:text-red-400">Motivo da Rejeição</h3>
              </div>
              <p className="text-red-600 dark:text-red-300">{ticket.rejection_reason}</p>
            </div>
          )}

          {/* Fotos */}
          {ticket.photos && ticket.photos.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">📷 Fotos ({ticket.photos.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ticket.photos.map((photo: string, index: number) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Foto ${index + 1}`}
                    className="rounded-xl object-cover h-32 w-full cursor-pointer hover:opacity-80 transition-opacity border border-gray-100 dark:border-gray-700 shadow-sm"
                    onClick={() => window.open(photo, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">⚡ Ações</h3>
            <div className="flex flex-wrap gap-3">
              {canApprove && ticket.status !== 'aprovado' && (
                <button onClick={handleApprove} disabled={processing} className="btn btn-success gap-2">
                  <Check size={20} /> Aprovar Chamado
                </button>
              )}
              {canReject && (
                <button onClick={() => setShowRejectModal(true)} disabled={processing} className="btn btn-danger-outline gap-2">
                  <X size={20} /> Rejeitar
                </button>
              )}
              {canConvert && (
                <button onClick={() => setShowConvertModal(true)} disabled={processing} className="btn btn-primary gap-2">
                  <RefreshCw size={20} /> Converter em OS
                </button>
              )}
              <button onClick={handleDelete} disabled={processing} className="btn btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 gap-2 border-red-100 dark:border-red-900">
                <Trash2 size={20} /> Excluir Chamado
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="card">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <History size={18} className="text-indigo-500" /> Registro de Atividades
            </h3>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <Clock size={48} className="mx-auto mb-3 text-gray-300 opacity-50" />
                <p className="text-gray-500 dark:text-gray-400">Nenhuma atividade registrada ainda.</p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-gray-700 before:to-transparent">
                {auditLogs.map((log) => (
                  <div key={log.id} className="relative flex items-start gap-4 group">
                    <div className="absolute left-0 mt-1 w-10 h-10 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-gray-900 group-hover:scale-125 transition-all shadow-sm" />
                    </div>

                    <div className="ml-10 flex-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group-hover:border-indigo-100 dark:group-hover:border-indigo-900">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          {log.profiles?.full_name || 'Sistema'}
                        </span>
                        <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                          <Clock size={12} /> {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {log.description}
                      </p>

                      {log.action === 'UPDATE' && log.new_values?.status && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Novo Status:</span>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-800">
                            {log.new_values.status.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Converter em OS */}
      {showConvertModal && (
        <div className="modal-overlay" onClick={() => setShowConvertModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Converter em Ordem de Serviço</h2>
              <p className="text-sm text-gray-500 mt-1">Selecione quem será responsável pela OS</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Atribuir para mim */}
              <button
                onClick={() => setSelectedTechnician(profile?.id || '')}
                className={`w-full p-4 rounded-lg border-2 text-left flex items-center gap-3 transition-all ${selectedTechnician === profile?.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                  <User className="text-white" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-emerald-700">⭐ Atribuir para mim</p>
                  <p className="text-sm text-gray-500">Você será o responsável pela OS</p>
                </div>
              </button>

              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span>ou escolha outro técnico</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Lista de Técnicos */}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {technicians.filter(t => t.id !== profile?.id).map((tech) => (
                  <button
                    key={tech.id}
                    onClick={() => setSelectedTechnician(tech.id)}
                    className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-all ${selectedTechnician === tech.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                      {tech.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{tech.full_name}</p>
                      <p className="text-xs text-gray-500">{tech.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowConvertModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleConvertToOrder}
                disabled={processing || !selectedTechnician}
                className="btn btn-primary"
              >
                {processing ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                Converter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rejeitar */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Rejeitar Chamado</h2>
            </div>
            <div className="p-6">
              <label className="label">Motivo da Rejeição *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input min-h-[100px]"
                placeholder="Informe o motivo da rejeição..."
              />
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowRejectModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="btn btn-danger"
              >
                {processing ? <Loader2 className="animate-spin" size={20} /> : <X size={20} />}
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
