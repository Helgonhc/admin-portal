'use client';
// Fix: alert_days_before array conversion v2

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Edit, Trash2, Loader2, Calendar, AlertTriangle, Clock, Mail, MessageCircle, CheckCircle, Bell, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

interface Contract {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  frequency: string;
  next_maintenance_date: string;
  last_maintenance_date?: string;
  maintenance_value?: number;
  status: string;
  send_email_alert: boolean;
  send_whatsapp_alert: boolean;
  alert_days_before: number[];
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  maintenance_type_name?: string;
  maintenance_color?: string;
  urgency_status?: string;
  days_until_maintenance?: number;
  planned_next_date?: string; // NOVO: Data personalizada para o ciclo seguinte
}



export default function MaintenancePage() {
  const { can } = usePermissions();
  const { profile } = useAuthStore();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'contracts' | 'requests'>('contracts');

  // Enterprise Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    maintenance_type_id: '',
    title: '',
    description: '',
    frequency: 'anual',
    next_maintenance_date: '',
    last_maintenance_date: '',
    maintenance_value: 0,
    send_email_alert: true,
    send_whatsapp_alert: true,
    alert_days_before: [30, 15, 7],
    status: 'ativo',
    planned_next_date: '', // NOVO
  });

  // Modal Conclusão
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionData, setCompletionData] = useState({
    contractId: '',
    contractTitle: '',
    completedDate: '',
    nextDate: '',
    frequency: 'anual'
  });

  const nextDateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [contractsRes, clientsRes, typesRes] = await Promise.all([
        supabase.from('active_maintenance_contracts').select('*').order('days_until_maintenance', { ascending: true }),
        supabase.from('clients').select('id, name, email, phone').eq('is_active', true).order('name'),
        supabase.from('maintenance_types').select('*').eq('is_active', true).order('name'),
      ]);

      if (contractsRes.error) throw contractsRes.error;
      setContracts(contractsRes.data || []);
      setClients(clientsRes.data || []);
      setMaintenanceTypes(typesRes.data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  // Calcular próxima data baseado na frequência (Timezone Safe - Noon Fix)
  function calculateNextDate(baseDate: string, frequency: string): string {
    if (!baseDate) return '';
    // Append T12:00:00 to ensure we are calculating from Noon (safe from DST/Timezone shifts)
    const date = new Date(`${baseDate}T12:00:00`);

    switch (frequency) {
      case 'mensal': date.setMonth(date.getMonth() + 1); break;
      case 'bimestral': date.setMonth(date.getMonth() + 2); break;
      case 'trimestral': date.setMonth(date.getMonth() + 3); break;
      case 'semestral': date.setMonth(date.getMonth() + 6); break;
      case 'anual': date.setFullYear(date.getFullYear() + 1); break;
    }
    return date.toISOString().split('T')[0];
  }

  // Quando muda a frequência, recalcula a próxima data
  function handleFrequencyChange(newFrequency: string) {
    const baseDate = formData.last_maintenance_date || new Date().toISOString().split('T')[0];
    const nextDate = calculateNextDate(baseDate, newFrequency);
    setFormData(prev => ({ ...prev, frequency: newFrequency, next_maintenance_date: nextDate }));
  }

  // Quando muda a última manutenção, recalcula a próxima
  function handleLastDateChange(newDate: string) {
    const nextDate = calculateNextDate(newDate, formData.frequency);
    setFormData(prev => ({ ...prev, last_maintenance_date: newDate, next_maintenance_date: nextDate }));
  }

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.title.toLowerCase().includes(search.toLowerCase()) ||
      contract.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.urgency_status === statusFilter;

    // Data Filter (Proxima Manutenção)
    let matchesDate = true;
    if (contract.next_maintenance_date) {
      const date = new Date(contract.next_maintenance_date + 'T00:00:00');
      const matchesMonth = selectedMonth === 'all' || date.getMonth().toString() === selectedMonth;
      const matchesYear = selectedYear === 'all' || date.getFullYear().toString() === selectedYear;
      matchesDate = matchesMonth && matchesYear;
    } else if (selectedMonth !== 'all' || selectedYear !== 'all') {
      matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });


  // Estatísticas
  const vencidos = contracts.filter(c => c.urgency_status === 'vencido').length;
  const urgentes = contracts.filter(c => c.urgency_status === 'urgente').length;
  const proximos = contracts.filter(c => c.urgency_status === 'proximo').length;
  const futuros = contracts.filter(c => c.urgency_status === 'futuro').length;

  function openModal(contract?: Contract) {
    if (contract) {
      setEditingContract(contract);
      // Garantir que alert_days_before seja um array de números
      let alertDays = [30, 15, 7];
      if (contract.alert_days_before) {
        if (Array.isArray(contract.alert_days_before)) {
          alertDays = contract.alert_days_before.map(Number).filter(n => !isNaN(n));
        } else if (typeof contract.alert_days_before === 'string') {
          try {
            const parsed = JSON.parse(contract.alert_days_before);
            alertDays = Array.isArray(parsed) ? parsed.map(Number).filter(n => !isNaN(n)) : [30, 15, 7];
          } catch { alertDays = [30, 15, 7]; }
        }
      }
      setFormData({
        client_id: contract.client_id,
        maintenance_type_id: '',
        title: contract.title,
        description: contract.description || '',
        frequency: contract.frequency,
        next_maintenance_date: contract.next_maintenance_date,
        last_maintenance_date: contract.last_maintenance_date || '',
        maintenance_value: contract.maintenance_value || 0,
        send_email_alert: contract.send_email_alert ?? true,
        send_whatsapp_alert: contract.send_whatsapp_alert ?? true,
        alert_days_before: alertDays,
        status: contract.status,
        planned_next_date: contract.planned_next_date ? String(contract.planned_next_date).substring(0, 10) : '', // CORREÇÃO: Robust extract first 10 chars
      });
    } else {
      setEditingContract(null);
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        client_id: '',
        maintenance_type_id: '',
        title: '',
        description: '',
        frequency: 'anual',
        next_maintenance_date: calculateNextDate(today, 'anual'),
        last_maintenance_date: '',
        maintenance_value: 0,
        send_email_alert: true,
        send_whatsapp_alert: true,
        alert_days_before: [30, 15, 7],
        status: 'ativo',
        planned_next_date: '', // NOVO
      });
    }
    setShowModal(true);
  }

  function openDetails(contract: Contract) {
    setSelectedContract(contract);
    setShowDetailsModal(true);
  }

  async function handleSave() {
    if (!formData.client_id || !formData.title || !formData.next_maintenance_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const contractData = {
        client_id: formData.client_id,
        title: formData.title,
        description: formData.description || null,
        frequency: formData.frequency,
        next_maintenance_date: formData.next_maintenance_date,
        last_maintenance_date: formData.last_maintenance_date ? `${formData.last_maintenance_date}T12:00:00` : null,
        maintenance_value: formData.maintenance_value || null,
        send_email_alert: formData.send_email_alert,
        send_whatsapp_alert: formData.send_whatsapp_alert,
        status: formData.status,
        planned_next_date: formData.planned_next_date ? `${formData.planned_next_date}T12:00:00` : null, // Salva override
      };

      // Ensure next_maintenance_date is set to noon to avoid timezone issues
      if (formData.next_maintenance_date) {
        contractData.next_maintenance_date = `${formData.next_maintenance_date}T12:00:00`;
      }

      if (editingContract) {
        const { error } = await supabase
          .from('maintenance_contracts')
          .update({ ...contractData, updated_at: new Date().toISOString() })
          .eq('id', editingContract.id);
        if (error) throw error;
        toast.success('Manutenção atualizada!');
      } else {
        // [FIX] Apply Noon Fix to start_date as well to avoid shift
        const startDate = new Date().toISOString().split('T')[0] + 'T12:00:00';

        const { error } = await supabase
          .from('maintenance_contracts')
          .insert([{
            ...contractData,
            created_by: profile?.id,
            start_date: startDate
          }]);
        if (error) throw error;
        toast.success('Manutenção criada!');
      }
      setShowModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contract: Contract) {
    if (!confirm(`Excluir manutenção "${contract.title}"?`)) return;

    try {
      const { error } = await supabase.from('maintenance_contracts').delete().eq('id', contract.id);
      if (error) throw error;
      toast.success('Manutenção excluída!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  // Verificar se pode concluir (só na data agendada ou depois)
  function canComplete(contract: Contract): boolean {
    const today = new Date().toISOString().split('T')[0];
    const scheduledDate = contract.next_maintenance_date;
    return today >= scheduledDate;
  }

  function getNextAfterCurrent(contract: Contract): string {
    return calculateNextDate(contract.next_maintenance_date, contract.frequency);
  }

  // Abrir Modal de Conclusão (Substitui o confirm direto)
  function handleMarkCompleted(contract: Contract) {
    const today = new Date().toISOString().split('T')[0];
    // Se existir planned_next_date, usa ela. Senão calcula.
    const nextDate = contract.planned_next_date || calculateNextDate(today, contract.frequency);

    // Verificar se pode concluir
    if (today < contract.next_maintenance_date) {
      toast.error(`⚠️ Só é possível concluir esta manutenção a partir de ${new Date(contract.next_maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')}`);
      return;
    }

    setCompletionData({
      contractId: contract.id,
      contractTitle: contract.title,
      completedDate: today,
      nextDate: nextDate,
      frequency: contract.frequency
    });
    setShowCompletionModal(true);
  }

  // Efetivar Conclusão
  async function confirmCompletion() {
    if (!completionData.contractId) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('maintenance_contracts')
        .update({
          last_maintenance_date: completionData.completedDate, // Salva data normal, backend/frontend tratam display
          next_maintenance_date: `${completionData.nextDate}T12:00:00`, // Noon Fix para garantir data correta
          updated_at: new Date().toISOString(),
        })
        .eq('id', completionData.contractId);

      if (error) throw error;

      // Registrar no histórico
      // Buscar dados atuais para histórico preciso se necessário, mas usaremos os do contrato + novos
      await supabase.from('maintenance_history').insert({
        contract_id: completionData.contractId,
        scheduled_date: new Date().toISOString(), // Ou data anterior se tivermos, mas isso é novo log
        completed_date: completionData.completedDate,
        status: 'concluido',
        notes: `Próxima definida para: ${new Date(completionData.nextDate + 'T12:00:00').toLocaleDateString('pt-BR')}`
      });

      // Notificar cliente
      // (Simplificado, ideal seria buscar client_id, mas vamos assumir que o fluxo fluiu)
      // Recuperar contrato completo para notificações se necessário, mas por hora apenas toast e update

      toast.success(`Manutenção concluída! Próxima: ${new Date(completionData.nextDate + 'T12:00:00').toLocaleDateString('pt-BR')}`);
      setShowCompletionModal(false);
      setShowDetailsModal(false); // Fecha modal de detalhes se aberto
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendReminder(contract: Contract, type: 'email' | 'whatsapp') {
    const nextDate = new Date(contract.next_maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR');
    const message = `Olá ${contract.client_name}!\n\nSua manutenção preventiva de ${contract.maintenance_type_name || contract.title} está programada para ${nextDate}.\n\nPor favor, entre em contato conosco para confirmar o agendamento.\n\nAtenciosamente,\nEquipe de Manutenção`;

    if (type === 'whatsapp') {
      if (!contract.client_phone) {
        toast.error('Cliente não possui telefone cadastrado');
        return;
      }
      const phone = contract.client_phone.replace(/\D/g, '');
      const num = phone.length <= 11 ? '55' + phone : phone;
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      if (!contract.client_email) {
        toast.error('Cliente não possui email cadastrado');
        return;
      }
      const subject = encodeURIComponent('Lembrete: Manutenção Preventiva Programada');
      window.open(`mailto:${contract.client_email}?subject=${subject}&body=${encodeURIComponent(message)}`, '_blank');
    }

    // Registrar alerta
    await supabase.from('maintenance_alerts').insert({
      contract_id: contract.id,
      alert_type: type,
      recipient: type === 'email' ? contract.client_email : contract.client_phone,
      message,
      scheduled_for: new Date().toISOString(),
      status: 'enviado',
      sent_at: new Date().toISOString(),
    });

    toast.success(`${type === 'email' ? 'Email' : 'WhatsApp'} aberto!`);
  }

  const getUrgencyColor = (status: string) => {
    switch (status) {
      case 'vencido': return 'bg-red-500';
      case 'urgente': return 'bg-amber-500';
      case 'proximo': return 'bg-blue-500';
      default: return 'bg-emerald-500';
    }
  };

  const getUrgencyLabel = (status: string, days: number) => {
    if (status === 'vencido') return `Vencido (${Math.abs(days)} dias)`;
    if (status === 'urgente') return `Urgente (${days} dias)`;
    if (status === 'proximo') return `${days} dias`;
    return `${days} dias`;
  };

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = { mensal: 'Mensal', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
    return labels[freq] || freq;
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
          <h1 className="text-2xl font-bold text-gray-800">Manutenções Periódicas</h1>
          <p className="text-gray-500">{contracts.length} manutenções programadas</p>
        </div>
        {can('can_create_orders') && (
          <button onClick={() => openModal()} className="btn btn-primary">
            <Plus size={20} />
            Nova Manutenção
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`card cursor-pointer ${statusFilter === 'vencido' ? 'ring-2 ring-red-500' : ''}`} onClick={() => setStatusFilter(statusFilter === 'vencido' ? 'all' : 'vencido')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{vencidos}</p>
              <p className="text-sm text-gray-500">Vencidas</p>
            </div>
          </div>
        </div>
        <div className={`card cursor-pointer ${statusFilter === 'urgente' ? 'ring-2 ring-amber-500' : ''}`} onClick={() => setStatusFilter(statusFilter === 'urgente' ? 'all' : 'urgente')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{urgentes}</p>
              <p className="text-sm text-gray-500">Urgentes (7 dias)</p>
            </div>
          </div>
        </div>
        <div className={`card cursor-pointer ${statusFilter === 'proximo' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setStatusFilter(statusFilter === 'proximo' ? 'all' : 'proximo')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{proximos}</p>
              <p className="text-sm text-gray-500">Próximas (30 dias)</p>
            </div>
          </div>
        </div>
        <div className={`card cursor-pointer ${statusFilter === 'futuro' ? 'ring-2 ring-emerald-500' : ''}`} onClick={() => setStatusFilter(statusFilter === 'futuro' ? 'all' : 'futuro')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{futuros}</p>
              <p className="text-sm text-gray-500">Futuras</p>
            </div>
          </div>
        </div>
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
            <option value="all">Todas as Urgências</option>
            <option value="vencido">⚠️ Vencidas</option>
            <option value="urgente">🔔 Urgentes (7 dias)</option>
            <option value="proximo">📅 Próximas (30 dias)</option>
            <option value="futuro">✅ Futuras</option>
          </select>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="btn btn-secondary px-3"
              title="Limpar Filtros"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContracts.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Nenhuma manutenção encontrada</p>
          </div>
        ) : (
          filteredContracts.map((contract) => (
            <div
              key={contract.id}
              className={`card border-l-4 cursor-pointer hover:shadow-lg transition-shadow ${contract.urgency_status === 'vencido' ? 'border-l-red-500 bg-red-50' :
                contract.urgency_status === 'urgente' ? 'border-l-amber-500 bg-amber-50' :
                  contract.urgency_status === 'proximo' ? 'border-l-blue-500' : 'border-l-emerald-500'
                }`}
              onClick={() => openDetails(contract)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: contract.maintenance_color || '#6366f1' }}
                  >
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 line-clamp-1">{contract.title}</h3>
                    <p className="text-sm text-gray-500">{contract.maintenance_type_name || 'Manutenção'}</p>
                  </div>
                </div>
                <span className={`badge text-white text-xs ${getUrgencyColor(contract.urgency_status || 'futuro')}`}>
                  {getUrgencyLabel(contract.urgency_status || 'futuro', contract.days_until_maintenance || 0)}
                </span>
              </div>

              {/* Cliente */}
              <p className="text-sm font-medium text-gray-700 mb-3">{contract.client_name}</p>

              {/* Datas - Última, Atual e Próxima */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Última</p>
                  <p className="text-xs font-semibold text-gray-700">
                    {contract.last_maintenance_date
                      ? new Date(contract.last_maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '--'}
                  </p>
                </div>
                <div className={`rounded-lg p-2 text-center border-2 ${contract.urgency_status === 'vencido' ? 'bg-red-100 border-red-400' :
                  contract.urgency_status === 'urgente' ? 'bg-amber-100 border-amber-400' : 'bg-indigo-100 border-indigo-400'
                  }`}>
                  <p className="text-xs text-gray-600 font-medium">📅 Agendada</p>
                  <p className={`text-xs font-bold ${contract.urgency_status === 'vencido' ? 'text-red-600' :
                    contract.urgency_status === 'urgente' ? 'text-amber-600' : 'text-indigo-600'
                    }`}>
                    {new Date(contract.next_maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className={`rounded-lg p-2 text-center ${contract.planned_next_date ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50'}`}>
                  <p className={`text-xs ${contract.planned_next_date ? 'text-amber-600' : 'text-gray-500'}`}>
                    {contract.planned_next_date ? 'Planejada' : 'Próxima'}
                  </p>
                  <p className={`text-xs font-semibold ${contract.planned_next_date ? 'text-amber-700' : 'text-emerald-600'}`}>
                    {(() => {
                      if (contract.planned_next_date) {
                        const clean = String(contract.planned_next_date).substring(0, 10);
                        const date = new Date(clean + 'T12:00:00');
                        return isNaN(date.getTime()) ? '--/--/----' : date.toLocaleDateString('pt-BR');
                      }
                      return new Date(getNextAfterCurrent(contract) + 'T12:00:00').toLocaleDateString('pt-BR');
                    })()}
                  </p>
                </div>
              </div>

              {/* Frequência */}
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <Clock className="w-4 h-4" />
                <span>Frequência: {getFrequencyLabel(contract.frequency)}</span>
              </div>

              {/* Alerta se vencido ou urgente */}
              {(contract.urgency_status === 'vencido' || contract.urgency_status === 'urgente') && (
                <div className={`flex items-center gap-2 p-2 rounded-lg mb-3 ${contract.urgency_status === 'vencido' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                  <Bell className="w-4 h-4" />
                  <span className="text-xs font-medium">
                    {contract.urgency_status === 'vencido'
                      ? '⚠️ Manutenção vencida! Entre em contato.'
                      : '🔔 Manutenção próxima! Envie um lembrete.'}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => sendReminder(contract, 'whatsapp')}
                  className="flex-1 btn btn-sm bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={!contract.client_phone}
                >
                  <MessageCircle size={14} />
                  WhatsApp
                </button>
                <button
                  onClick={() => sendReminder(contract, 'email')}
                  className="flex-1 btn btn-sm bg-blue-500 hover:bg-blue-600 text-white"
                  disabled={!contract.client_email}
                >
                  <Mail size={14} />
                  Email
                </button>
                <button
                  onClick={() => openModal(contract)}
                  className="btn btn-sm btn-secondary"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDelete(contract)}
                  className="btn btn-sm bg-red-500 hover:bg-red-600 text-white"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Criar/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editingContract ? 'Editar Manutenção' : 'Nova Manutenção Periódica'}
              </h2>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
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
                  placeholder="Ex: Manutenção Cabine Primária"
                />
              </div>
              <div>
                <label className="label">Frequência *</label>
                <div className="grid grid-cols-5 gap-2">
                  {['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'].map(freq => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => handleFrequencyChange(freq)}
                      className={`btn btn-sm ${formData.frequency === freq ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {/* VISUALIZAÇÃO DAS 3 DATAS */}
              <div className="bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl p-4 border border-indigo-100">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Linha do Tempo das Manutenções
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {/* Última */}
                  <div className="bg-white rounded-lg p-3 text-center border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">📋 Última</p>
                    <p className="text-sm font-bold text-gray-700">
                      {formData.last_maintenance_date
                        ? new Date(formData.last_maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '--/--/----'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Realizada</p>
                  </div>
                  {/* Agendada (Atual) */}
                  <div className="bg-indigo-100 rounded-lg p-3 text-center border-2 border-indigo-400 shadow-sm relative">
                    <p className="text-xs text-indigo-600 font-medium mb-1">📅 Agendada</p>
                    <p className="text-sm font-bold text-indigo-700">
                      {formData.next_maintenance_date
                        ? new Date(formData.next_maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '--/--/----'}
                    </p>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                      Editável abaixo
                    </div>
                  </div>
                  {/* Próxima (Editável) */}
                  <div
                    onClick={() => {
                      try {
                        nextDateInputRef.current?.showPicker();
                      } catch (err) {
                        // Fallback para navegadores que não suportam showPicker
                        nextDateInputRef.current?.focus();
                      }
                    }}
                    className={`rounded-lg p-3 text-center border shadow-sm relative group cursor-pointer ${formData.planned_next_date ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-200'}`}
                  >
                    {/* Input Oculto mas "Visível" para o DOM para permitir showPicker */}
                    <input
                      ref={nextDateInputRef}
                      type="date"
                      value={formData.planned_next_date || calculateNextDate(formData.next_maintenance_date, formData.frequency)}
                      onChange={(e) => setFormData({ ...formData, planned_next_date: e.target.value })}
                      className="absolute opacity-0 w-0 h-0 pointer-events-none"
                      style={{ visibility: 'visible' }} // Garante que showPicker funcione
                    />

                    <p className={`text-xs mb-1 font-medium ${formData.planned_next_date ? 'text-amber-700' : 'text-emerald-600'} relative z-10 flex items-center justify-center gap-1`}>
                      {formData.planned_next_date ? '🔮 Ciclo Personalizado' : '🔮 Ciclo Seguinte'} <Edit size={12} className="opacity-70" />
                    </p>
                    <div className="relative z-10">
                      <p className={`text-sm font-bold ${formData.planned_next_date ? 'text-amber-800' : 'text-emerald-700'} group-hover:scale-105 transition-transform`}>
                        {(() => {
                          // Helper Local para garantir data válida
                          const formatDateSafe = (dateStr: string) => {
                            if (!dateStr || dateStr.length < 10) return null;
                            const clean = dateStr.substring(0, 10); // YYYY-MM-DD
                            const date = new Date(`${clean}T12:00:00`);
                            if (isNaN(date.getTime())) return null;
                            return date.toLocaleDateString('pt-BR');
                          };

                          if (formData.planned_next_date) {
                            const formatted = formatDateSafe(formData.planned_next_date);
                            if (formatted) return formatted;
                          }

                          // Fallback para calculada
                          if (formData.next_maintenance_date) {
                            const next = calculateNextDate(formData.next_maintenance_date, formData.frequency);
                            const formatted = formatDateSafe(next);
                            return formatted || '--/--/----';
                          }

                          return '--/--/----';
                        })()}
                      </p>
                    </div>
                    <p className={`text-xs mt-1 ${formData.planned_next_date ? 'text-amber-600' : 'text-emerald-500'} relative z-10`}>
                      {formData.planned_next_date ? 'Data Manual' : 'Previsão Automática'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  ↑ Linha do tempo interativa. Clique no Ciclo Seguinte para definir uma data manual.
                </p>
              </div>

              {/* CAMPOS DE EDIÇÃO DAS DATAS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">📋 Última Manutenção (Data de Início)</label>
                  <input
                    type="date"
                    value={formData.last_maintenance_date}
                    onChange={(e) => handleLastDateChange(e.target.value)}
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Quando foi a última manutenção realizada</p>
                </div>
                <div>
                  <label className="label text-indigo-700 font-bold">📅 Manutenção Agendada (Editável) *</label>
                  <input
                    type="date"
                    value={formData.next_maintenance_date}
                    onChange={(e) => setFormData({ ...formData, next_maintenance_date: e.target.value })}
                    className="input border-2 border-indigo-100 focus:border-indigo-500 bg-indigo-50/30"
                  />
                  <p className="text-xs text-gray-500 mt-1">Defina manualmente a data desta manutenção</p>
                </div>
              </div>
              <div>
                <label className="label">Valor (R$)</label>
                <input
                  type="number"
                  value={formData.maintenance_value}
                  onChange={(e) => setFormData({ ...formData, maintenance_value: Number(e.target.value) })}
                  className="input"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Detalhes da manutenção..."
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-amber-800">Alertas Automáticos</span>
                </div>
                <p className="text-sm text-amber-700 mb-3">Alertas serão enviados 30, 15 e 7 dias antes</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.send_email_alert}
                      onChange={(e) => setFormData({ ...formData, send_email_alert: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <Mail size={16} className="text-gray-500" />
                    <span className="text-sm">Enviar alertas por Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.send_whatsapp_alert}
                      onChange={(e) => setFormData({ ...formData, send_whatsapp_alert: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <MessageCircle size={16} className="text-gray-500" />
                    <span className="text-sm">Enviar alertas por WhatsApp</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                {editingContract ? 'Salvar' : 'Criar Manutenção'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {showDetailsModal && selectedContract && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: selectedContract.maintenance_color || '#6366f1' }}
                  >
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedContract.title}</h2>
                    <p className="text-gray-500">{selectedContract.maintenance_type_name}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`badge text-white ${getUrgencyColor(selectedContract.urgency_status || 'futuro')}`}>
                  {getUrgencyLabel(selectedContract.urgency_status || 'futuro', selectedContract.days_until_maintenance || 0)}
                </span>
              </div>

              {/* Cliente */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Cliente</p>
                <p className="font-semibold text-gray-800">{selectedContract.client_name}</p>
                {selectedContract.client_email && <p className="text-sm text-gray-500">{selectedContract.client_email}</p>}
                {selectedContract.client_phone && <p className="text-sm text-gray-500">{selectedContract.client_phone}</p>}
              </div>

              {/* Datas - Última, Atual, Próxima */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Última Realizada</p>
                  <p className="text-sm font-bold text-gray-700">
                    {selectedContract.last_maintenance_date
                      ? new Date(selectedContract.last_maintenance_date).toLocaleDateString('pt-BR')
                      : '--'}
                  </p>
                </div>
                <div className={`rounded-lg p-3 text-center border-2 ${selectedContract.urgency_status === 'vencido' ? 'bg-red-100 border-red-400' :
                  selectedContract.urgency_status === 'urgente' ? 'bg-amber-100 border-amber-400' : 'bg-indigo-100 border-indigo-400'
                  }`}>
                  <p className="text-xs text-gray-600 font-medium mb-1">📅 Agendada</p>
                  <p className={`text-sm font-bold ${selectedContract.urgency_status === 'vencido' ? 'text-red-600' :
                    selectedContract.urgency_status === 'urgente' ? 'text-amber-600' : 'text-indigo-600'
                    }`}>
                    {new Date(selectedContract.next_maintenance_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Próxima</p>
                  <p className="text-sm font-bold text-emerald-600">
                    {new Date(getNextAfterCurrent(selectedContract)).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Aviso se não pode concluir ainda */}
              {!canComplete(selectedContract) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    ℹ️ Esta manutenção só pode ser concluída a partir de <strong>{new Date(selectedContract.next_maintenance_date).toLocaleDateString('pt-BR')}</strong>
                  </p>
                </div>
              )}

              {/* Frequência */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Frequência</span>
                <span className="font-semibold">{getFrequencyLabel(selectedContract.frequency)}</span>
              </div>

              {/* Valor */}
              {selectedContract.maintenance_value && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Valor</span>
                  <span className="font-semibold">
                    R$ {selectedContract.maintenance_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Alertas */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-amber-800">Alertas Configurados</span>
                </div>
                <p className="text-sm text-amber-700">30, 15 e 7 dias antes</p>
                <div className="flex gap-2 mt-2">
                  {selectedContract.send_email_alert && (
                    <span className="badge bg-blue-100 text-blue-700">Email ✓</span>
                  )}
                  {selectedContract.send_whatsapp_alert && (
                    <span className="badge bg-emerald-100 text-emerald-700">WhatsApp ✓</span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 space-y-3">
              {/* Ações Rápidas */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => sendReminder(selectedContract, 'whatsapp')}
                  className="btn bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={!selectedContract.client_phone}
                >
                  <MessageCircle size={16} />
                  WhatsApp
                </button>
                <button
                  onClick={() => sendReminder(selectedContract, 'email')}
                  className="btn bg-blue-500 hover:bg-blue-600 text-white"
                  disabled={!selectedContract.client_email}
                >
                  <Mail size={16} />
                  Email
                </button>
                <button
                  onClick={() => handleMarkCompleted(selectedContract)}
                  className={`btn text-white ${canComplete(selectedContract) ? 'bg-purple-500 hover:bg-purple-600' : 'bg-gray-400 cursor-not-allowed'}`}
                  disabled={!canComplete(selectedContract)}
                  title={!canComplete(selectedContract) ? `Só pode concluir a partir de ${new Date(selectedContract.next_maintenance_date).toLocaleDateString('pt-BR')}` : ''}
                >
                  <CheckCircle size={16} />
                  {canComplete(selectedContract) ? 'Concluir' : 'Aguardando'}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowDetailsModal(false); openModal(selectedContract); }} className="btn btn-secondary flex-1">
                  <Edit size={16} />
                  Editar
                </button>
                <button onClick={() => { setShowDetailsModal(false); handleDelete(selectedContract); }} className="btn bg-red-500 hover:bg-red-600 text-white">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Confirmar Conclusão */}
      {showCompletionModal && (
        <div className="modal-overlay" onClick={() => setShowCompletionModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b bg-emerald-50">
              <h2 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-6 h-6" />
                Concluir Manutenção
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-600 font-medium">{completionData.contractTitle}</p>

              <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                <div>
                  <label className="label text-xs uppercase text-gray-400">Data de Conclusão</label>
                  <input
                    type="date"
                    value={completionData.completedDate}
                    onChange={(e) => setCompletionData({ ...completionData, completedDate: e.target.value })}
                    className="input bg-white"
                  />
                </div>

                <div className="relative">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-[2px] bg-gray-300"></div>
                  <div className="absolute left-[-19px] top-6 bottom-[-20px] w-[2px] bg-gray-300 rounded-bl-lg"></div>

                  <label className="label text-xs uppercase text-indigo-500 font-bold">Próxima Manutenção (Editável)</label>
                  <input
                    type="date"
                    value={completionData.nextDate}
                    onChange={(e) => setCompletionData({ ...completionData, nextDate: e.target.value })}
                    className="input bg-white border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Calculada automaticamente ({completionData.frequency}), mas pode ser alterada.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button onClick={() => setShowCompletionModal(false)} className="btn btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={confirmCompletion}
                disabled={saving}
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <CheckCircle size={18} />
                    Confirmar Conclusão
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
