'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../lib/supabase';
import { useAuthStore } from '../../../../../store/authStore';
import { Shield, Save, Loader2, ArrowLeft, Eye, Plus, Edit, Trash2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

interface Permissions {
  can_view_all_orders: boolean;
  can_view_dashboard: boolean;
  can_view_reports: boolean;
  can_view_all_clients: boolean;
  can_create_orders: boolean;
  can_create_clients: boolean;
  can_create_equipments: boolean;
  can_create_quotes: boolean;        // NOVO: Criar orçamentos (sem ver valores)
  can_edit_own_orders: boolean;
  can_edit_all_orders: boolean;
  can_edit_clients: boolean;
  can_edit_equipments: boolean;
  can_delete_own_orders: boolean;
  can_delete_all_orders: boolean;
  can_delete_clients: boolean;
  can_assign_orders: boolean;
  can_manage_inventory: boolean;
  can_generate_reports: boolean;
  can_view_financials: boolean;      // Ver valores, aprovar, enviar orçamentos
}

// IMPORTANTE: Estes defaults DEVEM ser iguais aos do usePermissions.ts
// Técnicos começam com permissões RESTRITIVAS
const defaultPermissions: Permissions = {
  can_view_all_orders: false,      // Técnico só vê suas próprias OS
  can_view_dashboard: true,        // Pode ver dashboard básico
  can_view_reports: false,         // NÃO pode ver relatórios
  can_view_all_clients: false,     // NÃO pode ver todos os clientes
  can_create_orders: true,         // Pode criar OS
  can_create_clients: false,       // NÃO pode criar clientes
  can_create_equipments: false,    // NÃO pode criar equipamentos
  can_create_quotes: true,         // PODE criar orçamentos (coleta info no campo)
  can_edit_own_orders: true,       // Pode editar suas próprias OS
  can_edit_all_orders: false,      // NÃO pode editar OS de outros
  can_edit_clients: false,         // NÃO pode editar clientes
  can_edit_equipments: false,      // NÃO pode editar equipamentos
  can_delete_own_orders: false,    // NÃO pode deletar OS
  can_delete_all_orders: false,    // NÃO pode deletar OS de outros
  can_delete_clients: false,       // NÃO pode deletar clientes
  can_assign_orders: false,        // NÃO pode atribuir OS
  can_manage_inventory: false,     // NÃO pode gerenciar estoque
  can_generate_reports: false,     // NÃO pode gerar relatórios
  can_view_financials: false,      // NÃO pode ver valores/aprovar/enviar orçamentos
};

const templates = {
  junior: {
    // Técnico júnior - permissões mínimas
    can_view_all_orders: false,
    can_view_dashboard: true,
    can_view_reports: false,
    can_view_all_clients: false,
    can_create_orders: true,
    can_create_clients: false,
    can_create_equipments: false,
    can_create_quotes: true,         // Pode criar orçamentos (coleta info)
    can_edit_own_orders: true,
    can_edit_all_orders: false,
    can_edit_clients: false,
    can_edit_equipments: false,
    can_delete_own_orders: false,
    can_delete_all_orders: false,
    can_delete_clients: false,
    can_assign_orders: false,
    can_manage_inventory: false,
    can_generate_reports: false,
    can_view_financials: false,
  },
  senior: {
    // Técnico sênior - mais permissões
    can_view_all_orders: true,
    can_view_dashboard: true,
    can_view_reports: true,
    can_view_all_clients: true,
    can_create_orders: true,
    can_create_clients: true,
    can_create_equipments: true,
    can_create_quotes: true,         // Pode criar orçamentos
    can_edit_own_orders: true,
    can_edit_all_orders: true,
    can_edit_clients: true,
    can_edit_equipments: true,
    can_delete_own_orders: true,
    can_delete_all_orders: false,
    can_delete_clients: false,
    can_assign_orders: true,
    can_manage_inventory: true,
    can_generate_reports: true,
    can_view_financials: false,      // Ainda não pode ver valores
  },
  external: {
    // Técnico externo - só pode editar suas próprias OS
    can_view_all_orders: false,
    can_view_dashboard: false,
    can_view_reports: false,
    can_view_all_clients: false,
    can_create_orders: false,
    can_create_clients: false,
    can_create_equipments: false,
    can_create_quotes: false,        // Não pode criar orçamentos
    can_edit_own_orders: true,
    can_edit_all_orders: false,
    can_edit_clients: false,
    can_edit_equipments: false,
    can_delete_own_orders: false,
    can_delete_all_orders: false,
    can_delete_clients: false,
    can_assign_orders: false,
    can_manage_inventory: false,
    can_generate_reports: false,
    can_view_financials: false,
  },
};

export default function UserPermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { profile: currentUser } = useAuthStore();
  
  const [user, setUser] = useState<any>(null);
  const [permissions, setPermissions] = useState<Permissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  useEffect(() => {
    if (isAdmin && userId) {
      loadUser();
    }
  }, [isAdmin, userId]);

  async function loadUser() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, permissions')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data);
      if (data?.permissions) {
        setPermissions({ ...defaultPermissions, ...data.permissions });
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar usuário');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissions })
        .eq('id', userId);

      if (error) throw error;
      toast.success('Permissões salvas com sucesso!');
      router.push('/dashboard/users');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(template: 'junior' | 'senior' | 'external') {
    setPermissions(templates[template] as Permissions);
    toast.success(`Template "${template}" aplicado!`);
  }

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

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Usuário não encontrado</p>
      </div>
    );
  }

  const PermissionSwitch = ({ 
    label, 
    description, 
    permKey,
    icon 
  }: { 
    label: string; 
    description: string; 
    permKey: keyof Permissions;
    icon: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="text-gray-400">{icon}</div>
        <div>
          <p className="font-medium text-gray-800">{label}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={permissions[permKey]}
          onChange={(e) => setPermissions({ ...permissions, [permKey]: e.target.checked })}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
      </label>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.push('/dashboard/users')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="text-indigo-600" />
            Permissões de {user.full_name}
          </h1>
          <p className="text-gray-500">{user.email} • {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Administrador' : 'Técnico'}</p>
        </div>
      </div>

      {/* Templates Rápidos */}
      <div className="card p-4">
        <p className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
          <Zap size={16} className="text-yellow-500" />
          Templates Rápidos
        </p>
        <div className="flex gap-3">
          <button 
            onClick={() => applyTemplate('junior')}
            className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
          >
            🌱 Júnior
          </button>
          <button 
            onClick={() => applyTemplate('senior')}
            className="flex-1 py-2 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
          >
            ⭐ Sênior
          </button>
          <button 
            onClick={() => applyTemplate('external')}
            className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
          >
            🔒 Externo
          </button>
        </div>
      </div>

      {/* Seção: Visualização */}
      <div className="card overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
          <Eye size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-700">Visualização</h2>
        </div>
        <PermissionSwitch
          label="Ver todas as OS"
          description="Pode ver ordens de serviço de outros técnicos"
          permKey="can_view_all_orders"
          icon={<Eye size={20} />}
        />
        <PermissionSwitch
          label="Ver Dashboard"
          description="Pode acessar o dashboard com estatísticas"
          permKey="can_view_dashboard"
          icon={<Eye size={20} />}
        />
        <PermissionSwitch
          label="Ver Relatórios Gerais"
          description="Pode ver relatórios de todos os técnicos"
          permKey="can_view_reports"
          icon={<Eye size={20} />}
        />
        <PermissionSwitch
          label="Ver Todos os Clientes"
          description="Pode ver a lista completa de clientes"
          permKey="can_view_all_clients"
          icon={<Eye size={20} />}
        />
        <PermissionSwitch
          label="Ver Financeiro"
          description="Pode ver valores e informações financeiras"
          permKey="can_view_financials"
          icon={<Eye size={20} />}
        />
      </div>

      {/* Seção: Criação */}
      <div className="card overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
          <Plus size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-700">Criação</h2>
        </div>
        <PermissionSwitch
          label="Criar OS"
          description="Pode criar novas ordens de serviço"
          permKey="can_create_orders"
          icon={<Plus size={20} />}
        />
        <PermissionSwitch
          label="Criar Clientes"
          description="Pode cadastrar novos clientes"
          permKey="can_create_clients"
          icon={<Plus size={20} />}
        />
        <PermissionSwitch
          label="Criar Equipamentos"
          description="Pode cadastrar novos equipamentos"
          permKey="can_create_equipments"
          icon={<Plus size={20} />}
        />
        <PermissionSwitch
          label="Criar Orçamentos"
          description="Pode criar orçamentos (coletar informações no campo, sem ver valores)"
          permKey="can_create_quotes"
          icon={<Plus size={20} />}
        />
      </div>

      {/* Seção: Edição */}
      <div className="card overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
          <Edit size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-700">Edição</h2>
        </div>
        <PermissionSwitch
          label="Editar Próprias OS"
          description="Pode editar suas próprias ordens de serviço"
          permKey="can_edit_own_orders"
          icon={<Edit size={20} />}
        />
        <PermissionSwitch
          label="Editar Todas as OS"
          description="Pode editar ordens de serviço de outros técnicos"
          permKey="can_edit_all_orders"
          icon={<Edit size={20} />}
        />
        <PermissionSwitch
          label="Editar Clientes"
          description="Pode editar dados de clientes"
          permKey="can_edit_clients"
          icon={<Edit size={20} />}
        />
        <PermissionSwitch
          label="Editar Equipamentos"
          description="Pode editar equipamentos cadastrados"
          permKey="can_edit_equipments"
          icon={<Edit size={20} />}
        />
      </div>

      {/* Seção: Exclusão */}
      <div className="card overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
          <Trash2 size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-700">Exclusão</h2>
        </div>
        <PermissionSwitch
          label="Deletar Próprias OS"
          description="Pode deletar suas próprias ordens de serviço"
          permKey="can_delete_own_orders"
          icon={<Trash2 size={20} />}
        />
        <PermissionSwitch
          label="Deletar Todas as OS"
          description="Pode deletar qualquer ordem de serviço"
          permKey="can_delete_all_orders"
          icon={<Trash2 size={20} />}
        />
        <PermissionSwitch
          label="Deletar Clientes"
          description="Pode deletar clientes do sistema"
          permKey="can_delete_clients"
          icon={<Trash2 size={20} />}
        />
      </div>

      {/* Seção: Outras */}
      <div className="card overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
          <Shield size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-700">Outras Funcionalidades</h2>
        </div>
        <PermissionSwitch
          label="Atribuir OS"
          description="Pode atribuir ordens de serviço para outros técnicos"
          permKey="can_assign_orders"
          icon={<Shield size={20} />}
        />
        <PermissionSwitch
          label="Gerenciar Inventário"
          description="Pode gerenciar o estoque de peças e materiais"
          permKey="can_manage_inventory"
          icon={<Shield size={20} />}
        />
        <PermissionSwitch
          label="Gerar Relatórios"
          description="Pode gerar relatórios de suas ordens de serviço"
          permKey="can_generate_reports"
          icon={<Shield size={20} />}
        />
      </div>

      {/* Botão Salvar */}
      <div className="sticky bottom-4 flex justify-end">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="btn btn-primary px-8 py-3 shadow-lg"
        >
          {saving ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Save size={20} />
          )}
          Salvar Permissões
        </button>
      </div>
    </div>
  );
}
