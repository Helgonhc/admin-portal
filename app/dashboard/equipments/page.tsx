'use client';

import { useState, useEffect } from 'react';
import { supabase, Equipment } from '../../../lib/supabase';
import { Plus, Search, Edit, Trash2, Eye, Loader2, Wrench, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

export default function EquipmentsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    model: '',
    serial_number: '',
    brand: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [equipmentsRes, clientsRes] = await Promise.all([
        supabase
          .from('equipments')
          .select('*, clients(name)')
          .order('name'),
        supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (equipmentsRes.error) throw equipmentsRes.error;
      setEquipments(equipmentsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  const filteredEquipments = equipments.filter(eq =>
    eq.name.toLowerCase().includes(search.toLowerCase()) ||
    eq.model?.toLowerCase().includes(search.toLowerCase()) ||
    eq.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
    eq.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  function openModal(equipment?: Equipment) {
    if (equipment) {
      setEditingEquipment(equipment);
      setFormData({
        client_id: equipment.client_id,
        name: equipment.name,
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        brand: equipment.brand || '',
        location: equipment.location || '',
      });
    } else {
      setEditingEquipment(null);
      setFormData({ client_id: '', name: '', model: '', serial_number: '', brand: '', location: '' });
    }
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.client_id || !formData.name) {
      toast.error('Cliente e nome são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      if (editingEquipment) {
        const { error } = await supabase
          .from('equipments')
          .update(formData)
          .eq('id', editingEquipment.id);
        if (error) throw error;
        toast.success('Equipamento atualizado!');
        setShowModal(false);
        loadData();
      } else {
        const { data, error } = await supabase
          .from('equipments')
          .insert([{ ...formData, status: 'active' }])
          .select()
          .single();
        if (error) throw error;
        toast.success('Equipamento criado! Redirecionando para o QR Code...');
        setShowModal(false);
        router.push(`/dashboard/equipments/${data.id}/qrcode`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(equipment: Equipment) {
    if (!confirm(`Excluir equipamento "${equipment.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('equipments')
        .delete()
        .eq('id', equipment.id);
      if (error) throw error;
      toast.success('Equipamento excluído!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'badge-success';
      case 'maintenance': return 'badge-warning';
      case 'inactive': return 'badge-danger';
      default: return 'badge-gray';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Ativo',
      maintenance: 'Em Manutenção',
      inactive: 'Inativo',
    };
    return labels[status] || status;
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
          <h1 className="text-2xl font-bold text-gray-800">Equipamentos</h1>
          <p className="text-gray-500">{equipments.length} equipamentos cadastrados</p>
        </div>
        {can('can_create_equipments') && (
          <button onClick={() => openModal()} className="btn btn-primary">
            <Plus size={20} />
            Novo Equipamento
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        <input
          type="text"
          placeholder="Buscar por nome, modelo, série ou cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input input-with-icon"
        />
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEquipments.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Wrench className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Nenhum equipamento encontrado</p>
          </div>
        ) : (
          filteredEquipments.map((equipment) => (
            <div key={equipment.id} className="card card-hover">
              <div className="flex items-start justify-between mb-3">
                <span className={`badge ${getStatusColor(equipment.status)}`}>
                  {getStatusLabel(equipment.status)}
                </span>
                <div className="flex gap-1">
                  <Link
                    href={`/dashboard/equipments/${equipment.id}/qrcode`}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                    title="QR Code"
                  >
                    <QrCode size={16} />
                  </Link>
                  {can('can_edit_equipments') && (
                    <button
                      onClick={() => openModal(equipment)}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                    >
                      <Edit size={16} />
                    </button>
                  )}
                  {can('can_delete_clients') && (
                    <button
                      onClick={() => handleDelete(equipment)}
                      className="p-1.5 hover:bg-red-50 rounded text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{equipment.name}</h3>
              <p className="text-sm text-gray-500 mb-2">{equipment.clients?.name}</p>
              <div className="text-xs text-gray-400 space-y-1">
                {equipment.brand && <p>Marca: {equipment.brand}</p>}
                {equipment.model && <p>Modelo: {equipment.model}</p>}
                {equipment.serial_number && <p>Série: {equipment.serial_number}</p>}
                {equipment.location && <p>📍 {equipment.location}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editingEquipment ? 'Editar Equipamento' : 'Novo Equipamento'}
              </h2>
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
                <label className="label">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Nome do equipamento"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Marca</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="input"
                    placeholder="Marca"
                  />
                </div>
                <div>
                  <label className="label">Modelo</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="input"
                    placeholder="Modelo"
                  />
                </div>
              </div>
              <div>
                <label className="label">Número de Série</label>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  className="input"
                  placeholder="Número de série"
                />
              </div>
              <div>
                <label className="label">Localização</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input"
                  placeholder="Onde está instalado"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                {editingEquipment ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
