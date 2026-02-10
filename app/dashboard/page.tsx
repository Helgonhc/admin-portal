'use client';

import { useState, useEffect, useRef } from 'react';
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
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton, DashboardSkeleton } from '../../components/Skeleton';
import { getStatusColor, getStatusLabel } from '../../utils/statusUtils';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

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
  const [chartData, setChartData] = useState<any[]>([]);
  const [statusChartData, setStatusChartData] = useState<any[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const alertShown = useRef(false);


  const COLORS = ['#4f46e5', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

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
        supabase.from('active_maintenance_contracts').select('id, title, client_name, urgency_status, next_maintenance_date'),
      ]);

      const maintenanceVencidas = maintenanceData?.filter(m => m.urgency_status === 'vencido').length || 0;
      const maintenanceUrgentes = maintenanceData?.filter(m => m.urgency_status === 'urgente').length || 0;
      const maintenanceProximas = maintenanceData?.filter(m => m.urgency_status === 'proximo').length || 0;

      // Pegar os alertas críticos (vencidos e urgentes)
      const alerts = maintenanceData?.filter(m => m.urgency_status === 'vencido' || m.urgency_status === 'urgente')
        .sort((a, b) => {
          if (a.urgency_status === 'vencido' && b.urgency_status !== 'vencido') return -1;
          if (a.urgency_status !== 'vencido' && b.urgency_status === 'vencido') return 1;
          return 0;
        })
        .slice(0, 3) || [];

      setMaintenanceAlerts(alerts);

      if (alerts.length > 0 && !alertShown.current) {
        alertShown.current = true;
        const totalCriticas = maintenanceVencidas + maintenanceUrgentes;
        const msg = totalCriticas > 1 ? 'manutenções críticas' : 'manutenção crítica';

        // Limpar qualquer toast anterior com o mesmo ID antes de mostrar o novo
        toast.dismiss('msg-manutencao-critica');

        toast.error(`Atenção: Você tem ${totalCriticas} ${msg}!`, {
          id: 'msg-manutencao-critica',
          icon: '⚠️',
          duration: 6000
        });
      }

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

      // Dados para o Gráfico de Volume (Últimos 7 dias)
      const { data: last7DaysOrders } = await supabase
        .from('service_orders')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const dailyData = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
        const dateString = date.toISOString().split('T')[0];
        const count = last7DaysOrders?.filter(o => o.created_at.startsWith(dateString)).length || 0;
        return {
          day: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
          quantidade: count
        };
      });
      setChartData(dailyData);

      // Dados para o Gráfico de Status (Pie)
      const { data: allOrdersStatus } = await supabase.from('service_orders').select('status');
      const statusCounts: Record<string, number> = {};
      allOrdersStatus?.forEach(o => {
        const label = getStatusLabel(o.status);
        statusCounts[label] = (statusCounts[label] || 0) + 1;
      });
      const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
      setStatusChartData(pieData);

      setRecentOrders(orders || []);

      const { data: tickets } = await supabase
        .from('tickets')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentTickets(tickets || []);

      const { data: upcoming } = await supabase
        .from('appointment_requests')
        .select('*, clients(name)')
        .gte('requested_date', new Date().toISOString().split('T')[0])
        .order('requested_date', { ascending: true })
        .order('requested_time_start', { ascending: true })
        .limit(3);

      setUpcomingAppointments(upcoming || []);
    } catch (error: any) {
      console.error('💥 Erro ao carregar dashboard:', error);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  }

  async function updateAppointmentStatus(id: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('appointment_requests')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Agendamento ${newStatus === 'confirmed' ? 'confirmado' : 'atualizado'}!`);
      loadDashboard();
    } catch (error: any) {
      toast.error(error.message);
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

      {/* Lembretes / Próximos Agendamentos */}
      {upcomingAppointments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {upcomingAppointments.map((app) => (
            <div key={app.id} className="card border-l-4 border-l-indigo-500 bg-indigo-50/50 relative overflow-hidden group">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={10} /> {app.requested_date} às {app.requested_time_start}
                  </p>
                  <h4 className="font-bold text-gray-800 text-sm">{app.title || app.service_type}</h4>
                  <p className="text-xs text-gray-500">{app.clients?.name}</p>
                </div>
                {(app.status === 'pending' || app.status === 'pendente') && (
                  <button
                    onClick={() => updateAppointmentStatus(app.id, 'confirmed')}
                    className="p-1.5 bg-white text-emerald-600 rounded-lg shadow-sm border border-emerald-100 hover:bg-emerald-50 transition-colors"
                    title="Confirmar Agendamento"
                  >
                    <CheckCircle size={18} />
                  </button>
                )}
              </div>
              <div className="mt-3 flex justify-between items-center">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${app.status === 'confirmed' || app.status === 'confirmado' ? 'bg-green-100 text-green-700' :
                  app.status === 'pending' || app.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                  {app.status === 'pending' || app.status === 'pendente' ? 'Pendente' :
                    app.status === 'confirmed' || app.status === 'confirmado' ? 'Confirmado' : app.status}
                </span>
                <Link href="/dashboard/agenda" className="text-[10px] text-gray-400 hover:text-indigo-600 hover:underline">
                  Ver na agenda
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alertas de Manutenções Críticas */}
      {maintenanceAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {maintenanceAlerts.map((alert) => (
            <div key={alert.id} className={`card ${alert.urgency_status === 'vencido' ? 'border-l-4 border-l-red-500 bg-red-50/50' : 'border-l-4 border-l-amber-500 bg-amber-50/50'
              } relative overflow-hidden group`}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${alert.urgency_status === 'vencido' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                    {alert.urgency_status === 'vencido' ? <AlertCircle size={10} /> : <Clock size={10} />}
                    {alert.urgency_status === 'vencido' ? 'Manutenção Vencida' : 'Urgente (Próximos 7 dias)'}
                  </p>
                  <h4 className="font-bold text-gray-800 text-sm truncate max-w-[200px]">{alert.title}</h4>
                  <p className="text-xs text-gray-500">{alert.client_name}</p>
                </div>
                <Link
                  href={`/dashboard/maintenance`}
                  className={`p-1.5 rounded-lg shadow-sm border transition-colors ${alert.urgency_status === 'vencido' ? 'bg-white text-red-600 border-red-100 hover:bg-red-50' : 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50'
                    }`}
                >
                  <ChevronRight size={18} />
                </Link>
              </div>
              <div className="mt-3 flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold">
                  Data: {new Date(alert.next_maintenance_date).toLocaleDateString('pt-BR')}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${alert.urgency_status === 'vencido' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                  {alert.urgency_status === 'vencido' ? 'Vencida' : 'Urgente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600" />
            Volume de O.S. (Últimos 7 dias)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
                />
                <Bar dataKey="quantidade" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card text-responsive overflow-hidden">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ClipboardList size={18} className="text-indigo-600" />
            Distribuição por Status
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
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
