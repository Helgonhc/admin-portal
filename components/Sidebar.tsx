'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications';
import {
  LayoutDashboard,
  Users,
  Building2,
  Wrench,
  ClipboardList,
  FileText,
  MessageSquare,
  Bell,
  Package,
  Calendar,
  Clock,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Ticket,
  Calculator,
  UserCog,
  Download,
  FileCheck,
} from 'lucide-react';

// Menu items com permissões necessárias
// permission: null = todos podem ver
// permission: 'admin_only' = só admin
// permission: 'nome_permissao' = verifica permissão específica
// permission: ['perm1', 'perm2'] = verifica se tem QUALQUER uma das permissões
const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null },
  { name: 'Clientes', href: '/dashboard/clients', icon: Building2, permission: 'can_view_all_clients' },
  { name: 'Equipamentos', href: '/dashboard/equipments', icon: Wrench, permission: 'can_create_equipments' },
  { name: 'Ordens de Serviço', href: '/dashboard/orders', icon: ClipboardList, permission: null },
  { name: 'Chamados', href: '/dashboard/tickets', icon: Ticket, permission: null },
  { name: 'Orçamentos', href: '/dashboard/quotes', icon: Calculator, permission: ['can_create_quotes', 'can_view_financials'] }, // Criar OU ver valores
  { name: 'Manutenções Periódicas', href: '/dashboard/maintenance', icon: Calendar, permission: null }, // Todos podem ver
  { name: 'Agenda', href: '/dashboard/agenda', icon: Calendar, permission: null },
  { name: 'Banco de Horas', href: '/dashboard/overtime', icon: Clock, permission: null },
  { name: 'Estoque', href: '/dashboard/inventory', icon: Package, permission: 'can_manage_inventory' },
  { name: 'Chat', href: '/dashboard/chat', icon: MessageSquare, permission: null },
  { name: 'Notificações', href: '/dashboard/notifications', icon: Bell, permission: null, hasBadge: true },
  { name: 'Baixar App', href: '/dashboard/download', icon: Download, permission: null },
];

// Items que só admin pode ver
const adminItems = [
  { name: 'Usuários', href: '/dashboard/users', icon: UserCog },
];

// Item de perfil - todos podem ver
const profileItem = { name: 'Meu Perfil', href: '/dashboard/settings', icon: Settings };

interface AppConfig {
  company_name: string;
  logo_url: string;
  phone: string;
  email: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, logout } = useAuthStore();
  const { can, isAdmin } = usePermissions();
  const { unreadCount } = useRealtimeNotifications();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  // Carregar configurações da empresa
  useEffect(() => {
    async function loadAppConfig() {
      const { data, error } = await supabase
        .from('app_config')
        .select('company_name, logo_url, phone, email')
        .limit(1)
        .single();
      
      if (data) {
        setAppConfig(data);
      }
    }
    loadAppConfig();
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const SidebarContent = () => (
    <>
      {/* Header do Sidebar */}
      <div className={`${collapsed ? 'p-2' : 'p-4'} bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-b border-indigo-100`}>
        {collapsed ? (
          // Versão colapsada - só avatar do usuário
          <div className="flex justify-center">
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.full_name || 'Avatar'} 
                className="w-10 h-10 rounded-full object-cover border-2 border-indigo-300 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white text-sm font-bold">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
        ) : (
          // Versão expandida
          <div className="text-center">
            {/* Logo da Empresa (pequena) */}
            {appConfig?.logo_url && (
              <div className="flex justify-center mb-2">
                <img 
                  src={appConfig.logo_url} 
                  alt={appConfig.company_name || 'Logo'} 
                  className="h-10 object-contain"
                />
              </div>
            )}
            
            {/* Nome da Empresa */}
            <h1 className="font-bold text-gray-800 text-sm leading-tight mb-1">
              {appConfig?.company_name || 'Portal Admin'}
            </h1>
            
            {/* Telefone da empresa */}
            {appConfig?.phone && (
              <p className="text-xs text-gray-500 mb-2">📞 {appConfig.phone}</p>
            )}
            
            {/* Separador */}
            <div className="h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent my-3"></div>
            
            {/* Avatar e Info do Usuário Logado */}
            <div className="flex flex-col items-center">
              {/* Avatar Grande */}
              <div className="relative mb-2">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.full_name || 'Avatar'} 
                    className="w-16 h-16 rounded-full object-cover border-3 border-indigo-300 shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white text-2xl font-bold">
                      {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                {/* Badge de status online */}
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              
              {/* Nome do Usuário */}
              <p className="font-semibold text-gray-800 text-sm truncate max-w-[180px]">
                {profile?.full_name || 'Usuário'}
              </p>
              
              {/* Cargo/Role */}
              <span className={`text-xs px-2 py-0.5 rounded-full mt-1 ${
                profile?.role === 'super_admin' 
                  ? 'bg-purple-100 text-purple-700' 
                  : profile?.role === 'admin' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
              }`}>
                {profile?.role === 'super_admin' ? '⭐ Super Admin' : 
                 profile?.role === 'admin' ? '👑 Administrador' : '🔧 Técnico'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          // Verificar permissão - suporta null, string ou array de strings
          let hasPermission = true;
          if (item.permission !== null) {
            if (Array.isArray(item.permission)) {
              // Se for array, verifica se tem QUALQUER uma das permissões
              hasPermission = item.permission.some(p => can(p as any));
            } else {
              hasPermission = can(item.permission as any);
            }
          }
          if (!hasPermission) return null;
          
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? item.name : undefined}
            >
              <div className="relative">
                <item.icon size={20} />
                {(item as any).hasBadge && unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        {/* Meu Perfil - TODOS podem ver */}
        <div className={`pt-4 pb-2 ${collapsed ? 'hidden' : ''}`}>
          <p className="px-4 text-xs font-semibold text-gray-400 uppercase">Conta</p>
        </div>
        <Link
          href={profileItem.href}
          onClick={() => setMobileOpen(false)}
          className={`sidebar-item ${pathname === profileItem.href || pathname.startsWith(profileItem.href + '/') ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
          title={collapsed ? profileItem.name : undefined}
        >
          <profileItem.icon size={20} />
          {!collapsed && <span>{profileItem.name}</span>}
        </Link>

        {/* Admin Section - só admin vê */}
        {isAdmin && (
          <>
            <div className={`pt-4 pb-2 ${collapsed ? 'hidden' : ''}`}>
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase">Admin</p>
            </div>
            {adminItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`sidebar-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon size={20} />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className={`sidebar-item text-red-600 hover:bg-red-50 hover:text-red-700 w-full ${collapsed ? 'justify-center px-2' : ''}`}
        >
          <LogOut size={20} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button - Lado ESQUERDO */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2.5 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700"
      >
        <Menu size={22} />
      </button>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col animate-slideIn">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent />
        
        {/* Collapse Button - Posicionado dentro do sidebar, não fora */}
        <div className="absolute bottom-24 right-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 rounded-full flex items-center justify-center shadow-sm transition-colors"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight size={16} className="text-indigo-600" /> : <ChevronLeft size={16} className="text-indigo-600" />}
          </button>
        </div>
      </aside>
    </>
  );
}
