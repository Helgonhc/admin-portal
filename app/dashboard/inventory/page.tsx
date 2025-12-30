'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Edit, Trash2, Loader2, Package, ArrowUp, ArrowDown, AlertCircle, TrendingUp, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  quantity: number;
  min_quantity: number;
  unit_price: number;
  location?: string;
  created_at: string;
}

export default function InventoryPage() {
  const { can } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    quantity: 0,
    min_quantity: 5,
    unit_price: 0,
    location: '',
  });
  const [movementData, setMovementData] = useState({
    type: 'in',
    quantity: 1,
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      // Tentar carregar de 'products' primeiro, depois 'inventory_items'
      let { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) {
        // Se não existir 'products', tentar 'inventory_items'
        const result = await supabase
          .from('inventory_items')
          .select('*')
          .order('name');

        if (result.error) throw result.error;

        // Mapear campos de inventory_items para o formato esperado
        data = (result.data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          description: item.description,
          category: item.category,
          quantity: item.quantity || item.current_stock || 0,
          min_quantity: item.min_quantity || item.min_stock || 5,
          unit_price: item.unit_price || item.sale_price || 0,
          location: item.location,
          created_at: item.created_at,
        }));
      } else {
        // Mapear campos de products para o formato esperado
        data = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          sku: item.code,
          description: item.description,
          category: item.category_id,
          quantity: item.current_stock || 0,
          min_quantity: item.min_stock || 5,
          unit_price: item.sale_price || 0,
          location: item.location,
          created_at: item.created_at,
        }));
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar estoque');
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.sku?.toLowerCase().includes(search.toLowerCase()) ||
    product.category?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = products.filter(p => p.quantity <= p.min_quantity).length;
  const totalValue = products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);

  function openModal(product?: Product) {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku || '',
        description: product.description || '',
        category: product.category || '',
        quantity: product.quantity,
        min_quantity: product.min_quantity,
        unit_price: product.unit_price,
        location: product.location || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        description: '',
        category: '',
        quantity: 0,
        min_quantity: 5,
        unit_price: 0,
        location: '',
      });
    }
    setShowModal(true);
  }

  function openMovementModal(product: Product) {
    setSelectedProduct(product);
    setMovementData({ type: 'in', quantity: 1, reason: '' });
    setShowMovementModal(true);
  }

  async function handleSave() {
    if (!formData.name) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      // Mapear para o formato da tabela products
      const productData = {
        code: formData.sku || `PROD-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        current_stock: formData.quantity,
        min_stock: formData.min_quantity,
        sale_price: formData.unit_price,
        location: formData.location,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Produto atualizado!');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);
        if (error) throw error;
        toast.success('Produto criado!');
      }
      setShowModal(false);
      loadProducts();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMovement() {
    if (!selectedProduct || movementData.quantity <= 0) {
      toast.error('Quantidade inválida');
      return;
    }

    const newQuantity = movementData.type === 'in'
      ? selectedProduct.quantity + movementData.quantity
      : selectedProduct.quantity - movementData.quantity;

    if (newQuantity < 0) {
      toast.error('Estoque insuficiente');
      return;
    }

    setSaving(true);
    try {
      // Atualizar quantidade na tabela products
      const { error: updateError } = await supabase
        .from('products')
        .update({ current_stock: newQuantity })
        .eq('id', selectedProduct.id);
      if (updateError) throw updateError;

      // Registrar movimentação
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
          product_id: selectedProduct.id,
          type: movementData.type === 'in' ? 'entrada' : 'saida',
          quantity: movementData.quantity,
          previous_stock: selectedProduct.quantity,
          new_stock: newQuantity,
          reason: movementData.reason || (movementData.type === 'in' ? 'Entrada manual' : 'Saída manual'),
        }]);
      if (movementError) console.error('Erro ao registrar movimentação:', movementError);

      toast.success(`${movementData.type === 'in' ? 'Entrada' : 'Saída'} registrada!`);
      setShowMovementModal(false);
      loadProducts();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Excluir produto "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);
      if (error) throw error;
      toast.success('Produto excluído!');
      loadProducts();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Verificar permissão de acesso à página
  if (!can('can_manage_inventory')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-600">Acesso Restrito</h2>
        <p className="text-gray-500 mt-2">Você não tem permissão para acessar o estoque.</p>
        <p className="text-sm text-gray-400 mt-1">Entre em contato com um administrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Package size={24} className="text-indigo-600" /> Gestão de Inventário
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Controle total de peças, serviços e níveis de estoque</p>
        </div>
        <div className="flex gap-2">
          {can('can_manage_inventory') && (
            <button onClick={() => openModal()} className="btn btn-primary shadow-indigo-200 dark:shadow-none">
              <Plus size={20} />
              Novo Item
            </button>
          )}
        </div>
      </div>

      {/* Stock Summary Dashboard (BI Magnata) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="card dark:bg-gray-900 border-none shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight">Total de Itens</p>
            <p className="text-2xl font-black dark:text-gray-100">{products.length}</p>
          </div>
        </div>
        <div className={`card dark:bg-gray-900 border-none shadow-sm p-4 flex items-center gap-4 ${products.some(p => p.quantity <= p.min_quantity) ? 'border-l-4 border-red-500' : ''}`}>
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center text-red-600">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight">Estoque Crítico</p>
            <p className="text-2xl font-black text-red-600">{products.filter(p => p.quantity <= p.min_quantity).length}</p>
          </div>
        </div>
        <div className="card dark:bg-gray-900 border-none shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight">Valor Patrimonial</p>
            <p className="text-2xl font-black dark:text-gray-100">R$ {products.reduce((acc, p) => acc + (p.quantity * p.unit_price), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="card dark:bg-gray-900 border-none shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600">
            <Filter size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight">Categorias</p>
            <p className="text-2xl font-black dark:text-gray-100">{new Set(products.map(p => p.category)).size}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 shrink-0 bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, SKU ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-with-icon dark:bg-gray-800 dark:border-gray-700 w-full"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSearch(search === 'critico' ? '' : 'critico')}
            className={`btn text-xs gap-2 transition-all ${search === 'critico' ? 'bg-red-600 text-white border-red-600' : 'btn-secondary dark:bg-gray-800 dark:border-gray-700'}`}
          >
            <AlertCircle size={14} /> {search === 'critico' ? 'Ver Todos' : 'Somente Críticos'}
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-hidden card dark:bg-gray-900 border-none shadow-sm">
        <div className="overflow-x-auto h-full scrollbar-thin">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Item / Localização</th>
                <th>SKU</th>
                <th>Categoria</th>
                <th className="text-center">Qtd Atual</th>
                <th className="text-right">Preço Un.</th>
                <th className="text-right">Total</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 bg-gray-50/30 dark:bg-gray-800/20">
                    <Package className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum item encontrado no estoque</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className={product.quantity <= product.min_quantity ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'}>
                    <td>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-100">{product.name}</p>
                        {product.location && (
                          <p className="text-[10px] text-gray-500 flex items-center gap-1 uppercase tracking-wider font-bold mt-0.5">
                            📍 {product.location}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="text-xs font-mono text-gray-500">{product.sku || '-'}</td>
                    <td>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        {product.category || 'Geral'}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-black ${product.quantity <= product.min_quantity ? 'text-red-600 animate-pulse' : 'text-gray-800 dark:text-gray-200'}`}>
                          {product.quantity}
                        </span>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Mín: {product.min_quantity}</span>
                      </div>
                    </td>
                    <td className="text-right font-medium">R$ {product.unit_price.toFixed(2)}</td>
                    <td className="text-right font-black text-indigo-600 dark:text-indigo-400">
                      R$ {(product.quantity * product.unit_price).toFixed(2)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {can('can_manage_inventory') && (
                          <>
                            <button
                              onClick={() => openMovementModal(product)}
                              className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg text-emerald-600 transition-colors"
                              title="Entrada de Estoque"
                            >
                              <ArrowUp size={18} />
                            </button>
                            <button
                              onClick={() => { setSelectedProduct(product); setMovementData({ ...movementData, type: 'out' }); setShowMovementModal(true); }}
                              className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg text-amber-600 transition-colors"
                              title="Saída de Estoque"
                            >
                              <ArrowDown size={18} />
                            </button>
                            <button
                              onClick={() => openModal(product)}
                              className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg text-indigo-600 transition-colors"
                              title="Editar"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(product)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-600 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border dark:border-gray-800 animate-scaleIn">
            <div className="p-6 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Package className="text-indigo-600" />
                {editingProduct ? 'Editar Item' : 'Novo Item de Estoque'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input dark:bg-gray-800"
                    placeholder="Nome da peça/serviço"
                  />
                </div>
                <div>
                  <label className="label">SKU / Código</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="input dark:bg-gray-800"
                    placeholder="Ex: PC-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Categoria</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input dark:bg-gray-800"
                    placeholder="Ex: Hardware"
                  />
                </div>
                <div>
                  <label className="label">Localização</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input dark:bg-gray-800"
                    placeholder="Prateleira A1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Qtd Inicial</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="input dark:bg-gray-800 font-bold"
                  />
                </div>
                <div>
                  <label className="label text-red-600 font-bold">Estoque Mín.</label>
                  <input
                    type="number"
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({ ...formData, min_quantity: Number(e.target.value) })}
                    className="input dark:bg-gray-800 border-red-200 dark:border-red-900/50 font-bold text-red-600"
                  />
                </div>
                <div>
                  <label className="label">Preço Venda</label>
                  <input
                    type="number"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })}
                    className="input dark:bg-gray-800 font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="label">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input dark:bg-gray-800 min-h-[80px]"
                  placeholder="Detalhes técnicos do item..."
                />
              </div>
            </div>
            <div className="p-6 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-secondary dark:bg-gray-800 dark:border-gray-700"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovementModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-gray-800 animate-scaleIn">
            <div className={`p-6 border-b dark:border-gray-800 ${movementData.type === 'in' ? 'bg-emerald-50/50 dark:bg-emerald-900/30' : 'bg-amber-50/50 dark:bg-amber-900/30'}`}>
              <h2 className={`text-xl font-bold flex items-center gap-2 ${movementData.type === 'in' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {movementData.type === 'in' ? <ArrowUp size={24} /> : <ArrowDown size={24} />}
                {movementData.type === 'in' ? 'Entrada de Estoque' : 'Saída de Estoque'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{selectedProduct.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={movementData.quantity}
                  onChange={(e) => setMovementData({ ...movementData, quantity: Number(e.target.value) })}
                  className="input dark:bg-gray-800 text-2xl font-black text-center"
                />
              </div>
              <div>
                <label className="label">Motivo / Referência</label>
                <input
                  type="text"
                  value={movementData.reason}
                  onChange={(e) => setMovementData({ ...movementData, reason: e.target.value })}
                  className="input dark:bg-gray-800"
                  placeholder="Ex: NF-123 ou Ajuste de inventário"
                />
              </div>
            </div>
            <div className="p-6 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
              <button onClick={() => setShowMovementModal(false)} className="btn btn-secondary dark:bg-gray-800">
                Cancelar
              </button>
              <button
                onClick={handleMovement}
                className={`btn ${movementData.type === 'in' ? 'btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
                disabled={saving}
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
