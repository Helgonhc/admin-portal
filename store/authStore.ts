import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, Profile } from '../lib/supabase';

interface AuthState {
  user: any | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setProfile: (profile: Profile) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      isLoading: true,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            return { error: error.message };
          }

          if (data.user) {
            // Buscar perfil
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            // Verificar se é super_admin, admin ou técnico
            if (profile && (profile.role === 'super_admin' || profile.role === 'admin' || profile.role === 'technician')) {
              set({
                user: data.user,
                profile,
                isAuthenticated: true,
                isLoading: false
              });
              return {};
            } else {
              await supabase.auth.signOut();
              return { error: 'Acesso permitido apenas para administradores e técnicos.' };
            }
          }

          return { error: 'Erro ao fazer login' };
        } catch (error: any) {
          return { error: error.message };
        }
      },

      logout: async () => {
        // 1. Fazer signOut no Supabase PRIMEIRO (isso limpa a sessão do Supabase)
        await supabase.auth.signOut({ scope: 'global' });

        // 2. Limpar estado do Zustand
        set({ user: null, profile: null, isAuthenticated: false, isLoading: false });

        // 3. Limpar TODOS os storages relacionados
        if (typeof window !== 'undefined') {
          // Limpar nosso storage
          localStorage.removeItem('admin-auth-storage');

          // Limpar storage do Supabase (pode ter vários nomes)
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('supabase') || key.includes('sb-'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));

          // Limpar sessionStorage também
          sessionStorage.clear();
        }
      },

      loadProfile: async () => {
        const { user } = get();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          // Garantir que o email do perfil esteja sincronizado com o do usuário de auth
          const updatedProfile = { ...profile, email: user.email || profile.email };
          set({ profile: updatedProfile });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });

        // Verificar se existe sessão válida no Supabase
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile && (profile.role === 'super_admin' || profile.role === 'admin' || profile.role === 'technician')) {
            // Sincronizar email do perfil com email da sessão
            const updatedProfile = { ...profile, email: session.user.email || profile.email };
            set({
              user: session.user,
              profile: updatedProfile,
              isAuthenticated: true,
              isLoading: false
            });
            return;
          }
        }

        // Não há sessão válida - limpar tudo
        set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
      },

      setProfile: (profile: Profile) => {
        set({ profile });
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
