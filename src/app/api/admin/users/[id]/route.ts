import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) return null;

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

// Middleware helper to check admin role
async function checkIsAdmin(supabaseAdmin: any, adminId: string) {
    if (!supabaseAdmin) return false;
    const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', adminId)
        .single();

    return adminProfile && adminProfile.role === 'ADMIN';
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const supabaseAdmin = getAdminClient();
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuración de servidor incompleta.' }, { status: 500 });

        const { id: userId } = await context.params;
        const body = await request.json();
        const { adminId, fullName, email, password, storeName } = body;

        const isAdmin = await checkIsAdmin(supabaseAdmin, adminId);
        if (!isAdmin) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

        // Update auth user data (email, password, metadata)
        const updateData: any = {
            user_metadata: { full_name: fullName }
        };
        if (email) {
            updateData.email = email;
        }
        if (password) {
            updateData.password = password;
        }

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
        if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

        // Update profile full_name
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ full_name: fullName })
            .eq('id', userId);

        if (profileError) console.error("Error updating profile:", profileError);

        // Update store name
        if (storeName) {
            const { error: storeError } = await supabaseAdmin
                .from('stores')
                .update({ name: storeName })
                .eq('owner_id', userId);

            if (storeError) console.error("Error updating store:", storeError);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const supabaseAdmin = getAdminClient();
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuración de servidor incompleta.' }, { status: 500 });

        const { id: userId } = await context.params;
        const body = await request.json();
        const { adminId } = body;

        const isAdmin = await checkIsAdmin(supabaseAdmin, adminId);
        if (!isAdmin) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

        // Deleting from auth.users cascades to public.profiles and subsequently public.stores
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
    }
}
