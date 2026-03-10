import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

/**
 * POST /api/automation/link
 *
 * Vincula un chat_id de Telegram con una tienda a través de su API Key.
 * Esto permite que un bot compartido (@ZoftlyBot) identifique a qué tienda
 * pertenece cada usuario de Telegram.
 *
 * Body:
 * {
 *   "telegram_id": "98765432",   // chat_id del usuario en Telegram
 *   "api_key": "zft_abc123..."   // API Key de la tienda a vincular
 * }
 * 
 * GET /api/automation/link?telegram_id=98765432
 *
 * Consulta si un telegram_id ya está vinculado a una tienda.
 * Retorna la api_key y store_id si existe el vínculo.
 */

// POST: Vincular telegram_id con tienda
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { telegram_id, api_key } = body;

        if (!telegram_id || !api_key) {
            return NextResponse.json(
                { error: 'Se requiere "telegram_id" y "api_key".' },
                { status: 400 }
            );
        }

        // Validate API Key → find store
        const { data: store, error: storeError } = await supabase
            .from('stores')
            .select('id, name')
            .eq('api_key', api_key)
            .single();

        if (storeError || !store) {
            return NextResponse.json(
                { error: 'API Key inválida. Verifica tu clave en Zoftly → Ajustes.' },
                { status: 401 }
            );
        }

        // Upsert: if telegram_id already exists, update. Otherwise insert.
        const { error: linkError } = await supabase
            .from('telegram_links')
            .upsert(
                {
                    telegram_id: String(telegram_id),
                    api_key,
                    store_id: store.id,
                },
                { onConflict: 'telegram_id' }
            );

        if (linkError) {
            console.error('Error linking telegram:', linkError);
            return NextResponse.json(
                { error: 'Error al vincular tu cuenta de Telegram.', details: linkError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `¡Vinculado exitosamente a "${store.name}"!`,
            store: {
                id: store.id,
                name: store.name,
            },
        });
    } catch (error: unknown) {
        console.error('Automation link error:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return NextResponse.json(
            { error: 'Error interno del servidor', details: message },
            { status: 500 }
        );
    }
}

// GET: Consultar vínculo existente
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const telegramId = url.searchParams.get('telegram_id');

        if (!telegramId) {
            return NextResponse.json(
                { error: 'Se requiere el parámetro "telegram_id".' },
                { status: 400 }
            );
        }

        const { data: link, error: linkError } = await supabase
            .from('telegram_links')
            .select('telegram_id, api_key, store_id')
            .eq('telegram_id', telegramId)
            .single();

        if (linkError || !link) {
            return NextResponse.json({
                linked: false,
                message: 'Este chat de Telegram no está vinculado a ninguna tienda.',
            });
        }

        // Get store name
        const { data: store } = await supabase
            .from('stores')
            .select('name')
            .eq('id', link.store_id)
            .single();

        return NextResponse.json({
            linked: true,
            store: {
                id: link.store_id,
                name: store?.name || 'Tienda',
                api_key: link.api_key,
            },
        });
    } catch (error: unknown) {
        console.error('Automation link check error:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return NextResponse.json(
            { error: 'Error interno del servidor', details: message },
            { status: 500 }
        );
    }
}
