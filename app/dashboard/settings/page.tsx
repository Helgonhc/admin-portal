'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import {
  Save, Loader2, User, Building2, Bell, Shield, Palette,
  Mail, Phone, MapPin, Camera, Key, Check, Plus, Trash2, List, Upload, Image, Search, RefreshCw, PenTool
} from 'lucide-react';
import toast from 'react-hot-toast';

// Função para buscar CNPJ na BrasilAPI
async function fetchCNPJ(cnpj: string) {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length !== 14) return null;

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Função para buscar CEP na ViaCEP
async function fetchCEP(cep: string) {
  const cleanCEP = cep.replace(/\D/g, '');
  if (cleanCEP.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const { profile, setProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'notifications' | 'checklists' | 'whatsapp'>('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchingCNPJ, setSearchingCNPJ] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    cargo: '',
    avatar_url: '',
    signature_url: '',
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Signature Pad
  const [isDrawingTech, setIsDrawingTech] = useState(false);
  const techCanvasRef = useRef<HTMLCanvasElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  // Company - usando nomes das colunas reais da tabela app_config
  const [companyData, setCompanyData] = useState({
    company_name: '',
    cnpj: '',
    phone: '',
    email: '',
    logo_url: '',
    primary_color: '#4f46e5',
    // Campos de endereço separados (existem na tabela)
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    // Evolution API Settings
    evolution_api_url: 'http://localhost:8080',
    evolution_api_key: '123456',
    evolution_instance_name: 'ChameiApp',
    evolution_webhook_url: '',
  });
  const [configId, setConfigId] = useState<string | null>(null);
  const [searchingCEP, setSearchingCEP] = useState(false);
  const [extractingColor, setExtractingColor] = useState(false);

  // Notifications
  const [notificationSettings, setNotificationSettings] = useState({
    email_new_order: true,
    email_order_completed: true,
    email_new_ticket: true,
    push_enabled: true,
  });

  // Checklists
  const [checklists, setChecklists] = useState<any[]>([]);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<any>(null);
  const [checklistForm, setChecklistForm] = useState({
    name: '',
    description: '',
    items: [''],
  });

  // WhatsApp / Evolution API
  const [waStatus, setWaStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
  const [waQrCode, setWaQrCode] = useState<string | null>(null);

  async function checkWAStatus() {
    if (!companyData.evolution_api_url || !companyData.evolution_api_key || !companyData.evolution_instance_name) return;

    setWaStatus('loading');
    try {
      const response = await fetch(`${companyData.evolution_api_url}/instance/connectionState/${companyData.evolution_instance_name}`, {
        headers: {
          'apikey': companyData.evolution_api_key
        }
      });
      const data = await response.json();
      if (data.instance?.state === 'open') {
        setWaStatus('connected');
        setWaQrCode(null);
      } else {
        setWaStatus('disconnected');
        fetchWAQrCode();
      }
    } catch (error) {
      setWaStatus('disconnected');
    }
  }

  async function fetchWAQrCode() {
    try {
      const response = await fetch(`${companyData.evolution_api_url}/instance/connect/${companyData.evolution_instance_name}`, {
        headers: {
          'apikey': companyData.evolution_api_key
        }
      });
      const data = await response.json();
      if (data.base64) {
        setWaQrCode(data.base64);
      }
    } catch (error) {
      console.error('Erro ao buscar QR Code:', error);
    }
  }

  async function updateWebhook() {
    if (!companyData.evolution_webhook_url) {
      toast.error('Informe a URL do Webhook do n8n');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${companyData.evolution_api_url}/webhook/set/${companyData.evolution_instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': companyData.evolution_api_key
        },
        body: JSON.stringify({
          url: companyData.evolution_webhook_url,
          enabled: true,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "CONTACTS_UPSERT",
            "CONTACTS_UPDATE",
            "PRESENCE_UPDATE",
            "CHATS_UPSERT",
            "CHATS_UPDATE",
            "CHATS_DELETE",
            "GROUPS_UPSERT",
            "GROUPS_UPDATE",
            "GROUP_PARTICIPANTS_UPDATE",
            "CONNECTION_UPDATE",
            "CALL"
          ]
        })
      });

      if (!response.ok) throw new Error('Erro ao configurar webhook na API');

      toast.success('Webhook configurado na Evolution API!');
      saveCompany();
    } catch (error: any) {
      toast.error('Erro ao configurar webhook: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function logoutWA() {
    if (!confirm('Deseja realmente desconectar o WhatsApp?')) return;
    try {
      await fetch(`${companyData.evolution_api_url}/instance/logout/${companyData.evolution_instance_name}`, {
        method: 'DELETE',
        headers: { 'apikey': companyData.evolution_api_key }
      });
      toast.success('WhatsApp desconectado!');
      checkWAStatus();
    } catch (error) {
      toast.error('Erro ao desconectar');
    }
  }

  useEffect(() => {
    if (activeTab === 'whatsapp' && isAdmin) {
      checkWAStatus();
    }
  }, [activeTab]);

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        cpf: profile.cpf || '',
        cargo: profile.cargo || '',
        avatar_url: profile.avatar_url || '',
        signature_url: profile.signature_url || '',
      });
    }
    // Só carregar dados da empresa se for admin
    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
      loadCompanySettings();
      loadChecklists();
    }
  }, [profile]);

  async function loadCompanySettings() {
    const { data } = await supabase
      .from('app_config')
      .select('*')
      .single();

    if (data) {
      setConfigId(data.id);
      setCompanyData({
        company_name: data.company_name || '',
        cnpj: data.cnpj || '',
        phone: data.phone || '',
        email: data.email || '',
        logo_url: data.logo_url || '',
        primary_color: data.primary_color || '#4f46e5',
        zip_code: data.zip_code || '',
        street: data.street || '',
        number: data.number || '',
        complement: data.complement || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
        evolution_api_url: data.evolution_api_url || 'http://localhost:8080',
        evolution_api_key: data.evolution_api_key || '123456',
        evolution_instance_name: data.evolution_instance_name || 'ChameiApp',
        evolution_webhook_url: data.evolution_webhook_url || '',
      });
    }
  }

  // Função para extrair cor da logo automaticamente
  async function extractColorFromLogo() {
    if (!companyData.logo_url) {
      toast.error('Faça upload de uma logo primeiro');
      return;
    }

    setExtractingColor(true);
    try {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas não suportado'));
              return;
            }

            const size = 50;
            canvas.width = size;
            canvas.height = size;
            ctx.drawImage(img, 0, 0, size, size);

            const imageData = ctx.getImageData(0, 0, size, size).data;
            const colorCounts: { [key: string]: number } = {};

            for (let i = 0; i < imageData.length; i += 4) {
              const r = imageData[i];
              const g = imageData[i + 1];
              const b = imageData[i + 2];
              const a = imageData[i + 3];

              if (a < 128) continue;
              const brightness = (r + g + b) / 3;
              if (brightness > 240 || brightness < 15) continue;
              const saturation = Math.max(r, g, b) - Math.min(r, g, b);
              if (saturation < 30) continue;

              const qr = Math.round(r / 32) * 32;
              const qg = Math.round(g / 32) * 32;
              const qb = Math.round(b / 32) * 32;

              const key = `${qr},${qg},${qb}`;
              colorCounts[key] = (colorCounts[key] || 0) + 1;
            }

            let maxCount = 0;
            let dominantColor = null;

            for (const [color, count] of Object.entries(colorCounts)) {
              if (count > maxCount) {
                maxCount = count;
                dominantColor = color;
              }
            }

            if (dominantColor) {
              const [r, g, b] = dominantColor.split(',').map(Number);
              const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              setCompanyData({ ...companyData, primary_color: hex });
              toast.success(`Cor extraída: ${hex}`);
            } else {
              toast.error('Não foi possível extrair uma cor dominante');
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = companyData.logo_url;
      });
    } catch (error) {
      toast.error('Erro ao extrair cor da logo');
    } finally {
      setExtractingColor(false);
    }
  }

  async function loadChecklists() {
    const { data } = await supabase
      .from('checklist_models')
      .select('*, checklist_model_items(id, item_description)')
      .order('name');
    setChecklists(data || []);
  }

  // Busca automática de CNPJ
  async function handleCNPJSearch() {
    const cnpjClean = companyData.cnpj.replace(/\D/g, '');
    if (cnpjClean.length !== 14) {
      toast.error('Digite um CNPJ válido com 14 dígitos');
      return;
    }

    setSearchingCNPJ(true);
    try {
      const data = await fetchCNPJ(cnpjClean);
      if (data) {
        setCompanyData({
          ...companyData,
          company_name: data.razao_social || data.nome_fantasia || companyData.company_name,
          phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}` : companyData.phone,
          email: data.email || companyData.email,
          zip_code: data.cep || companyData.zip_code,
          street: data.logradouro || companyData.street,
          number: data.numero || companyData.number,
          complement: data.complemento || companyData.complement,
          neighborhood: data.bairro || companyData.neighborhood,
          city: data.municipio || companyData.city,
          state: data.uf || companyData.state,
        });
        toast.success('Dados do CNPJ carregados!');
      } else {
        toast.error('CNPJ não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao buscar CNPJ');
    } finally {
      setSearchingCNPJ(false);
    }
  }

  // Busca automática de CEP
  async function handleCEPSearch() {
    const cepClean = companyData.zip_code.replace(/\D/g, '');
    if (cepClean.length !== 8) {
      toast.error('Digite um CEP válido com 8 dígitos');
      return;
    }

    setSearchingCEP(true);
    try {
      const data = await fetchCEP(cepClean);
      if (data) {
        setCompanyData({
          ...companyData,
          street: data.logradouro || companyData.street,
          neighborhood: data.bairro || companyData.neighborhood,
          city: data.localidade || companyData.city,
          state: data.uf || companyData.state,
        });
        toast.success('Endereço carregado!');
      } else {
        toast.error('CEP não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    } finally {
      setSearchingCEP(false);
    }
  }

  // Upload de foto de perfil do usuário
  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${profile?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('os-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('os-photos')
        .getPublicUrl(filePath);

      setProfileData({ ...profileData, avatar_url: publicUrl });
      toast.success('Foto enviada com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao enviar foto: ' + error.message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          cpf: profileData.cpf,
          cargo: profileData.cargo,
          avatar_url: profileData.avatar_url,
          signature_url: profileData.signature_url,
        })
        .eq('id', profile?.id);

      if (error) throw error;

      setProfile({ ...profile!, ...profileData });
      toast.success('Perfil atualizado!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Funções de Assinatura do Técnico
  const startDrawingTech = (e: any) => {
    const canvas = techCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawingTech(true);
  };

  const drawTech = (e: any) => {
    if (!isDrawingTech) return;
    const canvas = techCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawingTech = () => {
    setIsDrawingTech(false);
  };

  const clearCanvasTech = () => {
    const canvas = techCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  async function handleSignatureUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    setUploadingSignature(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `sig-${profile?.id}-${Date.now()}.${fileExt}`;
      const filePath = `technician-signatures/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('os-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('os-photos').getPublicUrl(filePath);
      setProfileData({ ...profileData, signature_url: publicUrl });
      toast.success('Assinatura enviada!');
    } catch (error: any) {
      toast.error('Erro ao enviar assinatura: ' + error.message);
    } finally {
      setUploadingSignature(false);
    }
  }

  async function saveManualSignature() {
    const canvas = techCanvasRef.current;
    if (!canvas) return;

    setUploadingSignature(true);
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });

      const fileName = `sig-${profile?.id}-${Date.now()}.png`;
      const filePath = `technician-signatures/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('os-photos')
        .upload(filePath, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('os-photos').getPublicUrl(filePath);
      setProfileData({ ...profileData, signature_url: publicUrl });
      toast.success('Assinatura capturada!');
    } catch (error: any) {
      toast.error('Erro ao salvar assinatura: ' + error.message);
    } finally {
      setUploadingSignature(false);
    }
  }

  async function saveCompany() {
    setSaving(true);
    try {
      if (configId) {
        // Atualizar registro existente usando o ID salvo
        const { error } = await supabase
          .from('app_config')
          .update(companyData)
          .eq('id', configId);

        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('app_config')
          .insert(companyData);

        if (error) throw error;
      }

      toast.success('Configurações da empresa salvas!');

      // Recarregar a página para atualizar o sidebar
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Upload de logo da empresa
  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `company-logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('os-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('os-photos')
        .getPublicUrl(filePath);

      setCompanyData({ ...companyData, logo_url: publicUrl });
      toast.success('Logo enviada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  }

  function openChecklistModal(checklist?: any) {
    if (checklist) {
      setEditingChecklist(checklist);
      setChecklistForm({
        name: checklist.name,
        description: checklist.description || '',
        items: checklist.checklist_model_items?.map((i: any) => i.item_description) || [''],
      });
    } else {
      setEditingChecklist(null);
      setChecklistForm({ name: '', description: '', items: [''] });
    }
    setShowChecklistModal(true);
  }

  function addChecklistItem() {
    setChecklistForm({ ...checklistForm, items: [...checklistForm.items, ''] });
  }

  function removeChecklistItem(index: number) {
    setChecklistForm({
      ...checklistForm,
      items: checklistForm.items.filter((_, i) => i !== index),
    });
  }

  function updateChecklistItem(index: number, value: string) {
    const newItems = [...checklistForm.items];
    newItems[index] = value;
    setChecklistForm({ ...checklistForm, items: newItems });
  }

  async function saveChecklist() {
    if (!checklistForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const validItems = checklistForm.items.filter(i => i.trim());
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    setSaving(true);
    try {
      if (editingChecklist) {
        await supabase
          .from('checklist_models')
          .update({ name: checklistForm.name, description: checklistForm.description })
          .eq('id', editingChecklist.id);

        await supabase
          .from('checklist_model_items')
          .delete()
          .eq('model_id', editingChecklist.id);

        await supabase
          .from('checklist_model_items')
          .insert(validItems.map(item => ({
            model_id: editingChecklist.id,
            item_description: item,
          })));

        toast.success('Checklist atualizado!');
      } else {
        const { data: newModel, error } = await supabase
          .from('checklist_models')
          .insert([{ name: checklistForm.name, description: checklistForm.description }])
          .select()
          .single();

        if (error) throw error;

        await supabase
          .from('checklist_model_items')
          .insert(validItems.map(item => ({
            model_id: newModel.id,
            item_description: item,
          })));

        toast.success('Checklist criado!');
      }

      setShowChecklistModal(false);
      loadChecklists();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteChecklist(id: string) {
    if (!confirm('Excluir este modelo de checklist?')) return;

    try {
      await supabase.from('checklist_model_items').delete().eq('model_id', id);
      await supabase.from('checklist_models').delete().eq('id', id);
      toast.success('Checklist excluído!');
      loadChecklists();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500">Gerencie seu perfil e preferências</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'profile', icon: User, label: 'Meu Perfil' },
          { id: 'company', icon: Building2, label: 'Empresa', adminOnly: true },
          { id: 'checklists', icon: List, label: 'Checklists', adminOnly: true },
          { id: 'whatsapp', icon: Phone, label: 'WhatsApp', adminOnly: true },
        ].filter(tab => !tab.adminOnly || isAdmin).map((tab) => (
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

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">👤 Meu Perfil</h3>
          <div className="space-y-4">
            {/* Foto de Perfil */}
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {profileData.avatar_url ? (
                    <img
                      src={profileData.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="text-gray-400" size={32} />
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="btn btn-secondary mb-1"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Camera size={18} />
                  )}
                  {uploadingAvatar ? 'Enviando...' : 'Alterar Foto'}
                </button>
                <p className="text-xs text-gray-500">JPG, PNG. Máximo 2MB.</p>
                {profileData.avatar_url && (
                  <button
                    onClick={() => setProfileData({ ...profileData, avatar_url: '' })}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nome Completo</label>
                <input
                  type="text"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="input bg-gray-50"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Telefone</label>
                <input
                  type="text"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="input"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="label">CPF</label>
                <input
                  type="text"
                  value={profileData.cpf}
                  onChange={(e) => setProfileData({ ...profileData, cpf: e.target.value })}
                  className="input"
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            {/* Assinatura Digital */}
            <div className="pt-6 border-t">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-700 flex items-center gap-2">
                  <PenTool size={18} className="text-amber-500" />
                  Assinatura Digital
                </h4>
                {profileData.signature_url && (
                  <button
                    onClick={() => setProfileData({ ...profileData, signature_url: '' })}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Remover Assinatura
                  </button>
                )}
              </div>

              {profileData.signature_url ? (
                <div className="bg-gray-50 border rounded-xl p-4 flex flex-col items-center">
                  <img
                    src={profileData.signature_url}
                    alt="Sua Assinatura"
                    className="max-h-24 object-contain mb-2"
                  />
                  <p className="text-[10px] text-gray-400">Esta assinatura será utilizada em todos os seus relatórios</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        const canvas = techCanvasRef.current;
                        if (canvas) {
                          // Toggle or just ensuring it's visible? 
                          // I'll just show the pad below
                        }
                      }}
                      className="btn btn-secondary w-full py-4 border-dashed border-2 flex flex-col gap-1 items-center justify-center h-auto"
                      type="button"
                    >
                      <PenTool size={24} className="text-gray-400" />
                      <span className="text-sm">Assinar Manualmente</span>
                    </button>

                    <button
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={uploadingSignature}
                      className="btn btn-secondary w-full py-4 border-dashed border-2 flex flex-col gap-1 items-center justify-center h-auto"
                      type="button"
                    >
                      {uploadingSignature ? <Loader2 className="animate-spin" size={24} /> : <Upload size={24} className="text-gray-400" />}
                      <span className="text-sm">Fazer Upload de Imagem</span>
                    </button>
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="bg-white border rounded-2xl overflow-hidden touch-none">
                    <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 uppercase">Pad de Assinatura</span>
                      <button onClick={clearCanvasTech} className="text-[10px] text-amber-600 font-bold uppercase">Limpar</button>
                    </div>
                    <canvas
                      ref={techCanvasRef}
                      width={600}
                      height={200}
                      className="w-full cursor-crosshair"
                      onMouseDown={startDrawingTech}
                      onMouseMove={drawTech}
                      onMouseUp={stopDrawingTech}
                      onMouseOut={stopDrawingTech}
                      onTouchStart={startDrawingTech}
                      onTouchMove={drawTech}
                      onTouchEnd={stopDrawingTech}
                    />
                    <div className="p-3 bg-gray-50 border-t flex justify-end">
                      <button
                        onClick={saveManualSignature}
                        disabled={uploadingSignature}
                        className="btn btn-primary btn-sm gap-2"
                      >
                        {uploadingSignature ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={saveProfile} disabled={saving} className="btn btn-primary w-full py-3 shadow-lg shadow-indigo-100 mt-4">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Todas as Alterações
            </button>
          </div>
        </div>
      )
      }

      {/* Company Tab */}
      {
        activeTab === 'company' && isAdmin && (
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">🏢 Dados da Empresa</h3>
            <div className="space-y-4">
              {/* Upload de Logo */}
              <div>
                <label className="label">Logo da Empresa</label>
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden bg-gray-50">
                    {companyData.logo_url ? (
                      <img
                        src={companyData.logo_url}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Image className="text-gray-400" size={32} />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="btn btn-secondary mb-2"
                    >
                      {uploading ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <Upload size={18} />
                      )}
                      {uploading ? 'Enviando...' : 'Fazer Upload'}
                    </button>
                    <p className="text-xs text-gray-500">
                      PNG, JPG ou GIF. Máximo 2MB.<br />
                      A logo aparecerá no menu lateral do portal.
                    </p>
                    {companyData.logo_url && (
                      <button
                        onClick={() => setCompanyData({ ...companyData, logo_url: '' })}
                        className="text-xs text-red-600 hover:underline mt-1"
                      >
                        Remover logo
                      </button>
                    )}
                  </div>
                </div>
                {/* Campo de URL manual */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500">Ou cole a URL da imagem:</label>
                  <input
                    type="text"
                    value={companyData.logo_url}
                    onChange={(e) => setCompanyData({ ...companyData, logo_url: e.target.value })}
                    className="input mt-1"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Cor Principal da Empresa */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Palette size={18} />
                  Cor Principal
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  A cor principal será usada em botões, menus e destaques do portal.
                  Você pode extrair automaticamente da logo ou escolher manualmente.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={companyData.primary_color}
                      onChange={(e) => setCompanyData({ ...companyData, primary_color: e.target.value })}
                      className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                    />
                    <div>
                      <input
                        type="text"
                        value={companyData.primary_color}
                        onChange={(e) => setCompanyData({ ...companyData, primary_color: e.target.value })}
                        className="input w-28 text-center font-mono text-sm"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  <button
                    onClick={extractColorFromLogo}
                    disabled={extractingColor || !companyData.logo_url}
                    className="btn btn-secondary"
                    title="Extrair cor dominante da logo automaticamente"
                  >
                    {extractingColor ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Palette size={18} />
                    )}
                    Extrair da Logo
                  </button>
                </div>
                {/* Preview da cor */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Preview:</span>
                  <div
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: companyData.primary_color }}
                  >
                    Botão Exemplo
                  </div>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${companyData.primary_color}20`,
                      color: companyData.primary_color
                    }}
                  >
                    Badge Exemplo
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">CNPJ</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={companyData.cnpj}
                      onChange={(e) => setCompanyData({ ...companyData, cnpj: e.target.value })}
                      className="input flex-1"
                      placeholder="00.000.000/0000-00"
                    />
                    <button
                      onClick={handleCNPJSearch}
                      disabled={searchingCNPJ}
                      className="btn btn-secondary whitespace-nowrap"
                      title="Buscar dados do CNPJ"
                    >
                      {searchingCNPJ ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <Search size={18} />
                      )}
                      Buscar
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Digite o CNPJ e clique em Buscar para preencher automaticamente</p>
                </div>
                <div>
                  <label className="label">Nome da Empresa</label>
                  <input
                    type="text"
                    value={companyData.company_name}
                    onChange={(e) => setCompanyData({ ...companyData, company_name: e.target.value })}
                    className="input"
                    placeholder="Nome que aparecerá no menu lateral"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Telefone</label>
                  <input
                    type="text"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">E-mail</label>
                  <input
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              {/* Endereço com busca por CEP */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <MapPin size={18} />
                  Endereço
                </h4>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="label">CEP</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={companyData.zip_code}
                        onChange={(e) => setCompanyData({ ...companyData, zip_code: e.target.value })}
                        className="input flex-1"
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      <button
                        onClick={handleCEPSearch}
                        disabled={searchingCEP}
                        className="btn btn-secondary whitespace-nowrap"
                        title="Buscar endereço pelo CEP"
                      >
                        {searchingCEP ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <Search size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Rua/Logradouro</label>
                    <input
                      type="text"
                      value={companyData.street}
                      onChange={(e) => setCompanyData({ ...companyData, street: e.target.value })}
                      className="input"
                      placeholder="Nome da rua"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="label">Número</label>
                    <input
                      type="text"
                      value={companyData.number}
                      onChange={(e) => setCompanyData({ ...companyData, number: e.target.value })}
                      className="input"
                      placeholder="123"
                    />
                  </div>
                  <div>
                    <label className="label">Complemento</label>
                    <input
                      type="text"
                      value={companyData.complement}
                      onChange={(e) => setCompanyData({ ...companyData, complement: e.target.value })}
                      className="input"
                      placeholder="Sala, Apto..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Bairro</label>
                    <input
                      type="text"
                      value={companyData.neighborhood}
                      onChange={(e) => setCompanyData({ ...companyData, neighborhood: e.target.value })}
                      className="input"
                      placeholder="Nome do bairro"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="label">Cidade</label>
                    <input
                      type="text"
                      value={companyData.city}
                      onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })}
                      className="input"
                      placeholder="Nome da cidade"
                    />
                  </div>
                  <div>
                    <label className="label">Estado</label>
                    <select
                      value={companyData.state}
                      onChange={(e) => setCompanyData({ ...companyData, state: e.target.value })}
                      className="input"
                    >
                      <option value="">Selecione</option>
                      <option value="AC">AC</option>
                      <option value="AL">AL</option>
                      <option value="AP">AP</option>
                      <option value="AM">AM</option>
                      <option value="BA">BA</option>
                      <option value="CE">CE</option>
                      <option value="DF">DF</option>
                      <option value="ES">ES</option>
                      <option value="GO">GO</option>
                      <option value="MA">MA</option>
                      <option value="MT">MT</option>
                      <option value="MS">MS</option>
                      <option value="MG">MG</option>
                      <option value="PA">PA</option>
                      <option value="PB">PB</option>
                      <option value="PR">PR</option>
                      <option value="PE">PE</option>
                      <option value="PI">PI</option>
                      <option value="RJ">RJ</option>
                      <option value="RN">RN</option>
                      <option value="RS">RS</option>
                      <option value="RO">RO</option>
                      <option value="RR">RR</option>
                      <option value="SC">SC</option>
                      <option value="SP">SP</option>
                      <option value="SE">SE</option>
                      <option value="TO">TO</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm text-indigo-800">
                  💡 O nome e logo da empresa aparecerão no menu lateral do portal, substituindo "Portal Admin".
                </p>
              </div>
              <button onClick={saveCompany} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar Configurações
              </button>
            </div>
          </div>
        )
      }

      {/* Checklists Tab */}
      {
        activeTab === 'checklists' && isAdmin && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">📋 Modelos de Checklist</h3>
              <button onClick={() => openChecklistModal()} className="btn btn-primary">
                <Plus size={18} /> Novo Checklist
              </button>
            </div>

            {checklists.length === 0 ? (
              <div className="card text-center py-8 text-gray-500">
                <List size={48} className="mx-auto mb-2 opacity-50" />
                <p>Nenhum modelo de checklist cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {checklists.map((checklist) => (
                  <div key={checklist.id} className="card">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-800">{checklist.name}</h4>
                        {checklist.description && (
                          <p className="text-sm text-gray-500">{checklist.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {checklist.checklist_model_items?.length || 0} itens
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openChecklistModal(checklist)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                          <User size={18} />
                        </button>
                        <button
                          onClick={() => deleteChecklist(checklist.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    {checklist.checklist_model_items?.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <ul className="text-sm text-gray-600 space-y-1">
                          {checklist.checklist_model_items.slice(0, 5).map((item: any) => (
                            <li key={item.id} className="flex items-center gap-2">
                              <Check size={14} className="text-emerald-500" />
                              {item.item_description}
                            </li>
                          ))}
                          {checklist.checklist_model_items.length > 5 && (
                            <li className="text-gray-400">
                              +{checklist.checklist_model_items.length - 5} mais...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }

      {/* WhatsApp Tab */}
      {
        activeTab === 'whatsapp' && isAdmin && (
          <div className="card space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Phone size={18} className="text-emerald-500" />
                  Integração WhatsApp
                </h3>
                <p className="text-sm text-gray-500">Conecte sua conta para abrir chamados automaticamente</p>
              </div>
              <div className="flex items-center gap-2">
                {waStatus === 'connected' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    CONECTADO
                  </span>
                ) : waStatus === 'loading' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                    <Loader2 size={12} className="animate-spin" />
                    VERIFICANDO...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                    DESCONECTADO
                  </span>
                )}
                <button
                  onClick={checkWAStatus}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                  title="Atualizar Status"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Configurações da API */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Configurações da Evolution API</h4>

                <div className="space-y-3">
                  <div>
                    <label className="label text-xs uppercase text-gray-500 font-bold">URL da API</label>
                    <input
                      type="text"
                      value={companyData.evolution_api_url}
                      onChange={(e) => setCompanyData({ ...companyData, evolution_api_url: e.target.value })}
                      className="input font-mono text-sm"
                      placeholder="http://localhost:8080"
                    />
                  </div>
                  <div>
                    <label className="label text-xs uppercase text-gray-500 font-bold">API KEY</label>
                    <input
                      type="password"
                      value={companyData.evolution_api_key}
                      onChange={(e) => setCompanyData({ ...companyData, evolution_api_key: e.target.value })}
                      className="input font-mono text-sm"
                      placeholder="Sua chave secreta"
                    />
                  </div>
                  <div>
                    <label className="label text-xs uppercase text-gray-500 font-bold">Nome da Instância</label>
                    <input
                      type="text"
                      value={companyData.evolution_instance_name}
                      onChange={(e) => setCompanyData({ ...companyData, evolution_instance_name: e.target.value })}
                      className="input font-mono text-sm"
                      placeholder="Ex: ChameiApp"
                    />
                  </div>
                  <div>
                    <label className="label text-xs uppercase text-gray-500 font-bold">Webhook URL (n8n)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={companyData.evolution_webhook_url}
                        onChange={(e) => setCompanyData({ ...companyData, evolution_webhook_url: e.target.value })}
                        className="input font-mono text-sm flex-1"
                        placeholder="http://n8n:5678/webhook/..."
                      />
                      <button
                        onClick={updateWebhook}
                        disabled={saving}
                        className="btn btn-secondary px-3"
                        title="Sincronizar Webhook"
                      >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={saveCompany} disabled={saving} className="btn btn-primary w-full">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Configurações API
                </button>
              </div>

              {/* Status de Conexão / QR Code */}
              <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-8 border-2 border-dashed border-gray-200">
                {waStatus === 'connected' ? (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Check size={40} className="text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">WhatsApp Conectado!</h4>
                      <p className="text-sm text-gray-500">O sistema está pronto para receber e responder mensagens.</p>
                    </div>
                    <button
                      onClick={logoutWA}
                      className="text-sm text-red-600 font-bold hover:underline py-2"
                    >
                      Desconectar conta atual
                    </button>
                  </div>
                ) : waQrCode ? (
                  <div className="text-center space-y-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg inline-block border-4 border-indigo-600">
                      <img src={waQrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">Escaneie o QR Code</h4>
                      <p className="text-sm text-gray-500">Abra o WhatsApp no seu celular {'>'} Aparelhos Conectados</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto opacity-50">
                      <Phone size={40} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">Não foi possível carregar o status ou QR Code.</p>
                    <button onClick={checkWAStatus} className="btn btn-secondary btn-sm">
                      Tentar Novamente
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Checklist Modal */}
      {
        showChecklistModal && (
          <div className="modal-overlay" onClick={() => setShowChecklistModal(false)}>
            <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingChecklist ? 'Editar Checklist' : 'Novo Checklist'}
                </h2>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="label">Nome *</label>
                  <input
                    type="text"
                    value={checklistForm.name}
                    onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })}
                    className="input"
                    placeholder="Ex: Checklist de Manutenção Preventiva"
                  />
                </div>
                <div>
                  <label className="label">Descrição</label>
                  <input
                    type="text"
                    value={checklistForm.description}
                    onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
                    className="input"
                    placeholder="Descrição opcional"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Itens do Checklist</label>
                    <button onClick={addChecklistItem} className="text-sm text-indigo-600 hover:underline">
                      + Adicionar item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {checklistForm.items.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateChecklistItem(index, e.target.value)}
                          className="input flex-1"
                          placeholder={`Item ${index + 1}`}
                        />
                        {checklistForm.items.length > 1 && (
                          <button
                            onClick={() => removeChecklistItem(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setShowChecklistModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button onClick={saveChecklist} disabled={saving} className="btn btn-primary">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
