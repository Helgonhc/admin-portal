'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/authStore';
import { ArrowLeft, Trash2, Loader2, Calendar, Send, Check, X, FileText, FileDown } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { generateQuotePDF } from '../../../../utils/pdfGenerator';

export default function QuoteDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadQuote();
  }, [params.id]);

  async function loadQuote() {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
            *,
            clients (name, phone, email, address, cnpj_cpf),
            profiles!quotes_created_by_fkey (full_name, signature_url),
            items:quote_items(*)
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setQuote(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
      router.push('/dashboard/quotes');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Status atualizado!');
      loadQuote();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir este orçamento?')) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Excluído!');
      router.push('/dashboard/quotes');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'badge-success';
      case 'sent': return 'badge-info';
      case 'draft': return 'badge-gray';
      case 'rejected': return 'badge-danger';
      default: return 'badge-gray';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Rascunho',
      sent: 'Enviado',
      approved: 'Aprovado',
      rejected: 'Rejeitado',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/quotes" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{quote.title}</h1>
          <p className="text-gray-500">{quote.clients?.name}</p>
        </div>
        <button
          onClick={() => generateQuotePDF(quote)}
          className="btn btn-secondary"
          title="Gerar PDF"
        >
          <FileDown size={18} /> PDF
        </button>
        <span className={`badge ${getStatusColor(quote.status)}`}>
          {getStatusLabel(quote.status)}
        </span>
      </div>

      {/* Total */}
      <div className="card bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
        <p className="text-sm opacity-80">Valor Total</p>
        <p className="text-4xl font-bold">
          R$ {quote.total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Info */}
      <div className="card">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Calendar className="text-gray-400" size={20} />
            <div>
              <p className="text-xs text-gray-500">Criado em</p>
              <p className="font-medium">{new Date(quote.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Calendar className="text-gray-400" size={20} />
            <div>
              <p className="text-xs text-gray-500">Válido até</p>
              <p className="font-medium">
                {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('pt-BR') : 'Sem validade'}
              </p>
            </div>
          </div>
        </div>

        {quote.description && (
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Descrição</h3>
            <p className="text-gray-600">{quote.description}</p>
          </div>
        )}
      </div>

      {/* Client */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">🏢 Cliente</h3>
        <p className="text-lg font-medium">{quote.clients?.name}</p>
        {quote.clients?.email && <p className="text-sm text-gray-500">📧 {quote.clients.email}</p>}
        {quote.clients?.phone && <p className="text-sm text-gray-500">📱 {quote.clients.phone}</p>}
        {quote.clients?.address && <p className="text-sm text-gray-500">📍 {quote.clients.address}</p>}
      </div>

      {/* Items */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">📦 Itens do Orçamento</h3>
        <div className="space-y-2">
          {quote.items && quote.items.map((item: any, index: number) => (
            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{item.description || `Item ${index + 1}`}</p>
                <p className="text-sm text-gray-500">Qtd: {item.quantity} x R$ {item.unit_price?.toFixed(2)}</p>
              </div>
              <p className="font-bold text-emerald-600">
                R$ {(item.quantity * item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Status Actions */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Alterar Status</h3>
        <div className="flex flex-wrap gap-2">
          {['draft', 'sent', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => updateStatus(status)}
              disabled={processing || quote.status === status}
              className={`btn ${quote.status === status ? 'btn-primary' : 'btn-secondary'}`}
            >
              {status === 'draft' && '📝'}
              {status === 'sent' && '📤'}
              {status === 'approved' && '✅'}
              {status === 'rejected' && '❌'}
              {' '}{getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {/* Delete */}
      <div className="flex justify-end">
        <button onClick={handleDelete} disabled={processing} className="btn btn-danger">
          <Trash2 size={20} /> Excluir Orçamento
        </button>
      </div>
    </div>
  );
}
