'use client';

import { useState, useEffect } from 'react';
import { supabase, Quote } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import {
  Plus, Search, Eye, Loader2, Calculator, Send, Check, X,
  FileText, User, MapPin, Phone, Mail, FileEdit, Trash2,
  CheckCircle, XCircle, AlertCircle, Clock, Save, ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

export default function QuotesPage() {
  const { can, isAdmin } = usePermissions();
  const { profile } = useAuthStore();

  // Permissions
  const canViewFinancials = can('can_view_financials');
  const canCreateQuotes = can('can_create_quotes') || canViewFinancials;

  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'values' | 'terms'>('info');

  // Enterprise Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  // Form Data - Matching Mobile App Structure
  const [formData, setFormData] = useState({
    client_id: '',
    use_manual_client: false,
    manual_client_name: '',
    manual_client_email: '',
    manual_client_phone: '',
    manual_client_address: '',

    title: '',
    description: '',
    validity_days: '30',

    items: [] as any[],

    discount: '0',
    discount_type: 'fixed' as 'fixed' | 'percentage',
    tax: '0',

    notes: '',
    terms: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [quotesRes, clientsRes, configRes] = await Promise.all([
        supabase
          .from('quotes')
          .select(`
                        *,
                        clients (name, email, phone),
                        profiles!quotes_created_by_fkey (full_name, signature_url)
                    `)
          .order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
        supabase.from('app_config').select('quote_terms').single()
      ]);

      if (quotesRes.error) throw quotesRes.error;
      setQuotes(quotesRes.data || []);
      setClients(clientsRes.data || []);

      // Set default terms if empty
      if (configRes.data?.quote_terms) {
        setFormData(prev => ({ ...prev, terms: configRes.data.quote_terms }));
      } else {
        setFormData(prev => ({
          ...prev,
          terms: 'Orçamento válido por 30 dias.\nPagamento: 50% antecipado, 50% na conclusão.\nGarantia de 90 dias para serviços realizados.'
        }));
      }

    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  // --- Calculations (Parity with Mobile) ---
  function calculateSubtotal() {
    return formData.items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
  }

  function calculateTotal() {
    const subtotal = calculateSubtotal();
    const discountVal = parseFloat(formData.discount) || 0;
    const discountValue = formData.discount_type === 'percentage'
      ? subtotal * (discountVal / 100)
      : discountVal;

    const taxValue = parseFloat(formData.tax) || 0;
    return subtotal - discountValue + taxValue;
  }

  // --- Form Handlers ---
  function addItem() {
    setFormData({
      ...formData,
      items: [...formData.items, {
        id: Date.now(),
        item_type: 'service',
        name: '',
        description: '',
        quantity: 1,
        unit_price: 0
      }],
    });
  }

  function removeItem(index: number) {
    if (formData.items.length <= 1) {
      toast.error('O orçamento precisa de pelo menos 1 item');
      return;
    }
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  }

  function updateItem(index: number, field: string, value: any) {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  }

  async function handleCreate() {
    // Validations
    if (!formData.use_manual_client && !formData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }
    if (formData.use_manual_client && !formData.manual_client_name.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Informe o título');
      return;
    }

    const invalidItems = formData.items.filter(i => !i.name.trim() || i.unit_price < 0);
    if (invalidItems.length > 0) {
      toast.error('Verifique os itens (Nome obrigatório, valor positivo)');
      return;
    }

    setSaving(true);
    try {
      let finalClientId = formData.client_id;

      // 1. Create Temporary Client if Manual
      if (formData.use_manual_client) {
        const { data: tempClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: formData.manual_client_name.trim(),
            email: formData.manual_client_email.trim() || null,
            phone: formData.manual_client_phone.trim() || null,
            address: formData.manual_client_address.trim() || null,
            is_temporary: true,
            is_active: true
          })
          .select()
          .single();

        if (clientError) throw clientError;
        finalClientId = tempClient.id;

        // Refresh clients list to include new temporary client
        const { data: updatedClients } = await supabase.from('clients').select('id, name').eq('is_active', true).order('name');
        if (updatedClients) setClients(updatedClients);
      }

      // 2. Calculate Dates
      const days = parseInt(formData.validity_days) || 30;
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + days);

      // 3. Create Quote
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          client_id: finalClientId,
          created_by: profile?.id,
          title: formData.title.trim(),
          description: formData.description.trim(),
          valid_until: validUntilDate.toISOString().split('T')[0],

          discount: parseFloat(formData.discount) || 0,
          discount_type: formData.discount_type,
          tax: parseFloat(formData.tax) || 0,

          notes: formData.notes.trim(),
          terms: formData.terms.trim(),

          status: 'pending', // Default mobile status

          subtotal: calculateSubtotal(),
          total: calculateTotal()
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // 4. Create Items
      const itemsToInsert = formData.items.map((item, index) => ({
        quote_id: quote.id,
        item_type: item.item_type,
        name: item.name.trim(),
        description: item.description?.trim(),
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
        sort_order: index
      }));

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success('Orçamento criado com sucesso!');
      setShowModal(false);
      resetForm();
      loadData();

    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao criar: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setFormData({
      client_id: '',
      use_manual_client: false,
      manual_client_name: '',
      manual_client_email: '',
      manual_client_phone: '',
      manual_client_address: '',
      title: '',
      description: '',
      validity_days: '30',
      items: [{ id: Date.now(), item_type: 'service', name: '', description: '', quantity: 1, unit_price: 0 }],
      discount: '0',
      discount_type: 'fixed',
      tax: '0',
      notes: '',
      terms: formData.terms // Keep default terms
    });
    setActiveTab('info');
  }

  // --- UI Helpers ---
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'expired': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'converted': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      approved: 'Aprovado',
      rejected: 'Rejeitado',
      expired: 'Expirado',
      converted: 'Convertido',
      draft: 'Rascunho', // Legacy support
      sent: 'Enviado' // Legacy support
    };
    return labels[status] || status;
  };

  const filteredQuotes = quotes.filter(quote => {
    const quoteDate = new Date(quote.created_at);
    const matchesMonth = selectedMonth === 'all' || quoteDate.getMonth().toString() === selectedMonth;
    const matchesYear = selectedYear === 'all' || quoteDate.getFullYear().toString() === selectedYear;

    const matchesSearch = quote.title.toLowerCase().includes(search.toLowerCase()) ||
      quote.clients?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;

    return matchesSearch && matchesStatus && matchesMonth && matchesYear;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Orçamentos</h1>
          <p className="text-gray-500">{quotes.length} orçamentos registrados</p>
        </div>
        {canCreateQuotes && (
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="btn btn-primary"
          >
            <Plus size={20} />
            Novo Orçamento
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input
            type="text"
            placeholder="Buscar por título, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-with-icon"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input w-full sm:w-36"
          >
            <option value="all">Todos os Meses</option>
            {months.map((m, i) => (
              <option key={i} value={i.toString()}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="input w-full sm:w-28"
          >
            <option value="all">Todos os Anos</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="px-3 py-2 rounded-lg text-xs font-bold uppercase bg-gray-100 text-gray-400 hover:bg-gray-200"
            >
              Limpar Status
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {['all', 'pending', 'approved', 'rejected', 'converted'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-2 rounded-lg text-[11px] uppercase font-bold whitespace-nowrap transition-colors border ${statusFilter === st
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
            >
              {st === 'all' ? 'Ver Todos' : getStatusLabel(st)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid gap-4">
        {filteredQuotes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum orçamento encontrado</h3>
            <p className="text-gray-500 mt-1">Tente mudar os filtros ou crie um novo.</p>
          </div>
        ) : (
          filteredQuotes.map((quote) => (
            <div key={quote.id} className="group bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                {/* Left Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      #{quote.quote_number || '---'}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStatusStyle(quote.status)}`}>
                      {getStatusLabel(quote.status)}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(quote.created_at).toLocaleDateString('pt-BR').replace(/\//g, '-')}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 truncate group-hover:text-indigo-600 transition-colors">
                    {quote.title}
                  </h3>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
                    <div className="flex items-center gap-1.5">
                      <User size={14} className="text-gray-400" />
                      <span className="truncate max-w-[200px]">{quote.clients?.name || 'Cliente Removido'}</span>
                    </div>
                    {quote.profiles?.full_name && (
                      <div className="flex items-center gap-1.5">
                        <FileEdit size={14} className="text-gray-400" />
                        <span className="truncate">Por: {quote.profiles.full_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Stats & Actions */}
                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0">
                  <div className="text-right">
                    <p className="text-xs text-gray-400 font-medium uppercase">Valor Total</p>
                    <p className="text-xl font-bold text-gray-900">
                      {canViewFinancials ? `R$ ${quote.total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ---'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/quotes/${quote.id}`}
                      className="p-2 bg-gray-50 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 rounded-lg transition-colors"
                      title="Ver Detalhes"
                    >
                      <Eye size={20} />
                    </Link>
                    <button
                      onClick={async () => {
                        const { generateQuotePDF } = await import('../../../utils/pdfGenerator');
                        generateQuotePDF(quote);
                      }}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                      title="Gerar PDF"
                    >
                      <FileText size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Novo Orçamento</h2>
                <p className="text-sm text-gray-500">Preencha os dados do serviço</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {[
                { id: 'info', label: 'Informações', icon: FileText },
                { id: 'items', label: 'Itens', icon: Calculator },
                { id: 'values', label: 'Valores', icon: CheckCircle },
                { id: 'terms', label: 'Termos', icon: FileEdit },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Tab: Info */}
              <div className={activeTab === 'info' ? 'space-y-6' : 'hidden'}>
                {/* Client Section */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <User size={16} className="text-indigo-600" />
                      Cliente
                    </label>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, use_manual_client: !prev.use_manual_client }))}
                      className="text-xs font-semibold text-indigo-600 hover:underline bg-indigo-50 px-2 py-1 rounded"
                    >
                      {formData.use_manual_client ? '🔄 Selecionar da Lista' : '✏️ Digitar Manualmente'}
                    </button>
                  </div>

                  {!formData.use_manual_client ? (
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="">Selecione um cliente...</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-3 animate-fadeIn">
                      <input
                        type="text"
                        placeholder="Nome Completo / Razão Social *"
                        value={formData.manual_client_name}
                        onChange={(e) => setFormData({ ...formData, manual_client_name: e.target.value })}
                        className="input"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="email"
                          placeholder="Email"
                          value={formData.manual_client_email}
                          onChange={(e) => setFormData({ ...formData, manual_client_email: e.target.value })}
                          className="input"
                        />
                        <input
                          type="tel"
                          placeholder="Telefone / WhatsApp"
                          value={formData.manual_client_phone}
                          onChange={(e) => setFormData({ ...formData, manual_client_phone: e.target.value })}
                          className="input"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Endereço Completo"
                        value={formData.manual_client_address}
                        onChange={(e) => setFormData({ ...formData, manual_client_address: e.target.value })}
                        className="input"
                      />
                    </div>
                  )}
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="label">Título do Orçamento *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input"
                      placeholder="Ex: Instalação de Ar Condicionado"
                    />
                  </div>
                  <div>
                    <label className="label">Descrição Geral</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input min-h-[100px]"
                      placeholder="Detalhes sobre o serviço..."
                    />
                  </div>
                  <div className="w-full md:w-1/3">
                    <label className="label">Validade (dias) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.validity_days}
                        onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
                        className="input pl-10"
                      />
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab: Items */}
              <div className={activeTab === 'items' ? 'space-y-4' : 'hidden'}>
                {formData.items.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative group">
                    <div className="absolute right-2 top-2">
                      <button
                        onClick={() => removeItem(index)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Tipo</label>
                        <select
                          value={item.item_type}
                          onChange={(e) => updateItem(index, 'item_type', e.target.value)}
                          className="input text-sm py-1.5"
                        >
                          <option value="service">Serviço</option>
                          <option value="material">Material</option>
                          <option value="labor">Mão de Obra</option>
                        </select>
                      </div>
                      <div className="md:col-span-9">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome do Item *</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          className="input text-sm py-1.5"
                          placeholder="Ex: Cabo de Rede 5m"
                        />
                      </div>
                      <div className="md:col-span-12">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="input text-sm py-1.5 text-gray-500"
                          placeholder="Descrição opcional..."
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Qtd</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          className="input text-sm py-1.5"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Valor Unit.</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">R$</span>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                            className="input text-sm py-1.5 pl-6"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">Total</label>
                        <div className="input text-sm py-1.5 bg-gray-100 text-gray-700 font-bold text-right">
                          R$ {((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addItem}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-gray-50 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Adicionar Item
                </button>
              </div>

              {/* Tab: Values */}
              <div className={activeTab === 'values' ? 'space-y-6' : 'hidden'}>
                {canViewFinancials ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-gray-200">
                        <label className="label">Desconto</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={formData.discount}
                            onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                            className="input flex-1"
                          />
                          <select
                            value={formData.discount_type}
                            onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                            className="input w-32"
                          >
                            <option value="fixed">R$</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border border-gray-200">
                        <label className="label">Taxas / Impostos</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                          <input
                            type="number"
                            value={formData.tax}
                            onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                            className="input pl-8"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900 text-white p-6 rounded-2xl space-y-3">
                      <div className="flex justify-between text-gray-400 text-sm">
                        <span>Subtotal</span>
                        <span>R$ {calculateSubtotal().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400 text-sm">
                        <span>Desconto</span>
                        <span className="text-red-400">
                          - R$ {
                            formData.discount_type === 'percentage'
                              ? (calculateSubtotal() * (Number(formData.discount) / 100)).toFixed(2)
                              : Number(formData.discount).toFixed(2)
                          }
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-400 text-sm">
                        <span>Taxas</span>
                        <span>+ R$ {Number(formData.tax).toFixed(2)}</span>
                      </div>
                      <div className="h-px bg-gray-700 my-2"></div>
                      <div className="flex justify-between text-xl font-bold">
                        <span>TOTAL</span>
                        <span className="text-emerald-400">R$ {calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Você não tem permissão para visualizar/editar valores financeiros.</p>
                  </div>
                )}
              </div>

              {/* Tab: Terms */}
              <div className={activeTab === 'terms' ? 'space-y-4' : 'hidden'}>
                <div>
                  <label className="label">Observações Internas / Adicionais</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input min-h-[100px]"
                    placeholder="Ex: Acesso difícil, necessário escada grande..."
                  />
                </div>
                <div>
                  <label className="label">Termos e Condições</label>
                  <textarea
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="input min-h-[200px] font-mono text-sm"
                    placeholder="Termos de pagamento, validade, garantia..."
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    * Este texto aparecerá no PDF do orçamento.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="btn btn-primary min-w-[150px]"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {saving ? 'Salvando...' : 'Criar Orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
