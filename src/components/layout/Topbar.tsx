"use client";

import { Menu, LogOut, Bell, MessageSquare, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import { useStore } from "@/store";

interface TopbarProps {
    onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
    const clearStore = useStore((state) => state.clearStore);
    const userRole = useStore((state) => state.userRole);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const router = useRouter();

    useEffect(() => {
        // Fetch existing notifications
        const fetchNotifications = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.is_read).length);
            }
        };

        fetchNotifications();

        // Subscribe to real-time notifications
        let subscription: any = null;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                subscription = supabase
                    .channel('public:notifications')
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
                        (payload) => {
                            const newNotif = payload.new;
                            setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
                            setUnreadCount((prev) => prev + 1);

                            // Toast alert for the user
                            toast(newNotif.title, {
                                description: newNotif.message,
                                icon: newNotif.type === 'MESSAGE' ? <MessageSquare className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />
                            });
                        }
                    )
                    .subscribe();
            }
        });

        return () => {
            if (subscription) {
                supabase.removeChannel(subscription);
            }
        };
    }, []);

    const markAsRead = async (id: string, is_read: boolean) => {
        if (is_read) return;

        // Optimistic UI update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
        }
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error("Error al cerrar sesión", {
                description: error.message
            });
        } else {
            clearStore();
        }
    };

    return (
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
            <div className="flex flex-1">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Abrir sidebar</span>
                </Button>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full h-10 w-10">
                            <Bell className="h-5 w-5" />
                            {unreadCount > 0 && (
                                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px] rounded-full border-2 border-white">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Badge>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 sm:w-96 bg-white p-0 rounded-xl overflow-hidden border-slate-200 shadow-xl">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <DropdownMenuLabel className="font-semibold text-slate-800 p-0 text-md">Notificaciones</DropdownMenuLabel>
                            {unreadCount > 0 && (
                                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-blue-600 hover:text-blue-700 hover:bg-transparent text-xs font-semibold">
                                    Marcar todo como leído
                                </Button>
                            )}
                        </div>
                        <ScrollArea className="h-[300px] sm:h-[400px]">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-500 space-y-3">
                                    <div className="bg-slate-100 p-3 rounded-full">
                                        <Bell className="h-6 w-6 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-medium">No tienes notificaciones</p>
                                </div>
                            ) : (
                                <div className="flex flex-col divide-y divide-slate-100">
                                    {notifications.map((notification) => (
                                        <DropdownMenuItem
                                            key={notification.id}
                                            className={`p-4 gap-4 cursor-pointer focus:bg-slate-50 transition-colors ${!notification.is_read ? 'bg-blue-50/50' : 'bg-white'}`}
                                            onClick={(e) => {
                                                markAsRead(notification.id, notification.is_read);
                                                if (notification.type === 'MESSAGE') {
                                                    router.push(userRole === 'ADMIN' ? '/admin/messages' : '/support');
                                                }
                                            }}
                                        >
                                            <div className={`mt-0.5 p-2 rounded-full shrink-0 ${notification.type === 'MESSAGE' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                {notification.type === 'MESSAGE' ? <MessageSquare className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                                            </div>
                                            <div className="flex-1 space-y-1 overflow-hidden">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm tracking-tight leading-snug truncate ${!notification.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap mt-0.5 font-medium">
                                                        {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true, locale: es }).replace('alrededor de', '')}
                                                    </span>
                                                </div>
                                                <p className={`text-sm leading-snug line-clamp-2 ${!notification.is_read ? 'text-slate-600' : 'text-slate-500'}`}>
                                                    {notification.message}
                                                </p>
                                            </div>
                                            {!notification.is_read && (
                                                <div className="shrink-0 flex items-center h-full">
                                                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                                                </div>
                                            )}
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        <DropdownMenuSeparator className="m-0 bg-slate-100" />
                        <div className="p-2 bg-slate-50">
                            <Button variant="ghost" className="w-full text-xs text-slate-500 font-medium h-8">
                                Ver historial completo
                            </Button>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1"></div>

                <Button variant="ghost" className="text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors rounded-full sm:rounded-md px-3 sm:px-4" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline font-medium">Cerrar Sesión</span>
                </Button>
            </div>
        </div>
    );
}
