'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Edit, Trash2, Loader2, Package, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';

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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estoque</h1>
          <p className="text-gray-500">{products.length} produtos</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <Plus size={20} />
          Novo Produto
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total de Produtos</p>
          <p className="text-2xl font-bold text-gray-800">{products.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Valor Total</p>
          <p className="text-2xl font-bold text-emerald-600">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`card ${lowStockCount > 0 ? 'bg-red-50 border-red-200' : ''}`}>
          <p className="text-sm text-gray-500">Estoque Baixo</p>
          <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {lowStockCount}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Categorias</p>
          <p className="text-2xl font-bold text-gray-800">
            {new Set(products.map(p => p.category).filter(Boolean)).size}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        <input
          type="text"
          placeholder="Buscar por nome, SKU ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input input-with-icon"
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>SKU</th>
                <th>Categoria</th>
                <th>Quantidade</th>
                <th>Preço Unit.</th>
                <th>Valor Total</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className={product.quantity <= product.min_quantity ? 'bg-red-50' : ''}>
                    <td>
                      <div>
                        <p className="font-medium text-gray-800">{product.name}</p>
                        {product.location && (
                          <p className="text-xs text-gray-500">📍 {product.location}</p>
                        )}
                      </div>
                    </td>
                    <td>{product.sku || '-'}</td>
                    <td>{product.category || '-'}</td>
                    <td>
                      <span className={`font-bold ${product.quantity <= product.min_quantity ? 'text-red-600' : 'text-gray-800'}`}>
                        {product.quantity}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">(mín: {product.min_quantity})</span>
                    </td>
                    <td>R$ {product.unit_price.toFixed(2)}</td>
                    <td className="font-medium">
                      R$ {(product.quantity * product.unit_price).toFixed(2)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openMovementModal(product)}
                          className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600"
                          title="Entrada"
                        >
                          <ArrowUp size={18} />
                        </button>
                        <button
                          onClick={() => { setSelectedProduct(product); setMovementData({ ...movementData, type: 'out' }); setShowMovementModal(true); }}
                          className="p-2 hover:bg-amber-50 rounded-lg text-amber-600"
                          title="Saída"
                        >
                          <ArrowDown size={18} />
                        </button>
                        <button
                          onClick={() => openModal(product)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
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
                    className="input"
                    placeholder="Nome do produto"
                  />
                </div>
                <div>
                  <label className="label">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="input"
                    placeholder="Código SKU"
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
                    className="input"
                    placeholder="Categoria"
                  />
                </div>
                <div>
                  <label className="label">Localização</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input"
                    placeholder="Prateleira, gaveta..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Quantidade</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="input"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Qtd. Mínima</label>
                  <input
                    type="number"
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({ ...formData, min_quantity: Number(e.target.value) })}
                    className="input"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Preço Unit.</label>
                  <input
                    type="number"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })}
                    className="input"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Descrição do produto..."
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                {editingProduct ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovementModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowMovementModal(false)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {movementData.type === 'in' ? '📥 Entrada' : '📤 Saída'} de Estoque
              </h2>
              <p className="text-sm text-gray-500 mt-1">{selectedProduct.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Tipo</label>
                <select
                  value={movementData.type}
                  onChange={(e) => setMovementData({ ...movementData, type: e.target.value })}
                  className="input"
                >
                  <option value="in">📥 Entrada</option>
                  <option value="out">📤 Saída</option>
                </select>
              </div>
              <div>
                <label className="label">Quantidade</label>
                <input
                  type="number"
                  value={movementData.quantity}
                  onChange={(e) => setMovementData({ ...movementData, quantity: Number(e.target.value) })}
                  className="input"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Estoque atual: {selectedProduct.quantity}
                </p>
              </div>
              <div>
                <label className="label">Motivo</label>
                <input
                  type="text"
                  value={movementData.reason}
                  onChange={(e) => setMovementData({ ...movementData, reason: e.target.value })}
                  className="input"
                  placeholder="Motivo da movimentação"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowMovementModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleMovement} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
