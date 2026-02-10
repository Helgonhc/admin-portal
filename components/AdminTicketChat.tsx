'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Send, Paperclip, User, Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
    id: string;
    message: string;
    sender_id: string;
    created_at: string;
    attachments?: string[];
    is_internal: boolean;
    sender?: {
        full_name: string;
        role: string;
    };
}

interface AdminTicketChatProps {
    ticketId: string;
}

export default function AdminTicketChat({ ticketId }: AdminTicketChatProps) {
    const { profile } = useAuthStore(); // Admin/Technician profile
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isInternal, setIsInternal] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadMessages();

        // Subscribe to realtime changes
        const channel = supabase
            .channel(`ticket_chat:${ticketId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'ticket_messages',
                filter: `ticket_id=eq.${ticketId}`
            }, (payload) => {
                const newMsg = payload.new as Message;
                // Need to fetch sender details
                fetchSenderAndAdd(newMsg);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [ticketId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    async function fetchSenderAndAdd(msg: Message) {
        const { data } = await supabase.from('profiles').select('full_name, role').eq('id', msg.sender_id).single();
        setMessages(prev => [...prev, { ...msg, sender: data }]);
    }

    async function loadMessages() {
        try {
            const { data, error } = await supabase
                .from('ticket_messages')
                .select(`
          *,
          sender:sender_id(full_name, role)
        `)
                .eq('ticket_id', ticketId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Error loading messages:', error);
            toast.error('Erro ao carregar chat');
        } finally {
            setLoading(false);
        }
    }

    async function handleSendMessage(e?: React.FormEvent) {
        if (e) e.preventDefault();
        if (!newMessage.trim()) return;

        setSending(true);
        try {
            const { error } = await supabase.from('ticket_messages').insert({
                ticket_id: ticketId,
                sender_id: profile?.id,
                message: newMessage.trim(),
                is_internal: isInternal,
                attachments: [] // Future: Handle uploads
            });

            if (error) throw error;
            setNewMessage('');
        } catch (error: any) {
            toast.error('Erro ao enviar mensagem');
            console.error(error);
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    Chat do Chamado
                    <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded-full">{messages.length}</span>
                </h3>
                <span className="text-xs text-gray-500">Visível para o cliente (exceto notas internas)</span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <p>Nenhuma mensagem ainda.</p>
                        <p className="text-sm">Inicie a conversa com o cliente ou deixe uma nota interna.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_id === profile?.id;
                        const isSystem = !msg.sender_id; // System messages if needed
                        const isInternalMsg = msg.is_internal;

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm relative group ${isInternalMsg
                                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                                        : isMe
                                            ? 'bg-indigo-600 text-white rounded-br-none'
                                            : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-bl-none'
                                    }`}>

                                    {/* Internal Badge */}
                                    {isInternalMsg && (
                                        <div className="absolute -top-2 -right-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-400 text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-700 flex items-center gap-1 shadow-sm">
                                            <Lock size={8} /> Interno
                                        </div>
                                    )}

                                    {/* Header */}
                                    <div className="flex justify-between items-center gap-4 mb-1">
                                        <span className={`text-xs font-bold ${isMe && !isInternalMsg ? 'text-indigo-100' : 'text-gray-600 dark:text-gray-300'}`}>
                                            {msg.sender?.full_name || 'Usuário'}
                                        </span>
                                        <span className={`text-[10px] ${isMe && !isInternalMsg ? 'text-indigo-200' : 'text-gray-400'}`}>
                                            {new Date(msg.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Body */}
                                    <p className={`text-sm whitespace-pre-wrap ${isMe && !isInternalMsg ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                                        {msg.message}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col gap-2">
                    {/* Controls */}
                    <div className="flex items-center gap-3 mb-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isInternal ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-600'}`} onClick={() => setIsInternal(!isInternal)}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isInternal ? 'translate-x-4' : ''}`} />
                            </div>
                            <span className={`text-xs font-semibold flex items-center gap-1 ${isInternal ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-500'}`}>
                                {isInternal ? <><Lock size={12} /> Nota Interna (Cliente não vê)</> : <><Eye size={12} /> Público (Cliente vê)</>}
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={isInternal ? "Escreva uma nota interna para a equipe..." : "Escreva uma resposta para o cliente..."}
                            className={`flex-1 input ${isInternal ? 'border-yellow-300 focus:ring-yellow-400 dark:border-yellow-700' : ''}`}
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={sending || !newMessage.trim()}
                            className={`btn px-4 ${isInternal ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-transparent' : 'btn-primary'}`}
                        >
                            {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
