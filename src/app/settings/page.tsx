"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Eye, EyeOff, Copy, Webhook, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
    const [mounted, setMounted] = useState(false);
    const store = useStore((state) => state.currentStore);
    const [showKey, setShowKey] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState("");

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            setWebhookUrl(`${window.location.origin}/api/automation/stock`);
        }
    }, []);

    if (!mounted) return <div className="p-8">Cargando ajustes...</div>;

    const handleCopy = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${type} copiado al portapapeles`);
    };

    return (
        <div className="flex-1 space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Ajustes del Sistema</h2>
            </div>

            <div className="grid gap-6">
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="flex items-center text-slate-800 text-lg">
                            <Webhook className="mr-2 h-5 w-5 text-purple-600" />
                            Integración por Automatización (API / Webhooks)
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                            Conecta tu herramienta de automatización (como n8n, Make, o tu propio Bot de Telegram) para actualizar el stock automáticamente de manera independiente.
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

                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <label className="text-sm font-semibold text-slate-700 flex items-center">
                                URL del Webhook
                            </label>
                            <p className="text-xs text-slate-500 mb-2">Envía peticiones POST a esta dirección desde tu herramienta de automatización.</p>

                            <div className="flex space-x-2">
                                <Input
                                    type="text"
                                    value={webhookUrl}
                                    readOnly
                                    className="font-mono bg-slate-50 text-slate-600 text-sm"
                                />
                                <Button variant="secondary" onClick={() => handleCopy(webhookUrl, "URL del Webhook")}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copiar
                                </Button>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-lg p-4 mt-6">
                            <h4 className="text-slate-100 text-sm font-bold mb-2">Ejemplo de Petición cURL:</h4>
                            <pre className="text-xs text-slate-300 overflow-x-auto font-mono whitespace-pre-wrap">
                                {`curl -X POST ${webhookUrl || "https://tusitio.com/api/automation/stock"} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${store.api_key || "TU_API_KEY"}" \\
  -d '{
    "product_name": "gaseosa",
    "action": "remove",
    "quantity": 1
  }'`}
                            </pre>
                        </div>

                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                            <h4 className="text-blue-800 text-sm font-bold mb-2">Parámetros Permitidos (JSON Body)</h4>
                            <ul className="text-xs text-blue-700 space-y-1 mt-2 list-disc pl-4">
                                <li><code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900 font-bold">product_name</code>: Nombre (o parte del nombre) del producto a modificar. El sistema buscará de manera inteligente el más parecido en caso de enviar texto dictado por voz.</li>
                                <li><code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900 font-bold">action</code>: Puede ser <kbd className="font-mono">add</kbd> (sumar stock), <kbd className="font-mono">remove</kbd> (restar stock / venta) o <kbd className="font-mono">set</kbd> (definir un stock exacto).</li>
                                <li><code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900 font-bold">quantity</code>: El número (entero) de unidades a afectar.</li>
                            </ul>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
