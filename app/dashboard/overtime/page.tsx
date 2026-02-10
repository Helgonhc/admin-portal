'use client';

import { useState, useEffect } from 'react';
import { supabase, OvertimeEntry } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Filter, Eye, Loader2, Clock, FileText, Check, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function OvertimePage() {
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '18:00',
    entry_type: 'overtime',
    reason: '',
  });

  // Enterprise Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [entriesRes, employeesRes] = await Promise.all([
        supabase
          .from('overtime_entries')
          .select('*, profiles!overtime_entries_user_id_fkey(full_name)')
          .order('entry_date', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['admin', 'technician'])
          .eq('is_active', true)
          .order('full_name'),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      setEntries(entriesRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  const filteredEntries = entries.filter(entry => {
    const entryDate = new Date(entry.entry_date + 'T00:00:00');
    const matchesMonth = selectedMonth === 'all' || entryDate.getMonth().toString() === selectedMonth;
    const matchesYear = selectedYear === 'all' || entryDate.getFullYear().toString() === selectedYear;

    const matchesSearch = entry.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      entry.reason?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;

    return matchesSearch && matchesStatus && matchesMonth && matchesYear;
  });

  function calculateHours(start: string, end: string): number {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return Math.max(0, (endMinutes - startMinutes) / 60);
  }

  async function handleCreate() {
    const userId = formData.user_id || profile?.id;
    if (!userId || !formData.entry_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const totalHours = calculateHours(formData.start_time, formData.end_time);
    if (totalHours <= 0) {
      toast.error('Horário inválido');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('overtime_entries').insert([{
        user_id: userId,
        entry_date: formData.entry_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        total_hours: totalHours,
        entry_type: formData.entry_type,
        reason: formData.reason,
        status: isAdmin ? 'aprovado' : 'pendente',
        approved_by: isAdmin ? profile?.id : null,
        approved_at: isAdmin ? new Date().toISOString() : null,
      }]);
      if (error) throw error;
      toast.success('Lançamento criado!');
      setShowModal(false);
      setFormData({
        user_id: '',
        entry_date: new Date().toISOString().split('T')[0],
        start_time: '08:00',
        end_time: '18:00',
        entry_type: 'overtime',
        reason: '',
      });
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(entry: OvertimeEntry) {
    try {
      const { error } = await supabase
        .from('overtime_entries')
        .update({
          status: 'aprovado',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', entry.id);
      if (error) throw error;
      toast.success('Aprovado!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handleReject(entry: OvertimeEntry) {
    const reason = prompt('Motivo da rejeição:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('overtime_entries')
        .update({
          status: 'rejeitado',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', entry.id);
      if (error) throw error;
      toast.success('Rejeitado');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aprovado': return 'badge-success';
      case 'rejeitado': return 'badge-danger';
      case 'pendente': return 'badge-warning';
      default: return 'badge-gray';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'overtime': return '⏰ Hora Extra';
      case 'compensation': return '🔄 Compensação';
      case 'absence': return '❌ Ausência';
      default: return type;
    }
  };

  // Calcular totais
  const totals = entries.reduce((acc, entry) => {
    if (entry.status === 'aprovado') {
      if (entry.entry_type === 'overtime') acc.overtime += entry.total_hours;
      if (entry.entry_type === 'compensation') acc.compensation += entry.total_hours;
      if (entry.entry_type === 'absence') acc.absence += entry.total_hours;
    }
    if (entry.status === 'pendente') acc.pending++;
    return acc;
  }, { overtime: 0, compensation: 0, absence: 0, pending: 0 });

  const saldo = totals.overtime - totals.compensation - totals.absence;

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
          <h1 className="text-2xl font-bold text-gray-800">Banco de Horas</h1>
          <p className="text-gray-500">{entries.length} lançamentos</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary">
            <FileText size={20} />
            Relatório
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={20} />
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-emerald-50 border-emerald-200">
          <p className="text-sm text-emerald-600 font-medium">Horas Extras</p>
          <p className="text-2xl font-bold text-emerald-700">+{totals.overtime.toFixed(1)}h</p>
        </div>
        <div className="card bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-600 font-medium">Compensações</p>
          <p className="text-2xl font-bold text-amber-700">-{totals.compensation.toFixed(1)}h</p>
        </div>
        <div className="card bg-red-50 border-red-200">
          <p className="text-sm text-red-600 font-medium">Ausências</p>
          <p className="text-2xl font-bold text-red-700">-{totals.absence.toFixed(1)}h</p>
        </div>
        <div className={`card ${saldo >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm font-medium ${saldo >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>Saldo</p>
          <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
            {saldo >= 0 ? '+' : ''}{saldo.toFixed(1)}h
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input
            type="text"
            placeholder="Buscar por funcionário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-with-icon"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input w-full sm:w-36"
          >
            <option value="all">Todos os Meses</option>
            {months.map((m, i) => (
              <option key={i} value={i.toString()}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="input w-full sm:w-28"
          >
            <option value="all">Todos os Anos</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="all">Todos os status</option>
            <option value="pendente">Pendente ({totals.pending})</option>
            <option value="aprovado">Aprovado</option>
            <option value="rejeitado">Rejeitado</option>
          </select>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="btn btn-secondary px-3"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Funcionário</th>
                <th>Tipo</th>
                <th>Horário</th>
                <th>Total</th>
                <th>Status</th>
                {isAdmin && <th className="text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="font-medium">{entry.profiles?.full_name}</td>
                    <td>{getTypeLabel(entry.entry_type)}</td>
                    <td>
                      {entry.start_time.substring(0, 5)} - {entry.end_time.substring(0, 5)}
                    </td>
                    <td className="font-bold">{entry.total_hours}h</td>
                    <td>
                      <span className={`badge ${getStatusColor(entry.status)}`}>
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {entry.status === 'pendente' && (
                            <>
                              <button
                                onClick={() => handleApprove(entry)}
                                className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600"
                                title="Aprovar"
                              >
                                <Check size={18} />
                              </button>
                              <button
                                onClick={() => handleReject(entry)}
                                className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                                title="Rejeitar"
                              >
                                <X size={18} />
                              </button>
                            </>
                          )}
                          <Link
                            href={`/dashboard/overtime/${entry.id}`}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                          >
                            <Eye size={18} />
                          </Link>
                        </div>
                      </td>
                    )}
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
              <h2 className="text-xl font-bold text-gray-800">Novo Lançamento</h2>
            </div>
            <div className="p-6 space-y-4">
              {isAdmin && (
                <div>
                  <label className="label">Funcionário</label>
                  <select
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Lançar para mim</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Data *</label>
                <input
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Início</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Fim</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">Tipo</label>
                <select
                  value={formData.entry_type}
                  onChange={(e) => setFormData({ ...formData, entry_type: e.target.value })}
                  className="input"
                >
                  <option value="overtime">⏰ Hora Extra</option>
                  <option value="compensation">🔄 Compensação</option>
                  <option value="absence">❌ Ausência</option>
                </select>
              </div>
              <div>
                <label className="label">Motivo/Observação</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Descreva o motivo..."
                />
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-700">
                  <strong>Total:</strong> {calculateHours(formData.start_time, formData.end_time).toFixed(1)} horas
                </p>
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
