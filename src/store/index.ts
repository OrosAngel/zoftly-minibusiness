import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";

export type MovementType = "CARGA_INICIAL" | "AUTOMATIZACION" | "MANUAL" | "COMPRA" | "AJUSTE";
export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "FIADO" | "YAPE_PLIN";

export interface StoreContext {
    id: string;
    name: string;
    api_key?: string;
}

export interface Product {
    id: string;
    store_id: string;
    category_id: string;
    supplier_id?: string | null;
    name: string;
    barcode: string;
    price: number;
    cost: number;
    stock: number;
    min_stock: number;
}

export interface Category {
    id: string;
    store_id: string;
    name: string;
}

export interface Supplier {
    id: string;
    store_id: string;
    name: string;
    phone: string;
}

export interface Store {
    id: string;
    name: string;
    owner_id?: string;
    api_key?: string;
}

export interface Sale {
    id: string;
    store_id: string;
    customer_id?: string;
    total_amount: number;
    payment_method: PaymentMethod;
    created_at: string;
}

export interface SaleItem {
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
}

export interface InventoryMovement {
    id: string;
    store_id: string;
    product_id: string;
    movement_type: MovementType;
    quantity_changed: number;
    previous_stock: number;
    new_stock: number;
    created_at: string;
}

export interface Customer {
    id: string;
    store_id: string;
    first_name: string;
    last_name: string;
    description?: string;
    phone: string;
    total_debt: number;
}

// Mock data removed. State now initialized entirely from Supabase.

interface ZoftlytechStore {
    // State
    currentStore: StoreContext;
    userRole: 'ADMIN' | 'BUSINESS_OWNER' | null;
    products: Product[];
    categories: Category[];
    suppliers: Supplier[];
    sales: Sale[];
    saleItems: SaleItem[];
    movements: InventoryMovement[];
    customers: Customer[];

    // Actions
    fetchInventoryData: () => Promise<void>;

    addProduct: (product: Omit<Product, "id" | "store_id">) => Promise<void>;
    updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;

    addCategory: (name: string) => Promise<void>;
    updateCategory: (id: string, name: string) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    addSupplier: (supplier: Omit<Supplier, "id" | "store_id">) => Promise<void>;
    updateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;

    addCustomer: (customer: Omit<Customer, "id" | "store_id">) => Promise<void>;
    updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
    deleteCustomer: (id: string) => Promise<void>;

    adjustStock: (productId: string, quantityToChange: number, type: MovementType) => Promise<void>;

    processSale: (
        items: { product: Product; quantity: number }[],
        paymentMethod: PaymentMethod,
        customerId?: string
    ) => Promise<void>;

    // Local Auth
    isAuthenticated: boolean;
    setAuthenticated: (status: boolean) => void;
    setCurrentStore: (store: StoreContext) => void;
    setUserRole: (role: 'ADMIN' | 'BUSINESS_OWNER' | null) => void;
    clearStore: () => void;
}

