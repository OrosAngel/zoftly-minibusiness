"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Tags,
  TrendingUp,
  Users,
  Settings,
  Store,
  MessageSquare,
  MessageCircle,
  ShoppingCart,
  Package,
  ArrowRightLeft,
  Contact
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

const businessNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Punto de Venta", href: "/pos", icon: ShoppingCart },
  { name: "Inventario", href: "/inventory", icon: Package },
  { name: "Categorías", href: "/categories", icon: Tags },
  { name: "Movimientos", href: "/movements", icon: ArrowRightLeft },
  { name: "Proveedores", href: "/suppliers", icon: Users },
  { name: "Clientes (Fiado)", href: "/customers", icon: Contact },
  { name: "Reportes", href: "/reports", icon: TrendingUp },
  { name: "Soporte (Chat)", href: "/support", icon: MessageCircle },
  { name: "Configuración", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Panel General", href: "/admin", icon: LayoutDashboard },
  { name: "Clientes / Tiendas", href: "/admin/stores", icon: Store },
  { name: "Mensajes de Soporte", href: "/admin/messages", icon: MessageSquare },
  { name: "Ajustes de Plataforma", href: "/admin/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const currentStore = useStore((state) => state.currentStore);
  const userRole = useStore((state) => state.userRole);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  const navigation = userRole === 'ADMIN' ? adminNavigation : businessNavigation;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        if (user.email) setUserEmail(user.email);

        const firstNameStr = user.user_metadata?.first_name || "";
        const lastNameStr = user.user_metadata?.last_name || "";

        const firstName = firstNameStr.split(" ")[0];
        const lastName = lastNameStr.split(" ")[0];

        if (firstName && lastName) {
          setUserName(`${firstName} ${lastName} `);
        } else if (firstName) {
          setUserName(firstName);
        }
      }
    });
  }, []);

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
      <div className="flex h-16 items-center px-6">
        <div className="text-2xl font-bold text-blue-400">Zoftly</div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-300",
                    "mr-3 h-5 w-5 flex-shrink-0"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center text-left">
          <div className="ml-3 truncate max-w-[200px]">
            <p className="text-sm font-medium text-white truncate" title={userName || (userRole === 'ADMIN' ? 'Zoftly Admin' : currentStore?.name) || "Cargando..."}>
              {userName || (userRole === 'ADMIN' ? 'Zoftly Admin' : currentStore?.name) || "Cargando..."}
            </p>
            <p className="text-xs font-medium text-slate-400 truncate" title={userEmail}>
              {userEmail || "Cargando..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
