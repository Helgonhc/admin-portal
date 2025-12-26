/**
 * Utilitários centralizados para padronização de status e prioridades
 * Versão V7 - Technical Master
 */

export const getStatusColor = (status: string): string => {
    const s = status?.toLowerCase();
    switch (s) {
        case 'completed':
        case 'concluido':
        case 'resolved':
        case 'closed':
        case 'aprovado':
        case 'convertido':
            return 'badge-success';
        case 'in_progress':
        case 'em_andamento':
        case 'em_analise':
            return 'badge-info';
        case 'pending':
        case 'pendente':
        case 'open':
        case 'aberto':
            return 'badge-warning';
        case 'cancelled':
        case 'cancelado':
        case 'rejeitado':
            return 'badge-danger';
        default:
            return 'badge-gray';
    }
};

export const getStatusLabel = (status: string): string => {
    const s = status?.toLowerCase();
    const labels: Record<string, string> = {
        pending: 'Pendente',
        pendente: 'Pendente',
        in_progress: 'Em Andamento',
        em_andamento: 'Em Andamento',
        completed: 'Concluído',
        concluido: 'Concluído',
        cancelled: 'Cancelado',
        cancelado: 'Cancelado',
        open: 'Aberto',
        aberto: 'Aberto',
        em_analise: 'Em Análise',
        aprovado: 'Aprovado',
        rejeitado: 'Rejeitado',
        convertido: 'Convertido',
        resolved: 'Resolvido',
        closed: 'Fechado',
    };
    return labels[s] || status;
};

export const getPriorityColor = (priority: string): string => {
    const p = priority?.toLowerCase();
    switch (p) {
        case 'urgent':
        case 'urgente': return 'text-red-600 bg-red-50 border-red-100';
        case 'high':
        case 'alta': return 'text-orange-600 bg-orange-50 border-orange-100';
        case 'medium':
        case 'media':
        case 'média': return 'text-amber-600 bg-amber-50 border-amber-100';
        case 'low':
        case 'baixa': return 'text-green-600 bg-green-50 border-green-100';
        default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
};

export const getPriorityLabel = (priority: string): string => {
    const p = priority?.toLowerCase();
    const labels: Record<string, string> = {
        urgent: 'Urgente',
        urgente: 'Urgente',
        high: 'Alta',
        alta: 'Alta',
        medium: 'Média',
        media: 'Média',
        média: 'Média',
        low: 'Baixa',
        baixa: 'Baixa',
    };
    return labels[p] || priority;
};
