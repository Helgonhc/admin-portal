'use client';

import { useState, useEffect } from 'react';
import { supabase, ServiceOrder } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Filter, Eye, Loader2, ClipboardList, Calendar, LayoutGrid, List as ListIcon, User, Timer, AlertCircle, MapPin, Navigation, Map as MapIcon } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';
import { Skeleton, ListSkeleton } from '../../../components/Skeleton';
import { getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel } from '../../../utils/statusUtils';

export default function OrdersPage() {
  const { can } = usePermissions();
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'map'>('kanban');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    equipment_id: '',
    technician_id: '',
    title: '',
    description: '',
    priority: 'medium',
    scheduled_date: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      console.log('🔄 Carregando dados...');

      const ordersRes = await supabase
        .from('service_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersRes.error) {
        toast.error('Erro ao carregar OS: ' + ordersRes.error.message);
      } else {
        const ordersWithJoins = await supabase
          .from('service_orders')
          .select('*, clients(name), technician:profiles!service_orders_technician_id_fkey(full_name), equipments(name)')
          .order('created_at', { ascending: false });

        setOrders(ordersWithJoins.data || ordersRes.data || []);
      }

      const clientsRes = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setClients(clientsRes.data || []);

      const techniciansRes = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['admin', 'technician'])
        .eq('is_active', true)
        .order('full_name');
      setTechnicians(techniciansRes.data || []);

    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + (error?.message || 'Verifique sua conexão'));
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
      toast.success('Status atualizado!');
    } catch (error: any) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  }

  async function loadEquipments(clientId: string) {
    if (!clientId) {
      setEquipments([]);
      return;
    }
    const { data } = await supabase
      .from('equipments')
      .select('id, name, model')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('name');
    setEquipments(data || []);
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.title.toLowerCase().includes(search.toLowerCase()) ||
      order.clients?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const kanbanColumns = [
    { id: 'pendente', title: 'Pendentes', color: 'bg-gray-100 dark:bg-gray-800' },
    { id: 'em_andamento', title: 'Em Andamento', color: 'bg-blue-50 dark:bg-blue-900/10' },
    { id: 'aguardando_peca', title: 'Aguardando Peça', color: 'bg-amber-50 dark:bg-amber-900/10' },
    { id: 'concluido', title: 'Concluídas', color: 'bg-emerald-50 dark:bg-emerald-900/10' },
  ];

  async function handleCreate() {
    if (!formData.client_id || !formData.title) {
      toast.error('Cliente e título são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const priorityMap: Record<string, string> = {
        low: 'baixa',
        medium: 'media',
        high: 'alta',
        urgent: 'urgente',
      };

      const insertData: any = {
        client_id: formData.client_id,
        title: formData.title,
        description: formData.description,
        priority: priorityMap[formData.priority] || 'media',
        status: 'pendente',
        technician_id: formData.technician_id || profile?.id,
      };
      if (formData.equipment_id) insertData.equipment_id = formData.equipment_id;
      if (formData.technician_id) insertData.technician_id = formData.technician_id;
      if (formData.scheduled_date) insertData.scheduled_at = formData.scheduled_date;

      const { data: newOrder, error } = await supabase.from('service_orders').insert([insertData]).select('id').single();
      if (error) throw error;

      const selectedClient = clients.find(c => c.id === formData.client_id);

      const { data: clientUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('client_id', formData.client_id)
        .eq('role', 'client')
        .eq('is_active', true);

      if (clientUsers && clientUsers.length > 0) {
        const notifications = clientUsers.map(u => ({
          user_id: u.id,
          title: '📋 Nova Ordem de Serviço',
          message: `OS criada: ${formData.title}`,
          type: 'order',
          reference_id: newOrder?.id,
          is_read: false
        }));
        await supabase.from('notifications').insert(notifications);
      }

      if (formData.technician_id && formData.technician_id !== profile?.id) {
        await supabase.from('notifications').insert({
          user_id: formData.technician_id,
          title: '📋 OS Atribuída a Você',
          message: `Cliente: ${selectedClient?.name || 'N/A'} - ${formData.title}`,
          type: 'order',
          reference_id: newOrder?.id,
          is_read: false
        });
      }

      toast.success('Ordem de serviço criada!');
      setShowModal(false);
      setFormData({ client_id: '', equipment_id: '', technician_id: '', title: '', description: '', priority: 'medium', scheduled_date: '' });
      setEquipments([]);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleClientChange(clientId: string) {
    setFormData({ ...formData, client_id: clientId, equipment_id: '' });
    loadEquipments(clientId);
  }

  if (loading) return <ListSkeleton />;

  return (
    <div className="space-y-6 animate-fadeIn h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 italic">Enterprise Operational Board</h1>
          <p className="text-gray-500 dark:text-gray-400">{orders.length} ordens monitoradas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
              title="Visualização em Lista"
            >
              <ListIcon size={20} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
              title="Visualização Kanban"
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'map' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
              title="Mapa Operacional"
            >
              <MapIcon size={20} />
            </button>
          </div>
          {can('can_create_orders') && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary shadow-indigo-200 dark:shadow-none">
              <Plus size={20} />
              Nova OS
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input
            type="text"
            placeholder="Buscar por título ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-with-icon dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        {viewMode === 'list' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-48 dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="all">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-6">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full text-center py-20 bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <ClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma ordem encontrada</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="card card-hover flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`badge ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${getPriorityColor(order.priority)}`}>
                      {getPriorityLabel(order.priority)}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1 line-clamp-1">{order.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">{order.clients?.name}</p>
                  {order.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-500 line-clamp-2 mb-4 italic flex-1">{order.description}</p>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500 pt-3 border-t dark:border-gray-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar size={13} strokeWidth={2.5} />
                      {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    {(order as any).technician?.full_name && (
                      <span className="flex items-center gap-1.5 font-medium bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-full">
                        <User size={13} strokeWidth={2.5} />
                        {(order as any).technician.full_name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {viewMode === 'kanban' && (
          /* KANBAN VIEW */
          <div className="flex gap-4 overflow-x-auto pb-4 h-full scrollbar-thin">
            {kanbanColumns.map((col) => {
              const colOrders = filteredOrders.filter(o => o.status === col.id);
              return (
                <div key={col.id} className={`flex flex-col min-w-[300px] max-w-[300px] h-full rounded-2xl ${col.color} border border-transparent dark:border-gray-800/50`}>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.id === 'pendente' ? 'bg-gray-400' : col.id === 'em_andamento' ? 'bg-blue-500' : col.id === 'aguardando_peca' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">{col.title}</h3>
                    </div>
                    <span className="bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm border dark:border-gray-700">
                      {colOrders.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                    {colOrders.map((order) => (
                      <div key={order.id} className="group relative bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-900 transition-all cursor-default">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${getPriorityColor(order.priority)}`}>
                            {getPriorityLabel(order.priority)}
                          </span>
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="p-1 px-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-600 hover:text-white"
                          >
                            DETAILS
                          </Link>
                        </div>

                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1 leading-tight">{order.title}</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 font-medium flex items-center gap-1.5">
                          <Timer size={12} className="text-gray-300" />
                          {order.clients?.name}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t dark:border-gray-800 mt-2">
                          <div className="flex -space-x-1.5">
                            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center overflow-hidden">
                              <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-300">
                                {(order as any).technician?.full_name?.charAt(0) || 'U'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">
                            #{order.id.slice(0, 4).toUpperCase()}
                          </span>
                        </div>

                        {/* Quick Status Picker on hover if needed or just drag handle */}
                      </div>
                    ))}

                    {colOrders.length === 0 && (
                      <div className="py-8 text-center bg-white/30 dark:bg-black/10 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Vazio</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'map' && (
          <div className="space-y-6 overflow-y-auto pb-6 h-full">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <MapPin className="text-indigo-600 dark:text-indigo-400" size={40} />
                </div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-4 italic uppercase tracking-tighter">Gerencial Geográfico</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm">
                  Visualize a distribuição dos seus chamados pendentes para otimizar as rotas dos técnicos.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      const addresses = filteredOrders
                        .filter(o => o.status === 'pendente')
                        .map(o => (o as any).clients?.address)
                        .filter(Boolean);
                      if (addresses.length === 0) return toast.error('Nenhum endereço pendente');
                      window.open(`https://www.google.com/maps/search/${encodeURIComponent(addresses.join(' | '))}`, '_blank');
                    }}
                    className="btn btn-primary w-full py-4 text-base gap-3"
                  >
                    <Navigation size={20} /> Otimizar Rota no Google Maps
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.filter(o => o.status === 'pendente' || o.status === 'em_andamento').map(order => (
                <div key={order.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between mb-4 text-left">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <MapPin size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm line-clamp-1">{order.clients?.name}</h4>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{(order as any).clients?.address || 'Sem endereço'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl mb-4 text-left">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 line-clamp-1 mb-1">{order.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{order.description || 'Sem detalhes'}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${getPriorityColor(order.priority)}`}>
                      {getPriorityLabel(order.priority)}
                    </span>
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center gap-1 hover:underline uppercase tracking-wide"
                    >
                      VER OS <Eye size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-2xl dark:bg-gray-900 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b bg-gradient-to-r from-indigo-500 to-purple-600">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Nova Ordem de Serviço</h2>
                  <p className="text-white/70 text-sm">Enterprise Operational Board</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">1</span>
                  Identificação
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label dark:text-gray-400">Cliente *</label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => handleClientChange(e.target.value)}
                      className="input dark:bg-gray-800 dark:border-gray-700"
                    >
                      <option value="">Selecione um cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label dark:text-gray-400">Equipamento</label>
                    <select
                      value={formData.equipment_id}
                      onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
                      className="input dark:bg-gray-800 dark:border-gray-700"
                      disabled={!formData.client_id}
                    >
                      <option value="">Selecione (opcional)</option>
                      {equipments.map((eq) => (
                        <option key={eq.id} value={eq.id}>{eq.name} {eq.model && `- ${eq.model}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">2</span>
                  Detalhes do Serviço
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="label dark:text-gray-400">Título *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input dark:bg-gray-800 dark:border-gray-700"
                      placeholder="Ex: Manutenção preventiva..."
                    />
                  </div>
                  <div>
                    <label className="label dark:text-gray-400">Descrição</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input min-h-[100px] resize-none dark:bg-gray-800 dark:border-gray-700"
                      placeholder="Descreva o serviço..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">3</span>
                  Atribuição e Agendamento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label dark:text-gray-400">Técnico</label>
                    <select
                      value={formData.technician_id}
                      onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
                      className="input dark:bg-gray-800 dark:border-gray-700"
                    >
                      <option value="">Selecione</option>
                      <option value={profile?.id}>⭐ Eu mesmo</option>
                      {technicians.filter(t => t.id !== profile?.id).map((tech) => (
                        <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label dark:text-gray-400">Prioridade</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 'low', label: 'Baixa', color: 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400', dot: 'bg-green-500' },
                        { value: 'medium', label: 'Média', color: 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400', dot: 'bg-amber-500' },
                        { value: 'high', label: 'Alta', color: 'bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400', dot: 'bg-orange-500' },
                        { value: 'urgent', label: 'Urgente', color: 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400', dot: 'bg-red-500' },
                      ].map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, priority: p.value })}
                          className={`px-2 py-2 rounded-lg border-2 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${formData.priority === p.value
                            ? `${p.color} border-current shadow-sm scale-105`
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                            }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`}></span>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t dark:border-gray-800 flex items-center justify-between">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                <span className="text-red-500">*</span> Campos obrigatórios
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="btn btn-secondary dark:hover:bg-gray-800">
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !formData.client_id || !formData.title}
                  className="btn btn-primary px-8"
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                  Criar OS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
