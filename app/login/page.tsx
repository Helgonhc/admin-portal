'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AppConfig {
  company_name: string;
  logo_url: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, checkAuth } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    checkAuth();
    loadAppConfig();
  }, []);

  async function loadAppConfig() {
    const { data, error } = await supabase
      .from('app_config')
      .select('company_name, logo_url')
      .limit(1)
      .single();
    
    console.log('📦 App Config:', data, error);
    
    if (data) {
      setAppConfig(data);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Login realizado com sucesso!');
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full">
        {/* Logo e Nome da Empresa */}
        <div className="text-center mb-8">
          {appConfig?.logo_url ? (
            <img 
              src={appConfig.logo_url} 
              alt={appConfig.company_name || 'Logo'} 
              className="w-36 h-36 mx-auto mb-3 object-contain"
            />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
              <span className="text-white text-5xl">🔧</span>
            </div>
          )}
          {/* Developed by ChameiApp */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Developed by</span>
            <span className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">ChameiApp</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {appConfig?.company_name || 'Portal Admin'}
          </h1>
          <p className="text-gray-500 mt-1">Acesso para técnicos e administradores</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="seu@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="label">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-12"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary py-4 text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Entrando...
              </>
            ) : (
              <>
                <LogIn size={20} />
                Entrar
              </>
            )}
          </button>
        </form>

        {/* Aviso */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-amber-800 text-sm text-center">
            ⚠️ Este portal é exclusivo para <strong>técnicos</strong> e <strong>administradores</strong>.
            <br />
            Clientes devem acessar o{' '}
            <a 
              href="https://chameiapp-portal.vercel.app/login" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 font-semibold underline hover:text-indigo-800"
            >
              Portal do Cliente
            </a>.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-xs">
            © {new Date().getFullYear()} <span className="font-semibold text-indigo-500">ChameiApp</span>
          </p>
          <p className="text-gray-300 text-[10px] mt-1">
            Desenvolvido por <span className="font-medium text-gray-400">Helgon Henrique</span>
          </p>
        </div>
      </div>
    </div>
  );
}
