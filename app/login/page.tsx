'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, LogIn, Loader2, AlertCircle } from 'lucide-react';
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
    <div className="min-h-screen flex bg-[#0f172a]">
      {/* Lado Esquerdo - Imagem Autêntica (Oculto em Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="/auth-bg.png"
          alt="Eletricom OS Maintenance"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay Indigo para unificar com a marca */}
        <div className="absolute inset-0 bg-indigo-900/40 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0f172a]/20 to-[#0f172a]" />

        {/* Conteúdo sobre a imagem - Minimalista e Profissional */}
        <div className="relative z-10 flex flex-col justify-end p-20 text-white h-full">
          <div className="max-w-md">
            <div className="flex flex-col mb-12 animate-logo-reveal">
              <img src="/logo-official.png" alt="Eletricom Logo" className="w-72 h-auto object-contain mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
              <div className="flex items-center gap-4 animate-fadeInUp" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
                <div className="w-12 h-px bg-indigo-500" />
                <span className="text-xs uppercase tracking-[6px] font-black text-white">
                  Industrial Intelligence
                </span>
              </div>
            </div>
            <p className="text-2xl text-indigo-100/90 leading-relaxed font-light animate-fadeInUp" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
              A inteligência por trás da sua <br />
              <span className="font-semibold text-white">Gestão Técnica.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário Profissional (Dark Theme) */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative">
        {/* Background blobs sutis */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[100px] -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 blur-[80px] -ml-32 -mb-32" />

        <div className="w-full max-w-md space-y-10 relative z-10">
          {/* Logo e Título */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-12 group animate-logo-reveal">
              <div className="absolute inset-x-0 -bottom-4 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
              <img
                src="/logo-official.png"
                alt="Eletricom OS"
                className="w-64 h-auto object-contain relative z-10 drop-shadow-[0_0_25px_rgba(255,255,255,0.1)] transition-transform group-hover:scale-105 duration-500"
              />
            </div>

            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 text-indigo-300 border border-white/10 mb-8 backdrop-blur-md animate-fadeInUp" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] uppercase font-black tracking-[3px]">Sistema de Gestão</span>
            </div>

            <h1 className="text-4xl font-black text-white tracking-tighter mb-2 animate-fadeInUp" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
              BEM-VINDO
            </h1>
            <p className="text-slate-400 font-light tracking-wide animate-fadeInUp" style={{ animationDelay: '0.7s', animationFillMode: 'both' }}>Acesse o portal administrativo da <span className="text-indigo-400 font-semibold">Eletricom</span></p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div className="group">
                <label className="text-sm font-semibold text-slate-300 ml-1 block mb-2 transition-colors group-focus-within:text-indigo-400">
                  Email Corporativo
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 px-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600"
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>

              <div className="group">
                <label className="text-sm font-semibold text-slate-300 ml-1 block mb-2 transition-colors group-focus-within:text-indigo-400">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 px-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-5 h-5 border-2 border-white/10 rounded-md peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all" />
                  <svg className="absolute top-0.5 left-0.5 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-slate-400 group-hover:text-slate-200 transition-colors">Lembrar login</span>
              </label>
              <a href="#" className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors decoration-indigo-400/30 hover:decoration-indigo-300">Esqueceu a senha?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg shadow-2xl shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <LogIn size={22} />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>
          </form>

          {/* Banner Informativo Dark */}
          <div className="p-5 bg-white/5 border border-white/10 rounded-3xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex gap-4 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                <AlertCircle size={20} className="text-amber-500" />
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                <strong className="text-amber-500 block mb-0.5">Acesso Restrito</strong>
                Este portal é para técnicos e admins. Clientes devem utilizar o <a href="https://chameiapp-portal.vercel.app/login" target="_blank" rel="noopener noreferrer" className="text-indigo-400 font-bold hover:underline">Portal do Cliente</a>.
              </p>
            </div>
          </div>

          {/* Footer Premium */}
          <div className="pt-10 flex flex-col items-center gap-4 border-t border-white/5 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

            <div className="flex flex-col items-center gap-1.5">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[3px] opacity-70 text-center">
                © {new Date().getFullYear()} Eletricom <br /> Manutenção Profissional
              </p>

              <div className="flex items-center gap-3">
                <p className="text-slate-400 text-[11px] font-medium tracking-tight">
                  Desenvolvido com <span className="text-indigo-500 font-serif mx-0.5 animate-pulse">✦</span> por
                  <span className="text-indigo-400 font-extrabold ml-1.5 hover:text-indigo-300 transition-colors cursor-default bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/10">
                    Helgon Henrique
                  </span>
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/5">
              <div className="w-1 h-1 rounded-full bg-green-500" />
              <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">System V1.5.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
