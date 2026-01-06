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
    <div className="max-w-[1600px] mx-auto p-2 sm:p-3 lg:p-3 pt-14 sm:pt-16 lg:pt-4 pb-20 sm:pb-4">
      {children}
    </div>
  );

  const LayoutWrapper = ({ content, sidebar = true }: { content: React.ReactNode, sidebar?: boolean }) => (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
      {sidebar && (
        <Sidebar
          onSearchClick={() => setIsSearchOpen(true)}
          onNotificationsClick={() => setIsNotificationsOpen(true)}
          unreadCount={unreadCount}
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
