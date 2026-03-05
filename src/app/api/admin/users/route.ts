import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// This API route uses the Service Role Key to bypass RLS and create users safely from the backend.
// It will only execute if the requester is an Admin.

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, fullName, adminId } = body;

        // Verify the user who called this is actually an ADMIN
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en las variables de entorno (.env.local)' },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Verificamos que quien llama al API exista y tenga perfil ADMIN
        const { data: adminProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', adminId)
            .single();

        if (profileError || !adminProfile || adminProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado. Solo los administradores pueden crear clientes.' }, { status: 403 });
        }

        // Crear el usuario nuevo (esto gatillará el trigger SQL que crea su registro en 'profiles' y le pone 'BUSINESS_OWNER')
        const { data: newUser, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm the email
            user_metadata: {
                full_name: fullName
            }
        });

        if (signUpError) {
            console.error("Supabase Admin Auth Error:", signUpError);
            return NextResponse.json({ error: signUpError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, user: newUser.user }, { status: 201 });
    } catch (error: any) {
        console.error("API Error in admin/users:", error);
        return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
}
