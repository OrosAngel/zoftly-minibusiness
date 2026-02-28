import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
        const { product_name, action, quantity } = body;

        if (!product_name || !action || quantity === undefined) {
            return NextResponse.json({ error: 'Petición inválida. Se requiere product_name, action y quantity' }, { status: 400 });
        }

        // Find the product by name in this store (case-insensitive partial match)
        const { data: products, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('store_id', store.id)
            .ilike('name', `%${product_name}%`)
            .limit(1);

        if (productError || !products || products.length === 0) {
            return NextResponse.json({ error: `Producto '${product_name}' no encontrado` }, { status: 404 });
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
        } else {
            return NextResponse.json({ error: 'Acción inválida. Debe ser add, remove o set' }, { status: 400 });
        }

        // Update Product Stock
        const { error: updateError } = await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', product.id);

        if (updateError) {
            return NextResponse.json({ error: 'Error al actualizar el producto' }, { status: 500 });
        }

        // Record the Movement using type 'AUTOMATIZACION'
        const movement = {
            store_id: store.id,
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
            // Non-fatal error, but we log it
        }

        return NextResponse.json({
            success: true,
            message: 'Stock actualizado',
            product: {
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                previous_stock: currentStock,
                new_stock: newStock
            }
        });

    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
