'use client';

import { useState, useEffect } from 'react';
import { supabase, Client } from '../../../lib/supabase';
import { Plus, Search, Filter, X, MoreVertical, Building2, User, Phone, Mail, MapPin, Shield, Calendar, Wrench, ChevronRight, Edit, Trash2, Eye, Loader2, Globe, Lock, Users, MessageCircle, Navigation, Unlock, UserPlus, Upload, Image, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Skeleton, ListSkeleton } from '../../../components/Skeleton';
import { usePermissions } from '../../../hooks/usePermissions';

const BRAZIL_STATES = [
  { value: 'AC', label: 'Acre' }, { value: 'AL', label: 'Alagoas' }, { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' }, { value: 'BA', label: 'Bahia' }, { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' }, { value: 'ES', label: 'Espírito Santo' }, { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' }, { value: 'MT', label: 'Mato Grosso' }, { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' }, { value: 'PA', label: 'Pará' }, { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' }, { value: 'PE', label: 'Pernambuco' }, { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' }, { value: 'RN', label: 'Rio Grande do Norte' }, { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' }, { value: 'RR', label: 'Roraima' }, { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' }, { value: 'SE', label: 'Sergipe' }, { value: 'TO', label: 'Tocantins' }
].map(s => ({ ...s, flag: `https://cdn.jsdelivr.net/gh/arthurreira/br-state-flags@main/svgs/optimized/${s.value.toLowerCase()}.svg` }));

