'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, MapPin, User, Phone, Clipboard, CheckCircle2, File, Plus, Search, Building2, Wifi, Trash2, Plane, Globe, Droplets, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface InstallationFormProps {
    installation?: any;
    onClose: () => void;
    onSuccess: () => void;
}

const STATUS_OPTIONS = [
    { value: 'pendente', label: 'Pendente', color: 'bg-gray-100 text-gray-700' },
    { value: 'agendada', label: 'Agendado', color: 'bg-blue-100 text-blue-700' },
    { value: 'em_andamento', label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
    { value: 'concluida', label: 'Concluído', color: 'bg-green-100 text-green-700' },
    { value: 'cancelada', label: 'Cancelado', color: 'bg-red-100 text-red-700' },
];

const TELEMETRY_LEVELS = [
    'Placas',
    'Sensor de 2 mts',
    'Sensor de 5 mts',
    'Sensor de 10 mts',
    'Sensor de 15 mts',
    'Sensor de 30 mts',
];

const BRAZIL_STATES = [
    { value: 'AC', label: 'Acre' }, { value: 'AL', label: 'Alagoas' }, { value: 'AP', label: 'Amapá' },
    { value: 'AM', label: 'Amazonas' }, { value: 'BA', label: 'Bahia' }, { value: 'CE', label: 'Ceará' },
    { value: 'DF', label: 'Distrito Federal' }, { value: 'ES', label: 'Espírito Santo' }, { value: 'GO', label: 'Goiás' },
    { value: 'MA', label: 'Maranhão' }, { value: 'MT', label: 'Mato Grosso' }, { value: 'MS', label: 'Mato Grosso do Sul' },
    { value: 'MG', label: 'Minas Gerais' }, { value: 'PA', label: 'Pará' }, { value: 'PB', label: 'Paraíba' },
    { value: 'PR', label: 'Paraná' }, { value: 'PE', label: 'Pernambuco' }, { value: 'PI', label: 'Piauí' },
    { value: 'RJ', label: 'Rio de Janeiro' }, { value: 'RN', label: 'Rio Grande do Norte' }, { value: 'RS', label: 'Rio Grande do Sul' },
    { value: 'RO', label: 'Rondônia' }, { value: 'RR', label: 'Roraima' }, { value: 'SC', label: 'Santa Catarina' },
    { value: 'SP', label: 'São Paulo' }, { value: 'SE', label: 'Sergipe' }, { value: 'TO', label: 'Tocantins' }
].map(s => ({ ...s, flag: `https://cdn.jsdelivr.net/gh/arthurreira/br-state-flags@main/svgs/optimized/${s.value.toLowerCase()}.svg` }));

interface TelemetryItem {
    name: string;
    quantity: number;
}

interface InstallationFormData {
    client_id: string;
    title: string;
    description: string;
    location_address: string;
    state: string;
    contact_name: string;
    contact_phone: string;
    status: string;
    scheduled_date: string;
    scheduled_time: string;
    start_date: string;
    start_time: string;
    end_date: string;
    end_time: string;
    requires_travel: boolean;
    telemetry_items: TelemetryItem[];
    tower_cells: number;
    wifi_ssid: string;
    wifi_password: string;
    cnpj: string;
    technician_name: string;
    technician_id?: string;
    city: string;
    neighborhood: string;
    cep: string;
}

export default function InstallationForm({ installation, onClose, onSuccess }: InstallationFormProps) {
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [isNewClient, setIsNewClient] = useState(!installation?.client_id);
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState<any[]>([]);

    const [formData, setFormData] = useState<InstallationFormData>({
        client_id: installation?.client_id || '',
        title: installation?.title || '',
        description: installation?.description || '',
        location_address: installation?.location_address || '',
        state: installation?.state || '',
        contact_name: installation?.contact_name || '',
        contact_phone: installation?.contact_phone || '',
        status: (installation?.status === 'pending' ? 'pendente' :
            installation?.status === 'scheduled' ? 'agendada' :
                installation?.status === 'in_progress' ? 'em_andamento' :
                    installation?.status === 'completed' ? 'concluida' :
                        installation?.status === 'cancelled' ? 'cancelada' : installation?.status) || 'pendente',
        scheduled_date: installation?.scheduled_date ? new Date(installation.scheduled_date).toISOString().split('T')[0] : '',
        scheduled_time: installation?.scheduled_date ? new Date(installation.scheduled_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '09:00',
        start_date: installation?.start_date ? new Date(installation.start_date).toISOString().split('T')[0] : '',
        start_time: installation?.start_date ? new Date(installation.start_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '09:00',
        end_date: installation?.end_date ? new Date(installation.end_date).toISOString().split('T')[0] : '',
        end_time: installation?.end_date ? new Date(installation.end_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '18:00',
        requires_travel: installation?.requires_travel || false,
        telemetry_items: Array.isArray(installation?.telemetry_levels) ? installation.telemetry_levels : [],
        tower_cells: installation?.tower_cells || 1,
        wifi_ssid: installation?.wifi_ssid || '',
        wifi_password: installation?.wifi_password || '',
        cnpj: installation?.cnpj || '',
        technician_name: installation?.technician_name || '',
        technician_id: installation?.technician_id || '',
        city: installation?.city || '',
        neighborhood: installation?.neighborhood || '',
        cep: installation?.cep || '',
    });

    const [fetchingCnpj, setFetchingCnpj] = useState(false);

    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        tech: false,
        schedule: false,
        castelo: true,
        documents: true
    });

    const toggleSection = (id: string) => {
        setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const [technicians, setTechnicians] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Carregar CNPJ se o cliente mudar (e campo estiver vazio)
    useEffect(() => {
        if (!isNewClient && formData.client_id && !formData.cnpj) {
            const client = clients.find(c => c.id === formData.client_id);
            if (client) {
                setFormData(prev => ({ ...prev, cnpj: client.cnpj_cpf || '' }));
            }
        }
    }, [formData.client_id, isNewClient, clients, formData.cnpj]);

    useEffect(() => {
        loadClients();
        loadTechnicians();
        loadCurrentUser();
        if (installation?.id) {
            loadFiles();
        }
    }, [installation]);

    async function loadCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setCurrentUser(profile);
        }
    }

    async function loadTechnicians() {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .order('full_name');
            setTechnicians(data || []);
        } catch (e) {
            console.error(e);
        }
    }

    const handleAssignToMe = () => {
        if (currentUser) {
            setFormData({
                ...formData,
                technician_id: currentUser.id,
                technician_name: currentUser.full_name || currentUser.username || ''
            });
            toast.success('Atribuído a você!');
        } else {
            toast.error('Não foi possível identificar seu perfil');
        }
    };

    async function loadClients() {
        try {
            const { data } = await supabase.from('clients')
                .select('id, name, address, phone, responsible_name, state')
                .order('name');
            setClients(data || []);
        } catch (e) {
            console.error(e);
        }
    }

    async function loadFiles() {
        try {
            const { data } = await supabase
                .from('installation_documents')
                .select('*')
                .eq('installation_id', installation.id)
                .order('uploaded_at', { ascending: false });
            setFiles(data || []);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!installation?.id) {
            toast.error('Grave a instalação antes de anexar arquivos.');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `installations/${installation.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('installation-documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: doc, error: dbError } = await supabase
                .from('installation_documents')
                .insert([{
                    installation_id: installation.id,
                    file_name: file.name,
                    file_path: filePath,
                    file_type: file.type,
                }])
                .select()
                .single();

            if (dbError) throw dbError;

            setFiles(prev => [doc, ...prev]);
            toast.success('Arquivo anexado!');
        } catch (error: any) {
            console.error(error);
            toast.error('Erro no upload');
        } finally {
            setUploading(false);
        }
    }

    async function handleDeleteFile(fileId: string, filePath: string) {
        if (!confirm('Excluir este arquivo?')) return;
        try {
            await supabase.storage.from('installation-documents').remove([filePath]);
            await supabase.from('installation_documents').delete().eq('id', fileId);
            setFiles(prev => prev.filter(f => f.id !== fileId));
            toast.success('Arquivo removido');
        } catch (e) {
            toast.error('Erro ao excluir');
        }
    }

    async function handleCnpjBlur() {
        if (!formData.cnpj) return;
        const cleanDoc = formData.cnpj.replace(/\D/g, '');
        if (cleanDoc.length !== 14) return;

        setFetchingCnpj(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanDoc}`);
            const data = await response.json();

            if (!data.message) {
                setFormData(prev => ({
                    ...prev,
                    title: data.razao_social || prev.title,
                    location_address: `${data.logradouro}${data.numero ? `, ${data.numero}` : ''}${data.complemento ? ` - ${data.complemento}` : ''}`,
                    neighborhood: data.bairro || '',
                    city: data.municipio || '',
                    state: data.uf || '',
                    cep: data.cep || '',
                    contact_name: data.responsavel_contato || prev.contact_name,
                    contact_phone: data.ddd_telefone_1 || prev.contact_phone,
                }));
                toast.success(`Dados de ${data.nome_fantasia || data.razao_social} carregados!`);
            }
        } catch (e) {
            console.log('Erro ao buscar CNPJ:', e);
        } finally {
            setFetchingCnpj(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.title) {
            toast.error('O título/identificação é obrigatório');
            return;
        }

        setLoading(true);
        try {
            let finalClientId = formData.client_id;

            // Se for novo cliente, criar na carteira primeiro
            if (isNewClient) {
                const { data: newClient, error: clientError } = await supabase
                    .from('clients')
                    .insert([{
                        name: formData.title,
                        cnpj_cpf: formData.cnpj.replace(/\D/g, ''),
                        address: formData.location_address,
                        responsible_name: formData.contact_name,
                        phone: formData.contact_phone,
                        is_active: true,
                        is_telemetry_client: true, // Tag solicitada pelo usuário
                    }])
                    .select()
                    .single();

                if (clientError) throw clientError;
                finalClientId = newClient.id;
            }

            // Helper to combine date and time into ISO string preserving local timezone
            const toISO = (dateStr: string, timeStr: string) => {
                if (!dateStr) return null;
                const [year, month, day] = dateStr.split('-').map(Number);
                const [hours, minutes] = timeStr.split(':').map(Number);
                const dateObj = new Date(year, month - 1, day, hours, minutes);
                return dateObj.toISOString();
            };

            const payload = {
                client_id: finalClientId || null,
                title: formData.title,
                description: formData.description,
                location_address: formData.location_address,
                state: formData.state,
                contact_name: formData.contact_name,
                contact_phone: formData.contact_phone,
                status: formData.status,
                scheduled_date: toISO(formData.scheduled_date, formData.scheduled_time),
                start_date: toISO(formData.start_date, formData.start_time),
                end_date: toISO(formData.end_date, formData.end_time),
                requires_travel: formData.requires_travel,
                telemetry_levels: formData.telemetry_items,
                tower_cells: parseInt(formData.tower_cells.toString()) || 1,
                wifi_ssid: formData.wifi_ssid,
                wifi_password: formData.wifi_password,
                technician_name: formData.technician_name,
                technician_id: formData.technician_id || null,
                cnpj: formData.cnpj,
                city: formData.city,
                neighborhood: formData.neighborhood,
                cep: formData.cep,
                updated_at: new Date().toISOString()
            };

            console.log('Salvando instalação:', payload, 'ID:', installation?.id);

            if (installation?.id) {
                const { error } = await supabase
                    .from('installations')
                    .update(payload)
                    .eq('id', installation.id);
                if (error) {
                    console.error('Erro no update:', error);
                    throw error;
                }
                toast.success('Atualizado com sucesso!');
            } else {
                const { error } = await supabase
                    .from('installations')
                    .insert([payload]);
                if (error) {
                    console.error('Erro no insert:', error);
                    throw error;
                }
                toast.success('Agendado com sucesso!');
            }

            onSuccess();
        } catch (error: any) {
            console.error(error);
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    function toggleItem(itemName: string) {
        setFormData(prev => {
            const index = prev.telemetry_items.findIndex(i => i.name === itemName);
            if (index >= 0) {
                return {
                    ...prev,
                    telemetry_items: prev.telemetry_items.filter(i => i.name !== itemName)
                };
            } else {
                return {
                    ...prev,
                    telemetry_items: [...prev.telemetry_items, { name: itemName, quantity: 1 }]
                };
            }
        });
    }

    function updateItemQuantity(itemName: string, quantity: number) {
        setFormData(prev => ({
            ...prev,
            telemetry_items: prev.telemetry_items.map(i =>
                i.name === itemName ? { ...i, quantity: Math.max(1, quantity) } : i
            )
        }));
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-950 rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border border-white/20">

                {/* Header Superior */}
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none rotate-3">
                            <Droplets className="text-white -rotate-3" size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                {installation ? 'Ajustar Telemetria' : 'Novo Agendamento Telemetria'}
                            </h2>
                            <div className="flex items-center gap-3">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Configuração Técnica Elite</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-95 text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Formulário Principal */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar">

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                        {/* Bloco Esquerdo: Identificação e Local (7 colunas) */}
                        <div className="lg:col-span-7 space-y-8">

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600">
                                        <Building2 size={16} />
                                    </div>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Identificação do Atendimento</h3>
                                    <button
                                        type="button"
                                        onClick={() => toggleSection('tech')}
                                        className="ml-auto p-1 hover:bg-slate-100 rounded-lg transition-all"
                                    >
                                        <ChevronRight size={18} className={`text-slate-300 transition-transform ${collapsedSections.tech ? '' : 'rotate-90'}`} />
                                    </button>
                                </div>

                                <div className={`transition-all duration-300 overflow-hidden ${collapsedSections.tech ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>

                                    <div className="grid gap-5 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                                        <div>
                                            <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 ml-1">Título da Instalação *</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                placeholder="Ex: Instalação Telemetria - Castelo Central"
                                                className="w-full px-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-2 ml-1">
                                                <label className="block text-[11px] font-black text-indigo-600 uppercase">Técnico Responsável *</label>
                                                <button
                                                    type="button"
                                                    onClick={handleAssignToMe}
                                                    className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase flex items-center gap-1 transition-colors"
                                                >
                                                    <User size={10} />
                                                    Atribuir a mim
                                                </button>
                                            </div>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={18} />
                                                <select
                                                    required
                                                    value={formData.technician_id || ''}
                                                    onChange={e => {
                                                        const selected = technicians.find(t => t.id === e.target.value);
                                                        setFormData({
                                                            ...formData,
                                                            technician_id: e.target.value,
                                                            technician_name: selected?.full_name || ''
                                                        });
                                                    }}
                                                    className="w-full pl-12 pr-5 py-4 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-indigo-900/30 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-indigo-900 dark:text-indigo-100 appearance-none cursor-pointer"
                                                >
                                                    <option value="">Selecione um técnico...</option>
                                                    {technicians.map(t => (
                                                        <option key={t.id} value={t.id}>{t.full_name?.toUpperCase()}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
                                                    <ChevronRight className="rotate-90" size={18} />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div>
                                                <div className="flex items-center justify-between mb-2 ml-1">
                                                    <label className="block text-[11px] font-black text-slate-400 uppercase">Cliente Associado</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsNewClient(!isNewClient)}
                                                        className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border-2 transition-all ${isNewClient ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-400 hover:border-indigo-500 hover:text-indigo-600'
                                                            }`}
                                                    >
                                                        {isNewClient ? 'Novo Cadastro' : 'Puxar da Carteira'}
                                                    </button>
                                                </div>

                                                {isNewClient ? (
                                                    <div className="space-y-4 animate-fadeIn">
                                                        <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-inner">
                                                            <label className="block text-[11px] font-black text-indigo-600 uppercase mb-2">CNPJ do Novo Cliente (Inicie por aqui)</label>
                                                            <div className="relative">
                                                                <Building2 className={`absolute left-4 top-1/2 -translate-y-1/2 ${fetchingCnpj ? 'text-indigo-500 animate-spin' : 'text-indigo-600'}`} size={18} />
                                                                <input
                                                                    type="text"
                                                                    value={formData.cnpj}
                                                                    onBlur={handleCnpjBlur}
                                                                    onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                                                                    placeholder="00.000.000/0000-00 (Busca automática)"
                                                                    className="w-full pl-12 pr-5 py-4 bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-700 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold placeholder:font-medium shadow-sm hover:border-indigo-400"
                                                                />
                                                                {fetchingCnpj && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" size={18} />}
                                                            </div>
                                                            <p className="mt-2 text-[10px] text-indigo-400 font-bold uppercase tracking-widest px-1">Ao preencher, os dados da empresa serão carregados automaticamente.</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <select
                                                            value={formData.client_id}
                                                            onChange={e => {
                                                                const clientId = e.target.value;
                                                                const client = clients.find(c => c.id === clientId);
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    client_id: clientId,
                                                                    title: client ? `Instalação - ${client.name}` : prev.title,
                                                                    location_address: client?.address || prev.location_address,
                                                                    contact_name: client?.responsible_name || prev.contact_name,
                                                                    contact_phone: client?.phone || prev.contact_phone,
                                                                    state: client?.state || prev.state,
                                                                    cnpj: client?.cnpj_cpf || ''
                                                                }));
                                                            }}
                                                            className="w-full px-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all font-medium"
                                                        >
                                                            <option value="">Selecione um cliente existente...</option>
                                                            {clients.map(c => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>

                                                        {/* CNPJ EDITÁVEL NO EDIT/CLIENTE EXISTENTE */}
                                                        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner group transition-all hover:bg-white">
                                                            <div className="flex items-center justify-between mb-2 ml-1">
                                                                <label className="block text-[11px] font-black text-slate-400 uppercase">CNPJ do Atendimento</label>
                                                                <Building2 className="text-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity" size={14} />
                                                            </div>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={formData.cnpj}
                                                                    onBlur={handleCnpjBlur}
                                                                    onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                                                                    placeholder="00.000.000/0000-00"
                                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 dark:text-slate-300"
                                                                />
                                                                {fetchingCnpj && (
                                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                                        <Loader2 className="text-indigo-500 animate-spin" size={16} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="mt-2 text-[9px] text-slate-400 font-bold uppercase tracking-widest px-1">Você pode alterar o CNPJ deste agendamento aqui (Busca automática ativa).</p>
                                                        </div>

                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                            <div className="md:col-span-8">
                                                <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 ml-1">Endereço (Rua, Nº, Compl.)</label>
                                                <div className="relative group">
                                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="text"
                                                        value={formData.location_address}
                                                        onChange={e => setFormData({ ...formData, location_address: e.target.value })}
                                                        placeholder="Rua Exemplo, 123..."
                                                        className="w-full pl-12 pr-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all font-medium"
                                                    />
                                                </div>
                                            </div>
                                            <div className="md:col-span-4">
                                                <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 ml-1">Bairro</label>
                                                <input
                                                    type="text"
                                                    value={formData.neighborhood}
                                                    onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                                                    placeholder="Bairro"
                                                    className="w-full px-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                            <div className="md:col-span-5">
                                                <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 ml-1">Cidade</label>
                                                <input
                                                    type="text"
                                                    value={formData.city}
                                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                                    placeholder="Cidade"
                                                    className="w-full px-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all font-medium"
                                                />
                                            </div>
                                            <div className="md:col-span-3">
                                                <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 ml-1">Estado (UF)</label>
                                                <select
                                                    value={formData.state}
                                                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold appearance-none cursor-pointer"
                                                >
                                                    <option value="">UF</option>
                                                    {BRAZIL_STATES.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-4">
                                                <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 ml-1">CEP</label>
                                                <input
                                                    type="text"
                                                    value={formData.cep}
                                                    onChange={e => setFormData({ ...formData, cep: e.target.value })}
                                                    placeholder="00000-000"
                                                    className="w-full px-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 ml-1">Contato no Local</label>
                                                <div className="relative group">
                                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="text"
                                                        value={formData.contact_name}
                                                        onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                                                        className="w-full pl-12 pr-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all font-medium"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 ml-1">Telefone WhatsApp</label>
                                                <div className="relative group">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="text"
                                                        value={formData.contact_phone}
                                                        onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                                                        className="w-full pl-12 pr-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all font-medium"
                                                    />
                                                </div>
                                            </div>
                                        </div>


                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-orange-50 dark:bg-orange-900/30 rounded-lg text-orange-600">
                                        <Clipboard size={16} />
                                    </div>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cronograma e Status</h3>
                                    <button
                                        type="button"
                                        onClick={() => toggleSection('schedule')}
                                        className="ml-auto p-1 hover:bg-slate-100 rounded-lg transition-all"
                                    >
                                        <ChevronRight size={18} className={`text-slate-300 transition-transform ${collapsedSections.schedule ? '' : 'rotate-90'}`} />
                                    </button>
                                </div>
                                <div className={`transition-all duration-300 overflow-hidden ${collapsedSections.schedule ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
                                    <div className="bg-orange-50/20 dark:bg-orange-900/10 p-6 rounded-3xl border border-orange-100 dark:border-orange-900/30 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-4 bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-orange-50">
                                                <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">Início da Instalação</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="date"
                                                        value={formData.start_date}
                                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-orange-100 dark:border-orange-900/20 rounded-xl focus:border-orange-500 outline-none transition-all font-bold text-xs"
                                                    />
                                                    <input
                                                        type="time"
                                                        value={formData.start_time}
                                                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-orange-100 dark:border-orange-900/20 rounded-xl focus:border-orange-500 outline-none transition-all font-bold text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-4 bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-orange-50">
                                                <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">Previsão de Término</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="date"
                                                        value={formData.end_date}
                                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-orange-100 dark:border-orange-900/20 rounded-xl focus:border-orange-500 outline-none transition-all font-bold text-xs"
                                                    />
                                                    <input
                                                        type="time"
                                                        value={formData.end_time}
                                                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-orange-100 dark:border-orange-900/20 rounded-xl focus:border-orange-500 outline-none transition-all font-bold text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-5 bg-white p-4 rounded-2xl border border-orange-50">
                                            <div>
                                                <label className="block text-[11px] font-black text-orange-600/60 uppercase mb-1 ml-1">Status do Fluxo</label>
                                                <select
                                                    value={formData.status}
                                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-orange-500 outline-none transition-all font-bold text-sm rounded-xl"
                                                >
                                                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                                </select>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, requires_travel: !formData.requires_travel })}
                                                className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.requires_travel
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 rotate-0'
                                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                    }`}
                                            >
                                                <Plane size={16} className={formData.requires_travel ? 'animate-bounce' : ''} />
                                                {formData.requires_travel ? 'Viagem Necessária' : 'Sem Deslocamento Aéreo'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                        </div>

                        {/* Bloco Direito: Dados Técnicos e Arquivos (5 colunas) */}
                        <div className="lg:col-span-5 space-y-8">

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600">
                                        <Clipboard size={16} />
                                    </div>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Especificações do Castelo</h3>
                                    <button
                                        type="button"
                                        onClick={() => toggleSection('castelo')}
                                        className="ml-auto p-1 hover:bg-slate-100 rounded-lg transition-all"
                                    >
                                        <ChevronRight size={18} className={`text-slate-300 transition-transform ${collapsedSections.castelo ? '' : 'rotate-90'}`} />
                                    </button>
                                </div>

                                <div className={`transition-all duration-300 overflow-hidden ${collapsedSections.castelo ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>
                                    <div className="bg-purple-50/30 dark:bg-purple-900/10 p-6 rounded-3xl border border-purple-100 dark:border-purple-900/30 space-y-6">
                                        <div>
                                            <label className="block text-[11px] font-black text-purple-600 uppercase mb-3 ml-1">Quantas células tem no castelo?</label>
                                            <div className="flex gap-2">
                                                {[1, 2, 3, 4].map(n => (
                                                    <button
                                                        key={n}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, tower_cells: n })}
                                                        className={`flex-1 py-3 rounded-xl font-black text-sm border-2 transition-all ${formData.tower_cells === n
                                                            ? 'bg-purple-600 border-purple-600 text-white shadow-lg'
                                                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 hover:border-purple-300'
                                                            }`}
                                                    >
                                                        {n} {n === 1 ? 'Célula' : 'Células'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-4 ml-1">
                                                <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                                                <label className="block text-[11px] font-black text-purple-600 uppercase tracking-widest">Itens de Instalação</label>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                {TELEMETRY_LEVELS.map(level => {
                                                    const selected = formData.telemetry_items.find(i => i.name === level);
                                                    return (
                                                        <div
                                                            key={level}
                                                            className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${selected
                                                                ? 'border-purple-500 bg-purple-50/50 shadow-md shadow-purple-100'
                                                                : 'border-slate-50 hover:border-slate-200 bg-slate-50/50'
                                                                }`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleItem(level)}
                                                                className="flex items-center gap-4 flex-1 text-left"
                                                            >
                                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-200 bg-white'
                                                                    }`}>
                                                                    {selected && <CheckCircle2 size={14} />}
                                                                </div>
                                                                <span className={`text-sm font-bold ${selected ? 'text-purple-900' : 'text-slate-500'}`}>
                                                                    {level}
                                                                </span>
                                                            </button>

                                                            {selected && (
                                                                <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-inner border border-purple-100 animate-slideLeft">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateItemQuantity(level, selected.quantity - 1)}
                                                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <input
                                                                        type="number"
                                                                        value={selected.quantity}
                                                                        onChange={e => updateItemQuantity(level, parseInt(e.target.value) || 1)}
                                                                        className="w-10 text-center font-black text-purple-600 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateItemQuantity(level, selected.quantity + 1)}
                                                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Informações de WiFi - Ativado em progresso ou conclusão */}
                            {(formData.status === 'completed' || formData.status === 'in_progress') && (
                                <section className="space-y-4 animate-slideUp">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600">
                                            <Wifi size={16} />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Informações Pós-Conclusão</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 bg-emerald-50/30 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
                                        <div>
                                            <label className="label-sm">Nome da Rede WiFi (SSID)</label>
                                            <input
                                                type="text"
                                                value={formData.wifi_ssid}
                                                onChange={e => setFormData({ ...formData, wifi_ssid: e.target.value })}
                                                placeholder="Nome da rede no local"
                                                className="input-premium py-3 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="label-sm">Senha da Rede</label>
                                            <input
                                                type="text"
                                                value={formData.wifi_password}
                                                onChange={e => setFormData({ ...formData, wifi_password: e.target.value })}
                                                placeholder="********"
                                                className="input-premium py-3 text-sm"
                                            />
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Upload de Documentos Integrado */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600">
                                            <File size={16} />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Projetos e Fotos</h3>
                                    </div>
                                    {installation?.id && (
                                        <label className="cursor-pointer group">
                                            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider group-hover:bg-indigo-700 transition-all">
                                                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                                Subir Arquivo
                                            </div>
                                        </label>
                                    )}
                                </div>

                                <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                                    {!installation?.id ? (
                                        <div className="text-center py-6 px-4 bg-white dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                                            <File className="mx-auto text-slate-300 mb-2" size={24} />
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salve a instalação primeiro para anexar fotos e projetos</p>
                                        </div>
                                    ) : files.length === 0 ? (
                                        <div className="text-center py-6">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nenhum arquivo anexado ainda</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                            {files.map(file => (
                                                <div key={file.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm animate-fadeIn">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-500 shrink-0">
                                                            <File size={14} />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{file.file_name}</span>
                                                            <span className="text-[9px] text-slate-400 uppercase font-black">{new Date(file.uploaded_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 ml-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => window.open(supabase.storage.from('installation-documents').getPublicUrl(file.file_path).data.publicUrl, '_blank')}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                            title="Visualizar"
                                                        >
                                                            <Search size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteFile(file.id, file.file_path)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>

                        </div>

                    </div>

                    <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <label className="block text-[11px] font-black text-slate-400 uppercase mb-3 ml-1">Observações e Recomendações Técnicas</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl min-h-[100px] focus:border-indigo-500 outline-none transition-all font-medium text-sm"
                            placeholder="Descreva detalhes importantes do local, acesso, altura do castelo ou observações para a equipe técnica..."
                        />
                    </div>

                    {/* Visualização de Assinaturas (Se houver) */}
                    {(installation?.customer_signature || installation?.technician_signature) && (
                        <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                            <label className="block text-[11px] font-black text-indigo-600 uppercase mb-5 ml-1 flex items-center gap-2">
                                <CheckCircle2 size={14} /> Assinaturas de Validação Digital
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {installation.customer_signature && (
                                    <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <img src={installation.customer_signature} className="h-24 object-contain mb-3" alt="Assinatura Cliente" />
                                        <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-700 mb-2" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assinatura do Cliente</span>
                                    </div>
                                )}
                                {installation.technician_signature && (
                                    <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <img src={installation.technician_signature} className="h-24 object-contain mb-3" alt="Assinatura Técnico" />
                                        <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-700 mb-2" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assinatura do Técnico</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </form >

                {/* Footer com Ações */}
                < div className="p-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950" >
                    <div className="hidden md:flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                        <CheckCircle2 size={14} className="text-emerald-500" /> Auto-save ativado em arquivos
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 md:flex-none px-10 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                        >
                            Descartar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-1 md:flex-none px-14 py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                            {installation ? 'Salvar Ajustes' : 'Confirmar Agenda'}
                        </button>
                    </div>
                </div >
            </div >
        </div >
    );
}
