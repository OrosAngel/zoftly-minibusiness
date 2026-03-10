import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/automation/products
 *
 * Consulta el catálogo de productos de la tienda autenticada por API Key.
 * Útil para que un bot busque productos antes de registrar una venta.
 *
 * Headers:
 *   Authorization: Bearer <api_key>
 *
 * Query Params (opcionales):
 *   ?search=coca         → busca por nombre (parcial, case-insensitive)
 *   ?barcode=7750001     → busca por código de barras exacto
 *   ?in_stock=true       → solo productos con stock > 0
 *   ?limit=10            → máximo de resultados (default 50)
 */
export async function GET(req: Request) {
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

        // --- Parse Query Params ---
        const url = new URL(req.url);
        const search = url.searchParams.get('search');
        const barcode = url.searchParams.get('barcode');
        const inStock = url.searchParams.get('in_stock');
        const limitParam = url.searchParams.get('limit');
        const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 100);

        // --- Build Query ---
        let query = supabase
            .from('products')
            .select('id, name, barcode, price, cost, stock, min_stock, category_id')
            .eq('store_id', store.id);

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        if (barcode) {
            query = query.eq('barcode', barcode);
        }

        if (inStock === 'true') {
            query = query.gt('stock', 0);
        }

        query = query.order('name', { ascending: true }).limit(limit);

        const { data: products, error: queryError } = await query;

        if (queryError) {
            return NextResponse.json(
                { error: 'Error al consultar productos.', details: queryError.message },
                { status: 500 }
            );
        }

        // Fetch categories to enrich response
        const categoryIds = [...new Set((products || []).map(p => p.category_id).filter(Boolean))];
        let categoriesMap: Record<string, string> = {};

        if (categoryIds.length > 0) {
            const { data: categories } = await supabase
                .from('categories')
                .select('id, name')
                .in('id', categoryIds);

            if (categories) {
                categoriesMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
            }
        }

        const enrichedProducts = (products || []).map(p => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            min_stock: p.min_stock,
            category: categoriesMap[p.category_id] || null,
            low_stock: p.stock <= p.min_stock,
        }));

        return NextResponse.json({
            success: true,
            count: enrichedProducts.length,
            products: enrichedProducts,
        });
    } catch (error: unknown) {
        console.error('Automation products error:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return NextResponse.json(
            { error: 'Error interno del servidor', details: message },
            { status: 500 }
        );
    }
}
