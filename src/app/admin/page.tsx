"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, Activity, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
    const userRole = useStore((state) => state.userRole);
    const [stats, setStats] = useState({
        totalStores: 0,
        totalUsers: 0,
        totalSales: 0,
        activeThisWeek: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchAdminStats() {
            try {
                // Fetch basic metrics across the entire platform
                // RLS needs to be configured in Supabase to allow ADMIN to select all 
                const { count: storesCount } = await supabase.from('stores').select('*', { count: 'exact', head: true });
                const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
                const { count: salesCount } = await supabase.from('sales').select('*', { count: 'exact', head: true });

                // For a real production app, activeThisWeek would be a more complex query

                setStats({
                    totalStores: storesCount || 0,
                    totalUsers: usersCount || 0,
                    totalSales: salesCount || 0,
                    activeThisWeek: storesCount || 0 // Mock value for now
                });
            } catch (err) {
                console.error("Error fetching admin stats:", err);
            } finally {
                setIsLoading(false);
            }
        }

        if (userRole === 'ADMIN') {
            fetchAdminStats();
        }
    }, [userRole]);

    if (userRole !== 'ADMIN') {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Denegado</h2>
                    <p className="text-slate-500">No tienes permisos para ver el panel de administrador.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-4 sm:space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Zoftlytech Network Overview</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm border-t-4 border-t-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tiendas Activas</CardTitle>
                        <Store className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? "..." : stats.totalStores}</div>
                        <p className="text-xs text-slate-500 mt-1">Negocios registrados</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-t-4 border-t-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
                        <Users className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? "..." : stats.totalUsers}</div>
                        <p className="text-xs text-slate-500 mt-1">Cuentas creadas</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-t-4 border-t-emerald-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Transacciones Totales</CardTitle>
                        <Activity className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isLoading ? "..." : stats.totalSales}</div>
                        <p className="text-xs text-slate-500 mt-1">Ventas en toda la red</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-t-4 border-t-orange-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">MRR / Crecimiento</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">N/A</div>
                        <p className="text-xs text-slate-500 mt-1">Pendiente de pasarela de pagos</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Actividad Reciente</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-slate-500 py-8 text-center border-2 border-dashed rounded-lg">
                        Gráfico de actividad global irá aquí...
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
