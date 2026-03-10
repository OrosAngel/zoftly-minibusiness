import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

/**
 * POST /api/automation/sell
 * 
 * Registra una venta automatizada para la tienda identificada por API Key.
 * Descuenta stock, registra movimientos de inventario, y maneja pagos al fiado.
 *
 * Headers:
 *   Authorization: Bearer <api_key>
 *
 * Body:
 * {
 *   "items": [
 *     { "product_name": "Coca-Cola", "quantity": 2 }
 *     // o { "barcode": "7750001", "quantity": 1 }
 *   ],
 *   "payment_method": "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "FIADO" | "YAPE_PLIN",
 *   "customer_id": "uuid" // opcional, requerido si payment_method es FIADO
 * }
 */
export async function POST(req: Request) {
    try {
        // --- Auth ---
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Falta Token de Autorización (API Key)' },
                { status: 401 }
            );
        }

        const apiKey = authHeader.split(' ')[1];

        const { data: store, error: storeError } = await supabase
            .from('stores')
            .select('id')
            .eq('api_key', apiKey)
            .single();

        if (storeError || !store) {
            return NextResponse.json(
                { error: 'API Key inválida o tienda no encontrada' },
                { status: 401 }
            );
        }

        // --- Parse Body ---
        const body = await req.json();
        const {
            items,
            payment_method = 'EFECTIVO',
            customer_id
        } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: 'Se requiere un array "items" con al menos un producto.' },
                { status: 400 }
            );
        }

        const validPayments = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'FIADO', 'YAPE_PLIN'];
        if (!validPayments.includes(payment_method)) {
            return NextResponse.json(
                { error: `Método de pago inválido. Opciones: ${validPayments.join(', ')}` },
                { status: 400 }
            );
        }

        if (payment_method === 'FIADO' && !customer_id) {
            return NextResponse.json(
                { error: 'Se requiere "customer_id" para ventas al FIADO.' },
                { status: 400 }
            );
        }

        // --- Resolve Products ---
        const resolvedItems: {
            product: { id: string; name: string; barcode: string; price: number; stock: number };
            quantity: number;
        }[] = [];

        for (const item of items) {
            const { product_name, barcode, quantity } = item;

            if (!quantity || quantity <= 0) {
                return NextResponse.json(
                    { error: `Cantidad inválida para el producto "${product_name || barcode}".` },
                    { status: 400 }
                );
            }

            if (!product_name && !barcode) {
                return NextResponse.json(
                    { error: 'Cada item necesita "product_name" o "barcode".' },
                    { status: 400 }
                );
            }

            // Search by barcode first, then by name
            let query = supabase
                .from('products')
                .select('id, name, barcode, price, stock')
                .eq('store_id', store.id);

            if (barcode) {
                query = query.eq('barcode', barcode);
            } else {
                query = query.ilike('name', `%${product_name}%`);
            }

            const { data: products, error: productError } = await query.limit(1);

            if (productError || !products || products.length === 0) {
                return NextResponse.json(
                    { error: `Producto "${product_name || barcode}" no encontrado en tu tienda.` },
                    { status: 404 }
                );
            }

            const product = products[0];

            // Validate stock
            if (product.stock < quantity) {
                return NextResponse.json(
                    {
                        error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${quantity}.`
                    },
                    { status: 400 }
                );
            }

            resolvedItems.push({ product, quantity });
        }

        // --- Process Sale ---
        let totalAmount = 0;
        const saleItemsToInsert: { product_id: string; quantity: number; unit_price: number; subtotal: number }[] = [];
        const stockUpdates: { productId: string; newStock: number }[] = [];
        const movementsToInsert: {
            store_id: string;
            product_id: string;
            movement_type: string;
            quantity_changed: number;
            previous_stock: number;
            new_stock: number;
        }[] = [];

        for (const { product, quantity } of resolvedItems) {
            const subtotal = product.price * quantity;
            totalAmount += subtotal;

            saleItemsToInsert.push({
                product_id: product.id,
                quantity,
                unit_price: product.price,
                subtotal,
            });

            const newStock = product.stock - quantity;
            stockUpdates.push({ productId: product.id, newStock });

            movementsToInsert.push({
                store_id: store.id,
                product_id: product.id,
                movement_type: 'AUTOMATIZACION',
                quantity_changed: -quantity,
                previous_stock: product.stock,
                new_stock: newStock,
            });
        }

        // Insert sale
        const { data: insertedSale, error: saleError } = await supabase
            .from('sales')
            .insert({
                store_id: store.id,
                total_amount: totalAmount,
                payment_method,
                customer_id: customer_id || null,
            })
            .select()
            .single();

        if (saleError) {
            return NextResponse.json(
                { error: 'Error al registrar la venta.', details: saleError.message },
                { status: 500 }
            );
        }

        // Insert sale items, update stock, insert movements — all in parallel
        const saleItemsWithSaleId = saleItemsToInsert.map(item => ({
            ...item,
            sale_id: insertedSale.id,
        }));

        const stockPromises = stockUpdates.map(({ productId, newStock }) =>
            supabase.from('products').update({ stock: newStock }).eq('id', productId)
        );

        const [, itemsResult, movesResult] = await Promise.all([
            Promise.all(stockPromises),
            supabase.from('sale_items').insert(saleItemsWithSaleId),
            supabase.from('inventory_movements').insert(movementsToInsert),
        ]);

        if (itemsResult.error) {
            console.error('Error inserting sale items:', itemsResult.error);
        }
        if (movesResult.error) {
            console.error('Error inserting movements:', movesResult.error);
        }

        // Handle FIADO customer debt
        if (payment_method === 'FIADO' && customer_id) {
            const { data: customer } = await supabase
                .from('customers')
                .select('total_debt')
                .eq('id', customer_id)
                .single();

            if (customer) {
                await supabase
                    .from('customers')
                    .update({ total_debt: customer.total_debt + totalAmount })
                    .eq('id', customer_id);
            }
        }

        // --- Response ---
        return NextResponse.json({
            success: true,
            message: 'Venta registrada exitosamente',
            sale: {
                id: insertedSale.id,
                total_amount: totalAmount,
                payment_method,
                items: resolvedItems.map(({ product, quantity }) => ({
                    product_name: product.name,
                    quantity,
                    unit_price: product.price,
                    subtotal: product.price * quantity,
                    stock_remaining: product.stock - quantity,
                })),
                created_at: insertedSale.created_at,
            },
        });
    } catch (error: unknown) {
        console.error('Automation sell error:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return NextResponse.json(
            { error: 'Error interno del servidor', details: message },
            { status: 500 }
        );
    }
}
