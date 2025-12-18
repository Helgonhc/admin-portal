'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Profile } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Plus, Search, Edit, Trash2, Loader2, UserCog, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';

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

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  async function loadData() {
    try {
      const [usersRes, clientsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, clients(name)')
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

    setSaving(true);
    try {
      if (editingUser) {
        // Atualizar perfil existente
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            phone: formData.phone,
            client_id: formData.role === 'client' ? formData.client_id : null,
            cpf: formData.cpf,
            cargo: formData.cargo,
          })
          .eq('id', editingUser.id);
        if (error) throw error;
        toast.success('Usuário atualizado!');
      } else {
        // Criar novo usuário via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
              role: formData.role,
            },
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          // Atualizar perfil com dados adicionais
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              full_name: formData.full_name,
              role: formData.role,
              phone: formData.phone,
              client_id: formData.role === 'client' ? formData.client_id : null,
              cpf: formData.cpf,
              cargo: formData.cargo,
              is_active: true,
            })
            .eq('id', authData.user.id);

          if (profileError) console.error('Erro ao atualizar perfil:', profileError);
        }

        toast.success(`✅ Usuário criado!\n\n📧 ${formData.email}\n🔑 ${formData.password}`);
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
      case 'admin': return <Shield className="w-4 h-4 text-indigo-600" />;
      case 'technician': return <UserCog className="w-4 h-4 text-blue-600" />;
      case 'client': return <User className="w-4 h-4 text-gray-600" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      technician: 'Técnico',
      client: 'Cliente',
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
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
          <option value="admin">Administradores</option>
          <option value="technician">Técnicos</option>
          <option value="client">Clientes</option>
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
                    <option value="admin">👑 Administrador</option>
                    <option value="technician">🔧 Técnico</option>
                    <option value="client">👤 Cliente</option>
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
              {formData.role === 'client' && (
                <div>
                  <label className="label">Empresa</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Selecione uma empresa</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
    </div>
  );
}
