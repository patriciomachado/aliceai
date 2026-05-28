import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Clock, 
  Sparkles,
  Layers
} from 'lucide-react';

const Services = () => {
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('60');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState(true);

  // 1. Load active services catalog
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await api.get('/services');
      return res.data;
    }
  });

  // 2. Add service
  const createServMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/services', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      handleCloseModal();
      showToast('Serviço cadastrado com sucesso!');
    },
    onError: (error) => {
      console.error('[Services] Erro ao cadastrar serviço:', error);
      const msg = error?.response?.data?.error || error?.response?.data?.details?.[0]?.message || 'Erro ao salvar serviço. Verifique os dados e tente novamente.';
      showToast(msg, 'error');
    }
  });

  // 3. Edit service
  const updateServMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/services/${editingService.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      handleCloseModal();
      showToast('Serviço atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('[Services] Erro ao editar serviço:', error);
      showToast('Erro ao atualizar serviço.', 'error');
    }
  });

  // 4. Remove service
  const deleteServMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      showToast('Serviço excluído.');
    },
    onError: (error) => {
      console.error('[Services] Erro ao excluir serviço:', error);
      showToast('Erro ao excluir serviço.', 'error');
    }
  });

  const handleOpenNew = () => {
    setEditingService(null);
    setName('');
    setDescription('');
    setPrice('');
    setDuration('60');
    setCategory('');
    setIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (serv) => {
    setEditingService(serv);
    setName(serv.name);
    setDescription(serv.description || '');
    setPrice(serv.price);
    setDuration(serv.duration_minutes || '60');
    setCategory(serv.category || '');
    setIsActive(serv.is_active);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingService(null);
    setName('');
    setDescription('');
    setPrice('');
    setDuration('60');
    setCategory('');
    setIsActive(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    const payload = {
      name,
      description: description || null,
      price: Number(price),
      duration_minutes: Number(duration || 60),
      category: category || null,
      is_active: isActive
    };

    if (editingService) {
      updateServMutation.mutate(payload);
    } else {
      createServMutation.mutate(payload);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full shrink-0">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Portfólio de Serviços</h1>
          <p className="text-white/60 text-sm">Gerencie os serviços prestados, suas durações e os preços repassados pela inteligência artificial aos clientes.</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="glass-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Serviço
        </button>
      </div>

      {/* Grid catalog cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full p-12 text-center text-xs text-white/40">Carregando serviços...</div>
        ) : services.length === 0 ? (
          <div className="col-span-full p-12 text-center text-xs text-white/40">Nenhum serviço cadastrado</div>
        ) : services.map((serv) => (
          <div key={serv.id} className="glass-panel p-6 flex flex-col justify-between gap-6 glow-card transition hover:-translate-y-1">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 text-white/70 font-semibold">{serv.category || 'Geral'}</span>
                <span className="text-xs text-white/40 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {serv.duration_minutes} min</span>
              </div>
              <span className="text-lg font-bold text-white leading-snug flex items-center gap-1.5">
                {serv.name}
                {!serv.is_active && (
                  <span className="text-[9px] bg-red-950/40 text-red-400 border border-red-900/30 rounded-full px-1.5 py-0.2 uppercase font-bold shrink-0">Inativo</span>
                )}
              </span>
              <p className="text-xs text-white/60 line-clamp-2 min-h-[2rem]">{serv.description || 'Nenhuma descrição informada.'}</p>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Preço</span>
                <span className="text-lg font-black text-indigo-400">R$ {Number(serv.price).toFixed(2)}</span>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Tipo de Execução</span>
                <span className="text-xs text-white/80 font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3 text-purple-400" /> IA Sincronizada</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleOpenEdit(serv)}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition text-white/75 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteServMutation.mutate(serv.id)}
                className="p-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-xl transition text-red-400 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CRUD Modal overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 max-w-md w-full flex flex-col gap-6 animate-scale-in bg-white dark:bg-[#090a0f]">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">{editingService ? 'Editar Serviço' : 'Novo Item de Serviço'}</span>
              <span className="text-xs text-white/50">Configure valores, durações e descrições para a inteligência artificial responder com exatidão.</span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Nome do Serviço</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="glass-input w-full min-h-[4rem]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">Duração (Minutos)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="glass-input w-full"
                    placeholder="Consultoria, Setup, etc."
                  />
                </div>

                <div className="flex flex-col gap-1.5 justify-center mt-4 pl-2">
                  <label className="flex items-center gap-2 text-xs text-white/80 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    Serviço Ativo
                  </label>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="glass-btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createServMutation.isPending || updateServMutation.isPending}
                  className="glass-btn-primary"
                >
                  {createServMutation.isPending || updateServMutation.isPending ? 'Salvando...' : editingService ? 'Salvar Alterações' : 'Salvar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
