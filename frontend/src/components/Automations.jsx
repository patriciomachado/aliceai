import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  Plus, 
  Play, 
  GitBranch, 
  ArrowDown, 
  Smartphone, 
  Sparkles, 
  CreditCard,
  Trash2,
  X,
  Send,
  Webhook,
  Tag,
  ToggleLeft,
  ToggleRight,
  Eye,
  ChevronDown
} from 'lucide-react';

const Automations = () => {
  const queryClient = useQueryClient();
  const { showToast, showConfirm } = useApp();
  
  // State for Create/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null); // Currently highlighted flow for flowchart
  
  // Form State
  const [flowName, setFlowName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('messages.incoming');
  const [conditions, setConditions] = useState([]); // Array of { key: '', value: '' }
  const [actionType, setActionType] = useState('send_message');
  const [actionText, setActionText] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [actionTag, setActionTag] = useState('');
  const [isActive, setIsActive] = useState(true);

  // 1. Fetch automations list
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const res = await api.get('/automations');
      const data = res.data || [];
      if (data.length > 0 && !selectedFlow) {
        setSelectedFlow(data[0]); // Default to first flow
      }
      return data;
    }
  });

  // 2. Toggle active state mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const res = await api.put(`/automations/${id}`, { is_active });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      showToast(`Automação "${data.name}" ${data.is_active ? 'ativada' : 'desativada'}.`, 'success');
      if (selectedFlow && selectedFlow.id === data.id) {
        setSelectedFlow(data);
      }
    },
    onError: () => {
      showToast('Erro ao atualizar status da automação.', 'error');
    }
  });

  // 3. Delete automation mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/automations/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      showToast('Automação removida com sucesso.', 'success');
      if (selectedFlow && selectedFlow.id === id) {
        setSelectedFlow(null);
      }
    },
    onError: () => {
      showToast('Erro ao excluir automação.', 'error');
    }
  });

  // 4. Create automation mutation
  const createMutation = useMutation({
    mutationFn: async (newFlow) => {
      const res = await api.post('/automations', newFlow);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      showToast(`Automação "${data.name}" criada com sucesso!`, 'success');
      setSelectedFlow(data);
      closeBuilderModal();
    },
    onError: (err) => {
      console.error(err);
      showToast('Erro ao criar fluxo de automação.', 'error');
    }
  });

  // Helpers
  const openBuilderModal = () => {
    setFlowName('');
    setTriggerEvent('messages.incoming');
    setConditions([{ key: '', value: '' }]);
    setActionType('send_message');
    setActionText('');
    setActionUrl('');
    setActionTag('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const closeBuilderModal = () => {
    setIsModalOpen(false);
  };

  const handleAddCondition = () => {
    setConditions([...conditions, { key: '', value: '' }]);
  };

  const handleRemoveCondition = (index) => {
    const updated = conditions.filter((_, i) => i !== index);
    setConditions(updated);
  };

  const handleConditionChange = (index, field, val) => {
    const updated = [...conditions];
    updated[index][field] = val;
    setConditions(updated);
  };

  const handleSaveAutomation = (e) => {
    e.preventDefault();
    if (!flowName.trim()) {
      showToast('Por favor, informe o nome da automação.', 'warning');
      return;
    }

    // Process conditions array back to JSON object
    const conditionsObj = {};
    conditions.forEach(cond => {
      if (cond.key.trim() && cond.value.trim()) {
        conditionsObj[cond.key.trim()] = cond.value.trim();
      }
    });

    // Compile action payload
    const actionPayload = { type: actionType, params: {} };
    if (actionType === 'send_message') {
      if (!actionText.trim()) {
        showToast('Insira a mensagem do WhatsApp a ser enviada.', 'warning');
        return;
      }
      actionPayload.params.text = actionText.trim();
    } else if (actionType === 'trigger_webhook') {
      if (!actionUrl.trim() || !actionUrl.startsWith('http')) {
        showToast('Insira uma URL de Webhook válida (iniciando com http/https).', 'warning');
        return;
      }
      actionPayload.params.url = actionUrl.trim();
    } else if (actionType === 'add_customer_tag') {
      if (!actionTag.trim()) {
        showToast('Por favor, defina o nome da Tag.', 'warning');
        return;
      }
      actionPayload.params.tag = actionTag.trim();
    }

    const payload = {
      name: flowName.trim(),
      trigger_event: triggerEvent,
      conditions: conditionsObj,
      actions: [actionPayload],
      is_active: isActive
    };

    createMutation.mutate(payload);
  };

  // Helper labels translation
  const translateTrigger = (evt) => {
    switch (evt) {
      case 'messages.incoming':
      case 'new_message':
        return 'Nova Mensagem WhatsApp';
      case 'order_created':
      case 'orders.created':
        return 'Novo Pedido Criado';
      case 'appointment_booked':
      case 'appointments.created':
        return 'Novo Agendamento Confirmado';
      case 'orders.completed':
      case 'order_completed':
        return 'Pagamento Concluído';
      default:
        return evt;
    }
  };

  const getActionIcon = (type) => {
    switch (type) {
      case 'send_message':
      case 'send_whatsapp_message':
        return <Send className="w-4 h-4 text-indigo-400" />;
      case 'trigger_webhook':
        return <Webhook className="w-4 h-4 text-emerald-400" />;
      case 'add_customer_tag':
        return <Tag className="w-4 h-4 text-purple-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getTriggerIcon = (evt) => {
    switch (evt) {
      case 'messages.incoming':
      case 'new_message':
        return <Smartphone className="w-4 h-4 text-indigo-400" />;
      case 'order_created':
      case 'orders.created':
      case 'orders.completed':
      case 'order_completed':
        return <CreditCard className="w-4 h-4 text-indigo-400" />;
      default:
        return <Play className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full shrink-0">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Fluxos de Automação</h1>
          <p className="text-white/60 text-sm font-medium">Projete gatilhos, regras e webhooks para automatizar fluxos de atendimento e CRM autonomamente.</p>
        </div>
        <button
          onClick={openBuilderModal}
          className="glass-btn-primary flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" /> Novo Fluxo
        </button>
      </div>

      {/* Visual Canvas Layout representations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left Side: Flows list */}
        <div className="flex flex-col gap-6">
          <span className="text-lg font-bold text-white tracking-wide">Fluxos Configurados</span>
          
          {isLoading ? (
            <div className="glass-panel p-16 text-center text-sm text-white/40 flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400"></div>
              <span>Carregando automações...</span>
            </div>
          ) : automations.length === 0 ? (
            <div className="glass-panel p-16 text-center text-sm text-white/40 flex flex-col items-center gap-2 border-dashed">
              <GitBranch className="w-8 h-8 text-white/20 mb-2" />
              <span>Nenhuma automação cadastrada no momento</span>
              <button 
                onClick={openBuilderModal}
                className="mt-4 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition"
              >
                Criar minha primeira automação &rarr;
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {automations.map((aut) => {
                const isSelected = selectedFlow && selectedFlow.id === aut.id;
                return (
                  <div 
                    key={aut.id} 
                    onClick={() => setSelectedFlow(aut)}
                    className={`glass-panel p-6 flex flex-col gap-4 glow-card cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
                      isSelected ? 'border-indigo-500/40 bg-indigo-500/5 shadow-indigo-500/5 shadow-md scale-[1.01]' : 'hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-white/60'}`}>
                          <GitBranch className="w-4 h-4" />
                        </div>
                        <span className="text-base font-bold text-white">{aut.name}</span>
                      </div>
                      
                      {/* Controls */}
                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleMutation.mutate({ id: aut.id, is_active: !aut.is_active })}
                          className="text-white/60 hover:text-white transition duration-200"
                          title={aut.is_active ? 'Desativar Fluxo' : 'Ativar Fluxo'}
                        >
                          {aut.is_active ? (
                            <ToggleRight className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-white/20" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            showConfirm(
                              'Confirmar Remoção',
                              `Deseja realmente remover a automação "${aut.name}"?`,
                              () => deleteMutation.mutate(aut.id)
                            );
                          }}
                          className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition duration-200"
                          title="Excluir fluxo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/60 border-t border-white/5 pt-3">
                      <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-full px-2.5 py-0.5 font-semibold">
                        Gatilho: {translateTrigger(aut.trigger_event)}
                      </span>
                      {aut.conditions && Object.keys(aut.conditions).length > 0 && (
                        <span className="bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full px-2.5 py-0.5 font-semibold">
                          {Object.keys(aut.conditions).length} Regras
                        </span>
                      )}
                      <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-full px-2.5 py-0.5 font-semibold">
                        {Array.isArray(aut.actions) ? aut.actions.length : 1} Ações
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Flowchart visual canvas */}
        <div className="glass-panel p-6 flex flex-col gap-6 sticky top-8">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white tracking-wide">Visualizador do Fluxo</span>
              <span className="text-xs text-white/50">Estrutura de execução da inteligência artificial.</span>
            </div>
            {selectedFlow && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                selectedFlow.is_active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-white/10 text-white/40'
              }`}>
                {selectedFlow.is_active ? 'ATIVO' : 'INATIVO'}
              </span>
            )}
          </div>

          {!selectedFlow ? (
            <div className="flex flex-col items-center justify-center p-20 text-center text-xs text-white/30 border border-dashed border-white/5 rounded-2xl">
              <Eye className="w-6 h-6 mb-2 text-white/10 animate-pulse" />
              <span>Selecione uma automação na lista para visualizar o fluxograma detalhado</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8 bg-black/40 rounded-2xl border border-white/5 relative overflow-hidden transition-all duration-300">
              
              {/* Node 1: Trigger */}
              <div className="glass-panel p-4 max-w-sm w-[90%] border-l-4 border-indigo-500 flex items-center gap-3 bg-white/5 shadow-md transition transform duration-300 hover:scale-[1.02]">
                <div className="p-2.5 bg-indigo-500/15 rounded-lg text-indigo-400">{getTriggerIcon(selectedFlow.trigger_event)}</div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold text-indigo-400 tracking-wider">GATILHO DE EVENTO</span>
                  <span className="text-xs font-bold text-white">{translateTrigger(selectedFlow.trigger_event)}</span>
                  <span className="text-[9px] text-white/40 font-mono mt-0.5">{selectedFlow.trigger_event}</span>
                </div>
              </div>

              <ArrowDown className="w-5 h-5 text-white/20 animate-bounce" />

              {/* Node 2: Conditions */}
              <div className="glass-panel p-4 max-w-sm w-[90%] border-l-4 border-purple-500 flex items-center gap-3 bg-white/5 shadow-md transition transform duration-300 hover:scale-[1.02]">
                <div className="p-2.5 bg-purple-500/15 rounded-lg text-purple-400"><GitBranch className="w-4 h-4" /></div>
                <div className="flex flex-col w-full">
                  <span className="text-[10px] font-extrabold text-purple-400 tracking-wider">CONDIÇÃO / REGRAS</span>
                  {selectedFlow.conditions && Object.keys(selectedFlow.conditions).length > 0 ? (
                    <div className="flex flex-col gap-1.5 mt-1">
                      {Object.entries(selectedFlow.conditions).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-1.5 text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/5 font-medium">
                          <span className="text-white/40">{k}</span>
                          <span className="text-purple-300">&bull;&bull;&bull;</span>
                          <span className="text-white/80">"{v}"</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-white/60 italic font-medium">Sempre disparar (Sem condições extras)</span>
                  )}
                </div>
              </div>

              <ArrowDown className="w-5 h-5 text-white/20 animate-bounce" />

              {/* Node 3+: Actions */}
              {(() => {
                const actions = Array.isArray(selectedFlow.actions) ? selectedFlow.actions : [selectedFlow.actions];
                return actions.map((act, index) => {
                  let subtitle = '';
                  let badge = '';

                  if (act.type === 'send_message' || act.type === 'send_whatsapp_message') {
                    subtitle = act.params?.text || '';
                    badge = 'Enviar WhatsApp';
                  } else if (act.type === 'trigger_webhook') {
                    subtitle = act.params?.url || '';
                    badge = 'POST Webhook';
                  } else if (act.type === 'add_customer_tag') {
                    subtitle = `Tag: "${act.params?.tag || ''}"`;
                    badge = 'Adicionar Tag';
                  }

                  return (
                    <React.Fragment key={index}>
                      {index > 0 && <ArrowDown className="w-5 h-5 text-white/20" />}
                      <div className="glass-panel p-4 max-w-sm w-[90%] border-l-4 border-emerald-500 flex items-center gap-3 bg-white/5 shadow-md transition transform duration-300 hover:scale-[1.02]">
                        <div className="p-2.5 bg-emerald-500/15 rounded-lg text-emerald-400">
                          {getActionIcon(act.type)}
                        </div>
                        <div className="flex flex-col w-[80%]">
                          <span className="text-[10px] font-extrabold text-emerald-400 tracking-wider">AÇÃO ({badge.toUpperCase()})</span>
                          <span className="text-xs font-semibold text-white/90 truncate mt-0.5" title={subtitle}>
                            {subtitle}
                          </span>
                          <span className="text-[9px] text-white/40 font-mono mt-0.5">{act.type}</span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                });
              })()}

            </div>
          )}
        </div>

      </div>

      {/* visual builder modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 flex flex-col gap-6 shadow-2xl border border-white/10 relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                <h3 className="text-xl font-bold text-white tracking-wide">Novo Fluxo de Automação</h3>
              </div>
              <button 
                onClick={closeBuilderModal}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAutomation} className="flex flex-col gap-6">
              
              {/* Name */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Nome da Automação</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Agradecimento pós-compra"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition"
                />
              </div>

              {/* Trigger */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Gatilho (Quando isso acontecer)</label>
                <div className="relative">
                  <select
                    value={triggerEvent}
                    onChange={(e) => setTriggerEvent(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition cursor-pointer appearance-none animate-none"
                  >
                    <option value="messages.incoming" className="bg-[#090a0f] text-white">Mensagem WhatsApp Recebida</option>
                    <option value="order_created" className="bg-[#090a0f] text-white">Pedido Criado</option>
                    <option value="orders.completed" className="bg-[#090a0f] text-white">Pagamento do Pedido Concluído</option>
                    <option value="appointment_booked" className="bg-[#090a0f] text-white">Agendamento Realizado</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Rules / Conditions */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Condições / Regras (Opcional)</label>
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Regra
                  </button>
                </div>

                <div className="flex flex-col gap-2.5">
                  {conditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-3 animate-slide-in">
                      <div className="relative">
                        <select
                          value={cond.key}
                          onChange={(e) => handleConditionChange(idx, 'key', e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-xl pl-3 pr-8 py-2 text-white focus:outline-none focus:border-indigo-500/50 text-xs font-medium cursor-pointer appearance-none animate-none"
                        >
                          <option value="" className="bg-[#090a0f] text-white">-- Selecione o Campo --</option>
                          <option value="channel" className="bg-[#090a0f] text-white">Canal (whatsapp / instagram)</option>
                          <option value="intent" className="bg-[#090a0f] text-white">Intenção da Mensagem (ex: scheduling, buying)</option>
                          <option value="payment_method" className="bg-[#090a0f] text-white">Método de Pagamento (ex: pix, credit_card)</option>
                          <option value="payment_status" className="bg-[#090a0f] text-white">Status do Pagamento (ex: completed, pending)</option>
                          <option value="service_type" className="bg-[#090a0f] text-white">Tipo de Serviço Agendado</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      <span className="text-white/30 text-xs">&rarr;</span>

                      <input
                        type="text"
                        placeholder="Ex: whatsapp, completed"
                        value={cond.value}
                        onChange={(e) => handleConditionChange(idx, 'value', e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50 text-xs font-medium transition"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(idx)}
                        className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4 border-t border-white/5 pt-4">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Ação (Executar esta tarefa)</label>
                
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setActionType('send_message')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition duration-300 ${
                      actionType === 'send_message' 
                        ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType('trigger_webhook')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition duration-300 ${
                      actionType === 'trigger_webhook' 
                        ? 'border-emerald-500 bg-emerald-500/10 text-white' 
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                    }`}
                  >
                    <Webhook className="w-4 h-4" />
                    <span>Outbound Webhook</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType('add_customer_tag')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition duration-300 ${
                      actionType === 'add_customer_tag' 
                        ? 'border-purple-500 bg-purple-500/10 text-white' 
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    <span>Adicionar Tag CRM</span>
                  </button>
                </div>

                {/* Sub-inputs dependent on action selection */}
                <div className="mt-2 animate-slide-in">
                  {actionType === 'send_message' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-white/50">Modelo da Mensagem</label>
                      <textarea
                        required
                        rows="3"
                        placeholder="Ex: Olá {{customer_name}}, recebemos seu pedido de R$ {{total_amount}}!"
                        value={actionText}
                        onChange={(e) => setActionText(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition resize-none"
                      />
                      <span className="text-[10px] text-white/40">
                        Use tags como <code className="text-indigo-300 font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded">&#123;&#123;customer_name&#125;&#125;</code>, <code className="text-indigo-300 font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded">&#123;&#123;total_amount&#125;&#125;</code>, <code className="text-indigo-300 font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded">&#123;&#123;scheduled_date&#125;&#125;</code>, <code className="text-indigo-300 font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded">&#123;&#123;scheduled_time&#125;&#125;</code>.
                      </span>
                    </div>
                  )}

                  {actionType === 'trigger_webhook' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-white/50">Destino do Webhook (URL POST)</label>
                      <input
                        type="url"
                        required
                        placeholder="Ex: https://api.exemplo.com/webhook"
                        value={actionUrl}
                        onChange={(e) => setActionUrl(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition"
                      />
                    </div>
                  )}

                  {actionType === 'add_customer_tag' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-white/50">Tag a ser Adicionada no CRM</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: vip, lead_interessado"
                        value={actionTag}
                        onChange={(e) => setActionTag(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <span className="text-xs font-bold text-white/60 uppercase">Habilitar Fluxo Imediatamente</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-6 rounded-full p-0.5 cursor-pointer transition-all duration-300 ${
                    isActive ? 'bg-indigo-600' : 'bg-white/10'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-all duration-300 ${isActive ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 mt-4 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={closeBuilderModal}
                  className="glass-btn-secondary py-2.5 px-5 font-bold hover:bg-white/5 transition active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isLoading}
                  className="glass-btn-primary py-2.5 px-6 font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-indigo-600/10 shadow-lg disabled:opacity-50"
                >
                  {createMutation.isLoading ? 'Salvando...' : 'Salvar Fluxo'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Automations;
