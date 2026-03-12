import { Product, StoreContext } from "@/store";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ThermalTicketProps {
  store: StoreContext;
  cashierName: string;
  items: { product: Product; quantity: number }[];
  total: number;
  paymentMethod: string;
  customerName?: string;
  date: Date;
}

export function ThermalTicket({
  store,
  cashierName,
  items,
  total,
  paymentMethod,
  customerName,
  date,
}: ThermalTicketProps) {
  return (
    <div className="w-[300px] bg-white text-black text-sm p-4 mx-auto font-mono">
      {/* Store Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold uppercase">{store.name}</h1>
        <p className="text-xs uppercase mt-1">Ticket de Venta</p>
        <p className="text-xs">{format(date, "dd/MM/yyyy HH:mm", { locale: es })}</p>
      </div>

      {/* Details */}
      <div className="border-b border-black pb-2 mb-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span>Cajero:</span>
          <span className="font-bold">{cashierName}</span>
        </div>
        {customerName && (
          <div className="flex justify-between">
            <span>Cliente:</span>
            <span className="font-bold">{customerName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Método:</span>
          <span>{paymentMethod}</span>
        </div>
      </div>

      {/* Items Header */}
      <div className="flex justify-between text-xs font-bold border-b border-black pb-1 mb-2">
        <span className="flex-1">Cant x Prod</span>
        <span>Subtotal</span>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4 text-xs">
        {items.map((item, idx) => {
          const subtotal = item.quantity * item.product.price;
          return (
            <div key={idx} className="flex flex-col">
              <div className="flex justify-between leading-tight mb-1">
                <span className="flex-1 pr-2 uppercase">
                  {item.quantity}x {item.product.name}
                </span>
                <span className="font-bold">
                  S/ {subtotal.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="border-t border-black pt-2 flex justify-between items-center bg-white">
        <span className="text-lg font-bold">TOTAL</span>
        <span className="text-xl font-black">S/ {total.toFixed(2)}</span>
      </div>

      {/* Footer */}
      <div className="text-center mt-8 text-xs">
        <p className="uppercase font-bold mb-1">¡Gracias por su compra!</p>
        <p>Vuelva pronto</p>
        <p className="mt-4 text-[10px] text-gray-500">© 2026 ZoftlyTech</p>
      </div>
    </div>
  );
}
