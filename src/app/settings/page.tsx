"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Eye, EyeOff, Copy, Webhook, ShoppingCart, Package, Search, Link2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface EndpointDocProps {
    method: "GET" | "POST";
    path: string;
    description: string;
    curlExample: string;
    bodyExample?: string;
    icon: React.ReactNode;
    color: string;
}

function EndpointDoc({ method, path, description, curlExample, bodyExample, icon, color }: EndpointDocProps) {
    const [expanded, setExpanded] = useState(false);

    const handleCopyExample = () => {
        navigator.clipboard.writeText(curlExample);
        toast.success("Ejemplo copiado al portapapeles");
    };

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/80 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${color}`}>
                        {icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${method === "GET"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-blue-100 text-blue-700"
                                }`}>
                                {method}
                            </span>
                            <code className="text-sm font-mono text-slate-700">{path}</code>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{description}</p>
                    </div>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {expanded && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3">
                    {bodyExample && (
                        <div>
                            <p className="text-xs font-semibold text-slate-600 mb-1">Body (JSON):</p>
                            <pre className="text-xs bg-slate-900 text-green-400 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                                {bodyExample}
                            </pre>
                        </div>
                    )}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-slate-600">Ejemplo cURL:</p>
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleCopyExample}>
                                <Copy className="h-3 w-3 mr-1" /> Copiar
                            </Button>
                        </div>
                        <pre className="text-xs bg-slate-900 text-sky-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                            {curlExample}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SettingsPage() {
    const [mounted, setMounted] = useState(false);
    const store = useStore((state) => state.currentStore);
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="p-8">Cargando ajustes...</div>;

    const handleCopy = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${type} copiado al portapapeles`);
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

                {/* API Documentation Card */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                        <CardTitle className="flex items-center text-slate-800 text-lg">
                            <Package className="mr-2 h-5 w-5 text-indigo-600" />
                            Referencia de la API
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                            Estos son los endpoints disponibles para tu automatización. Todos requieren tu API Key en el header
                            <code className="mx-1 px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">Authorization: Bearer TU_API_KEY</code>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-6">

                        <EndpointDoc
                            method="POST"
                            path="/api/automation/sell"
                            description="Registra una venta. Descuenta stock automáticamente."
                            icon={<ShoppingCart className="h-4 w-4 text-white" />}
                            color="bg-blue-500"
                            bodyExample={`{
  "items": [
    { "product_name": "Coca-Cola", "quantity": 2 },
    { "barcode": "7750001", "quantity": 1 }
  ],
  "payment_method": "EFECTIVO"
}`}
                            curlExample={`curl -X POST ${baseUrl}/api/automation/sell \\
  -H "Authorization: Bearer ${apiKeyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [{"product_name": "Coca-Cola", "quantity": 2}],
    "payment_method": "EFECTIVO"
  }'`}
                        />

                        <EndpointDoc
                            method="GET"
                            path="/api/automation/products"
                            description="Consulta tu catálogo de productos y stock disponible."
                            icon={<Search className="h-4 w-4 text-white" />}
                            color="bg-emerald-500"
                            curlExample={`curl "${baseUrl}/api/automation/products?search=coca&in_stock=true" \\
  -H "Authorization: Bearer ${apiKeyPlaceholder}"`}
                        />

                        <EndpointDoc
                            method="POST"
                            path="/api/automation/stock"
                            description="Actualiza el stock de uno o varios productos."
                            icon={<Package className="h-4 w-4 text-white" />}
                            color="bg-amber-500"
                            bodyExample={`{
  "product_name": "Coca-Cola",
  "action": "add",
  "quantity": 50
}`}
                            curlExample={`curl -X POST ${baseUrl}/api/automation/stock \\
  -H "Authorization: Bearer ${apiKeyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"product_name": "Coca-Cola", "action": "add", "quantity": 50}'`}
                        />

                        <EndpointDoc
                            method="POST"
                            path="/api/automation/link"
                            description="Vincula un chat de Telegram con tu tienda (para bot compartido)."
                            icon={<Link2 className="h-4 w-4 text-white" />}
                            color="bg-purple-500"
                            bodyExample={`{
  "telegram_id": "123456789",
  "api_key": "${apiKeyPlaceholder}"
}`}
                            curlExample={`curl -X POST ${baseUrl}/api/automation/link \\
  -H "Content-Type: application/json" \\
  -d '{"telegram_id": "123456789", "api_key": "${apiKeyPlaceholder}"}'`}
                        />

                        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <p className="text-sm font-semibold text-indigo-800 mb-2">💡 Métodos de pago válidos:</p>
                            <div className="flex flex-wrap gap-2">
                                {["EFECTIVO", "TRANSFERENCIA", "TARJETA", "FIADO", "YAPE_PLIN"].map(method => (
                                    <code key={method} className="text-xs bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-700 font-mono">
                                        {method}
                                    </code>
                                ))}
                            </div>
                            <p className="text-xs text-indigo-600 mt-2">
                                Para ventas al FIADO, incluye el campo <code className="bg-white px-1 rounded">&quot;customer_id&quot;</code> con el UUID del cliente.
                            </p>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
