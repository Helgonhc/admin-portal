'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { ChevronLeft, ChevronRight, Plus, Loader2, Calendar, Clock, Wrench, AlertTriangle, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

interface Appointment {
  id: string;
  client_id: string;
  service_type: string;
  title: string;
  description?: string;
  requested_date: string;
  requested_time_start?: string;
  status: string;
  clients?: { name: string };
}

interface MaintenanceContract {
  id: string;
  title: string;
  next_maintenance_date: string;
  last_maintenance_date: string | null;
  frequency: string;
  urgency_status: string;
  maintenance_type_name: string | null;
  maintenance_color: string | null;
  client_name: string;
  days_until_maintenance: number;
}

export default function AgendaPage() {
  const { profile } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceContract[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all', // 'all', 'orders', 'maintenance', 'appointments'
  });
  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    description: '',
    scheduled_date: '',
    scheduled_time: '09:00',
  });
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  async function loadData() {
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      const [appointmentsRes, ordersRes, maintenancesRes, clientsRes] = await Promise.all([
        supabase
          .from('appointment_requests')
          .select('*, clients(name)')
          .gte('requested_date', format(start, 'yyyy-MM-dd'))
          .lte('requested_date', format(end, 'yyyy-MM-dd'))
          .order('requested_date'),
        supabase
          .from('service_orders')
          .select('*, clients(name)')
          .gte('scheduled_at', format(start, 'yyyy-MM-dd'))
          .lte('scheduled_at', format(end, 'yyyy-MM-dd'))
          .not('scheduled_at', 'is', null)
          .order('scheduled_at'),
        supabase
          .from('active_maintenance_contracts')
          .select('id, title, next_maintenance_date, last_maintenance_date, frequency, urgency_status, maintenance_type_name, maintenance_color, client_name, days_until_maintenance')
          .gte('next_maintenance_date', format(start, 'yyyy-MM-dd'))
          .lte('next_maintenance_date', format(end, 'yyyy-MM-dd')),
        supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
      ]);

      setAppointments(appointmentsRes.data || []);
      setOrders(ordersRes.data || []);
      setMaintenances(maintenancesRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar agenda');
    } finally {
      setLoading(false);
    }
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getEventsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAppointments = filters.type === 'all' || filters.type === 'appointments'
      ? appointments.filter(a => a.requested_date === dateStr)
      : [];
    const dayOrders = filters.type === 'all' || filters.type === 'orders'
      ? orders.filter(o => o.scheduled_at?.split('T')[0] === dateStr)
      : [];
    const dayMaintenances = filters.type === 'all' || filters.type === 'maintenance'
      ? maintenances.filter(m => m.next_maintenance_date === dateStr)
      : [];
    return [
      ...dayAppointments.map(a => ({ ...a, type: 'appointment' })),
      ...dayOrders.map(o => ({ ...o, type: 'order' })),
      ...dayMaintenances.map(m => ({ ...m, type: 'maintenance' }))
    ];
  };

  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  // Estatísticas do mês
  const monthMaintenances = maintenances.length;
  const urgentMaintenances = maintenances.filter(m => m.urgency_status === 'vencido' || m.urgency_status === 'urgente').length;

  function openModal(date?: Date) {
    setFormData({
      client_id: '',
      title: '',
      description: '',
      scheduled_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      scheduled_time: '09:00',
    });
    setShowModal(true);
  }

  async function handleCreate() {
    if (!formData.client_id || !formData.title || !formData.scheduled_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('appointment_requests').insert([{
        client_id: formData.client_id,
        title: formData.title,
        service_type: formData.title,
        description: formData.description,
        requested_date: formData.scheduled_date,
        requested_time_start: formData.scheduled_time,
        status: 'pending',
        technician_id: profile?.id,
      }]);
      if (error) throw error;
      toast.success('Agendamento criado!');
      setShowModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateAppointmentStatus(id: string, newStatus: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('appointment_requests')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Status atualizado para ${newStatus}`);
      setSelectedEvent((prev: any) => prev ? { ...prev, status: newStatus } : null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-800">Agenda</h1>
          <p className="text-gray-500">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}>
            <Filter size={18} />
            Filtros
          </button>
          <button onClick={() => openModal()} className="btn btn-primary">
            <Plus size={20} />
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="card p-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Filtrar por Tipo</h3>
            {filters.type !== 'all' && (
              <button onClick={() => setFilters({ type: 'all' })} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <X size={14} /> Limpar
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFilters({ type: 'all' })} className={`btn btn-sm ${filters.type === 'all' ? 'btn-primary' : 'btn-secondary'}`}>
              Todos
            </button>
            <button onClick={() => setFilters({ type: 'orders' })} className={`btn btn-sm ${filters.type === 'orders' ? 'bg-amber-500 text-white' : 'btn-secondary'}`}>
              📋 Ordens de Serviço
            </button>
            <button onClick={() => setFilters({ type: 'maintenance' })} className={`btn btn-sm ${filters.type === 'maintenance' ? 'bg-purple-500 text-white' : 'btn-secondary'}`}>
              🔧 Manutenções Periódicas
            </button>
            <button onClick={() => setFilters({ type: 'appointments' })} className={`btn btn-sm ${filters.type === 'appointments' ? 'bg-blue-500 text-white' : 'btn-secondary'}`}>
              📅 Agendamentos
            </button>
          </div>
        </div>
      )}

      {/* Stats de Manutenções */}
      {monthMaintenances > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 border-l-4 border-l-purple-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{monthMaintenances}</p>
                <p className="text-sm text-gray-500">Manutenções no mês</p>
              </div>
            </div>
          </div>
          {urgentMaintenances > 0 && (
            <div className="card p-4 border-l-4 border-l-red-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{urgentMaintenances}</p>
                  <p className="text-sm text-gray-500">Urgentes/Vencidas</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 card">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap gap-3 mb-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-gray-600">Ordens</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-gray-600">Manutenções</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-gray-600">Agendamentos</span>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {days.map((day) => {
              const events = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const hasOrder = events.some(e => e.type === 'order');
              const hasMaintenance = events.some(e => e.type === 'maintenance');
              const hasAppointment = events.some(e => e.type === 'appointment');

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square p-1 rounded-lg text-sm transition-all relative ${isSelected
                    ? 'bg-indigo-600 text-white'
                    : isToday
                      ? 'bg-indigo-100 text-indigo-700 font-bold'
                      : 'hover:bg-gray-100'
                    }`}
                >
                  <span className="block">{format(day, 'd')}</span>
                  {events.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-0.5">
                      {hasOrder && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-amber-500'}`} />}
                      {hasMaintenance && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-purple-300' : 'bg-purple-500'}`} />}
                      {hasAppointment && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-300' : 'bg-indigo-500'}`} />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Events / Event Details */}
        <div className="card h-fit sticky top-6">
          {!selectedEvent ? (
            <>
              <h3 className="font-semibold text-gray-800 mb-4">
                {selectedDate
                  ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                  : 'Próximos Agendamentos'}
              </h3>

              {selectedDate && (
                <button
                  onClick={() => openModal(selectedDate)}
                  className="w-full btn btn-secondary mb-4"
                >
                  <Plus size={18} />
                  Agendar neste dia
                </button>
              )}

              <div className="space-y-3">
                {(!selectedDate ? [
                  ...appointments.map(a => ({ ...a, type: 'appointment' })),
                  ...orders.map(o => ({ ...o, type: 'order' })),
                  ...maintenances.map(m => ({ ...m, type: 'maintenance' }))
                ].filter(e => {
                  const date = e.requested_date || e.scheduled_at?.split('T')[0] || e.next_maintenance_date;
                  return date >= format(new Date(), 'yyyy-MM-dd');
                }).sort((a, b) => {
                  const dateA = a.requested_date || a.scheduled_at?.split('T')[0] || a.next_maintenance_date;
                  const dateB = b.requested_date || b.scheduled_at?.split('T')[0] || b.next_maintenance_date;
                  return dateA.localeCompare(dateB);
                }).slice(0, 10) : selectedDateEvents).length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    {selectedDate ? 'Nenhum evento neste dia' : 'Nenhum agendamento futuro'}
                  </p>
                ) : (
                  (!selectedDate ? [
                    ...appointments.map(a => ({ ...a, type: 'appointment' })),
                    ...orders.map(o => ({ ...o, type: 'order' })),
                    ...maintenances.map(m => ({ ...m, type: 'maintenance' }))
                  ].filter(e => {
                    const date = e.requested_date || e.scheduled_at?.split('T')[0] || e.next_maintenance_date;
                    return date >= format(new Date(), 'yyyy-MM-dd');
                  }).sort((a, b) => {
                    const dateA = a.requested_date || a.scheduled_at?.split('T')[0] || a.next_maintenance_date;
                    const dateB = b.requested_date || b.scheduled_at?.split('T')[0] || b.next_maintenance_date;
                    return dateA.localeCompare(dateB);
                  }).slice(0, 10) : selectedDateEvents).map((event: any) => (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`block p-3 rounded-lg border-l-4 hover:shadow-md transition-shadow cursor-pointer ${event.type === 'order'
                        ? 'bg-amber-50 border-amber-500'
                        : event.type === 'maintenance'
                          ? 'bg-purple-50 border-purple-500'
                          : 'bg-indigo-50 border-indigo-500'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {event.type === 'order' ? (
                            <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-bold">📋 OS</span>
                          ) : event.type === 'maintenance' ? (
                            <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded font-bold">🔧 MANUT</span>
                          ) : (
                            <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded font-bold">📅 AGEND</span>
                          )}
                          {!selectedDate && (
                            <span className="text-[10px] text-gray-500 font-medium">
                              {event.requested_date || event.scheduled_at?.split('T')[0] || event.next_maintenance_date}
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${event.status === 'confirmed' || event.status === 'confirmado' ? 'bg-green-100 text-green-700' :
                            event.status === 'pending' || event.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                          }`}>
                          {event.status === 'pending' || event.status === 'pendente' ? 'Pendente' :
                            event.status === 'confirmed' || event.status === 'confirmado' ? 'Confirmado' : event.status}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {event.type === 'maintenance' ? (event.maintenance_type_name || event.title) : (event.title || event.service_type)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 italic">
                        {event.type === 'maintenance' ? event.client_name : event.clients?.name}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> Voltar
                </button>
                <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${selectedEvent.status === 'confirmed' || selectedEvent.status === 'confirmado' ? 'bg-green-100 text-green-700' :
                  selectedEvent.status === 'pending' || selectedEvent.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                    selectedEvent.status === 'cancelled' || selectedEvent.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                  }`}>
                  {selectedEvent.status}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 leading-tight">
                    {selectedEvent.type === 'maintenance' ? (selectedEvent.maintenance_type_name || selectedEvent.title) : (selectedEvent.title || selectedEvent.service_type)}
                  </h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <Calendar size={14} />
                    {selectedEvent.requested_date || selectedEvent.scheduled_at?.split('T')[0] || selectedEvent.next_maintenance_date}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cliente:</span>
                    <span className="font-medium text-gray-800">{selectedEvent.type === 'maintenance' ? selectedEvent.client_name : selectedEvent.clients?.name}</span>
                  </div>
                  {(selectedEvent.requested_time_start || selectedEvent.scheduled_time) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Horário:</span>
                      <span className="font-medium text-gray-800">{selectedEvent.requested_time_start || selectedEvent.scheduled_time}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tipo:</span>
                    <span className="font-medium text-gray-800 uppercase">{selectedEvent.type}</span>
                  </div>
                </div>

                {selectedEvent.description && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Descrição</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t space-y-2">
                  {selectedEvent.type === 'appointment' && (
                    <>
                      {(selectedEvent.status === 'pending' || selectedEvent.status === 'pendente') && (
                        <button
                          onClick={() => updateAppointmentStatus(selectedEvent.id, 'confirmed')}
                          className="w-full btn btn-primary flex items-center justify-center gap-2"
                        >
                          Confirmar Agendamento
                        </button>
                      )}
                      {selectedEvent.status !== 'cancelled' && selectedEvent.status !== 'cancelado' && (
                        <button
                          onClick={() => updateAppointmentStatus(selectedEvent.id, 'cancelled')}
                          className="w-full btn btn-secondary text-red-600 hover:bg-red-50 border-red-200 flex items-center justify-center gap-2"
                        >
                          Cancelar
                        </button>
                      )}
                    </>
                  )}

                  {selectedEvent.type === 'order' && (
                    <Link
                      href={`/dashboard/orders/${selectedEvent.id}`}
                      className="w-full btn btn-primary flex items-center justify-center gap-2"
                    >
                      Ver Ordem de Serviço
                    </Link>
                  )}

                  {selectedEvent.type === 'maintenance' && (
                    <Link
                      href="/dashboard/maintenance"
                      className="w-full btn btn-primary flex items-center justify-center gap-2"
                    >
                      Ver Detalhes do Contrato
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Novo Agendamento</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Cliente *</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="input"
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Título *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  placeholder="Título do agendamento"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Data *</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Horário</label>
                  <input
                    type="time"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Detalhes do agendamento..."
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