export default function ClientsPage() {
  const { can, isAdmin } = usePermissions();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState<Record<string, { vencidas: number; urgentes: number }>>({});

  // Verificar permissão de acesso
  const canViewClients = can('can_view_all_clients');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

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

      // Buscar manutenções por cliente (vencidas e urgentes)
      const { data: maintenanceData } = await supabase
        .from('active_maintenance_contracts')
        .select('client_id, urgency_status');

      // Agrupar por cliente
      const statusByClient: Record<string, { vencidas: number; urgentes: number }> = {};
      maintenanceData?.forEach(m => {
        if (!statusByClient[m.client_id]) {
          statusByClient[m.client_id] = { vencidas: 0, urgentes: 0 };
        }
        if (m.urgency_status === 'vencido') {
          statusByClient[m.client_id].vencidas++;
        } else if (m.urgency_status === 'urgente') {
          statusByClient[m.client_id].urgentes++;
        }
      });
      setMaintenanceStatus(statusByClient);
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

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.email?.toLowerCase().includes(search.toLowerCase()) ||
      client.cnpj_cpf?.includes(search) ||
      client.responsible_name?.toLowerCase().includes(search.toLowerCase());

    const matchesState = filterState ? client.state === filterState : true;

    return matchesSearch && matchesState;
  });

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
      toast('Usuário já existe. Prossiga para redefinir a senha.', { icon: 'ℹ️' });
      // Preencher dados se possível
      if (existingProfile.email) setPortalEmail(existingProfile.email);
    }

    setSelectedClient(client);
    setPortalEmail(client.email || '');
    setPortalPassword('Portal@123');
    setPortalModalVisible(true);
  }

  // Criar acesso ao portal (usando função SQL para não afetar sessão do admin/APK)
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
      // Usar API Route para garantir criação segura e hash de senha correto
      const response = await fetch('/api/create-portal-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: portalEmail.trim().toLowerCase(),
          password: portalPassword,
          full_name: (selectedClient.responsible_name || selectedClient.name).trim(),
          client_id: selectedClient.id,
          phone: selectedClient.phone || null,
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      // O perfil já é criado/atualizado pela API Route, não precisamos fazer update manual aqui

      // Atualizar cliente com portal liberado
      await supabase
        .from('clients')
        .update({
          email: portalEmail.trim().toLowerCase(),
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <img src="https://cdn.jsdelivr.net/gh/lipis/flag-icons@main/flags/4x3/br.svg" className="w-8 h-6 object-cover rounded-[3px] shadow-sm" alt="Brasil" />
            Carteira de Clientes
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <p className="text-sm font-medium text-slate-500">{clients.length} clientes na rede</p>
          </div>
        </div>
        {can('can_create_clients') && (
          <button onClick={() => openModal()} className="group btn-primary px-6 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:-translate-y-0.5 active:scale-95 bg-indigo-600 text-white">
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Novo Cliente</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative group/search flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within/search:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por nome, email, documento ou responsável..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl leading-5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 sm:text-sm transition-all shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="relative min-w-[240px]">
          <button
            onClick={() => setIsStateOpen(!isStateOpen)}
            className="w-full pl-4 pr-10 py-4 bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold text-sm flex items-center gap-2 group shadow-sm hover:border-slate-300 text-slate-700"
          >
            {filterState ? (
              <>
                <img src={`https://cdn.jsdelivr.net/gh/arthurreira/br-state-flags@main/svgs/optimized/${filterState.toLowerCase()}.svg`} className="w-5 h-3.5 object-cover rounded-[1px]" alt={filterState} />
                <span>{filterState}</span>
              </>
            ) : (
              <>
                <img src="https://cdn.jsdelivr.net/gh/lipis/flag-icons@main/flags/4x3/br.svg" className="w-5 h-3.5 object-cover rounded-[1px] shadow-sm" alt="Brasil" />
                <span>Brasil</span>
              </>
            )}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-300" style={{ transform: isStateOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)' }}>
              <ChevronRight size={14} className="rotate-90 text-slate-400" />
            </div>
          </button>

          {isStateOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto animate-fadeIn p-1">
              <button
                onClick={() => {
                  setFilterState('');
                  setIsStateOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors text-sm font-bold text-slate-700"
              >
                <img src="https://cdn.jsdelivr.net/gh/lipis/flag-icons@main/flags/4x3/br.svg" className="w-5 h-3.5 object-cover rounded-[1px] shadow-sm" alt="Brasil" />
                <span>Brasil (Todos)</span>
              </button>
              {BRAZIL_STATES.map(state => (
                <button
                  key={state.value}
                  onClick={() => {
                    setFilterState(state.value);
                    setIsStateOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors text-sm font-bold ${filterState === state.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'}`}
                >
                  <img src={state.flag} className="w-5 h-3.5 object-cover rounded-[1px] shadow-sm" alt={state.value} />
                  <span>{state.value} - {state.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filteredClients.length === 0 ? (
          <div className="col-span-full text-center py-8 sm:py-12 text-gray-500">
            <Building2 className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" />
            <p className="text-base sm:text-lg text-slate-400 font-medium">Nenhum cliente encontrado</p>
          </div>
        ) : (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className={`
                relative flex flex-col bg-white rounded-3xl border border-slate-200/60 shadow-sm 
                hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1.5 transition-all duration-500 overflow-hidden group
                ${maintenanceStatus[client.id]?.vencidas > 0 ? 'ring-2 ring-red-500/20' : ''}
              `}
            >
              {/* Top Colored Bar for Maintenance Status */}
              <div className={`h-1.5 w-full ${maintenanceStatus[client.id]?.vencidas > 0
                ? 'bg-red-500'
                : maintenanceStatus[client.id]?.urgentes > 0
                  ? 'bg-amber-400'
                  : 'bg-indigo-500'
                }`} />

              <div className="p-5 sm:p-6 flex flex-col h-full">
                {/* Client Header Info */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="relative group/logo">
                    {client.client_logo_url ? (
                      <div className="relative">
                        <img
                          src={client.client_logo_url}
                          alt={client.name}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-slate-100 shadow-sm transition-transform duration-500 group-hover/logo:scale-105"
                        />
                        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg transition-transform duration-500 group-hover/logo:scale-105">
                        {client.name[0].toUpperCase()}
                      </div>
                    )}
                    <div className={`
                      absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-md animate-bounce-subtle
                      ${client.type === 'PJ' ? 'bg-indigo-600' : 'bg-emerald-500'}
                    `} title={client.type}>
                      {client.type === 'PJ' ? <Building2 size={12} className="text-white" /> : <User size={12} className="text-white" />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-2 overflow-hidden mb-1">
                      <h3 className="font-bold text-slate-800 text-lg leading-tight uppercase tracking-tight group-hover:text-indigo-600 transition-colors flex items-center gap-2 max-w-full">
                        <span className="truncate">{client.name}</span>
                        {client.state && (
                          <img
                            src={`https://cdn.jsdelivr.net/gh/arthurreira/br-state-flags@main/svgs/optimized/${client.state.toLowerCase()}.svg`}
                            className="w-5 h-3.5 object-cover rounded-[2px] shadow-sm flex-shrink-0"
                            alt={client.state}
                            title={`Estado: ${client.state}`}
                          />
                        )}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {client.is_telemetry_client && (
                        <div className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-black rounded-full flex items-center gap-1 border border-purple-100 animate-pulse">
                          <Wrench size={10} /> TELEMETRIA
                        </div>
                      )}
                      {client.responsible_name && (
                        <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full flex items-center gap-1 border border-indigo-100">
                          <User size={10} /> {client.responsible_name}
                        </div>
                      )}
                      {client.cnpj_cpf && (
                        <div className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] font-mono rounded-full border border-slate-100">
                          {client.cnpj_cpf}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    {can('can_edit_clients') && (
                      <button onClick={() => openModal(client)} className="p-2 hover:bg-indigo-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50/50">
                        <Edit size={16} />
                      </button>
                    )}
                    {can('can_delete_clients') && (
                      <button onClick={() => handleDelete(client)} className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors bg-slate-50/50">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact List */}
                <div className="space-y-3 mb-6 flex-1">
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 transition-colors group/contact">
                      <div className="p-2 bg-indigo-50 rounded-lg group-hover/contact:bg-indigo-100 transition-colors text-indigo-600">
                        <Phone size={14} />
                      </div>
                      <span className="text-sm font-medium">{client.phone}</span>
                    </a>
                  )}
                  {client.email && (
                    <a href={`mailto:${client.email}`} className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 transition-colors group/contact">
                      <div className="p-2 bg-indigo-50 rounded-lg group-hover/contact:bg-indigo-100 transition-colors text-indigo-600">
                        <Mail size={14} />
                      </div>
                      <span className="text-sm font-medium truncate">{client.email}</span>
                    </a>
                  )}
                  {client.address && (
                    <button
                      onClick={() => handleOpenMap(client.address)}
                      className="flex items-center gap-3 text-slate-600 hover:text-rose-600 transition-colors group/contact text-left w-full"
                    >
                      <div className="p-2 bg-rose-50 rounded-lg group-hover/contact:bg-rose-100 transition-colors text-rose-500">
                        <MapPin size={14} />
                      </div>
                      <span className="text-sm font-medium line-clamp-2 leading-relaxed">{client.address}</span>
                    </button>
                  )}
                </div>

                {/* Primary Actions Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="relative group/wp">
                    <button
                      onClick={() => handleWhatsApp(client, 'vazio')}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <MessageCircle size={16} />
                      <span>Whats</span>
                    </button>
                    {/* Floating Dropdown */}
                    <div className="absolute left-0 right-0 bottom-full mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 opacity-0 invisible group-hover/wp:opacity-100 group-hover/wp:visible transition-all z-20 min-w-[160px] overflow-hidden p-1.5 ring-1 ring-black/5 animate-slideUp">
                      <button onClick={() => handleWhatsApp(client, 'caminho')} className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl flex items-center gap-2 transition-colors font-medium">🚗 A caminho</button>
                      <button onClick={() => handleWhatsApp(client, 'cheguei')} className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl flex items-center gap-2 transition-colors font-medium">📍 Cheguei</button>
                      <button onClick={() => handleWhatsApp(client, 'concluido')} className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl flex items-center gap-2 transition-colors font-medium">✅ Concluído</button>
                    </div>
                  </div>
                  <a
                    href={`mailto:${client.email}`}
                    className="py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-bold shadow-lg shadow-slate-800/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Mail size={16} />
                    <span>Email</span>
                  </a>
                  <Link
                    href={`/dashboard/equipments?client=${client.id}`}
                    className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Building2 size={16} />
                    <span>Equip.</span>
                  </Link>
                </div>

                {/* Admin/Portal Section */}
                {isAdmin && (
                  <div className="mt-auto space-y-2 border-t border-slate-100 pt-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenPortalModal(client)}
                        className={`flex-1 py-2.5 px-3 rounded-2xl border-2 flex items-center justify-center gap-2 text-xs font-bold transition-all
                          ${client.portal_enabled
                            ? 'border-indigo-100 text-indigo-400 cursor-default bg-indigo-50/30'
                            : 'border-amber-400 text-amber-600 hover:bg-amber-50 active:scale-[0.98]'
                          }
                        `}
                      >
                        <Globe size={14} />
                        {client.portal_enabled ? 'Portal Ativo' : 'Liberar Portal'}
                      </button>

                      <Link
                        href={`/dashboard/clients/${client.id}/users`}
                        className="p-2.5 border-2 border-purple-200 text-purple-600 hover:bg-purple-50 rounded-2xl flex items-center justify-center transition-all active:scale-[0.98]"
                        title="Gerenciar Usuários"
                      >
                        <Users size={18} />
                      </Link>
                    </div>

                    <button
                      onClick={() => handleTogglePortalBlock(client)}
                      className={`w-full py-2.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm
                        ${client.portal_blocked
                          ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200'
                          : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-500'
                        }
                      `}
                    >
                      {client.portal_blocked ? <Unlock size={14} /> : <Lock size={14} />}
                      {client.portal_blocked ? 'Desbloquear Acesso' : 'Bloquear Portal'}
                    </button>
                  </div>
                )}

                {/* Indicators - Floating or Footers */}
                {client.portal_blocked && (
                  <div className="absolute top-3 right-3 animate-pulse">
                    <div className="bg-red-500 text-white p-1 rounded-full shadow-lg" title={`Bloqueado: ${client.portal_blocked_reason || 'Sem motivo'}`}>
                      <Shield size={12} strokeWidth={3} />
                    </div>
                  </div>
                )}

                {/* Maintenance Alert - More visible and premium */}
                {(maintenanceStatus[client.id]?.vencidas > 0 || maintenanceStatus[client.id]?.urgentes > 0) && (
                  <Link
                    href="/dashboard/maintenance"
                    className={`mt-4 p-3 rounded-2xl flex items-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] border
                      ${maintenanceStatus[client.id]?.vencidas > 0
                        ? 'bg-red-50 border-red-100 text-red-700'
                        : 'bg-amber-50 border-amber-100 text-amber-700'
                      }
                    `}
                  >
                    <div className={`p-2 rounded-xl flex-shrink-0 ${maintenanceStatus[client.id]?.vencidas > 0 ? 'bg-red-100' : 'bg-amber-100'
                      }`}>
                      <AlertTriangle size={16} className="animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wider mb-0.5">Pendência Técnica</p>
                      <p className="text-xs font-bold truncate">
                        {maintenanceStatus[client.id]?.vencidas > 0
                          ? `${maintenanceStatus[client.id].vencidas} Manutenção(ões) VENCIDA(S)`
                          : `${maintenanceStatus[client.id].urgentes} Manutenção(ões) Urgente(s)`
                        }
                      </p>
                    </div>
                  </Link>
                )}

                <Link
                  href={`/dashboard/clients/${client.id}`}
                  className="mt-5 w-full py-2.5 text-center text-xs font-bold text-slate-400 hover:text-indigo-600 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all"
                >
                  Ver Detalhes do Cliente
                </Link>
              </div>
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
                  className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md font-medium transition-all text-xs sm:text-sm ${formData.type === 'PF' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
                    }`}
                >
                  👤 <span className="hidden sm:inline">Pessoa </span>Física
                </button>
                <button
                  onClick={() => setFormData({ ...formData, type: 'PJ' })}
                  className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md font-medium transition-all text-xs sm:text-sm ${formData.type === 'PJ' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
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
