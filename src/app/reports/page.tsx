"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, FileSpreadsheet, FileText, Calendar, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import ExcelJS from "exceljs";
import { toast } from "sonner";

export default function ReportsPage() {
    const [mounted, setMounted] = useState(false);
    const sales = useStore((state) => state.sales);
    const saleItems = useStore((state) => state.saleItems);
    const products = useStore((state) => state.products);
    const customers = useStore((state) => state.customers);
    const [search, setSearch] = useState("");

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="p-8">Cargando reportes...</div>;

    const exportCierreCaja = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Cierre de Caja");

            // Set columns
            worksheet.columns = [
                { header: "ID Venta", key: "id", width: 40 },
                { header: "Fecha y Hora", key: "date", width: 25 },
                { header: "Método de Pago", key: "method", width: 20 },
                { header: "Cliente (Fiado)", key: "customer", width: 30 },
                { header: "Total (S/)", key: "total", width: 15 },
            ];

            // Styling header
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF0F172A' }
            };

            // Add data
            sales.forEach(sale => {
                let customerName = "Público General";
                if (sale.customer_id) {
                    const c = customers.find(x => x.id === sale.customer_id);
                    if (c) customerName = `${c.first_name} ${c.last_name}`;
                }

                worksheet.addRow({
                    id: sale.id,
                    date: format(parseISO(sale.created_at), "dd/MM/yyyy HH:mm:ss"),
                    method: sale.payment_method,
                    customer: customerName,
                    total: sale.total_amount
                });
            });

            // Generate file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `Zoftly_CierreCaja_${format(new Date(), "yyyyMMdd")}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);

            toast.success("Excel generado exitosamente");
        } catch (error) {
            console.error(error);
            toast.error("Error al generar Excel", { description: "Ocurrió un problema al construir el archivo." });
        }
    };

    const exportInventarioValorizado = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Inventario Valorizado");

            worksheet.columns = [
                { header: "Código de Barras", key: "barcode", width: 20 },
                { header: "Producto", key: "name", width: 40 },
                { header: "Stock Actual", key: "stock", width: 15 },
                { header: "Costo Unit. (S/)", key: "cost", width: 15 },
                { header: "Valor Total (S/)", key: "totalValue", width: 20 },
            ];

            worksheet.getRow(1).font = { bold: true };

            let granTotal = 0;

            products.forEach(p => {
                const rowValue = p.stock * p.cost;
                granTotal += rowValue;
                worksheet.addRow({
                    barcode: p.barcode,
                    name: p.name,
                    stock: p.stock,
                    cost: p.cost,
                    totalValue: rowValue
                });
            });

            worksheet.addRow({});
            const summaryRow = worksheet.addRow({
                name: "VALOR TOTAL INVENTARIO",
                totalValue: granTotal
            });
            summaryRow.font = { bold: true, size: 14 };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `Zoftly_InvValorizado_${format(new Date(), "yyyyMMdd")}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);

            toast.success("Reporte de Inventario generado exitosamente");
        } catch (error) {
            console.error(error);
            toast.error("Error al generar Excel");
        }
    }

    const recentSales = sales.slice(0, 10);

    return (
        <div className="flex-1 space-y-4 sm:space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 max-w-7xl mx-auto overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Reportes y Exportación</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-blue-100 shadow-sm transition-all hover:shadow-md hover:border-blue-300">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-blue-800">
                            <FileSpreadsheet className="mr-2 h-5 w-5 text-blue-600" />
                            Cierre de Caja
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Lista detallada de las ventas realizadas con fechas, métodos de pago y totales.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={exportCierreCaja}>
                            <Download className="mr-2 h-4 w-4" /> Exportar a Excel
                        </Button>
                    </CardFooter>
                </Card>

                <Card className="border-emerald-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-300">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-emerald-800">
                            <FileText className="mr-2 h-5 w-5 text-emerald-600" />
                            Inventario Valorizado
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Cálculo del valor total de la mercadería almacenada en base al costo de compra y stock actual.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={exportInventarioValorizado}>
                            <Download className="mr-2 h-4 w-4" /> Exportar a Excel
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-8 overflow-hidden flex flex-col">
                <h3 className="text-xl font-bold mb-6 text-slate-800 flex items-center">
                    <Calendar className="mr-2 h-5 w-5 text-slate-500" /> Vista Previa: Últimas Ventas
                </h3>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                    <Table className="min-w-[600px]">
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Método</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead className="text-right">Total Transacción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentSales.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-slate-500">
                                        No hay ventas registradas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                recentSales.map((sale) => {
                                    let customerName = "Público General";
                                    const isFiado = sale.payment_method === "FIADO";

                                    if (sale.customer_id) {
                                        const c = customers.find(x => x.id === sale.customer_id);
                                        if (c) customerName = `${c.first_name} ${c.last_name}`;
                                    }

                                    return (
                                        <TableRow key={sale.id}>
                                            <TableCell className="font-medium text-slate-700">
                                                {format(parseISO(sale.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${sale.payment_method === 'EFECTIVO' ? 'bg-green-100 text-green-700' :
                                                    sale.payment_method === 'TRANSFERENCIA' ? 'bg-blue-100 text-blue-700' :
                                                        sale.payment_method === 'YAPE_PLIN' ? 'bg-purple-100 text-purple-700' :
                                                            sale.payment_method === 'TARJETA' ? 'bg-indigo-100 text-indigo-700' :
                                                                'bg-orange-100 text-orange-700' // Fiado
                                                    }`}>
                                                    {sale.payment_method}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-slate-600">
                                                {isFiado ? <span className="font-semibold text-orange-800">{customerName}</span> : customerName}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">
                                                S/ {sale.total_amount.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
