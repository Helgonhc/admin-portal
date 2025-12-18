'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { 
  Save, Loader2, User, Building2, Bell, Shield, Palette, 
  Mail, Phone, MapPin, Camera, Key, Check, Plus, Trash2, List, Upload, Image, Search
} from 'lucide-react';
import toast from 'react-hot-toast';

// Função para buscar CNPJ na BrasilAPI
async function fetchCNPJ(cnpj: string) {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length !== 14) return null;
  
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const { profile, setProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'notifications' | 'checklists'>('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchingCNPJ, setSearchingCNPJ] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    cargo: '',
  });

  // Company
  const [companyData, setCompanyData] = useState({
    company_name: '',
    company_cnpj: '',
    company_phone: '',
    company_email: '',
    company_address: '',
    company_logo: '',
  });

  // Notifications
  const [notificationSettings, setNotificationSettings] = useState({
    email_new_order: true,
    email_order_completed: true,
    email_new_ticket: true,
    push_enabled: true,
  });

  // Checklists
  const [checklists, setChecklists] = useState<any[]>([]);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<any>(null);
  const [checklistForm, setChecklistForm] = useState({
    name: '',
    description: '',
    items: [''],
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        cpf: profile.cpf || '',
        cargo: profile.cargo || '',
      });
    }
    loadCompanySettings();
    loadChecklists();
  }, [profile]);

  async function loadCompanySettings() {
    const { data } = await supabase
      .from('app_config')
      .select('*')
      .single();
    
    if (data) {
      setCompanyData({
        company_name: data.company_name || '',
        company_cnpj: data.company_cnpj || '',
        company_phone: data.company_phone || '',
        company_email: data.company_email || '',
        company_address: data.company_address || '',
        company_logo: data.company_logo || '',
      });
    }
  }

  async function loadChecklists() {
    const { data } = await supabase
      .from('checklist_models')
      .select('*, checklist_model_items(id, item_description)')
      .order('name');
    setChecklists(data || []);
  }

  // Busca automática de CNPJ
  async function handleCNPJSearch() {
    const cnpj = companyData.company_cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      toast.error('Digite um CNPJ válido com 14 dígitos');
      return;
    }

    setSearchingCNPJ(true);
    try {
      const data = await fetchCNPJ(cnpj);
      if (data) {
        setCompanyData({
          ...companyData,
          company_name: data.razao_social || data.nome_fantasia || companyData.company_name,
          company_phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}` : companyData.company_phone,
          company_email: data.email || companyData.company_email,
          company_address: data.logradouro 
            ? `${data.logradouro}, ${data.numero}${data.complemento ? ' - ' + data.complemento : ''} - ${data.bairro}, ${data.municipio}/${data.uf} - CEP: ${data.cep}`
            : companyData.company_address,
        });
        toast.success('Dados do CNPJ carregados!');
      } else {
        toast.error('CNPJ não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao buscar CNPJ');
    } finally {
      setSearchingCNPJ(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          cpf: profileData.cpf,
          cargo: profileData.cargo,
        })
        .eq('id', profile?.id);

      if (error) throw error;
      
      setProfile({ ...profile!, ...profileData });
      toast.success('Perfil atualizado!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveCompany() {
    setSaving(true);
    try {
      // Primeiro, verificar se já existe um registro
      const { data: existing } = await supabase
        .from('app_config')
        .select('id')
        .limit(1)
        .single();

      if (existing) {
        // Atualizar registro existente
        const { error } = await supabase
          .from('app_config')
          .update(companyData)
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('app_config')
          .insert(companyData);
        
        if (error) throw error;
      }

      toast.success('Configurações da empresa salvas!');
      
      // Recarregar a página para atualizar o sidebar
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Upload de logo da empresa
  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `company-logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('os-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('os-photos')
        .getPublicUrl(filePath);

      setCompanyData({ ...companyData, company_logo: publicUrl });
      toast.success('Logo enviada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  }

  function openChecklistModal(checklist?: any) {
    if (checklist) {
      setEditingChecklist(checklist);
      setChecklistForm({
        name: checklist.name,
        description: checklist.description || '',
        items: checklist.checklist_model_items?.map((i: any) => i.item_description) || [''],
      });
    } else {
      setEditingChecklist(null);
      setChecklistForm({ name: '', description: '', items: [''] });
    }
    setShowChecklistModal(true);
  }

  function addChecklistItem() {
    setChecklistForm({ ...checklistForm, items: [...checklistForm.items, ''] });
  }

  function removeChecklistItem(index: number) {
    setChecklistForm({
      ...checklistForm,
      items: checklistForm.items.filter((_, i) => i !== index),
    });
  }

  function updateChecklistItem(index: number, value: string) {
    const newItems = [...checklistForm.items];
    newItems[index] = value;
    setChecklistForm({ ...checklistForm, items: newItems });
  }

  async function saveChecklist() {
    if (!checklistForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const validItems = checklistForm.items.filter(i => i.trim());
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    setSaving(true);
    try {
      if (editingChecklist) {
        await supabase
          .from('checklist_models')
          .update({ name: checklistForm.name, description: checklistForm.description })
          .eq('id', editingChecklist.id);

        await supabase
          .from('checklist_model_items')
          .delete()
          .eq('model_id', editingChecklist.id);

        await supabase
          .from('checklist_model_items')
          .insert(validItems.map(item => ({
            model_id: editingChecklist.id,
            item_description: item,
          })));

        toast.success('Checklist atualizado!');
      } else {
        const { data: newModel, error } = await supabase
          .from('checklist_models')
          .insert([{ name: checklistForm.name, description: checklistForm.description }])
          .select()
          .single();

        if (error) throw error;

        await supabase
          .from('checklist_model_items')
          .insert(validItems.map(item => ({
            model_id: newModel.id,
            item_description: item,
          })));

        toast.success('Checklist criado!');
      }

      setShowChecklistModal(false);
      loadChecklists();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteChecklist(id: string) {
    if (!confirm('Excluir este modelo de checklist?')) return;

    try {
      await supabase.from('checklist_model_items').delete().eq('model_id', id);
      await supabase.from('checklist_models').delete().eq('id', id);
      toast.success('Checklist excluído!');
      loadChecklists();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500">Gerencie seu perfil e preferências</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'profile', icon: User, label: 'Meu Perfil' },
          { id: 'company', icon: Building2, label: 'Empresa', adminOnly: true },
          { id: 'checklists', icon: List, label: 'Checklists', adminOnly: true },
        ].filter(tab => !tab.adminOnly || isAdmin).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
              activeTab === tab.id ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <tab.icon size={18} />
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">👤 Informações Pessoais</h3>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nome Completo</label>
                <input
                  type="text"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="input bg-gray-50"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Telefone</label>
                <input
                  type="text"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="input"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="label">CPF</label>
                <input
                  type="text"
                  value={profileData.cpf}
                  onChange={(e) => setProfileData({ ...profileData, cpf: e.target.value })}
                  className="input"
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
            <div>
              <label className="label">Cargo</label>
              <input
                type="text"
                value={profileData.cargo}
                onChange={(e) => setProfileData({ ...profileData, cargo: e.target.value })}
                className="input"
                placeholder="Seu cargo na empresa"
              />
            </div>
            <button onClick={saveProfile} disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Perfil
            </button>
          </div>
        </div>
      )}

      {/* Company Tab */}
      {activeTab === 'company' && isAdmin && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">🏢 Dados da Empresa</h3>
          <div className="space-y-4">
            {/* Upload de Logo */}
            <div>
              <label className="label">Logo da Empresa</label>
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden bg-gray-50">
                  {companyData.company_logo ? (
                    <img 
                      src={companyData.company_logo} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Image className="text-gray-400" size={32} />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn btn-secondary mb-2"
                  >
                    {uploading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Upload size={18} />
                    )}
                    {uploading ? 'Enviando...' : 'Fazer Upload'}
                  </button>
                  <p className="text-xs text-gray-500">
                    PNG, JPG ou GIF. Máximo 2MB.<br/>
                    A logo aparecerá no menu lateral do portal.
                  </p>
                  {companyData.company_logo && (
                    <button
                      onClick={() => setCompanyData({ ...companyData, company_logo: '' })}
                      className="text-xs text-red-600 hover:underline mt-1"
                    >
                      Remover logo
                    </button>
                  )}
                </div>
              </div>
              {/* Campo de URL manual */}
              <div className="mt-3">
                <label className="text-xs text-gray-500">Ou cole a URL da imagem:</label>
                <input
                  type="text"
                  value={companyData.company_logo}
                  onChange={(e) => setCompanyData({ ...companyData, company_logo: e.target.value })}
                  className="input mt-1"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">CNPJ</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={companyData.company_cnpj}
                    onChange={(e) => setCompanyData({ ...companyData, company_cnpj: e.target.value })}
                    className="input flex-1"
                    placeholder="00.000.000/0000-00"
                  />
                  <button
                    onClick={handleCNPJSearch}
                    disabled={searchingCNPJ}
                    className="btn btn-secondary whitespace-nowrap"
                    title="Buscar dados do CNPJ"
                  >
                    {searchingCNPJ ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Search size={18} />
                    )}
                    Buscar
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Digite o CNPJ e clique em Buscar para preencher automaticamente</p>
              </div>
              <div>
                <label className="label">Nome da Empresa</label>
                <input
                  type="text"
                  value={companyData.company_name}
                  onChange={(e) => setCompanyData({ ...companyData, company_name: e.target.value })}
                  className="input"
                  placeholder="Nome que aparecerá no menu lateral"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Telefone</label>
                <input
                  type="text"
                  value={companyData.company_phone}
                  onChange={(e) => setCompanyData({ ...companyData, company_phone: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input
                  type="email"
                  value={companyData.company_email}
                  onChange={(e) => setCompanyData({ ...companyData, company_email: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">Endereço</label>
              <input
                type="text"
                value={companyData.company_address}
                onChange={(e) => setCompanyData({ ...companyData, company_address: e.target.value })}
                className="input"
              />
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="text-sm text-indigo-800">
                💡 O nome e logo da empresa aparecerão no menu lateral do portal, substituindo "Portal Admin".
              </p>
            </div>
            <button onClick={saveCompany} disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Configurações
            </button>
          </div>
        </div>
      )}

      {/* Checklists Tab */}
      {activeTab === 'checklists' && isAdmin && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">📋 Modelos de Checklist</h3>
            <button onClick={() => openChecklistModal()} className="btn btn-primary">
              <Plus size={18} /> Novo Checklist
            </button>
          </div>

          {checklists.length === 0 ? (
            <div className="card text-center py-8 text-gray-500">
              <List size={48} className="mx-auto mb-2 opacity-50" />
              <p>Nenhum modelo de checklist cadastrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checklists.map((checklist) => (
                <div key={checklist.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-800">{checklist.name}</h4>
                      {checklist.description && (
                        <p className="text-sm text-gray-500">{checklist.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {checklist.checklist_model_items?.length || 0} itens
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openChecklistModal(checklist)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                      >
                        <User size={18} />
                      </button>
                      <button
                        onClick={() => deleteChecklist(checklist.id)}
                        className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  {checklist.checklist_model_items?.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <ul className="text-sm text-gray-600 space-y-1">
                        {checklist.checklist_model_items.slice(0, 5).map((item: any) => (
                          <li key={item.id} className="flex items-center gap-2">
                            <Check size={14} className="text-emerald-500" />
                            {item.item_description}
                          </li>
                        ))}
                        {checklist.checklist_model_items.length > 5 && (
                          <li className="text-gray-400">
                            +{checklist.checklist_model_items.length - 5} mais...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Checklist Modal */}
      {showChecklistModal && (
        <div className="modal-overlay" onClick={() => setShowChecklistModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editingChecklist ? 'Editar Checklist' : 'Novo Checklist'}
              </h2>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="label">Nome *</label>
                <input
                  type="text"
                  value={checklistForm.name}
                  onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Checklist de Manutenção Preventiva"
                />
              </div>
              <div>
                <label className="label">Descrição</label>
                <input
                  type="text"
                  value={checklistForm.description}
                  onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
                  className="input"
                  placeholder="Descrição opcional"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Itens do Checklist</label>
                  <button onClick={addChecklistItem} className="text-sm text-indigo-600 hover:underline">
                    + Adicionar item
                  </button>
                </div>
                <div className="space-y-2">
                  {checklistForm.items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateChecklistItem(index, e.target.value)}
                        className="input flex-1"
                        placeholder={`Item ${index + 1}`}
                      />
                      {checklistForm.items.length > 1 && (
                        <button
                          onClick={() => removeChecklistItem(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowChecklistModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={saveChecklist} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
