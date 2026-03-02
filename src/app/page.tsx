"use client";

import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format, isToday, parseISO, subDays, subYears, startOfMonth, subMonths, isAfter, isBefore, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { DollarSign, ShoppingBag, CreditCard, AlertTriangle, Package, Zap, ArrowRightLeft, TrendingUp, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

type DateRangeFilter =
  | "today"
  | "7days"
  | "28days"
  | "90days"
  | "365days"
  | "all_time"
  | "prev_year"
  | "prev_prev_year"
  | "prev_month"
  | "prev_prev_month"
  | "custom";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const sales = useStore((state) => state.sales);
  const customers = useStore((state) => state.customers);
  const products = useStore((state) => state.products);
  const store = useStore((state) => state.currentStore);
  const movements = useStore((state) => state.movements);

  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("today");

  // Prevent hydration mismatch with Zustand persist
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="p-8">Cargando dashboard...</div>;

  // Calculate KPIs
  const todaysSales = sales.filter((sale) => isToday(parseISO(sale.created_at)));
  const todaysRevenue = todaysSales.reduce((acc, sale) => acc + sale.total_amount, 0);
  const todaysSalesCount = todaysSales.length;

  // Valor del Inventario
  const inventoryValue = products.reduce((acc, p) => acc + (p.stock * p.cost), 0);

  // Última Automatización
  const automations = movements.filter(m => m.movement_type === "AUTOMATIZACION");
  const lastAutomation = automations.length > 0
    ? format(parseISO(automations[0].created_at), "HH:mm", { locale: es }) + " hrs"
    : "Sin actividad";

  // Top 5 Productos
  const salesMap = new Map<string, { name: string, qty: number, revenue: number }>();
  // We use the full store's saleItems to find absolute top products
  const saleItems = useStore.getState().saleItems;
  saleItems.forEach(item => {
    const existing = salesMap.get(item.product_id) || { name: "", qty: 0, revenue: 0 };
    if (!existing.name) {
      const p = products.find(x => x.id === item.product_id);
      existing.name = p ? p.name : "Producto Eliminado";
    }
    existing.qty += item.quantity;
    existing.revenue += item.subtotal;
    salesMap.set(item.product_id, existing);
  });
  const topProducts = Array.from(salesMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Helper function to get the current selected range labels and filter sales
  const getFilteredSales = () => {
    const now = new Date();
    let label = "Hoy";
    let filteredSales = sales;
    let formatStr = "HH:mm";
    let groupBy = "hour";

    switch (dateFilter) {
      case "today":
        filteredSales = sales.filter(s => isToday(parseISO(s.created_at)));
        label = "Hoy";
        groupBy = "hour";
        break;
      case "7days":
        filteredSales = sales.filter(s => isAfter(parseISO(s.created_at), subDays(now, 7)));
        label = "Últimos 7 días";
        groupBy = "day";
        break;
      case "28days":
        filteredSales = sales.filter(s => isAfter(parseISO(s.created_at), subDays(now, 28)));
        label = "Últimos 28 días";
        groupBy = "day";
        break;
      case "90days":
        filteredSales = sales.filter(s => isAfter(parseISO(s.created_at), subDays(now, 90)));
        label = "Últimos 90 días";
        groupBy = "week";
        break;
      case "365days":
        filteredSales = sales.filter(s => isAfter(parseISO(s.created_at), subDays(now, 365)));
        label = "Últimos 365 días";
        groupBy = "month";
        break;
      case "prev_year":
        filteredSales = sales.filter(s => {
          const d = parseISO(s.created_at);
          return d.getFullYear() === now.getFullYear() - 1;
        });
        label = `${now.getFullYear() - 1}`;
        groupBy = "month";
        break;
      case "prev_prev_year":
        filteredSales = sales.filter(s => {
          const d = parseISO(s.created_at);
          return d.getFullYear() === now.getFullYear() - 2;
        });
        label = `${now.getFullYear() - 2}`;
        groupBy = "month";
        break;
      case "prev_month":
        const prevMonth = subMonths(startOfMonth(now), 1);
        filteredSales = sales.filter(s => {
          const d = parseISO(s.created_at);
          return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
        });
        label = format(prevMonth, "MMMM yyyy", { locale: es });
        groupBy = "day";
        break;
      case "prev_prev_month":
        const prevPrevMonth = subMonths(startOfMonth(now), 2);
        filteredSales = sales.filter(s => {
          const d = parseISO(s.created_at);
          return d.getMonth() === prevPrevMonth.getMonth() && d.getFullYear() === prevPrevMonth.getFullYear();
        });
        label = format(prevPrevMonth, "MMMM yyyy", { locale: es });
        groupBy = "day";
        break;
      case "all_time":
        label = "Desde siempre";
        groupBy = "month";
        break;
      case "custom":
        label = "Personalizado";
        groupBy = "day"; // Simple fallback
        break;
    }

    return { filteredSales, label, groupBy };
  };

  const { filteredSales, label: filterLabel, groupBy } = getFilteredSales();

  // Generate Chart Data based on grouping
  const generateChartData = () => {
    let data: { time: string, total: number }[] = [];

    if (groupBy === "hour") {
      data = Array.from({ length: 15 }, (_, i) => ({ time: `${i + 6}:00`, total: 0 }));
      filteredSales.forEach(sale => {
        const d = parseISO(sale.created_at);
        const hourFormat = `${d.getHours()}:00`;
        const bin = data.find(h => h.time === hourFormat);
        if (bin) bin.total += sale.total_amount;
      });
    } else if (groupBy === "day") {
      // Group by distinct days found in filtered sales, sorted
      const daysMap = new Map<string, number>();
      filteredSales.forEach(sale => {
        const d = parseISO(sale.created_at);
        const dayFormat = format(d, "dd MMM", { locale: es });
        daysMap.set(dayFormat, (daysMap.get(dayFormat) || 0) + sale.total_amount);
      });
      data = Array.from(daysMap, ([time, total]) => ({ time, total })).reverse();
    } else if (groupBy === "week") {
      const weeksMap = new Map<string, number>();
      filteredSales.forEach(sale => {
        const d = parseISO(sale.created_at);
        const weekFormat = `Sem ${format(d, "w", { locale: es })}`;
        weeksMap.set(weekFormat, (weeksMap.get(weekFormat) || 0) + sale.total_amount);
      });
      data = Array.from(weeksMap, ([time, total]) => ({ time, total })).reverse();
    } else if (groupBy === "month") {
      const monthsMap = new Map<string, number>();
      filteredSales.forEach(sale => {
        const d = parseISO(sale.created_at);
        const monthFormat = format(d, "MMM yy", { locale: es });
        monthsMap.set(monthFormat, (monthsMap.get(monthFormat) || 0) + sale.total_amount);
      });
      // Try to ensure chronological sort or just reverse insertion
      data = Array.from(monthsMap, ([time, total]) => ({ time, total })).reverse();
    }

    return data;
  };

  const chartData = generateChartData();

  return (
    <div className="flex-1 space-y-4 sm:space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 text-slate-500">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
        <div className="flex items-center space-x-2 text-slate-500">
          <span>{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas de Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {todaysRevenue.toFixed(2)}</div>
            <p className="text-xs text-slate-500 mt-1">
              En {todaysSalesCount} transacciones
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor del Inventario</CardTitle>
            <Package className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {inventoryValue.toFixed(2)}</div>
            <p className="text-xs text-slate-500 mt-1">
              Activos valorizados (costo)
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Automatización</CardTitle>
            <Zap className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastAutomation}</div>
            <p className="text-xs text-slate-500 mt-1">
              Sincronización Bot Telegram
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Artículos en Riesgo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.filter(p => p.stock <= p.min_stock).length}</div>
            <p className="text-xs text-slate-500 mt-1">
              Unidades bajo el mínimo
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Resumen de Ventas</CardTitle>
              <CardDescription>Flujo de ingresos en el período seleccionado</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline-block capitalize">{filterLabel}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem onClick={() => setDateFilter("today")}>Hoy</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("7days")}>Últimos 7 días</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("28days")}>Últimos 28 días</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("90days")}>Últimos 90 días</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("365days")}>Últimos 365 días</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("all_time")}>Desde siempre</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDateFilter("prev_year")}>{new Date().getFullYear() - 1}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("prev_prev_year")}>{new Date().getFullYear() - 2}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("prev_month")}>{format(subMonths(new Date(), 1), "MMMM", { locale: es })}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("prev_prev_month")}>{format(subMonths(new Date(), 2), "MMMM", { locale: es })}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDateFilter("custom")} disabled>Personalizado (Próximamente)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="pl-0 border-t border-slate-100 pt-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `S/ ${value}`}
                  width={60}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`S/ ${value.toFixed(2)}`, 'Ventas']}
                  labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '4px', textTransform: 'capitalize' }}
                />
                <Bar
                  dataKey="total"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm border-t-4 border-t-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800">
              <TrendingUp className="mr-2 h-5 w-5" />
              Top 5 Productos
            </CardTitle>
            <CardDescription>
              Los artículos más vendidos globalmente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.length > 0 ? (
                topProducts.map((p, i) => (
                  <div key={i} className="flex items-center p-3 border rounded-lg bg-white">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                      #{i + 1}
                    </div>
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none line-clamp-1">{p.name}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="font-bold text-slate-900">{p.qty} ud.</p>
                      <p className="text-xs text-slate-500">S/ {p.revenue.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <Package className="h-10 w-10 text-slate-200 mb-2" />
                  <p className="text-sm">Aún no hay ventas registradas.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ultimos Movimientos */}
      <Card className="shadow-sm flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ArrowRightLeft className="mr-2 h-5 w-5 text-slate-500" />
            Últimos Movimientos
          </CardTitle>
          <CardDescription>
            Historial reciente de la actividad de inventario
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Variación</TableHead>
                <TableHead className="text-right">Nuevo Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.slice(0, 5).map((mov) => {
                const product = products.find(p => p.id === mov.product_id);
                return (
                  <TableRow key={mov.id}>
                    <TableCell className="text-sm text-slate-500">
                      {format(parseISO(mov.created_at), "dd MMM, HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {product?.name || "Producto Eliminado"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`
                        ${mov.movement_type === 'AUTOMATIZACION' ? 'border-purple-200 bg-purple-50 text-purple-700' : ''}
                        ${mov.movement_type === 'MANUAL' ? (mov.quantity_changed > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700') : ''}
                        ${mov.movement_type === 'COMPRA' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}
                        ${mov.movement_type === 'AJUSTE' ? (mov.quantity_changed > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-orange-200 bg-orange-50 text-orange-700') : ''}
                        ${mov.movement_type === 'CARGA_INICIAL' ? 'border-slate-200 bg-slate-50 text-slate-700' : ''}
                      `}>
                        {mov.movement_type === 'AUTOMATIZACION' && 'BOT Automatización'}
                        {mov.movement_type === 'MANUAL' && (mov.quantity_changed > 0 ? 'Ingreso Manual' : 'Venta Manual')}
                        {mov.movement_type === 'AJUSTE' && (mov.quantity_changed > 0 ? 'Ajuste Positivo' : 'Ajuste Negativo')}
                        {mov.movement_type === 'COMPRA' && 'Ingreso Proveedor'}
                        {mov.movement_type === 'CARGA_INICIAL' && 'Carga Inicial'}
                        {![
                          'AUTOMATIZACION', 'MANUAL', 'AJUSTE', 'COMPRA', 'CARGA_INICIAL'
                        ].includes(mov.movement_type) && mov.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${mov.quantity_changed > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {mov.quantity_changed > 0 ? '+' : ''}{mov.quantity_changed}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {mov.new_stock}
                    </TableCell>
                  </TableRow>
                );
              })}
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                    No hay movimientos recientes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
