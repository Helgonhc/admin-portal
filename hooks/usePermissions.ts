import { useAuthStore } from '../store/authStore';

interface Permissions {
  can_view_all_orders: boolean;
  can_view_dashboard: boolean;
  can_view_reports: boolean;
  can_view_all_clients: boolean;
  can_create_orders: boolean;
  can_create_clients: boolean;
  can_create_equipments: boolean;
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
  can_view_financials: boolean;
}

const defaultPermissions: Permissions = {
  can_view_all_orders: false,
  can_view_dashboard: true,
  can_view_reports: false,
  can_view_all_clients: true,
  can_create_orders: true,
  can_create_clients: false,
  can_create_equipments: true,
  can_edit_own_orders: true,
  can_edit_all_orders: false,
  can_edit_clients: false,
  can_edit_equipments: true,
  can_delete_own_orders: false,
  can_delete_all_orders: false,
  can_delete_clients: false,
  can_assign_orders: false,
  can_manage_inventory: false,
  can_generate_reports: true,
  can_view_financials: false,
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
