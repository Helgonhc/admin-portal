export type Profile = {
    id: string;
    email: string;
    full_name: string;
    role: 'super_admin' | 'admin' | 'technician' | 'client';
    phone?: string;
    avatar_url?: string;
    client_id?: string;
    is_active: boolean;
    cpf?: string;
    cargo?: string;
    permissions?: Record<string, boolean>;
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
    status: 'pendente' | 'em_andamento' | 'concluido' | 'cancelado' | 'aguardando_peca';
    priority: 'baixa' | 'media' | 'alta' | 'urgente';
    scheduled_date?: string;
    completed_at?: string;
    signature?: string;
    photos?: string[];
    created_at: string;
    clients?: Client;
    profiles?: Profile;
    equipments?: Equipment;
    order_number?: number;
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
    status: 'aberto' | 'em_andamento' | 'resolvido' | 'fechado';
    priority: 'baixa' | 'media' | 'alta' | 'urgente';
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
    status: 'draft' | 'sent' | 'approved' | 'rejected' | 'converted' | 'pending' | 'completed';
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
