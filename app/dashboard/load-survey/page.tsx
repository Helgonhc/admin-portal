'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
    Zap,
    Plus,
    Trash2,
    Search,
    Calculator,
    Info,
    ChevronRight,
    Minus,
    FileText,
    User,
    Users,
    ChevronDown,
    X,
    Loader2,
    Building2,
    MapPin,
    Phone,
    Mail,
    UserPlus,
    Save
} from 'lucide-react';
import { COMMON_EQUIPMENTS } from '../../../lib/loadSurveyConstants';
import { LoadSurveyItem, ElectricalEquipment } from '../../../types/load-survey';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateLoadSurveyPDF } from '../../../utils/pdfGenerator';

export default function LoadSurveyPage() {
    const { profile: technicianProfile } = useAuthStore();
    const [items, setItems] = useState<LoadSurveyItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Cliente Selecionado
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<any | null>(null);
    const [clientSearch, setClientSearch] = useState('');
    const [showClientList, setShowClientList] = useState(false);

    // Modal de Cadastro Completo
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [savingClient, setSavingClient] = useState(false);
    const [cnpjLoading, setCnpjLoading] = useState(false);
    const [cepLoading, setCepLoading] = useState(false);

    const [formData, setFormData] = useState({
        type: 'PJ' as 'PF' | 'PJ',
        name: '',
        cnpj_cpf: '',
        ie_rg: '',
        responsible_name: '',
        email: '',
        phone: '',
        zip_code: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        client_logo_url: '',
    });

    // Branding/Config
    const [companyConfig, setCompanyConfig] = useState<any>(null);
    const [savedSurveys, setSavedSurveys] = useState<any[]>([]);
    const [showSavedModal, setShowSavedModal] = useState(false);
    const [savingSurvey, setSavingSurvey] = useState(false);
    const [currentSurveyId, setCurrentSurveyId] = useState<string | null>(null);
    const [surveyTitle, setSurveyTitle] = useState('Novo Levantamento');

    useEffect(() => {
        loadClients();
        loadCompanyConfig();
        loadSavedSurveys();
    }, []);

    async function loadSavedSurveys() {
        try {
            const { data } = await supabase
                .from('load_surveys')
                .select(`*, clients(name)`)
                .order('created_at', { ascending: false });
            if (data) setSavedSurveys(data);
        } catch (error) {
            console.error('Erro ao carregar levantamentos salvos:', error);
        }
    }

    async function handleSaveSurvey() {
        if (!selectedClient) {
            toast.error('Selecione um cliente para salvar o levantamento');
            return;
        }
        if (items.length === 0) {
            toast.error('Adicione itens ao levantamento antes de salvar');
            return;
        }

        setSavingSurvey(true);
        try {
            const payload = {
                client_id: selectedClient.id,
                title: surveyTitle,
                items: items,
                total_watts: totals.watts
            };

            let error;
            if (currentSurveyId) {
                const { error: updateError } = await supabase
                    .from('load_surveys')
                    .update(payload)
                    .eq('id', currentSurveyId);
                error = updateError;
            } else {
                const { data, error: insertError } = await supabase
                    .from('load_surveys')
                    .insert([payload])
                    .select()
                    .single();
                error = insertError;
                if (data) setCurrentSurveyId(data.id);
            }

            if (error) throw error;

            toast.success('Levantamento salvo com sucesso!');
            loadSavedSurveys();
        } catch (error: any) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSavingSurvey(false);
        }
    }

    const loadSurvey = (survey: any) => {
        setCurrentSurveyId(survey.id);
        setSurveyTitle(survey.title);
        setItems(survey.items);
        const client = clients.find(c => c.id === survey.client_id);
        if (client) setSelectedClient(client);
        setShowSavedModal(false);
        toast.success('Levantamento carregado!');
    };

    async function loadCompanyConfig() {
        try {
            const { data } = await supabase.from('app_config').select('*').single();
            if (data) setCompanyConfig(data);
        } catch (error) {
            console.error('Erro ao carregar branding:', error);
        }
    }

    async function loadClients() {
        try {
            const { data } = await supabase.from('clients').select('*').order('name');
            if (data) setClients(data);
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        }
    }

    // Busca automática de CNPJ (BrasilAPI)
    async function handleCnpjBlur() {
        if (formData.type === 'PF') return;
        const cleanDoc = formData.cnpj_cpf.replace(/\D/g, '');
        if (cleanDoc.length !== 14) return;

        setCnpjLoading(true);
        try {
            // Tentamos v1 primeiro que costuma ser mais estável para busca simples
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanDoc}`);
            const data = await response.json();

            if (!response.ok) {
                // Se v1 falhar, tentamos v2 como fallback
                const responseV2 = await fetch(`https://brasilapi.com.br/api/cnpj/v2/${cleanDoc}`);
                const dataV2 = await responseV2.json();

                if (!responseV2.ok) {
                    toast.error(dataV2.message || 'CNPJ não localizado');
                    return;
                }

                fillFormDataWithCnpjData(dataV2);
                return;
            }

            fillFormDataWithCnpjData(data);
            toast.success('Dados da empresa carregados!');
        } catch (e) {
            console.error('Erro CNPJ:', e);
            toast.error('Impossível conectar ao serviço de CNPJ agora');
        } finally {
            setCnpjLoading(false);
        }
    }

    const fillFormDataWithCnpjData = (data: any) => {
        setFormData(prev => ({
            ...prev,
            name: data.razao_social || data.nome_fantasia || prev.name,
            phone: data.ddd_telefone_1 ? `${data.ddd_telefone_1}` : prev.phone,
            email: data.email || prev.email,
            zip_code: data.cep || prev.zip_code,
            street: data.logradouro || prev.street,
            number: data.numero || prev.number,
            complement: data.complemento || prev.complement,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.municipio || prev.city,
            state: data.uf || prev.state,
        }));
    };

    // Busca automática de CEP (ViaCEP)
    async function handleCepBlur() {
        const cleanCep = formData.zip_code.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        setCepLoading(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();
            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    street: data.logradouro || prev.street,
                    neighborhood: data.bairro || prev.neighborhood,
                    city: data.localidade || prev.city,
                    state: data.uf || prev.state,
                }));
                toast.success('Endereço localizado!');
            }
        } catch (e) {
            console.log('Erro CEP:', e);
        } finally {
            setCepLoading(false);
        }
    }

    async function handleSaveClient() {
        if (!formData.name.trim()) {
            toast.error('O nome do cliente é obrigatório');
            return;
        }

        setSavingClient(true);
        try {
            const fullAddress = `${formData.street}, ${formData.number} - ${formData.neighborhood}, ${formData.city}/${formData.state}`;
            const payload = {
                ...formData,
                address: fullAddress,
                is_active: true,
            };

            const { data, error } = await supabase
                .from('clients')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            toast.success('Cliente cadastrado com sucesso!');
            await loadClients();
            setSelectedClient(data);
            setShowRegisterModal(false);
            setFormData({
                type: 'PJ', name: '', cnpj_cpf: '', ie_rg: '', responsible_name: '',
                email: '', phone: '', zip_code: '', street: '', number: '',
                complement: '', neighborhood: '', city: '', state: '', client_logo_url: '',
            });
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSavingClient(false);
        }
    }

    // Filtro de equipamentos
    const filteredEquipments = useMemo(() => {
        return COMMON_EQUIPMENTS.filter(e =>
            e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    const addItem = (equip: ElectricalEquipment) => {
        const newItem: LoadSurveyItem = {
            id: crypto.randomUUID(),
            equipmentId: equip.id,
            name: equip.name,
            quantity: 1,
            power: equip.defaultPower,
            totalPower: equip.defaultPower,
            voltage: 220,
        };
        setItems(prev => [...prev, newItem]);
        toast.success(`${equip.name} adicionado`);
    };

    const removeItem = (id: string) => setItems(prev => prev.filter(item => item.id !== id));

    const updateQuantity = (id: string, delta: number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty, totalPower: newQty * item.power };
            }
            return item;
        }));
    };

    const updatePower = (id: string, newPower: number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) return { ...item, power: newPower, totalPower: item.quantity * newPower };
            return item;
        }));
    };

    const updateCustomName = (id: string, newName: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) return { ...item, customName: newName };
            return item;
        }));
    };


    const updateVoltage = (id: string, newVoltage: 127 | 220 | 380) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) return { ...item, voltage: newVoltage };
            return item;
        }));
    };

    const totals = useMemo(() => {
        const totalWatts = items.reduce((sum, item) => sum + item.totalPower, 0);

        // Calculate separated values
        let watts127 = 0;
        let watts220 = 0;
        let watts380 = 0;

        items.forEach(item => {
            const subtotal = item.totalPower;
            const v = Number(item.voltage);
            if (v === 127) watts127 += subtotal;
            else if (v === 380) watts380 += subtotal;
            else watts220 += subtotal;
        });

        const amps127 = watts127 > 0 ? (watts127 / 127) : 0;
        const amps220 = watts220 > 0 ? (watts220 / 220) : 0;
        const amps380 = watts380 > 0 ? (watts380 / (380 * 1.73205)) : 0;

        return {
            watts: totalWatts,
            kw: totalWatts / 1000,
            amperes: amps127 + amps220 + amps380, // Total estimated amps (just for reference)
            breaker: Math.ceil((amps127 + amps220 + amps380) * 1.25), // Rough estimate
            breakdown: {
                v127: { watts: watts127, amps: amps127 },
                v220: { watts: watts220, amps: amps220 },
                v380: { watts: watts380, amps: amps380 }
            }
        };
    }, [items]);

    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

    const handleExportPDF = async () => {
        if (!selectedClient && !formData.name) {
            toast.error('Por favor, identifique o cliente primeiro');
            return;
        }
        if (items.length === 0) {
            toast.error('Adicione equipamentos para gerar o relatório');
            return;
        }

        try {
            const surveyData = {
                id: currentSurveyId || 'NOVO',
                created_at: new Date().toISOString(),
                clients: selectedClient ? {
                    name: selectedClient.name,
                    document: selectedClient.cnpj_cpf,
                    street: selectedClient.street,
                    number: selectedClient.number,
                    city: selectedClient.city,
                    phone: selectedClient.phone
                } : {
                    name: formData.name,
                    document: formData.cnpj_cpf,
                    street: formData.street,
                    number: formData.number,
                    city: formData.city,
                    phone: formData.phone
                },
                items: items.map(item => ({
                    ...item,
                    name: item.equipmentId === 'custom' ? (item.customName || 'Equipamento Customizado') : item.name
                })),
                totals: totals,
                technician: technicianProfile ? {
                    full_name: technicianProfile.full_name,
                    signature_url: technicianProfile.signature_url
                } : null
            };

            await generateLoadSurveyPDF(surveyData);
            toast.success('Relatório gerado com sucesso!');
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            toast.error('Geração cancelada ou erro no processo');
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            {/* Header Premium */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100 dark:shadow-none rotate-3 transition-transform hover:rotate-0 duration-300">
                            <Zap className="text-white -rotate-3 transition-transform group-hover:rotate-0" size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                                Levantamento de Cargas
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="text"
                                    value={surveyTitle}
                                    onChange={(e) => setSurveyTitle(e.target.value)}
                                    className="bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none text-xs font-bold uppercase tracking-widest text-slate-500 w-48"
                                    placeholder="NOME DO LEVANTAMENTO"
                                />
                            </div>
                        </div>
                    </div>
                </div>


                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSaveSurvey}
                        disabled={savingSurvey}
                        className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:-translate-y-1 active:scale-95 shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                        {savingSurvey ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {currentSurveyId ? 'Atualizar' : 'Salvar'}
                    </button>
                    <button
                        onClick={() => setShowSavedModal(true)}
                        className="flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:-translate-y-1 active:scale-95 shadow-lg shadow-slate-100"
                    >
                        <Search size={18} />
                        Histórico
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all hover:-translate-y-1 active:scale-95"
                    >
                        <FileText size={18} />
                        PDF
                    </button>
                    <button
                        onClick={() => {
                            setItems([]);
                            setSelectedClient(null);
                            setCurrentSurveyId(null);
                            setSurveyTitle('Novo Levantamento');
                        }}
                        className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all border border-slate-200 dark:border-slate-700"
                        title="Limpar Área de Trabalho"
                    >
                        <Trash2 size={22} />
                    </button>
                </div>
            </div>

            {/* Identificação do Cliente */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                <div className="flex items-center gap-4 w-full md:w-auto shrink-0">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Engenharia</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Identificação</p>
                    </div>
                </div>

                <div className="flex-1 w-full relative">
                    <button
                        onClick={() => setShowClientList(!showClientList)}
                        className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-transparent hover:border-indigo-100 transition-all font-bold text-slate-700 dark:text-slate-300"
                    >
                        <div className="flex items-center gap-3 text-sm">
                            <User size={18} className="text-slate-400" />
                            <span>{selectedClient ? selectedClient.name : 'Selecionar Cliente Registrado...'}</span>
                        </div>
                        <ChevronDown size={20} className={`transition-transform duration-300 ${showClientList ? 'rotate-180' : ''}`} />
                    </button>

                    {showClientList && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-700 rounded-3xl shadow-2xl z-50 p-3 animate-slideDown">
                            <div className="relative mb-3">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Procurar cliente na rede..."
                                    value={clientSearch}
                                    onChange={(e) => setClientSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none text-sm font-bold border border-transparent focus:border-indigo-200 transition-colors"
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                                {filteredClients.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            setSelectedClient(c);
                                            setShowClientList(false);
                                        }}
                                        className="w-full px-5 py-4 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-between group"
                                    >
                                        <span>{c.name}</span>
                                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                    </button>
                                ))}
                                {filteredClients.length === 0 && <p className="p-6 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">Nenhum cliente na base</p>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="shrink-0 w-full md:w-auto">
                    <button
                        onClick={() => setShowRegisterModal(true)}
                        className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none"
                    >
                        <UserPlus size={18} />
                        Novo Cadastro
                    </button>
                </div>
            </div>

            {/* Resumo Dash Reformulado */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 127V */}
                <div className="group bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-500">
                            <span className="font-black text-xs">127V</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Fase-Neutro</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.breakdown.v127.watts.toLocaleString()} W</p>
                        <p className="text-sm font-bold text-red-500">{totals.breakdown.v127.amps.toFixed(1)} A</p>
                    </div>
                </div>

                {/* 220V */}
                <div className="group bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600">
                            <span className="font-black text-xs">220V</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Fase-Fase</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.breakdown.v220.watts.toLocaleString()} W</p>
                        <p className="text-sm font-bold text-blue-600">{totals.breakdown.v220.amps.toFixed(1)} A</p>
                    </div>
                </div>

                {/* 380V */}
                <div className="group bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-500">
                            <span className="font-black text-xs">380V</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Trifásico</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.breakdown.v380.watts.toLocaleString()} W</p>
                        <p className="text-sm font-bold text-amber-500">{totals.breakdown.v380.amps.toFixed(1)} A</p>
                    </div>
                </div>

                {/* Total Geral */}
                <div className="group bg-indigo-600 p-6 rounded-[2rem] shadow-2xl shadow-indigo-200 dark:shadow-none hover:bg-slate-900 transition-all hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                            <Zap size={20} />
                        </div>
                        <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Potência Total</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-3xl font-black text-white">{totals.watts.toLocaleString()} W</p>
                        <p className="text-sm font-bold text-indigo-200">{totals.kw.toFixed(2)} kW</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Board de Itens */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
                        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/50 backdrop-blur-xl">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Itens do Ponto de Entrega</h2>
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase">{items.length} Componentes</span>
                            </div>
                        </div>

                        {items.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-40 text-center px-10">
                                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-8 rotate-12">
                                    <Zap className="text-slate-200 -rotate-12" size={40} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-300 uppercase tracking-widest mb-2">Workspace Vazio</h3>
                                <p className="text-slate-400 text-sm max-w-sm font-medium">Inicie o levantamento selecionando os equipamentos industriais ou residenciais no catálogo ao lado.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 dark:divide-slate-800 overflow-y-auto max-h-[800px] custom-scrollbar">
                                {items.map((item) => (
                                    <div key={item.id} className="group relative flex flex-col p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all animate-fadeIn">
                                        {/* Top Line: Icon + Name + Delete */}
                                        <div className="flex items-start gap-5 mb-6">
                                            <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-amber-50 group-hover:text-amber-500 transition-all shrink-0">
                                                <Zap size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {item.equipmentId === 'custom' ? (
                                                    <input
                                                        type="text"
                                                        value={item.customName || ''}
                                                        placeholder="NOME DO EQUIPAMENTO..."
                                                        onChange={(e) => updateCustomName(item.id, e.target.value)}
                                                        className="w-full bg-slate-50 dark:bg-slate-800 px-5 py-3 rounded-xl border-2 border-indigo-50 dark:border-indigo-900/30 focus:border-indigo-500 outline-none font-black text-slate-900 dark:text-white uppercase tracking-tight text-lg transition-all"
                                                    />
                                                ) : (
                                                    <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-xl leading-tight pt-2">{item.name}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all shrink-0"
                                                title="Excluir"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>

                                        {/* Controls Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border-t border-slate-50 dark:border-slate-800 pt-6">
                                            {/* Power Input */}
                                            <div className="md:col-span-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Potência (W)</span>
                                                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                        <input
                                                            type="number"
                                                            value={item.power}
                                                            onChange={(e) => updatePower(item.id, Number(e.target.value))}
                                                            className="w-full bg-transparent outline-none text-base font-black text-indigo-600 dark:text-indigo-400"
                                                        />
                                                        <span className="text-xs font-black text-slate-300">W</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Voltage Selector */}
                                            <div className="md:col-span-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tensão (V)</span>
                                                    <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl flex items-center gap-1 border border-slate-100 dark:border-slate-700">
                                                        {[127, 220, 380].map((v) => (
                                                            <button
                                                                key={v}
                                                                onClick={() => updateVoltage(item.id, v as any)}
                                                                className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all ${item.voltage === v
                                                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                                                                    : 'text-slate-400 hover:text-slate-600'}`}
                                                            >
                                                                {v}V
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quantity Control */}
                                            <div className="md:col-span-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</span>
                                                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-slate-400 hover:text-red-500 transition-all active:scale-90 shadow-sm"
                                                        >
                                                            <Minus size={16} />
                                                        </button>
                                                        <span className="font-black text-slate-900 dark:text-white text-lg">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-slate-400 hover:text-indigo-500 transition-all active:scale-90 shadow-sm"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Subtotal */}
                                            <div className="md:col-span-2 text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subtotal</p>
                                                <p className="font-black text-2xl text-slate-900 dark:text-white tracking-tighter leading-none">{item.totalPower.toLocaleString()} W</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Catálogo Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[750px]">
                        <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-white/50 backdrop-blur-sm">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Equipamentos</h2>
                            <div className="relative group/search">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/search:text-indigo-500 transition-all" size={20} />
                                <input
                                    type="text"
                                    placeholder="Procurar na base técnica..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-14 pr-4 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-[1.5rem] outline-none text-sm font-bold tracking-tight transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {filteredEquipments.map((equip) => (
                                <button
                                    key={equip.id}
                                    onClick={() => addItem(equip)}
                                    className="w-full p-5 flex items-center gap-5 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-800 rounded-3xl border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 hover:shadow-xl transition-all text-left group"
                                >
                                    <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all shadow-sm shrink-0">
                                        <Zap size={22} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter text-sm truncate">{equip.name}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[9px] font-black text-slate-400 uppercase tracking-widest">{equip.defaultPower}W</span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{equip.category}</span>
                                        </div>
                                    </div>
                                    <Plus size={18} className="text-slate-200 group-hover:text-indigo-400 transition-all opacity-0 group-hover:opacity-100" />
                                </button>
                            ))}
                        </div>

                        <div className="p-8 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-50 dark:border-slate-800">
                            <button
                                onClick={() => {
                                    const custom = COMMON_EQUIPMENTS.find(e => e.id === 'custom');
                                    if (custom) addItem(custom);
                                }}
                                className="w-full py-5 bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 hover:-translate-y-1 active:scale-95"
                            >
                                <Plus size={20} />
                                Adicionar Customizado
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Histórico Salvados */}
            {showSavedModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg animate-fadeIn" onClick={() => setShowSavedModal(false)} />
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl z-10 overflow-hidden animate-zoomIn border border-slate-200 dark:border-slate-800">
                        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Levantamentos Salvos</h2>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Histórico de Engenharia</p>
                            </div>
                            <button onClick={() => setShowSavedModal(false)} className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3">
                            {savedSurveys.length === 0 && (
                                <div className="text-center py-20 grayscale opacity-30">
                                    <FileText size={48} className="mx-auto mb-4" />
                                    <p className="font-black uppercase tracking-widest text-xs">Nenhum registro encontrado</p>
                                </div>
                            )}
                            {savedSurveys.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => loadSurvey(s)}
                                    className="w-full p-6 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-[2rem] border border-transparent hover:border-indigo-100 transition-all text-left flex items-center justify-between group"
                                >
                                    <div>
                                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{s.title}</p>
                                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase">Cliente: {s.clients?.name || '---'}</p>
                                        <p className="text-[10px] text-slate-300 font-black mt-1 uppercase">{format(new Date(s.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-indigo-600">{s.total_watts.toLocaleString()} W</p>
                                        <ChevronRight size={18} className="ml-auto mt-2 text-slate-300 group-hover:text-indigo-500 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Cadastro Completo */}

            {showRegisterModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg animate-fadeIn" onClick={() => setShowRegisterModal(false)} />
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl z-10 overflow-hidden animate-zoomIn border border-slate-200 dark:border-slate-800">
                        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Cadastro de Cliente</h1>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Engenharia e Manutenção</p>
                            </div>
                            <button onClick={() => setShowRegisterModal(false)} className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-8">
                            {/* Tipo Jurídico / Físico */}
                            <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-2">
                                <button
                                    onClick={() => setFormData({ ...formData, type: 'PJ' })}
                                    className={`flex-1 py-4 rounded-[1.25rem] font-black text-[11px] uppercase tracking-widest transition-all ${formData.type === 'PJ' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    🏢 Pessoa Jurídica
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, type: 'PF' })}
                                    className={`flex-1 py-4 rounded-[1.25rem] font-black text-[11px] uppercase tracking-widest transition-all ${formData.type === 'PF' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    👤 Pessoa Física
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento Principal</label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            placeholder={formData.type === 'PJ' ? "00.000.000/0000-00" : "000.000.000-00"}
                                            value={formData.cnpj_cpf}
                                            onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                                            onBlur={handleCnpjBlur}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all pr-12"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            {cnpjLoading ? <Loader2 className="animate-spin text-indigo-600" size={18} /> : <Search className="text-slate-300" size={18} />}
                                        </div>
                                    </div>
                                    {formData.type === 'PJ' && <p className="text-[9px] font-bold text-indigo-400 ml-1 uppercase">Sair do campo para buscar na Receita</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{formData.type === 'PJ' ? "Inscrição Estadual" : "RG"}</label>
                                    <input
                                        type="text"
                                        value={formData.ie_rg}
                                        onChange={(e) => setFormData({ ...formData, ie_rg: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all"
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{formData.type === 'PJ' ? "Razão Social / Nome Fantasia" : "Nome Completo"}</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail de Contato</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone Principal</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-8 space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                    <MapPin size={18} className="text-indigo-500" />
                                    Endereço de Atendimento
                                </h3>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CEP</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={formData.zip_code}
                                                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                                                onBlur={handleCepBlur}
                                                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all pr-12"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                {cepLoading ? <Loader2 className="animate-spin text-indigo-600" size={16} /> : <Search className="text-slate-300" size={16} />}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logradouro</label>
                                        <input
                                            type="text"
                                            value={formData.street}
                                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número</label>
                                        <input
                                            type="text"
                                            value={formData.number}
                                            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado (UF)</label>
                                        <input
                                            type="text"
                                            value={formData.state}
                                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cidade</label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all"
                                        />
                                    </div>
                                    <div className="col-span-1 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                                        <input
                                            type="text"
                                            value={formData.neighborhood}
                                            onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none text-sm font-bold transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 sticky bottom-0 z-10">
                            <button
                                onClick={handleSaveClient}
                                disabled={savingClient}
                                className="w-full py-6 bg-indigo-600 hover:bg-slate-900 text-white rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                            >
                                {savingClient ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                {savingClient ? "Processando Cadastro..." : "Salvar e Iniciar Levantamento"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

