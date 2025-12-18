'use client';

import { useState, useEffect } from 'react';
import { supabase, ServiceOrder } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Filter, Eye, Loader2, ClipboardList, Calendar } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

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
      
      // Carregar OS - query simples primeiro
      const ordersRes = await supabase
        .from('service_orders')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('📋 Resultado OS:', { data: ordersRes.data?.length, error: ordersRes.error });

      if (ordersRes.error) {
        console.error('❌ Erro ao carregar OS:', ordersRes.error);
        toast.error('Erro ao carregar OS: ' + ordersRes.error.message);
      } else {
        // Se deu certo, buscar com joins (especificando a FK correta)
        const ordersWithJoins = await supabase
          .from('service_orders')
          .select('*, clients(name), technician:profiles!service_orders_technician_id_fkey(full_name), equipments(name)')
          .order('created_at', { ascending: false });
        
        setOrders(ordersWithJoins.data || ordersRes.data || []);
        console.log('✅ OS carregadas:', ordersWithJoins.data?.length || ordersRes.data?.length);
      }

      // Carregar clientes
      const clientsRes = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      console.log('👥 Clientes:', clientsRes.data?.length, clientsRes.error);
      setClients(clientsRes.data || []);

      // Carregar técnicos
      const techniciansRes = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['admin', 'technician'])
        .eq('is_active', true)
        .order('full_name');
      
      console.log('👷 Técnicos:', techniciansRes.data?.length, techniciansRes.error);
      setTechnicians(techniciansRes.data || []);

    } catch (error: any) {
      console.error('💥 Erro geral:', error);
      toast.error('Erro ao carregar dados: ' + (error?.message || 'Verifique sua conexão'));
    } finally {
      setLoading(false);
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

  async function handleCreate() {
    if (!formData.client_id || !formData.title) {
      toast.error('Cliente e título são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      // Mapear prioridade para português
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

      const { error } = await supabase.from('service_orders').insert([insertData]);
      if (error) throw error;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'concluido': return 'badge-success';
      case 'in_progress':
      case 'em_andamento': return 'badge-info';
      case 'pending':
      case 'pendente': return 'badge-warning';
      case 'cancelled':
      case 'cancelado': return 'badge-danger';
      default: return 'badge-gray';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      pendente: 'Pendente',
      in_progress: 'Em Andamento',
      em_andamento: 'Em Andamento',
      completed: 'Concluído',
      concluido: 'Concluído',
      cancelled: 'Cancelado',
      cancelado: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'urgente': return 'text-red-600 bg-red-50';
      case 'high':
      case 'alta': return 'text-orange-600 bg-orange-50';
      case 'medium':
      case 'media': return 'text-amber-600 bg-amber-50';
      case 'low':
      case 'baixa': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      urgent: 'Urgente',
      urgente: 'Urgente',
      high: 'Alta',
      alta: 'Alta',
      medium: 'Média',
      media: 'Média',
      low: 'Baixa',
      baixa: 'Baixa',
    };
    return labels[priority] || priority;
  };

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
          <h1 className="text-2xl font-bold text-gray-800">Ordens de Serviço</h1>
          <p className="text-gray-500">{orders.length} ordens cadastradas</p>
        </div>
        {can('can_create_orders') && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={20} />
            Nova OS
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input
            type="text"
            placeholder="Buscar por título ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-with-icon"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-full sm:w-48"
        >
          <option value="all">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <ClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Nenhuma ordem encontrada</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/orders/${order.id}`}
              className="card card-hover"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`badge ${getStatusColor(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(order.priority)}`}>
                  {getPriorityLabel(order.priority)}
                </span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1 line-clamp-1">{order.title}</h3>
              <p className="text-sm text-gray-500 mb-3">{order.clients?.name}</p>
              {order.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{order.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(order.created_at).toLocaleDateString('pt-BR')}
                </span>
                {order.technician?.full_name && (
                  <span>👤 {order.technician.full_name.split(' ')[0]}</span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Nova Ordem de Serviço</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cliente *</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="input"
                  >
                    <option value="">Selecione um cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Equipamento</label>
                  <select
                    value={formData.equipment_id}
                    onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
                    className="input"
                    disabled={!formData.client_id}
                  >
                    <option value="">Selecione (opcional)</option>
                    {equipments.map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.name} {eq.model && `- ${eq.model}`}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Título *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  placeholder="Título da ordem de serviço"
                />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input min-h-[100px]"
                  placeholder="Descreva o serviço a ser realizado..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Técnico Responsável</label>
                  <select
                    value={formData.technician_id}
                    onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Selecione (opcional)</option>
                    <option value={profile?.id}>⭐ Eu mesmo</option>
                    {technicians.filter(t => t.id !== profile?.id).map((tech) => (
                      <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Prioridade</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="input"
                  >
                    <option value="low">🟢 Baixa</option>
                    <option value="medium">🟡 Média</option>
                    <option value="high">🟠 Alta</option>
                    <option value="urgent">🔴 Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="label">Data Agendada</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                Criar OS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
