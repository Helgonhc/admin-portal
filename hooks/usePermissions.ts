import { useAuthStore } from '../store/authStore';

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

// Permissões padrão para TÉCNICOS (restritivas)
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

export function usePermissions() {
  const { profile } = useAuthStore();
  
  // Admin e Super Admin têm TODAS as permissões
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  
  // Se for admin, retorna tudo true
  if (isAdmin) {
    return {
      isAdmin: true,
      isSuperAdmin: profile?.role === 'super_admin',
      permissions: Object.keys(defaultPermissions).reduce((acc, key) => {
        acc[key as keyof Permissions] = true;
        return acc;
      }, {} as Permissions),
      can: (permission: keyof Permissions) => true,
    };
  }
  
  // Se for técnico, usa as permissões salvas ou default
  const userPermissions: Permissions = {
    ...defaultPermissions,
    ...(profile?.permissions as Partial<Permissions> || {}),
  };
  
  return {
    isAdmin: false,
    isSuperAdmin: false,
    permissions: userPermissions,
    can: (permission: keyof Permissions) => userPermissions[permission] ?? false,
  };
}
