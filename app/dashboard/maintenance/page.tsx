'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Eye, Edit, Trash2, Loader2, FileText, Calendar, AlertTriangle, Check } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Contract {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  contract_type: string;
  start_date: string;
  end_date?: string;
  value?: number;
  payment_frequency?: string;
  status: string;
  created_at: string;
  clients?: { name: string };
}

export default function MaintenancePage() {
  const { profile } = useAuthStore();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    description: '',
    contract_type: 'preventiva',
    start_date: '',
    end_date: '',
    value: 0,
    payment_frequency: 'mensal',
    status: 'ativo',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [contractsRes, clientsRes] = await Promise.all([
        supabase
          .from('maintenance_contracts')
          .select('*, clients(name)')
          .order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (contractsRes.error) throw contractsRes.error;
      setContracts(contractsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.title.toLowerCase().includes(search.toLowerCase()) ||
      contract.clients?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Estatísticas
  const activeContracts = contracts.filter(c => c.status === 'ativo').length;
  const expiringContracts = contracts.filter(c => {
    if (!c.end_date || c.status !== 'ativo') return false;
    const endDate = new Date(c.end_date);
    const today = new Date();
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  }).length;
  const totalValue = contracts
    .filter(c => c.status === 'ativo')
    .reduce((sum, c) => sum + (c.value || 0), 0);

  function openModal(contract?: Contract) {
    if (contract) {
      setEditingContract(contract);
      setFormData({
        client_id: contract.client_id,
        title: contract.title,
        description: contract.description || '',
        contract_type: contract.contract_type,
        start_date: contract.start_date,
        end_date: contract.end_date || '',
        value: contract.value || 0,
        payment_frequency: contract.payment_frequency || 'mensal',
        status: contract.status,
      });
    } else {
      setEditingContract(null);
      setFormData({
        client_id: '',
        title: '',
        description: '',
        contract_type: 'preventiva',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        value: 0,
        payment_frequency: 'mensal',
        status: 'ativo',
      });
    }
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.client_id || !formData.title || !formData.start_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      if (editingContract) {
        const { error } = await supabase
          .from('maintenance_contracts')
          .update(formData)
          .eq('id', editingContract.id);
        if (error) throw error;
        toast.success('Contrato atualizado!');
      } else {
        const { error } = await supabase
          .from('maintenance_contracts')
          .insert([{ ...formData, created_by: profile?.id }]);
        if (error) throw error;
        toast.success('Contrato criado!');
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
    if (!confirm(`Excluir contrato "${contract.title}"?`)) return;

    try {
      const { error } = await supabase
        .from('maintenance_contracts')
        .delete()
        .eq('id', contract.id);
      if (error) throw error;
      toast.success('Contrato excluído!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'badge-success';
      case 'suspenso': return 'badge-warning';
      case 'cancelado': return 'badge-danger';
      case 'encerrado': return 'badge-gray';
      default: return 'badge-gray';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      preventiva: '🔧 Preventiva',
      corretiva: '🛠️ Corretiva',
      full: '⭐ Full Service',
      preditiva: '📊 Preditiva',
    };
    return labels[type] || type;
  };

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      mensal: 'Mensal',
      trimestral: 'Trimestral',
      semestral: 'Semestral',
      anual: 'Anual',
      avulso: 'Avulso',
    };
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
          <h1 className="text-2xl font-bold text-gray-800">Contratos de Manutenção</h1>
          <p className="text-gray-500">{contracts.length} contratos</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <Plus size={20} />
          Novo Contrato
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Contratos Ativos</p>
          <p className="text-2xl font-bold text-emerald-600">{activeContracts}</p>
        </div>
        <div className={`card ${expiringContracts > 0 ? 'bg-amber-50 border-amber-200' : ''}`}>
          <p className="text-sm text-gray-500">Vencendo em 30 dias</p>
          <p className={`text-2xl font-bold ${expiringContracts > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
            {expiringContracts}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Valor Mensal Total</p>
          <p className="text-2xl font-bold text-indigo-600">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total de Contratos</p>
          <p className="text-2xl font-bold text-gray-800">{contracts.length}</p>
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-full sm:w-48"
        >
          <option value="all">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="suspenso">Suspenso</option>
          <option value="encerrado">Encerrado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Vigência</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Nenhum contrato encontrado
                  </td>
                </tr>
              ) : (
                filteredContracts.map((contract) => {
                  const isExpiring = contract.end_date && contract.status === 'ativo' && 
                    Math.ceil((new Date(contract.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 30;
                  
                  return (
                    <tr key={contract.id} className={isExpiring ? 'bg-amber-50' : ''}>
                      <td>
                        <div className="flex items-center gap-2">
                          {isExpiring && <AlertTriangle size={16} className="text-amber-500" />}
                          <div>
                            <p className="font-medium text-gray-800">{contract.title}</p>
                            {contract.description && (
                              <p className="text-xs text-gray-500 line-clamp-1">{contract.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{contract.clients?.name || '-'}</td>
                      <td>{getTypeLabel(contract.contract_type)}</td>
                      <td className="font-medium">
                        {contract.value 
                          ? `R$ ${contract.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-'}
                        {contract.payment_frequency && (
                          <span className="text-xs text-gray-500 block">
                            {getFrequencyLabel(contract.payment_frequency)}
                          </span>
                        )}
                      </td>
                      <td className="text-sm">
                        <p>{new Date(contract.start_date).toLocaleDateString('pt-BR')}</p>
                        {contract.end_date && (
                          <p className="text-gray-500">até {new Date(contract.end_date).toLocaleDateString('pt-BR')}</p>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${getStatusColor(contract.status)}`}>
                          {contract.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal(contract)}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(contract)}
                            className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editingContract ? 'Editar Contrato' : 'Novo Contrato'}
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
                <label className="label">Título do Contrato *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  placeholder="Ex: Manutenção Preventiva Mensal"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo de Contrato</label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                    className="input"
                  >
                    <option value="preventiva">🔧 Preventiva</option>
                    <option value="corretiva">🛠️ Corretiva</option>
                    <option value="full">⭐ Full Service</option>
                    <option value="preditiva">📊 Preditiva</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="suspenso">Suspenso</option>
                    <option value="encerrado">Encerrado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Data Início *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Data Fim</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Valor (R$)</label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    className="input"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Frequência Pagamento</label>
                  <select
                    value={formData.payment_frequency}
                    onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                    className="input"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                    <option value="avulso">Avulso</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Detalhes do contrato..."
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                {editingContract ? 'Salvar' : 'Criar Contrato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