export const useStore = create<ZoftlytechStore>()(
    persist(
        (set, get) => ({
            currentStore: { id: "", name: "" },
            userRole: null,
            products: [],
            categories: [],
            suppliers: [],
            sales: [],
            saleItems: [],
            movements: [],
            customers: [],
            isAuthenticated: false,

            fetchInventoryData: async () => {
                const state = get();
                if (!state.currentStore?.id) return;
                const storeId = state.currentStore.id;

                const [categoriesRes, suppliersRes, productsRes, customersRes, salesRes, movementsRes] = await Promise.all([
                    supabase.from('categories').select('*').eq('store_id', storeId),
                    supabase.from('suppliers').select('*').eq('store_id', storeId),
                    supabase.from('products').select('*').eq('store_id', storeId),
                    supabase.from('customers').select('*').eq('store_id', storeId),
                    supabase.from('sales').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
                    supabase.from('inventory_movements').select('*').eq('store_id', storeId).order('created_at', { ascending: false })
                ]);

                // Fetch sale_items filtered by this store's sale IDs
                const saleIds = (salesRes.data || []).map((s: Sale) => s.id);
                let saleItemsData: SaleItem[] = [];
                if (saleIds.length > 0) {
                    const { data } = await supabase.from('sale_items').select('*').in('sale_id', saleIds);
                    saleItemsData = data || [];
                }

                set({
                    categories: categoriesRes.data || [],
                    suppliers: suppliersRes.data || [],
                    products: productsRes.data || [],
                    customers: customersRes.data || [],
                    sales: salesRes.data || [],
                    saleItems: saleItemsData,
                    movements: movementsRes.data || []
                });
            },

            addProduct: async (productData) => {
                const state = get();
                if (!state.currentStore?.id) return;

                // Extraer stock para el movimiento
                const initialStock = productData.stock;

                const { data: newProduct, error } = await supabase
                    .from('products')
                    .insert({ ...productData, store_id: state.currentStore.id })
                    .select()
                    .single();

                if (error) throw error;

                // Registrar movimiento inicial
                if (initialStock > 0) {
                    const movement = {
                        store_id: state.currentStore.id,
                        product_id: newProduct.id,
                        movement_type: "CARGA_INICIAL",
                        quantity_changed: initialStock,
                        previous_stock: 0,
                        new_stock: initialStock,
                    };
                    await supabase.from('inventory_movements').insert(movement);
                    const { data: moveData } = await supabase.from('inventory_movements').select('*').eq('product_id', newProduct.id);
                    if (moveData) set((state) => ({ movements: [...moveData, ...state.movements] }));
                }

                set((state) => ({ products: [...state.products, newProduct] }));
            },

            updateProduct: async (id, updates) => {
                const { data, error } = await supabase
                    .from('products')
                    .update(updates)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;
                set((state) => ({
                    products: state.products.map(p => p.id === id ? data : p)
                }));
            },

            deleteProduct: async (id) => {
                const { error } = await supabase.from('products').delete().eq('id', id);
                if (error) throw error;
                set((state) => ({
                    products: state.products.filter(p => p.id !== id)
                }));
            },

            addCategory: async (name) => {
                const state = get();
                const { data, error } = await supabase
                    .from('categories')
                    .insert({ store_id: state.currentStore.id, name })
                    .select()
                    .single();
                if (error) throw error;
                set((state) => ({ categories: [...state.categories, data] }));
            },

            updateCategory: async (id, name) => {
                const { data, error } = await supabase
                    .from('categories')
                    .update({ name })
                    .eq('id', id)
                    .select()
                    .single();
                if (error) throw error;
                set((state) => ({
                    categories: state.categories.map(c => c.id === id ? data : c)
                }));
            },

            deleteCategory: async (id) => {
                const { error } = await supabase.from('categories').delete().eq('id', id);
                if (error) throw error;
                set((state) => ({
                    categories: state.categories.filter(c => c.id !== id)
                }));
            },

            addSupplier: async (data) => {
                const state = get();
                const { data: newSupplier, error } = await supabase
                    .from('suppliers')
                    .insert({ ...data, store_id: state.currentStore.id })
                    .select()
                    .single();
                if (error) throw error;
                set((state) => ({ suppliers: [...state.suppliers, newSupplier] }));
            },

            updateSupplier: async (id, updates) => {
                const { data, error } = await supabase
                    .from('suppliers')
                    .update(updates)
                    .eq('id', id)
                    .select()
                    .single();
                if (error) throw error;
                set((state) => ({
                    suppliers: state.suppliers.map(s => s.id === id ? data : s)
                }));
            },

            deleteSupplier: async (id) => {
                const { error } = await supabase.from('suppliers').delete().eq('id', id);
                if (error) throw error;
                set((state) => ({
                    suppliers: state.suppliers.filter(s => s.id !== id)
                }));
            },

            addCustomer: async (data) => {
                const state = get();
                const { data: newCustomer, error } = await supabase
                    .from('customers')
                    .insert({ ...data, store_id: state.currentStore.id, total_debt: data.total_debt ?? 0 })
                    .select()
                    .single();
                if (error) throw error;
                set((state) => ({ customers: [...state.customers, newCustomer] }));
            },

            updateCustomer: async (id, updates) => {
                const { data, error } = await supabase
                    .from('customers')
                    .update(updates)
                    .eq('id', id)
                    .select()
                    .single();
                if (error) throw error;
                set((state) => ({
                    customers: state.customers.map(c => c.id === id ? data : c)
                }));
            },

            deleteCustomer: async (id) => {
                const { error } = await supabase.from('customers').delete().eq('id', id);
                if (error) throw error;
                set((state) => ({
                    customers: state.customers.filter(c => c.id !== id)
                }));
            },

            adjustStock: async (productId, quantityToChange, type) => {
                const state = get();
                if (!state.currentStore?.id) return;

                const product = state.products.find(p => p.id === productId);
                if (!product) return;

                const previous_stock = product.stock;
                const new_stock = previous_stock + quantityToChange;

                // Update product stock in Supabase
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ stock: new_stock })
                    .eq('id', productId);

                if (updateError) throw updateError;

                // Insert movement
                const movement = {
                    store_id: state.currentStore.id,
                    product_id: productId,
                    movement_type: type,
                    quantity_changed: quantityToChange,
                    previous_stock,
                    new_stock,
                };

                const { data: moveData, error: moveError } = await supabase
                    .from('inventory_movements')
                    .insert(movement)
                    .select()
                    .single();

                if (moveError) throw moveError;

                set((state) => ({
                    products: state.products.map(p => p.id === productId ? { ...p, stock: new_stock } : p),
                    movements: moveData ? [moveData, ...state.movements] : state.movements,
                }));
            },

            processSale: async (items, paymentMethod, customerId) => {
                const state = get();
                if (!state.currentStore?.id) return;

                let totalAmount = 0;
                const updatedProducts = [...state.products];
                const storeId = state.currentStore.id;
                const now = new Date().toISOString();

                // Prepare data without generating client-side IDs
                const stockUpdates: { productId: string; newStock: number }[] = [];
                const saleItemsToInsert: Omit<SaleItem, 'id' | 'sale_id'>[] = [];
                const movementsToInsert: Omit<InventoryMovement, 'id' | 'created_at'>[] = [];

                for (const item of items) {
                    const subtotal = item.quantity * item.product.price;
                    totalAmount += subtotal;

                    saleItemsToInsert.push({
                        product_id: item.product.id,
                        quantity: item.quantity,
                        unit_price: item.product.price,
                        subtotal,
                    });

                    const pIndex = updatedProducts.findIndex(p => p.id === item.product.id);
                    if (pIndex !== -1) {
                        const currentStock = updatedProducts[pIndex].stock;
                        const newStock = currentStock - item.quantity;
                        updatedProducts[pIndex] = { ...updatedProducts[pIndex], stock: newStock };

                        stockUpdates.push({ productId: item.product.id, newStock });

                        movementsToInsert.push({
                            store_id: storeId,
                            product_id: item.product.id,
                            movement_type: "MANUAL",
                            quantity_changed: -item.quantity,
                            previous_stock: currentStock,
                            new_stock: newStock,
                        });
                    }
                }

                // DB Insert Sale (let Supabase generate the ID)
                const { data: insertedSale, error: saleError } = await supabase
                    .from('sales')
                    .insert({
                        store_id: storeId,
                        total_amount: totalAmount,
                        payment_method: paymentMethod,
                        customer_id: customerId || null,
                    })
                    .select()
                    .single();
                if (saleError) throw saleError;

                // Batch: Update all product stocks in parallel
                const stockPromises = stockUpdates.map(({ productId, newStock }) =>
                    supabase.from('products').update({ stock: newStock }).eq('id', productId)
                );

                // DB Insert Sale Items with the server-generated sale ID
                const saleItemsWithSaleId = saleItemsToInsert.map(item => ({
                    ...item,
                    sale_id: insertedSale.id,
                }));

                // Run stock updates, sale items insert, and movements insert in parallel
                const [stockResults, itemsResult, movesResult] = await Promise.all([
                    Promise.all(stockPromises),
                    saleItemsWithSaleId.length > 0
                        ? supabase.from('sale_items').insert(saleItemsWithSaleId).select()
                        : Promise.resolve({ data: [], error: null }),
                    movementsToInsert.length > 0
                        ? supabase.from('inventory_movements').insert(movementsToInsert).select()
                        : Promise.resolve({ data: [], error: null }),
                ]);

                if (itemsResult.error) throw itemsResult.error;
                if (movesResult.error) throw movesResult.error;

                // Handle FIADO customer debt
                const updatedCustomers = [...state.customers];
                if (paymentMethod === "FIADO" && customerId) {
                    const cIndex = updatedCustomers.findIndex(c => c.id === customerId);
                    if (cIndex !== -1) {
                        const newDebt = updatedCustomers[cIndex].total_debt + totalAmount;
                        updatedCustomers[cIndex] = { ...updatedCustomers[cIndex], total_debt: newDebt };
                        await supabase.from('customers').update({ total_debt: newDebt }).eq('id', customerId);
                    }
                }

                const newSale: Sale = { ...insertedSale, customer_id: customerId || undefined };

                set((state) => ({
                    products: updatedProducts,
                    sales: [newSale, ...state.sales],
                    saleItems: [...(itemsResult.data || []), ...state.saleItems],
                    movements: [...(movesResult.data || []), ...state.movements],
                    customers: updatedCustomers,
                }));
            },
            setAuthenticated: (status: boolean) => set({ isAuthenticated: status }),
            setCurrentStore: (store: StoreContext) => set({ currentStore: store }),
            setUserRole: (role) => set({ userRole: role }),
            clearStore: () => set({
                currentStore: { id: "", name: "" },
                userRole: null,
                products: [],
                categories: [],
                suppliers: [],
                sales: [],
                saleItems: [],
                movements: [],
                customers: [],
                isAuthenticated: false,
            }),
        }),
        {
            name: "zoftly-storage", // name in localStorage
        }
    )
);
