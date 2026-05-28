import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  Plus, 
  Package, 
  Trash2, 
  Edit3, 
  Barcode,
  LayoutGrid,
  List
} from 'lucide-react';

const Products = () => {
  const queryClient = useQueryClient();
  const { showToast, workspaceSettings } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');

  const activeNiche = workspaceSettings?.niche || 'retail';

  // Niche-specific UI configurations
  const nicheConfig = {
    butcher: {
      desc: 'Gerencie sua seleção de cortes, carnes e produtos de açougue integrados à inteligência artificial.',
      priceLabel: 'Preço (por kg)',
      priceFormLabel: 'Preço por kg (R$)',
      stockLabel: 'Estoque (kg)',
      stockFormLabel: 'Estoque Inicial (kg)',
      stockUnit: 'kg',
      categoryPlaceholder: 'Ex: Carnes, Aves, Espetinhos',
      skuPlaceholder: 'Ex: COR-BOV-01'
    },
    restaurant: {
      desc: 'Gerencie o cardápio de pratos, lanches, porções e bebidas integrados à inteligência artificial.',
      priceLabel: 'Preço',
      priceFormLabel: 'Preço (R$)',
      stockLabel: 'Estoque',
      stockFormLabel: 'Estoque Inicial',
      stockUnit: 'unidades',
      categoryPlaceholder: 'Ex: Lanches, Bebidas, Sobremesas',
      skuPlaceholder: 'Ex: HAM-01'
    },
    gym: {
      desc: 'Gerencie os planos de mensalidade, assinaturas e pacotes de aulas integrados à inteligência artificial.',
      priceLabel: 'Preço',
      priceFormLabel: 'Valor do Plano (R$)',
      stockLabel: 'Vagas',
      stockFormLabel: 'Limite de Vagas / Alunos',
      stockUnit: 'vagas',
      categoryPlaceholder: 'Ex: Musculação, Pilates, CrossFit',
      skuPlaceholder: 'Ex: PLA-MEN-01'
    },
    retail: {
      desc: 'Gerencie o portfólio de infoprodutos ou itens físicos integrados à inteligência artificial.',
      priceLabel: 'Preço',
      priceFormLabel: 'Preço (R$)',
      stockLabel: 'Estoque',
      stockFormLabel: 'Estoque Inicial',
      stockUnit: 'unidades',
      categoryPlaceholder: 'Ex: Infoprodutos, Roupas, Eletrônicos',
      skuPlaceholder: 'Ex: INF-MKT-01'
    },
    tech_repair: {
      desc: 'Gerencie o catálogo de serviços comuns, consertos, orçamentos e prazos de reparo integrados à inteligência artificial.',
      priceLabel: 'Preço Estimado',
      priceFormLabel: 'Preço Estimado do Reparo (R$)',
      stockLabel: 'Prazo Médio',
      stockFormLabel: 'Prazo Estimado (Dias Úteis)',
      stockUnit: 'dias úteis',
      categoryPlaceholder: 'Ex: Celulares, Computadores, TVs',
      skuPlaceholder: 'Ex: SER-CEL-01'
    }
  };

  const config = nicheConfig[activeNiche] || nicheConfig.retail;

  // 1. Load active products catalog
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data;
    }
  });

  // 2. Add product
  const createProdMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/products', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      handleCloseModal();
      showToast('Produto cadastrado com sucesso!');
    }
  });

  // 3. Edit product
  const updateProdMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/products/${editingProduct.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      handleCloseModal();
      showToast('Produto atualizado com sucesso!');
    }
  });

  // 4. Remove product
  const deleteProdMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('Produto excluído.');
    }
  });

  const handleOpenNew = () => {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setPrice('');
    setStock('');
    setCategory('');
    setSku('');
    setModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setName(prod.name);
    setDescription(prod.description || '');
    setPrice(prod.price);
    setStock(prod.stock);
    setCategory(prod.category || '');
    setSku(prod.sku || '');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setName('');
    setDescription('');
    setPrice('');
    setStock('');
    setCategory('');
    setSku('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    const payload = {
      name,
      description: description || null,
      price: Number(price),
      stock: Number(stock || 0),
      category: category || null,
      sku: sku || null
    };

    if (editingProduct) {
      updateProdMutation.mutate(payload);
    } else {
      createProdMutation.mutate(payload);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full shrink-0">
      
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Catálogo de Produtos</h1>
          <p className="text-white/60 text-sm">{config.desc}</p>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          {/* View mode toggle */}
          <div className="flex bg-black/40 border border-white/5 rounded-2xl p-1 select-none">
            <button
              type="button"
              id="btn-toggle-grid"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition duration-200 cursor-pointer ${
                viewMode === 'grid' 
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-600/30' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="btn-toggle-list"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition duration-200 cursor-pointer ${
                viewMode === 'list' 
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-600/30' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleOpenNew}
            id="btn-new-product"
            className="glass-btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-xs text-white/40 flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400"></div>
          <span>Carregando catálogo...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="p-16 text-center text-xs text-white/40">Nenhum produto cadastrado</div>
      ) : viewMode === 'list' ? (
        /* Compact List/Table View */
        <div className="glass-panel overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] text-white/50 font-extrabold uppercase tracking-wider">
                <th className="p-4">SKU</th>
                <th className="p-4">Produto</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">{config.priceLabel}</th>
                <th className="p-4">{config.stockLabel}</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {products.map((prod) => (
                <tr key={prod.id} className="hover:bg-white/5 transition duration-200">
                  <td className="p-4 font-mono text-xs text-white/50">{prod.sku || 'N/A'}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-white">{prod.name}</span>
                      {prod.description && (
                        <span className="text-[11px] text-white/40 truncate max-w-xs">{prod.description}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 text-white/70 font-semibold">
                      {prod.category || 'Geral'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-indigo-400 font-mono">
                    R$ {Number(prod.price).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <span className={`font-semibold ${prod.stock > 10 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {prod.stock} {config.stockUnit}
                    </span>
                  </td>
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleOpenEdit(prod)}
                        id={`btn-edit-list-${prod.id}`}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition text-white/75 cursor-pointer"
                        title="Editar Produto"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteProdMutation.mutate(prod.id)}
                        id={`btn-delete-list-${prod.id}`}
                        className="p-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-xl transition text-red-400 cursor-pointer"
                        title="Excluir Produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid inventory cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((prod) => (
            <div key={prod.id} className="glass-panel p-6 flex flex-col justify-between gap-6 glow-card transition hover:-translate-y-1">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 text-white/70 font-semibold">{prod.category || 'Geral'}</span>
                  <span className="text-xs text-white/40 flex items-center gap-1"><Barcode className="w-3.5 h-3.5" /> {prod.sku}</span>
                </div>
                <span className="text-lg font-bold text-white leading-snug">{prod.name}</span>
                <p className="text-xs text-white/60 line-clamp-2 min-h-[2rem]">{prod.description || 'Nenhuma descrição informada.'}</p>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{config.priceLabel}</span>
                  <span className="text-lg font-black text-indigo-400">R$ {Number(prod.price).toFixed(2)}</span>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{config.stockLabel}</span>
                  <span className={`text-sm font-bold ${prod.stock > 10 ? 'text-emerald-400' : 'text-amber-400'}`}>{prod.stock} {config.stockUnit}</span>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => handleOpenEdit(prod)}
                  id={`btn-edit-grid-${prod.id}`}
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition text-white/75 cursor-pointer"
                  title="Editar Produto"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteProdMutation.mutate(prod.id)}
                  id={`btn-delete-grid-${prod.id}`}
                  className="p-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-xl transition text-red-400 cursor-pointer"
                  title="Excluir Produto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CRUD Modal overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 max-w-md w-full flex flex-col gap-6 animate-scale-in bg-white dark:bg-[#090a0f]">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">{editingProduct ? 'Editar Produto' : 'Novo Item de Catálogo'}</span>
              <span className="text-xs text-white/50">Insira as configurações básicas para habilitar links de venda.</span>
            </div>

            <form onSubmit={handleSubmit} id="product-crud-form" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Nome do Produto</label>
                <input
                  type="text"
                  id="input-product-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Descrição</label>
                <textarea
                  id="input-product-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="glass-input w-full min-h-[4rem]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">{config.priceFormLabel}</label>
                  <input
                    type="number"
                    id="input-product-price"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">{config.stockFormLabel}</label>
                  <input
                    type="number"
                    id="input-product-stock"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">Categoria</label>
                  <input
                    type="text"
                    id="input-product-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="glass-input w-full"
                    placeholder={config.categoryPlaceholder}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">SKU Código</label>
                  <input
                    type="text"
                    id="input-product-sku"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="glass-input w-full"
                    placeholder={config.skuPlaceholder}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  id="btn-product-cancel"
                  onClick={handleCloseModal}
                  className="glass-btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-product-submit"
                  disabled={createProdMutation.isPending || updateProdMutation.isPending}
                  className="glass-btn-primary"
                >
                  {createProdMutation.isPending || updateProdMutation.isPending ? 'Salvando...' : editingProduct ? 'Salvar Alterações' : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
