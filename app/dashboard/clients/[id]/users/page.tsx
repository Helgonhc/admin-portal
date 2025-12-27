'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../lib/supabase';
import { usePermissions } from '../../../../../hooks/usePermissions';
import {
  ArrowLeft, UserPlus, Trash2, Power, User, Mail, Loader2, Users, Shield
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface ClientUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export default function ManageClientUsersPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [client, setClient] = useState<any>(null);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form fields
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('Portal@123');

  useEffect(() => {
    loadData();
  }, [params.id]);

  async function loadData() {
    setLoading(true);
    try {
      // Carregar cliente
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', params.id)
        .single();

      setClient(clientData);

      // Carregar usuários do cliente
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('client_id', params.id)
        .eq('role', 'client')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(usersData || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser() {
    if (!newUserName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!newUserEmail.trim()) {
      toast.error('Email é obrigatório');
      return;
    }

    if (!newUserPassword.trim() || newUserPassword.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    // Verificar limite de 2 usuários
    const activeUsers = users.filter(u => u.is_active);
    if (activeUsers.length >= 2) {
      toast.error('Esta empresa já possui 2 usuários ativos no portal.\n\nPara adicionar um novo usuário, você precisa remover ou desativar um dos usuários existentes.');
      return;
    }

    setCreating(true);

    try {
      // Usar função SQL para criar usuário (não afeta sessão do admin/APK)
      const { data: result, error: rpcError } = await supabase.rpc('create_user_admin', {
        p_email: newUserEmail.trim().toLowerCase(),
        p_password: newUserPassword,
        p_full_name: newUserName.trim(),
        p_role: 'client',
        p_phone: null,
        p_cpf: null,
        p_cargo: null,
        p_client_id: params.id,
      });

      if (rpcError) {
        console.error('Erro na função SQL:', rpcError);
        throw new Error(`Erro ao criar usuário: ${rpcError.message}. Execute o SQL CRIAR_USUARIO_SEM_AFETAR_SESSAO.sql no Supabase.`);
      }

      if (result && !result.success) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      if (result && result.success) {
        // Atualizar o profile com o client_id
        await supabase
          .from('profiles')
          .update({ client_id: params.id })
          .eq('id', result.user_id);
      }

      // Sucesso!
      setShowModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('Portal@123');

      toast.success(`Usuário Adicionado!\n\nEmail: ${newUserEmail}\nSenha: ${newUserPassword}\n\nInforme estas credenciais ao usuário.`);
      loadData();
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      toast.error(`Erro ao criar usuário: ${error.message}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(user: ClientUser) {
    const action = user.is_active ? 'desativar' : 'ativar';

    if (!confirm(user.is_active
      ? `Deseja desativar o acesso de ${user.full_name}?\n\nO usuário não conseguirá fazer login até ser reativado.`
      : `Deseja reativar o acesso de ${user.full_name}?\n\nO usuário poderá fazer login novamente.`
    )) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(user.is_active
        ? `${user.full_name} foi desativado.`
        : `${user.full_name} foi reativado.`
      );

      loadData();
    } catch (error: any) {
      console.error(`Erro ao ${action}:`, error);
      toast.error(`Não foi possível ${action} o usuário.`);
    }
  }

  async function handleRemoveUser(user: ClientUser) {
    if (!confirm(`Tem certeza que deseja remover permanentemente:\n\n${user.full_name}\n${user.email}\n\nEsta ação não pode ser desfeita!`)) return;

    try {
      // Usar função SQL que deleta completamente (profile + auth.users)
      const { data, error } = await supabase.rpc('delete_user_completely', {
        user_uuid: user.id
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.message || 'Erro ao remover usuário');
      }

      toast.success('Usuário removido!');
      loadData();
    } catch (error: any) {
      console.error('Erro ao remover usuário:', error);
      toast.error(`Não foi possível remover o usuário.\n\n${error.message}`);
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  const activeUsers = users.filter(u => u.is_active);
  const canAddUser = activeUsers.length < 2;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Só admin pode acessar esta página
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Shield className="w-16 h-16 text-red-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-600">Acesso Restrito</h2>
        <p className="text-gray-500 mt-2">Apenas administradores podem gerenciar usuários do portal.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href={`/dashboard/clients/${params.id}`} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg flex-shrink-0">
          <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Usuários do Portal</h1>
          <p className="text-sm text-gray-500 truncate">{client?.name}</p>
        </div>
      </div>

      {/* Counter */}
      <div className="card flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="text-indigo-600 w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="flex-1 sm:flex-initial">
            <p className="text-base sm:text-lg font-semibold text-gray-800">
              {activeUsers.length} de 2 ativos
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              Limite de 2 por empresa
            </p>
          </div>
        </div>
        {canAddUser && (
          <span className="px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs sm:text-sm font-medium sm:ml-auto">
            {2 - activeUsers.length} vaga{2 - activeUsers.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Lista de Usuários */}
      {users.length === 0 ? (
        <div className="card text-center py-8 sm:py-12">
          <Users className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" />
          <p className="text-base sm:text-lg text-gray-500">Nenhum usuário cadastrado</p>
          <p className="text-xs sm:text-sm text-gray-400">Adicione o primeiro usuário</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className={`card border-l-4 ${user.is_active ? 'border-l-indigo-500' : 'border-l-gray-300 opacity-70'}`}
            >
              <div className="flex items-start gap-2 sm:gap-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-lg font-bold flex-shrink-0 ${user.is_active ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {user.full_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">{user.full_name}</h3>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                    <Mail size={12} className="sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                    Criado em {formatDate(user.created_at)}
                  </p>
                </div>
                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-sm font-medium flex-shrink-0 ${user.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
                  }`}>
                  {user.is_active ? '✅ Ativo' : '⏸️ Inativo'}
                </span>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                <button
                  onClick={() => handleToggleStatus(user)}
                  className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm ${user.is_active
                    ? 'bg-gray-100 text-red-600 hover:bg-red-50'
                    : 'bg-gray-100 text-green-600 hover:bg-green-50'
                    }`}
                >
                  <Power size={14} className="sm:w-[18px] sm:h-[18px]" />
                  {user.is_active ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => handleRemoveUser(user)}
                  className="flex-1 py-1.5 sm:py-2 px-2 sm:px-4 bg-red-600 text-white rounded-lg flex items-center justify-center gap-1 sm:gap-2 font-medium hover:bg-red-700 text-xs sm:text-sm"
                >
                  <Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" />
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botão Adicionar */}
      <button
        onClick={() => {
          if (canAddUser) {
            setShowModal(true);
          } else {
            toast.error('Esta empresa já possui 2 usuários ativos.\n\nRemova ou desative um usuário para adicionar outro.');
          }
        }}
        className={`w-full py-3 sm:py-4 rounded-lg sm:rounded-xl flex items-center justify-center gap-2 sm:gap-3 font-semibold text-sm sm:text-lg ${canAddUser
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
      >
        <UserPlus size={20} className="sm:w-6 sm:h-6" />
        Adicionar Usuário
      </button>

      {/* Modal Adicionar Usuário */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6 border-b">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">👤 Adicionar Usuário</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div>
                <label className="label">Nome Completo *</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="input"
                  placeholder="Nome do usuário"
                />
              </div>
              <div>
                <label className="label">📧 Email *</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="input"
                  placeholder="email@empresa.com"
                />
              </div>
              <div>
                <label className="label">🔑 Senha</label>
                <input
                  type="text"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="input"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs sm:text-sm text-yellow-800">
                  ⚠️ O usuário receberá um email de confirmação.
                </p>
              </div>
            </div>
            <div className="p-3 sm:p-6 border-t bg-gray-50 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setNewUserName('');
                  setNewUserEmail('');
                  setNewUserPassword('Portal@123');
                }}
                className="btn btn-secondary order-2 sm:order-1"
                disabled={creating}
              >
                Cancelar
              </button>
              <button onClick={handleAddUser} disabled={creating} className="btn btn-primary order-1 sm:order-2">
                {creating ? <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <UserPlus size={18} className="sm:w-5 sm:h-5" />}
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
