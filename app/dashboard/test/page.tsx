'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';

export default function TestPage() {
  const { user, profile } = useAuthStore();
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runTests();
  }, []);

  async function runTests() {
    const testResults: any = {};

    // Teste 1: Verificar sessão
    try {
      const { data: session } = await supabase.auth.getSession();
      testResults.session = session?.session ? '✅ Sessão ativa' : '❌ Sem sessão';
      testResults.userId = session?.session?.user?.id || 'N/A';
    } catch (e: any) {
      testResults.session = '❌ Erro: ' + e.message;
    }

    // Teste 2: Buscar clientes
    try {
      const { data, error } = await supabase.from('clients').select('id, name').limit(3);
      if (error) throw error;
      testResults.clients = `✅ ${data?.length || 0} clientes encontrados`;
    } catch (e: any) {
      testResults.clients = '❌ Erro: ' + e.message;
    }

    // Teste 3: Buscar service_orders
    try {
      const { data, error } = await supabase.from('service_orders').select('id, title').limit(3);
      if (error) throw error;
      testResults.orders = `✅ ${data?.length || 0} OS encontradas`;
    } catch (e: any) {
      testResults.orders = '❌ Erro: ' + e.message;
    }

    // Teste 4: Buscar tickets
    try {
      const { data, error } = await supabase.from('tickets').select('id, title').limit(3);
      if (error) throw error;
      testResults.tickets = `✅ ${data?.length || 0} tickets encontrados`;
    } catch (e: any) {
      testResults.tickets = '❌ Erro: ' + e.message;
    }

    // Teste 5: Buscar profiles
    try {
      const { data, error } = await supabase.from('profiles').select('id, full_name, role').limit(3);
      if (error) throw error;
      testResults.profiles = `✅ ${data?.length || 0} perfis encontrados`;
    } catch (e: any) {
      testResults.profiles = '❌ Erro: ' + e.message;
    }

    // Teste 6: Buscar products
    try {
      const { data, error } = await supabase.from('products').select('id, name').limit(3);
      if (error) throw error;
      testResults.products = `✅ ${data?.length || 0} produtos encontrados`;
    } catch (e: any) {
      testResults.products = '❌ Erro: ' + e.message;
    }

    setResults(testResults);
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔧 Teste de Conexão Supabase</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-semibold mb-4">Usuário Logado:</h2>
        <p><strong>User ID:</strong> {user?.id || 'Não logado'}</p>
        <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
        <p><strong>Profile:</strong> {profile?.full_name || 'N/A'}</p>
        <p><strong>Role:</strong> {profile?.role || 'N/A'}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold mb-4">Resultados dos Testes:</h2>
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(results).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b pb-2">
                <span className="font-medium capitalize">{key}:</span>
                <span>{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button 
        onClick={() => { setLoading(true); runTests(); }}
        className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
      >
        Executar Testes Novamente
      </button>
    </div>
  );
}
