import { supabase } from '../lib/supabase';

export async function createAuditLog({
    userId,
    action,
    table,
    recordId,
    oldData = null,
    newData = null,
    description
}: {
    userId: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN';
    table: string;
    recordId?: string;
    oldData?: any;
    newData?: any;
    description: string;
}) {
    try {
        const { error } = await supabase.from('audit_logs').insert({
            user_id: userId,
            action,
            target_table: table,
            target_id: recordId,
            old_values: oldData,
            new_values: newData,
            description,
            created_at: new Date().toISOString()
        });

        if (error) throw error;
    } catch (err) {
        console.error('Failed to create audit log:', err);
    }
}
