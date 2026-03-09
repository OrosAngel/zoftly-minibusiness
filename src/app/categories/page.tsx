"use client";

import { useState, useEffect, useRef } from "react";
import { useStore, Category } from "@/store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit, Trash2, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function CategoriesPage() {
    const [mounted, setMounted] = useState(false);
    const categories = useStore((state) => state.categories);
    const products = useStore((state) => state.products);
    const addCategory = useStore((state) => state.addCategory);
    const updateCategory = useStore((state) => state.updateCategory);
    const deleteCategory = useStore((state) => state.deleteCategory);

    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const lastActionTime = useRef(0);

    const checkThrottle = () => {
        const now = Date.now();
        if (now - lastActionTime.current < 2000) return false;
        lastActionTime.current = now;
        return true;
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    if (!mounted) return <div className="p-8">Cargando categorías...</div>;

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
    const paginatedCategories = filteredCategories.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getProductsCount = (categoryId: string) => {
        return products.filter(p => p.category_id === categoryId).length;
    };

    const handleDelete = async (id: string, name: string) => {
        if (!checkThrottle()) return;
        if (isProcessing) return;
        if (confirm(`¿Está seguro de eliminar la categoría "${name}"?`)) {
            // Check if category has products
            const hasProducts = products.some(p => p.category_id === id);
            if (hasProducts) {
                toast.error("No se puede eliminar", { description: "Esta categoría tiene productos asociados." });
                return;
            }
            setIsProcessing(true);
            try {
                await deleteCategory(id);
                toast.success("Categoría eliminada exitosamente");
            } catch (error) {
                toast.error("Error al eliminar la categoría");
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleAddCategory = async () => {
        if (!checkThrottle()) return;
        if (isProcessing) return;
        if (!newCategoryName.trim()) {
            toast.error("Datos incompletos", { description: "El nombre es obligatorio" });
            return;
        }

        setIsProcessing(true);
        try {
            await addCategory(newCategoryName);
            toast.success("Categoría creada exitosamente");
            setIsAddDialogOpen(false);
            setNewCategoryName("");
        } catch (error) {
            toast.error("Error al crear categoría");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditCategory = async () => {
        if (!checkThrottle()) return;
        if (isProcessing) return;
        if (!currentCategory || !currentCategory.name.trim()) {
            toast.error("Datos incompletos", { description: "El nombre es obligatorio" });
            return;
        }

        setIsProcessing(true);
        try {
            await updateCategory(currentCategory.id, currentCategory.name);
            toast.success("Categoría actualizada exitosamente");
            setIsEditDialogOpen(false);
        } catch (error) {
            toast.error("Error al actualizar categoría");
        } finally {
            setIsProcessing(false);
        }
    };

    const openEditDialog = (category: Category) => {
        setCurrentCategory({ ...category });
        setIsEditDialogOpen(true);
    };

    return (
        <div className="flex-1 space-y-4 sm:space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 max-w-6xl mx-auto overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Categorías</h2>
                <div className="flex items-center w-full sm:w-auto">
                    <Button className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 h-10" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Nueva Categoría
                    </Button>
                </div>
            </div>

            {/* Tarjetas Resumen */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Categorías</CardTitle>
                        <Tags className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{categories.length}</div>
                        <p className="text-xs text-slate-500">
                            Familias de productos
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 mt-6 flex flex-col overflow-hidden">
                <div className="flex items-center space-x-4 mb-4 sm:mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar categoría por nombre..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10"
                        />
                    </div>
                </div>

                <div className="rounded-md border border-slate-200 overflow-x-auto">
                    <Table className="min-w-[600px]">
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead>Nombre de Categoría</TableHead>
                                <TableHead className="text-right">Cantidad de Productos</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCategories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24 text-slate-500">
                                        No se encontraron categorías.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedCategories.map((category) => (
                                    <TableRow key={category.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 text-slate-600 font-bold text-xs uppercase">
                                                    {category.name.substring(0, 2)}
                                                </div>
                                                {category.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-slate-600 font-medium">
                                            {getProductsCount(category.id)} productos
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end space-x-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEditDialog(category)} disabled={isProcessing}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(category.id, category.name)}
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

            {/* Modal para Agregar Categoría */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Añadir Nueva Categoría</DialogTitle>
                        <DialogDescription>
                            El nombre será visible al clasificar los productos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="add-name" className="text-right font-medium">Nombre *</Label>
                            <Input
                                id="add-name"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="col-span-3"
                                placeholder="Ej. Lácteos"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isProcessing}>Cancelar</Button>
                        <Button onClick={handleAddCategory} className="bg-slate-900 hover:bg-slate-800" disabled={isProcessing}>
                            {isProcessing ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal para Editar Categoría */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar Categoría</DialogTitle>
                        <DialogDescription>
                            Modifica el nombre de la categoría. Esto afectará a todos los productos vinculados.
                        </DialogDescription>
                    </DialogHeader>
                    {currentCategory && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-name" className="text-right font-medium">Nombre *</Label>
                                <Input
                                    id="edit-name"
                                    value={currentCategory.name}
                                    onChange={(e) => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isProcessing}>Cancelar</Button>
                        <Button onClick={handleEditCategory} className="bg-blue-600 hover:bg-blue-700" disabled={isProcessing}>
                            {isProcessing ? "Actualizando..." : "Actualizar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
