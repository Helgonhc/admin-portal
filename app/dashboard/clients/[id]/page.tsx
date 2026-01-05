'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/authStore';
import { usePermissions } from '../../../../hooks/usePermissions';
import {
  ArrowLeft, Trash2, Loader2, Building2, Phone, Mail, MapPin,
  FileText, Wrench, Ticket, Edit, Save, User, Hash, Users,
  Globe, Lock, Unlock, MessageCircle, Navigation, Search,
  Clock, Calendar, AlertCircle, CheckCircle, Plus
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ClientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { isAdmin, can } = usePermissions();
  const [client, setClient] = useState<any>(null);
  const [stats, setStats] = useState({ orders: 0, tickets: 0, equipments: 0, users: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form data completo
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

  // Modal de Portal
  const [portalModalVisible, setPortalModalVisible] = useState(false);
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('Portal@123');
  const [creatingPortal, setCreatingPortal] = useState(false);

  useEffect(() => {
    loadClient();
  }, [params.id]);

  async function loadClient() {
    try {
      const [
        clientRes,
        ordersCountRes,
        ticketsCountRes,
        equipmentsCountRes,
        usersCountRes,
        ordersRes,
        ticketsRes,
        equipmentsRes,
        usersRes,
        appsRes,
        maintsRes
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', params.id).single(),
        supabase.from('service_orders').select('id', { count: 'exact' }).eq('client_id', params.id),
        supabase.from('tickets').select('id', { count: 'exact' }).eq('client_id', params.id),
        supabase.from('equipments').select('id', { count: 'exact' }).eq('client_id', params.id),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('client_id', params.id),
        supabase.from('service_orders').select('id, title, status, created_at, maintenance_contract_id, scheduled_at').eq('client_id', params.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('tickets').select('id, title, status, created_at').eq('client_id', params.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('equipments').select('id, name, model, status').eq('client_id', params.id).order('name').limit(10),
        supabase.from('profiles').select('id, full_name, email, role, is_active').eq('client_id', params.id).order('full_name'),
        supabase.from('appointment_requests').select('*').eq('client_id', params.id).order('requested_date', { ascending: true }).limit(20),
        supabase.from('active_maintenance_contracts').select('*').eq('client_id', params.id).order('next_maintenance_date', { ascending: true }),
      ]);

      if (clientRes.error) throw clientRes.error;
      setClient(clientRes.data);
      setFormData({
        type: clientRes.data.type || 'PJ',
        name: clientRes.data.name || '',
        cnpj_cpf: clientRes.data.cnpj_cpf || '',
        ie_rg: clientRes.data.ie_rg || '',
        responsible_name: clientRes.data.responsible_name || '',
        email: clientRes.data.email || '',
        phone: clientRes.data.phone || '',
        zip_code: clientRes.data.zip_code || '',
        street: clientRes.data.street || '',
        number: clientRes.data.number || '',
        complement: clientRes.data.complement || '',
        neighborhood: clientRes.data.neighborhood || '',
        city: clientRes.data.city || '',
        state: clientRes.data.state || '',
        client_logo_url: clientRes.data.client_logo_url || '',
      });
      setStats({
        orders: ordersCountRes.count || 0,
        tickets: ticketsCountRes.count || 0,
        equipments: equipmentsCountRes.count || 0,
        users: usersCountRes.count || 0,
      });
      setRecentOrders(ordersRes.data || []);
      setRecentTickets(ticketsRes.data || []);
      setEquipments(equipmentsRes.data || []);
      setUsers(usersRes.data || []);

      const apps = appsRes.data || [];
      const maints = maintsRes.data || [];

      setAppointments(apps);

      // Deduplicar manutenções do cliente igual na agenda
      const filteredMaints = maints.filter((m: any) => {
        const hasOrder = (ordersRes.data || []).some(o =>
          o.maintenance_contract_id === m.id &&
          o.scheduled_at?.split('T')[0] === m.next_maintenance_date
        );
        const hasApp = apps.some((a: any) =>
          a.requested_date === m.next_maintenance_date
        );
        return !hasOrder && !hasApp;
      });

      setMaintenances(filteredMaints);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
      router.push('/dashboard/clients');
    } finally {
      setLoading(false);
    }
  }

  // Busca automática de CNPJ
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
        toast.success('Dados carregados!');
      }
    } catch (e) { } finally { setCnpjLoading(false); }
  }

  // Busca automática de CEP
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
    } catch (e) { } finally { setCepLoading(false); }
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setProcessing(true);
    try {
      const fullAddress = `${formData.street}, ${formData.number} - ${formData.neighborhood}, ${formData.city}/${formData.state} ${formData.zip_code ? `- CEP ${formData.zip_code}` : ''}`;
      const { error } = await supabase
        .from('clients')
        .update({ ...formData, address: fullAddress })
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Cliente atualizado!');
      setIsEditing(false);
      loadClient();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  // Abrir modal de portal
  async function handleOpenPortalModal() {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('client_id', params.id)
      .eq('role', 'client')
      .maybeSingle();

    if (existingProfile) {
      toast.success(`Este cliente já possui acesso ao portal.\n\nEmail: ${existingProfile.email}`);
      return;
    }

    setPortalEmail(client?.email || '');
    setPortalPassword('Portal@123');
    setPortalModalVisible(true);
  }

  // Criar acesso ao portal
  async function handleCreatePortalAccess() {
    if (!portalEmail.trim()) { toast.error('Email é obrigatório'); return; }
    if (!portalPassword.trim() || portalPassword.length < 6) { toast.error('Senha deve ter no mínimo 6 caracteres'); return; }

    setCreatingPortal(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: portalEmail,
        password: portalPassword,
        options: { data: { full_name: client?.responsible_name || client?.name, role: 'client' } }
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Usuário não foi criado');

      await new Promise(resolve => setTimeout(resolve, 500));

      // CRIAR profile diretamente (UPSERT)
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        email: portalEmail,
        full_name: client?.responsible_name || client?.name,
        role: 'client',
        client_id: params.id,
        phone: client?.phone || null,
        is_active: true,
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (profileError) throw new Error('Erro ao criar perfil: ' + profileError.message);

      // Atualizar cliente com portal liberado
      await supabase.from('clients').update({
        email: portalEmail,
        portal_enabled: true,
        portal_blocked: false
      }).eq('id', params.id);

      setPortalModalVisible(false);
      toast.success(`✅ Portal Habilitado!\n\nEmail: ${portalEmail}\nSenha: ${portalPassword}`);
      loadClient();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setCreatingPortal(false);
    }
  }

  // Bloquear/Desbloquear portal
  async function handleTogglePortalBlock() {
    const isBlocked = client?.portal_blocked || false;
    if (!confirm(isBlocked
      ? `Deseja DESBLOQUEAR o acesso ao portal para ${client?.name}?`
      : `Deseja BLOQUEAR o acesso ao portal para ${client?.name}?`
    )) return;

    try {
      const { error } = await supabase.from('clients').update(isBlocked ? {
        portal_blocked: false, portal_blocked_reason: null, portal_blocked_at: null
      } : {
        portal_blocked: true, portal_blocked_reason: 'Bloqueado pelo administrador', portal_blocked_at: new Date().toISOString()
      }).eq('id', params.id);

      if (error) throw error;
      toast.success(isBlocked ? 'Portal desbloqueado!' : 'Portal bloqueado!');
      loadClient();
    } catch (error: any) {
      toast.error('Erro ao alterar bloqueio');
    }
  }

  // WhatsApp
  function handleWhatsApp(messageType: 'caminho' | 'cheguei' | 'concluido' | 'vazio') {
    if (!client?.phone) { toast.error('Telefone não cadastrado'); return; }
    let message = '';
    const nomeContato = client.responsible_name || client.name;
    if (messageType === 'caminho') message = `Olá ${nomeContato}, estou a caminho aí da ${client.name} para realizar o atendimento.`;
    else if (messageType === 'cheguei') message = `Olá ${nomeContato}, já cheguei no local e estou aguardando.`;
    else if (messageType === 'concluido') message = `Olá ${nomeContato}. O serviço técnico foi concluído com sucesso!`;

    let cleanNumber = client.phone.replace(/\D/g, '');
    if (cleanNumber.length <= 11) cleanNumber = '55' + cleanNumber;
    window.open(`https://wa.me/${cleanNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`, '_blank');
  }

  // Abrir mapa
  function handleOpenMap() {
    if (!client?.address) { toast.error('Endereço não cadastrado'); return; }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`, '_blank');
  }

  async function handleDelete() {
    if (!confirm('Excluir este cliente? Isso pode afetar ordens de serviço e chamados relacionados.')) return;
    setProcessing(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', params.id);
      if (error) throw error;
      toast.success('Excluído!');
      router.push('/dashboard/clients');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluido': case 'convertido': case 'active': return 'badge-success';
      case 'em_andamento': case 'aprovado': case 'maintenance': return 'badge-info';
      case 'pendente': case 'aberto': return 'badge-warning';
      case 'cancelado': case 'rejeitado': case 'inactive': return 'badge-danger';
      default: return 'badge-gray';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href="/dashboard/clients" className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg flex-shrink-0">
          <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {client.client_logo_url ? (
            <img src={client.client_logo_url} alt={client.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-indigo-100 flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg flex-shrink-0">
              {client.name[0]}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">{client.name}</h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">{client.cnpj_cpf || 'Sem documento'}</p>
          </div>
        </div>
        {can('can_edit_clients') && (
          <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary flex-shrink-0 text-xs sm:text-sm">
            <Edit size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden sm:inline">{isEditing ? 'Cancelar' : 'Editar'}</span>
          </button>
        )}
        <span className={`badge flex-shrink-0 ${client.is_active ? 'badge-success' : 'badge-danger'}`}>
          {client.is_active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Ações Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="relative group">
          <button onClick={() => handleWhatsApp('vazio')} className="w-full py-2 sm:py-3 px-2 sm:px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm">
            <MessageCircle size={16} className="sm:w-5 sm:h-5" /> <span className="hidden xs:inline">WhatsApp</span><span className="xs:hidden">Zap</span>
          </button>
          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
            <button onClick={() => handleWhatsApp('caminho')} className="w-full px-2 sm:px-4 py-1.5 sm:py-2 text-left text-xs sm:text-sm hover:bg-gray-50 rounded-t-lg">🚗 A caminho</button>
            <button onClick={() => handleWhatsApp('cheguei')} className="w-full px-2 sm:px-4 py-1.5 sm:py-2 text-left text-xs sm:text-sm hover:bg-gray-50">📍 Cheguei</button>
            <button onClick={() => handleWhatsApp('concluido')} className="w-full px-2 sm:px-4 py-1.5 sm:py-2 text-left text-xs sm:text-sm hover:bg-gray-50">✅ Concluído</button>
            <button onClick={() => handleWhatsApp('vazio')} className="w-full px-2 sm:px-4 py-1.5 sm:py-2 text-left text-xs sm:text-sm hover:bg-gray-50 rounded-b-lg">💬 Em branco</button>
          </div>
        </div>
        <a href={`mailto:${client.email}`} className="py-2 sm:py-3 px-2 sm:px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm">
          <Mail size={16} className="sm:w-5 sm:h-5" /> E-mail
        </a>
        <button onClick={handleOpenMap} className="py-2 sm:py-3 px-2 sm:px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm">
          <Navigation size={16} className="sm:w-5 sm:h-5" /> GPS
        </button>
        <Link href={`/dashboard/equipments?client=${params.id}`} className="py-2 sm:py-3 px-2 sm:px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm">
          <Wrench size={16} className="sm:w-5 sm:h-5" /> <span className="hidden xs:inline">Equipamentos</span><span className="xs:hidden">Equip.</span>
        </Link>
      </div>

      {/* Botões de Portal - SÓ ADMIN PODE VER */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <button onClick={handleOpenPortalModal} className="py-2 sm:py-3 px-2 sm:px-4 border-2 border-orange-400 text-orange-600 hover:bg-orange-50 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm">
            <Globe size={16} className="sm:w-5 sm:h-5" /> Liberar Portal <Lock size={12} className="sm:w-4 sm:h-4" />
          </button>
          <Link href={`/dashboard/clients/${params.id}/users`} className="py-2 sm:py-3 px-2 sm:px-4 border-2 border-purple-400 text-purple-600 hover:bg-purple-50 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm">
            <Users size={16} className="sm:w-5 sm:h-5" /> 👥 Usuários ({stats.users})
          </Link>
          <button onClick={handleTogglePortalBlock} className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm ${client.portal_blocked ? 'bg-red-600 text-white hover:bg-red-700' : 'border-2 border-red-400 text-red-600 hover:bg-red-50'
            }`}>
            {client.portal_blocked ? <Unlock size={16} className="sm:w-5 sm:h-5" /> : <Lock size={16} className="sm:w-5 sm:h-5" />}
            {client.portal_blocked ? '🔓 Desbloquear' : '🔒 Bloquear'}
          </button>
        </div>
      )}

      {/* Indicador de Bloqueio */}
      {client.portal_blocked && (
        <div className="p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg sm:rounded-xl flex items-center gap-1.5 sm:gap-2 text-red-700 text-xs sm:text-sm">
          <Lock size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
          <span className="font-medium">Bloqueado:</span> <span className="truncate">{client.portal_blocked_reason || 'Sem motivo'}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <Link href={`/dashboard/orders?client=${params.id}`} className="card text-center hover:shadow-md transition-shadow">
          <FileText className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-indigo-500" />
          <p className="text-xl sm:text-2xl font-bold text-gray-800">{stats.orders}</p>
          <p className="text-[10px] sm:text-sm text-gray-500">Ordens</p>
        </Link>
        <Link href={`/dashboard/tickets?client=${params.id}`} className="card text-center hover:shadow-md transition-shadow">
          <Ticket className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-orange-500" />
          <p className="text-xl sm:text-2xl font-bold text-gray-800">{stats.tickets}</p>
          <p className="text-[10px] sm:text-sm text-gray-500">Chamados</p>
        </Link>
        <Link href={`/dashboard/equipments?client=${params.id}`} className="card text-center hover:shadow-md transition-shadow">
          <Wrench className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-emerald-500" />
          <p className="text-xl sm:text-2xl font-bold text-gray-800">{stats.equipments}</p>
          <p className="text-[10px] sm:text-sm text-gray-500">Equipamentos</p>
        </Link>
        <Link href={`/dashboard/clients/${params.id}/users`} className="card text-center hover:shadow-md transition-shadow">
          <Users className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-purple-500" />
          <p className="text-xl sm:text-2xl font-bold text-gray-800">{stats.users}</p>
          <p className="text-[10px] sm:text-sm text-gray-500">Usuários</p>
        </Link>
      </div>

      {/* Formulário de Edição ou Visualização */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3 sm:mb-4 text-sm sm:text-base">📋 Informações do Cliente</h3>

        {isEditing ? (
          <div className="space-y-3 sm:space-y-4">
            {/* Tipo PF/PJ */}
            <div className="flex gap-1 sm:gap-2 p-1 bg-gray-100 rounded-lg">
              <button onClick={() => setFormData({ ...formData, type: 'PF' })} className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md font-medium transition-all text-xs sm:text-sm ${formData.type === 'PF' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}>
                👤 <span className="hidden sm:inline">Pessoa </span>Física
              </button>
              <button onClick={() => setFormData({ ...formData, type: 'PJ' })} className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md font-medium transition-all text-xs sm:text-sm ${formData.type === 'PJ' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}>
                🏢 <span className="hidden sm:inline">Pessoa </span>Jurídica
              </button>
            </div>

            {/* Documento com busca automática */}
            <div>
              <label className="label">{formData.type === 'PJ' ? 'CNPJ (Busca Auto)' : 'CPF'}</label>
              <div className="relative">
                <input type="text" value={formData.cnpj_cpf} onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })} onBlur={handleCnpjBlur} className="input pr-10" placeholder={formData.type === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'} />
                {cnpjLoading ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-600 w-4 h-4 sm:w-5 sm:h-5" /> : formData.type === 'PJ' && <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div>
                <label className="label">{formData.type === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" />
              </div>
              {formData.type === 'PJ' && (
                <div>
                  <label className="label">Responsável</label>
                  <input type="text" value={formData.responsible_name} onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })} className="input" />
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Telefone</label>
                <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" />
              </div>
            </div>

            {/* Endereço */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-700 mb-3">📍 Endereço</h4>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="label">CEP (Busca Auto)</label>
                  <div className="relative">
                    <input type="text" value={formData.zip_code} onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })} onBlur={handleCepBlur} className="input pr-10" placeholder="00000-000" maxLength={9} />
                    {cepLoading ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-600" size={20} /> : <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600" size={20} />}
                  </div>
                </div>
                <div>
                  <label className="label">Cidade</label>
                  <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">UF</label>
                  <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="input" maxLength={2} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="col-span-3">
                  <label className="label">Rua</label>
                  <input type="text" value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Nº</label>
                  <input type="text" value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Bairro</label>
                  <input type="text" value={formData.neighborhood} onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Complemento</label>
                  <input type="text" value={formData.complement} onChange={(e) => setFormData({ ...formData, complement: e.target.value })} className="input" />
                </div>
              </div>
            </div>

            <button onClick={handleSave} disabled={processing} className="btn btn-primary">
              {processing ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Alterações
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {client.responsible_name && (
              <div className="flex items-center gap-3">
                <User className="text-gray-400" size={20} />
                <div><p className="text-xs text-gray-500">Responsável</p><p className="font-medium">{client.responsible_name}</p></div>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="text-gray-400" size={20} />
                <div><p className="text-xs text-gray-500">E-mail</p><p className="font-medium">{client.email}</p></div>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="text-gray-400" size={20} />
                <div><p className="text-xs text-gray-500">Telefone</p><p className="font-medium">{client.phone}</p></div>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-3">
                <MapPin className="text-gray-400" size={20} />
                <div><p className="text-xs text-gray-500">Endereço</p><p className="font-medium">{client.address}</p></div>
              </div>
            )}
            {client.cnpj_cpf && (
              <div className="flex items-center gap-3">
                <Hash className="text-gray-400" size={20} />
                <div><p className="text-xs text-gray-500">{client.type === 'PF' ? 'CPF' : 'CNPJ'}</p><p className="font-medium">{client.cnpj_cpf}</p></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agenda e Atividades Próximas */}
      {(maintenances.length > 0 || appointments.length > 0) && (
        <div className="card border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Calendar size={20} className="text-indigo-600" />
              Agenda do Cliente (Próximas Atividades)
            </h3>
            <Link href="/dashboard/agenda" className="text-xs text-indigo-600 hover:underline">Ver Agenda Geral</Link>
          </div>

          <div className="space-y-3">
            {/* Agendamentos e Manutenções Combinados */}
            {[
              ...appointments.map(a => ({ ...a, type: 'appointment' })),
              ...maintenances.map(m => ({ ...m, type: 'maintenance' }))
            ].sort((a, b) => {
              const dateA = a.requested_date || a.next_maintenance_date;
              const dateB = b.requested_date || b.next_maintenance_date;
              return dateA.localeCompare(dateB);
            }).map((event: any, idx) => (
              <div key={idx} className={`p-3 rounded-lg border border-gray-100 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${event.type === 'maintenance' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {event.type === 'maintenance' ? <Wrench size={18} /> : <Calendar size={18} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-800">
                      {event.type === 'maintenance' ? (event.maintenance_type_name || event.title) : (event.title || event.service_type)}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500 font-medium">
                        {new Date((event.requested_date || event.next_maintenance_date) + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${event.type === 'maintenance' ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                        {event.type === 'maintenance' ? 'Manutenção Preventiva' : 'Agendamento'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${event.status === 'confirmed' || event.status === 'confirmado' ? 'bg-green-100 text-green-700' :
                    event.status === 'pending' || event.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                    {event.status === 'pending' || event.status === 'pendente' ? 'Pendente' :
                      event.status === 'confirmed' || event.status === 'confirmado' ? 'Confirmado' : event.status}
                  </span>
                  <Link
                    href={event.type === 'maintenance' ? '/dashboard/maintenance' : '/dashboard/agenda'}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600"
                  >
                    <ArrowLeft className="rotate-180" size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipamentos */}
      {equipments.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">🔧 Equipamentos</h3>
            <Link href={`/dashboard/equipments?client=${params.id}`} className="text-sm text-indigo-600 hover:underline">Ver todos</Link>
          </div>
          <div className="space-y-2">
            {equipments.map((eq) => (
              <Link key={eq.id} href={`/dashboard/equipments/${eq.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div><p className="font-medium">{eq.name}</p>{eq.model && <p className="text-sm text-gray-500">{eq.model}</p>}</div>
                <span className={`badge ${getStatusColor(eq.status)}`}>{eq.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Últimas OS */}
      {recentOrders.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">📋 Últimas Ordens de Serviço</h3>
            <Link href={`/dashboard/orders?client=${params.id}`} className="text-sm text-indigo-600 hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Link key={order.id} href={`/dashboard/orders/${order.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div><p className="font-medium">{order.title}</p><p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p></div>
                <span className={`badge ${getStatusColor(order.status)}`}>{order.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Usuários do Cliente */}
      {users.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">👥 Usuários Vinculados</h3>
            {isAdmin && (
              <Link href={`/dashboard/clients/${params.id}/users`} className="text-sm text-indigo-600 hover:underline">Gerenciar</Link>
            )}
          </div>
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${user.is_active ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                  {user.full_name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                  {user.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cadastro */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">📅 Cadastro</h3>
        <p className="text-gray-600">Cliente desde {new Date(client.created_at).toLocaleDateString('pt-BR')}</p>
      </div>

      {/* Actions - SÓ ADMIN PODE EXCLUIR */}
      {isAdmin && (
        <div className="flex flex-wrap gap-3">
          <button onClick={handleDelete} disabled={processing} className="btn btn-danger">
            <Trash2 size={20} /> Excluir Cliente
          </button>
        </div>
      )}

      {/* Modal de Portal */}
      {portalModalVisible && (
        <div className="modal-overlay" onClick={() => setPortalModalVisible(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">🌐 Liberar Acesso ao Portal</h2>
              <p className="text-gray-500 mt-1">Cliente: {client?.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">📧 Email de Acesso</label>
                <input type="email" value={portalEmail} onChange={(e) => setPortalEmail(e.target.value)} className="input" placeholder="email@cliente.com" />
              </div>
              <div>
                <label className="label">🔑 Senha Padrão</label>
                <input type="text" value={portalPassword} onChange={(e) => setPortalPassword(e.target.value)} className="input" placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">⚠️ O cliente receberá um email de confirmação.</p>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setPortalModalVisible(false)} className="btn btn-secondary" disabled={creatingPortal}>Cancelar</button>
              <button onClick={handleCreatePortalAccess} disabled={creatingPortal} className="btn btn-primary">
                {creatingPortal ? <Loader2 className="animate-spin" size={20} /> : <Globe size={20} />}
                Criar Acesso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
