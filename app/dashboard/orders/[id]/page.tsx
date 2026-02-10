'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/authStore';
import {
  ArrowLeft, Trash2, Loader2, Calendar, Clock, User, MapPin,
  FileText, Camera, PenTool, Check, Play, Pause, CheckCircle,
  Phone, MessageCircle, Navigation, Edit, Copy, List, Save, X,
  Upload, Image as ImageIcon, Download, FileDown, Pencil, History,
  Plus, Eye, Package
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { generateServiceOrderPDF } from '../../../../utils/pdfGenerator';
import { createAuditLog } from '../../../../utils/auditUtils';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'report' | 'evidence' | 'history'>('info');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [addingItem, setAddingItem] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemFormData, setItemFormData] = useState({
    product_id: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    item_type: 'product' as 'product' | 'service'
  });

  // Relatório
  const [reportText, setReportText] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSmartAssist, setShowSmartAssist] = useState(false);

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
  const [isSavingSignature, setIsSavingSignature] = useState(false);

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

  // Modal de Conclusão
  const [showConcluirModal, setShowConcluirModal] = useState(false);
  const [concluirData, setConcluirData] = useState({
    checkin_at: '',
    completed_at: '',
    checkout_at: '',
    signer_name: '',
    signer_doc: '',
  });

  useEffect(() => {
    loadOrder();
  }, [params.id]);

  async function loadOrder() {
    try {
      const { data, error } = await supabase
        .from('service_orders')
        .select('*, clients(name, phone, email, address, responsible_name), technician:profiles!service_orders_technician_id_fkey(full_name, signature_url), equipments(name, model, serial_number)')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setOrder(data);
      setReportText(data.execution_report || '');
      if (data.signer_name) setSignerName(data.signer_name);
      if (data.signer_doc) setSignerDoc(data.signer_doc);

      await loadTasks();
      await loadOrderItems();
      await loadAvailableProducts();
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

  async function loadOrderItems() {
    const { data } = await supabase
      .from('service_order_items')
      .select('*')
      .eq('order_id', params.id)
      .order('created_at');
    setOrderItems(data || []);
  }

  async function loadAvailableProducts() {
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, unit_price')
      .gt('quantity', 0)
      .order('name');
    setAvailableProducts(data || []);
  }

  async function loadSmartAssist() {
    if (!order?.description) {
      toast.error('Adicione uma descrição à OS para gerar sugestões');
      return;
    }

    setLoadingSuggestions(true);
    setShowSmartAssist(true);
    try {
      // Tentar encontrar palavras-chave relevantes (mínimo 4 caracteres)
      const keywords = order.description
        .replace(/[,.;:!?]/g, ' ')
        .split(' ')
        .filter((w: string) => w.length >= 4)
        .slice(0, 5); // Limitar a 5 palavras para a query não ficar gigante

      if (keywords.length === 0) {
        setSuggestions([]);
        return;
      }

      const orQuery = keywords.map((k: string) => `description.ilike.%${k}%`).join(',');

      const { data, error } = await supabase
        .from('service_orders')
        .select('title, execution_report, description, status')
        .not('execution_report', 'is', null)
        .neq('id', order.id)
        .or(orQuery)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error: any) {
      console.error('Erro Smart Assist:', error);
      toast.error('Erro ao buscar sugestões');
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function addOrderItem() {
    if (!itemFormData.description && !itemFormData.product_id) {
      toast.error('Informe a descrição ou selecione um produto');
      return;
    }

    setAddingItem(true);
    try {
      const { data, error } = await supabase
        .from('service_order_items')
        .insert([{
          order_id: params.id,
          product_id: itemFormData.item_type === 'product' ? (itemFormData.product_id || null) : null,
          description: itemFormData.description || (availableProducts.find(p => p.id === itemFormData.product_id)?.name),
          quantity: itemFormData.quantity,
          unit_price: itemFormData.unit_price,
          item_type: itemFormData.item_type
        }])
        .select()
        .single();

      if (error) throw error;

      setOrderItems([...orderItems, data]);
      setShowItemModal(false);
      setItemFormData({ product_id: '', description: '', quantity: 1, unit_price: 0, item_type: 'product' });
      toast.success('Item adicionado!');

      // Se for produto, atualizar estoque localmente pra UX
      if (itemFormData.item_type === 'product' && itemFormData.product_id) {
        setAvailableProducts(prev => prev.map(p =>
          p.id === itemFormData.product_id ? { ...p, quantity: p.quantity - itemFormData.quantity } : p
        ));
      }
    } catch (error: any) {
      toast.error('Erro ao adicionar item: ' + error.message);
    } finally {
      setAddingItem(false);
    }
  }

  async function removeOrderItem(item: any) {
    if (!confirm('Remover este item? O estoque será devolvido se for um produto.')) return;

    try {
      const { error } = await supabase
        .from('service_order_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      setOrderItems(orderItems.filter(i => i.id !== item.id));
      toast.success('Item removido!');

      // Devolver estoque localmente pra UX
      if (item.item_type === 'product' && item.product_id) {
        setAvailableProducts(prev => prev.map(p =>
          p.id === item.product_id ? { ...p, quantity: p.quantity + item.quantity } : p
        ));
      }
    } catch (error: any) {
      toast.error('Erro ao remover: ' + error.message);
    }
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('audit_logs')
      .select('*, profiles:user_id(full_name)')
      .eq('target_table', 'service_orders')
      .eq('target_id', params.id)
      .order('created_at', { ascending: false });
    setAuditLogs(data || []);
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

      // Auditoria
      if (profile?.id) {
        await createAuditLog({
          userId: profile.id,
          action: 'UPDATE',
          table: 'service_orders',
          recordId: params.id as string,
          oldData: order,
          newData: updateData,
          description: `OS #${order.id.slice(0, 6).toUpperCase()} editada manualmente pelo admin.`
        });
      }

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
    setTasks(tasks.map(t => t.id === task.id ? { ...t, is_completed: newStatus } : t));
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
    // Se for concluir, abre o modal para escolher a data
    if (newStatus === 'completed') {
      if (!reportText.trim()) {
        toast.error('Preencha o relatório antes de concluir');
        setActiveTab('report');
        return;
      }
      // Preencher com data/hora atual como padrão (ou usar a existente)
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

      // Se já tem checkin, usar ele, senão usar agora
      let checkinValue = localDateTime;
      if (order.checkin_at) {
        const checkinDate = new Date(order.checkin_at);
        checkinValue = new Date(checkinDate.getTime() - checkinDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }

      setConcluirData({
        checkin_at: checkinValue,
        completed_at: localDateTime,
        checkout_at: localDateTime,
        signer_name: order.signer_name || order.clients?.responsible_name || '',
        signer_doc: order.signer_doc || '',
      });
      setShowConcluirModal(true);
      return;
    }

    setProcessing(true);
    try {
      const updates: any = { status: newStatus };
      const now = new Date().toISOString();

      if (newStatus === 'em_andamento' && order.status === 'pendente') {
        updates.checkin_at = now;
      }

      const { error } = await supabase
        .from('service_orders')
        .update(updates)
        .eq('id', params.id);

      if (error) throw error;

      // Auditoria
      if (profile?.id) {
        await createAuditLog({
          userId: profile.id,
          action: 'UPDATE',
          table: 'service_orders',
          recordId: params.id as string,
          oldData: { status: order.status },
          newData: { status: newStatus },
          description: `Status da OS #${order.id.slice(0, 6).toUpperCase()} alterado para ${newStatus}.`
        });
      }

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

  async function handleConcluirOS() {
    if (!concluirData.checkin_at) {
      toast.error('Selecione a data de início');
      return;
    }
    if (!concluirData.completed_at) {
      toast.error('Selecione a data de conclusão');
      return;
    }

    setProcessing(true);
    try {
      const updates: any = {
        status: 'concluida',
        checkin_at: new Date(concluirData.checkin_at + ':00-03:00').toISOString(),
        completed_at: new Date(concluirData.completed_at + ':00-03:00').toISOString(),
        checkout_at: new Date((concluirData.checkout_at || concluirData.completed_at) + ':00-03:00').toISOString(),
        execution_report: reportText,
        signer_name: concluirData.signer_name,
        signer_doc: concluirData.signer_doc,
      };

      const { error } = await supabase
        .from('service_orders')
        .update(updates)
        .eq('id', params.id);

      if (error) throw error;

      // Enviar notificações
      await sendStatusChangeNotifications('concluida');

      toast.success('OS concluída com sucesso!');
      setShowConcluirModal(false);
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
        in_progress: {
          title: `🔧 OS #${osId} - Execução Iniciada`,
          message: `A ordem de serviço "${order.title}" está sendo executada pelo técnico.`,
          emoji: '🔧'
        },
        paused: {
          title: `⏸️ OS #${osId} - Pausada`,
          message: `A ordem de serviço "${order.title}" foi pausada temporariamente.`,
          emoji: '⏸️'
        },
        concluida: {
          title: `✅ OS #${osId} - Concluída`,
          message: `A ordem de serviço "${order.title}" foi concluída com sucesso!`,
          emoji: '✅'
        },
        cancelada: {
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
    const clientName = order.clients?.name?.split(' ')[0] || 'cliente';
    const technicianName = order.technician?.full_name?.split(' ')[0] || 'nosso técnico';

    let msg = "";
    switch (messageType) {
      case 'way':
        msg = `*CHAMEI APP - Informativo*\n\nOlá ${clientName}, o técnico ${technicianName} já está a caminho para o atendimento da *OS #${osId}*.\n\nPrevisão de chegada em instantes.`;
        break;
      case 'arrived':
        msg = `*CHAMEI APP - Informativo*\n\nOlá ${clientName}, o técnico ${technicianName} acabou de chegar para realizar o serviço da *OS #${osId}*.`;
        break;
      case 'finished':
        msg = `*CHAMEI APP - Serviço Concluído*\n\nOlá ${clientName}, o serviço da *OS #${osId}* foi finalizado com sucesso! em breve você receberá o relatório técnico completo.\n\nAgradecemos a preferência!`;
        break;
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

  // Funções de Assinatura
  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  async function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !signerName.trim()) {
      toast.error('Preencha o nome do assinante e assine no campo');
      return;
    }

    setIsSavingSignature(true);
    try {
      // Converter canvas para blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });

      const fileName = `${params.id}/signature_${Date.now()}.png`;

      // Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from('os-photos')
        .upload(fileName, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('os-photos').getPublicUrl(fileName);
      const signatureUrl = publicUrlData.publicUrl;

      // Atualizar a OS
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({
          signature_url: signatureUrl,
          signer_name: signerName,
          signer_doc: signerDoc,
          status: 'concluida', // Auto-concluir se não estiver
          completed_at: new Date().toISOString()
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      toast.success('Assinatura coletada e OS finalizada!');
      setShowSignatureModal(false);
      loadOrder();
    } catch (error: any) {
      toast.error('Erro ao salvar assinatura: ' + error.message);
    } finally {
      setIsSavingSignature(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'badge-success';
      case 'in_progress': return 'badge-info';
      case 'pending': return 'badge-warning';
      case 'cancelled': return 'badge-danger';
      default: return 'badge-gray';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      scheduled: 'Agendado',
      in_progress: 'Em Execução',
      paused: 'Pausado',
      completed: 'Concluído',
      cancelled: 'Cancelado',
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

  if (!order) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/orders" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">OS #{order.id.slice(0, 6).toUpperCase()}</h1>
            <button onClick={() => router.push(`/dashboard/orders/new?clone=${order.id}`)} className="p-1.5 hover:bg-gray-100 rounded" title="Duplicar">
              <Copy size={16} className="text-gray-500" />
            </button>
          </div>
          <p className="text-gray-500">{order.clients?.name}</p>
        </div>
        <button
          onClick={() => {
            const url = `${window.location.origin}/portal/${order.id}`;
            navigator.clipboard.writeText(url);
            toast.success('Link de aprovação copiado!');
          }}
          className="btn !bg-indigo-600 !text-white hover:!bg-indigo-700 shadow-md shadow-indigo-200"
          title="Copiar link para o cliente"
        >
          <Copy size={16} /> Link do Cliente
        </button>
        <button
          onClick={loadEditData}
          className="btn btn-secondary"
          title="Editar OS"
        >
          <Pencil size={18} /> Editar
        </button>
        <button
          onClick={() => generateServiceOrderPDF({ ...order, items: orderItems, tasks: tasks })}
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
          { id: 'items', icon: Package, label: 'Peças/Serviços' },
          { id: 'report', icon: Edit, label: 'Relatório' },
          { id: 'evidence', icon: Camera, label: 'Evidências' },
          { id: 'history', icon: History, label: 'Histórico' },
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

      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Package size={20} className="text-indigo-500" /> Peças e Serviços Utilizados
              </h3>
              <button
                onClick={() => setShowItemModal(true)}
                className="btn btn-primary text-sm gap-2"
              >
                <Plus size={16} /> Adicionar Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 border-b dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Descrição</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-center">Qtd</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Unitário</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Total</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-800">
                  {orderItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400 italic">
                        Nenhum item adicionado a esta ordem.
                      </td>
                    </tr>
                  ) : (
                    orderItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-4 font-medium text-gray-800 dark:text-gray-200">
                          {item.description}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.item_type === 'product' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            }`}>
                            {item.item_type === 'product' ? 'Peça' : 'Serviço'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-bold">{item.quantity}</td>
                        <td className="px-4 py-4 text-right">R$ {item.unit_price.toFixed(2)}</td>
                        <td className="px-4 py-4 text-right font-bold text-gray-900 dark:text-white">
                          R$ {(item.quantity * item.unit_price).toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => removeOrderItem(item)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {orderItems.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50/50 dark:bg-gray-800/20 font-bold text-gray-900 dark:text-white">
                      <td colSpan={4} className="px-4 py-4 text-right uppercase tracking-widest text-xs">Total Geral:</td>
                      <td className="px-4 py-4 text-right text-lg">
                        R$ {orderItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'report' && (
        <div className="space-y-4">
          {/* Checklist */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">✅ Checklist Técnico</h3>
              <button onClick={loadChecklistModels} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                <Plus size={14} /> Importar Modelo
              </button>
            </div>

            <div className="space-y-2 mb-6">
              {tasks.length === 0 ? (
                <p className="text-center py-4 text-gray-400 text-sm italic">Nenhum item definido</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl group transition-all border border-transparent hover:border-gray-200">
                    <button
                      onClick={() => toggleTask(task)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'
                        }`}
                    >
                      {task.is_completed && <Check size={14} className="text-white" />}
                    </button>
                    <span className={`flex-1 text-sm ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}`}>
                      {task.title}
                    </span>
                    <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Novo item de verificação..."
                className="input flex-1 text-sm"
              />
              <button onClick={addTask} className="btn btn-secondary text-sm px-6">Adicionar</button>
            </div>
          </div>

          {/* Relatório Técnico */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Edit size={18} className="text-indigo-500" /> Relatório Técnico
              </h3>
              <button
                onClick={loadSmartAssist}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-all shadow-sm"
              >
                <PenTool size={14} className="animate-pulse" /> Smart Assist
              </button>
            </div>

            {showSmartAssist && (
              <div className="mb-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 animate-fadeIn">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1">
                    <PenTool size={12} /> Sugestões Inteligentes (Baseadas no Histórico)
                  </p>
                  <button onClick={() => setShowSmartAssist(false)} className="text-indigo-400 hover:text-indigo-600">
                    <X size={14} />
                  </button>
                </div>

                {loadingSuggestions ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="animate-spin text-indigo-600" size={24} />
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="text-xs text-indigo-400 italic py-2 text-center">Nenhuma solução similar encontrada no histórico.</p>
                ) : (
                  <div className="space-y-3">
                    {suggestions.map((sug, i) => (
                      <div key={i} className="bg-white p-3 rounded-xl border border-indigo-100/50 shadow-sm hover:shadow-md transition-all group">
                        <p className="text-xs font-bold text-gray-800 mb-1">{sug.title}</p>
                        <p className="text-xs text-gray-600 line-clamp-2 italic mb-2">"{sug.description}"</p>
                        <div className="p-2 bg-indigo-50 rounded-lg text-xs text-indigo-700 border border-indigo-100 flex flex-col gap-2">
                          <p className="font-medium">{sug.execution_report}</p>
                          <button
                            onClick={() => {
                              const currentText = reportText ? reportText + '\n\n' : '';
                              setReportText(currentText + sug.execution_report);
                              toast.success('Sugestão aplicada!');
                            }}
                            className="self-end px-2 py-1 bg-white text-indigo-600 rounded border border-indigo-100 font-bold hover:bg-indigo-600 hover:text-white transition-all text-[10px]"
                          >
                            Aplicar Sugestão
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Descreva detalhadamente as atividades realizadas, peças ou produtos utilizados, e observações gerais..."
              className="input min-h-[300px] text-sm leading-relaxed"
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={saveReport}
                disabled={savingReport}
                className="btn btn-primary px-8"
              >
                {savingReport ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar Relatório
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="space-y-4">
          {/* Fotos */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
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
                className="btn btn-secondary text-sm"
              >
                {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                Fazer Upload
              </button>
            </div>

            {order.photos_url && order.photos_url.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {order.photos_url.map((photo: string, index: number) => (
                  <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                    <img
                      src={photo}
                      alt={`Evidência ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => window.open(photo, '_blank')}
                        className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm"
                        title="Ver tela cheia"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => deletePhoto(photo)}
                        className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white backdrop-blur-sm"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <ImageIcon size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">Nenhuma foto anexada ainda</p>
                <p className="text-xs text-gray-400 mt-1">Anexe fotos de antes, durante e depois da execução</p>
              </div>
            )}
          </div>

          {/* Assinatura */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">✍️ Assinatura do Cliente</h3>

            {order.signature_url ? (
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm max-w-md mx-auto">
                <img src={order.signature_url} alt="Assinatura" className="max-h-40 mx-auto" />
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <p className="font-bold text-gray-900">{order.signer_name}</p>
                  <p className="text-sm text-gray-500">Documento: {order.signer_doc}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-amber-50 rounded-xl border-2 border-dashed border-amber-200">
                <PenTool size={48} className="mx-auto mb-3 text-amber-300" />
                <p className="text-amber-700 font-medium">Assinatura não coletada</p>
                <div className="mt-4 flex flex-col items-center">
                  <p className="text-xs text-amber-600 mb-4">A assinatura pode ser coletada via aplicativo ou diretamente aqui através do portal WEB.</p>
                  <button
                    onClick={() => {
                      setShowSignatureModal(true);
                      setTimeout(() => {
                        const canvas = canvasRef.current;
                        if (canvas) {
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.strokeStyle = '#000';
                            ctx.lineWidth = 2;
                            ctx.lineCap = 'round';
                          }
                        }
                      }, 200);
                    }}
                    className="btn !bg-amber-600 !text-white hover:!bg-amber-700 shadow-md shadow-amber-200 gap-2"
                  >
                    <PenTool size={18} /> Coletar Assinatura Web
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ações de Status e Botão Excluir */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-gray-100">
        <div className="flex flex-wrap gap-2">
          {order.status === 'pendente' && (
            <button onClick={() => updateStatus('em_andamento')} disabled={processing} className="btn btn-primary gap-2">
              <Play size={18} /> Iniciar Execução
            </button>
          )}
          {order.status === 'em_andamento' && (
            <>
              <button onClick={() => updateStatus('pausada')} disabled={processing} className="btn bg-amber-500 hover:bg-amber-600 text-white gap-2 border-none">
                <Pause size={18} /> Pausar
              </button>
              <button onClick={() => updateStatus('concluida')} disabled={processing} className="btn btn-success gap-2">
                <CheckCircle size={18} /> Finalizar OS
              </button>
            </>
          )}
          {order.status === 'pausada' && (
            <button onClick={() => updateStatus('em_andamento')} disabled={processing} className="btn btn-primary gap-2">
              <Play size={18} /> Retomar Execução
            </button>
          )}
          {order.status === 'concluida' && (
            <button onClick={() => updateStatus('em_andamento')} disabled={processing} className="btn bg-amber-100 text-amber-700 hover:bg-amber-200 border-none gap-2">
              <Play size={18} /> Reabrir OS
            </button>
          )}
          {order.status !== 'cancelada' && (
            <button onClick={() => updateStatus('cancelada')} disabled={processing} className="btn btn-danger-outline gap-2">
              <X size={18} /> Cancelar Chamado
            </button>
          )}
          {order.status === 'cancelada' && (
            <button onClick={() => updateStatus('pendente')} disabled={processing} className="btn btn-primary gap-2">
              <Play size={18} /> Reativar OS
            </button>
          )}
        </div>

        <button onClick={handleDelete} disabled={processing} className="btn btn-danger-ghost px-4 gap-2">
          <Trash2 size={18} /> Excluir OS Permanentemente
        </button>
      </div>

      {/* MODALS */}

      {/* Modal Checklist */}
      {showChecklistModal && (
        <div className="modal-overlay" onClick={() => setShowChecklistModal(false)}>
          <div className="modal-content max-w-md animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Modelos de Checklist</h2>
              <button onClick={() => setShowChecklistModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {checklistModels.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <List size={32} className="mx-auto mb-2 opacity-20" />
                  <p>Nenhum modelo cadastrado</p>
                </div>
              ) : (
                checklistModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => importChecklist(model.id)}
                    className="w-full p-4 text-left border rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                  >
                    <p className="font-bold text-gray-800 group-hover:text-indigo-700">{model.name}</p>
                    {model.description && <p className="text-sm text-gray-500 mt-1">{model.description}</p>}
                  </button>
                ))
              )}
            </div>
            <div className="p-6 border-t bg-gray-50 text-right">
              <button onClick={() => setShowChecklistModal(false)} className="btn btn-secondary px-8">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar OS Completa */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content max-w-3xl animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Editar OS Completa</h2>
                  <p className="text-white/70 text-xs">Ajuste todos os parâmetros do chamado</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-white">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-gray-50/50">
              {/* Seção 1: Identificação */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xs">1</div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Identificação do Cliente</h3>
                </div>
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
                      <option value="">Selecione um equipamento</option>
                      {equipments.map((eq) => (
                        <option key={eq.id} value={eq.id}>{eq.name} {eq.model && `- ${eq.model}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção 2: Detalhes do Serviço */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xs">2</div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Detalhes do Serviço</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="label">Título da OS</label>
                    <input
                      type="text"
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="input"
                      placeholder="Ex: Manutenção preventiva ar-condicionado"
                    />
                  </div>
                  <div>
                    <label className="label">Descrição Detalhada</label>
                    <textarea
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      className="input min-h-[100px] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3: Atribuição */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xs">3</div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Atribuição e Prazo</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Técnico Responsável</label>
                    <select
                      value={editData.technician_id}
                      onChange={(e) => setEditData({ ...editData, technician_id: e.target.value })}
                      className="input"
                    >
                      <option value="">Nenhum técnico atribuído</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Data de Agendamento</label>
                    <input
                      type="date"
                      value={editData.scheduled_at}
                      onChange={(e) => setEditData({ ...editData, scheduled_at: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="label">Prioridade</label>
                    <select
                      value={editData.priority}
                      onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                      className="input"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Status do Chamado</label>
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                      className="input"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="pausada">Pausado</option>
                      <option value="concluida">Concluído</option>
                      <option value="cancelada">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção 4: Datas de Execução */}
              <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">4</div>
                  <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Datas de Execução Real</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label !text-emerald-700 font-semibold">Check-in (Início)</label>
                    <input
                      type="datetime-local"
                      value={editData.checkin_at}
                      onChange={(e) => setEditData({ ...editData, checkin_at: e.target.value })}
                      className="input !border-emerald-200 focus:!border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="label !text-emerald-700 font-semibold">Coclusão</label>
                    <input
                      type="datetime-local"
                      value={editData.completed_at}
                      onChange={(e) => setEditData({ ...editData, completed_at: e.target.value })}
                      className="input !border-emerald-200 focus:!border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="label !text-emerald-700 font-semibold">Check-out (Final)</label>
                    <input
                      type="datetime-local"
                      value={editData.checkout_at}
                      onChange={(e) => setEditData({ ...editData, checkout_at: e.target.value })}
                      className="input !border-emerald-200 focus:!border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary px-6">Cancelar</button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || !editData.title.trim()}
                className="btn btn-primary px-8"
              >
                {savingEdit ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Conclusão de OS */}
      {showConcluirModal && (
        <div className="modal-overlay" onClick={() => setShowConcluirModal(false)}>
          <div className="modal-content max-w-md animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b bg-emerald-500 text-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <CheckCircle size={24} />
                <h2 className="text-xl font-bold">Concluir Ordem de Serviço</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600 text-sm">Confirme os horários de execução real para finalizar este chamado.</p>

              <div>
                <label className="label">Data/Hora de Início (Real)</label>
                <input
                  type="datetime-local"
                  value={concluirData.checkin_at}
                  onChange={(e) => setConcluirData({ ...concluirData, checkin_at: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Data/Hora de Conclusão (Real)</label>
                <input
                  type="datetime-local"
                  value={concluirData.completed_at}
                  onChange={(e) => setConcluirData({ ...concluirData, completed_at: e.target.value, checkout_at: e.target.value })}
                  className="input"
                />
              </div>

              <div className="space-y-4">
                <label className="label">Quem está recebendo? (Assinante)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setConcluirData({ ...concluirData, signer_name: order.clients?.responsible_name || '' })}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg text-xs font-medium transition-colors border border-gray-200"
                  >
                    👤 Cliente: {order.clients?.responsible_name || 'N/A'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConcluirData({ ...concluirData, signer_name: order.technician?.full_name || '' })}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg text-xs font-medium transition-colors border border-gray-200"
                  >
                    🛠️ Técnico: {order.technician?.full_name || 'N/A'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nome Completo</label>
                    <input
                      type="text"
                      value={concluirData.signer_name}
                      onChange={(e) => setConcluirData({ ...concluirData, signer_name: e.target.value })}
                      className="input"
                      placeholder="Nome de quem recebeu..."
                    />
                  </div>
                  <div>
                    <label className="label">Doc / CPF do Responsável</label>
                    <input
                      type="text"
                      value={concluirData.signer_doc}
                      onChange={(e) => setConcluirData({ ...concluirData, signer_doc: e.target.value })}
                      className="input"
                      placeholder="Documento..."
                    />
                  </div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl text-xs text-emerald-800 border border-emerald-100 italic">
                  Informar os horários corretos é essencial para o cálculo preciso de SLA e métricas de desempenho.
                </div>
              </div>
              <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setShowConcluirModal(false)} className="btn btn-secondary px-6">Cancelar</button>
                <button
                  onClick={handleConcluirOS}
                  disabled={processing || !concluirData.checkin_at || !concluirData.completed_at}
                  className="btn btn-success px-8"
                >
                  {processing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  Confirmar Conclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Adicionar Peça/Serviço */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal-content max-w-lg animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b bg-indigo-600 text-white rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package size={24} />
                <h2 className="text-xl font-bold">Adicionar Peça ou Serviço</h2>
              </div>
              <button onClick={() => setShowItemModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button
                  onClick={() => setItemFormData({ ...itemFormData, item_type: 'product', product_id: '', description: '', unit_price: 0 })}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${itemFormData.item_type === 'product' ? 'bg-white dark:bg-gray-700 shadow text-indigo-600' : 'text-gray-500'}`}
                >
                  Peça (Estoque)
                </button>
                <button
                  onClick={() => setItemFormData({ ...itemFormData, item_type: 'service', product_id: '', description: '', unit_price: 0 })}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${itemFormData.item_type === 'service' ? 'bg-white dark:bg-gray-700 shadow text-indigo-600' : 'text-gray-500'}`}
                >
                  Serviço / Diversos
                </button>
              </div>

              {itemFormData.item_type === 'product' ? (
                <div>
                  <label className="label">Selecionar Produto</label>
                  <select
                    className="input"
                    value={itemFormData.product_id}
                    onChange={(e) => {
                      const prod = availableProducts.find(p => p.id === e.target.value);
                      setItemFormData({
                        ...itemFormData,
                        product_id: e.target.value,
                        unit_price: prod?.unit_price || 0,
                        description: prod?.name || ''
                      });
                    }}
                  >
                    <option value="">Selecione um produto...</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Saldo: {p.quantity}) - R$ {p.unit_price.toFixed(2)}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label">Descrição do Serviço</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Mão de obra técnica, Deslocamento..."
                    value={itemFormData.description}
                    onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Quantidade</label>
                  <input
                    type="number"
                    className="input"
                    min="1"
                    value={itemFormData.quantity}
                    onChange={(e) => setItemFormData({ ...itemFormData, quantity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Valor Unitário (R$)</label>
                  <input
                    type="number"
                    className="input"
                    step="0.01"
                    value={itemFormData.unit_price}
                    onChange={(e) => setItemFormData({ ...itemFormData, unit_price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <span className="text-gray-500 text-sm font-medium uppercase tracking-wider">Subtotal:</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  R$ {(itemFormData.quantity * itemFormData.unit_price).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 dark:bg-gray-800/30 flex justify-end gap-3">
              <button
                onClick={() => setShowItemModal(false)}
                className="btn btn-secondary px-6"
              >
                Cancelar
              </button>
              <button
                onClick={addOrderItem}
                disabled={addingItem || (!itemFormData.product_id && !itemFormData.description)}
                className="btn btn-primary px-8"
              >
                {addingItem ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                Confirmar Adição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Assinatura Digital Premium */}
      {showSignatureModal && (
        <div className="modal-overlay" onClick={() => setShowSignatureModal(false)}>
          <div className="modal-content max-w-xl animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <PenTool size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Assinatura Digital Web</h2>
                    <p className="text-white/70 text-xs">Coleta de assinatura diretamente no portal</p>
                  </div>
                </div>
                <button onClick={() => setShowSignatureModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nome Completo do Assinante</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="input"
                    placeholder="Ex: João da Silva"
                  />
                </div>
                <div>
                  <label className="label">Documento (CPF/RG)</label>
                  <input
                    type="text"
                    value={signerDoc}
                    onChange={(e) => setSignerDoc(e.target.value)}
                    className="input"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label">Campo de Assinatura</label>
                  <button onClick={clearCanvas} className="text-xs text-amber-600 hover:text-amber-700 font-bold uppercase tracking-wider">Limpar Campo</button>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 overflow-hidden touch-none group hover:border-amber-400 transition-colors">
                  <canvas
                    ref={canvasRef}
                    width={550}
                    height={250}
                    className="w-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <p className="text-[10px] text-gray-400 text-center italic">Assine dentro da área pontilhada utilizando o mouse ou tela touch</p>
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                <CheckCircle size={18} className="text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Ao assinar este documento, o cliente declara estar ciente e de acordo com os serviços realizados e peças aplicadas descritos nesta Ordem de Serviço.
                </p>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowSignatureModal(false)}
                className="btn btn-secondary px-6"
              >
                Cancelar
              </button>
              <button
                onClick={saveSignature}
                disabled={isSavingSignature || !signerName.trim()}
                className="btn !bg-emerald-600 !text-white hover:!bg-emerald-700 px-8 shadow-lg shadow-emerald-100"
              >
                {isSavingSignature ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                Confirmar e Finalizar OS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
