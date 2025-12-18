'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Profile } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Edit, Trash2, Loader2, UserCog, Shield, User, Copy, Check, Smartphone, Globe, Star } from 'lucide-react';
import toast from 'react-hot-toast';

// URLs dos portais
const ADMIN_PORTAL_URL = 'https://chameiapp-admin.vercel.app';
const CLIENT_PORTAL_URL = 'https://chameiapp-portal.vercel.app';
const APK_DOWNLOAD_URL = 'https://expo.dev/accounts/helgon/projects/chameiapp/builds';

export default function UsersPage() {
  const router = useRouter();
  const { profile: currentUser } = useAuthStore();
  const [users, setUsers] = useState<Profile[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'technician',
    phone: '',
    client_id: '',
    cpf: '',
    cargo: '',
  });
  const [saving, setSaving] = useState(false);
  
  // Modal de credenciais após criar usuário
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    name: string;
    role: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  async function loadData() {
    try {
      const [usersRes, clientsRes] = await Promise.all([
        // Buscar apenas super_admin, admin e technician (NÃO clientes)
        supabase
          .from('profiles')
          .select('*, clients(name)')
          .in('role', ['super_admin', 'admin', 'technician'])
          .order('full_name'),
        supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (usersRes.error) throw usersRes.error;
      setUsers(usersRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());
    // Filtrar apenas por roles de staff (não cliente)
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  function openModal(user?: Profile) {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '',
        full_name: user.full_name,
        role: user.role,
        phone: user.phone || '',
        client_id: user.client_id || '',
        cpf: user.cpf || '',
        cargo: user.cargo || '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'technician',
        phone: '',
        client_id: '',
        cpf: '',
        cargo: '',
      });
    }
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.full_name || !formData.email) {
      toast.error('Nome e email são obrigatórios');
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error('Senha é obrigatória para novos usuários');
      return;
    }

    if (!editingUser && formData.password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        // Atualizar perfil existente
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            phone: formData.phone || null,
            cpf: formData.cpf || null,
            cargo: formData.cargo || null,
          })
          .eq('id', editingUser.id);
        if (error) throw error;
        toast.success('Usuário atualizado!');
      } else {
        // 1. Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name.trim(),
              role: formData.role,
            },
          },
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            throw new Error('Este email já está cadastrado no sistema');
          }
          throw authError;
        }

        if (!authData.user) {
          throw new Error('Falha ao criar usuário');
        }

        // 2. Aguardar trigger criar o perfil
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 3. Verificar se o perfil foi criado pelo trigger
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authData.user.id)
          .single();

        if (!existingProfile) {
          // Se o trigger não funcionou, criar usando função SQL que bypassa RLS
          const { error: rpcError } = await supabase.rpc('create_profile_for_user', {
            user_id: authData.user.id,
            user_email: formData.email.trim().toLowerCase(),
            user_full_name: formData.full_name.trim(),
            user_phone: formData.phone?.trim() || null,
            user_role: formData.role,
            user_is_active: true,
          });

          if (rpcError) {
            console.error('Erro ao criar perfil via RPC:', rpcError);
            // Tentar inserir diretamente
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: authData.user.id,
                email: formData.email.trim().toLowerCase(),
                full_name: formData.full_name.trim(),
                phone: formData.phone?.trim() || null,
                role: formData.role,
                is_active: true,
                cpf: formData.cpf?.trim() || null,
                cargo: formData.cargo?.trim() || null,
              });
            
            if (insertError) {
              console.error('Erro ao inserir perfil:', insertError);
            }
          }
        } else {
          // Se o perfil existe, apenas atualizar com dados adicionais
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              full_name: formData.full_name.trim(),
              phone: formData.phone?.trim() || null,
              cpf: formData.cpf?.trim() || null,
              cargo: formData.cargo?.trim() || null,
              role: formData.role,
              is_active: true,
            })
            .eq('id', authData.user.id);

          if (updateError) {
            console.error('Erro ao atualizar perfil:', updateError);
          }
        }

        // Mostrar modal com credenciais
        setCreatedCredentials({
          email: formData.email,
          password: formData.password,
          name: formData.full_name,
          role: formData.role,
        });
        setShowCredentialsModal(true);
      }
      setShowModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: Profile) {
    if (user.id === currentUser?.id) {
      toast.error('Você não pode excluir seu próprio usuário');
      return;
    }

    if (!confirm(`Excluir usuário "${user.full_name}"?`)) return;

    try {
      // Desativar usuário (não deletar completamente)
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Usuário desativado!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <Star className="w-4 h-4 text-yellow-600" />;
      case 'admin': return <Shield className="w-4 h-4 text-indigo-600" />;
      case 'technician': return <UserCog className="w-4 h-4 text-blue-600" />;
      case 'client': return <User className="w-4 h-4 text-gray-600" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Administrador',
      technician: 'Técnico',
      client: 'Cliente',
    };
    return labels[role] || role;
  };
  
  // Função para copiar texto
  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copiado!');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-yellow-100 text-yellow-700';
      case 'admin': return 'bg-indigo-100 text-indigo-700';
      case 'technician': return 'bg-blue-100 text-blue-700';
      case 'client': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Acesso restrito a administradores</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-800">Usuários</h1>
          <p className="text-gray-500">{users.length} usuários cadastrados</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <Plus size={20} />
          Novo Usuário
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-with-icon"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input w-full sm:w-48"
        >
          <option value="all">Todos os tipos</option>
          <option value="super_admin">Super Admins</option>
          <option value="admin">Administradores</option>
          <option value="technician">Técnicos</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Tipo</th>
                <th>Telefone</th>
                <th>Empresa</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    <UserCog className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                          {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{user.full_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td>{user.phone || '-'}</td>
                    <td>{(user as any).clients?.name || '-'}</td>
                    <td>
                      <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {(user.role === 'super_admin' || user.role === 'admin' || user.role === 'technician') && (
                          <button
                            onClick={() => router.push(`/dashboard/users/${user.id}/permissions`)}
                            className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600"
                            title="Gerenciar Permissões"
                          >
                            <Shield size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => openModal(user)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                          disabled={user.id === currentUser?.id}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nome Completo *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="input"
                  placeholder="Nome completo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    placeholder="email@exemplo.com"
                    disabled={!!editingUser}
                  />
                </div>
                {!editingUser && (
                  <div>
                    <label className="label">Senha *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input"
                      placeholder="Senha inicial"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="input"
                  >
                    {isSuperAdmin && <option value="admin">👑 Administrador</option>}
                    {isSuperAdmin && <option value="admin">👑 Administrador</option>}
                    {!isSuperAdmin && currentUser?.role === 'admin' && <option value="admin">👑 Administrador</option>}
                    <option value="technician">🔧 Técnico</option>
                  </select>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="input"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="label">Cargo</label>
                  <input
                    type="text"
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    className="input"
                    placeholder="Cargo/Função"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                {editingUser ? 'Salvar' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Credenciais Criadas */}
      {showCredentialsModal && createdCredentials && (
        <div className="modal-overlay" onClick={() => setShowCredentialsModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b bg-green-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">✅ Usuário Criado!</h2>
                  <p className="text-sm text-gray-600">{createdCredentials.name}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Credenciais */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  🔐 Credenciais de Acesso
                </h3>
                
                {/* Email */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-mono text-sm">{createdCredentials.email}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdCredentials.email, 'email')}
                    className="p-2 bg-indigo-100 hover:bg-indigo-200 rounded-lg text-indigo-600"
                  >
                    {copiedField === 'email' ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
                
                {/* Senha */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Senha</p>
                    <p className="font-mono text-sm">{createdCredentials.password}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                    className="p-2 bg-indigo-100 hover:bg-indigo-200 rounded-lg text-indigo-600"
                  >
                    {copiedField === 'password' ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
                
                {/* Copiar Tudo */}
                <button
                  onClick={() => copyToClipboard(
                    `📧 Email: ${createdCredentials.email}\n🔑 Senha: ${createdCredentials.password}`,
                    'all'
                  )}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-medium"
                >
                  {copiedField === 'all' ? <Check size={16} /> : <Copy size={16} />}
                  Copiar Credenciais
                </button>
              </div>

              {/* Onde Acessar */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700">📍 Onde Acessar</h3>
                
                {createdCredentials.role === 'client' ? (
                  // Cliente - Portal do Cliente
                  <a
                    href={CLIENT_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors"
                  >
                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">Portal do Cliente</p>
                      <p className="text-xs text-gray-500">{CLIENT_PORTAL_URL}</p>
                    </div>
                  </a>
                ) : (
                  // Admin/Técnico - Portal Admin + APK
                  <>
                    <a
                      href={ADMIN_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors"
                    >
                      <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                        <Globe className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">Portal Administrativo (Web)</p>
                        <p className="text-xs text-gray-500">{ADMIN_PORTAL_URL}</p>
                      </div>
                    </a>
                    
                    <a
                      href={APK_DOWNLOAD_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                    >
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">Aplicativo Android (APK)</p>
                        <p className="text-xs text-gray-500">Baixar última versão do app</p>
                      </div>
                    </a>
                  </>
                )}
              </div>

              {/* Aviso */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  ⚠️ <strong>Importante:</strong> Envie estas credenciais para o usuário de forma segura. 
                  {createdCredentials.role !== 'client' && ' O técnico pode usar tanto o portal web quanto o aplicativo Android.'}
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="w-full py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
