"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Store, UserPlus, Loader2, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

export default function AdminStoresPage() {
    const userRole = useStore((state) => state.userRole);
    const [stores, setStores] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newClient, setNewClient] = useState({ fullName: "", email: "", password: "" });

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editClient, setEditClient] = useState<{ id: string, fullName: string, email: string, password?: string, storeName: string } | null>(null);

    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteClientId, setDeleteClientId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchStores() {
            try {
                // 1. Fetch stores
                const { data: storesData, error: storesError } = await supabase
                    .from('stores')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (storesError) {
                    console.error("Error fetching stores list (RAW):", storesError);
                    console.error("Error details:", JSON.stringify(storesError, null, 2));
                    return;
                }

                // 2. Fetch profiles
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name');

                // 3. Match them together
                if (storesData) {
                    const mappedStores = storesData.map(store => {
                        const profile = profilesData?.find(p => p.id === store.owner_id);
                        return {
                            ...store,
                            profiles: {
                                full_name: profile?.full_name || 'Desconocido',
                                id: profile?.id
                            }
                        };
                    });
                    setStores(mappedStores);
                }
            } finally {
                setIsLoading(false);
            }
        }

        if (userRole === 'ADMIN') {
            fetchStores();
        } else {
            setIsLoading(false);
        }
    }, [userRole]);

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClient.fullName || !newClient.email || !newClient.password) {
            toast.error("Por favor completa todos los campos requeridos.");
            return;
        }

        setIsCreating(true);

        try {
            // Need the logged in user to pass admin verification
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No hay sesión activa");

            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    adminId: session.user.id,
                    fullName: newClient.fullName,
                    email: newClient.email,
                    password: newClient.password
                })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error && data.error.includes('SUPABASE_SERVICE_ROLE_KEY')) {
                    toast.error("Configuración del servidor incompleta", { description: "Te falta agregar el SUPABASE_SERVICE_ROLE_KEY a tus variables de entorno." });
                } else {
                    toast.error("Error al crear cliente", { description: data.error || "Asegúrate de que la contraseña tenga mínimo 6 caracteres." });
                }
                setIsCreating(false);
                return;
            }

            toast.success("Cliente creado exitosamente", { description: "El usuario ya puede iniciar sesión y empezar a usar Zoftly." });
            setIsCreateOpen(false);
            setNewClient({ fullName: "", email: "", password: "" }); // Reset

            // Reload the table
            setIsLoading(true);
            const { data: updatedStores } = await supabase
                .from('stores')
                .select('*, profiles(full_name, id)')
                .order('created_at', { ascending: false });
            if (updatedStores) setStores(updatedStores);

        } catch (error) {
            console.error("Client creation error", error);
            toast.error("Hubo un problema de conexión al crear el usuario.");
        } finally {
            setIsLoading(false);
            setIsCreating(false);
        }
    };

    const handleEditClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editClient?.fullName) {
            toast.error("El nombre no puede estar vacío.");
            return;
        }

        setIsEditing(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No hay sesión activa");

            const res = await fetch(`/api/admin/users/${editClient.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    adminId: session.user.id,
                    fullName: editClient.fullName,
                    email: editClient.email,
                    password: editClient.password,
                    storeName: editClient.storeName
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al actualizar");

            toast.success("Cliente actualizado exitosamente.");
            setIsEditOpen(false);

            // Fetch stores to refresh
            setIsLoading(true);
            const { data: storesData } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
            const { data: profilesData } = await supabase.from('profiles').select('id, full_name');
            if (storesData) {
                setStores(storesData.map(store => {
                    const profile = profilesData?.find(p => p.id === store.owner_id);
                    return { ...store, profiles: { full_name: profile?.full_name || 'Desconocido', id: profile?.id } };
                }));
            }
        } catch (error: any) {
            toast.error(error.message || "Hubo un problema de conexión.");
        } finally {
            setIsLoading(false);
            setIsEditing(false);
        }
    };

    const handleDeleteClient = async () => {
        if (!deleteClientId) return;
        setIsDeleting(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No hay sesión activa");

            const res = await fetch(`/api/admin/users/${deleteClientId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adminId: session.user.id })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al eliminar");

            toast.success("Cliente eliminado exitosamente.");
            setIsDeleteOpen(false);
            setStores(prev => prev.filter(s => s.owner_id !== deleteClientId));
        } catch (error: any) {
            toast.error(error.message || "Hubo un problema de conexión.");
        } finally {
            setIsDeleting(false);
        }
    };

    if (userRole !== 'ADMIN') {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <p className="text-red-600 font-bold">Acceso Denegado</p>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Directorio de Clientes</h2>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Añadir Nuevo Cliente
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <form onSubmit={handleCreateClient}>
                            <DialogHeader>
                                <DialogTitle>Registrar Negocio / Cliente</DialogTitle>
                                <DialogDescription>
                                    Crea una cuenta nueva para uno de tus clientes. Ellos podrán acceder a Zoftly inmediatamente después con este correo y contraseña.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Nombre Completo del Dueño</Label>
                                    <Input
                                        id="fullName"
                                        placeholder="Ej. Juan Pérez"
                                        value={newClient.fullName}
                                        onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })}
                                        disabled={isCreating}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Correo Electrónico</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="correo@ejemplo.com"
                                        value={newClient.email}
                                        onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                                        disabled={isCreating}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Contraseña Inicial</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Min. 6 caracteres"
                                        value={newClient.password}
                                        onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                                        disabled={isCreating}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                                    {isCreating ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando cuenta...</>
                                    ) : (
                                        'Registrar Cliente'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50 rounded-t-xl border-b border-slate-100">
                    <CardTitle>Tiendas / Negocios</CardTitle>
                    <CardDescription>Lista completa de todos los negocios que usan Zoftly.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px] pl-6">ID</TableHead>
                                <TableHead>Nombre del Negocio</TableHead>
                                <TableHead>Propietario / Cliente</TableHead>
                                <TableHead>Fecha de Registro</TableHead>
                                <TableHead className="text-right pr-6">Estado</TableHead>
                                <TableHead className="text-right pr-6">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-slate-500">Cargando base de datos de clientes...</TableCell>
                                </TableRow>
                            ) : stores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-slate-500">No hay otras tiendas registradas aún.</TableCell>
                                </TableRow>
                            ) : (
                                stores.map((store) => (
                                    <TableRow key={store.id}>
                                        <TableCell className="font-mono text-xs text-slate-400 pl-6">
                                            {store.id.substring(0, 8)}...
                                        </TableCell>
                                        <TableCell className="font-semibold text-slate-800">
                                            {store.name}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{store.profiles?.full_name || 'Desconocido'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-500">
                                            {store.created_at ? format(parseISO(store.created_at), "dd MMM yyyy", { locale: es }) : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none">
                                                Activa
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setEditClient({
                                                            id: store.owner_id,
                                                            fullName: store.profiles?.full_name || '',
                                                            storeName: store.name || '',
                                                            email: '',
                                                            password: ''
                                                        });
                                                        setIsEditOpen(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4 text-slate-500" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setDeleteClientId(store.owner_id);
                                                        setIsDeleteOpen(true);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleEditClient}>
                        <DialogHeader>
                            <DialogTitle>Editar Cliente</DialogTitle>
                            <DialogDescription>
                                Modifica los datos del cliente. Deja la contraseña o el correo en blanco si no deseas cambiarlos.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="editFullName">Nombre Completo</Label>
                                <Input
                                    id="editFullName"
                                    value={editClient?.fullName || ''}
                                    onChange={(e) => setEditClient(prev => prev ? { ...prev, fullName: e.target.value } : null)}
                                    disabled={isEditing}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editStoreName">Nombre del Negocio</Label>
                                <Input
                                    id="editStoreName"
                                    value={editClient?.storeName || ''}
                                    onChange={(e) => setEditClient(prev => prev ? { ...prev, storeName: e.target.value } : null)}
                                    disabled={isEditing}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editEmail">Nuevo Correo (Opcional)</Label>
                                <Input
                                    id="editEmail"
                                    type="email"
                                    placeholder="correo@ejemplo.com"
                                    value={editClient?.email || ''}
                                    onChange={(e) => setEditClient(prev => prev ? { ...prev, email: e.target.value } : null)}
                                    disabled={isEditing}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editPassword">Nueva Contraseña (Opcional)</Label>
                                <Input
                                    id="editPassword"
                                    type="password"
                                    placeholder="Min. 6 caracteres"
                                    value={editClient?.password || ''}
                                    onChange={(e) => setEditClient(prev => prev ? { ...prev, password: e.target.value } : null)}
                                    disabled={isEditing}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isEditing}>Cancelar</Button>
                            <Button type="submit" disabled={isEditing} className="bg-blue-600 hover:bg-blue-700">
                                {isEditing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Eliminar Cliente</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de que deseas eliminar este cliente? Esta acción borrará todas sus tiendas, ventas, inventario y su historial de mensajes. No se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>Cancelar</Button>
                        <Button type="button" variant="destructive" onClick={handleDeleteClient} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Eliminar Definitivamente
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
