'use client';

import { useState, useEffect } from 'react';
import { supabase, Client } from '../../../lib/supabase';
import { 
  Plus, Search, Edit, Trash2, Eye, Loader2, Building2, 
  Globe, Lock, Users, MessageCircle, Phone, Mail, MapPin,
  Navigation, Unlock, UserPlus, Upload, Image, X, Shield
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

export default function ClientsPage() {
  const { can, isAdmin } = usePermissions();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Verificar permissão de acesso
  const canViewClients = can('can_view_all_clients');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  
  // Form data completo igual ao app
  const [formData, setFormData] = useState({
    type: 'PJ' as 'PF' | 'PJ',
    name: '',
    cnpj_cpf: '',
    ie_rg: '',
    responsible_name: '',
    email: '',
    phone: '',
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    client_logo_url: '',
  });
  
  // Loading states para busca automática
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  
  // Upload de logo
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Modal de Portal
  const [portalModalVisible, setPortalModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('Portal@123');
  const [creatingPortal, setCreatingPortal] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }

  // Upload de logo do cliente
  async function handleLogoUpload(file: File) {
    if (!file) return;
    
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }
    
    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 2MB');
      return;
    }
    
    setUploadingLogo(true);
    
    try {
      // Gerar nome único
      const fileExt = file.name.split('.').pop();
      const fileName = `client-logos/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Upload para Supabase Storage
      const { data, error } = await supabase.storage
        .from('os-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Pegar URL pública
      const { data: urlData } = supabase.storage
        .from('os-photos')
        .getPublicUrl(fileName);
      
      setFormData(prev => ({ ...prev, client_logo_url: urlData.publicUrl }));
      toast.success('Logo enviada com sucesso!');
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar logo: ' + error.message);
    } finally {
      setUploadingLogo(false);
    }
  }
  
  // Handlers de drag and drop
  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }
  
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoUpload(e.dataTransfer.files[0]);
    }
  }
  
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleLogoUpload(e.target.files[0]);
    }
  }
  
  function removeLogo() {
    setFormData(prev => ({ ...prev, client_logo_url: '' }));
  }

  // Busca automática de CNPJ (BrasilAPI)
  async function handleCnpjBlur() {
    if (formData.type === 'PF') return;
    
    const cleanDoc = formData.cnpj_cpf.replace(/\D/g, '');
    if (cleanDoc.length !== 14) return;

    setCnpjLoading(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanDoc}`);
      const data = await response.json();

      if (!data.message) {
        setFormData(prev => ({
          ...prev,
          name: data.razao_social || prev.name,
          phone: data.ddd_telefone_1 ? `${data.ddd_telefone_1}` : prev.phone,
          email: data.email || prev.email,
          zip_code: data.cep || prev.zip_code,
          street: data.logradouro || prev.street,
          number: data.numero || prev.number,
          complement: data.complemento || prev.complement,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.municipio || prev.city,
          state: data.uf || prev.state,
        }));
        toast.success(`Dados de ${data.nome_fantasia || data.razao_social} carregados!`);
      }
    } catch (e) {
      console.log('Erro ao buscar CNPJ:', e);
    } finally {
      setCnpjLoading(false);
    }
  }

  // Busca automática de CEP (ViaCEP)
  async function handleCepBlur() {
    const cleanCep = formData.zip_code.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
        toast.success('Endereço carregado!');
      }
    } catch (e) {
      console.log('Erro ao buscar CEP:', e);
    } finally {
      setCepLoading(false);
    }
  }

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.email?.toLowerCase().includes(search.toLowerCase()) ||
    client.cnpj_cpf?.includes(search)
  );

  function openModal(client?: any) {
    if (client) {
      setEditingClient(client);
      setFormData({
        type: client.type || 'PJ',
        name: client.name || '',
        cnpj_cpf: client.cnpj_cpf || '',
        ie_rg: client.ie_rg || '',
        responsible_name: client.responsible_name || '',
        email: client.email || '',
        phone: client.phone || '',
        zip_code: client.zip_code || '',
        street: client.street || '',
        number: client.number || '',
        complement: client.complement || '',
        neighborhood: client.neighborhood || '',
        city: client.city || '',
        state: client.state || '',
        client_logo_url: client.client_logo_url || '',
      });
    } else {
      setEditingClient(null);
      setFormData({
        type: 'PJ',
        name: '',
        cnpj_cpf: '',
        ie_rg: '',
        responsible_name: '',
        email: '',
        phone: '',
        zip_code: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        client_logo_url: '',
      });
    }
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const fullAddress = `${formData.street}, ${formData.number} - ${formData.neighborhood}, ${formData.city}/${formData.state} ${formData.zip_code ? `- CEP ${formData.zip_code}` : ''}`;
      
      const payload = {
        ...formData,
        address: fullAddress,
        is_active: true,
      };

      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', editingClient.id);
        if (error) throw error;
        toast.success('Cliente atualizado!');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([payload]);
        if (error) throw error;
        toast.success('Cliente criado!');
      }
      setShowModal(false);
      loadClients();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(client: any) {
    if (!confirm(`⚠️ EXCLUIR CLIENTE\n\nTem certeza que deseja excluir "${client.name}"?\n\nEsta ação irá:\n• Excluir TODOS os dados do cliente\n• Excluir acesso ao portal (se tiver)\n• Excluir equipamentos, OS e chamados\n• Esta ação é IRREVERSÍVEL!`)) return;

    try {
      // Buscar usuários do portal associados ao cliente
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('client_id', client.id);

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);
      if (error) throw error;
      
      toast.success('Cliente excluído!');
      loadClients();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  // Abrir WhatsApp
  function handleWhatsApp(client: any, messageType: 'caminho' | 'cheguei' | 'concluido' | 'vazio') {
    if (!client.phone) {
      toast.error('Telefone não cadastrado');
      return;
    }

    let message = '';
    const nomeContato = client.responsible_name || client.name;

    if (messageType === 'caminho') {
      message = `Olá ${nomeContato}, tudo bem? Estou a caminho aí da ${client.name} para realizar o atendimento.`;
    } else if (messageType === 'cheguei') {
      message = `Olá ${nomeContato}, já cheguei no local e estou aguardando.`;
    } else if (messageType === 'concluido') {
      message = `Olá ${nomeContato}. Passando para informar que o serviço técnico foi concluído com sucesso! Qualquer dúvida, estamos à disposição.`;
    }

    let cleanNumber = client.phone.replace(/\D/g, '');
    if (cleanNumber.length <= 11) cleanNumber = '55' + cleanNumber;

    const url = `https://wa.me/${cleanNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    window.open(url, '_blank');
  }

  // Abrir GPS/Mapa
  function handleOpenMap(address: string) {
    if (!address) {
      toast.error('Endereço não cadastrado');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  }

  // Abrir modal de portal
  async function handleOpenPortalModal(client: any) {
    // Verificar se já tem usuário do portal
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('client_id', client.id)
      .eq('role', 'client')
      .maybeSingle();

    if (existingProfile) {
      toast.success(`Este cliente já possui acesso ao portal.\n\nEmail: ${existingProfile.email}`);
      return;
    }

    setSelectedClient(client);
    setPortalEmail(client.email || '');
    setPortalPassword('Portal@123');
    setPortalModalVisible(true);
  }

  // Criar acesso ao portal
  async function handleCreatePortalAccess() {
    if (!portalEmail.trim()) {
      toast.error('Email é obrigatório');
      return;
    }

    if (!portalPassword.trim() || portalPassword.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setCreatingPortal(true);

    try {
      // 1. Criar usuário usando signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: portalEmail,
        password: portalPassword,
        options: {
          data: {
            full_name: selectedClient.responsible_name || selectedClient.name,
            role: 'client'
          }
        }
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Usuário não foi criado');

      // 2. Aguardar um pouco para o auth processar
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. CRIAR profile diretamente (UPSERT - cria ou atualiza)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: portalEmail,
          full_name: selectedClient.responsible_name || selectedClient.name,
          role: 'client',
          client_id: selectedClient.id,
          phone: selectedClient.phone || null,
          is_active: true,
          created_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('Erro ao criar profile:', profileError);
        throw new Error('Erro ao criar perfil: ' + profileError.message);
      }

      // 4. Atualizar cliente com portal liberado
      await supabase
        .from('clients')
        .update({ 
          email: portalEmail,
          portal_enabled: true,
          portal_blocked: false
        })
        .eq('id', selectedClient.id);

      setPortalModalVisible(false);
      toast.success(`✅ Portal Habilitado!\n\nEmail: ${portalEmail}\nSenha: ${portalPassword}\n\nInforme estas credenciais ao cliente.`);
      loadClients();
    } catch (error: any) {
      console.error('Erro ao criar acesso ao portal:', error);
      toast.error(`Erro ao criar acesso: ${error.message}`);
    } finally {
      setCreatingPortal(false);
    }
  }

  // Bloquear/Desbloquear portal
  async function handleTogglePortalBlock(client: any) {
    const isBlocked = client.portal_blocked || false;
    
    if (!confirm(isBlocked 
      ? `Deseja DESBLOQUEAR o acesso ao portal para ${client.name}?\n\nO cliente poderá fazer login novamente.`
      : `Deseja BLOQUEAR o acesso ao portal para ${client.name}?\n\nO cliente não conseguirá fazer login até ser desbloqueado.`
    )) return;

    try {
      if (isBlocked) {
        const { error } = await supabase
          .from('clients')
          .update({
            portal_blocked: false,
            portal_blocked_reason: null,
            portal_blocked_at: null
          })
          .eq('id', client.id);

        if (error) throw error;
        toast.success(`${client.name} pode acessar o portal novamente.`);
      } else {
        const { error } = await supabase
          .from('clients')
          .update({
            portal_blocked: true,
            portal_blocked_reason: 'Bloqueado pelo administrador',
            portal_blocked_at: new Date().toISOString()
          })
          .eq('id', client.id);

        if (error) throw error;
        toast.success(`${client.name} foi bloqueado do portal.`);
      }

      loadClients();
    } catch (error: any) {
      console.error('Erro ao alterar bloqueio:', error);
      toast.error('Não foi possível alterar o bloqueio.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Verificar permissão de acesso à página
  if (!canViewClients) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Shield className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-600">Acesso Restrito</h2>
        <p className="text-gray-500 mt-2">Você não tem permissão para acessar esta página.</p>
        <p className="text-sm text-gray-400 mt-1">Entre em contato com um administrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Carteira de Clientes</h1>
          <p className="text-sm text-gray-500">{clients.length} clientes cadastrados</p>
        </div>
        {can('can_create_clients') && (
          <button onClick={() => openModal()} className="btn btn-primary w-full sm:w-auto">
            <Plus size={18} />
            <span>Novo Cliente</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        <input
          type="text"
          placeholder="Buscar nome, email ou documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input input-with-icon text-sm"
        />
      </div>

      {/* Cards Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filteredClients.length === 0 ? (
          <div className="col-span-full text-center py-8 sm:py-12 text-gray-500">
            <Building2 className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" />
            <p className="text-base sm:text-lg">Nenhum cliente encontrado</p>
          </div>
        ) : (
          filteredClients.map((client) => (
            <div key={client.id} className="card hover:shadow-lg transition-shadow">
              {/* Header do Card */}
              <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                {client.client_logo_url ? (
                  <img 
                    src={client.client_logo_url} 
                    alt={client.name} 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-indigo-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg flex-shrink-0">
                    {client.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate text-sm sm:text-base">{client.name}</h3>
                  {client.responsible_name && (
                    <p className="text-xs sm:text-sm text-gray-500 truncate">Resp: {client.responsible_name}</p>
                  )}
                  {client.cnpj_cpf && (
                    <p className="text-[10px] sm:text-xs text-gray-400 truncate">{client.cnpj_cpf}</p>
                  )}
                </div>
                <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
                  {can('can_edit_clients') && (
                    <button onClick={() => openModal(client)} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded text-gray-500">
                      <Edit size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  )}
                  {can('can_delete_clients') && (
                    <button onClick={() => handleDelete(client)} className="p-1 sm:p-1.5 hover:bg-red-50 rounded text-red-500">
                      <Trash2 size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Informações de Contato */}
              <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 text-xs sm:text-sm">
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 sm:gap-2 text-indigo-600 hover:underline">
                    <Phone size={12} className="sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                    <span className="truncate">{client.phone}</span>
                  </a>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-indigo-600">
                    <Mail size={12} className="sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </a>
                )}
                {client.address && (
                  <button 
                    onClick={() => handleOpenMap(client.address)}
                    className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-rose-600 text-left w-full"
                  >
                    <MapPin size={12} className="sm:w-3.5 sm:h-3.5 text-rose-500 flex-shrink-0" />
                    <span className="truncate flex-1">{client.address}</span>
                    <Navigation size={10} className="sm:w-3 sm:h-3 text-rose-500 flex-shrink-0" />
                  </button>
                )}
              </div>

              {/* Botões de Ação Rápida */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                <div className="relative group">
                  <button 
                    onClick={() => handleWhatsApp(client, 'vazio')}
                    className="w-full py-1.5 sm:py-2 px-1 sm:px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-sm font-medium"
                  >
                    <MessageCircle size={12} className="sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">WhatsApp</span>
                    <span className="xs:hidden">Zap</span>
                  </button>
                  {/* Dropdown de mensagens */}
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[140px]">
                    <button onClick={() => handleWhatsApp(client, 'caminho')} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm hover:bg-gray-50 rounded-t-lg">🚗 A caminho</button>
                    <button onClick={() => handleWhatsApp(client, 'cheguei')} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm hover:bg-gray-50">📍 Cheguei</button>
                    <button onClick={() => handleWhatsApp(client, 'concluido')} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm hover:bg-gray-50">✅ Concluído</button>
                    <button onClick={() => handleWhatsApp(client, 'vazio')} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm hover:bg-gray-50 rounded-b-lg">💬 Em branco</button>
                  </div>
                </div>
                <a 
                  href={`mailto:${client.email}`}
                  className="py-1.5 sm:py-2 px-1 sm:px-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-sm font-medium"
                >
                  <Mail size={12} className="sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">E-mail</span>
                  <span className="xs:hidden">Mail</span>
                </a>
                <Link 
                  href={`/dashboard/equipments?client=${client.id}`}
                  className="py-1.5 sm:py-2 px-1 sm:px-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-sm font-medium"
                >
                  <Building2 size={12} className="sm:w-4 sm:h-4" />
                  Equip.
                </Link>
              </div>

              {/* Botões de Portal - SÓ ADMIN PODE VER */}
              {isAdmin && (
                <div className="space-y-1.5 sm:space-y-2">
                  {/* Botão Liberar Portal */}
                  <button 
                    onClick={() => handleOpenPortalModal(client)}
                    className="w-full py-1.5 sm:py-2 px-2 sm:px-3 border-2 border-orange-400 text-orange-600 hover:bg-orange-50 rounded-lg flex items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm font-medium"
                  >
                    <Globe size={12} className="sm:w-4 sm:h-4" />
                    <span className="truncate">Liberar Portal</span>
                    <Lock size={10} className="sm:w-3.5 sm:h-3.5" />
                  </button>

                  {/* Botão Gerenciar Usuários */}
                  <Link 
                    href={`/dashboard/clients/${client.id}/users`}
                    className="w-full py-1.5 sm:py-2 px-2 sm:px-3 border-2 border-purple-400 text-purple-600 hover:bg-purple-50 rounded-lg flex items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm font-medium"
                  >
                    <Users size={12} className="sm:w-4 sm:h-4" />
                    <span>👥 Gerenciar Usuários</span>
                  </Link>

                  {/* Botão Bloquear/Desbloquear Portal */}
                  <button 
                    onClick={() => handleTogglePortalBlock(client)}
                    className={`w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg flex items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm font-medium ${
                      client.portal_blocked 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'border-2 border-red-400 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {client.portal_blocked ? <Unlock size={12} className="sm:w-4 sm:h-4" /> : <Lock size={12} className="sm:w-4 sm:h-4" />}
                    {client.portal_blocked ? '🔓 Desbloquear' : '🔒 Bloquear Portal'}
                  </button>
                </div>
              )}

              {/* Indicador de Bloqueio */}
              {client.portal_blocked && (
                <div className="mt-1.5 sm:mt-2 p-1.5 sm:p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-red-700">
                  <Lock size={10} className="sm:w-3 sm:h-3 flex-shrink-0" />
                  <span className="truncate">Bloqueado: {client.portal_blocked_reason || 'Sem motivo'}</span>
                </div>
              )}

              {/* Link Ver Detalhes */}
              <Link 
                href={`/dashboard/clients/${client.id}`}
                className="mt-2 sm:mt-3 block text-center text-xs sm:text-sm text-indigo-600 hover:underline"
              >
                Ver detalhes →
              </Link>
            </div>
          ))
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
            </div>
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {/* Tipo PF/PJ */}
              <div className="flex gap-1 sm:gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setFormData({ ...formData, type: 'PF' })}
                  className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md font-medium transition-all text-xs sm:text-sm ${
                    formData.type === 'PF' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
                  }`}
                >
                  👤 <span className="hidden sm:inline">Pessoa </span>Física
                </button>
                <button
                  onClick={() => setFormData({ ...formData, type: 'PJ' })}
                  className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md font-medium transition-all text-xs sm:text-sm ${
                    formData.type === 'PJ' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
                  }`}
                >
                  🏢 <span className="hidden sm:inline">Pessoa </span>Jurídica
                </button>
              </div>

              {/* Documento com busca automática */}
              <div>
                <label className="label">{formData.type === 'PJ' ? 'CNPJ (Busca Auto)' : 'CPF'}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.cnpj_cpf}
                    onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                    onBlur={handleCnpjBlur}
                    className="input pr-10"
                    placeholder={formData.type === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  />
                  {cnpjLoading ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-600" size={18} />
                  ) : formData.type === 'PJ' && (
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600" size={18} />
                  )}
                </div>
                {formData.type === 'PJ' && (
                  <p className="text-[10px] sm:text-xs text-indigo-600 mt-1">💡 Saia do campo para buscar</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="label">{formData.type === 'PJ' ? 'IE' : 'RG'}</label>
                  <input
                    type="text"
                    value={formData.ie_rg}
                    onChange={(e) => setFormData({ ...formData, ie_rg: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Telefone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="label">{formData.type === 'PJ' ? 'Razão Social *' : 'Nome *'}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                />
              </div>

              {formData.type === 'PJ' && (
                <div>
                  <label className="label">Responsável</label>
                  <input
                    type="text"
                    value={formData.responsible_name}
                    onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="email@empresa.com"
                />
              </div>

              {/* Endereço */}
              <div className="border-t pt-3 sm:pt-4 mt-3 sm:mt-4">
                <h4 className="font-semibold text-gray-700 mb-2 sm:mb-3 text-sm sm:text-base">📍 Endereço</h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-2 sm:mb-4">
                  <div>
                    <label className="label">CEP</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.zip_code}
                        onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                        onBlur={handleCepBlur}
                        className="input pr-8 sm:pr-10"
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      {cepLoading ? (
                        <Loader2 className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-600 w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <Search className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-indigo-600 w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </div>
                  </div>
                  <div className="col-span-1 sm:col-span-1">
                    <label className="label">Cidade</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="input bg-gray-50"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label">UF</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="input"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-2 sm:mb-4">
                  <div className="col-span-3">
                    <label className="label">Rua</label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Nº</label>
                    <input
                      type="text"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div>
                    <label className="label">Bairro</label>
                    <input
                      type="text"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Complemento</label>
                    <input
                      type="text"
                      value={formData.complement}
                      onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Logo do Cliente - Upload */}
              <div className="border-t pt-3 sm:pt-4 mt-3 sm:mt-4">
                <h4 className="font-semibold text-gray-700 mb-2 sm:mb-3 text-sm sm:text-base">🖼️ Logo do Cliente</h4>
                
                {formData.client_logo_url ? (
                  // Preview da logo
                  <div className="relative inline-block">
                    <img 
                      src={formData.client_logo_url} 
                      alt="Logo do cliente" 
                      className="h-24 sm:h-32 max-w-full object-contain rounded-lg border-2 border-indigo-200 bg-white p-2"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg"
                    >
                      <X size={16} />
                    </button>
                    <p className="text-xs text-gray-500 mt-2">Clique no X para remover</p>
                  </div>
                ) : (
                  // Área de upload com drag and drop
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all cursor-pointer
                      ${dragActive 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                      }
                      ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}
                    `}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploadingLogo}
                    />
                    
                    {uploadingLogo ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-2" />
                        <p className="text-sm text-gray-600">Enviando logo...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                          <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-500" />
                        </div>
                        <p className="text-sm sm:text-base font-medium text-gray-700 mb-1">
                          Arraste uma imagem aqui
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          ou clique para selecionar
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-2">
                          PNG, JPG ou WEBP • Máximo 2MB
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Campo de URL alternativo */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                    <Globe size={12} />
                    Ou cole uma URL direta:
                  </label>
                  <input
                    type="text"
                    value={formData.client_logo_url}
                    onChange={(e) => setFormData({ ...formData, client_logo_url: e.target.value })}
                    className="input text-sm"
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-6 border-t bg-gray-50 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sticky bottom-0">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary order-2 sm:order-1">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary order-1 sm:order-2">
                {saving ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : null}
                {editingClient ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Portal */}
      {portalModalVisible && (
        <div className="modal-overlay" onClick={() => setPortalModalVisible(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6 border-b">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">🌐 Liberar Portal</h2>
              <p className="text-sm text-gray-500 mt-1 truncate">Cliente: {selectedClient?.name}</p>
            </div>
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div>
                <label className="label">📧 Email</label>
                <input
                  type="email"
                  value={portalEmail}
                  onChange={(e) => setPortalEmail(e.target.value)}
                  className="input"
                  placeholder="email@cliente.com"
                />
              </div>
              <div>
                <label className="label">🔑 Senha</label>
                <input
                  type="text"
                  value={portalPassword}
                  onChange={(e) => setPortalPassword(e.target.value)}
                  className="input"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs sm:text-sm text-yellow-800">
                  ⚠️ O cliente receberá um email de confirmação.
                </p>
              </div>
            </div>
            <div className="p-3 sm:p-6 border-t bg-gray-50 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button onClick={() => setPortalModalVisible(false)} className="btn btn-secondary order-2 sm:order-1" disabled={creatingPortal}>
                Cancelar
              </button>
              <button onClick={handleCreatePortalAccess} disabled={creatingPortal} className="btn btn-primary order-1 sm:order-2">
                {creatingPortal ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <Globe size={18} />}
                Criar Acesso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
