import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize safely (will fail inside handler if missing)
const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Variáveis de ambiente do Supabase (URL ou SERVICE_ROLE) não configuradas.');
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

export async function POST(req: Request) {
    // Init client inside request to handle env errors gracefully
    let supabaseAdmin;
    try {
        supabaseAdmin = getSupabaseAdmin();
    } catch (e: any) {
        console.error('Supabase Init Error:', e);
        return NextResponse.json({ error: 'Erro de configuração do servidor: ' + e.message }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { email, password, full_name, client_id, phone } = body;

        if (!email || !password || !client_id) {
            return NextResponse.json(
                { error: 'Email, senha e ID do cliente são obrigatórios' },
                { status: 400 }
            );
        }

        // 1. Check if user already exists in profiles (by email) to allow password update
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        let userId: string;

        if (existingProfile) {
            // UPDATE EXISTING USER
            userId = existingProfile.id;

            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: password,
                email: email, // ensure email matches
                email_confirm: true,
                user_metadata: {
                    full_name,
                    role: 'client',
                    client_id
                }
            });

            if (updateError) {
                return NextResponse.json(
                    { error: 'Erro ao atualizar senha do usuário: ' + updateError.message },
                    { status: 400 }
                );
            }
        } else {
            // CREATE NEW USER
            // CREATE NEW USER
            const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    full_name,
                    role: 'client',
                    client_id
                }
            });

            // If createUser fails with "User already registered" but we didn't find a profile,
            // it means the state is potentially corrupt (user in Auth but not Profile).
            // In this case, we can't easily recover without the ID.
            // But let's handle the specific error if possible.
            if (createError) {
                return NextResponse.json(
                    { error: createError.message },
                    { status: 400 }
                );
            }
            userId = userData.user.id;
        }

        // 2. Create or Update Profile
        // We need to ensure the profile exists and has the correct role and client_id
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                email,
                full_name,
                role: 'client',
                client_id,
                phone,
                is_active: true,
                updated_at: new Date().toISOString()
            });

        if (profileError) {
            console.error('Error creating profile:', profileError);
            return NextResponse.json(
                { error: 'Usuário salvo, mas erro ao atualizar perfil: ' + profileError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            user_id: userId,
            message: existingProfile ? 'Acesso do usuário atualizado com nova senha!' : 'Usuário do portal criado com sucesso!'
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor: ' + error.message },
            { status: 500 }
        );
    }
}
