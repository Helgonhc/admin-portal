import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  message: string
  is_read: boolean
  created_at: string
  reference_id?: string
}

export function useRealtimeNotifications() {
  const { profile } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = useCallback(async () => {
    if (!profile?.id) return

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.is_read).length || 0)
    } catch (error) {
      console.error('Erro ao carregar notificações:', error)
    }
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return

    loadNotifications()

    // Inscrever para atualizações em tempo real
    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications(prev => [newNotification, ...prev].slice(0, 20))
          setUnreadCount(prev => prev + 1)
          
          // Mostrar toast
          toast(newNotification.title, {
            icon: '🔔',
            duration: 5000,
            style: {
              background: '#4F46E5',
              color: '#fff',
            },
          })

          // Notificação do navegador
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(newNotification.title, {
              body: newNotification.body || newNotification.message,
              icon: '/icon.png'
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    // Pedir permissão para notificações do navegador
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, loadNotifications])

  return {
    notifications,
    unreadCount,
    refresh: loadNotifications
  }
}
