'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/authStore';
import { 
  ArrowLeft, Trash2, Loader2, Calendar, Clock, User, MapPin, 
  FileText, Camera, PenTool, Check, Play, Pause, CheckCircle,
  Phone, MessageCircle, Navigation, Edit, Copy, List, Save, X,
  Upload, Image as ImageIcon, Download, FileDown, Pencil
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { generateServiceOrderPDF } from '../../../../utils/pdfGenerator';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'report' | 'evidence'>('info');
  
  // Relatório
  const [reportText, setReportText] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  
  // Checklist
  const [tasks, setTasks] = useState<any[]>([]);
  const [checklistModels, setChecklistModels] = useState<any[]>([]);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  // Fotos
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Assinatura
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerDoc, setSignerDoc] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    client_id: '',
    equipment_id: '',
    technician_id: '',
    priority: '',
    scheduled_at: '',
    status: '',
    execution_report: '',
    photos_url: [] as string[],
    checkin_at: '',
    completed_at: '',
    checkout_at: '',
  });
  const [clients, setClients] = useState<any[]>([]);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingEdit, setUploadingEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadOrder();
  }, [params.id]);

  async function loadOrder() {
    try {
      const { data, error } = await supabase
        .from('service_orders')
        .select('*, clients(name, phone, email, address), technician:profiles!service_orders_technician_id_fkey(full_name), equipments(name, model, serial_number)')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setOrder(data);
      setReportText(data.execution_report || '');
      if (data.signer_name) setSignerName(data.signer_name);
      if (data.signer_doc) setSignerDoc(data.signer_doc);
      
      await loadTasks();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
      router.push('/dashboard/orders');
    } finally {
      setLoading(false);
    }
  }

  async function loadTasks() {
    const { data } = await supabase
      .from('order_tasks')
      .select('*')
      .eq('order_id', params.id)
      .order('created_at');
    setTasks(data || []);
  }

  async function loadEditData() {
    // Carregar clientes
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setClients(clientsData || []);

    // Carregar técnicos
    const { data: techniciansData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'technician', 'super_admin'])
      .eq('is_active', true)
      .order('full_name');
    setTechnicians(techniciansData || []);

    // Carregar equipamentos do cliente atual
    if (order?.client_id) {
      const { data: equipmentsData } = await supabase
        .from('equipments')
        .select('id, name, model')
        .eq('client_id', order.client_id)
        .eq('status', 'active')
        .order('name');
      setEquipments(equipmentsData || []);
    }

    // Preencher dados atuais
    setEditData({
      title: order?.title || '',
      description: order?.description || '',
      client_id: order?.client_id || '',
      equipment_id: order?.equipment_id || '',
      technician_id: order?.technician_id || '',
      priority: order?.priority || 'media',
      scheduled_at: order?.scheduled_at ? order.scheduled_at.split('T')[0] : '',
      status: order?.status || 'pendente',
      execution_report: order?.execution_report || '',
      photos_url: order?.photos_url || [],
      checkin_at: order?.checkin_at ? order.checkin_at.slice(0, 16) : '',
      completed_at: order?.completed_at ? order.completed_at.slice(0, 16) : '',
      checkout_at: order?.checkout_at ? order.checkout_at.slice(0, 16) : '',
    });

    setShowEditModal(true);
  }

  async function loadEquipmentsForClient(clientId: string) {
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

  async function handleSaveEdit() {
    if (!editData.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    setSavingEdit(true);
    try {
      const updateData: any = {
        title: editData.title,
        description: editData.description,
        client_id: editData.client_id || null,
        equipment_id: editData.equipment_id || null,
        technician_id: editData.technician_id || null,
        priority: editData.priority,
        status: editData.status,
        execution_report: editData.execution_report,
        photos_url: editData.photos_url,
      };

      if (editData.scheduled_at) {
        updateData.scheduled_at = editData.scheduled_at;
      }
      
      // Datas de execução
      if (editData.checkin_at) {
        updateData.checkin_at = editData.checkin_at;
      }
      if (editData.completed_at) {
        updateData.completed_at = editData.completed_at;
      }
      if (editData.checkout_at) {
        updateData.checkout_at = editData.checkout_at;
      }

      const { error } = await supabase
        .from('service_orders')
        .update(updateData)
        .eq('id', params.id);

      if (error) throw error;

      // Atualizar também o reportText local
      setReportText(editData.execution_report);

      toast.success('OS atualizada com sucesso!');
      setShowEditModal(false);
      loadOrder();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleEditPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingEdit(true);
    try {
      const newUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const fileName = `${params.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('os-photos')
          .upload(fileName, file, { contentType: file.type });
        
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('os-photos').getPublicUrl(fileName);
        newUrls.push(data.publicUrl);
      }
      
      setEditData({ ...editData, photos_url: [...editData.photos_url, ...newUrls] });
      toast.success(`${newUrls.length} foto(s) adicionada(s)!`);
    } catch (error: any) {
      toast.error('Erro no upload: ' + error.message);
    } finally {
      setUploadingEdit(false);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
    }
  }

  function removeEditPhoto(photoUrl: string) {
    setEditData({ ...editData, photos_url: editData.photos_url.filter(u => u !== photoUrl) });
  }

  async function loadChecklistModels() {
    const { data } = await supabase.from('checklist_models').select('*');
    setChecklistModels(data || []);
    setShowChecklistModal(true);
  }

  async function importChecklist(modelId: string) {
    setShowChecklistModal(false);
    setProcessing(true);
    const { data: items } = await supabase
      .from('checklist_model_items')
      .select('item_description')
      .eq('model_id', modelId);
    
    if (items && items.length > 0) {
      const tasksToInsert = items.map(i => ({ 
        order_id: params.id, 
        title: i.item_description, 
        is_completed: false 
      }));
      await supabase.from('order_tasks').insert(tasksToInsert);
      await loadTasks();
      toast.success('Checklist importado!');
    }
    setProcessing(false);
  }

  async function toggleTask(task: any) {
    const newStatus = !task.is_completed;
    setTasks(tasks.map(t => t.id === task.id ? {...t, is_completed: newStatus} : t));
    await supabase.from('order_tasks').update({ is_completed: newStatus }).eq('id', task.id);
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return;
    const { data, error } = await supabase
      .from('order_tasks')
      .insert([{ order_id: params.id, title: newTaskTitle.trim(), is_completed: false }])
      .select()
      .single();
    if (!error && data) {
      setTasks([...tasks, data]);
      setNewTaskTitle('');
      toast.success('Item adicionado!');
    }
  }

  async function deleteTask(taskId: string) {
    await supabase.from('order_tasks').delete().eq('id', taskId);
    setTasks(tasks.filter(t => t.id !== taskId));
  }

  async function saveReport() {
    setSavingReport(true);
    const { error } = await supabase
      .from('service_orders')
      .update({ execution_report: reportText })
      .eq('id', params.id);
    
    setSavingReport(false);
    if (error) {
      toast.error('Erro ao salvar');
    } else {
      setOrder((prev: any) => ({ ...prev, execution_report: reportText }));
      toast.success('Relatório salvo!');
    }
  }

  async function updateStatus(newStatus: string) {
    setProcessing(true);
    try {
      const updates: any = { status: newStatus };
      const now = new Date().toISOString();
      
      if (newStatus === 'em_andamento' && order.status === 'pendente') {
        updates.checkin_at = now;
      }
      if (newStatus === 'concluido') {
        if (!reportText.trim()) {
          toast.error('Preencha o relatório antes de concluir');
          setActiveTab('report');
          setProcessing(false);
          return;
        }
        updates.completed_at = now;
        updates.checkout_at = now;
        updates.execution_report = reportText;
      }
      
      const { error } = await supabase
        .from('service_orders')
        .update(updates)
        .eq('id', params.id);
      
      if (error) throw error;
      
      // Enviar notificações sobre mudança de status
      await sendStatusChangeNotifications(newStatus);
      
      toast.success('Status atualizado!');
      loadOrder();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function sendStatusChangeNotifications(newStatus: string) {
    try {
      const osId = order.id.slice(0, 6).toUpperCase();
      const clientName = order.clients?.name || 'Cliente';
      
      // Mensagens de status
      const statusMessages: Record<string, { title: string; message: string; emoji: string }> = {
        em_andamento: {
          title: `🔧 OS #${osId} - Execução Iniciada`,
          message: `A ordem de serviço "${order.title}" está sendo executada pelo técnico.`,
          emoji: '🔧'
        },
        pausado: {
          title: `⏸️ OS #${osId} - Pausada`,
          message: `A ordem de serviço "${order.title}" foi pausada temporariamente.`,
          emoji: '⏸️'
        },
        concluido: {
          title: `✅ OS #${osId} - Concluída`,
          message: `A ordem de serviço "${order.title}" foi concluída com sucesso!`,
          emoji: '✅'
        },
        cancelado: {
          title: `❌ OS #${osId} - Cancelada`,
          message: `A ordem de serviço "${order.title}" foi cancelada.`,
          emoji: '❌'
        }
      };

      const statusInfo = statusMessages[newStatus];
      if (!statusInfo) return;

      // Buscar usuários do cliente para notificar
      if (order.client_id) {
        const { data: clientUsers } = await supabase
          .from('profiles')
          .select('id')
          .eq('client_id', order.client_id)
          .eq('role', 'client');

        if (clientUsers && clientUsers.length > 0) {
          const clientNotifications = clientUsers.map(user => ({
            user_id: user.id,
            title: statusInfo.title,
            message: statusInfo.message,
            type: 'service_order',
            reference_id: order.id,
            reference_type: 'service_order'
          }));

          await supabase.from('notifications').insert(clientNotifications);
        }
      }

      // Notificar técnico atribuído (se não for quem fez a alteração)
      if (order.technician_id && order.technician_id !== profile?.id) {
        await supabase.from('notifications').insert({
          user_id: order.technician_id,
          title: statusInfo.title,
          message: `${statusInfo.message} (Cliente: ${clientName})`,
          type: 'service_order',
          reference_id: order.id,
          reference_type: 'service_order'
        });
      }

      // Notificar outros admins/super_admins (exceto quem fez a alteração)
      const { data: teamUsers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'super_admin'])
        .neq('id', profile?.id || '');

      if (teamUsers && teamUsers.length > 0) {
        const teamNotifications = teamUsers.map(user => ({
          user_id: user.id,
          title: statusInfo.title,
          message: `${statusInfo.message} (Cliente: ${clientName})`,
          type: 'service_order',
          reference_id: order.id,
          reference_type: 'service_order'
        }));

        await supabase.from('notifications').insert(teamNotifications);
      }
    } catch (error) {
      console.error('Erro ao enviar notificações:', error);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    try {
      const newUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const fileName = `${params.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('os-photos')
          .upload(fileName, file, { contentType: file.type });
        
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('os-photos').getPublicUrl(fileName);
        newUrls.push(data.publicUrl);
      }
      
      const updatedPhotos = [...(order.photos_url || []), ...newUrls];
      await supabase
        .from('service_orders')
        .update({ photos_url: updatedPhotos })
        .eq('id', params.id);
      
      setOrder({ ...order, photos_url: updatedPhotos });
      toast.success(`${newUrls.length} foto(s) adicionada(s)!`);
    } catch (error: any) {
      toast.error('Erro no upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photoUrl: string) {
    if (!confirm('Excluir esta foto?')) return;
    const updatedPhotos = order.photos_url.filter((u: string) => u !== photoUrl);
    setOrder({ ...order, photos_url: updatedPhotos });
    await supabase.from('service_orders').update({ photos_url: updatedPhotos }).eq('id', params.id);
    toast.success('Foto excluída');
  }

  async function handleDelete() {
    if (!confirm('Excluir esta ordem de serviço permanentemente?')) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('service_orders')
        .delete()
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Excluída!');
      router.push('/dashboard/orders');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  function openWhatsApp(messageType: string) {
    const phone = order.clients?.phone?.replace(/\D/g, '');
    if (!phone) return toast.error('Cliente sem telefone');
    const num = phone.length <= 11 ? '55' + phone : phone;
    const osId = order.id.slice(0, 6).toUpperCase();
    const clientName = order.clients?.name?.split(' ')[0];
    
    let msg = "";
    switch (messageType) {
      case 'way': msg = `Olá ${clientName}, técnico a caminho para OS #${osId}.`; break;
      case 'arrived': msg = `Olá ${clientName}, cheguei no local para OS #${osId}.`; break;
      case 'finished': msg = `Olá ${clientName}, serviço OS #${osId} finalizado.`; break;
    }
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function openMaps() {
    const address = order.clients?.address;
    if (!address) return toast.error('Sem endereço');
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  }

  function callPhone() {
    const phone = order.clients?.phone;
    if (!phone) return toast.error('Sem telefone');
    window.open(`tel:${phone}`, '_blank');
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluido': return 'badge-success';
      case 'em_andamento': return 'badge-info';
      case 'pendente': return 'badge-warning';
      case 'cancelado': return 'badge-danger';
      default: return 'badge-gray';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      agendado: 'Agendado',
      em_andamento: 'Em Execução',
      pausado: 'Pausado',
      concluido: 'Concluído',
      cancelado: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      low: '🟢 Baixa', medium: '🟡 Média', high: '🟠 Alta', urgent: '🔴 Urgente',
      baixa: '🟢 Baixa', media: '🟡 Média', alta: '🟠 Alta', urgente: '🔴 Urgente',
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

  if (!order) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/orders" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">OS #{order.id.slice(0,6).toUpperCase()}</h1>
            <button onClick={() => router.push(`/dashboard/orders/new?clone=${order.id}`)} className="p-1.5 hover:bg-gray-100 rounded" title="Duplicar">
              <Copy size={16} className="text-gray-500" />
            </button>
          </div>
          <p className="text-gray-500">{order.clients?.name}</p>
        </div>
        <button 
          onClick={loadEditData}
          className="btn btn-secondary"
          title="Editar OS"
        >
          <Pencil size={18} /> Editar
        </button>
        <button 
          onClick={() => generateServiceOrderPDF(order)} 
          className="btn btn-secondary"
          title="Gerar PDF"
        >
          <FileDown size={18} /> PDF
        </button>
        <span className={`badge ${getStatusColor(order.status)}`}>
          {getStatusLabel(order.status)}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'info', icon: FileText, label: 'Dados' },
          { id: 'report', icon: Edit, label: 'Relatório' },
          { id: 'evidence', icon: Camera, label: 'Evidências' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
              activeTab === tab.id ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <tab.icon size={18} />
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          {/* Cliente e Ferramentas */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">🏢 Cliente</h3>
            <p className="text-lg font-medium">{order.clients?.name}</p>
            {order.clients?.address && <p className="text-sm text-gray-500">📍 {order.clients.address}</p>}
            {order.clients?.phone && <p className="text-sm text-gray-500">📱 {order.clients.phone}</p>}
            
            <div className="flex gap-2 mt-4">
              <button onClick={openMaps} className="btn btn-secondary flex-1">
                <Navigation size={18} /> Rota GPS
              </button>
              <button onClick={() => openWhatsApp('way')} className="btn btn-secondary flex-1 !bg-green-50 !text-green-700 hover:!bg-green-100">
                <MessageCircle size={18} /> WhatsApp
              </button>
              <button onClick={callPhone} className="btn btn-secondary flex-1">
                <Phone size={18} /> Ligar
              </button>
            </div>
          </div>

          {/* Serviço */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">🔧 Serviço</h3>
            <p className="text-lg font-bold text-gray-800">{order.title}</p>
            {order.description && <p className="text-gray-600 mt-2">{order.description}</p>}
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Prioridade</p>
                <p className="font-medium">{getPriorityLabel(order.priority)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Técnico</p>
                <p className="font-medium">{order.technician?.full_name || 'Não atribuído'}</p>
              </div>
            </div>
          </div>

          {/* Horários */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">⏰ Horários</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Início</p>
                <p className="font-medium">{order.checkin_at ? new Date(order.checkin_at).toLocaleString('pt-BR') : '--'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Conclusão</p>
                <p className="font-medium">{order.completed_at ? new Date(order.completed_at).toLocaleString('pt-BR') : '--'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Checkout</p>
                <p className="font-medium">{order.checkout_at ? new Date(order.checkout_at).toLocaleString('pt-BR') : '--'}</p>
              </div>
            </div>
          </div>

          {/* Equipamento */}
          {order.equipments && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">🔩 Equipamento</h3>
              <p className="font-medium">{order.equipments.name}</p>
              {order.equipments.model && <p className="text-sm text-gray-500">Modelo: {order.equipments.model}</p>}
              {order.equipments.serial_number && <p className="text-sm text-gray-500">SN: {order.equipments.serial_number}</p>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <div className="space-y-4">
          {/* Checklist */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">✅ Checklist Técnico</h3>
              <button onClick={loadChecklistModels} className="text-sm text-indigo-600 hover:underline">
                + Importar Modelo
              </button>
            </div>
            
            <div className="space-y-2 mb-4">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg group">
                  <button
                    onClick={() => toggleTask(task)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      task.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                    }`}
                  >
                    {task.is_completed && <Check size={12} className="text-white" />}
                  </button>
                  <span className={`flex-1 ${task.is_completed ? 'line-through text-gray-400' : ''}`}>
                    {task.title}
                  </span>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-gray-400 text-sm italic">Nenhum item de verificação</p>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
                placeholder="Adicionar item..."
                className="input flex-1"
              />
              <button onClick={addTask} className="btn btn-secondary">
                Adicionar
              </button>
            </div>
          </div>

          {/* Relatório */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">📝 Relatório Técnico</h3>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Descreva os serviços realizados, peças trocadas, observações..."
              className="input min-h-[200px]"
            />
            <button 
              onClick={saveReport} 
              disabled={savingReport}
              className="btn btn-primary mt-3"
            >
              {savingReport ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Relatório
            </button>
          </div>
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="space-y-4">
          {/* Fotos */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">📷 Fotos ({order.photos_url?.length || 0})</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn btn-secondary"
              >
                {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                Adicionar Fotos
              </button>
            </div>
            
            {order.photos_url && order.photos_url.length > 0 ? (
              <div className="grid grid-cols-4 gap-3">
                {order.photos_url.map((photo: string, index: number) => (
                  <div key={index} className="relative group">
                    <img 
                      src={photo} 
                      alt={`Foto ${index + 1}`} 
                      className="rounded-lg object-cover h-32 w-full cursor-pointer hover:opacity-90"
                      onClick={() => window.open(photo, '_blank')}
                    />
                    <button
                      onClick={() => deletePhoto(photo)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                <p>Nenhuma foto adicionada</p>
              </div>
            )}
          </div>

          {/* Assinatura */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">✍️ Assinatura do Cliente</h3>
            
            {order.signature_url ? (
              <div className="text-center">
                <img src={order.signature_url} alt="Assinatura" className="max-h-32 mx-auto border rounded-lg" />
                {order.signer_name && <p className="mt-2 font-medium">{order.signer_name}</p>}
                {order.signer_doc && <p className="text-sm text-gray-500">Doc: {order.signer_doc}</p>}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <PenTool size={48} className="mx-auto mb-2 opacity-50" />
                <p>Assinatura não coletada</p>
                <p className="text-sm">Use o app mobile para coletar assinatura</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ações de Status */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">⚡ Alterar Status</h3>
        <div className="flex flex-wrap gap-2">
          {order.status === 'pendente' && (
            <button onClick={() => updateStatus('em_andamento')} disabled={processing} className="btn btn-primary">
              <Play size={18} /> Iniciar Execução
            </button>
          )}
          {order.status === 'em_andamento' && (
            <>
              <button onClick={() => updateStatus('pausado')} disabled={processing} className="btn btn-secondary">
                <Pause size={18} /> Pausar
              </button>
              <button onClick={() => updateStatus('concluido')} disabled={processing} className="btn btn-success">
                <CheckCircle size={18} /> Concluir OS
              </button>
            </>
          )}
          {order.status === 'pausado' && (
            <button onClick={() => updateStatus('em_andamento')} disabled={processing} className="btn btn-primary">
              <Play size={18} /> Retomar
            </button>
          )}
          {order.status === 'concluido' && (
            <button onClick={() => updateStatus('em_andamento')} disabled={processing} className="btn btn-warning !bg-amber-500 hover:!bg-amber-600 !text-white">
              <Play size={18} /> Reabrir OS
            </button>
          )}
          {order.status === 'cancelado' && (
            <button onClick={() => updateStatus('pendente')} disabled={processing} className="btn btn-primary">
              <Play size={18} /> Reativar OS
            </button>
          )}
          {order.status !== 'cancelado' && order.status !== 'concluido' && (
            <button onClick={() => updateStatus('cancelado')} disabled={processing} className="btn btn-danger">
              <X size={18} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Excluir */}
      <div className="flex justify-end">
        <button onClick={handleDelete} disabled={processing} className="btn btn-danger">
          <Trash2 size={20} /> Excluir OS
        </button>
      </div>

      {/* Modal Checklist */}
      {showChecklistModal && (
        <div className="modal-overlay" onClick={() => setShowChecklistModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Importar Checklist</h2>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {checklistModels.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhum modelo de checklist cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {checklistModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => importChecklist(model.id)}
                      className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-medium">{model.name}</p>
                      {model.description && <p className="text-sm text-gray-500">{model.description}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-gray-50">
              <button onClick={() => setShowChecklistModal(false)} className="btn btn-secondary w-full">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar OS */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b bg-gradient-to-r from-amber-500 to-orange-600">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Pencil className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Editar Ordem de Serviço</h2>
                  <p className="text-white/70 text-sm">OS #{order.id.slice(0,6).toUpperCase()} - Edição completa</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Seção: Cliente e Equipamento */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-xs font-bold">1</span>
                  Identificação
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Cliente</label>
                    <select
                      value={editData.client_id}
                      onChange={(e) => {
                        setEditData({ ...editData, client_id: e.target.value, equipment_id: '' });
                        loadEquipmentsForClient(e.target.value);
                      }}
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
                      value={editData.equipment_id}
                      onChange={(e) => setEditData({ ...editData, equipment_id: e.target.value })}
                      className="input"
                      disabled={!editData.client_id}
                    >
                      <option value="">Selecione (opcional)</option>
                      {equipments.map((eq) => (
                        <option key={eq.id} value={eq.id}>{eq.name} {eq.model && `- ${eq.model}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção: Detalhes do Serviço */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-xs font-bold">2</span>
                  Detalhes do Serviço
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="label flex items-center gap-1">
                      <span>Título</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="input"
                      placeholder="Ex: Manutenção preventiva, Reparo de equipamento..."
                    />
                  </div>
                  <div>
                    <label className="label">Descrição</label>
                    <textarea
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      className="input min-h-[80px] resize-none"
                      placeholder="Descreva detalhadamente o serviço..."
                    />
                  </div>
                </div>
              </div>

              {/* Seção: Atribuição e Agendamento */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-xs font-bold">3</span>
                  Atribuição e Agendamento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Técnico Responsável</label>
                    <select
                      value={editData.technician_id}
                      onChange={(e) => setEditData({ ...editData, technician_id: e.target.value })}
                      className="input"
                    >
                      <option value="">Selecione (opcional)</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Data Agendada</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="date"
                        value={editData.scheduled_at}
                        onChange={(e) => setEditData({ ...editData, scheduled_at: e.target.value })}
                        className="input pl-10"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="label">Prioridade</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'baixa', label: 'Baixa', color: 'bg-green-100 border-green-300 text-green-700', dot: 'bg-green-500' },
                        { value: 'media', label: 'Média', color: 'bg-amber-100 border-amber-300 text-amber-700', dot: 'bg-amber-500' },
                        { value: 'alta', label: 'Alta', color: 'bg-orange-100 border-orange-300 text-orange-700', dot: 'bg-orange-500' },
                        { value: 'urgente', label: 'Urgente', color: 'bg-red-100 border-red-300 text-red-700', dot: 'bg-red-500' },
                      ].map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setEditData({ ...editData, priority: p.value })}
                          className={`px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            editData.priority === p.value
                              ? `${p.color} border-current shadow-sm`
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${p.dot}`}></span>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                      className="input"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="pausado">Pausado</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção: Datas de Execução */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-xs font-bold">4</span>
                  ⏰ Datas de Execução
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Início (Check-in)</label>
                    <input
                      type="datetime-local"
                      value={editData.checkin_at}
                      onChange={(e) => setEditData({ ...editData, checkin_at: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Conclusão</label>
                    <input
                      type="datetime-local"
                      value={editData.completed_at}
                      onChange={(e) => setEditData({ ...editData, completed_at: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Checkout</label>
                    <input
                      type="datetime-local"
                      value={editData.checkout_at}
                      onChange={(e) => setEditData({ ...editData, checkout_at: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">💡 Edite as datas para corrigir horários de execução</p>
              </div>

              {/* Seção: Relatório Técnico */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">5</span>
                  📝 Relatório Técnico
                </h3>
                <textarea
                  value={editData.execution_report}
                  onChange={(e) => setEditData({ ...editData, execution_report: e.target.value })}
                  className="input min-h-[150px] resize-none"
                  placeholder="Descreva os serviços realizados, peças trocadas, observações técnicas..."
                />
              </div>

              {/* Seção: Fotos */}
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 text-xs font-bold">6</span>
                  📷 Fotos ({editData.photos_url.length})
                </h3>
                
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleEditPhotoUpload}
                  className="hidden"
                />
                
                {editData.photos_url.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {editData.photos_url.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={photo} 
                          alt={`Foto ${index + 1}`} 
                          className="rounded-lg object-cover h-24 w-full cursor-pointer hover:opacity-90"
                          onClick={() => window.open(photo, '_blank')}
                        />
                        <button
                          type="button"
                          onClick={() => removeEditPhoto(photo)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400 mb-4">
                    <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma foto</p>
                  </div>
                )}
                
                <button 
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={uploadingEdit}
                  className="btn btn-secondary w-full"
                >
                  {uploadingEdit ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                  Adicionar Fotos
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                <span className="text-red-500">*</span> Campos obrigatórios
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveEdit} 
                  disabled={savingEdit || !editData.title.trim()} 
                  className="btn btn-primary"
                >
                  {savingEdit ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
