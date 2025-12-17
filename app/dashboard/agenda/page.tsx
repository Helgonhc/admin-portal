'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { ChevronLeft, ChevronRight, Plus, Loader2, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Appointment {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  scheduled_date: string;
  scheduled_time?: string;
  status: string;
  clients?: { name: string };
}

export default function AgendaPage() {
  const { profile } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    description: '',
    scheduled_date: '',
    scheduled_time: '09:00',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  async function loadData() {
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      const [appointmentsRes, ordersRes, clientsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, clients(name)')
          .gte('scheduled_date', format(start, 'yyyy-MM-dd'))
          .lte('scheduled_date', format(end, 'yyyy-MM-dd'))
          .order('scheduled_date'),
        supabase
          .from('service_orders')
          .select('*, clients(name)')
          .gte('scheduled_date', format(start, 'yyyy-MM-dd'))
          .lte('scheduled_date', format(end, 'yyyy-MM-dd'))
          .not('scheduled_date', 'is', null)
          .order('scheduled_date'),
        supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
      ]);

      setAppointments(appointmentsRes.data || []);
      setOrders(ordersRes.data || []);
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
    const dayAppointments = appointments.filter(a => a.scheduled_date === dateStr);
    const dayOrders = orders.filter(o => o.scheduled_date === dateStr);
    return [...dayAppointments.map(a => ({ ...a, type: 'appointment' })), ...dayOrders.map(o => ({ ...o, type: 'order' }))];
  };

  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

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
      const { error } = await supabase.from('appointments').insert([{
        ...formData,
        status: 'scheduled',
        created_by: profile?.id,
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
        <button onClick={() => openModal()} className="btn btn-primary">
          <Plus size={20} />
          Novo Agendamento
        </button>
      </div>

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

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square p-1 rounded-lg text-sm transition-all relative ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : isToday
                      ? 'bg-indigo-100 text-indigo-700 font-bold'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <span className="block">{format(day, 'd')}</span>
                  {events.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-0.5">
                      {events.slice(0, 3).map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-white' : 'bg-indigo-500'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Events */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">
            {selectedDate
              ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
              : 'Selecione um dia'}
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
            {selectedDateEvents.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                {selectedDate ? 'Nenhum evento neste dia' : 'Selecione um dia no calendário'}
              </p>
            ) : (
              selectedDateEvents.map((event: any) => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    event.type === 'order'
                      ? 'bg-amber-50 border-amber-500'
                      : 'bg-indigo-50 border-indigo-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {event.type === 'order' ? (
                      <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded">OS</span>
                    ) : (
                      <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded">Agendamento</span>
                    )}
                    {event.scheduled_time && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={12} />
                        {event.scheduled_time}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-800 text-sm">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.clients?.name}</p>
                </div>
              ))
            )}
          </div>
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
