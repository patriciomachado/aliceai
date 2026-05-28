import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  ShoppingCart, 
  CreditCard, 
  ExternalLink,
  DollarSign,
  Calendar,
  Plus,
  Package,
  User,
  Hash,
  Edit3,
  Trash2,
  X,
  Store,
  ChevronRight,
  Sparkles,
  Info,
  FileText,
  Clock,
  ChevronDown,
  LayoutGrid,
  List,
  Trello,
  Printer,
  Volume2,
  VolumeX,
  Tv,
  TrendingUp,
  AlertCircle,
  Play,
  CheckCircle,
  Truck,
  RotateCcw
} from 'lucide-react';

const Orders = ({ standalone = false }) => {
  const queryClient = useQueryClient();
  const { showToast, workspaceSettings, setWorkspaceSettings, showConfirm } = useApp();
  
  // Dashboard niche context dynamically read from settings
  const activeNiche = workspaceSettings?.niche || 'retail';
  
  // View mode switcher state ('list' | 'grid' | 'kanban')
  const [viewMode, setViewMode] = useState(() => {
    if (standalone) return 'kanban';
    try {
      return localStorage.getItem('orders_view_mode') || 'list';
    } catch {
      return 'list';
    }
  });

  useEffect(() => {
    if (!standalone) {
      try {
        localStorage.setItem('orders_view_mode', viewMode);
      } catch (e) {
        console.error(e);
      }
    }
  }, [viewMode, standalone]);
  
  // Audio chime state
  const [audioMuted, setAudioMuted] = useState(() => {
    try {
      return localStorage.getItem('orders_audio_muted') === 'true';
    } catch {
      return false;
    }
  });

  // Modal, Drawer & Receipt states
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null); // Side Drawer
  const [editingOrder, setEditingOrder] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null); // Thermal Bobbin print popup
  
  // Creation Cart Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [cartItems, setCartItems] = useState([
    { product_id: '', quantity: 1, weightVal: 1, weightUnit: 'kg', cutType: 'Bife Fino', toppings: [], notes: '' }
  ]);

  // Editing Form States
  const [orderStatus, setOrderStatus] = useState('pending');
  const [paymentStatus, setPaymentStatus] = useState('pending');

  // Cache to track previous order IDs to trigger chime on new orders
  const previousOrderIdsRef = useRef(new Set());

  // 1. Fetch orders list
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
    refetchInterval: 3000, // Fast polling for real-time order dashboard experience
    refetchIntervalInBackground: true
  });

  // 2. Fetch customers list
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data;
    }
  });

  // 3. Fetch products list
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data;
    }
  });

  // Audio mute persistence
  useEffect(() => {
    localStorage.setItem('orders_audio_muted', audioMuted ? 'true' : 'false');
  }, [audioMuted]);

  // Web Audio API chime synthesis for immediate native sound effects
  const playIncomingOrderChime = () => {
    if (audioMuted) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // Node synth
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Warm retro notification chords (Arpeggio style)
      const now = ctx.currentTime;
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc1.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc1.frequency.setValueAtTime(1046.50, now + 0.24); // C6

      osc2.frequency.setValueAtTime(261.63, now); // C4
      osc2.frequency.setValueAtTime(329.63, now + 0.08); // E4
      osc2.frequency.setValueAtTime(392.00, now + 0.16); // G4

      osc1.type = 'triangle';
      osc2.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);
    } catch (err) {
      console.warn('[Web Audio API] Muted or blocked from auto-play:', err);
    }
  };

  // Trigger chime on new order addition
  useEffect(() => {
    if (orders.length > 0) {
      const currentIds = new Set(orders.map(o => o.id));
      
      // Determine if there are any new pending orders that we haven't seen yet JID
      const hasNewPending = orders.some(o => 
        o.status === 'pending' && 
        previousOrderIdsRef.current.size > 0 && 
        !previousOrderIdsRef.current.has(o.id)
      );

      if (hasNewPending) {
        console.log('[Orders Dashboard] New order detected! Playing alert chime.');
        playIncomingOrderChime();
        showToast('🔔 Novo pedido recebido via WhatsApp/Canal!', 'success');
      }

      // Update ref
      previousOrderIdsRef.current = currentIds;
    }
  }, [orders]);

  // 4. Create manual order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/orders', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      // Save custom metadata locally
      try {
        const metadataKey = `order_meta_${data.order?.id || data.id}`;
        const metaObj = {
          niche: activeNiche,
          items: cartItems.map(item => {
            const prod = products.find(p => p.id === item.product_id);
            return {
              product_name: prod ? prod.name : 'Produto',
              quantity: item.quantity,
              weightVal: item.weightVal,
              weightUnit: item.weightUnit,
              cutType: item.cutType,
              toppings: item.toppings,
              notes: item.notes
            };
          })
        };
        localStorage.setItem(metadataKey, JSON.stringify(metaObj));
      } catch (err) {
        console.error('Error saving local order metadata:', err);
      }

      setModalOpen(false);
      resetCartForm();
      showToast('Pedido cadastrado e checkout gerado com sucesso! 🎉', 'success');
      
      const payUrl = data?.paymentUrl || 'https://checkout.stripe.com/pay/mock_session';
      window.open(payUrl, '_blank');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Erro ao registrar pedido.', 'error');
    }
  });

  // 5. Update order status mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, status, payment_status }) => {
      const res = await api.put(`/orders/${id}/status`, { status, payment_status });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setEditModalOpen(false);
      setEditingOrder(null);
      if (selectedOrder && selectedOrder.id === data.id) {
        setSelectedOrder({ ...data, order_items: selectedOrder.order_items });
      }
      showToast('Pedido atualizado com sucesso! 🎉', 'success');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Erro ao atualizar pedido.', 'error');
    }
  });

  const isOrdersPaused = workspaceSettings?.orders_paused === true;

  const togglePauseMutation = useMutation({
    mutationFn: async () => {
      const updatedSettings = {
        ...workspaceSettings,
        orders_paused: !isOrdersPaused
      };
      const res = await api.put('/auth/workspace', { settings: updatedSettings });
      return res.data;
    },
    onSuccess: (data) => {
      setWorkspaceSettings(data.settings || {});
      showToast(
        !isOrdersPaused 
          ? '🚨 Pedidos PAUSADOS para casos de emergência!' 
          : '✅ Pedidos RETOMADOS com sucesso!',
        !isOrdersPaused ? 'warning' : 'success'
      );
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Erro ao alterar estado de pausa de emergência.', 'error');
    }
  });

  // 5.1. Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/orders/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setSelectedOrder(null);
      showToast('Pedido excluído com sucesso! 🗑️', 'success');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Erro ao excluir pedido.', 'error');
    }
  });

  const handleDeleteOrder = (id) => {
    showConfirm(
      'Confirmar Exclusão',
      'Tem certeza de que deseja excluir permanentemente este pedido?',
      () => deleteOrderMutation.mutate(id)
    );
  };

  const resetCartForm = () => {
    setSelectedCustomerId('');
    setPaymentMethod('credit_card');
    setCartItems([{ product_id: '', quantity: 1, weightVal: 1, weightUnit: 'kg', cutType: 'Bife Fino', toppings: [], notes: '' }]);
  };

  const handleOpenEdit = (order) => {
    setEditingOrder(order);
    setOrderStatus(order.status || 'pending');
    setPaymentStatus(order.payment_status || 'pending');
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingOrder(null);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingOrder) return;
    
    updateOrderMutation.mutate({
      id: editingOrder.id,
      status: orderStatus,
      payment_status: paymentStatus
    });
  };

  // Quick progression transitions
  const handleProgressStatus = (order, targetStatus) => {
    updateOrderMutation.mutate({
      id: order.id,
      status: targetStatus
    });
  };

  // Cart operations
  const addCartRow = () => {
    setCartItems([...cartItems, { product_id: '', quantity: 1, weightVal: 1, weightUnit: 'kg', cutType: 'Bife Fino', toppings: [], notes: '' }]);
  };

  const removeCartRow = (index) => {
    if (cartItems.length === 1) return;
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const updateCartItem = (index, field, val) => {
    const updated = [...cartItems];
    updated[index][field] = val;
    setCartItems(updated);
  };

  const handleToggleTopping = (index, topping) => {
    const updated = [...cartItems];
    const currentToppings = updated[index].toppings || [];
    if (currentToppings.includes(topping)) {
      updated[index].toppings = currentToppings.filter(t => t !== topping);
    } else {
      updated[index].toppings = [...currentToppings, topping];
    }
    setCartItems(updated);
  };

  // Calculate live item price
  const calculateItemSubtotal = (item) => {
    if (!item.product_id) return 0;
    const prod = products.find(p => p.id === item.product_id);
    if (!prod) return 0;

    let basePrice = Number(prod.price);
    
    if (activeNiche === 'butcher') {
      const weightFactor = item.weightUnit === 'kg' ? Number(item.weightVal) : Number(item.weightVal) * 0.001;
      return basePrice * weightFactor;
    } else if (activeNiche === 'restaurant') {
      let toppingsCost = 0;
      if (item.toppings?.includes('Bacon')) toppingsCost += 3.00;
      if (item.toppings?.includes('Queijo Extra')) toppingsCost += 2.50;
      if (item.toppings?.includes('Ovo Frito')) toppingsCost += 1.50;
      return (basePrice + toppingsCost) * parseInt(item.quantity || 1, 10);
    } else {
      return basePrice * parseInt(item.quantity || 1, 10);
    }
  };

  const calculateOrderTotal = () => {
    return cartItems.reduce((acc, item) => acc + calculateItemSubtotal(item), 0);
  };

  // Submit cart order manually
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      showToast('Por favor, selecione o cliente.', 'warning');
      return;
    }

    const invalidItem = cartItems.find(i => !i.product_id);
    if (invalidItem) {
      showToast('Selecione todos os produtos adicionados.', 'warning');
      return;
    }

    const itemsPayload = cartItems.map(item => {
      let finalQty = activeNiche === 'butcher'
        ? (item.weightUnit === 'kg' ? Number(item.weightVal) : Number(item.weightVal) * 0.001)
        : (parseInt(item.quantity, 10) || 1);

      return {
        product_id: item.product_id,
        quantity: finalQty,
        metadata: {
          cut_type: activeNiche === 'butcher' ? item.cutType : null,
          toppings: activeNiche === 'restaurant' ? item.toppings : [],
          notes: item.notes || null
        }
      };
    });

    createOrderMutation.mutate({
      customer_id: selectedCustomerId,
      items: itemsPayload,
      payment_method: paymentMethod
    });
  };

  // Retrieve metadata for preview drawer and receipts
  const getOrderMetadata = (orderId) => {
    const order = orders.find(o => o.id === orderId) || selectedOrder;
    if (order && order.id === orderId && order.order_items && order.order_items.length > 0) {
      return {
        niche: activeNiche,
        items: order.order_items.map(item => {
          const isButcher = activeNiche === 'butcher';
          const weightVal = isButcher ? Number(item.quantity) : 1;
          const weightUnit = isButcher ? 'kg' : 'un';
          return {
            product_name: item.products?.name || 'Produto Personalizado',
            quantity: item.quantity,
            weightVal,
            weightUnit,
            cutType: item.metadata?.cut_type || (isButcher ? 'Corte Padrão' : ''),
            toppings: item.metadata?.toppings || [],
            notes: item.metadata?.notes || ''
          };
        })
      };
    }

    try {
      const localMeta = localStorage.getItem(`order_meta_${orderId}`);
      if (localMeta) return JSON.parse(localMeta);
    } catch {}

    return {
      niche: activeNiche,
      items: [
        {
          product_name: 'Produto Personalizado',
          quantity: 1,
          weightVal: 1.0,
          weightUnit: 'kg',
          cutType: 'Corte Padrão',
          toppings: [],
          notes: 'Nenhum detalhe adicional'
        }
      ]
    };
  };

  // Metric summaries calculations
  const totalFaturamento = orders
    .filter(o => o.status !== 'cancelled' && o.payment_status === 'completed')
    .reduce((acc, o) => acc + Number(o.total_amount || 0), 0);

  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const activePreparationCount = orders.filter(o => o.status === 'confirmed').length;

  const ticketMedio = orders.length > 0
    ? orders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0) / orders.length
    : 0;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed': return <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full px-2.5 py-0.5 font-black uppercase tracking-wider">Confirmado</span>;
      case 'shipped': return <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/25 rounded-full px-2.5 py-0.5 font-black uppercase tracking-wider">Despachado</span>;
      case 'cancelled': return <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/25 rounded-full px-2.5 py-0.5 font-black uppercase tracking-wider">Cancelado</span>;
      default: return <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded-full px-2.5 py-0.5 font-black uppercase tracking-wider animate-pulse">Pendente</span>;
    }
  };

  const getPaymentBadge = (status) => {
    switch (status) {
      case 'completed': return <span className="text-[11px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded uppercase tracking-wider">PAGO</span>;
      case 'failed': return <span className="text-[11px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded uppercase tracking-wider">FALHOU</span>;
      default: return <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded uppercase tracking-wider animate-pulse">AGUARDANDO</span>;
    }
  };

  const getPaymentMethodBadge = (method) => {
    const normMethod = (method || 'pix').toLowerCase();
    
    let label = 'Pix';
    let icon = <Hash className="w-3 h-3 text-emerald-400" />;
    let colorClass = 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400';

    if (normMethod === 'credit_card' || normMethod === 'card' || normMethod === 'credit') {
      label = 'Crédito';
      icon = <CreditCard className="w-3 h-3 text-indigo-400" />;
      colorClass = 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400';
    } else if (normMethod === 'debit_card' || normMethod === 'debit') {
      label = 'Débito';
      icon = <CreditCard className="w-3 h-3 text-sky-400" />;
      colorClass = 'bg-sky-500/10 border-sky-500/25 text-sky-400';
    } else if (normMethod === 'dinheiro' || normMethod === 'cash') {
      label = 'Dinheiro';
      icon = <DollarSign className="w-3 h-3 text-amber-400" />;
      colorClass = 'bg-amber-500/10 border-amber-500/25 text-amber-400';
    } else if (normMethod === 'boleto') {
      label = 'Boleto';
      icon = <FileText className="w-3 h-3 text-cyan-400" />;
      colorClass = 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400';
    } else {
      label = normMethod === 'whatsapp_pay' ? 'WhatsApp' : 'Pix';
      icon = <DollarSign className="w-3 h-3 text-emerald-400" />;
      colorClass = 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-extrabold uppercase tracking-wider shrink-0 ${colorClass}`}>
        {icon}
        {label}
      </span>
    );
  };

  // Custom browser thermal printer trigger
  const handlePrintReceipt = (order) => {
    setReceiptOrder(order);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className={`flex flex-col gap-6 w-full shrink-0 ${standalone ? 'min-h-screen bg-[#07080b] p-6 text-white' : ''}`}>
      
      {/* Dynamic printer receipt CSS injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-print-area, #thermal-receipt-print-area * {
            visibility: visible !important;
          }
          #thermal-receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 5mm !important;
            background: white !important;
            color: black !important;
            font-family: 'Courier New', Courier, monospace !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}} />

      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          {standalone && (
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0 animate-pulse shadow-lg shadow-indigo-600/30">
              <Tv className="w-5 h-5" />
            </div>
          )}
          <div className="flex flex-col">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              {standalone ? 'Monitor de Despacho' : 'Gestão de Pedidos'}
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-extrabold uppercase border border-indigo-500/30 px-2 py-0.5 rounded-full">
                {activeNiche === 'butcher' ? 'Açougue' : activeNiche === 'restaurant' ? 'Lanchonete' : activeNiche === 'gym' ? 'Academia' : activeNiche === 'tech_repair' ? 'Assistência' : 'Varejo'}
              </span>
            </h1>
            <p className="text-white/60 text-xs sm:text-sm font-medium mt-0.5">
              {standalone ? 'Painel de Cozinha em tela cheia com progresso reativo e alertas de áudio.' : 'Monitore checkouts Stripe, via WhatsApp e integre faturamento em tempo real.'}
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          
          {/* Sound control bell */}
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-center ${
              audioMuted 
                ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' 
                : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title={audioMuted ? 'Ativar Som de Novos Pedidos' : 'Silenciar Novos Pedidos'}
          >
            {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {!standalone && (
            <button
              onClick={() => window.open('/orders-only', '_blank')}
              className="p-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl transition flex items-center gap-1.5 text-xs font-black cursor-pointer shadow-sm"
              title="Abrir em Tela Cheia para a Cozinha"
            >
              <Tv className="w-4 h-4" /> Monitor de Cozinha
            </button>
          )}

          <button
            onClick={() => {
              showConfirm(
                isOrdersPaused ? 'Retomar Pedidos?' : '🚨 PAUSAR PEDIDOS?',
                isOrdersPaused 
                  ? 'Deseja retomar o recebimento de pedidos no sistema? A Alice voltará a aceitar e processar novos pedidos normalmente.' 
                  : 'Atenção! Deseja pausar o recebimento de pedidos? A Alice continuará salvando os novos pedidos, mas informará aos clientes que o sistema está temporariamente suspenso para manutenção/emergência.',
                () => togglePauseMutation.mutate()
              );
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border font-bold text-xs hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-md ${
              isOrdersPaused 
                ? 'bg-red-500/20 border-red-500/40 text-red-300 shadow-red-500/10 hover:bg-red-500/30' 
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
            }`}
            title={isOrdersPaused ? 'Retomar Recebimento de Pedidos' : 'Pausar Recebimento de Pedidos'}
          >
            <AlertCircle className={`w-4 h-4 ${isOrdersPaused ? 'animate-bounce text-red-400' : ''}`} />
            {isOrdersPaused ? 'Retomar Pedidos' : 'Pausar Pedidos'}
          </button>

          <button
            onClick={() => setModalOpen(true)}
            id="btn-new-order"
            className="glass-btn-primary flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all text-xs py-2.5 px-4 font-bold shadow-lg shadow-indigo-600/15"
          >
            <Plus className="w-4 h-4" /> Novo Pedido
          </button>
        </div>
      </div>

      {/* KPI Summarized Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        
        {/* KPI: Earnings */}
        <div className="glass-panel p-4 flex items-center justify-between border border-white/5 shadow-md relative overflow-hidden group">
          <div className="flex flex-col gap-1 z-10">
            <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-wider">Faturamento (Pago)</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">R$ {totalFaturamento.toFixed(2)}</span>
          </div>
          <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-150 transition duration-500"></div>
        </div>

        {/* KPI: Pending */}
        <div className="glass-panel p-4 flex items-center justify-between border border-white/5 shadow-md relative overflow-hidden group">
          <div className="flex flex-col gap-1 z-10">
            <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-wider">Pedidos Pendentes</span>
            <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight flex items-center gap-1.5">
              {pendingOrdersCount}
              {pendingOrdersCount > 0 && <span className="h-2 w-2 bg-amber-400 rounded-full animate-ping"></span>}
            </span>
          </div>
          <div className="h-10 w-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-amber-500/5 rounded-full blur-xl group-hover:scale-150 transition duration-500"></div>
        </div>

        {/* KPI: Preparation */}
        <div className="glass-panel p-4 flex items-center justify-between border border-white/5 shadow-md relative overflow-hidden group">
          <div className="flex flex-col gap-1 z-10">
            <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-wider">Em Preparação</span>
            <span className="text-xl sm:text-2xl font-black text-indigo-400 font-mono tracking-tight">{activePreparationCount}</span>
          </div>
          <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <Clock className="w-5 h-5" />
          </div>
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl group-hover:scale-150 transition duration-500"></div>
        </div>

        {/* KPI: Ticket */}
        <div className="glass-panel p-4 flex items-center justify-between border border-white/5 shadow-md relative overflow-hidden group">
          <div className="flex flex-col gap-1 z-10">
            <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-wider">Ticket Médio</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">R$ {ticketMedio.toFixed(2)}</span>
          </div>
          <div className="h-10 w-10 bg-white/5 text-white/60 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition duration-500"></div>
        </div>

      </div>

      {/* Emergency Paused Alert Banner */}
      {isOrdersPaused && (
        <div className="w-full glass-panel bg-red-950/40 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between gap-4 text-red-200 animate-pulse shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400 shrink-0">
              <AlertCircle className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-red-300 flex items-center gap-1.5">
                🚨 Recebimento de Pedidos Pausado
              </span>
              <span className="text-[11px] sm:text-xs text-red-300/80 leading-relaxed font-medium">
                O sistema de pedidos está em modo de emergência. A Alice continuará cadastrando pedidos no banco de dados, mas informará amigavelmente aos clientes que o atendimento está suspenso.
              </span>
            </div>
          </div>
          <button
            onClick={() => togglePauseMutation.mutate()}
            className="px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 transition-all cursor-pointer active:scale-95 shadow-lg shadow-red-500/10 shrink-0"
          >
            Retomar Recebimento
          </button>
        </div>
      )}

      {/* Main Workspace Board Layout */}
      <div className="flex flex-col xl:flex-row gap-6 items-start relative w-full">
        
        {/* Left container columns */}
        <div className="flex flex-col gap-4 w-full">
          
          {/* View filter panel */}
          <div className="glass-panel w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 border border-white/5 shadow-md">
            <span className="text-sm font-bold text-white tracking-wide uppercase">Registro Operacional</span>
            
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex bg-black/40 border border-white/5 rounded-2xl p-1 select-none font-bold text-xs">
                
                {/* List mode */}
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition duration-200 cursor-pointer ${
                    viewMode === 'list' 
                      ? 'bg-indigo-600 text-white shadow shadow-indigo-600/30' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> Lista
                </button>

                {/* Grid mode */}
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition duration-200 cursor-pointer ${
                    viewMode === 'grid' 
                      ? 'bg-indigo-600 text-white shadow shadow-indigo-600/30' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Grade
                </button>

                {/* Kanban mode */}
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition duration-200 cursor-pointer ${
                    viewMode === 'kanban' 
                      ? 'bg-indigo-600 text-white shadow shadow-indigo-600/30' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Trello className="w-3.5 h-3.5" /> Kanban Board
                </button>
              </div>
            </div>
          </div>

          {/* Render layout conditionally */}
          {isLoading ? (
            <div className="glass-panel p-16 text-center text-sm text-white/40 flex flex-col items-center gap-3 border border-white/5 shadow-md w-full">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-400"></div>
              <span>Carregando dados...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="glass-panel p-16 text-center text-sm text-white/40 flex flex-col items-center gap-2 border border-white/5 shadow-md w-full">
              <ShoppingCart className="w-9 h-9 text-white/20 mb-2 animate-bounce" />
              <span>Nenhum pedido pendente na base</span>
            </div>
          ) : (
            
            // Mode: LIST
            viewMode === 'list' && (
              <div className="glass-panel overflow-x-auto w-full border border-white/5 shadow-md">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] text-white/50 font-extrabold uppercase tracking-wider bg-black/20">
                      <th className="p-4">Pedido ID</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Data</th>
                      <th className="p-4">Itens</th>
                      <th className="p-4">Valor Total</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Faturamento</th>
                      <th className="p-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs font-medium">
                    {orders.map((order) => {
                      const isSelected = selectedOrder && selectedOrder.id === order.id;
                      const meta = getOrderMetadata(order.id);
                      return (
                        <tr 
                          key={order.id} 
                          onClick={() => setSelectedOrder(order)}
                          className={`hover:bg-white/5 transition duration-200 cursor-pointer ${
                            isSelected ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500' : ''
                          }`}
                        >
                          <td className="p-4 font-bold text-white">
                            <span className="flex items-center gap-1.5 font-mono text-[11px]">
                              <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" /> #{order.id.slice(0, 8).toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 text-white/80 font-bold">{order.customers?.name || 'Cliente'}</td>
                          <td className="p-4 text-white/60 font-mono">
                            {new Date(order.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-4 text-white/60">
                            <div className="flex flex-col gap-0.5 max-w-[180px] truncate">
                              {order.order_items?.map((item, idx) => (
                                <span key={idx} className="truncate">
                                  {activeNiche === 'butcher' ? `${Number(item.quantity).toFixed(1)}kg` : `${item.quantity}x`} {item.products?.name}
                                </span>
                              )) || 'Sem itens'}
                            </div>
                          </td>
                          <td className="p-4 font-black text-white text-sm font-mono">R$ {Number(order.total_amount).toFixed(2)}</td>
                          <td className="p-4">{getStatusBadge(order.status)}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {getPaymentBadge(order.payment_status)}
                              {getPaymentMethodBadge(order.payment_method)}
                            </div>
                          </td>
                          <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 justify-center">
                              
                              <button
                                onClick={() => handlePrintReceipt(order)}
                                className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-white/70 transition cursor-pointer"
                                title="Imprimir Recibo Térmico"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleOpenEdit(order)}
                                className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-white/70 transition cursor-pointer"
                                title="Editar Pedido"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              
                              <button 
                                onClick={() => window.open(order.payment_url || 'https://checkout.stripe.com/pay/mock_session', '_blank')}
                                className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-lg transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                title="Faturar Stripe"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteOrder(order.id)}
                                className="p-2 bg-red-600/10 hover:bg-red-600/25 border border-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition cursor-pointer"
                                title="Excluir Pedido"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Mode: GRID */}
          {!isLoading && orders.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full animate-fade-in">
              {orders.map((order) => {
                const isSelected = selectedOrder && selectedOrder.id === order.id;
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`glass-panel p-4 flex flex-col justify-between gap-4 cursor-pointer glow-card border transition duration-300 hover:-translate-y-0.5 relative ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-600/5' 
                        : 'border-white/5 hover:border-white/10 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-white">
                          <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" /> #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 bg-indigo-500/15 rounded-full flex items-center justify-center text-indigo-400 font-black text-xs uppercase shrink-0">
                          {order.customers?.name?.slice(0,2).toUpperCase() || 'CL'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-extrabold text-white text-xs truncate">{order.customers?.name || 'Cliente'}</span>
                          <span className="text-[9px] text-white/40 flex items-center gap-1 font-mono mt-0.5">
                            <Calendar className="w-3 h-3" /> {new Date(order.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 border-y border-white/5 py-2.5 my-0.5">
                        <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto pr-1">
                          {order.order_items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[11px] gap-2">
                              <span className="text-white/70 truncate">{item.products?.name || 'Produto'}</span>
                              <span className="text-indigo-300 font-extrabold font-mono shrink-0">
                                {activeNiche === 'butcher' ? `${Number(item.quantity).toFixed(1)} kg` : `${item.quantity}x`}
                              </span>
                            </div>
                          )) || (
                            <span className="text-xs text-white/30 italic">Sem itens registrados</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-white/40 uppercase font-black tracking-wider">Total</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-black text-white font-mono tracking-tight font-bold">R$ {Number(order.total_amount).toFixed(2)}</span>
                          {getPaymentMethodBadge(order.payment_method)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        
                        <button
                          onClick={() => handlePrintReceipt(order)}
                          className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-white/70 transition cursor-pointer"
                          title="Imprimir"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(order)}
                          className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-white/70 transition cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        
                        <button 
                          onClick={() => window.open(order.payment_url || 'https://checkout.stripe.com/pay/mock_session', '_blank')}
                          className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-lg transition"
                          title="Faturar"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-2 bg-red-600/10 hover:bg-red-600/25 border border-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mode: KANBAN BOARD */}
          {!isLoading && orders.length > 0 && viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full animate-fade-in items-start">
              
              {/* Kanban Column Builder helper */}
              {['pending', 'confirmed', 'shipped', 'cancelled'].map(colStatus => {
                const colOrders = orders.filter(o => o.status === colStatus);
                const colLabels = {
                  pending: { name: 'Pendente', count: colOrders.length, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                  confirmed: { name: 'Preparação', count: colOrders.length, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                  shipped: { name: 'Despachado', count: colOrders.length, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                  cancelled: { name: 'Cancelado', count: colOrders.length, color: 'text-red-400 bg-red-500/10 border-red-500/20' }
                };
                const col = colLabels[colStatus];

                return (
                  <div key={colStatus} className="flex flex-col gap-3.5 bg-black/20 border border-white/5 rounded-2xl p-3 min-h-[500px]">
                    
                    {/* Column header */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          colStatus === 'pending' ? 'bg-amber-400 animate-pulse' :
                          colStatus === 'confirmed' ? 'bg-emerald-400' :
                          colStatus === 'shipped' ? 'bg-blue-400' : 'bg-red-400'
                        }`}></span>
                        <span className="text-xs font-black text-white uppercase tracking-wider">{col.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-white/50 px-2 py-0.5 bg-white/5 rounded-md font-mono">{col.count}</span>
                    </div>

                    {/* Column cards container */}
                    <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] pr-1">
                      {colOrders.length === 0 ? (
                        <span className="text-[10px] italic text-white/20 text-center py-8">Nenhum pedido</span>
                      ) : (
                        colOrders.map(order => {
                          const isSelected = selectedOrder && selectedOrder.id === order.id;
                          return (
                            <div
                              key={order.id}
                              onClick={() => setSelectedOrder(order)}
                              className={`glass-panel p-3.5 flex flex-col gap-3 cursor-pointer border transition duration-200 relative ${
                                isSelected 
                                  ? 'border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-600/5' 
                                  : 'border-white/5 hover:border-white/10 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-white/40">
                                <span>#{order.id.slice(-6).toUpperCase()}</span>
                                <span>{new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>

                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="font-bold text-white text-xs truncate">{order.customers?.name || 'Cliente'}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-bold text-indigo-300 font-mono">R$ {Number(order.total_amount).toFixed(2)}</span>
                                  {getPaymentMethodBadge(order.payment_method)}
                                </div>
                              </div>

                              {/* Items list */}
                              <div className="flex flex-col gap-0.5 text-[10px] text-white/60 border-t border-white/5 pt-2 max-h-[60px] overflow-y-auto">
                                {order.order_items?.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center gap-2">
                                    <span className="truncate">{item.products?.name}</span>
                                    <span className="font-mono font-bold text-indigo-300">
                                      {activeNiche === 'butcher' ? `${Number(item.quantity).toFixed(1)}kg` : `${item.quantity}x`}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Progression actions inside the card */}
                              <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-0.5" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handlePrintReceipt(order)}
                                    className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-white/60 transition cursor-pointer"
                                    title="Imprimir"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEdit(order)}
                                    className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-white/60 transition cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrder(order.id)}
                                    className="p-1.5 bg-red-600/10 hover:bg-red-600/25 border border-red-500/20 text-red-400 hover:text-red-300 rounded-md transition cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1">
                                  {order.status === 'pending' && (
                                    <button
                                      onClick={() => handleProgressStatus(order, 'confirmed')}
                                      className="px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/25 text-emerald-400 hover:text-emerald-300 rounded font-black text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition active:scale-95"
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current" /> Preparar
                                    </button>
                                  )}
                                  {order.status === 'confirmed' && (
                                    <button
                                      onClick={() => handleProgressStatus(order, 'shipped')}
                                      className="px-2 py-1 bg-blue-600/10 hover:bg-blue-600/25 border border-blue-500/25 text-blue-400 hover:text-blue-300 rounded font-black text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition active:scale-95"
                                    >
                                      <Truck className="w-2.5 h-2.5" /> Despachar
                                    </button>
                                  )}
                                  {order.status === 'shipped' && (
                                    <span className="text-[8px] font-black uppercase text-white/30 tracking-widest py-1 flex items-center gap-0.5">
                                      <CheckCircle className="w-2.5 h-2.5 text-emerald-500" /> Pronto
                                    </span>
                                  )}
                                </div>
                              </div>

                            </div>
                          );
                        })
                      )}
                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </div>

        {/* Side slide-in drawer details */}
        {selectedOrder && (
          <div className="glass-panel w-full xl:w-[420px] p-5 flex flex-col gap-5 shrink-0 sticky top-6 animate-slide-in border-indigo-500/20 shadow-indigo-600/5 shadow-2xl">
            
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-white/5 pb-3.5">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-extrabold text-indigo-400 tracking-wider">DETALHES DO PEDIDO</span>
                <span className="text-base font-bold text-white font-mono">#{selectedOrder.id.slice(0, 12).toUpperCase()}</span>
                <span className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" /> {new Date(selectedOrder.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer info card JID */}
            <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5 flex items-center gap-3.5">
              <div className="h-9 JID w-9 bg-indigo-500/15 rounded-full flex items-center justify-center text-indigo-400 font-black text-sm uppercase">
                {selectedOrder.customers?.name?.slice(0,2).toUpperCase() || 'CL'}
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Cliente</span>
                <span className="text-xs font-extrabold text-white">{selectedOrder.customers?.name || 'Cliente'}</span>
                
                {selectedOrder.customers?.phone && (
                  <a
                    href={`https://wa.me/${selectedOrder.customers.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold mt-0.5 flex items-center gap-1"
                  >
                    Falar no WhatsApp <ChevronRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Items Breakdown list */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-wider">Itens Registrados</span>
              
              {(() => {
                const meta = getOrderMetadata(selectedOrder.id);
                return (
                  <div className="flex flex-col gap-3">
                    
                    <div className="flex flex-col gap-2 max-h-[25vh] overflow-y-auto pr-1">
                      {meta.items.map((item, idx) => (
                        <div key={idx} className="glass-panel p-3 bg-white/5 flex flex-col gap-2 border border-white/5 rounded-xl">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{item.product_name}</span>
                            
                            <span className="text-xs font-bold text-indigo-400 font-mono">
                              {meta.niche === 'butcher' 
                                ? `${item.weightVal} ${item.weightUnit}`
                                : `${item.quantity}x`
                              }
                            </span>
                          </div>

                          {/* Restaurant Toppings */}
                          {meta.niche === 'restaurant' && item.toppings && item.toppings.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.toppings.map(t => (
                                <span key={t} className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 font-semibold">
                                  + {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Butcher Cuts */}
                          {meta.niche === 'butcher' && item.cutType && (
                            <div className="flex items-center gap-1 text-[9px] text-white/50 bg-white/5 rounded px-2 py-0.5 border border-white/5 w-max">
                              <span className="font-extrabold">Corte:</span>
                              <span className="text-purple-300 font-semibold">{item.cutType}</span>
                            </div>
                          )}

                          {/* Custom Notes */}
                          {item.notes && (
                            <span className="text-[10px] italic text-white/40 bg-black/10 p-2 rounded-lg border border-white/5">Obs: "{item.notes}"</span>
                          )}
                        </div>
                      ))}
                    </div>

                  </div>
                );
              })()}
            </div>

            {/* Price block summary */}
            <div className="flex items-center justify-between bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 mt-auto">
              <span className="text-xs text-white/60 font-bold uppercase tracking-wider">Valor Total</span>
              <span className="text-xl font-black text-white font-mono tracking-tight">R$ {Number(selectedOrder.total_amount).toFixed(2)}</span>
            </div>

            {/* Quick Status Control */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePrintReceipt(selectedOrder)}
                className="glass-btn-secondary py-2.5 flex items-center justify-center gap-1 font-bold text-[10px] hover:bg-white/5 active:scale-95 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </button>
              
              <button
                onClick={() => handleOpenEdit(selectedOrder)}
                className="glass-btn-secondary py-2.5 flex items-center justify-center gap-1 font-bold text-[10px] hover:bg-white/5 active:scale-95 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Status
              </button>
              
              <button
                onClick={() => window.open(selectedOrder.payment_url || 'https://checkout.stripe.com/pay/mock_session', '_blank')}
                className="glass-btn-primary py-2.5 flex items-center justify-center gap-1 font-bold text-[10px] hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-indigo-600/10"
              >
                <CreditCard className="w-3.5 h-3.5" /> Faturar
              </button>

              <button
                onClick={() => handleDeleteOrder(selectedOrder.id)}
                className="glass-btn-secondary py-2.5 flex items-center justify-center gap-1 font-bold text-[10px] bg-red-600/10 border-red-500/20 hover:bg-red-600/25 text-red-400 hover:text-red-300 transition active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Manual Multi-item order creation modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 md:p-8 max-w-2xl w-full flex flex-col gap-6 animate-scale-in relative border border-white/10 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xl font-bold text-white tracking-wide">
                  Novo Pedido ({activeNiche === 'retail' ? 'Varejo Geral' : activeNiche === 'butcher' ? 'Açougue' : activeNiche === 'restaurant' ? 'Lanchonete' : activeNiche === 'gym' ? 'Academia' : activeNiche === 'tech_repair' ? 'Assistência' : 'Varejo'})
                </h3>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Butcher shop weight/100g portions tip */}
            {activeNiche === 'butcher' && (
              <div className="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 text-xs text-white/70 leading-relaxed">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white">Configuração para Balanças e Pesagens:</span>
                  <span>O sistema calcula preços por peso. Digite a quantidade proporcional (Exemplo: 1.5 significa 1 quilo e meio) e o sistema faturará o valor exato no Stripe.</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {/* Customer selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Selecione o Cliente</label>
                <div className="relative">
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-[#090a0f] text-white">Buscar cliente...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#090a0f] text-white">
                        {c.name} ({c.whatsapp || c.phone || 'Sem número'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Dynamic Items cart list */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Itens do Carrinho</label>
                  <button
                    type="button"
                    onClick={addCartRow}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Produto
                  </button>
                </div>

                <div className="flex flex-col gap-4 max-h-[35vh] overflow-y-auto pr-1">
                  {cartItems.map((item, idx) => {
                    const prod = products.find(p => p.id === item.product_id);
                    const subtotal = calculateItemSubtotal(item);
                    
                    return (
                      <div key={idx} className="glass-panel p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-3 relative animate-slide-in">
                        
                        {/* Remove item row button */}
                        {cartItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCartRow(idx)}
                            className="absolute right-3 top-3 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          
                          {/* Product select */}
                          <div className="flex flex-col gap-1 md:col-span-2">
                            <span className="text-[10px] text-white/40 font-bold uppercase">Produto</span>
                            <div className="relative">
                              <select
                                required
                                value={item.product_id}
                                onChange={(e) => updateCartItem(idx, 'product_id', e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-3 pr-8 py-2 text-white focus:outline-none focus:border-indigo-500/50 text-xs font-medium cursor-pointer appearance-none animate-none"
                              >
                                <option value="" className="bg-[#090a0f] text-white">Escolha o item...</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id} className="bg-[#090a0f] text-white">
                                    {p.name} - R$ {Number(p.price).toFixed(2)}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          {/* Quantities / weight input depending on niche */}
                          {activeNiche === 'butcher' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-white/40 font-bold uppercase">Peso</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  required
                                  value={item.weightVal}
                                  onChange={(e) => updateCartItem(idx, 'weightVal', e.target.value)}
                                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50 text-xs font-medium font-mono text-center"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-white/40 font-bold uppercase">Unidade</span>
                                <div className="relative">
                                  <select
                                    value={item.weightUnit}
                                    onChange={(e) => updateCartItem(idx, 'weightUnit', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-2 pr-6 py-2 text-white focus:outline-none focus:border-indigo-500/50 text-xs font-medium cursor-pointer appearance-none animate-none"
                                  >
                                    <option value="kg" className="bg-[#090a0f] text-white">kg (Quilo)</option>
                                    <option value="g" className="bg-[#090a0f] text-white">g (Grama)</option>
                                  </select>
                                  <ChevronDown className="w-3 h-3 text-white/40 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-white/40 font-bold uppercase">Qtd (Unidades)</span>
                              <input
                                type="number"
                                min="1"
                                required
                                value={item.quantity}
                                onChange={(e) => updateCartItem(idx, 'quantity', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50 text-xs font-medium font-mono text-center"
                              />
                            </div>
                          )}

                        </div>

                        {/* Butcher extra modifiers: Cut type selection */}
                        {activeNiche === 'butcher' && (
                          <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2 mt-1">
                            <span className="text-[10px] text-white/40 font-bold uppercase">Preferência do Corte</span>
                            <div className="flex flex-wrap gap-2">
                              {['Bife Fino', 'Bife Grosso', 'Moído', 'Em Cubos', 'Peça Inteira', 'Bife de 2 dedos'].map(cut => {
                                const isSel = item.cutType === cut;
                                return (
                                  <button
                                    key={cut}
                                    type="button"
                                    onClick={() => updateCartItem(idx, 'cutType', cut)}
                                    className={`px-3 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                                      isSel 
                                        ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                                        : 'border-white/5 bg-white/5 text-white/40 hover:border-white/10'
                                    }`}
                                  >
                                    {cut}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Restaurant extra modifiers: Toppings selection */}
                        {activeNiche === 'restaurant' && (
                          <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2 mt-1">
                            <span className="text-[10px] text-white/40 font-bold uppercase">Adicionais (Opcionais)</span>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { name: 'Bacon', price: 3.00 },
                                { name: 'Queijo Extra', price: 2.50 },
                                { name: 'Ovo Frito', price: 1.50 }
                              ].map(topping => {
                                const isSel = item.toppings?.includes(topping.name);
                                return (
                                  <button
                                    key={topping.name}
                                    type="button"
                                    onClick={() => handleToggleTopping(idx, topping.name)}
                                    className={`px-2.5 py-1 rounded text-[9px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                                      isSel 
                                        ? 'border-emerald-500 bg-emerald-500/10 text-white' 
                                        : 'border-white/5 bg-white/5 text-white/40 hover:border-white/10'
                                    }`}
                                  >
                                    <span>{topping.name}</span>
                                    <span className="text-emerald-400 font-mono">(+R$ {topping.price.toFixed(2)})</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Note observations */}
                        <div className="flex flex-col gap-1 border-t border-white/5 pt-2.5 mt-1">
                          <span className="text-[10px] text-white/40 font-bold uppercase">Observações do Item</span>
                          <input
                            type="text"
                            placeholder="Sem observações..."
                            value={item.notes}
                            onChange={(e) => updateCartItem(idx, 'notes', e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50 text-xs font-medium"
                          />
                        </div>

                        {/* Subtotal preview panel for this row */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1 text-xs">
                          <span className="text-white/40 font-medium">Subtotal</span>
                          <span className="font-bold text-white font-mono">R$ {subtotal.toFixed(2)}</span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment method and total summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4 mt-2 items-center">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Forma de Pagamento</label>
                  <div className="relative">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition cursor-pointer appearance-none"
                    >
                      <option value="credit_card" className="bg-[#090a0f] text-white">Cartão de Crédito</option>
                      <option value="pix" className="bg-[#090a0f] text-white">Pix (PIX Link)</option>
                      <option value="boleto" className="bg-[#090a0f] text-white">Boleto Bancário</option>
                      <option value="whatsapp_pay" className="bg-[#090a0f] text-white">WhatsApp Pay</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 font-sans">
                  <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-wider">Total do Carrinho</span>
                  <span className="text-3xl font-black text-indigo-400 font-mono">R$ {calculateOrderTotal().toFixed(2)}</span>
                </div>

              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 mt-4 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="glass-btn-secondary py-2.5 px-5 font-bold hover:bg-white/5 transition active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="glass-btn-primary py-2.5 px-6 font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-indigo-600/10 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {createOrderMutation.isPending ? 'Faturando...' : 'Lançar Pedido & Faturar'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Status manual edit modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 max-w-md w-full flex flex-col gap-6 animate-scale-in border border-white/10">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xl font-bold text-white tracking-wide">Editar Status do Pedido</h3>
              </div>
              <button 
                onClick={handleCloseEditModal}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-5">
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Status de Rastreamento</label>
                <div className="relative">
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition cursor-pointer appearance-none"
                  >
                    <option value="pending" className="bg-[#090a0f] text-white">Pendente (Recebido)</option>
                    <option value="confirmed" className="bg-[#090a0f] text-white">Confirmado (Preparando)</option>
                    <option value="shipped" className="bg-[#090a0f] text-white">Enviado (A Caminho)</option>
                    <option value="cancelled" className="bg-[#090a0f] text-white">Cancelado</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wide">Status do Pagamento</label>
                <div className="relative">
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-medium transition cursor-pointer appearance-none"
                  >
                    <option value="pending" className="bg-[#090a0f] text-white">Aguardando Pagamento</option>
                    <option value="completed" className="bg-[#090a0f] text-white">Pago (Pix/Stripe)</option>
                    <option value="failed" className="bg-[#090a0f] text-white">Pagamento Falhou</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="glass-btn-secondary py-2.5 px-5 font-bold hover:bg-white/5 transition active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateOrderMutation.isPending}
                  className="glass-btn-primary py-2.5 px-6 font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-indigo-600/10 shadow-lg cursor-pointer"
                >
                  {updateOrderMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Hidden print area for Thermal Bobbin receipt */}
      {receiptOrder && (
        <div id="thermal-receipt-print-area" className="hidden">
          <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
            <h3 style={{ margin: '0 0 1mm 0', fontSize: '16px', fontWeight: 'bold' }}>{workspaceSettings?.name || 'AÇOUGUE TOP BEEF'}</h3>
            <p style={{ margin: '0', fontSize: '10px', textTransform: 'uppercase' }}>Via de Produção</p>
            <p style={{ margin: '1mm 0 0 0', fontSize: '9px' }}>{new Date(receiptOrder.created_at).toLocaleString('pt-BR')}</p>
          </div>
          
          <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '2mm 0', margin: '2mm 0', fontSize: '11px' }}>
            <p style={{ margin: '0 0 1mm 0' }}><strong>PEDIDO:</strong> #{receiptOrder.id.slice(-6).toUpperCase()}</p>
            <p style={{ margin: '0' }}><strong>CLIENTE:</strong> {receiptOrder.customers?.name}</p>
            {receiptOrder.customers?.phone && <p style={{ margin: '1mm 0 0 0' }}><strong>TEL:</strong> {receiptOrder.customers.phone}</p>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: '3mm 0' }}>
            <thead>
              <tr style={{ borderBottom: '1px dashed black' }}>
                <th style={{ textAlign: 'left', paddingBottom: '1.5mm' }}>Item</th>
                <th style={{ textAlign: 'right', paddingBottom: '1.5mm' }}>Qtd</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const meta = getOrderMetadata(receiptOrder.id);
                return meta.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '0.5px dotted #ddd' }}>
                    <td style={{ padding: '2mm 0', verticalAlign: 'top' }}>
                      <strong>{item.product_name}</strong>
                      
                      {/* Cuts */}
                      {meta.niche === 'butcher' && item.cutType && (
                        <div style={{ fontSize: '9px', margin: '0.5mm 0 0 1mm', fontStyle: 'italic' }}>
                          - Corte: {item.cutType}
                        </div>
                      )}
                      
                      {/* Restaurant Toppings */}
                      {meta.niche === 'restaurant' && item.toppings && item.toppings.length > 0 && (
                        <div style={{ fontSize: '9px', margin: '0.5mm 0 0 1mm' }}>
                          - Extras: {item.toppings.join(', ')}
                        </div>
                      )}

                      {/* Observations */}
                      {item.notes && (
                        <div style={{ fontSize: '9px', margin: '1mm 0 0 1mm', background: '#eee', padding: '1mm', borderRadius: '1mm' }}>
                          Obs: "{item.notes}"
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: '2mm 0', fontWeight: 'bold', verticalAlign: 'top' }}>
                      {meta.niche === 'butcher' 
                        ? `${item.weightVal} ${item.weightUnit}`
                        : `${item.quantity}x`
                      }
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed black', paddingTop: '2.5mm', fontSize: '12px', textAlign: 'right' }}>
            <p style={{ margin: '0 0 1mm 0' }}>Faturamento: <strong style={{ textTransform: 'uppercase' }}>{receiptOrder.payment_method === 'pix' ? 'Pix' : 'Cartão'}</strong></p>
            <p style={{ margin: '0', fontSize: '14px' }}><strong>TOTAL: R$ {Number(receiptOrder.total_amount).toFixed(2)}</strong></p>
          </div>

          <div style={{ textAlign: 'center', marginTop: '6mm', fontSize: '9px', borderTop: '1px dotted black', paddingTop: '3mm' }}>
            <p style={{ margin: '0' }}>Alice AI Platform - 2026</p>
            <p style={{ margin: '1mm 0 0 0' }}>Obrigado pela preferência!</p>
          </div>
        </div>
      )}

    </div>
  );
};

export default Orders;
