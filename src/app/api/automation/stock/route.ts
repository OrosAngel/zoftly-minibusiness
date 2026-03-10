import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

interface StockUpdateItem {
    product_name?: string;
    barcode?: string;
    action: 'add' | 'remove' | 'set';
    quantity: number;
}

/**
 * POST /api/automation/stock
 *
 * Actualiza el stock de uno o varios productos.
 * 
 * Headers:
 *   Authorization: Bearer <api_key>
 *
 * Body (un solo producto — retrocompatible):
 * { "product_name": "Coca-Cola", "action": "add", "quantity": 10 }
 *
 * Body (también acepta barcode):
 * { "barcode": "7750001", "action": "add", "quantity": 10 }
 *
 * Body (múltiples productos):
 * {
 *   "items": [
 *     { "product_name": "Coca-Cola", "action": "add", "quantity": 10 },
 *     { "barcode": "7750002", "action": "set", "quantity": 50 }
 *   ]
 * }
 */
async function processStockUpdate(
    storeId: string,
    item: StockUpdateItem
): Promise<{ success: boolean; error?: string; result?: Record<string, unknown> }> {
    const { product_name, barcode, action, quantity } = item;

    if (!action || quantity === undefined) {
        return { success: false, error: 'Se requiere "action" y "quantity".' };
    }

    if (!product_name && !barcode) {
        return { success: false, error: 'Se requiere "product_name" o "barcode".' };
    }

    const validActions = ['add', 'remove', 'set'];
    if (!validActions.includes(action)) {
        return { success: false, error: `Acción inválida "${action}". Debe ser: ${validActions.join(', ')}` };
    }

    // Find product by barcode or name
    let query = supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId);

    if (barcode) {
        query = query.eq('barcode', barcode);
    } else {
        query = query.ilike('name', `%${product_name}%`);
    }

    const { data: products, error: productError } = await query.limit(1);

    if (productError || !products || products.length === 0) {
        return { success: false, error: `Producto "${product_name || barcode}" no encontrado.` };
    }

    const product = products[0];
    const currentStock = product.stock;
    let newStock = currentStock;

    if (action === 'add') {
        newStock += quantity;
    } else if (action === 'remove') {
        newStock -= quantity;
    } else if (action === 'set') {
        newStock = quantity;
    }

    // Update Product Stock
    const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id);

    if (updateError) {
        return { success: false, error: `Error al actualizar "${product.name}".` };
    }

    // Record Movement
    const movement = {
        store_id: storeId,
        product_id: product.id,
        movement_type: 'AUTOMATIZACION',
        quantity_changed: newStock - currentStock,
        previous_stock: currentStock,
        new_stock: newStock,
    };

    const { error: moveError } = await supabase
        .from('inventory_movements')
        .insert(movement);

    if (moveError) {
        console.error('Error recording movement:', moveError);
    }

    return {
        success: true,
        result: {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            previous_stock: currentStock,
            new_stock: newStock,
        },
    };
}

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Falta Token de Autorización (API Key)' }, { status: 401 });
        }

        const apiKey = authHeader.split(' ')[1];

        // Validate API Key and find the store
        const { data: store, error: storeError } = await supabase
            .from('stores')
            .select('id')
            .eq('api_key', apiKey)
            .single();

        if (storeError || !store) {
            return NextResponse.json({ error: 'API Key inválida o tienda no encontrada' }, { status: 401 });
        }

        const body = await req.json();

        // Support batch mode (items array) or single mode (backward compatible)
        const items: StockUpdateItem[] = body.items
            ? body.items
            : [{ product_name: body.product_name, barcode: body.barcode, action: body.action, quantity: body.quantity }];

        if (items.length === 0) {
            return NextResponse.json({ error: 'No se proporcionaron productos para actualizar.' }, { status: 400 });
        }

        // Process all items
        const results = await Promise.all(
            items.map(item => processStockUpdate(store.id, item))
        );

        const successes = results.filter(r => r.success);
        const failures = results.filter(r => !r.success);

        // If single mode (no items array), return backward-compatible response
        if (!body.items) {
            const result = results[0];
            if (!result.success) {
                return NextResponse.json({ error: result.error }, { status: 400 });
            }
            return NextResponse.json({
                success: true,
                message: 'Stock actualizado',
                product: result.result,
            });
        }

        // Batch response
        return NextResponse.json({
            success: failures.length === 0,
            message: `${successes.length} producto(s) actualizado(s)${failures.length > 0 ? `, ${failures.length} error(es)` : ''}`,
            results: results.map((r, i) => ({
                item: items[i].product_name || items[i].barcode,
                ...(r.success ? { success: true, product: r.result } : { success: false, error: r.error }),
            })),
        });
    } catch (error: unknown) {
        console.error('Webhook error:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return NextResponse.json({ error: 'Error interno del servidor', details: message }, { status: 500 });
    }
}
