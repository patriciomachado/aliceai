import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowRight,
  Eye,
  X,
  Sparkles,
  Tag
} from 'lucide-react';

const KnowledgeBase = () => {
  const queryClient = useQueryClient();
  const { showToast, showConfirm } = useApp();
  
  // Search & Modal States
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null); // Read/view overlay state
  const [editingId, setEditingId] = useState(null); // Null = Create, Non-null = Edit
  
  // Form States
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tagsStr, setTagsStr] = useState('');

  // 1. Fetch articles
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['kb', search],
    queryFn: async () => {
      const res = await api.get('/knowledge-base', {
        params: { search }
      });
      return res.data;
    }
  });

  // 2. Publish/Create Article Mutation
  const publishArticleMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/knowledge-base', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb'] });
      closeFormModal();
      showToast('Artigo publicado e vetorizado com sucesso!', 'success');
    },
    onError: () => {
      showToast('Erro ao publicar artigo.', 'error');
    }
  });

  // 3. Update Article Mutation
  const updateArticleMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/knowledge-base/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb'] });
      closeFormModal();
      showToast('Artigo atualizado e vetorizado com sucesso!', 'success');
    },
    onError: () => {
      showToast('Erro ao atualizar artigo.', 'error');
    }
  });

  // 4. Remove/Delete Article Mutation
  const removeArticleMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/knowledge-base/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['kb'] });
      showToast('Artigo removido da base de conhecimento.', 'success');
      if (selectedArticle && selectedArticle.id === id) {
        setSelectedArticle(null);
      }
    },
    onError: () => {
      showToast('Erro ao remover artigo.', 'error');
    }
  });

  // Form handlers
  const openCreateModal = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setCategory('');
    setTagsStr('');
    setModalOpen(true);
  };

  const openEditModal = (art) => {
    setEditingId(art.id);
    setTitle(art.title);
    setContent(art.content);
    setCategory(art.category || 'Geral');
    setTagsStr(Array.isArray(art.tags) ? art.tags.join(', ') : '');
    setModalOpen(true);
  };

  const closeFormModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setTitle('');
    setContent('');
    setCategory('');
    setTagsStr('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showToast('Título e conteúdo do artigo são obrigatórios.', 'warning');
      return;
    }

    // Parse comma-separated tags into unique, clean string array
    const tagsArray = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      content: content.trim(),
      category: category.trim() || 'Geral',
      tags: tagsArray,
      is_published: true
    };

    if (editingId) {
      updateArticleMutation.mutate({ id: editingId, payload });
    } else {
      publishArticleMutation.mutate(payload);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full shrink-0">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Base de Conhecimento</h1>
          <p className="text-white/60 text-sm font-medium">Cadastre diretrizes, respostas de FAQ e regras para alimentar o cérebro RAG da inteligência artificial.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="glass-btn-primary flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" /> Novo Artigo
        </button>
      </div>

      {/* Filter panel */}
      <div className="glass-panel p-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-4 top-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Buscar artigos por título ou palavras-chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 text-white placeholder-white/30 transition"
          />
        </div>
      </div>

      {/* Grid listing articles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full p-16 text-center text-sm text-white/40 flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400"></div>
            <span>Carregando cérebro de suporte...</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="col-span-full p-16 text-center text-sm text-white/40 flex flex-col items-center gap-2 border border-dashed border-white/5 rounded-2xl">
            <BookOpen className="w-8 h-8 text-white/20 mb-2" />
            <span>Nenhum artigo publicado na base de dados</span>
            <button 
              onClick={openCreateModal}
              className="mt-4 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition"
            >
              Adicionar primeiro artigo &rarr;
            </button>
          </div>
        ) : (
          articles.map((art) => (
            <div 
              key={art.id} 
              className="glass-panel p-6 flex flex-col justify-between gap-5 glow-card transition-all duration-300 hover:-translate-y-1 hover:border-white/10"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-full px-2.5 py-0.5 font-bold uppercase tracking-wider">
                    {art.category || 'Geral'}
                  </span>
                  
                  {/* Dynamic pgvector indicator */}
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-inner">
                    <Sparkles className="w-2.5 h-2.5 animate-pulse" /> RAG Indexado
                  </span>
                </div>
                <span className="text-base font-bold text-white leading-snug line-clamp-2">{art.title}</span>
                <p className="text-xs text-white/60 line-clamp-3 min-h-[3rem] leading-relaxed">{art.content}</p>
                
                {/* Visual Tags */}
                {Array.isArray(art.tags) && art.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {art.tags.map(t => (
                      <span key={t} className="flex items-center gap-0.5 text-[9px] bg-white/5 border border-white/5 text-white/40 px-2 py-0.5 rounded font-mono">
                        <Tag className="w-2 h-2" /> {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-auto">
                <button 
                  onClick={() => setSelectedArticle(art)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer transition active:translate-x-0.5"
                >
                  Visualizar Artigo <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(art)}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition text-white/70 cursor-pointer"
                    title="Editar artigo"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      showConfirm(
                        'Confirmar Exclusão',
                        `Deseja realmente excluir o artigo "${art.title}"?`,
                        () => removeArticleMutation.mutate(art.id)
                      );
                    }}
                    className="p-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-xl transition text-red-400 cursor-pointer"
                    title="Excluir artigo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CRUD Form Modal overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 md:p-8 max-w-xl w-full flex flex-col gap-6 animate-scale-in relative border border-white/10 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xl font-bold text-white tracking-wide">
                  {editingId ? 'Editar Artigo' : 'Novo Artigo de Suporte'}
                </h3>
              </div>
              <button 
                onClick={closeFormModal}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {/* Title */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Título do Artigo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Como funciona a política de garantia?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition"
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Categoria</label>
                <input
                  type="text"
                  placeholder="Ex: Garantia, Frete, Suporte Técnico"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition"
                />
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Palavras-chave (Tags separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: devolucao, frete, reembolso, prazo"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition"
                />
              </div>

              {/* Content */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Conteúdo do Artigo</label>
                <textarea
                  required
                  rows="6"
                  placeholder="Descreva as instruções detalhadas. Este conteúdo será vetorizado no cérebro semântico da IA..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition resize-none leading-relaxed"
                />
              </div>

              {/* Submit triggers */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="glass-btn-secondary py-2.5 px-5 font-bold hover:bg-white/5 transition active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={publishArticleMutation.isPending || updateArticleMutation.isPending}
                  className="glass-btn-primary py-2.5 px-6 font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-indigo-600/10 shadow-lg disabled:opacity-50"
                >
                  {publishArticleMutation.isPending || updateArticleMutation.isPending ? 'Indexando (RAG)...' : editingId ? 'Salvar Artigo' : 'Publicar Artigo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reader Modal View overlay */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 md:p-8 max-w-2xl w-full flex flex-col gap-6 animate-scale-in relative border border-white/10 max-h-[85vh] overflow-y-auto">
            
            {/* Header info */}
            <div className="flex items-start justify-between border-b border-white/5 pb-4">
              <div className="flex flex-col gap-1.5 w-[90%]">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-full px-2.5 py-0.5 font-bold uppercase tracking-wider">
                    {selectedArticle.category || 'Geral'}
                  </span>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-inner">
                    <Sparkles className="w-2.5 h-2.5 animate-pulse" /> Ativo no Cérebro RAG
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white leading-snug tracking-wide mt-1">
                  {selectedArticle.title}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedArticle(null)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Read Content block */}
            <div className="text-sm text-white/80 leading-relaxed font-normal whitespace-pre-wrap max-h-[50vh] overflow-y-auto pr-2 bg-white/5 rounded-xl p-5 border border-white/5 scrollbar-thin">
              {selectedArticle.content}
            </div>

            {/* Footer tags */}
            {Array.isArray(selectedArticle.tags) && selectedArticle.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
                <span className="text-[10px] font-bold text-white/40 flex items-center gap-1 mr-1">
                  <Tag className="w-3 h-3 text-white/20" /> Palavras-chave:
                </span>
                {selectedArticle.tags.map(t => (
                  <span key={t} className="text-[10px] bg-white/5 border border-white/5 text-white/60 px-2.5 py-0.5 rounded font-mono">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Close button */}
            <div className="flex items-center justify-end border-t border-white/5 pt-4">
              <button
                onClick={() => setSelectedArticle(null)}
                className="glass-btn-secondary py-2.5 px-6 font-bold hover:bg-white/5 transition active:scale-95"
              >
                Fechar Leitor
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default KnowledgeBase;
