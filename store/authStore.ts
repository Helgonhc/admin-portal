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
        await supabase.auth.signOut();
        set({ user: null, profile: null, isAuthenticated: false });
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
          set({ profile });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile && (profile.role === 'super_admin' || profile.role === 'admin' || profile.role === 'technician')) {
            set({ 
              user: session.user, 
              profile, 
              isAuthenticated: true,
              isLoading: false 
            });
            return;
          }
        }

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
