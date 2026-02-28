import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
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

interface ZoftlyStore {
    // State
    currentStore: StoreContext;
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

    addCustomer: (customer: Omit<Customer, "id" | "store_id" | "total_debt">) => Promise<void>;
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
    clearStore: () => void;
}

export const useStore = create<ZoftlyStore>()(
    persist(
        (set, get) => ({
            currentStore: { id: "", name: "" },
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

                const [categoriesRes, suppliersRes, productsRes, customersRes, salesRes, saleItemsRes, movementsRes] = await Promise.all([
                    supabase.from('categories').select('*').eq('store_id', state.currentStore.id),
                    supabase.from('suppliers').select('*').eq('store_id', state.currentStore.id),
                    supabase.from('products').select('*').eq('store_id', state.currentStore.id),
                    supabase.from('customers').select('*').eq('store_id', state.currentStore.id),
                    supabase.from('sales').select('*').eq('store_id', state.currentStore.id),
                    // sale_items doesn't have a direct store_id but we can join, wait, actually we can fetch all sale_items for the sales of this store
                    // For MVP let's just use the RLS policies: our user is authenticated so they will only get their own data, so we can just select all for now since RLS handles it
                    supabase.from('sale_items').select('*'),
                    supabase.from('inventory_movements').select('*').eq('store_id', state.currentStore.id)
                ]);

                set({
                    categories: categoriesRes.data || [],
                    suppliers: suppliersRes.data || [],
                    products: productsRes.data || [],
                    customers: customersRes.data || [],
                    sales: salesRes.data || [],
                    saleItems: saleItemsRes.data || [],
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
                    .insert({ ...data, store_id: state.currentStore.id, total_debt: 0 })
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

                const saleId = uuidv4();
                let totalAmount = 0;

                const newSaleItems: SaleItem[] = [];
                const newMovements: InventoryMovement[] = [];
                const updatedProducts = [...state.products];

                const storeId = state.currentStore.id;
                const now = new Date().toISOString();

                for (const item of items) {
                    const subtotal = item.quantity * item.product.price;
                    totalAmount += subtotal;

                    newSaleItems.push({
                        id: uuidv4(),
                        sale_id: saleId,
                        product_id: item.product.id,
                        quantity: item.quantity,
                        unit_price: item.product.price,
                        subtotal,
                    });

                    const pIndex = updatedProducts.findIndex(p => p.id === item.product.id);
                    if (pIndex !== -1) {
                        const currentStock = updatedProducts[pIndex].stock;
                        const newStock = currentStock - item.quantity;
                        updatedProducts[pIndex] = {
                            ...updatedProducts[pIndex],
                            stock: newStock
                        };

                        newMovements.push({
                            id: uuidv4(),
                            store_id: storeId,
                            product_id: item.product.id,
                            movement_type: "MANUAL", // Venta en POS
                            quantity_changed: -item.quantity,
                            previous_stock: currentStock,
                            new_stock: newStock,
                            created_at: now,
                        });

                        // DB Update product stock
                        await supabase.from('products').update({ stock: newStock }).eq('id', item.product.id);
                    }
                }

                const newSale: Sale = {
                    id: saleId,
                    store_id: storeId,
                    total_amount: totalAmount,
                    payment_method: paymentMethod,
                    customer_id: customerId || undefined,
                    created_at: now,
                };

                // DB Insert Sale
                const dbSale = { ...newSale, customer_id: newSale.customer_id || null };
                const { error: saleError } = await supabase.from('sales').insert(dbSale);
                if (saleError) throw saleError;

                // DB Insert Sale Items
                if (newSaleItems.length > 0) {
                    const { error: itemsError } = await supabase.from('sale_items').insert(newSaleItems);
                    if (itemsError) throw itemsError;
                }

                // DB Insert Movements
                if (newMovements.length > 0) {
                    const { error: movesError } = await supabase.from('inventory_movements').insert(newMovements);
                    if (movesError) throw movesError;
                }

                const updatedCustomers = [...state.customers];
                if (paymentMethod === "FIADO" && customerId) {
                    const cIndex = updatedCustomers.findIndex(c => c.id === customerId);
                    if (cIndex !== -1) {
                        const newDebt = updatedCustomers[cIndex].total_debt + totalAmount;
                        updatedCustomers[cIndex] = {
                            ...updatedCustomers[cIndex],
                            total_debt: newDebt
                        };
                        // DB Update Customer Debt
                        await supabase.from('customers').update({ total_debt: newDebt }).eq('id', customerId);
                    }
                }

                set((state) => ({
                    products: updatedProducts,
                    sales: [newSale, ...state.sales],
                    saleItems: [...newSaleItems, ...state.saleItems],
                    movements: [...newMovements, ...state.movements],
                    customers: updatedCustomers,
                }));
            },
            setAuthenticated: (status: boolean) => set({ isAuthenticated: status }),
            setCurrentStore: (store: StoreContext) => set({ currentStore: store }),
            clearStore: () => set({
                currentStore: { id: "", name: "" },
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
