import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  Send, 
  Sparkles, 
  MessageSquare, 
  Smartphone, 
  Instagram, 
  Laptop, 
  CheckCheck,
  Search,
  User,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  X,
  Info
} from 'lucide-react';

const Inbox = () => {
  const queryClient = useQueryClient();
  const { showToast, showConfirm } = useApp();
  const [activeConvId, setActiveConvId] = useState(null);
  const [typedMessage, setTypedMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', whatsapp: '', tags: '' });
  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [simulatedQuestion, setSimulatedQuestion] = useState('');

  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeConvId]);

  // 1. Fetch conversations
  const { data: conversations = [], isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/conversations');
      return res.data;
    },
    refetchInterval: 1500, // Refetch conversations every 1.5 seconds for real-time synchronization
    refetchIntervalInBackground: true
  });

  // 2. Fetch active thread message history
  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: async () => {
      if (!activeConvId) return [];
      const res = await api.get(`/conversations/${activeConvId}/messages`);
      return res.data;
    },
    enabled: !!activeConvId,
    refetchInterval: 1500, // Refetch active thread messages every 1.5 seconds for real-time synchronization
    refetchIntervalInBackground: true
  });

  // 3. Mutator for sending a new message (manual reply / simulation)
  const sendMsgMutation = useMutation({
    mutationFn: async ({ conversationId, content, sender_type }) => {
      const res = await api.post(`/conversations/${conversationId}/messages`, {
        content,
        sender_type
      });
      return res.data;
    },
    onSuccess: (data) => {
      setTypedMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      if (data.sender_type === 'customer') {
        showToast('Mensagem recebida! Automação de IA iniciada.');
      } else {
        showToast('Mensagem enviada com sucesso e IA pausada.');
      }
    }
  });

  // 4. Mutation to update conversation status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await api.put(`/conversations/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      showToast('Status da conversa atualizado.');
      setShowActionsDropdown(false);
    }
  });

  // 5. Mutation to delete conversation cascaded
  const deleteConvMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/conversations/${id}`);
      return res.data;
    },
    onSuccess: () => {
      setActiveConvId(null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      showToast('Conversa excluída com sucesso.');
      setShowActionsDropdown(false);
    }
  });

  // Mutation to toggle AI agent status for this conversation's customer
  const toggleAIMutation = useMutation({
    mutationFn: async ({ id, is_ai_disabled }) => {
      const res = await api.put(`/conversations/${id}/status`, { is_ai_disabled });
      return res.data;
    },
    onSuccess: (data) => {
      // Immediately refetch to show updated badge/indicator
      queryClient.refetchQueries({ queryKey: ['conversations'] });
      const isOffline = data.customers?.metadata?.is_ai_disabled;
      showToast(
        isOffline 
          ? '🔕 Agente de IA desativado para esta conversa.' 
          : '✅ Agente de IA reativado para esta conversa.'
      );
      setShowActionsDropdown(false);
    },
    onError: (error) => {
      console.error('[Inbox] Erro ao alterar status da IA:', error);
      showToast('Erro ao alterar status da IA. Tente novamente.', 'error');
      setShowActionsDropdown(false);
    }
  });

  // 6. Mutation to update customer info
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, name, phone, whatsapp, tags }) => {
      const res = await api.put(`/customers/${id}`, { name, phone, whatsapp, tags });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      showToast('Cadastro do cliente atualizado com sucesso.');
      setShowEditModal(false);
    }
  });

  const activeConv = conversations.find(c => c.id === activeConvId);

  const handleSend = (e) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeConvId) return;

    sendMsgMutation.mutate({
      conversationId: activeConvId,
      content: typedMessage,
      sender_type: 'agent'
    });
  };

  const handleAISimulate = () => {
    if (!activeConvId) return;
    setSimulatedQuestion('');
    setSimulationModalOpen(true);
  };

  const handleSimulationSubmit = (e) => {
    e.preventDefault();
    if (!simulatedQuestion.trim() || !activeConvId) return;
    
    sendMsgMutation.mutate({
      conversationId: activeConvId,
      content: simulatedQuestion,
      sender_type: 'customer'
    });
    setSimulationModalOpen(false);
  };

  const openEditModal = () => {
    if (!activeConv?.customers) return;
    const c = activeConv.customers;
    setEditForm({
      name: c.name || '',
      phone: c.phone || '',
      whatsapp: c.whatsapp || '',
      tags: Array.isArray(c.tags) ? c.tags.join(', ') : ''
    });
    setShowEditModal(true);
    setShowActionsDropdown(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!activeConv?.customers?.id) return;
    updateCustomerMutation.mutate({
      id: activeConv.customers.id,
      name: editForm.name,
      phone: editForm.phone,
      whatsapp: editForm.whatsapp,
      tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    });
  };

  const handleDeleteConversation = () => {
    if (!activeConvId) return;
    showConfirm(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir esta conversa e todo o histórico de mensagens? Esta ação não pode ser desfeita.',
      () => deleteConvMutation.mutate(activeConvId)
    );
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'whatsapp': return <Smartphone className="w-4 h-4 text-emerald-500" />;
      case 'instagram': return <Instagram className="w-4 h-4 text-pink-500" />;
      default: return <Laptop className="w-4 h-4 text-indigo-500" />;
    }
  };

  const filteredConvs = conversations.filter(c => {
    const name = c.customers?.name || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex w-full h-[calc(100vh-8rem)] glass-panel border border-border rounded-2xl overflow-hidden shrink-0">
      
      {/* 1. Sidebar thread switcher */}
      <div className="w-80 border-r border-border flex flex-col bg-slate-50/20 dark:bg-card/10">
        <div className="p-4 border-b border-border flex flex-col gap-3">
          <span className="text-lg font-bold text-foreground">Inbox de Conversas</span>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Buscar contatos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder-slate-400 dark:placeholder-white/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-white/5">
          {convsLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Carregando conversas...</div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma conversa ativa</div>
          ) : filteredConvs.map(conv => {
            const isSelected = activeConvId === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id);
                  setShowActionsDropdown(false);
                }}
                className={`p-4 text-left flex items-start gap-3 transition-all duration-200 cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-500/10 dark:bg-gradient-to-r dark:from-indigo-600/20 dark:to-purple-600/10 border-l-4 border-indigo-600' 
                    : 'hover:bg-slate-100/50 dark:hover:bg-white/5'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center relative shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div className="absolute -bottom-1 -right-1 p-1 bg-background border border-border rounded-full flex items-center justify-center">
                    {getChannelIcon(conv.channel)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-bold text-foreground truncate">{conv.customers?.name || 'Cliente'}</span>
                      {conv.customers?.metadata?.is_ai_disabled ? (
                        <span className="text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-full px-1.5 py-0.5 font-bold uppercase shrink-0">🔕 Mudo</span>
                      ) : (conv.customers?.metadata?.ai_paused_until && new Date(conv.customers.metadata.ai_paused_until) > new Date()) ? (
                        <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full px-1.5 py-0.5 font-bold uppercase shrink-0">⏳ Pausado</span>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">Canal: {conv.channel.toUpperCase()}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 font-bold uppercase">
                      Score: {Math.round(conv.sentiment_score * 100)}%
                    </span>
                    {conv.status !== 'active' && (
                      <span className="text-[9px] bg-slate-100 dark:bg-white/5 text-muted-foreground border border-slate-200 dark:border-white/10 rounded-full px-1.5 py-0.5 uppercase font-bold">
                        {conv.status}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Messages Log viewport */}
      <div className="flex-1 flex flex-col bg-slate-50/30 dark:bg-black/20">
        {activeConvId ? (
          <>
            {/* Header info */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-white/80 dark:bg-black/40 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-foreground" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{activeConv?.customers?.name || 'Cliente'}</span>
                    {activeConv?.customers?.metadata?.is_ai_disabled ? (
                      <span className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-full px-2 py-0.5 font-bold uppercase flex items-center gap-1 animate-pulse">
                        🔕 Agente de IA Desativado
                      </span>
                    ) : (activeConv?.customers?.metadata?.ai_paused_until && new Date(activeConv.customers.metadata.ai_paused_until) > new Date()) ? (
                      <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 font-bold uppercase flex items-center gap-1 animate-pulse">
                        ⏳ IA Pausada até {new Date(activeConv?.customers?.metadata?.ai_paused_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{activeConv?.customers?.whatsapp || 'Instagram DM'}</span>
                </div>
              </div>

              {/* Dev automation & Actions Menu */}
              <div className="flex items-center gap-3 relative">
                <button
                  onClick={handleAISimulate}
                  className="flex items-center gap-1.5 text-xs font-bold glass-btn-secondary hover:text-foreground text-muted-foreground"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse" /> Simular Resposta de IA
                </button>

                {/* More actions vertical dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 text-muted-foreground cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showActionsDropdown && (
                    <div className="absolute right-0 mt-2 w-52 bg-background border border-border rounded-xl shadow-lg py-1.5 z-10">
                      <button
                        onClick={openEditModal}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-foreground hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-indigo-500" /> Editar Cliente
                      </button>
                      
                      <div className="border-t border-border my-1"></div>
                      
                      {activeConv?.status !== 'active' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: activeConvId, status: 'active' })}
                          className="w-full px-4 py-2 text-left text-xs font-semibold text-foreground hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Abrir Conversa (Ativa)
                        </button>
                      )}

                      {activeConv?.status !== 'closed' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: activeConvId, status: 'closed' })}
                          className="w-full px-4 py-2 text-left text-xs font-semibold text-foreground hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-slate-500" /> Marcar como Resolvida
                        </button>
                      )}

                      {activeConv?.status !== 'archived' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: activeConvId, status: 'archived' })}
                          className="w-full px-4 py-2 text-left text-xs font-semibold text-foreground hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-amber-500" /> Arquivar Conversa
                        </button>
                      )}

                      <div className="border-t border-border my-1"></div>

                      <button
                        onClick={() => toggleAIMutation.mutate({ 
                          id: activeConvId, 
                          is_ai_disabled: !activeConv?.customers?.metadata?.is_ai_disabled 
                        })}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-foreground hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${activeConv?.customers?.metadata?.is_ai_disabled ? 'text-slate-400' : 'text-purple-500 animate-pulse'}`} />
                        {activeConv?.customers?.metadata?.is_ai_disabled ? 'Ativar Agente de IA' : 'Desativar Agente de IA'}
                      </button>

                      <div className="border-t border-border my-1"></div>

                      <button
                        onClick={handleDeleteConversation}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir Conversa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Historic conversation list */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
            >
              {msgsLoading ? (
                <div className="text-center text-xs text-muted-foreground">Carregando logs...</div>
              ) : messages.map((msg, idx) => {
                const isAgent = msg.sender_type === 'agent' || msg.sender_type === 'ai';
                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col max-w-[70%] ${isAgent ? 'self-end items-end' : 'self-start items-start'}`}
                  >
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm ${
                        msg.sender_type === 'ai'
                          ? 'bg-purple-100/90 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 text-purple-950 dark:text-white/90'
                          : msg.sender_type === 'agent'
                          ? 'bg-indigo-600 text-white shadow-glowing'
                          : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      {msg.sender_type === 'ai' && <Sparkles className="w-3 h-3 text-purple-500" />}
                      {msg.sender_type.toUpperCase()} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isAgent && <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI Status Banner */}
            {activeConv?.customers?.metadata?.is_ai_disabled ? (
              <div className="mx-4 mt-2 px-3 py-2 bg-red-500/5 border border-red-500/15 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400 animate-fade-in shrink-0">
                <Info className="w-4 h-4 shrink-0" />
                <span>O agente de IA está <strong>desativado</strong> para este cliente. Suas mensagens não serão respondidas automaticamente.</span>
              </div>
            ) : (activeConv?.customers?.metadata?.ai_paused_until && new Date(activeConv.customers.metadata.ai_paused_until) > new Date()) ? (
              <div className="mx-4 mt-2 px-3 py-2 bg-amber-500/5 border border-amber-500/15 rounded-xl flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 animate-fade-in shrink-0">
                <Info className="w-4 h-4 shrink-0" />
                <span>O agente de IA está <strong>pausado</strong> até <strong>{new Date(activeConv?.customers?.metadata?.ai_paused_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> devido a uma resposta humana (takeover).</span>
              </div>
            ) : null}

            {/* Input field footer */}
            <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-3 bg-white/80 dark:bg-black/40 backdrop-blur-md">
              <input
                type="text"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                placeholder="Escreva uma resposta..."
                className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder-slate-400 dark:placeholder-white/30"
              />
              <button
                type="submit"
                disabled={sendMsgMutation.isPending}
                className="glass-btn-primary px-5 flex items-center justify-center"
              >
                {sendMsgMutation.isPending ? '...' : <Send className="w-4 h-4" />}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 animate-bounce" />
            <span className="text-sm font-bold text-muted-foreground">Selecione uma conversa para começar</span>
            <span className="text-xs text-muted-foreground/60">Gerencie contatos WhatsApp e Instagram Directs em tempo real.</span>
          </div>
        )}
      </div>

      {/* 3. Edit Customer Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Editar Dados do Cliente</h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-muted-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Nome</label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Telefone</label>
                <input 
                  type="text" 
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">WhatsApp</label>
                <input 
                  type="text" 
                  value={editForm.whatsapp}
                  onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Tags (separadas por vírgula)</label>
                <input 
                  type="text" 
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="Ex: vip, lead, açougue"
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="glass-btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={updateCustomerMutation.isPending}
                  className="glass-btn-primary"
                >
                  {updateCustomerMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. AI Simulation Modal */}
      {simulationModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 max-w-md w-full flex flex-col gap-6 animate-scale-in border border-white/10 relative">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                <h3 className="text-xl font-bold text-white tracking-wide">Simular Resposta de IA</h3>
              </div>
              <button 
                onClick={() => setSimulationModalOpen(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSimulationSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Mensagem do Cliente</label>
                <p className="text-[11px] text-white/40">Digite a pergunta ou observação simulada que o cliente enviou via WhatsApp:</p>
                <textarea
                  required
                  rows="4"
                  value={simulatedQuestion}
                  onChange={(e) => setSimulatedQuestion(e.target.value)}
                  placeholder="Ex: Sim, pode cortar em bifes de dois dedos, por favor!"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition resize-none placeholder-white/20"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setSimulationModalOpen(false)}
                  className="glass-btn-secondary py-2.5 px-5 font-bold hover:bg-white/5 transition active:scale-95 text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary py-2.5 px-6 font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-indigo-600/10 shadow-lg text-xs cursor-pointer"
                >
                  Simular Mensagem
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
