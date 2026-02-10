import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  role: 'super_admin' | 'admin' | 'technician' | 'client' | 'customer';
  company_id?: string;
  avatar_url?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  cargo?: string;
  signature_url?: string;
}

export * from '../types';
