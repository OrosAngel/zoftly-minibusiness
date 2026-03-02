"use client";

import { useState, useEffect } from "react";
import { useStore, MovementType } from "@/store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, History, ArrowDownRight, ArrowUpRight, Zap, Edit3, ShoppingBag, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function MovementsPage() {
    const [mounted, setMounted] = useState(false);
    const movements = useStore((state) => state.movements);
    const products = useStore((state) => state.products);
    const [search, setSearch] = useState("");

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="p-8">Cargando movimientos...</div>;

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || "Producto Desconocido";

    const getMovementConfig = (movement: any) => {
        switch (movement.movement_type) {
            case "AUTOMATIZACION":
                return { color: "bg-purple-100 text-purple-700", icon: <Zap className="h-3 w-3 mr-1" />, label: "BOT Automatización" };
            case "MANUAL":
                if (movement.quantity_changed > 0) {
                    return { color: "bg-emerald-100 text-emerald-700", icon: <ArrowUpRight className="h-3 w-3 mr-1" />, label: "Ingreso Manual" };
                }
                return { color: "bg-blue-100 text-blue-700", icon: <ShoppingBag className="h-3 w-3 mr-1" />, label: "Venta Manual" };
            case "COMPRA":
                return { color: "bg-green-100 text-green-700", icon: <Truck className="h-3 w-3 mr-1" />, label: "Ingreso Proveedor" };
            case "AJUSTE":
                if (movement.quantity_changed > 0) {
                    return { color: "bg-emerald-100 text-emerald-700", icon: <ArrowUpRight className="h-3 w-3 mr-1" />, label: "Ajuste Positivo" };
                }
                return { color: "bg-orange-100 text-orange-700", icon: <Edit3 className="h-3 w-3 mr-1" />, label: "Ajuste Negativo/Merma" };
            case "CARGA_INICIAL":
                return { color: "bg-slate-100 text-slate-700", icon: <History className="h-3 w-3 mr-1" />, label: "Carga Inicial" };
            default:
                return { color: "bg-slate-100 text-slate-700", icon: <History className="h-3 w-3 mr-1" />, label: movement.movement_type };
        }
    };

    const filteredMovements = movements.filter(m => {
        const productName = getProductName(m.product_id).toLowerCase();
        return productName.includes(search.toLowerCase());
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
        <div className="flex-1 space-y-4 sm:space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 max-w-6xl mx-auto overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Auditoría de Movimientos</h2>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 mt-6 flex flex-col overflow-hidden">
                <div className="flex items-center space-x-4 mb-4 sm:mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nombre de producto..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10"
                        />
                    </div>
                </div>

                <div className="rounded-md border border-slate-200 overflow-x-auto">
                    <Table className="min-w-[800px]">
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead>Fecha y Hora</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Tipo de Movimiento</TableHead>
                                <TableHead className="text-right">Stock Anterior</TableHead>
                                <TableHead className="text-right">Cambio</TableHead>
                                <TableHead className="text-right">Stock Nuevo</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMovements.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                                        No se registraron movimientos de inventario todavía.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredMovements.map((movement) => {
                                    const config = getMovementConfig(movement);
                                    const isPositive = movement.quantity_changed > 0;
                                    const isNegative = movement.quantity_changed < 0;

                                    return (
                                        <TableRow key={movement.id}>
                                            <TableCell className="whitespace-nowrap text-sm text-slate-500">
                                                {format(parseISO(movement.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {getProductName(movement.product_id)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`${config.color} border-none flex w-fit items-center`}>
                                                    {config.icon} {config.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-slate-500">
                                                {movement.previous_stock}
                                            </TableCell>
                                            <TableCell className={`text-right font-bold flex items-center justify-end ${isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-slate-500'}`}>
                                                {isPositive && <ArrowUpRight className="h-3 w-3 mr-1" />}
                                                {isNegative && <ArrowDownRight className="h-3 w-3 mr-1" />}
                                                {isPositive ? '+' : ''}{movement.quantity_changed}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {movement.new_stock}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
