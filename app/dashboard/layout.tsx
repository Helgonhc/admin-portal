'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import Sidebar from '../../components/Sidebar';
import { Shield } from 'lucide-react';

// Páginas que só admin pode acessar (settings NÃO está aqui - todos podem editar seu perfil)
const adminOnlyPages = ['/dashboard/users'];

// Páginas que requerem permissões específicas
// Pode ser string (uma permissão) ou array (qualquer uma das permissões)
const permissionPages: Record<string, string | string[]> = {
  '/dashboard/clients': 'can_view_all_clients',
  '/dashboard/equipments': 'can_create_equipments',
  '/dashboard/quotes': ['can_create_quotes', 'can_view_financials'], // Criar OU ver valores
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

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Verificar se é página só de admin
  const isAdminOnlyPage = adminOnlyPages.some(page => pathname?.startsWith(page));
  
  // Verificar permissão específica da página
  const requiredPermission = Object.entries(permissionPages).find(([page]) => pathname?.startsWith(page))?.[1];
  let hasPermission = true;
  if (requiredPermission) {
    if (isAdmin) {
      hasPermission = true;
    } else if (Array.isArray(requiredPermission)) {
      // Se for array, verifica se tem QUALQUER uma das permissões
      hasPermission = requiredPermission.some(p => (profile?.permissions as any)?.[p] === true);
    } else {
      hasPermission = (profile?.permissions as any)?.[requiredPermission] === true;
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-12 h-12 spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Bloquear acesso a páginas de admin para não-admins
  if (isAdminOnlyPage && !isAdmin) {
    return (
      <div className="min-h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4 lg:p-6 pt-14 sm:pt-16 lg:pt-6">
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Shield className="w-16 h-16 text-red-300 mb-4" />
              <h2 className="text-xl font-bold text-gray-600">Acesso Restrito</h2>
              <p className="text-gray-500 mt-2">Esta página é exclusiva para administradores.</p>
              <p className="text-sm text-gray-400 mt-1">Entre em contato com um administrador do sistema.</p>
              <button 
                onClick={() => router.push('/dashboard')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Bloquear acesso a páginas com permissão específica
  if (!hasPermission) {
    return (
      <div className="min-h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4 lg:p-6 pt-14 sm:pt-16 lg:pt-6">
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Shield className="w-16 h-16 text-amber-300 mb-4" />
              <h2 className="text-xl font-bold text-gray-600">Permissão Necessária</h2>
              <p className="text-gray-500 mt-2">Você não tem permissão para acessar esta página.</p>
              <p className="text-sm text-gray-400 mt-1">Solicite acesso a um administrador.</p>
              <button 
                onClick={() => router.push('/dashboard')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 lg:p-6 pt-14 sm:pt-16 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
