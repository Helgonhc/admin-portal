'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/Sidebar';
import { Shield, Search, Bell } from 'lucide-react';
import { GlobalSearchModal } from '../../components/GlobalSearchModal';
import { NotificationDrawer } from '../../components/NotificationDrawer';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { ThemeToggle } from '../../components/ThemeToggle';

// Páginas que só admin pode acessar
const adminOnlyPages = ['/dashboard/users'];

// Páginas que requerem permissões específicas
const permissionPages: Record<string, string | string[]> = {
  '/dashboard/clients': 'can_view_all_clients',
  '/dashboard/equipments': 'can_create_equipments',
  '/dashboard/quotes': ['can_create_quotes', 'can_view_financials'],
  '/dashboard/maintenance': 'can_view_financials',
  '/dashboard/inventory': 'can_manage_inventory',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth, profile } = useAuthStore();
  const { unreadCount, notifications, refresh } = useRealtimeNotifications();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950">
        <div className="w-12 h-12 spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const content = (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Top Header Fixed */}
      <header className={`fixed top-0 right-0 left-0 ${collapsed ? 'lg:left-16' : 'lg:left-60'} z-30 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-all duration-300`}>
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Espaço para título da página ou busca se necessário */}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-all relative group"
              title="Notificações"
            >
              <Bell size={20} className="group-hover:scale-110 transition-transform" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-950">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto pt-14">
        <div className="max-w-[1600px] mx-auto p-3 sm:p-4 lg:p-6">
          {children}
        </div>
      </div>
    </div>
  );

  const LayoutWrapper = ({ content, sidebar = true }: { content: React.ReactNode, sidebar?: boolean }) => (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
      {sidebar && (
        <Sidebar
          onSearchClick={() => setIsSearchOpen(true)}
          onNotificationsClick={() => setIsNotificationsOpen(true)}
          unreadCount={unreadCount}
          collapsed={collapsed}
          onToggle={setCollapsed}
        />
      )}
      <main className="flex-1 overflow-auto relative">
        {content}
      </main>
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} notifications={notifications} unreadCount={unreadCount} refresh={refresh} />
    </div>
  );

  // Bloqueio total para usuários com role 'client' no portal admin
  if (profile?.role === 'client') {
    return <LayoutWrapper content={
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Shield className="w-20 h-20 text-red-500 mb-6 animate-pulse" />
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Acesso não Autorizado</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8 text-lg">
          Este portal é exclusivo para técnicos e administradores.
          Como cliente, você deve utilizar o portal dedicado às suas solicitações.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://eletricom-portal.vercel.app"
            className="btn btn-primary px-8 py-3 text-lg"
          >
            Ir para o Portal do Cliente (Eletricom OS)
          </a>
          <button
            onClick={() => {
              supabase.auth.signOut();
              router.push('/login');
            }}
            className="btn btn-secondary px-8 py-3 text-lg"
          >
            Sair e Fazer Login
          </button>
        </div>
      </div>
    } />;
  }

  // Bloqueios
  const isAdminOnlyPage = adminOnlyPages.some(page => pathname?.startsWith(page));
  const requiredPermission = Object.entries(permissionPages).find(([page]) => pathname?.startsWith(page))?.[1];
  let hasPermission = true;
  if (requiredPermission) {
    if (isAdmin) hasPermission = true;
    else if (Array.isArray(requiredPermission)) {
      hasPermission = requiredPermission.some(p => (profile?.permissions as any)?.[p] === true);
    } else {
      hasPermission = (profile?.permissions as any)?.[requiredPermission] === true;
    }
  }

  if (isAdminOnlyPage && !isAdmin) {
    return <LayoutWrapper content={
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Shield className="w-16 h-16 text-red-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-600 dark:text-gray-400">Acesso Restrito</h2>
        <p className="text-gray-500 mt-2">Esta página é exclusiva para administradores.</p>
        <button onClick={() => router.push('/dashboard')} className="btn btn-primary mt-4">Voltar ao Dashboard</button>
      </div>
    } />;
  }

  if (!hasPermission) {
    return <LayoutWrapper content={
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Shield className="w-16 h-16 text-amber-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-600 dark:text-gray-400">Permissão Necessária</h2>
        <p className="text-gray-500 mt-2">Você não tem permissão para acessar esta página.</p>
        <button onClick={() => router.push('/dashboard')} className="btn btn-primary mt-4">Voltar ao Dashboard</button>
      </div>
    } />;
  }

  return <LayoutWrapper content={content} />;
}
