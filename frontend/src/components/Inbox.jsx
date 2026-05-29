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
  Info,
  Calendar,
  ShoppingBag,
  Phone,
  MessageCircle,
  Eye,
  EyeOff,
  UserCheck
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
  const [showCrmPanel, setShowCrmPanel] = useState(true); // Collapsible right CRM panel

  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

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

  // 3. Fetch all appointments to filter dynamically for CRM
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const res = await api.get('/appointments');
      return res.data;
    },
    refetchInterval: 5000
  });

  // 4. Fetch all orders to filter dynamically for CRM
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
    refetchInterval: 5000
  });

  // Auto-scroll to bottom on loaded/new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, activeConvId]);

  // 5. Mutator for sending a new message (manual reply / simulation)
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

  // 6. Mutation to update conversation status
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

  // 7. Mutation to delete conversation cascaded
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

  // 8. Mutation to update customer info
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
  const activeCustomer = activeConv?.customers;

  // Filter appointments and orders specifically for active customer in CRM
  const customerAppointments = activeCustomer
    ? appointments.filter(appt => appt.customer_id === activeCustomer.id)
    : [];

  const customerOrders = activeCustomer
    ? orders.filter(ord => ord.customer_id === activeCustomer.id)
    : [];

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
      case 'whatsapp': return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
      case 'instagram': return <Instagram className="w-3.5 h-3.5 text-pink-400" />;
      default: return <Laptop className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const getSentimentDetails = (score) => {
    const s = Number(score);
    if (s >= 0.75) {
      return {
        label: 'Positivo',
        style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      };
    } else if (s <= 0.40) {
      return {
        label: 'Crítico',
        style: 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
      };
    } else {
      return {
        label: 'Neutro',
        style: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
      };
    }
  };

  const getInitials = (name) => {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const formatBrDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const filteredConvs = conversations.filter(c => {
    const name = c.customers?.name || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex w-full h-[calc(100vh-8rem)] glass-panel border border-white/5 rounded-2xl overflow-hidden shrink-0 bg-slate-950/30">
      
      {/* ========================================== */}
      {/* COLUMN 1: SIDEBAR THREAD LIST */}
      {/* ========================================== */}
      <div className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-slate-950/40 shrink-0">
        
        {/* Search header area */}
        <div className="p-5 border-b border-white/5 flex flex-col gap-4 bg-slate-950/10">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Inbox de Clientes
            </h2>
            <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full">
              {filteredConvs.length} conversas
            </span>
          </div>
          
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Buscar por cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/60 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 placeholder-white/20 transition-all duration-200"
            />
          </div>
        </div>

        {/* Thread List scroll area */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
          {convsLoading ? (
            <div className="p-8 text-center text-xs text-white/30 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              Carregando conversas...
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center text-xs text-white/30 flex flex-col items-center gap-2">
              <Info className="w-8 h-8 text-white/10" />
              Nenhuma conversa ativa no momento
            </div>
          ) : filteredConvs.map(conv => {
            const isSelected = activeConvId === conv.id;
            const sentiment = getSentimentDetails(conv.sentiment_score);
            const initials = getInitials(conv.customers?.name);
            const isOffline = conv.customers?.metadata?.is_ai_disabled;
            const isPaused = conv.customers?.metadata?.ai_paused_until && new Date(conv.customers.metadata.ai_paused_until) > new Date();

            return (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id);
                  setShowActionsDropdown(false);
                }}
                className={`w-full p-4 text-left flex items-start gap-4 transition-all duration-200 cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-600/10 border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-500/10 to-transparent' 
                    : 'hover:bg-white/5 border-l-4 border-transparent'
                }`}
              >
                {/* Avatar with dynamic initials gradient & live badge */}
                <div className="relative shrink-0 mt-0.5">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-tr ${
                    isSelected ? 'from-indigo-500 to-violet-500' : 'from-slate-800 to-slate-700'
                  } border border-white/10 flex items-center justify-center text-white text-xs font-black shadow-inner`}>
                    {initials}
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1 bg-slate-950 border border-white/10 rounded-full shadow-md flex items-center justify-center">
                    {getChannelIcon(conv.channel)}
                  </div>
                </div>

                {/* Info summary inside card */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                      {conv.customers?.name || 'Cliente'}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    {isOffline ? (
                      <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                        🔕 Mudo
                      </span>
                    ) : isPaused ? (
                      <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                        ⏳ Pausado
                      </span>
                    ) : (
                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                        ✨ IA Ativa
                      </span>
                    )}
                    
                    <span className={`text-[8px] border rounded px-1.5 py-0.5 font-bold uppercase tracking-wider ${sentiment.style}`}>
                      {sentiment.label} ({Math.round(conv.sentiment_score * 100)}%)
                    </span>
                  </div>

                  <p className="text-xs text-white/50 truncate mt-1">
                    Canal: <strong className="text-white/70">{conv.channel.toUpperCase()}</strong>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================== */}
      {/* COLUMN 2: ACTIVE CHAT SCREEN */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col bg-slate-950/20 relative">
        {activeConvId ? (
          <>
            {/* Header profile info */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/40 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 border border-white/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white tracking-wide">{activeCustomer?.name || 'Cliente'}</span>
                    {activeCustomer?.metadata?.is_ai_disabled ? (
                      <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/25 rounded px-2 py-0.5 font-bold uppercase flex items-center gap-1 animate-pulse">
                        🔕 IA Desativada
                      </span>
                    ) : (activeCustomer?.metadata?.ai_paused_until && new Date(activeCustomer.metadata.ai_paused_until) > new Date()) ? (
                      <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded px-2 py-0.5 font-bold uppercase flex items-center gap-1 animate-pulse">
                        ⏳ IA Pausada (Atendente Humano)
                      </span>
                    ) : (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded px-2 py-0.5 font-bold uppercase flex items-center gap-1">
                        ✨ IA Monitorando
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/40">{activeCustomer?.whatsapp || activeCustomer?.phone || 'Instagram DM'}</span>
                </div>
              </div>

              {/* CRM toggle & Canned Responses action layout */}
              <div className="flex items-center gap-3 relative">
                <button
                  onClick={handleAISimulate}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-white/5 hover:border-white/15 bg-slate-900/60 hover:bg-slate-900 text-white/70 hover:text-white transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> Simular Cliente
                </button>

                {/* Toggle Collapsible CRM panel */}
                <button
                  onClick={() => setShowCrmPanel(!showCrmPanel)}
                  className={`p-2 rounded-xl border border-white/5 hover:border-white/15 cursor-pointer transition shadow-md ${
                    showCrmPanel ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30' : 'bg-slate-900/60 text-white/70 hover:bg-slate-900'
                  }`}
                  title="Dados do Cliente (CRM)"
                >
                  {showCrmPanel ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                {/* Dropdown triggers */}
                <div className="relative">
                  <button
                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                    className="p-2 bg-slate-900/60 hover:bg-slate-900 rounded-xl border border-white/5 hover:border-white/15 text-white/70 hover:text-white cursor-pointer transition shadow-md"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showActionsDropdown && (
                    <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-white/10 rounded-xl shadow-xl py-1.5 z-20 animate-scale-in">
                      <button
                        onClick={openEditModal}
                        className="w-full px-4 py-2.5 text-left text-xs font-semibold text-white/80 hover:text-white hover:bg-white/5 flex items-center gap-2 cursor-pointer transition"
                      >
                        <Edit className="w-3.5 h-3.5 text-indigo-400" /> Editar Informações
                      </button>
                      
                      <div className="border-t border-white/5 my-1.5"></div>
                      
                      {activeConv?.status !== 'active' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: activeConvId, status: 'active' })}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-white/80 hover:text-white hover:bg-white/5 flex items-center gap-2 cursor-pointer transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Marcar como Aberta
                        </button>
                      )}

                      {activeConv?.status !== 'closed' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: activeConvId, status: 'closed' })}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-white/80 hover:text-white hover:bg-white/5 flex items-center gap-2 cursor-pointer transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-slate-400" /> Marcar como Resolvida
                        </button>
                      )}

                      {activeConv?.status !== 'archived' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: activeConvId, status: 'archived' })}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-white/80 hover:text-white hover:bg-white/5 flex items-center gap-2 cursor-pointer transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-amber-400" /> Arquivar Conversa
                        </button>
                      )}

                      <div className="border-t border-white/5 my-1.5"></div>

                      <button
                        onClick={() => toggleAIMutation.mutate({ 
                          id: activeConvId, 
                          is_ai_disabled: !activeCustomer?.metadata?.is_ai_disabled 
                        })}
                        className="w-full px-4 py-2.5 text-left text-xs font-semibold text-white/80 hover:text-white hover:bg-white/5 flex items-center gap-2 cursor-pointer transition"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${activeCustomer?.metadata?.is_ai_disabled ? 'text-slate-400' : 'text-purple-400 animate-pulse'}`} />
                        {activeCustomer?.metadata?.is_ai_disabled ? 'Reativar Alice IA' : 'Pausar Alice IA'}
                      </button>

                      <div className="border-t border-white/5 my-1.5"></div>

                      <button
                        onClick={handleDeleteConversation}
                        className="w-full px-4 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" /> Excluir Conversa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Conversation Feed scroll area */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar"
            >
              {msgsLoading ? (
                <div className="text-center text-xs text-white/30 p-8 flex flex-col items-center gap-2 justify-center h-full">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-white/20 p-8 flex flex-col items-center justify-center gap-2 h-full">
                  <MessageCircle className="w-12 h-12 text-white/5" />
                  Nenhuma mensagem trocada ainda neste canal.
                </div>
              ) : messages.map((msg, idx) => {
                const isCustomer = msg.sender_type === 'customer';
                const isAI = msg.sender_type === 'ai';
                const isAgent = msg.sender_type === 'agent';
                
                // Style system log events dynamically
                const isSystem = msg.sender_type === 'system' || 
                  msg.content.startsWith('📅') || 
                  msg.content.startsWith('🔕') || 
                  msg.content.startsWith('✅') || 
                  msg.content.startsWith('⏳');

                if (isSystem) {
                  return (
                    <div 
                      key={msg.id || idx}
                      className="self-center flex items-center gap-2 bg-slate-900/60 border border-white/5 rounded-full px-4 py-1.5 text-[11px] text-white/60 shadow-md animate-fade-in my-1 font-medium select-none"
                    >
                      <span>{msg.content}</span>
                      <span className="text-[9px] text-white/30">•</span>
                      <span className="text-[9px] text-white/30">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col max-w-[65%] gap-1.5 animate-fade-in ${
                      isCustomer ? 'self-start items-start' : 'self-end items-end'
                    }`}
                  >
                    {/* Message Bubble */}
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm font-medium tracking-wide shadow-md transition-all ${
                        isAI
                          ? 'bg-gradient-to-r from-fuchsia-950/30 to-purple-950/30 border border-purple-500/25 text-white/90 shadow-purple-500/5'
                          : isAgent
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-600/10'
                          : 'bg-slate-900/50 border border-white/5 text-white/95 backdrop-blur-sm'
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Metadata indicators */}
                    <span className="text-[10px] text-white/30 flex items-center gap-1.5 font-bold tracking-wider px-1">
                      {isAI && (
                        <span className="flex items-center gap-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-full font-black text-[8px] tracking-widest uppercase">
                          <Sparkles className="w-2.5 h-2.5" /> ALICE IA
                        </span>
                      )}
                      {isAgent && (
                        <span className="flex items-center gap-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-black text-[8px] tracking-widest uppercase">
                          <UserCheck className="w-2.5 h-2.5" /> ATENDENTE
                        </span>
                      )}
                      {isCustomer && 'CLIENTE'}
                      <span>•</span>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {!isCustomer && <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI Status take-over warning banners */}
            {activeCustomer?.metadata?.is_ai_disabled ? (
              <div className="mx-6 mt-2 px-4 py-3 bg-red-500/5 border border-red-500/15 rounded-xl flex items-center gap-3 text-xs text-red-400 animate-fade-in shrink-0">
                <Info className="w-4 h-4 shrink-0 text-red-400" />
                <span>
                  O agente de IA da Alice está <strong>desativado</strong> para este contato. As mensagens não serão respondidas automaticamente.
                </span>
              </div>
            ) : (activeCustomer?.metadata?.ai_paused_until && new Date(activeCustomer.metadata.ai_paused_until) > new Date()) ? (
              <div className="mx-6 mt-2 px-4 py-3 bg-amber-500/5 border border-amber-500/15 rounded-xl flex items-center gap-3 text-xs text-amber-400 animate-fade-in shrink-0">
                <Info className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Alice IA está <strong>pausada</strong> até <strong>{new Date(activeCustomer.metadata.ai_paused_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> devido à sua última intervenção humana.
                </span>
              </div>
            ) : null}

            {/* Typing input footer panel */}
            <form 
              onSubmit={handleSend} 
              className="p-5 border-t border-white/5 flex gap-3 bg-slate-900/40 backdrop-blur-md"
            >
              <input
                type="text"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                placeholder="Escreva uma resposta..."
                className="flex-1 bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/40 placeholder-white/20 transition"
              />
              <button
                type="submit"
                disabled={sendMsgMutation.isPending}
                className="glass-btn-primary px-6 flex items-center justify-center shrink-0"
              >
                {sendMsgMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 bg-slate-950/10 p-6">
            <div className="w-16 h-16 rounded-full bg-slate-900/60 border border-white/5 flex items-center justify-center shadow-lg">
              <MessageSquare className="w-8 h-8 text-indigo-400 animate-pulse" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-sm">
              <span className="text-sm font-bold text-white tracking-wide">Bem-vindo ao Central Inbox 2.0</span>
              <span className="text-xs text-white/40">Selecione um contato na barra lateral esquerda para visualizar o histórico de mensagens, detalhes CRM do cliente, pedidos e agendamentos ativos.</span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* COLUMN 3: CRM TELEMETRY (COLLAPSIBLE) */}
      {/* ========================================== */}
      {activeConvId && (
        <div className={`transition-all duration-300 flex flex-col bg-slate-950/40 shrink-0 custom-scrollbar overflow-y-auto ${
          showCrmPanel ? 'w-80 md:w-96 border-l border-white/5' : 'w-0 overflow-hidden'
        }`}>
          
          <div className="p-5 border-b border-white/5 flex flex-col items-center text-center gap-3 bg-slate-950/10">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-white text-base font-bold shadow-lg">
              {getInitials(activeCustomer?.name)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white tracking-wide">{activeCustomer?.name || 'Cliente'}</span>
              <span className="text-xs text-white/40 flex items-center justify-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" /> {activeCustomer?.whatsapp || activeCustomer?.phone || 'Sem Telefone'}
              </span>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-6">
            {/* Tags section */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Marcadores / Tags</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeCustomer?.tags && Array.isArray(activeCustomer.tags) && activeCustomer.tags.length > 0 ? (
                  activeCustomer.tags.map((tag, idx) => (
                    <span 
                      key={idx}
                      className="text-[9px] bg-slate-900 border border-white/5 text-white/60 font-bold px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-white/20 italic">Nenhuma tag cadastrada</span>
                )}
              </div>
            </div>

            <div className="border-t border-white/5"></div>

            {/* Active Appointments panel */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Agendamentos Ativos
              </span>
              
              <div className="flex flex-col gap-2">
                {customerAppointments.length === 0 ? (
                  <div className="bg-slate-900/30 border border-white/5 rounded-xl p-4 text-center text-xs text-white/30">
                    Nenhum agendamento ativo cadastrado.
                  </div>
                ) : (
                  customerAppointments.map((appt) => (
                    <div 
                      key={appt.id}
                      className="bg-slate-900/50 border border-white/5 rounded-xl p-3.5 flex flex-col gap-1.5 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate max-w-[70%]">{appt.service_type}</span>
                        <span className={`text-[8px] border font-bold px-1.5 py-0.2 rounded uppercase ${
                          appt.status === 'confirmed' || appt.status === 'scheduled'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-slate-900 border-white/5 text-white/40'
                        }`}>
                          {appt.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-white/40">
                        <span>Data: <strong>{formatBrDate(appt.scheduled_date)}</strong></span>
                        <span>Hora: <strong>{appt.scheduled_time.slice(0, 5)}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-white/5"></div>

            {/* Recent Orders panel */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" />
                Pedidos Recentes
              </span>
              
              <div className="flex flex-col gap-2">
                {customerOrders.length === 0 ? (
                  <div className="bg-slate-900/30 border border-white/5 rounded-xl p-4 text-center text-xs text-white/30">
                    Nenhum pedido registrado para este cliente.
                  </div>
                ) : (
                  customerOrders.map((order) => {
                    const orderIdShort = order.id.slice(-6).toUpperCase();
                    return (
                      <div 
                        key={order.id}
                        className="bg-slate-900/50 border border-white/5 rounded-xl p-3.5 flex flex-col gap-2 shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-400 font-mono">#{orderIdShort}</span>
                          <span className={`text-[8px] border font-bold px-1.5 py-0.2 rounded uppercase ${
                            order.status === 'completed' || order.payment_status === 'completed'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : order.status === 'pending'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
                              : 'bg-red-500/10 border-red-500/20 text-red-400'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/50 flex flex-col gap-0.5">
                          {order.order_items?.map((item, idx) => (
                            <span key={idx} className="truncate">
                              {item.quantity}x {item.products?.name}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-white border-t border-white/5 pt-1.5 mt-0.5">
                          <span>Total:</span>
                          <span>R$ {Number(order.total_amount).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="border-t border-white/5"></div>

            {/* Quick Actions Panel */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Controles Rápidos</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={openEditModal}
                  className="flex items-center justify-center gap-1 text-xs font-bold px-3 py-2.5 rounded-xl border border-white/5 hover:border-white/15 bg-slate-900/60 hover:bg-slate-900 text-white/80 hover:text-white transition active:scale-95 cursor-pointer shadow"
                >
                  <Edit className="w-3.5 h-3.5 text-indigo-400" /> Editar
                </button>
                <button
                  onClick={() => toggleAIMutation.mutate({ 
                    id: activeConvId, 
                    is_ai_disabled: !activeCustomer?.metadata?.is_ai_disabled 
                  })}
                  className="flex items-center justify-center gap-1 text-xs font-bold px-3 py-2.5 rounded-xl border border-white/5 hover:border-white/15 bg-slate-900/60 hover:bg-slate-900 text-white/80 hover:text-white transition active:scale-95 cursor-pointer shadow"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" /> IA: {activeCustomer?.metadata?.is_ai_disabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* EDIT CUSTOMER CRM MODAL */}
      {/* ========================================== */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" />
                Editar Dados do Cliente
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Nome Completo</label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-white/10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Telefone Principal</label>
                <input 
                  type="text" 
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-white/10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">WhatsApp Link</label>
                <input 
                  type="text" 
                  value={editForm.whatsapp}
                  onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                  className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-white/10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Tags / Marcadores (separados por vírgula)</label>
                <input 
                  type="text" 
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="Ex: vip, lead, premium"
                  className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/40 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-white/10"
                />
              </div>
              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-white/5">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="glass-btn-secondary py-2.5 px-4 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={updateCustomerMutation.isPending}
                  className="glass-btn-primary py-2.5 px-5 font-bold text-xs"
                >
                  {updateCustomerMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* AI SIMULATION CLIENT MODAL */}
      {/* ========================================== */}
      {simulationModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 max-w-md w-full flex flex-col gap-6 animate-scale-in border border-white/10 relative bg-slate-900">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                <h3 className="text-lg font-bold text-white tracking-wide">Simular Mensagem de Cliente</h3>
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
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Mensagem Enviada pelo Cliente</label>
                <p className="text-[11px] text-white/30">Insira a mensagem como se o cliente estivesse digitando no WhatsApp:</p>
                <textarea
                  required
                  rows="4"
                  value={simulatedQuestion}
                  onChange={(e) => setSimulatedQuestion(e.target.value)}
                  placeholder="Ex: Gostaria de marcar um agendamento para amanhã às 15:00!"
                  className="w-full bg-black/40 border border-white/15 focus:border-indigo-500/40 rounded-xl px-4 py-3 text-white focus:outline-none text-sm transition resize-none placeholder-white/20"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setSimulationModalOpen(false)}
                  className="glass-btn-secondary py-2.5 px-4 font-bold text-xs hover:bg-white/5 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary py-2.5 px-5 font-bold text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-indigo-600/10 shadow-lg"
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
