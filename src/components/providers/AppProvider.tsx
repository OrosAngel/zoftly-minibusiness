"use client";

import { useStore } from "@/store";
import { useEffect, useState } from "react";
import { LoginPage } from "@/components/auth/LoginPage";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Store } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePathname } from "next/navigation";

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const isAuthenticated = useStore((state) => state.isAuthenticated);
    const setAuthenticated = useStore((state) => state.setAuthenticated);
    const setUserRole = useStore((state) => state.setUserRole);
    const setCurrentStore = useStore((state) => state.setCurrentStore);
    const pathname = usePathname();

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    // Evitar errores de hidratación esperando a que el cliente monte el estado persistido
    useEffect(() => {
        setMounted(true);

        const initializeUserSession = async (userId: string) => {
            try {
                // 1. Fetch the user's role from the new profiles table
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', userId)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') {
                    console.error("Error fetching profile:", profileError);
                }

                // If no profile exists (before SQL script), assume BUSINESS_OWNER
                const role = profile?.role || 'BUSINESS_OWNER';
                setUserRole(role);

                // 2. Only run the store initialization logic for normal business owners
                if (role === 'BUSINESS_OWNER') {
                    const { data: stores, error } = await supabase
                        .from('stores')
                        .select('*')
                        .eq('owner_id', userId);

                    if (error) throw error;

                    if (stores && stores.length > 0) {
                        setCurrentStore(stores[0]);
                    } else {
                        const { data: newStore, error: insertError } = await supabase
                            .from('stores')
                            .insert({ owner_id: userId, name: "Mi Bodega" })
                            .select()
                            .single();

                        if (insertError) throw insertError;
                        if (newStore) {
                            setCurrentStore(newStore);

                            // Insertar categorías por defecto
                            const defaultCategories = [
                                { store_id: newStore.id, name: "Abarrotes" },
                                { store_id: newStore.id, name: "Lácteos" },
                                { store_id: newStore.id, name: "Bebidas" },
                                { store_id: newStore.id, name: "Limpieza" },
                                { store_id: newStore.id, name: "Snacks" },
                                { store_id: newStore.id, name: "Embutidos" },
                            ];
                            await supabase.from('categories').insert(defaultCategories);
                        }
                    }

                    // Fetch inventory data for the active store
                    await useStore.getState().fetchInventoryData();
                }

            } catch (err) {
                console.error("Error setting up user session:", err);
            }
        };

        // Check active session and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                initializeUserSession(session.user.id).then(() => {
                    setAuthenticated(true);
                });
            } else {
                setAuthenticated(false);
            }
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                initializeUserSession(session.user.id).then(() => {
                    setAuthenticated(true);
                });
            } else {
                setAuthenticated(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [setAuthenticated, setCurrentStore, setUserRole]);

    if (!mounted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 animate-pulse" suppressHydrationWarning>
                <div className="h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4" suppressHydrationWarning>
                    <Store className="h-8 w-8 text-white" suppressHydrationWarning />
                </div>
                <p className="text-slate-500 font-medium">Cargando Zoftlytech...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            {/* Desktop Sidebar */}
            <div className="hidden lg:flex lg:flex-shrink-0">
                <Sidebar />
            </div>

            {/* Mobile Sidebar */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetContent side="left" className="p-0 w-64 border-none [&>button]:text-slate-100 [&>button]:z-50 [&>button]:top-5 [&>button]:right-4">
                    <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
                    <Sidebar />
                </SheetContent>
            </Sheet>

            <div className="flex w-0 flex-1 flex-col overflow-hidden">
                <Topbar onMenuClick={() => setIsMobileMenuOpen(true)} />
                <main className="relative flex-1 overflow-y-auto focus:outline-none">
                    {children}
                </main>
            </div>
        </div>
    );
}
