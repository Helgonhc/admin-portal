'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Download, Smartphone, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface AppConfig {
  apk_url?: string;
  apk_version?: string;
  apk_updated_at?: string;
}

export default function DownloadPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('apk_url, apk_version, apk_updated_at')
        .limit(1)
        .single();

      setConfig(data);
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDownload = () => {
    if (config?.apk_url) {
      window.open(config.apk_url, '_blank');
      toast.success('Download iniciado!');
    } else {
      toast.error('Link do APK não configurado');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Download do Aplicativo</h1>
        <p className="text-gray-500">Baixe o app para seu celular Android</p>
      </div>

      {/* Download Card */}
      <div className="card text-center">
        {/* App Icon */}
        <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg">
          <span className="text-5xl">🔧</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-2">Eletricom OS</h2>
        <p className="text-gray-500 mb-6">Eficiência e Controle em Manutenção Especializada</p>

        {/* Version Info */}
        {config?.apk_version && (
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <CheckCircle size={16} />
            Versão {config.apk_version}
          </div>
        )}

        {/* Download Button */}
        {config?.apk_url ? (
          <button
            onClick={handleDownload}
            className="w-full btn btn-primary py-4 text-lg mb-6"
          >
            <Download size={24} />
            Baixar APK para Android
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertCircle size={20} />
              <p>Link do APK não configurado. Entre em contato com o administrador.</p>
            </div>
          </div>
        )}

        {/* Last Update */}
        {config?.apk_updated_at && (
          <p className="text-sm text-gray-400">
            Última atualização: {new Date(config.apk_updated_at).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      {/* Instructions */}
      <div className="card mt-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Smartphone size={20} />
          Como instalar
        </h3>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
            <span className="text-gray-600">Clique no botão "Baixar APK" acima</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
            <span className="text-gray-600">Abra o arquivo baixado no seu celular</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
            <span className="text-gray-600">Se solicitado, permita a instalação de fontes desconhecidas nas configurações</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
            <span className="text-gray-600">Após instalar, abra o app e faça login com seu email e senha</span>
          </li>
        </ol>
      </div>

      {/* Features */}
      <div className="card mt-6">
        <h3 className="font-semibold text-gray-800 mb-4">✨ Funcionalidades do App</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '📋', text: 'Ordens de Serviço' },
            { icon: '🔧', text: 'Equipamentos' },
            { icon: '💰', text: 'Orçamentos' },
            { icon: '📅', text: 'Agenda' },
            { icon: '⏰', text: 'Banco de Horas' },
            { icon: '📦', text: 'Estoque' },
            { icon: '💬', text: 'Chat' },
            { icon: '🔔', text: 'Notificações' },
            { icon: '✍️', text: 'Assinatura Digital' },
            { icon: '📊', text: 'Relatórios PDF' },
            { icon: '📷', text: 'Fotos' },
            { icon: '📱', text: 'QR Code' },
          ].map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-gray-600 text-sm">
              <span>{feature.icon}</span>
              <span>{feature.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements */}
      <div className="card mt-6 bg-gray-50">
        <h3 className="font-semibold text-gray-800 mb-3">📱 Requisitos</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Android 6.0 ou superior</li>
          <li>• 100MB de espaço livre</li>
          <li>• Conexão com internet</li>
        </ul>
      </div>
    </div>
  );
}
