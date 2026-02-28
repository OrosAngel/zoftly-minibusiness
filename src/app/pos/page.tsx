"use client";

import { useState, useEffect } from "react";
import { useStore, Product, PaymentMethod } from "@/store";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Landmark, UserPlus, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CartItem {
    product: Product;
    quantity: number;
}

export default function POSPage() {
    const [mounted, setMounted] = useState(false);
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories);
    const customers = useStore((state) => state.customers);
    const processSale = useStore((state) => state.processSale);

    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
    const [selectedCustomer, setSelectedCustomer] = useState<string>("");

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="p-8">Cargando POS...</div>;

    const filteredProducts = products.filter(p =>
        (selectedCategory === "ALL" || p.category_id === selectedCategory) &&
        (p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search))
    );

    const addToCart = (product: Product) => {
        if (product.stock <= 0) {
            toast.error("Sin stock", { description: "Este producto está agotado." });
            return;
        }
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    toast("Límite de stock", { description: "No hay más unidades disponibles." });
                    return prev;
                }
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQ = item.quantity + delta;
                if (newQ > item.product.stock) return item;
                return { ...item, quantity: Math.max(0, newQ) };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (paymentMethod === "FIADO" && !selectedCustomer) {
            toast.error("Cliente requerido", { description: "Para ventas al fiado, seleccione un cliente." });
            return;
        }

        try {
            await processSale(cart, paymentMethod, paymentMethod === "FIADO" ? selectedCustomer : undefined);

            toast.success("Venta Registrada ✅", {
                description: `Total: S/ ${total.toFixed(2)} pagado en ${paymentMethod}`,
            });

            setCart([]);
            setSearch("");
            setPaymentMethod("EFECTIVO");
            setSelectedCustomer("");
        } catch (error) {
            toast.error("Error procesando venta", { description: "Hubo un problema de conexión. Intente de nuevo." });
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-slate-100 overflow-hidden">
            {/* Catálogo de Productos */}
            <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Buscar producto..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10 sm:h-12 text-sm sm:text-lg shadow-sm"
                            autoFocus
                        />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[140px] sm:w-[200px] h-10 sm:h-12 bg-white">
                            <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas las categorías</SelectItem>
                            {categories.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 pb-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredProducts.map(product => (
                            <Card
                                key={product.id}
                                className={`cursor-pointer transition-all hover:shadow-md hover:border-blue-400 active:scale-95 ${product.stock <= 0 ? "opacity-50 grayscale" : ""}`}
                                onClick={() => addToCart(product)}
                            >
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-32">
                                    <span className="text-sm font-semibold line-clamp-2 leading-tight">{product.name}</span>
                                    <div className="mt-2 text-blue-600 font-bold text-lg">
                                        S/ {product.price.toFixed(2)}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        Stock: {product.stock}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {filteredProducts.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-500">
                                <Package className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                                <p>No se encontraron productos.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Carrito de Compras (Panel Lateral o Inferior) */}
            <div className="w-full lg:w-[400px] bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.05)] z-10 h-1/2 lg:h-full">
                <div className="p-3 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center font-semibold text-lg">
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Venta Actual
                    </div>
                    <div className="bg-slate-800 px-3 py-1 rounded-full text-sm font-bold">
                        {cart.reduce((acc, item) => acc + item.quantity, 0)} items
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
                            <p>El carrito está vacío</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.product.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg shadow-sm bg-slate-50/50">
                                <div className="flex-1 pr-4">
                                    <div className="font-medium text-sm leading-tight text-slate-900">{item.product.name}</div>
                                    <div className="text-blue-600 font-semibold text-sm mt-1">S/ {(item.product.price * item.quantity).toFixed(2)}</div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-md">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-slate-100 hover:text-red-600" onClick={() => updateQuantity(item.product.id, -1)}>
                                        {item.quantity === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                    </Button>
                                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-slate-100" onClick={() => updateQuantity(item.product.id, 1)}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-4 shrink-0">
                    <div className="space-y-3">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider hidden sm:block">Método de Pago</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant={paymentMethod === "EFECTIVO" ? "default" : "outline"}
                                className={`w-full justify-start ${paymentMethod === "EFECTIVO" ? "bg-green-600 hover:bg-green-700 text-white border-green-700" : ""}`}
                                onClick={() => setPaymentMethod("EFECTIVO")}
                            >
                                <Banknote className="mr-2 h-4 w-4" /> Efectivo
                            </Button>
                            <Button
                                variant={paymentMethod === "TRANSFERENCIA" ? "default" : "outline"}
                                className={`w-full justify-start ${paymentMethod === "TRANSFERENCIA" ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-700" : ""}`}
                                onClick={() => setPaymentMethod("TRANSFERENCIA")}
                            >
                                <Landmark className="mr-2 h-4 w-4" /> Transferencia
                            </Button>
                            <Button
                                variant={paymentMethod === "TARJETA" ? "default" : "outline"}
                                className={`w-full justify-start ${paymentMethod === "TARJETA" ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700" : ""}`}
                                onClick={() => setPaymentMethod("TARJETA")}
                            >
                                <CreditCard className="mr-2 h-4 w-4" /> Tarjeta
                            </Button>
                            <Button
                                variant={paymentMethod === "YAPE_PLIN" ? "default" : "outline"}
                                className={`w-full justify-start ${paymentMethod === "YAPE_PLIN" ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-700" : ""}`}
                                onClick={() => setPaymentMethod("YAPE_PLIN")}
                            >
                                <CreditCard className="mr-2 h-4 w-4" /> Yape / Plin
                            </Button>
                            <Button
                                variant={paymentMethod === "FIADO" ? "default" : "outline"}
                                className={`w-full justify-start ${paymentMethod === "FIADO" ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-600" : ""}`}
                                onClick={() => setPaymentMethod("FIADO")}
                            >
                                <UserPlus className="mr-2 h-4 w-4" /> Fiado
                            </Button>
                        </div>

                        {paymentMethod === "FIADO" && (
                            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Seleccionar Cliente" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{`${c.first_name} ${c.last_name}`}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-slate-500 font-medium text-lg">Total a Pagar</span>
                            <span className="text-3xl font-black text-slate-900">S/ {total.toFixed(2)}</span>
                        </div>
                        <Button
                            className="w-full h-14 text-lg font-bold shadow-lg shadow-blue-500/30 transition-transform active:scale-[0.98]"
                            size="lg"
                            disabled={cart.length === 0}
                            onClick={handleCheckout}
                        >
                            COBRAR AHORA
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
