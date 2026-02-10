'use client';

import { useState, useEffect } from 'react';
import { supabase, ServiceOrder } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Filter, Eye, Loader2, ClipboardList, Calendar, LayoutGrid, List as ListIcon, User, Timer, AlertCircle, MapPin, Navigation, Map as MapIcon, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';
import { Skeleton, ListSkeleton } from '../../../components/Skeleton';
import { getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel } from '../../../utils/statusUtils';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';

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
  const [activeId, setActiveId] = useState<string | null>(null);

  // Enterprise Filters
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);

  const toggleColumn = (colId: string) => {
    setCollapsedColumns(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const orderId = active.id as string;
    const overId = over.id as string;

    // Se soltou sobre uma coluna (o ID da coluna está no kanbanColumns)
    const columns = ['pendente', 'em_andamento', 'aguardando_peca', 'concluido'];

    if (columns.includes(overId)) {
      const order = orders.find(o => o.id === orderId);
      if (order && order.status !== overId) {
        await updateOrderStatus(orderId, overId);
      }
      return;
    }

    // Se soltou sobre outro card, pega o status desse card
    const overOrder = orders.find(o => o.id === overId);
    if (overOrder) {
      const order = orders.find(o => o.id === orderId);
      if (order && order.status !== overOrder.status) {
        await updateOrderStatus(orderId, overOrder.status);
      }
    }
  };

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
    const orderDate = new Date(order.created_at);
    const matchesMonth = selectedMonth === 'all' || orderDate.getMonth().toString() === selectedMonth;
    const matchesYear = selectedYear === 'all' || orderDate.getFullYear().toString() === selectedYear;

    const matchesSearch = order.title.toLowerCase().includes(search.toLowerCase()) ||
      order.clients?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus && matchesMonth && matchesYear;
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
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input w-full sm:w-36 dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="all">Todos os Meses</option>
            {months.map((m, i) => (
              <option key={i} value={i.toString()}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="input w-full sm:w-28 dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="all">Todos os Anos</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {viewMode === 'list' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-full sm:w-40 dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="all">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          )}
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b dark:border-gray-800">
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Protocolo</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Ordem de Serviço</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Cliente</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Prioridade</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Técnico</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Data</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-gray-400 tracking-widest min-w-[100px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-800">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-20 text-center">
                        <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma ordem encontrada para o período selecionado</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-gray-400 uppercase">#{order.id.slice(0, 8)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/orders/${order.id}`} className="font-bold text-gray-800 dark:text-gray-100 hover:text-indigo-600 transition-colors line-clamp-1 italic">
                            {order.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium line-clamp-1">{order.clients?.name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === 'concluida' ? 'bg-green-100 text-green-800' :
                            order.status === 'em_andamento' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'cancelada' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                            {order.status === 'concluida' ? 'Concluída' :
                              order.status === 'em_andamento' ? 'Em Execução' :
                                order.status === 'cancelada' ? 'Cancelada' :
                                  order.status.charAt(0).toUpperCase() + order.status.slice(1)
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${getPriorityColor(order.priority)}`}>
                            {getPriorityLabel(order.priority)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {(order as any).technician?.full_name ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                {(order as any).technician.full_name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 line-clamp-1">
                                {(order as any).technician.full_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300 italic text-xs">Não atribuído</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-xs">
                            <span className="font-bold text-gray-700 dark:text-gray-300">{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                            <span className="text-gray-400 font-medium text-[10px]">{new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                              title="Ver Detalhes"
                            >
                              <Eye size={16} />
                            </Link>
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/portal/${order.id}`;
                                navigator.clipboard.writeText(url);
                                toast.success('Link do cliente copiado!');
                              }}
                              className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Copiar Link"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'kanban' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToWindowEdges]}
          >
            <div className="flex gap-4 overflow-x-auto pb-4 h-full scrollbar-thin">
              {kanbanColumns.map((col) => {
                const colOrders = filteredOrders.filter(o => {
                  const s = o.status?.toLowerCase();
                  if (col.id === 'concluido') return s === 'concluido' || s === 'concluida' || s === 'completed';
                  if (col.id === 'pendente') return s === 'pendente' || s === 'open' || s === 'aberto';
                  if (col.id === 'em_andamento') return s === 'em_andamento' || s === 'in_progress' || s === 'execucao' || s === 'em_execucao';
                  if (col.id === 'aguardando_peca') return s === 'aguardando_peca' || s === 'peca_pendente' || s === 'waiting_parts';
                  return s === col.id;
                });
                const isCollapsed = collapsedColumns.includes(col.id);
                return (
                  <DroppableColumn
                    key={col.id}
                    col={col}
                    count={colOrders.length}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleColumn(col.id)}
                  >
                    {!isCollapsed && (
                      <SortableContext
                        items={colOrders.map(o => o.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {colOrders.map((order) => (
                          <SortableOrderCard
                            key={order.id}
                            order={order}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                          />
                        ))}
                      </SortableContext>
                    )}
                  </DroppableColumn>
                );
              })}
            </div>

            <DragOverlay dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.5',
                  },
                },
              }),
            }}>
              {activeId ? (
                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-2xl border-2 border-indigo-500 w-[280px] rotate-3 scale-105 pointer-events-none opacity-90 cursor-grabbing">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700">DRAGGING</span>
                  </div>
                  <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1">{orders.find(o => o.id === activeId)?.title}</h4>
                  <p className="text-[11px] text-gray-500">{orders.find(o => o.id === activeId)?.clients?.name}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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

// --- Componentes Auxiliares para o DND ---

function DroppableColumn({ col, children, count, isCollapsed, onToggle }: any) {
  const { setNodeRef, isOver } = useSortable({
    id: col.id,
    disabled: isCollapsed,
    data: {
      type: 'Column',
      column: col,
    },
  });

  const getStatusCoreColor = () => {
    switch (col.id) {
      case 'pendente': return 'bg-slate-400';
      case 'em_andamento': return 'bg-indigo-500';
      case 'aguardando_peca': return 'bg-amber-500';
      case 'concluido': return 'bg-emerald-500';
      default: return 'bg-gray-400';
    }
  };

  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        className="flex flex-col w-12 min-w-[48px] h-full rounded-2xl bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/5 transition-all duration-500 relative group cursor-pointer hover:bg-white/60 dark:hover:bg-black/40"
        onClick={onToggle}
      >
        <div className="flex-1 flex flex-col items-center py-8 gap-12">
          <div className={`w-1 h-12 rounded-full ${getStatusCoreColor()} opacity-60 group-hover:opacity-100 transition-opacity`} />
          <div className="rotate-180 [writing-mode:vertical-lr] whitespace-nowrap flex items-center gap-4">
            <h3 className="font-black text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-[0.3em] opacity-70 group-hover:opacity-100 transition-opacity">
              {col.title}
            </h3>
            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500">{count}</span>
          </div>
        </div>
        <button className="absolute bottom-6 left-1/2 -translate-x-1/2 p-2 text-indigo-500/50 group-hover:text-indigo-500 transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[340px] max-w-[340px] h-full rounded-[32px] bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.05] ${isOver ? 'ring-2 ring-indigo-500/20 bg-indigo-50/30' : ''} transition-all duration-300`}
    >
      <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-white/[0.03]">
        <div className="flex items-center gap-4">
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusCoreColor()} shadow-[0_0_12px_rgba(0,0,0,0.1)]`} />
          <div>
            <h3 className="font-black text-gray-800 dark:text-gray-100 text-[11px] uppercase tracking-[0.15em] leading-none mb-1">{col.title}</h3>
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 tracking-wider">
              {count} {count === 1 ? 'ORDEM' : 'ORDENS'}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-white/5 rounded-xl transition-all"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {children}
        {count === 0 && (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-white/50 dark:bg-white/[0.03] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
              <ClipboardList className="w-5 h-5 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em]">Fila vazia</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableOrderCard({ order, getPriorityColor, getPriorityLabel }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const getStatusBorderColor = () => {
    const s = order.status?.toLowerCase();
    if (s === 'concluido' || s === 'concluida' || s === 'completed') return 'border-l-emerald-500';
    if (s === 'em_andamento' || s === 'in_progress') return 'border-l-indigo-500';
    if (s === 'aguardando_peca') return 'border-l-amber-500';
    return 'border-l-slate-300';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative bg-white dark:bg-white/[0.03] p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-gray-100 dark:border-white/[0.05] border-l-4 ${getStatusBorderColor()} hover:shadow-xl hover:translate-y-[-2px] transition-all cursor-grab active:cursor-grabbing`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${getPriorityColor(order.priority)}`}>
          {getPriorityLabel(order.priority)}
        </span>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const url = `${window.location.origin}/portal/${order.id}`;
              navigator.clipboard.writeText(url);
              toast.success('Link copiado!');
            }}
            className="p-1.5 bg-gray-50 dark:bg-white/5 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors"
          >
            <Copy size={13} />
          </button>
          <Link
            href={`/dashboard/orders/${order.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg font-black text-[9px] uppercase tracking-tighter hover:bg-indigo-600 hover:text-white transition-all"
          >
            VER
          </Link>
        </div>
      </div>

      <h4 className="font-bold text-[13px] text-gray-800 dark:text-gray-100 mb-1 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight">
        {order.title}
      </h4>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center">
          <User size={10} className="text-gray-400" />
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate italic">
          {order.clients?.name}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-white/[0.03]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-[8px] font-black text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
            {(order as any).technician?.full_name?.charAt(0) || 'U'}
          </div>
          <span className="text-[10px] text-gray-400 font-mono">#{order.id.slice(0, 6).toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-300 dark:text-gray-600">
          <LayoutGrid size={12} />
        </div>
      </div>
    </div>
  );
}
