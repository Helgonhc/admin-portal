import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Este cliente ignora o RLS, deve ser usado apenas no servidor (API Routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
