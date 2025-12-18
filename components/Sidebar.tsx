'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
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

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clientes', href: '/dashboard/clients', icon: Building2 },
  { name: 'Equipamentos', href: '/dashboard/equipments', icon: Wrench },
  { name: 'Ordens de Serviço', href: '/dashboard/orders', icon: ClipboardList },
  { name: 'Chamados', href: '/dashboard/tickets', icon: Ticket },
  { name: 'Orçamentos', href: '/dashboard/quotes', icon: Calculator },
  { name: 'Contratos', href: '/dashboard/maintenance', icon: FileCheck },
  { name: 'Agenda', href: '/dashboard/agenda', icon: Calendar },
  { name: 'Banco de Horas', href: '/dashboard/overtime', icon: Clock },
  { name: 'Estoque', href: '/dashboard/inventory', icon: Package },
  { name: 'Chat', href: '/dashboard/chat', icon: MessageSquare },
  { name: 'Notificações', href: '/dashboard/notifications', icon: Bell },
  { name: 'Baixar App', href: '/dashboard/download', icon: Download },
];

const adminItems = [
  { name: 'Usuários', href: '/dashboard/users', icon: UserCog },
  { name: 'Configurações', href: '/dashboard/settings', icon: Settings },
];

interface AppConfig {
  company_name: string;
  logo_url: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  // Carregar configurações da empresa
  useEffect(() => {
    async function loadAppConfig() {
      const { data, error } = await supabase
        .from('app_config')
        .select('company_name, logo_url')
        .limit(1)
        .single();
      
      console.log('📦 Sidebar Config:', data, error);
      
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
      {/* Logo e Nome da Empresa */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {appConfig?.logo_url ? (
            <img 
              src={appConfig.logo_url} 
              alt={appConfig.company_name || 'Logo'} 
              className="w-10 h-10 rounded-xl object-contain bg-white"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl">🔧</span>
            </div>
          )}
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-gray-800 truncate">
                {appConfig?.company_name || 'Portal Admin'}
              </h1>
              <p className="text-xs text-gray-500 truncate">{profile?.full_name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
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

        {/* Admin Section */}
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
