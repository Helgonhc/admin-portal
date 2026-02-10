'use client';

import { useState, useEffect } from 'react';
import { supabase, Notification } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { Bell, Check, CheckCheck, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const { profile } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadNotifications();
    }
  }, [profile?.id]);

  async function loadNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
      loadNotifications();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile?.id)
        .eq('is_read', false);
      if (error) throw error;
      toast.success('Todas marcadas como lidas');
      loadNotifications();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function deleteNotification(id: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
      loadNotifications();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'ticket': return '🎫';
      case 'order': return '📋';
      case 'quote': return '💰';
      case 'overtime': return '⏰';
      case 'chat': return '💬';
      default: return '🔔';
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
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notificações</h1>
          <p className="text-gray-500">
            {unreadCount > 0 ? `${unreadCount} não lidas` : 'Todas lidas'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="btn btn-secondary">
            <CheckCheck size={20} />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="card text-center py-12">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Nenhuma notificação</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`card card-hover flex items-start gap-4 ${
                !notification.is_read ? 'border-l-4 border-l-indigo-500 bg-indigo-50/50' : ''
              }`}
            >
              <div className="text-2xl">{getTypeIcon(notification.type)}</div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                  {notification.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{notification.body || notification.message}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(notification.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!notification.is_read && (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                    title="Marcar como lida"
                  >
                    <Check size={18} />
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(notification.id)}
                  className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                  title="Excluir"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
