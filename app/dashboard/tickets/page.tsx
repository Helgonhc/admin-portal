'use client';

import { useState, useEffect } from 'react';
import { supabase, Ticket } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Eye, Loader2, Ticket as TicketIcon, AlertCircle, User } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';
import { Skeleton, ListSkeleton } from '../../../components/Skeleton';
import { getStatusColor, getStatusLabel } from '../../../utils/statusUtils';

export default function TicketsPage() {
  const { can } = usePermissions();
  const { profile } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    description: '',
    priority: 'medium',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const ticketsRes = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (ticketsRes.error) {
        toast.error('Erro ao carregar tickets: ' + ticketsRes.error.message);
      } else {
        const ticketsWithJoins = await supabase
          .from('tickets')
          .select('*, clients(name), creator:profiles!tickets_created_by_fkey(full_name)')
          .order('created_at', { ascending: false });

        setTickets(ticketsWithJoins.data || ticketsRes.data || []);
      }

      const clientsRes = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setClients(clientsRes.data || []);

    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + (error?.message || 'Verifique sua conexão'));
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  }

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(search.toLowerCase()) ||
      ticket.clients?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleCreate() {
    if (!formData.client_id || !formData.title) {
      toast.error('Cliente e título são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const ticketNumber = `TKT-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

      const priorityMap: Record<string, string> = {
        low: 'baixa',
        medium: 'media',
        high: 'alta',
        urgent: 'alta',
      };

      const { data: newTicket, error } = await supabase.from('tickets').insert([{
        ticket_number: ticketNumber,
        client_id: formData.client_id,
        title: formData.title,
        description: formData.description || 'Sem descrição',
        priority: priorityMap[formData.priority] || 'media',
        status: 'aberto',
        created_by: profile?.id,
      }]).select('id, ticket_number').single();
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
          title: '🎫 Novo Chamado Criado',
          message: `Chamado: ${formData.title}`,
          type: 'ticket',
          reference_id: newTicket?.id,
          is_read: false
        }));
        await supabase.from('notifications').insert(notifications);
      }

      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'super_admin', 'technician'])
        .eq('is_active', true)
        .neq('id', profile?.id);

      if (allUsers && allUsers.length > 0) {
        const notifications = allUsers.map(u => ({
          user_id: u.id,
          title: '🎫 Novo Chamado Criado',
          message: `Cliente: ${selectedClient?.name || 'N/A'} - ${formData.title}`,
          type: 'ticket',
          reference_id: newTicket?.id,
          is_read: false
        }));
        await supabase.from('notifications').insert(notifications);
      }

      toast.success('Chamado criado!');
      setShowModal(false);
      setFormData({ client_id: '', title: '', description: '', priority: 'medium' });
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'urgente': return '🔴';
      case 'high':
      case 'alta': return '🟠';
      case 'medium':
      case 'media': return '🟡';
      case 'low':
      case 'baixa': return '🟢';
      default: return '⚪';
    }
  };

  if (loading) return <ListSkeleton />;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Chamados</h1>
          <p className="text-gray-500">{tickets.length} chamados</p>
        </div>
        {can('can_create_orders') && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={20} />
            Novo Chamado
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
          <option value="aberto">Aberto</option>
          <option value="em_analise">Em Análise</option>
          <option value="aprovado">Aprovado</option>
          <option value="convertido">Convertido em OS</option>
          <option value="rejeitado">Rejeitado</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Prioridade</th>
                <th>Título</th>
                <th>Cliente</th>
                <th>Solicitante</th>
                <th>Status</th>
                <th>Data</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    <TicketIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Nenhum chamado encontrado
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <span className="text-lg">{getPriorityIcon(ticket.priority)}</span>
                    </td>
                    <td>
                      <p className="font-medium text-gray-800">{ticket.title}</p>
                      {ticket.description && (
                        <p className="text-xs text-gray-500 line-clamp-1">{ticket.description}</p>
                      )}
                    </td>
                    <td>{ticket.clients?.name || '-'}</td>
                    <td>
                      {(ticket as any).creator?.full_name ? (
                        <span className="flex items-center gap-1 text-sm text-indigo-600">
                          <User size={14} />
                          {(ticket as any).creator.full_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getStatusColor(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td>
                      <div className="flex items-center justify-end">
                        <Link
                          href={`/dashboard/tickets/${ticket.id}`}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                          <Eye size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Novo Chamado</h2>
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
                  placeholder="Título do chamado"
                />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input min-h-[100px]"
                  placeholder="Descreva o problema..."
                />
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
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                Criar Chamado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
