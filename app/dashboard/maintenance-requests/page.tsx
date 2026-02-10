'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Calendar, Clock, User, Check, X, MessageCircle, Loader2, AlertTriangle, Send, ChevronRight, Edit, Trash2, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface MaintenanceRequest {
  id: string;
  request_number: string;
  client_id: string;
  title: string;
  description?: string;
  suggested_date: string;
  suggested_time_period: string;
  confirmed_date?: string;
  admin_notes?: string;
  status: string;
  created_at: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  requester_name?: string;
  requester_email?: string;
  maintenance_type_name?: string;
  maintenance_color?: string;
  equipment_name?: string;
  display_status?: string;
}

export default function MaintenanceRequestsPage() {
  const { profile } = useAuthStore();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pendente');
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [responseForm, setResponseForm] = useState({
    action: 'confirmar' as 'confirmar' | 'reagendar',
    confirmed_date: '',
    admin_notes: ''
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    suggested_date: '',
    suggested_time_period: 'manha',
    admin_notes: ''
  });

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const { data, error } = await supabase
        .from('maintenance_requests_with_details')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  }

  const filteredRequests = requests.filter(r => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pendente') return r.status === 'pendente' || r.status === 'reagendado';
    return r.status === statusFilter;
  });

  // Estatísticas
  const pendentes = requests.filter(r => r.status === 'pendente').length;
  const reagendados = requests.filter(r => r.status === 'reagendado').length;
  const confirmados = requests.filter(r => r.status === 'confirmado' || r.status === 'aceito').length;

  function openResponseModal(request: MaintenanceRequest) {
    setSelectedRequest(request);
    setResponseForm({
      action: 'confirmar',
      confirmed_date: request.suggested_date,
      admin_notes: ''
    });
    setShowModal(true);
  }

  async function handleRespond() {
    if (!selectedRequest || !profile) return;
    if (!responseForm.confirmed_date) {
      toast.error('Selecione uma data');
      return;
    }

    setSaving(true);
    try {
      const newStatus = responseForm.action === 'confirmar' ? 'confirmado' : 'reagendado';

      const { error } = await supabase
        .from('maintenance_requests')
        .update({
          status: newStatus,
          confirmed_date: `${responseForm.confirmed_date}T12:00:00`,
          admin_notes: responseForm.admin_notes || null,
          responded_by: profile.id,
          responded_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success(newStatus === 'confirmado' ? 'Data confirmada!' : 'Nova data enviada ao cliente!');
      setShowModal(false);
      loadRequests();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConvertToContract(request: MaintenanceRequest) {
    if (!profile) return;
    if (!confirm('Converter esta solicitação em manutenção agendada?')) return;

    try {
      const { data, error } = await supabase.rpc('convert_maintenance_request_to_contract', {
        p_request_id: request.id,
        p_admin_id: profile.id
      });

      if (error) throw error;
      toast.success('Manutenção agendada com sucesso!');
      loadRequests();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  function openEditModal(request: MaintenanceRequest) {
    setSelectedRequest(request);
    setEditForm({
      title: request.title,
      description: request.description || '',
      suggested_date: request.confirmed_date || request.suggested_date,
      suggested_time_period: request.suggested_time_period,
      admin_notes: request.admin_notes || ''
    });
    setShowEditModal(true);
  }

  async function handleEditRequest() {
    if (!selectedRequest) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('maintenance_requests')
        .update({
          title: editForm.title,
          description: editForm.description || null,
          confirmed_date: editForm.suggested_date ? `${editForm.suggested_date}T12:00:00` : null,
          admin_notes: editForm.admin_notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;
      toast.success('Solicitação atualizada!');
      setShowEditModal(false);
      loadRequests();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRequest(request: MaintenanceRequest) {
    if (!confirm(`Excluir solicitação "${request.title}"?\n\nEsta ação não pode ser desfeita.`)) return;

    try {
      const { error } = await supabase
        .from('maintenance_requests')
        .delete()
        .eq('id', request.id);

      if (error) throw error;
      toast.success('Solicitação excluída!');
      loadRequests();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handleReschedule(request: MaintenanceRequest) {
    setSelectedRequest(request);
    setResponseForm({
      action: 'reagendar',
      confirmed_date: '',
      admin_notes: ''
    });
    setShowModal(true);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pendente': return 'bg-amber-500';
      case 'confirmado': return 'bg-emerald-500';
      case 'reagendado': return 'bg-blue-500';
      case 'aceito': return 'bg-emerald-500';
      case 'recusado': return 'bg-red-500';
      case 'cancelado': return 'bg-gray-500';
      case 'convertido': return 'bg-purple-500';
      case 'atrasado': return 'bg-red-600';
      case 'urgente': return 'bg-amber-600';
      default: return 'bg-gray-500';
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      pendente: 'Aguardando',
      confirmado: 'Confirmado',
      reagendado: 'Nova Data',
      aceito: 'Aceito',
      recusado: 'Recusado',
      cancelado: 'Cancelado',
      convertido: 'Agendado',
      atrasado: 'Atrasado',
      urgente: 'Urgente'
    };
    return labels[status] || status;
  }

  function getTimePeriodLabel(period: string) {
    const labels: Record<string, string> = {
      manha: 'Manhã',
      tarde: 'Tarde',
      qualquer: 'Qualquer horário'
    };
    return labels[period] || period;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Solicitações de Manutenção</h1>
          <p className="text-gray-500">Gerencie as solicitações dos clientes</p>
        </div>
        <Link href="/dashboard/maintenance" className="btn btn-secondary">
          <Calendar size={20} />
          Ver Manutenções Agendadas
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={`card cursor-pointer ${statusFilter === 'pendente' ? 'ring-2 ring-amber-500' : ''}`}
          onClick={() => setStatusFilter('pendente')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{pendentes + reagendados}</p>
              <p className="text-sm text-gray-500">Pendentes</p>
            </div>
          </div>
        </div>
        <div
          className={`card cursor-pointer ${statusFilter === 'confirmado' ? 'ring-2 ring-emerald-500' : ''}`}
          onClick={() => setStatusFilter('confirmado')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{confirmados}</p>
              <p className="text-sm text-gray-500">Confirmados</p>
            </div>
          </div>
        </div>
        <div
          className={`card cursor-pointer ${statusFilter === 'all' ? 'ring-2 ring-indigo-500' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-600">{requests.length}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="card text-center py-12">
            <Send className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Nenhuma solicitação encontrada</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div key={request.id} className={`card border-l-4 ${request.display_status === 'atrasado' ? 'border-l-red-500 bg-red-50' :
              request.display_status === 'urgente' ? 'border-l-amber-500 bg-amber-50' :
                request.status === 'pendente' ? 'border-l-amber-500' :
                  request.status === 'reagendado' ? 'border-l-blue-500' :
                    request.status === 'confirmado' || request.status === 'aceito' ? 'border-l-emerald-500' :
                      'border-l-gray-300'
              }`}>
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                {/* Info Principal */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-gray-500">{request.request_number}</span>
                    <span className={`badge text-white text-xs ${getStatusColor(request.display_status || request.status)}`}>
                      {getStatusLabel(request.display_status || request.status)}
                    </span>
                  </div>

                  <h3 className="font-semibold text-gray-800 mb-1">{request.title}</h3>
                  {request.description && (
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">{request.description}</p>
                  )}

                  {/* Cliente e Solicitante */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="font-medium text-gray-700">{request.client_name}</span>
                    {request.requester_name && (
                      <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                        <User className="w-3 h-3" />
                        Solicitado por: {request.requester_name}
                      </span>
                    )}
                  </div>

                  {/* Datas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Data Sugerida pelo Cliente</p>
                      <p className="font-semibold text-gray-800">
                        {new Date(request.suggested_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-gray-500">{getTimePeriodLabel(request.suggested_time_period)}</p>
                    </div>
                    {request.confirmed_date && (
                      <div className={`rounded-lg p-3 ${request.status === 'confirmado' ? 'bg-emerald-50' : 'bg-blue-50'
                        }`}>
                        <p className="text-xs text-gray-500 mb-1">
                          {request.status === 'confirmado' ? 'Data Confirmada' : 'Nova Data Sugerida'}
                        </p>
                        <p className={`font-semibold ${request.status === 'confirmado' ? 'text-emerald-700' : 'text-blue-700'
                          }`}>
                          {new Date(request.confirmed_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>

                  {request.admin_notes && (
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-medium mb-1">Observação:</p>
                      <p className="text-sm text-blue-800">{request.admin_notes}</p>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex flex-col gap-2 lg:w-48">
                  {request.status === 'pendente' && (
                    <>
                      <button
                        onClick={() => openResponseModal(request)}
                        className="btn btn-primary w-full"
                      >
                        <Check size={16} />
                        Responder
                      </button>
                      {request.client_phone && (
                        <button
                          onClick={() => {
                            const phone = request.client_phone!.replace(/\D/g, '');
                            const num = phone.length <= 11 ? '55' + phone : phone;
                            const msg = `Olá ${request.requester_name || request.client_name}! Recebemos sua solicitação de manutenção para ${new Date(request.suggested_date + 'T12:00:00').toLocaleDateString('pt-BR')}. Vamos analisar e confirmar em breve.`;
                            window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          className="btn btn-secondary w-full"
                        >
                          <MessageCircle size={16} />
                          WhatsApp
                        </button>
                      )}
                    </>
                  )}

                  {request.status === 'reagendado' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                      <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                      <p className="text-xs text-amber-700">Aguardando resposta do cliente</p>
                    </div>
                  )}

                  {(request.status === 'confirmado' || request.status === 'aceito') && (
                    <button
                      onClick={() => handleConvertToContract(request)}
                      className="btn bg-purple-500 hover:bg-purple-600 text-white w-full"
                    >
                      <Calendar size={16} />
                      Agendar
                    </button>
                  )}

                  {request.status === 'convertido' && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                      <Check className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                      <p className="text-xs text-purple-700">Manutenção agendada</p>
                    </div>
                  )}

                  {/* Botões de Editar, Reagendar e Excluir */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => openEditModal(request)}
                      className="btn btn-sm btn-secondary flex-1"
                      title="Editar"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleReschedule(request)}
                      className="btn btn-sm bg-blue-500 hover:bg-blue-600 text-white flex-1"
                      title="Reagendar"
                    >
                      <CalendarClock size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(request)}
                      className="btn btn-sm bg-red-500 hover:bg-red-600 text-white flex-1"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    {new Date(request.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Resposta */}
      {showModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Responder Solicitação</h2>
              <p className="text-gray-500">{selectedRequest.request_number}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Info do Cliente */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-semibold text-gray-800">{selectedRequest.client_name}</p>
                {selectedRequest.requester_name && (
                  <p className="text-sm text-indigo-600">Solicitado por: {selectedRequest.requester_name}</p>
                )}
                <p className="text-sm text-gray-500 mt-2">{selectedRequest.title}</p>
              </div>

              {/* Data Sugerida */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-700 font-medium mb-1">Data sugerida pelo cliente:</p>
                <p className="text-lg font-bold text-amber-800">
                  {new Date(selectedRequest.suggested_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
                <p className="text-sm text-amber-600">{getTimePeriodLabel(selectedRequest.suggested_time_period)}</p>
              </div>

              {/* Ação */}
              <div>
                <label className="label">Ação</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setResponseForm(prev => ({
                        ...prev,
                        action: 'confirmar',
                        confirmed_date: selectedRequest.suggested_date
                      }));
                    }}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${responseForm.action === 'confirmar'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Check className={`w-6 h-6 mx-auto mb-2 ${responseForm.action === 'confirmar' ? 'text-emerald-600' : 'text-gray-400'
                      }`} />
                    <p className="font-semibold text-gray-800">Confirmar</p>
                    <p className="text-xs text-gray-500">Aceitar a data sugerida</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResponseForm(prev => ({ ...prev, action: 'reagendar' }))}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${responseForm.action === 'reagendar'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Calendar className={`w-6 h-6 mx-auto mb-2 ${responseForm.action === 'reagendar' ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                    <p className="font-semibold text-gray-800">Reagendar</p>
                    <p className="text-xs text-gray-500">Sugerir outra data</p>
                  </button>
                </div>
              </div>

              {/* Data */}
              <div>
                <label className="label">
                  {responseForm.action === 'confirmar' ? 'Data Confirmada' : 'Nova Data Sugerida'} *
                </label>
                <input
                  type="date"
                  value={responseForm.confirmed_date}
                  onChange={(e) => setResponseForm(prev => ({ ...prev, confirmed_date: e.target.value }))}
                  className="input"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Observação */}
              <div>
                <label className="label">Observação (opcional)</label>
                <textarea
                  value={responseForm.admin_notes}
                  onChange={(e) => setResponseForm(prev => ({ ...prev, admin_notes: e.target.value }))}
                  className="input min-h-[80px]"
                  placeholder="Ex: Técnico disponível apenas pela manhã..."
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={handleRespond} disabled={saving} className="btn btn-primary flex-1">
                {saving ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <Send size={16} />
                    {responseForm.action === 'confirmar' ? 'Confirmar Data' : 'Enviar Nova Data'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Editar Solicitação</h2>
              <p className="text-gray-500">{selectedRequest.request_number}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Título *</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Descrição</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="input min-h-[80px]"
                  placeholder="Descrição da solicitação..."
                />
              </div>

              <div>
                <label className="label">Data</label>
                <input
                  type="date"
                  value={editForm.suggested_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, suggested_date: e.target.value }))}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Período</label>
                <select
                  value={editForm.suggested_time_period}
                  onChange={(e) => setEditForm(prev => ({ ...prev, suggested_time_period: e.target.value }))}
                  className="input"
                >
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                  <option value="qualquer">Qualquer horário</option>
                </select>
              </div>

              <div>
                <label className="label">Observação do Admin</label>
                <textarea
                  value={editForm.admin_notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, admin_notes: e.target.value }))}
                  className="input min-h-[60px]"
                  placeholder="Observações internas..."
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={handleEditRequest} disabled={saving} className="btn btn-primary flex-1">
                {saving ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <Check size={16} />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
