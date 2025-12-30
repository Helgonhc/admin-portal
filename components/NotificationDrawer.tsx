'use client';

import { X, Bell, Check, Loader2, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
    id: string;
    type: string;
    title: string;
    body: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

interface NotificationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    unreadCount: number;
    refresh: () => void;
}

export function NotificationDrawer({ isOpen, onClose, notifications, unreadCount, refresh }: NotificationDrawerProps) {

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (!error) refresh();
    };

    const markAllAsRead = async () => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .is('is_read', false);

        if (!error) refresh();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex justify-end">
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl h-full flex flex-col animate-slideIn">
                <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2">
                        <Bell size={20} className="text-indigo-600" />
                        <h3 className="font-bold text-gray-800 dark:text-gray-100">Notificações</h3>
                        {unreadCount > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <Bell size={32} className="text-gray-300" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma notificação por aqui</p>
                            <p className="text-sm text-gray-400 mt-1">Avisaremos você quando algo importante acontecer.</p>
                        </div>
                    ) : (
                        <div className="divide-y dark:divide-gray-800">
                            {notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative group ${!n.is_read ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                                >
                                    {!n.is_read && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
                                    )}
                                    <div className="flex gap-3">
                                        <div className={`mt-1 p-2 rounded-lg shrink-0 ${n.type === 'alert' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                                            n.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                                                'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                            }`}>
                                            {n.type === 'alert' ? <AlertCircle size={16} /> :
                                                n.type === 'warning' ? <AlertTriangle size={16} /> :
                                                    <Info size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <p className={`text-sm font-semibold truncate ${n.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                                    {n.title}
                                                </p>
                                                {!n.is_read && (
                                                    <button
                                                        onClick={() => markAsRead(n.id)}
                                                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1 rounded hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Marcar como lida"
                                                    >
                                                        <Check size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                {n.body || n.message}
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-2 font-medium">
                                                {format(new Date(n.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {unreadCount > 0 && (
                    <div className="p-3 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                        <button
                            onClick={markAllAsRead}
                            className="w-full py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        >
                            Marcar tudo como lido
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
