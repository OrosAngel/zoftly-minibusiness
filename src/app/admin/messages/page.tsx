"use client";

import { useEffect, useState, useRef } from "react";
import { useStore } from "@/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Store, Search, MessageSquareX, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

interface ClientContact {
    id: string;
    full_name: string;
    store_name?: string;
    unread_count: number;
    last_message?: string;
}

export default function AdminMessagesPage() {
    const userRole = useStore((state) => state.userRole);
    const [clients, setClients] = useState<ClientContact[]>([]);
    const [filteredClients, setFilteredClients] = useState<ClientContact[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [adminId, setAdminId] = useState<string | null>(null);

    // Chat state
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 100);
    };

    useEffect(() => {
        if (userRole !== 'ADMIN') return;

        let isMounted = true;

        const loadDashboard = async () => {
            setIsLoadingContacts(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                if (isMounted) setIsLoadingContacts(false);
                return;
            }
            if (isMounted) setAdminId(session.user.id);

            // 1. Fetch all business owners
            const { data: profiles, error: pErr } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'BUSINESS_OWNER');

            // 2. Fetch their stores for context
            const { data: stores } = await supabase
                .from('stores')
                .select('owner_id, name');

            // 3. Fetch unread counts per user
            const { data: unreadMsg } = await supabase
                .from('messages')
                .select('sender_id, content')
                .eq('is_read', false)
                .eq('receiver_id', session.user.id);

            if (profiles && isMounted) {
                const contacts: ClientContact[] = profiles.map(p => {
                    const store = stores?.find(s => s.owner_id === p.id);
                    const unreadForUser = unreadMsg?.filter(m => m.sender_id === p.id) || [];

                    return {
                        id: p.id,
                        full_name: p.full_name || 'Sin nombre',
                        store_name: store?.name,
                        unread_count: unreadForUser.length,
                        last_message: unreadForUser.length > 0 ? unreadForUser[unreadForUser.length - 1].content : undefined
                    };
                });

                // Sort: Unread first, then alphabetical safely
                contacts.sort((a, b) => {
                    if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
                    const nameA = a.full_name || '';
                    const nameB = b.full_name || '';
                    return nameA.localeCompare(nameB);
                });

                setClients(contacts);
                setFilteredClients(contacts);
            }
            if (isMounted) setIsLoadingContacts(false);
        };

        loadDashboard();

        // 4. Global Subscription to messages to update unread counts and incoming chat
        let subscription: any = null;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && isMounted) {
                subscription = supabase
                    .channel('public:messages:admin')
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'messages' },
                        (payload) => {
                            const newMsg = payload.new;

                            // Let's rely on a callback for state to use the LATEST selectedClientId 
                            // without putting selectedClientId in the dependency array (which causes re-renders)
                            setSelectedClientId((currentSelectedId) => {
                                if (newMsg.sender_id === currentSelectedId || newMsg.receiver_id === currentSelectedId) {
                                    // Only add it if we are not the sender (prevent echo duplication from our optimistic update)
                                    if (newMsg.sender_id !== session.user.id) {
                                        setMessages((prev) => [...prev, newMsg]);
                                        scrollToBottom();
                                    }

                                    // Auto-read if we are looking at it
                                    if (newMsg.sender_id === currentSelectedId) {
                                        supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id).then();
                                    }
                                } else if (newMsg.receiver_id === session.user.id) {
                                    // Add unread badge to the appropriate client in the sidebar
                                    setClients(prev => {
                                        const updated = prev.map(c =>
                                            c.id === newMsg.sender_id
                                                ? { ...c, unread_count: c.unread_count + 1, last_message: newMsg.content }
                                                : c
                                        );
                                        // Resort array to push unread to top
                                        updated.sort((a, b) => {
                                            if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
                                            return (a.full_name || '').localeCompare(b.full_name || '');
                                        });
                                        return updated;
                                    });
                                }
                                return currentSelectedId; // return unchanged
                            });
                        }
                    )
                    .subscribe();
            }
        });

        return () => {
            isMounted = false;
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [userRole]); // Removed selectedClientId down to prevent full re-fetches

    // Handle Client Search
    useEffect(() => {
        const lowerQ = searchQuery.toLowerCase();
        setFilteredClients(clients.filter(c =>
            c.full_name.toLowerCase().includes(lowerQ) ||
            (c.store_name && c.store_name.toLowerCase().includes(lowerQ))
        ));
    }, [searchQuery, clients]);

    // Load Chat History
    const handleSelectClient = async (clientId: string) => {
        setSelectedClientId(clientId);
        setIsLoadingChat(true);

        // Clear their unread count in UI
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, unread_count: 0 } : c));

        const { data: msgData } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${adminId},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${adminId})`)
            .order('created_at', { ascending: true });

        if (msgData) {
            setMessages(msgData);

            // Mark all their messages as read
            const unreadIds = msgData.filter(m => !m.is_read && m.sender_id === clientId).map(m => m.id);
            if (unreadIds.length > 0) {
                await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
            }
        }

        setIsLoadingChat(false);
        scrollToBottom();
    };


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedClientId || !adminId) return;

        const tempMessage = {
            id: 'temp-' + Date.now(),
            sender_id: adminId,
            receiver_id: selectedClientId,
            content: newMessage,
            created_at: new Date().toISOString(),
            is_read: false
        };

        // Optimistic UI update
        setMessages((prev) => [...prev, tempMessage]);
        setNewMessage("");
        scrollToBottom();

        const { error } = await supabase.from('messages').insert([{
            sender_id: adminId,
            receiver_id: selectedClientId,
            content: tempMessage.content
        }]);

        if (error) {
            toast.error("Error al enviar el mensaje");
            setMessages((prev) => prev.filter(m => m.id !== tempMessage.id));
        }
    };

    if (userRole !== 'ADMIN') {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <p className="text-red-600 font-bold">Acceso Denegado</p>
            </div>
        );
    }

    const selectedClientData = clients.find(c => c.id === selectedClientId);

    return (
        <div className="flex-1 flex h-[calc(100vh-[var(--topbar-height)])] bg-slate-50">
            {/* Left Sidebar - Contact List */}
            <div className="w-80 md:w-96 flex flex-col bg-white border-r border-slate-200 shrink-0">
                <div className="p-4 border-b border-slate-100 flex flex-col gap-4">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-900">Mensajes</h2>
                        <p className="text-xs text-slate-500">Soporte a clientes</p>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar cliente o negocio..."
                            className="pl-9 bg-slate-50 border-slate-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    {isLoadingContacts ? (
                        <div className="p-8 text-center text-sm text-slate-400">Cargando clientes...</div>
                    ) : filteredClients.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-400">No se encontraron clientes.</div>
                    ) : (
                        <div className="flex flex-col">
                            {filteredClients.map((client) => (
                                <button
                                    key={client.id}
                                    onClick={() => handleSelectClient(client.id)}
                                    className={`flex items-start gap-3 p-4 text-left transition-colors border-b border-slate-50 hover:bg-slate-50 ${selectedClientId === client.id ? 'bg-blue-50/50 hover:bg-blue-50/50' : ''
                                        }`}
                                >
                                    <Avatar className="h-10 w-10 shrink-0 border border-slate-200">
                                        <AvatarFallback className="bg-slate-100 text-slate-600 font-semibold">
                                            {client.full_name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="font-semibold text-sm text-slate-900 truncate">
                                                {client.full_name}
                                            </span>
                                            {client.unread_count > 0 && (
                                                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center">
                                                    {client.unread_count}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs font-medium text-slate-500 truncate mb-1">
                                            <Store className="inline-block w-3 h-3 mr-1 -mt-0.5" />
                                            {client.store_name || "Sin negocio registrado"}
                                        </div>
                                        {client.last_message && (
                                            <p className={`text-xs truncate ${client.unread_count > 0 ? 'text-blue-600 font-medium' : 'text-slate-400'}`}>
                                                {client.last_message}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Right Side - Chat Area */}
            <div className="flex-1 flex flex-col bg-slate-50/50">
                {selectedClientId ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 shrink-0 border-b border-slate-200 bg-white flex items-center justify-between px-6">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-slate-200">
                                    <AvatarFallback className="bg-slate-100 text-slate-600 font-semibold">
                                        {selectedClientData?.full_name.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-semibold text-sm text-slate-900">{selectedClientData?.full_name}</h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {selectedClientData?.store_name || "Dueño de Negocio"}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                                <PhoneCall className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Messages Area */}
                        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                            {isLoadingChat ? (
                                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                                    Cargando historial...
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                                    <MessageSquareX className="h-10 w-10 text-slate-300" />
                                    <p className="text-sm">Aún no hay mensajes con este cliente.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {messages.map((message, i) => {
                                        const isAdmin = message.sender_id === adminId;
                                        const showTime = i === 0 || new Date(message.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 1000 * 60 * 5;

                                        return (
                                            <div key={message.id} className="flex flex-col">
                                                {showTime && (
                                                    <span className="text-xs text-center text-slate-400 my-4 font-medium">
                                                        {format(parseISO(message.created_at), "dd MMM, HH:mm", { locale: es })}
                                                    </span>
                                                )}
                                                <div className={`flex items-end max-w-[80%] gap-2 ${isAdmin ? 'self-end flex-row-reverse' : 'self-start'}`}>
                                                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${isAdmin
                                                        ? 'bg-blue-600 text-white rounded-br-sm shadow-md shadow-blue-600/10'
                                                        : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200 shadow-sm'
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
                        <div className="p-4 bg-white border-t border-slate-200">
                            <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
                                <Input
                                    placeholder="Escribe tu respuesta..."
                                    className="bg-slate-50 focus-visible:ring-blue-600 border-slate-200"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                                <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-700 shrink-0" disabled={!newMessage.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                            <MessageSquareX className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="font-medium text-slate-500">Selecciona un chat para comenzar a escribir</p>
                    </div>
                )}
            </div>
        </div>
    );
}
