'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/authStore';
import {
  ArrowLeft, Trash2, Loader2, Calendar, Wrench, QrCode, MapPin,
  Building2, Edit, Save, FileText, AlertTriangle, CheckCircle,
  Clock, DollarSign, Upload, History, Plus
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function EquipmentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [equipment, setEquipment] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'documents'>('info');

  const [formData, setFormData] = useState({
    name: '',
    model: '',
    brand: '',
    serial_number: '',
    location: '',
    status: 'active',
    purchase_date: '',
    purchase_value: '',
    supplier: '',
    warranty_expiry_date: '',
    maintenance_frequency_months: 12,
    next_maintenance_date: '',
    notes: '',
  });

  useEffect(() => {
    loadEquipment();
  }, [params.id]);

  async function loadEquipment() {
    try {
      const [equipRes, docsRes, historyRes, ordersRes] = await Promise.all([
        supabase
          .from('equipments')
          .select('*, clients(name, phone, address)')
          .eq('id', params.id)
          .single(),
        supabase
          .from('equipment_documents')
          .select('*')
          .eq('equipment_id', params.id)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('equipment_maintenance_history')
          .select('*, profiles(full_name)')
          .eq('equipment_id', params.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('service_orders')
          .select('id, title, status, created_at, completed_at')
          .eq('equipment_id', params.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (equipRes.error) throw equipRes.error;
      setEquipment(equipRes.data);
      setDocuments(docsRes.data || []);
      setMaintenanceHistory(historyRes.data || []);
      setServiceOrders(ordersRes.data || []);

      setFormData({
        name: equipRes.data.name || '',
        model: equipRes.data.model || '',
        brand: equipRes.data.brand || '',
        serial_number: equipRes.data.serial_number || '',
        location: equipRes.data.location || '',
        status: equipRes.data.status || 'active',
        purchase_date: equipRes.data.purchase_date || '',
        purchase_value: equipRes.data.purchase_value || '',
        supplier: equipRes.data.supplier || '',
        warranty_expiry_date: equipRes.data.warranty_expiry_date || '',
        maintenance_frequency_months: equipRes.data.maintenance_frequency_months || 12,
        next_maintenance_date: equipRes.data.next_maintenance_date || '',
        notes: equipRes.data.notes || '',
      });
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
      router.push('/dashboard/equipments');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('equipments')
        .update(formData)
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Equipamento atualizado!');
      setIsEditing(false);
      loadEquipment();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('equipments')
        .update({ status: newStatus })
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Status atualizado!');
      loadEquipment();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir este equipamento?')) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('equipments')
        .delete()
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Excluído!');
      router.push('/dashboard/equipments');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function generateQRCode() {
    setProcessing(true);
    try {
      // Usar os 8 primeiros caracteres do ID para gerar um código curto e único
      const generatedCode = `EQ-${params.id.toString().substring(0, 8).toUpperCase()}`;

      const { error } = await supabase
        .from('equipments')
        .update({ qr_code: generatedCode })
        .eq('id', params.id);

      if (error) throw error;
      toast.success('Identificador QR gerado!');
      loadEquipment();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
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

  const getAlertStatus = () => {
    if (!equipment.next_maintenance_date) return null;
    const nextDate = new Date(equipment.next_maintenance_date);
    const today = new Date();
    const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { type: 'critical', message: 'Manutenção atrasada!' };
    if (diffDays <= 7) return { type: 'warning', message: `Manutenção em ${diffDays} dias` };
    if (diffDays <= 30) return { type: 'info', message: `Manutenção em ${diffDays} dias` };
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!equipment) return null;

  const alert = getAlertStatus();

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/equipments" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{equipment.name}</h1>
          <p className="text-gray-500">{equipment.clients?.name}</p>
        </div>
        <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary">
          <Edit size={18} /> {isEditing ? 'Cancelar' : 'Editar'}
        </button>
        <span className={`badge ${getStatusColor(equipment.status)}`}>
          {getStatusLabel(equipment.status)}
        </span>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${alert.type === 'critical' ? 'bg-red-50 text-red-700' :
            alert.type === 'warning' ? 'bg-amber-50 text-amber-700' :
              'bg-blue-50 text-blue-700'
          }`}>
          <AlertTriangle size={20} />
          <span className="font-medium">{alert.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'info', icon: Wrench, label: 'Informações' },
          { id: 'history', icon: History, label: 'Histórico' },
          { id: 'documents', icon: FileText, label: 'Documentos' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${activeTab === tab.id ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-800'
              }`}
          >
            <tab.icon size={18} />
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          {isEditing ? (
            <div className="card space-y-4">
              <h3 className="font-semibold text-gray-800">Editar Equipamento</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Modelo</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Marca</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Número de Série</label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Localização</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input"
                  >
                    <option value="active">Ativo</option>
                    <option value="maintenance">Em Manutenção</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>

              <h4 className="font-medium text-gray-700 pt-4">Informações de Compra</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Data de Compra</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Valor (R$)</label>
                  <input
                    type="number"
                    value={formData.purchase_value}
                    onChange={(e) => setFormData({ ...formData, purchase_value: e.target.value })}
                    className="input"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">Fornecedor</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <h4 className="font-medium text-gray-700 pt-4">Manutenção</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Garantia até</label>
                  <input
                    type="date"
                    value={formData.warranty_expiry_date}
                    onChange={(e) => setFormData({ ...formData, warranty_expiry_date: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Frequência (meses)</label>
                  <input
                    type="number"
                    value={formData.maintenance_frequency_months}
                    onChange={(e) => setFormData({ ...formData, maintenance_frequency_months: Number(e.target.value) })}
                    className="input"
                    min="1"
                  />
                </div>
                <div>
                  <label className="label">Próxima Manutenção</label>
                  <input
                    type="date"
                    value={formData.next_maintenance_date}
                    onChange={(e) => setFormData({ ...formData, next_maintenance_date: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input min-h-[80px]"
                />
              </div>

              <button onClick={handleSave} disabled={processing} className="btn btn-primary">
                {processing ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar Alterações
              </button>
            </div>
          ) : (
            <>
              {/* Info Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="card">
                  <h3 className="font-semibold text-gray-800 mb-4">🔧 Informações do Equipamento</h3>
                  <div className="space-y-3">
                    {equipment.model && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Wrench className="text-gray-400" size={20} />
                        <div>
                          <p className="text-xs text-gray-500">Modelo</p>
                          <p className="font-medium">{equipment.model}</p>
                        </div>
                      </div>
                    )}
                    {equipment.brand && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Building2 className="text-gray-400" size={20} />
                        <div>
                          <p className="text-xs text-gray-500">Marca</p>
                          <p className="font-medium">{equipment.brand}</p>
                        </div>
                      </div>
                    )}
                    {equipment.serial_number && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <QrCode className="text-gray-400" size={20} />
                        <div>
                          <p className="text-xs text-gray-500">Número de Série</p>
                          <p className="font-medium font-mono">{equipment.serial_number}</p>
                        </div>
                      </div>
                    )}
                    {equipment.location && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <MapPin className="text-gray-400" size={20} />
                        <div>
                          <p className="text-xs text-gray-500">Localização</p>
                          <p className="font-medium">{equipment.location}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <h3 className="font-semibold text-gray-800 mb-4">📅 Manutenção</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Calendar className="text-gray-400" size={20} />
                      <div>
                        <p className="text-xs text-gray-500">Última Manutenção</p>
                        <p className="font-medium">
                          {equipment.last_maintenance
                            ? new Date(equipment.last_maintenance).toLocaleDateString('pt-BR')
                            : 'Não registrada'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Calendar className="text-gray-400" size={20} />
                      <div>
                        <p className="text-xs text-gray-500">Próxima Manutenção</p>
                        <p className="font-medium">
                          {equipment.next_maintenance_date
                            ? new Date(equipment.next_maintenance_date).toLocaleDateString('pt-BR')
                            : 'Não agendada'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Clock className="text-gray-400" size={20} />
                      <div>
                        <p className="text-xs text-gray-500">Frequência</p>
                        <p className="font-medium">{equipment.maintenance_frequency_months || 12} meses</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cliente */}
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-3">🏢 Cliente</h3>
                <p className="text-lg font-medium">{equipment.clients?.name}</p>
                {equipment.clients?.phone && <p className="text-sm text-gray-500">📱 {equipment.clients.phone}</p>}
                {equipment.clients?.address && <p className="text-sm text-gray-500">📍 {equipment.clients.address}</p>}
              </div>

              {/* QR Code */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">📱 QR Code</h3>
                  {!equipment.qr_code || equipment.qr_code.startsWith('http') ? (
                    <button onClick={generateQRCode} disabled={processing} className="btn btn-secondary">
                      <QrCode size={18} /> Criar Identificador
                    </button>
                  ) : (
                    <Link href={`/dashboard/equipments/${params.id}/qrcode`} className="btn btn-primary">
                      <Printer size={18} /> Imprimir Etiqueta
                    </Link>
                  )}
                </div>
                {equipment.qr_code ? (
                  <div className="flex justify-center">
                    <img src={equipment.qr_code} alt="QR Code" className="max-w-[200px]" />
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">QR Code não gerado</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">📋 Ordens de Serviço ({serviceOrders.length})</h3>
            {serviceOrders.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Nenhuma OS registrada</p>
            ) : (
              <div className="space-y-2">
                {serviceOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{order.title}</p>
                      <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className={`badge ${getStatusColor(order.status === 'concluido' ? 'active' : order.status === 'em_andamento' ? 'maintenance' : 'inactive')}`}>
                      {order.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">🔧 Histórico de Manutenções ({maintenanceHistory.length})</h3>
            {maintenanceHistory.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Nenhuma manutenção registrada</p>
            ) : (
              <div className="space-y-3">
                {maintenanceHistory.map((item) => (
                  <div key={item.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-indigo-500">
                    <div className="flex items-center gap-2 mb-2">
                      {item.status === 'concluido' ? (
                        <CheckCircle size={16} className="text-emerald-500" />
                      ) : (
                        <Clock size={16} className="text-amber-500" />
                      )}
                      <span className="font-medium">{item.title}</span>
                    </div>
                    {item.description && <p className="text-sm text-gray-600 mb-2">{item.description}</p>}
                    <div className="flex justify-between text-sm text-gray-500">
                      {item.profiles?.full_name && <span>👤 {item.profiles.full_name}</span>}
                      {item.completed_date && <span>{new Date(item.completed_date).toLocaleDateString('pt-BR')}</span>}
                    </div>
                    {item.total_cost && (
                      <p className="text-sm font-medium text-emerald-600 mt-1">
                        Custo: R$ {parseFloat(item.total_cost).toFixed(2)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">📄 Documentos ({documents.length})</h3>
            <button className="btn btn-secondary">
              <Upload size={18} /> Adicionar
            </button>
          </div>
          {documents.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum documento anexado</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileText size={20} className="text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-xs text-gray-500">{new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status Actions */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Alterar Status</h3>
        <div className="flex flex-wrap gap-2">
          {['active', 'maintenance', 'inactive'].map((status) => (
            <button
              key={status}
              onClick={() => updateStatus(status)}
              disabled={processing || equipment.status === status}
              className={`btn ${equipment.status === status ? 'btn-primary' : 'btn-secondary'}`}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {/* Delete */}
      <div className="flex justify-end">
        <button onClick={handleDelete} disabled={processing} className="btn btn-danger">
          <Trash2 size={20} /> Excluir Equipamento
        </button>
      </div>
    </div>
  );
}
