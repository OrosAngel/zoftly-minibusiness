"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit, Trash2, Phone, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SuppliersPage() {
    const [mounted, setMounted] = useState(false);
    const suppliers = useStore((state) => state.suppliers);
    const products = useStore((state) => state.products);
    const addSupplier = useStore((state) => state.addSupplier);
    const updateSupplier = useStore((state) => state.updateSupplier);
    const deleteSupplier = useStore((state) => state.deleteSupplier);

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
    const [newSupplier, setNewSupplier] = useState({ name: '', phone: '' });
    const [currentSupplier, setCurrentSupplier] = useState({ id: '', name: '', phone: '' });

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
        setMounted(true);
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    if (!mounted) return <div className="p-8">Cargando proveedores...</div>;

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.includes(search)
    );

    const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
    const paginatedSuppliers = filteredSuppliers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getSuppliedProductsCount = (supplierId: string) => {
        return products.filter(p => p.supplier_id === supplierId).length;
    };

    const handleDelete = async (id: string, name: string) => {
        if (!checkThrottle()) return;
        if (isProcessing) return;
        if (confirm(`¿Está seguro de eliminar el proveedor "${name}"?`)) {
            // Check if supplier has products
            const hasProducts = products.some(p => p.supplier_id === id);
            if (hasProducts) {
                toast.error("No se puede eliminar", { description: "Este proveedor tiene productos asociados." });
                return;
            }
            setIsProcessing(true);
            try {
                await deleteSupplier(id);
                toast.success("Proveedor eliminado exitosamente");
            } catch (error) {
                toast.error("Error al eliminar el proveedor");
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleAddSupplier = async () => {
        if (!checkThrottle()) return;
        if (isProcessing) return;
        if (!newSupplier.name) {
            toast.error("Datos incompletos", { description: "El nombre es obligatorio" });
            return;
        }

        setIsProcessing(true);
        try {
            await addSupplier(newSupplier);
            toast.success("Proveedor creado exitosamente");
            setIsAddDialogOpen(false);
            setNewSupplier({ name: '', phone: '' });
        } catch (error) {
            toast.error("Error al crear proveedor");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditSupplier = async () => {
        if (!checkThrottle()) return;
        if (isProcessing) return;
        if (!currentSupplier.name) {
            toast.error("Datos incompletos", { description: "El nombre es obligatorio" });
            return;
        }

        setIsProcessing(true);
        try {
            await updateSupplier(currentSupplier.id, {
                name: currentSupplier.name,
                phone: currentSupplier.phone
            });
            toast.success("Proveedor actualizado exitosamente");
            setIsEditDialogOpen(false);
        } catch (error) {
            toast.error("Error al actualizar proveedor");
        } finally {
            setIsProcessing(false);
        }
    };

    const openEditDialog = (supplier: any) => {
        setCurrentSupplier({ id: supplier.id, name: supplier.name, phone: supplier.phone });
        setIsEditDialogOpen(true);
    };

    return (
        <div className="flex-1 space-y-4 sm:space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 max-w-6xl mx-auto overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Proveedores</h2>
                <div className="flex items-center w-full sm:w-auto">
                    <Button className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 h-10" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Proveedor
                    </Button>
                </div>
            </div>

            {/* Tarjetas Resumen */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Proveedores</CardTitle>
                        <Building2 className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{suppliers.length}</div>
                        <p className="text-xs text-slate-500">
                            Registrados en el directorio
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 mt-6 flex flex-col overflow-hidden">
                <div className="flex items-center space-x-4 mb-4 sm:mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar proveedor por nombre o teléfono..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10"
                        />
                    </div>
                </div>

                <div className="rounded-md border border-slate-200 overflow-x-auto">
                    <Table className="min-w-[700px]">
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead>Nombre del Proveedor</TableHead>
                                <TableHead>Teléfono de Contacto</TableHead>
                                <TableHead className="text-right">Productos Suministrados</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSuppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-slate-500">
                                        No se encontraron proveedores.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedSuppliers.map((supplier) => (
                                    <TableRow key={supplier.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 text-slate-600 font-bold text-xs uppercase">
                                                    {supplier.name.substring(0, 2)}
                                                </div>
                                                {supplier.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center text-slate-600">
                                                <Phone className="h-3 w-3 mr-2" />
                                                {supplier.phone}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-slate-600 font-medium">
                                            {getSuppliedProductsCount(supplier.id)} productos
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end space-x-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEditDialog(supplier)} disabled={isProcessing}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(supplier.id, supplier.name)}
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

            {/* Modal para Agregar Proveedor */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Añadir Nuevo Proveedor</DialogTitle>
                        <DialogDescription>
                            Registra la información del proveedor. El nombre es obligatorio.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="add-name" className="text-right font-medium">Nombre *</Label>
                            <Input
                                id="add-name"
                                value={newSupplier.name}
                                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                                className="col-span-3"
                                placeholder="Ej. Distribuidora del Norte"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="add-phone" className="text-right font-medium">Teléfono</Label>
                            <Input
                                id="add-phone"
                                value={newSupplier.phone}
                                onChange={(e) => setNewSupplier({ ...newSupplier, phone: formatPhoneNumber(e.target.value) })}
                                className="col-span-3"
                                placeholder="Ej. 987-654-321"
                                maxLength={11}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isProcessing}>Cancelar</Button>
                        <Button onClick={handleAddSupplier} className="bg-slate-900 hover:bg-slate-800" disabled={isProcessing}>
                            {isProcessing ? "Guardando..." : "Guardar Proveedor"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal para Editar Proveedor */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar Proveedor</DialogTitle>
                        <DialogDescription>
                            Modifica la información del proveedor seleccionado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right font-medium">Nombre *</Label>
                            <Input
                                id="edit-name"
                                value={currentSupplier.name}
                                onChange={(e) => setCurrentSupplier({ ...currentSupplier, name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-phone" className="text-right font-medium">Teléfono</Label>
                            <Input
                                id="edit-phone"
                                value={currentSupplier.phone}
                                onChange={(e) => setCurrentSupplier({ ...currentSupplier, phone: formatPhoneNumber(e.target.value) })}
                                className="col-span-3"
                                maxLength={11}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isProcessing}>Cancelar</Button>
                        <Button onClick={handleEditSupplier} className="bg-blue-600 hover:bg-blue-700" disabled={isProcessing}>
                            {isProcessing ? "Actualizando..." : "Actualizar Cambios"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
