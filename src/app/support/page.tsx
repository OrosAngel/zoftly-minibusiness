"use client";

import { useEffect, useState, useRef } from "react";
import { useStore } from "@/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Store, Bot } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

export default function SupportPage() {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [adminId, setAdminId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 100);
    };

    useEffect(() => {
        // Fetch Admin ID and messages
        const initChat = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // 1. Get the admin's ID
            const { data: adminData } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', 'ADMIN')
                .limit(1)
                .single();

            if (adminData) {
                setAdminId(adminData.id);
            }

            // 2. Fetch discussion with Admin
            const { data: msgData, error } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true }); // Ascending for chronological chat

            if (msgData) {
                setMessages(msgData);
            }

            // 3. Mark all messages sent by the admin as read
            const unreadIds = msgData?.filter(m => !m.is_read && m.sender_id === adminData?.id).map(m => m.id) || [];
            if (unreadIds.length > 0) {
                await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
            }

            setIsLoading(false);
            scrollToBottom();
        };

        initChat();

        // 4. Subscribe to Realtime new messages
        let subscription: any = null;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                subscription = supabase
                    .channel('public:messages:client')
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'messages' },
                        (payload) => {
                            const newMsg = payload.new;
                            // Add if it involves us, but ignore our own messages (realtime echo) since we optimistic update string
                            if (newMsg.sender_id !== session.user.id && (newMsg.sender_id === session.user.id || newMsg.receiver_id === session.user.id)) {
                                setMessages((prev) => [...prev, newMsg]);
                                scrollToBottom();
                            }
                        }
                    )
                    .subscribe();
            }
        });

        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, []);


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !adminId) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const tempMessage = {
            id: 'temp-' + Date.now(),
            sender_id: session.user.id,
            receiver_id: adminId,
            content: newMessage,
            created_at: new Date().toISOString(),
            is_read: false
        };

        // Optimistic UI updates
        setMessages((prev) => [...prev, tempMessage]);
        setNewMessage("");
        scrollToBottom();

        const { error } = await supabase.from('messages').insert([{
            sender_id: session.user.id,
            receiver_id: adminId,
            content: tempMessage.content
        }]);

        if (error) {
            console.error(error);
            toast.error("Error al enviar el mensaje");
            // Remove optimistic message
            setMessages((prev) => prev.filter(m => m.id !== tempMessage.id));
        }
    };

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-[var(--topbar-height)])] p-4 sm:p-8 max-w-5xl mx-auto w-full">
            <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Soporte Técnico</h2>
                <p className="text-slate-500">Comunícate directamente con el equipo de Zoftly.</p>
            </div>

            <Card className="flex-1 shrink-0 flex flex-col overflow-hidden shadow-sm border-slate-200">
                {/* Chat Header */}
                <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <Avatar className="h-10 w-10 border border-slate-200">
                        <AvatarImage src="/zoftly-avatar.png" />
                        <AvatarFallback className="bg-blue-600 text-white"><Bot className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">ZoftlyTech Support</span>
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            En línea
                        </span>
                    </div>
                </div>

                {/* Chat Area */}
                <ScrollArea className="flex-1 p-6 bg-white" ref={scrollRef}>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full text-slate-400">
                            Cargando mensajes...
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                            <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center">
                                <Bot className="h-8 w-8 text-blue-500" />
                            </div>
                            <p className="text-center font-medium">¡Hola! ¿En qué te podemos ayudar hoy?</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {messages.map((message, i) => {
                                const isMe = message.receiver_id === adminId; // Admin is receiver so I am sender
                                const showTime = i === 0 || new Date(message.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 1000 * 60 * 5;

                                return (
                                    <div key={message.id} className="flex flex-col">
                                        {showTime && (
                                            <span className="text-xs text-center text-slate-400 my-4 font-medium">
                                                {format(parseISO(message.created_at), "dd MMM, HH:mm", { locale: es })}
                                            </span>
                                        )}
                                        <div className={`flex items-end max-w-[80%] gap-2 ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}>
                                            {!isMe && (
                                                <Avatar className="h-6 w-6 shrink-0 mb-1">
                                                    <AvatarFallback className="bg-blue-600 text-[10px] text-white">ZT</AvatarFallback>
                                                </Avatar>
                                            )}

                                            <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe
                                                ? 'bg-blue-600 text-white rounded-br-sm shadow-md shadow-blue-600/10'
                                                : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200 shadow-sm'
                                                }`}>
                                                <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <Input
                            placeholder="Escribe tu mensaje aquí..."
                            className="bg-white focus-visible:ring-blue-600 border-slate-200"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={!adminId}
                        />
                        <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-700 shrink-0" disabled={!newMessage.trim() || !adminId}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </Card>
        </div>
    );
}
