'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import {
  Users,
  Building2,
  Wrench,
  ClipboardList,
  Ticket,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalClients: number;
  totalEquipments: number;
  pendingOrders: number;
  openTickets: number;
  pendingOvertime: number;
  completedToday: number;
}

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      console.log('🏠 Carregando dashboard...');
      
      // Carregar estatísticas - usando status em português E inglês
      const [
        { count: totalClients, error: e1 },
        { count: totalEquipments, error: e2 },
        { count: pendingOrders, error: e3 },
        { count: openTickets, error: e4 },
        { count: pendingOvertime, error: e5 },
        { count: completedToday, error: e6 },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('equipments').select('*', { count: 'exact', head: true }),
        supabase.from('service_orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress', 'pendente', 'em_andamento']),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'aberto', 'em_analise']),
        supabase.from('overtime_entries').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('service_orders').select('*', { count: 'exact', head: true })
          .in('status', ['completed', 'concluido'])
          .gte('completed_at', new Date().toISOString().split('T')[0]),
      ]);

      console.log('📊 Stats:', { totalClients, totalEquipments, pendingOrders, openTickets });
      if (e1 || e2 || e3 || e4) console.error('Erros:', { e1, e2, e3, e4 });

      setStats({
        totalClients: totalClients || 0,
        totalEquipments: totalEquipments || 0,
        pendingOrders: pendingOrders || 0,
        openTickets: openTickets || 0,
        pendingOvertime: pendingOvertime || 0,
        completedToday: completedToday || 0,
      });

      // Carregar ordens recentes
      const { data: orders, error: ordersError } = await supabase
        .from('service_orders')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('📋 Ordens recentes:', orders?.length, ordersError);
      setRecentOrders(orders || []);

      // Carregar chamados recentes
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('🎫 Tickets recentes:', tickets?.length, ticketsError);
      setRecentTickets(tickets || []);

    } catch (error) {
      console.error('💥 Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'concluido':
      case 'resolved':
      case 'closed':
      case 'aprovado':
      case 'convertido':
        return 'badge-success';
      case 'in_progress':
      case 'em_andamento':
      case 'em_analise':
        return 'badge-info';
      case 'pending':
      case 'pendente':
      case 'open':
      case 'aberto':
        return 'badge-warning';
      case 'cancelled':
      case 'cancelado':
      case 'rejeitado':
        return 'badge-danger';
      default:
        return 'badge-gray';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      pendente: 'Pendente',
      in_progress: 'Em Andamento',
      em_andamento: 'Em Andamento',
      completed: 'Concluído',
      concluido: 'Concluído',
      cancelled: 'Cancelado',
      cancelado: 'Cancelado',
      open: 'Aberto',
      aberto: 'Aberto',
      em_analise: 'Em Análise',
      aprovado: 'Aprovado',
      rejeitado: 'Rejeitado',
      convertido: 'Convertido',
      resolved: 'Resolvido',
      closed: 'Fechado',
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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Olá, {profile?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500">Aqui está o resumo do seu dia</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Link href="/dashboard/clients" className="card card-hover">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats?.totalClients}</p>
              <p className="text-xs text-gray-500">Clientes</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/equipments" className="card card-hover">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Wrench className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats?.totalEquipments}</p>
              <p className="text-xs text-gray-500">Equipamentos</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/orders" className="card card-hover">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <ClipboardList className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats?.pendingOrders}</p>
              <p className="text-xs text-gray-500">OS Pendentes</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/tickets" className="card card-hover">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Ticket className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats?.openTickets}</p>
              <p className="text-xs text-gray-500">Chamados</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/overtime" className="card card-hover">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats?.pendingOvertime}</p>
              <p className="text-xs text-gray-500">Horas Pendentes</p>
            </div>
          </div>
        </Link>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats?.completedToday}</p>
              <p className="text-xs text-gray-500">Concluídas Hoje</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Ordens Recentes</h2>
            <Link href="/dashboard/orders" className="text-sm text-indigo-600 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="space-y-3">
            {recentOrders.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Nenhuma ordem encontrada</p>
            ) : (
              recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{order.title}</p>
                    <p className="text-xs text-gray-500">{order.clients?.name}</p>
                  </div>
                  <span className={`badge ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Chamados Recentes</h2>
            <Link href="/dashboard/tickets" className="text-sm text-indigo-600 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="space-y-3">
            {recentTickets.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Nenhum chamado encontrado</p>
            ) : (
              recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/dashboard/tickets/${ticket.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{ticket.title}</p>
                    <p className="text-xs text-gray-500">{ticket.clients?.name}</p>
                  </div>
                  <span className={`badge ${getStatusColor(ticket.status)}`}>
                    {getStatusLabel(ticket.status)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
