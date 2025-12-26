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
  Calendar,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton, DashboardSkeleton } from '../../components/Skeleton';
import { getStatusColor, getStatusLabel } from '../../utils/statusUtils';

interface DashboardStats {
  totalClients: number;
  totalEquipments: number;
  pendingOrders: number;
  openTickets: number;
  pendingOvertime: number;
  completedToday: number;
  maintenanceVencidas: number;
  maintenanceUrgentes: number;
  maintenanceProximas: number;
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

      const [
        { count: totalClients },
        { count: totalEquipments },
        { count: pendingOrders },
        { count: openTickets },
        { count: pendingOvertime },
        { count: completedToday },
        { data: maintenanceData },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('equipments').select('*', { count: 'exact', head: true }),
        supabase.from('service_orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress', 'pendente', 'em_andamento']),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'aberto', 'em_analise']),
        supabase.from('overtime_entries').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('service_orders').select('*', { count: 'exact', head: true })
          .in('status', ['completed', 'concluido'])
          .gte('completed_at', new Date().toISOString().split('T')[0]),
        supabase.from('active_maintenance_contracts').select('urgency_status'),
      ]);

      const maintenanceVencidas = maintenanceData?.filter(m => m.urgency_status === 'vencido').length || 0;
      const maintenanceUrgentes = maintenanceData?.filter(m => m.urgency_status === 'urgente').length || 0;
      const maintenanceProximas = maintenanceData?.filter(m => m.urgency_status === 'proximo').length || 0;

      setStats({
        totalClients: totalClients || 0,
        totalEquipments: totalEquipments || 0,
        pendingOrders: pendingOrders || 0,
        openTickets: openTickets || 0,
        pendingOvertime: pendingOvertime || 0,
        completedToday: completedToday || 0,
        maintenanceVencidas,
        maintenanceUrgentes,
        maintenanceProximas,
      });

      const { data: orders } = await supabase
        .from('service_orders')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentOrders(orders || []);

      const { data: tickets } = await supabase
        .from('tickets')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentTickets(tickets || []);

    } catch (error) {
      console.error('💥 Erro ao carregar dashboard:', error);
    } finally {
      // Pequeno delay para suavizar a transição do skeleton
      setTimeout(() => setLoading(false), 500);
    }
  }

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Olá, {profile?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500">Aqui está o resumo operacional de hoje</p>
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

      {/* Alertas de Manutenções */}
      {(stats?.maintenanceVencidas || 0) + (stats?.maintenanceUrgentes || 0) > 0 && (
        <div className="card border-l-4 border-l-red-500 bg-red-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Bell className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-800">⚠️ Atenção: Manutenções Pendentes!</h3>
                <p className="text-sm text-red-600">
                  {stats?.maintenanceVencidas || 0} vencidas • {stats?.maintenanceUrgentes || 0} urgentes (próximos 7 dias)
                </p>
              </div>
            </div>
            <Link href="/dashboard/maintenance" className="btn btn-sm bg-red-600 hover:bg-red-700 text-white">
              Ver Manutenções
            </Link>
          </div>
        </div>
      )}

      {/* Stats de Manutenções */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/maintenance" className="card card-hover border-l-4 border-l-red-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats?.maintenanceVencidas || 0}</p>
              <p className="text-xs text-gray-500">Manutenções Vencidas</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/maintenance" className="card card-hover border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats?.maintenanceUrgentes || 0}</p>
              <p className="text-xs text-gray-500">Urgentes (7 dias)</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/maintenance" className="card card-hover border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats?.maintenanceProximas || 0}</p>
              <p className="text-xs text-gray-500">Próximas (30 dias)</p>
            </div>
          </div>
        </Link>
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
