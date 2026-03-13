"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useStore, Product, PaymentMethod } from "@/store";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Landmark, UserPlus, Package, Loader2, Printer, X, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ThermalTicket } from "@/components/pos/ThermalTicket";
import { toast } from "sonner";
import { useHydration } from "@/hooks/use-hydration";
import { supabase } from "@/lib/supabase";

interface CartItem {
    product: Product;
    quantity: number;
}

export default function POSPage() {
    const mounted = useHydration();
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories);
    const customers = useStore((state) => state.customers);
    const processSale = useStore((state) => state.processSale);
    const currentStore = useStore((state) => state.currentStore);
    const updateProduct = useStore((state) => state.updateProduct);

    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
    const [selectedCustomer, setSelectedCustomer] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [cashierName, setCashierName] = useState("Cajero Local");
    const lastActionTime = useRef(0);

    const [successDialog, setSuccessDialog] = useState<{
        open: boolean;
        total: number;
        paymentMethod: string;
        customerName?: string;
        items: CartItem[];
    }>({ open: false, total: 0, paymentMethod: "EFECTIVO", items: [] });

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.user_metadata?.first_name) {
                setCashierName(user.user_metadata.first_name);
            } else if (user?.email) {
                setCashierName(user.email.split('@')[0]);
            }
        });
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, selectedCategory]);

    const filteredProducts = useMemo(() => {
        const lowerSearch = search.toLowerCase();
        const filtered = products.filter(p =>
            (selectedCategory === "ALL" || p.category_id === selectedCategory) &&
            (p.name.toLowerCase().includes(lowerSearch) || p.barcode.includes(search))
        );
        
        // Sort: Favorites first
        return filtered.sort((a, b) => {
            if (a.is_favorite && !b.is_favorite) return -1;
            if (!a.is_favorite && b.is_favorite) return 1;
            return 0;
        });
    }, [products, search, selectedCategory]);

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = useMemo(
        () => filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
        [filteredProducts, currentPage, itemsPerPage]
    );

    const addToCart = useCallback((product: Product) => {
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
    }, []);

    const updateQuantity = useCallback((productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQ = item.quantity + delta;
                if (newQ > item.product.stock) return item;
                return { ...item, quantity: Math.max(0, newQ) };
            }
            return item;
        }).filter(item => item.quantity > 0));
    }, []);

    const setExactQuantity = useCallback((productId: string, qtyStr: string) => {
        let parsed = parseInt(qtyStr, 10);
        if (qtyStr === "") parsed = 0;
        if (isNaN(parsed) || parsed < 0) return;

        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                let newQ = parsed;
                if (newQ > item.product.stock) newQ = item.product.stock;
                return { ...item, quantity: newQ };
            }
            return item;
        }));
    }, []);

    const total = useMemo(
        () => cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0),
        [cart]
    );

    if (!mounted) return <div className="p-8">Cargando POS...</div>;

    const handleCheckout = async () => {
        const now = Date.now();
        if (now - lastActionTime.current < 2000) return; // Bloquear clicks en un margen de 2 segundos
        lastActionTime.current = now;

        const validCart = cart.filter(item => item.quantity > 0);
        if (validCart.length === 0 || isProcessing) return;
        if (paymentMethod === "FIADO" && !selectedCustomer) {
            toast.error("Cliente requerido", { description: "Para ventas al fiado, seleccione un cliente." });
            return;
        }

        setIsProcessing(true);
        try {
            await processSale(validCart, paymentMethod, paymentMethod === "FIADO" ? selectedCustomer : undefined);

            setSuccessDialog({
                open: true,
                total: total,
                paymentMethod: paymentMethod,
                customerName: paymentMethod === "FIADO" ? customers.find(c => c.id === selectedCustomer)?.first_name : undefined,
                items: [...validCart],
            });

            setCart([]);
            setSearch("");
            setPaymentMethod("EFECTIVO");
            setSelectedCustomer("");
        } catch (error) {
            toast.error("Error procesando venta", { description: "Hubo un problema de conexión. Intente de nuevo." });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
        <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-slate-100 overflow-hidden print:hidden">
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
                        {paginatedProducts.map(product => (
                            <Card
                                key={product.id}
                                className={`relative cursor-pointer transition-all hover:shadow-md hover:border-blue-400 active:scale-95 ${product.stock <= 0 ? "opacity-50 grayscale" : ""}`}
                                onClick={() => addToCart(product)}
                            >
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute top-1 right-1 h-8 w-8 z-10 hover:bg-transparent"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateProduct(product.id, { is_favorite: !product.is_favorite });
                                    }}
                                >
                                    <Star 
                                        className={`h-5 w-5 ${product.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`} 
                                    />
                                </Button>
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-32 pt-6">
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
                        {paginatedProducts.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-500">
                                <Package className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                                <p>No se encontraron productos.</p>
                            </div>
                        )}
                    </div>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-2 pt-4 shrink-0 mt-auto border-t border-slate-200/60">
                        <div className="flex items-center space-x-2 w-full justify-between sm:w-auto">
                            <Button
                                variant="outline"
                                className="bg-white shadow-sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                Anterior
                            </Button>
                            <span className="text-sm font-medium text-slate-600 sm:hidden">
                                {currentPage} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                className="bg-white shadow-sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                Siguiente
                            </Button>
                        </div>
                        <p className="text-sm text-slate-500 hidden sm:block">
                            Página <span className="font-medium text-slate-900">{currentPage}</span> de <span className="font-medium text-slate-900">{totalPages}</span>
                        </p>
                    </div>
                )}
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
                                <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-md">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-slate-100 hover:text-red-600" onClick={() => updateQuantity(item.product.id, -1)}>
                                        {item.quantity === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                    </Button>
                                    <Input
                                        type="number"
                                        min="0"
                                        max={item.product.stock.toString()}
                                        className="w-12 h-8 text-center text-sm font-semibold p-0 border-none focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={item.quantity === 0 ? "" : item.quantity}
                                        onChange={(e) => setExactQuantity(item.product.id, e.target.value)}
                                        onBlur={() => setCart(prev => prev.filter(i => i.quantity > 0))}
                                    />
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
                            disabled={cart.length === 0 || isProcessing}
                            onClick={handleCheckout}
                        >
                            {isProcessing ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> PROCESANDO...</>
                            ) : (
                                "COBRAR AHORA"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        {/* Diálogo de Éxito */}
        <Dialog open={successDialog.open} onOpenChange={(val) => !val && setSuccessDialog(prev => ({ ...prev, open: false }))}>
            <DialogContent className="sm:max-w-md print:hidden">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl text-green-600">¡Venta Exitosa!</DialogTitle>
                    <DialogDescription className="text-center">
                        La venta por S/ {successDialog.total.toFixed(2)} fue registrada correctamente.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center py-4">
                    <div className="text-4xl font-black text-slate-900 bg-slate-100 p-4 rounded-xl border border-slate-200 shadow-inner">
                        S/ {successDialog.total.toFixed(2)}
                    </div>
                </div>
                <DialogFooter className="flex gap-2 sm:justify-between w-full">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto text-slate-600"
                        onClick={() => setSuccessDialog(prev => ({ ...prev, open: false }))}
                    >
                        <X className="mr-2 h-4 w-4" /> Cerrar
                    </Button>
                    <Button
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-bold"
                        onClick={() => window.print()}
                    >
                        <Printer className="mr-2 h-5 w-5" /> Imprimir Ticket
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Print Area - Only visible when printing */}
        <div className="hidden print:block absolute top-0 left-0 w-full bg-white z-[9999] p-8 !m-0">
            {successDialog.open && (
                <ThermalTicket
                    store={currentStore}
                    cashierName={cashierName}
                    items={successDialog.items}
                    total={successDialog.total}
                    paymentMethod={successDialog.paymentMethod}
                    customerName={successDialog.customerName}
                    date={new Date()}
                />
            )}
        </div>
        </>
    );
}
