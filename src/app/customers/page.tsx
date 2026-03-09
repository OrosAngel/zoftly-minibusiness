"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useStore, Customer } from "@/store";
import { useHydration } from "@/hooks/use-hydration";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit, Trash2, Contact } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CustomersPage() {
    const mounted = useHydration();
    const customers = useStore((state) => state.customers);
    const deleteCustomer = useStore((state) => state.deleteCustomer);
    const addCustomer = useStore((state) => state.addCustomer);
    const updateCustomer = useStore((state) => state.updateCustomer);

    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const [isProcessing, setIsProcessing] = useState(false);
    const lastActionTime = useRef(0);

    const checkThrottle = () => {
        const now = Date.now();
        if (now - lastActionTime.current < 2000) return false;
        lastActionTime.current = now;
        return true;
    };
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ first_name: '', last_name: '', phone: '', description: '', total_debt: 0 });
    const [currentCustomer, setCurrentCustomer] = useState({ id: '', first_name: '', last_name: '', phone: '', description: '', total_debt: 0 });

    const formatPhoneNumber = (value: string) => {
        const cleaned = ('' + value).replace(/\D/g, '').substring(0, 9);
        const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,3})$/);
        if (!match) return cleaned;
        let formatted = match[1];
        if (match[2]) formatted += '-' + match[2];
        if (match[3]) formatted += '-' + match[3];
        return formatted;
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    const filteredCustomers = useMemo(() => {
        if (!search.trim()) return customers;
        const lowerSearch = search.toLowerCase();
        return customers.filter(c =>
            (c.first_name?.toLowerCase() || "").includes(lowerSearch) ||
            (c.last_name?.toLowerCase() || "").includes(lowerSearch) ||
            (c.phone || "").includes(search)
        );
    }, [customers, search]);

    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const paginatedCustomers = useMemo(
        () => filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
        [filteredCustomers, currentPage, itemsPerPage]
    );

    if (!mounted) return <div className="p-8">Cargando clientes...</div>;

    const handleDelete = async (id: string, name: string) => {
        if (!checkThrottle()) return;
        if (isProcessing) return;
        if (confirm(`¿Está seguro de eliminar al cliente "${name}"?`)) {
            setIsProcessing(true);
            try {
                await deleteCustomer(id);
                toast.success("Cliente eliminado exitosamente");
            } catch (error) {
                toast.error("Error de red", { description: "No se pudo eliminar el cliente." });
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleAddCustomer = async () => {
        if (!checkThrottle()) return;
        if (isProcessing) return;
        if (!newCustomer.first_name || !newCustomer.last_name) {
            toast.error("Datos incompletos", { description: "El nombre y apellido son obligatorios" });
            return;
        }

        setIsProcessing(true);
        try {
            await addCustomer(newCustomer);
            toast.success("Cliente creado exitosamente");
            setIsAddDialogOpen(false);
            setNewCustomer({ first_name: '', last_name: '', phone: '', description: '', total_debt: 0 });
        } catch (error) {
            toast.error("Error de red", { description: "No se pudo crear el cliente." });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditCustomer = async () => {
        if (!checkThrottle()) return;
        if (isProcessing) return;
        if (!currentCustomer.first_name || !currentCustomer.last_name) {
            toast.error("Datos incompletos", { description: "El nombre y apellido son obligatorios" });
            return;
        }

        setIsProcessing(true);
        try {
            await updateCustomer(currentCustomer.id, {
                first_name: currentCustomer.first_name,
                last_name: currentCustomer.last_name,
                phone: currentCustomer.phone,
                description: currentCustomer.description,
                total_debt: currentCustomer.total_debt
            });
            toast.success("Cliente actualizado exitosamente");
            setIsEditDialogOpen(false);
        } catch (error) {
            toast.error("Error de red", { description: "No se pudo actualizar el cliente." });
        } finally {
            setIsProcessing(false);
        }
    };

    const openEditDialog = (customer: Customer) => {
        setCurrentCustomer({
            id: customer.id,
            first_name: customer.first_name || '',
            last_name: customer.last_name || '',
            phone: customer.phone || '',
            description: customer.description || '',
            total_debt: customer.total_debt || 0
        });
        setIsEditDialogOpen(true);
    };

    return (
        <div className="flex-1 space-y-4 sm:space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 max-w-7xl mx-auto overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-3">
                    <Contact className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Directorio de Clientes</h2>
                </div>
                <div className="flex items-center w-full sm:w-auto">
                    <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 h-10" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
                    </Button>
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 mt-6 flex flex-col overflow-hidden">
                <div className="flex items-center space-x-4 mb-4 sm:mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar cliente por nombre o teléfono..."
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
                                <TableHead>Nombre Completo</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead className="text-right">Deuda Fiado (S/)</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-slate-500">
                                        No se encontraron clientes.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedCustomers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="font-medium text-slate-800">
                                            {customer.first_name} {customer.last_name}
                                        </TableCell>
                                        <TableCell className="text-slate-600">{customer.phone || "-"}</TableCell>
                                        <TableCell className="text-slate-500 text-sm max-w-[200px] truncate" title={customer.description}>
                                            {customer.description || "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-bold ${customer.total_debt > 0 ? "text-orange-600" : "text-slate-400"}`}>
                                                S/ {customer.total_debt.toFixed(2)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end space-x-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Editar" onClick={() => openEditDialog(customer)} disabled={isProcessing}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(customer.id, `${customer.first_name} ${customer.last_name}`)}
                                                    title="Eliminar"
                                                    disabled={isProcessing}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-2 py-4 border-t border-slate-200 mt-2 bg-slate-50 rounded-b-md">
                        <p className="text-sm text-slate-500">
                            Página <span className="font-medium text-slate-900">{currentPage}</span> de <span className="font-medium text-slate-900">{totalPages}</span>
                        </p>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Añadir Nuevo Cliente</DialogTitle>
                        <DialogDescription>
                            Registra un nuevo cliente. Nombre y apellido son campos obligatorios.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="firstName" className="text-right font-medium">Nombre *</Label>
                            <Input
                                id="firstName"
                                value={newCustomer.first_name}
                                onChange={(e: any) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                                className="col-span-3"
                                placeholder="Ej. Juan"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="lastName" className="text-right font-medium">Apellido *</Label>
                            <Input
                                id="lastName"
                                value={newCustomer.last_name}
                                onChange={(e: any) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                                className="col-span-3"
                                placeholder="Ej. Pérez"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phone" className="text-right font-medium">Teléfono</Label>
                            <Input
                                id="phone"
                                value={newCustomer.phone}
                                onChange={(e: any) => setNewCustomer({ ...newCustomer, phone: formatPhoneNumber(e.target.value) })}
                                className="col-span-3"
                                placeholder="Ej. 987-654-321"
                                maxLength={11}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="total_debt" className="text-right font-medium">Deuda (Opcional)</Label>
                            <div className="col-span-3 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">S/</span>
                                <Input
                                    id="total_debt"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newCustomer.total_debt}
                                    onChange={(e: any) => setNewCustomer({ ...newCustomer, total_debt: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                    className="pl-8"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 pt-2">
                            <Label htmlFor="description" className="text-right mt-2 font-medium">Descripción</Label>
                            <Textarea
                                id="description"
                                value={newCustomer.description}
                                onChange={(e: any) => setNewCustomer({ ...newCustomer, description: e.target.value })}
                                className="col-span-3 resize-none h-20"
                                placeholder="Detalles adicionales sobre el cliente... (Opcional)"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isProcessing}>Cancelar</Button>
                        <Button onClick={handleAddCustomer} className="bg-blue-600 hover:bg-blue-700" disabled={isProcessing}>
                            {isProcessing ? "Guardando..." : "Guardar Cliente"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal para Editar Cliente */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar Cliente</DialogTitle>
                        <DialogDescription>
                            Modifica la información del cliente. El nombre y apellido son campos obligatorios.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-firstName" className="text-right font-medium">Nombre *</Label>
                            <Input
                                id="edit-firstName"
                                value={currentCustomer.first_name}
                                onChange={(e: any) => setCurrentCustomer({ ...currentCustomer, first_name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-lastName" className="text-right font-medium">Apellido *</Label>
                            <Input
                                id="edit-lastName"
                                value={currentCustomer.last_name}
                                onChange={(e: any) => setCurrentCustomer({ ...currentCustomer, last_name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-phone" className="text-right font-medium">Teléfono</Label>
                            <Input
                                id="edit-phone"
                                value={currentCustomer.phone}
                                onChange={(e: any) => setCurrentCustomer({ ...currentCustomer, phone: formatPhoneNumber(e.target.value) })}
                                className="col-span-3"
                                maxLength={11}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-total_debt" className="text-right font-medium">Deuda</Label>
                            <div className="col-span-3 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">S/</span>
                                <Input
                                    id="edit-total_debt"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={currentCustomer.total_debt}
                                    onChange={(e: any) => setCurrentCustomer({ ...currentCustomer, total_debt: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                    className="pl-8"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 pt-2">
                            <Label htmlFor="edit-description" className="text-right mt-2 font-medium">Descripción</Label>
                            <Textarea
                                id="edit-description"
                                value={currentCustomer.description}
                                onChange={(e: any) => setCurrentCustomer({ ...currentCustomer, description: e.target.value })}
                                className="col-span-3 resize-none h-20"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isProcessing}>Cancelar</Button>
                        <Button onClick={handleEditCustomer} className="bg-blue-600 hover:bg-blue-700" disabled={isProcessing}>
                            {isProcessing ? "Actualizando..." : "Actualizar Cambios"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
