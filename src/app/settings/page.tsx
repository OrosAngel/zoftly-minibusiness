"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Eye, EyeOff, Copy, Webhook } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// EndpointDoc Component removed

export default function SettingsPage() {
    const [mounted, setMounted] = useState(false);
    const store = useStore((state) => state.currentStore);
    const setCurrentStore = useStore((state) => state.setCurrentStore);
    
    const [showKey, setShowKey] = useState(false);
    
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [storeName, setStoreName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (store?.name) {
            setStoreName(store.name);
        }
        
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.user_metadata) {
                setFirstName(user.user_metadata.first_name || "");
                setLastName(user.user_metadata.last_name || "");
            }
        });
    }, [store]);

    if (!mounted) return <div className="p-8">Cargando ajustes...</div>;

    const handleCopy = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${type} copiado al portapapeles`);
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            // Update Auth User Metadata
            const { error: userError } = await supabase.auth.updateUser({
                data: { first_name: firstName, last_name: lastName }
            });
            if (userError) throw userError;

            // Update Store Name in DB
            if (storeName !== store.name) {
                const { error: storeError } = await supabase
                    .from('stores')
                    .update({ name: storeName })
                    .eq('id', store.id);
                if (storeError) throw storeError;
                
                // Update Zustand Store
                setCurrentStore({ ...store, name: storeName });
            }

            toast.success("Perfil actualizado correctamente");
        } catch (error: any) {
            toast.error("Error al guardar", { description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const apiKeyPlaceholder = store.api_key || "TU_API_KEY";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://tu-dominio.com";

    return (
        <div className="flex-1 space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Ajustes del Sistema</h2>
            </div>

            <div className="grid gap-6">
                {/* API Key Card */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="flex items-center text-slate-800 text-lg">
                            <Webhook className="mr-2 h-5 w-5 text-purple-600" />
                            Integración por Automatización (API / Webhooks)
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                            Conecta tu herramienta de automatización (como n8n, Make, o tu propio Bot de Telegram) para vender y actualizar stock automáticamente.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">

                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 flex items-center">
                                <Key className="w-4 h-4 mr-2" />
                                API Key (Token de Autorización)
                            </label>
                            <p className="text-xs text-slate-500 mb-2">Este token es como tu contraseña para la automatización. No lo compartas con nadie.</p>

                            {!store.api_key ? (
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm">
                                    No se encontró una API Key para esta tienda. Asegúrate de haber ejecutado la migración en Supabase para generar las claves de acceso automáticamente.
                                </div>
                            ) : (
                                <div className="flex space-x-2">
                                    <Input
                                        type={showKey ? "text" : "password"}
                                        value={store.api_key}
                                        readOnly
                                        className="font-mono bg-slate-50"
                                    />
                                    <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)} title={showKey ? "Ocultar" : "Mostrar"}>
                                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="secondary" onClick={() => handleCopy(store.api_key || "", "API Key")}>
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copiar
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Profile Edit Card */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="flex items-center text-slate-800 text-lg">
                            <span className="mr-2 text-xl">👤</span>
                            Perfil de Usuario y Tienda
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                            Actualiza tus datos personales y el nombre de tu negocio.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Nombre</label>
                                <Input
                                    placeholder="Tu nombre"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Apellido</label>
                                <Input
                                    placeholder="Tu apellido"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <label className="text-sm font-semibold text-slate-700">Nombre del Negocio</label>
                            <Input
                                placeholder="Ej. Bodega Don Lucho"
                                value={storeName}
                                onChange={(e) => setStoreName(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button 
                                onClick={handleSaveProfile} 
                                disabled={isSaving || !firstName || !storeName}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isSaving ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
