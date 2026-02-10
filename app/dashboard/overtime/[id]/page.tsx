'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useAuthStore } from '../../../../store/authStore';
import { ArrowLeft, Edit, Trash2, Check, X, Loader2, Clock, User, Calendar, FileDown } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { generateOvertimePDF } from '../../../../utils/pdfGenerator';

export default function OvertimeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [entry, setEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  useEffect(() => {
    loadEntry();
  }, [params.id]);

  async function loadEntry() {
    try {
      const { data, error } = await supabase
        .from('overtime_entries')
        .select('*, profiles!overtime_entries_user_id_fkey(full_name, cpf, cargo), approver:profiles!overtime_entries_approved_by_fkey(full_name)')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setEntry(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
      router.push('/dashboard/overtime');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!confirm('Aprovar este lançamento?')) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('overtime_entries')
        .update({
          status: 'aprovado',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Aprovado!');
      loadEntry();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    const reason = prompt('Motivo da rejeição:');
    if (!reason) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('overtime_entries')
        .update({
          status: 'rejeitado',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Rejeitado');
      loadEntry();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir este lançamento?')) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('overtime_entries')
        .delete()
        .eq('id', params.id);
      if (error) throw error;
      toast.success('Excluído!');
      router.push('/dashboard/overtime');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aprovado': return 'badge-success';
      case 'rejeitado': return 'badge-danger';
      default: return 'badge-warning';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'overtime': return '⏰ Hora Extra';
      case 'compensation': return '🔄 Compensação';
      case 'absence': return '❌ Ausência';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/overtime" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Detalhes do Lançamento</h1>
        </div>
        <button 
          onClick={() => generateOvertimePDF(entry)} 
          className="btn btn-secondary"
          title="Gerar PDF"
        >
          <FileDown size={18} /> PDF
        </button>
        <span className={`badge ${getStatusColor(entry.status)}`}>
          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
        </span>
      </div>

      {/* Main Info */}
      <div className="card">
        <div className="text-center mb-6">
          <p className="text-4xl font-bold text-indigo-600">{entry.total_hours}h</p>
          <p className="text-gray-500">{getTypeLabel(entry.entry_type)}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Calendar className="text-gray-400" size={20} />
            <div>
              <p className="text-xs text-gray-500">Data</p>
              <p className="font-medium">{new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Clock className="text-gray-400" size={20} />
            <div>
              <p className="text-xs text-gray-500">Horário</p>
              <p className="font-medium">{entry.start_time?.substring(0,5)} - {entry.end_time?.substring(0,5)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Employee */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">👤 Funcionário</h3>
        <p className="text-lg font-medium">{entry.profiles?.full_name}</p>
        {entry.profiles?.cargo && <p className="text-sm text-gray-500">Cargo: {entry.profiles.cargo}</p>}
        {entry.profiles?.cpf && <p className="text-sm text-gray-500">CPF: {entry.profiles.cpf}</p>}
      </div>

      {/* Reason */}
      {entry.reason && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">📝 Motivo</h3>
          <p className="text-gray-600">{entry.reason}</p>
        </div>
      )}

      {/* Approval Info */}
      {entry.status !== 'pendente' && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">
            {entry.status === 'aprovado' ? '✅ Aprovação' : '❌ Rejeição'}
          </h3>
          {entry.approver && <p className="text-sm">Por: {entry.approver.full_name}</p>}
          {entry.approved_at && <p className="text-sm text-gray-500">Em: {new Date(entry.approved_at).toLocaleString('pt-BR')}</p>}
          {entry.rejection_reason && (
            <div className="mt-2 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">Motivo: {entry.rejection_reason}</p>
            </div>
          )}
        </div>
      )}

      {/* Signatures */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">✍️ Assinaturas</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-2">Funcionário</p>
            {entry.employee_signature ? (
              <img src={entry.employee_signature} alt="Assinatura" className="max-h-20 mx-auto" />
            ) : (
              <p className="text-gray-400 text-sm">Pendente</p>
            )}
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-2">Aprovador</p>
            {entry.admin_signature ? (
              <img src={entry.admin_signature} alt="Assinatura" className="max-h-20 mx-auto" />
            ) : (
              <p className="text-gray-400 text-sm">Pendente</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {isAdmin && (
        <div className="flex flex-wrap gap-3">
          {entry.status === 'pendente' && (
            <>
              <button onClick={handleApprove} disabled={processing} className="btn btn-success flex-1">
                <Check size={20} /> Aprovar
              </button>
              <button onClick={handleReject} disabled={processing} className="btn btn-danger flex-1">
                <X size={20} /> Rejeitar
              </button>
            </>
          )}
          <button onClick={handleDelete} disabled={processing} className="btn btn-secondary">
            <Trash2 size={20} /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}
