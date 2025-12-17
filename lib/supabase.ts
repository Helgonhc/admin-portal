import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'technician' | 'client';
  phone?: string;
  avatar_url?: string;
  client_id?: string;
  is_active: boolean;
  cpf?: string;
  cargo?: string;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  cnpj?: string;
  contact_name?: string;
  is_active: boolean;
  created_at: string;
};

export type ServiceOrder = {
  id: string;
  client_id: string;
  equipment_id?: string;
  technician_id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduled_date?: string;
  completed_at?: string;
  signature?: string;
  photos?: string[];
  created_at: string;
  clients?: Client;
  profiles?: Profile;
  equipments?: Equipment;
};

export type Equipment = {
  id: string;
  client_id: string;
  name: string;
  model?: string;
  serial_number?: string;
  brand?: string;
  location?: string;
  qr_code?: string;
  status: 'active' | 'inactive' | 'maintenance';
  last_maintenance?: string;
  next_maintenance?: string;
  created_at: string;
  clients?: Client;
};

export type Ticket = {
  id: string;
  client_id: string;
  equipment_id?: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_by?: string;
  assigned_to?: string;
  photos?: string[];
  created_at: string;
  clients?: Client;
  profiles?: Profile;
};

export type Quote = {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  items: any[];
  total: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  valid_until?: string;
  created_at: string;
  clients?: Client;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  message?: string;
  type?: string;
  is_read: boolean;
  created_at: string;
};

export type OvertimeEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  entry_type: 'overtime' | 'compensation' | 'absence';
  reason?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  employee_signature?: string;
  admin_signature?: string;
  created_at: string;
  profiles?: Profile;
};
