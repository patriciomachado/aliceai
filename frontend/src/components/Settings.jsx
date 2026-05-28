import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { 
  Key, 
  Settings as SettingsIcon, 
  Globe, 
  ShieldCheck, 
  Check,
  Copy,
  Sparkles,
  Smartphone,
  Info,
  Building2,
  Lock,
  QrCode,
  RefreshCw,
  Clock,
  Package,
  Wrench,
  ShoppingCart,
  Calendar,
  ToggleLeft,
  AlarmClock,
  ChevronDown,
  Cpu
} from 'lucide-react';

// ============================================================
// DAYS CONFIG (reused by both appointment & order hours grids)
// ============================================================
const DAYS = [
  { key: 'monday',    label: 'Segunda-feira' },
  { key: 'tuesday',   label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday',  label: 'Quinta-feira' },
  { key: 'friday',    label: 'Sexta-feira' },
  { key: 'saturday',  label: 'Sábado' },
  { key: 'sunday',    label: 'Domingo' },
];

const DEFAULT_DAY_HOURS = { enabled: true, open: '08:00', close: '18:00' };
const DEFAULT_HOURS = DAYS.reduce((acc, d) => ({
  ...acc,
  [d.key]: d.key === 'sunday'
    ? { enabled: false, open: '09:00', close: '12:00' }
    : d.key === 'saturday'
    ? { enabled: true, open: '09:00', close: '13:00' }
    : { ...DEFAULT_DAY_HOURS }
}), {});

// ============================================================
// BusinessHoursGrid — reusable weekly schedule editor
// ============================================================
const BusinessHoursGrid = ({ label, icon: Icon, hours, onChange }) => {
  const updateDay = (dayKey, field, value) => {
    onChange({ ...hours, [dayKey]: { ...hours[dayKey], [field]: value } });
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs text-white/80 font-bold uppercase tracking-wider flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-indigo-400" />
        {label}
      </label>
      <div className="flex flex-col gap-2">
        {DAYS.map(({ key, label: dayLabel }) => {
          const day = hours[key] || DEFAULT_DAY_HOURS;
          return (
            <div
              key={key}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                day.enabled
                  ? 'bg-white/5 border-white/8'
                  : 'bg-black/10 border-white/3 opacity-60'
              }`}
            >
              {/* Day toggle */}
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => updateDay(key, 'enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
              </label>

              {/* Day name */}
              <span className="text-xs font-semibold text-white/80 w-28 shrink-0">{dayLabel}</span>

              {/* Time range */}
              {day.enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={day.open}
                    onChange={(e) => updateDay(key, 'open', e.target.value)}
                    className="glass-input text-xs py-1 px-2 w-28"
                  />
                  <span className="text-white/30 text-xs">até</span>
                  <input
                    type="time"
                    value={day.close}
                    onChange={(e) => updateDay(key, 'close', e.target.value)}
                    className="glass-input text-xs py-1 px-2 w-28"
                  />
                </div>
              ) : (
                <span className="text-xs text-white/30 italic">Fechado</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// ModuleToggle — individual module enable/disable card
// ============================================================
const ModuleToggle = ({ label, description, icon: Icon, iconColor, enabled, onChange }) => (
  <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
    enabled ? 'bg-white/5 border-white/8' : 'bg-black/10 border-white/3'
  }`}>
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        enabled ? `bg-${iconColor}-500/10 border border-${iconColor}-500/20` : 'bg-white/5 border border-white/5'
      }`}>
        <Icon className={`w-4 h-4 ${enabled ? `text-${iconColor}-400` : 'text-white/30'}`} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className={`text-sm font-semibold ${enabled ? 'text-white' : 'text-white/40'}`}>{label}</span>
        <span className="text-[11px] text-white/40">{description}</span>
      </div>
    </div>
    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
    </label>
  </div>
);

const Settings = () => {
  const queryClient = useQueryClient();
  const { showToast, setWorkspaceSettings, setActiveWorkspace } = useApp();
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [activeTab, setActiveTab] = useState('integrations');
  
  // Tab 1: Integration Credentials & AI
  const [phoneId, setPhoneId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [stripeSecret, setStripeSecret] = useState('');
  const [stripePublishable, setStripePublishable] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [wppMode, setWppMode] = useState('qrcode');
  const [agentTakeoverPauseDuration, setAgentTakeoverPauseDuration] = useState(30);
  const [niche, setNiche] = useState('retail');
  const [paymentMethods, setPaymentMethods] = useState(['pix', 'credit_card']);
  const [pixKey, setPixKey] = useState('');
  const [pixName, setPixName] = useState('');
  const [nexusApiUrl, setNexusApiUrl] = useState('');
  const [nexusApiKey, setNexusApiKey] = useState('');

  // Tab 4: Modules & Business Hours
  const [modules, setModules] = useState({
    products: true,
    services: true,
    orders: true,
    appointments: true
  });
  const [appointmentHours, setAppointmentHours] = useState(DEFAULT_HOURS);
  const [orderHours, setOrderHours] = useState(DEFAULT_HOURS);
  const [appointmentLeadTime, setAppointmentLeadTime] = useState(0);
  const [appointmentReminderLeadTime, setAppointmentReminderLeadTime] = useState(2);
  const [appointmentSlotInterval, setAppointmentSlotInterval] = useState(30);

  const updateModule = (key, value) => setModules(prev => ({ ...prev, [key]: value }));

  // Real WhatsApp Web QR Code query & mutations
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const { data: wppStatus = { status: 'disconnected', qrCode: null, user: null }, isError: wppStatusError } = useQuery({
    queryKey: ['whatsappStatus'],
    queryFn: async () => {
      const res = await api.get('/whatsapp/status');
      return res.data;
    },
    refetchInterval: (query) => {
      const state = query.state.data;
      // Poll faster while waiting for QR or connecting
      if (state?.status === 'connected') return 10000;
      if (state?.status === 'connecting' || isGeneratingQr) return 1500;
      return 3000;
    },
    retry: 3,
    retryDelay: 2000,
    enabled: activeTab === 'integrations' && wppMode === 'qrcode'
  });

  // When QR code arrives or connection is established, stop the generating state
  useEffect(() => {
    if (wppStatus.qrCode || wppStatus.status === 'connected') {
      setIsGeneratingQr(false);
    }
  }, [wppStatus.qrCode, wppStatus.status]);

  const connectWppMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/whatsapp/connect');
      return res.data;
    },
    onSuccess: () => {
      setIsGeneratingQr(true);
      queryClient.invalidateQueries({ queryKey: ['whatsappStatus'] });
      showToast('Gerando QR Code... Aguarde alguns segundos! 🔄');
    },
    onError: () => {
      setIsGeneratingQr(false);
      showToast('Falha ao conectar. Verifique se o servidor está rodando.', 'error');
    }
  });

  const disconnectWppMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/whatsapp/disconnect');
      return res.data;
    },
    onSuccess: () => {
      setIsGeneratingQr(false);
      queryClient.invalidateQueries({ queryKey: ['whatsappStatus'] });
      showToast('WhatsApp desconectado.');
    },
    onError: () => {
      showToast('Falha ao desconectar.', 'error');
    }
  });
  
  const [wppConnected, setWppConnected] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Tab 2: Web Widget & Channels
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [widgetColor, setWidgetColor] = useState('#6366F1');
  const [widgetGreeting, setWidgetGreeting] = useState('');

  // Tab 3: Security & LGPD
  const [lgpdConsentRequired, setLgpdConsentRequired] = useState(false);
  const [dataRetentionMonths, setDataRetentionMonths] = useState(12);

  // Webhook information (derived dynamically)
  const webhookUrl = `${window.location.origin.replace('3001', '3000')}/api/webhooks/meta`;
  const verifyToken = 'alice_verification_token_secure';

  // 1. Fetch current workspace settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const res = await api.get('/auth/me');
        const workspace = res.data?.workspaces;
        
        if (workspace) {
          setBusinessName(workspace.name || '');
          const settings = workspace.settings || {};
          setPhoneId(settings.phone_id || '');
          setMetaToken(settings.meta_token || '');
          setStripeSecret(settings.stripe_secret || '');
          setStripePublishable(settings.stripe_publishable || '');
          setSystemInstruction(settings.system_instruction || '');
          setWppMode(settings.wpp_mode || 'qrcode');
          setWppConnected(settings.wpp_connected || false);
          setAgentTakeoverPauseDuration(settings.agent_takeover_pause_duration !== undefined ? settings.agent_takeover_pause_duration : 30);
          setNiche(settings.niche || 'retail');
          setPaymentMethods(settings.payment_methods || ['pix', 'credit_card']);
          setPixKey(settings.pix_key || '');
          setPixName(settings.pix_name || '');
          setNexusApiUrl(settings.nexus_api_url || '');
          setNexusApiKey(settings.nexus_api_key || '');
          
          setWidgetEnabled(settings.widget_enabled !== undefined ? settings.widget_enabled : true);
          setWidgetColor(settings.widget_color || '#6366F1');
          setWidgetGreeting(settings.widget_greeting || 'Olá! Sou a Alice, assistente virtual. Como posso ajudar você hoje?');
          
          setLgpdConsentRequired(settings.lgpd_consent_required || false);
          setDataRetentionMonths(settings.data_retention_months || 12);

          // Modules & Hours
          if (settings.modules) setModules({ products: true, services: true, orders: true, appointments: true, ...settings.modules });
          if (settings.appointment_hours) setAppointmentHours({ ...DEFAULT_HOURS, ...settings.appointment_hours });
          if (settings.order_hours) setOrderHours({ ...DEFAULT_HOURS, ...settings.order_hours });
          setAppointmentLeadTime(settings.appointment_lead_time_hours !== undefined ? settings.appointment_lead_time_hours : 0);
          setAppointmentReminderLeadTime(settings.appointment_reminder_lead_hours !== undefined ? settings.appointment_reminder_lead_hours : 2);
          setAppointmentSlotInterval(settings.appointment_slot_interval_minutes !== undefined ? settings.appointment_slot_interval_minutes : 30);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        showToast('Erro ao carregar configurações do banco.', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // 2. Save settings back to PUT /api/auth/workspace
  const handleSave = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) {
      showToast('O nome comercial não pode estar vazio.', 'warning');
      return;
    }

    try {
      setLoading(true);
      const updatedSettings = {
        phone_id: phoneId,
        meta_token: metaToken,
        stripe_secret: stripeSecret,
        stripe_publishable: stripePublishable,
        system_instruction: systemInstruction,
        wpp_mode: wppMode,
        wpp_connected: wppConnected,
        widget_enabled: widgetEnabled,
        widget_color: widgetColor,
        widget_greeting: widgetGreeting,
        lgpd_consent_required: lgpdConsentRequired,
        data_retention_months: parseInt(dataRetentionMonths) || 12,
        agent_takeover_pause_duration: parseInt(agentTakeoverPauseDuration) || 30,
        niche,
        payment_methods: paymentMethods,
        pix_key: pixKey,
        pix_name: pixName,
        nexus_api_url: nexusApiUrl,
        nexus_api_key: nexusApiKey,
        modules,
        appointment_hours: appointmentHours,
        order_hours: orderHours,
        appointment_lead_time_hours: parseInt(appointmentLeadTime) || 0,
        appointment_reminder_lead_hours: parseInt(appointmentReminderLeadTime) || 2,
        appointment_slot_interval_minutes: parseInt(appointmentSlotInterval) || 30
      };

      await api.put('/auth/workspace', {
        name: businessName,
        settings: updatedSettings
      });

      // Update global context states reactively
      setWorkspaceSettings(updatedSettings);
      setActiveWorkspace(prev => ({ ...prev, name: businessName, settings: updatedSettings }));

      // Invalidate workspace cache so Sidebar and AI re-read the new settings
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      showToast('Configurações salvas e aplicadas com sucesso! 🎉');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('Falha ao salvar configurações no banco.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copiado para a área de transferência!`);
  };

  const colorOptions = [
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Emerald', value: '#10B981' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Rose', value: '#F43F5E' },
    { name: 'Amber', value: '#F59E0B' }
  ];

  return (
    <div className="flex flex-col gap-8 w-full shrink-0 max-w-6xl">
      
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary animate-spin-slow" /> Painel de Configurações
        </h1>
        <p className="text-white/60 text-sm">Conecte seus canais de mensagens oficiais, personalize o chatbot de site e configure termos de segurança.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Sidebar Nav */}
        <div className="glass-panel p-4 flex flex-col gap-2 h-fit">
          {[
            { id: 'integrations', label: 'Integrações & WhatsApp', icon: Key },
            { id: 'webchat',      label: 'Canais Web & Widget',     icon: Globe },
            { id: 'modules',      label: 'Módulos & Horários',       icon: ToggleLeft },
            { id: 'security',     label: 'Segurança & LGPD',         icon: ShieldCheck },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === id
                  ? 'text-white bg-white/5 border-l-2 border-primary'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${activeTab === id ? 'text-primary' : ''}`} />
              {label}
            </button>
          ))}
        </div>

        {/* Right Side Cards */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Form wrapper */}
          <form onSubmit={handleSave} className="flex flex-col gap-8">
            
            {/* -------------------- TAB 1: INTEGRATIONS & WHATSAPP -------------------- */}
            {activeTab === 'integrations' && (
              <>
                {/* CARD 1: CUSTOM BUSINESS PROFILE */}
                <div className="glass-panel p-6 flex flex-col gap-5">
                  <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                    <Building2 className="w-5 h-5 text-purple-400" />
                    <div className="flex flex-col">
                      <span className="text-base font-bold text-white">Perfil do Estabelecimento</span>
                      <span className="text-xs text-white/40">Identifique sua marca e configure as instruções de comportamento do robô.</span>
                    </div>
                  </div>

                  {/* Business Name */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-white/80 font-bold uppercase tracking-wider">Nome do Estabelecimento</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Ex: Açougue do Zé, Academia FitBody..."
                      className="glass-input w-full text-sm"
                      required
                    />
                  </div>

                  {/* Business Niche (Vertical) */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-white/80 font-bold uppercase tracking-wider">Nicho / Vertical de Negócio</label>
                    <div className="relative">
                      <select
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                        className="glass-input w-full text-sm font-sans bg-white dark:bg-[#0d0e16] appearance-none pr-10 cursor-pointer"
                      >
                        <option value="retail" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">Varejo & Serviços Gerais</option>
                        <option value="restaurant" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">Restaurante & Alimentos</option>
                        <option value="butcher" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">Açougue & Casa de Carnes</option>
                        <option value="gym" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">Academia & Estúdio Fitness</option>
                        <option value="tech_repair" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">Assistência Técnica & Reparos</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <span className="text-[10px] text-white/40">Define o comportamento padrão do robô e as opções de exibição no painel.</span>
                  </div>

                  {/* Payment Methods */}
                  <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                    <label className="text-xs text-white/80 font-bold uppercase tracking-wider">Métodos de Pagamento Aceitos</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { key: 'pix', label: 'Pix' },
                        { key: 'credit_card', label: 'Cartão de Crédito' },
                        { key: 'debit_card', label: 'Cartão de Débito' },
                        { key: 'cash', label: 'Dinheiro' }
                      ].map((method) => {
                        const isChecked = paymentMethods.includes(method.key);
                        return (
                          <label
                            key={method.key}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all cursor-pointer select-none text-xs font-semibold ${
                              isChecked
                                ? 'bg-indigo-600/10 border-indigo-500/30 text-white'
                                : 'bg-black/10 border-white/5 text-white/60 hover:bg-white/5'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPaymentMethods(prev => [...prev, method.key]);
                                } else {
                                  setPaymentMethods(prev => prev.filter(m => m !== method.key));
                                }
                              }}
                              className="rounded border-white/10 bg-transparent text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                            />
                            {method.label}
                          </label>
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-white/40">Selecione as formas de pagamento que o seu estabelecimento aceita.</span>
                  </div>

                  {/* Pix Key setting */}
                  {paymentMethods.includes('pix') && (
                    <div className="flex flex-col gap-4 border-t border-white/5 pt-4 animate-fade-in">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-white/80 font-bold uppercase tracking-wider">Chave Pix do Estabelecimento</label>
                        <input
                          type="text"
                          value={pixKey}
                          onChange={(e) => setPixKey(e.target.value)}
                          placeholder="Ex: CNPJ, Celular, E-mail ou Chave Aleatória"
                          className="glass-input w-full text-sm"
                          id="pixKey"
                        />
                        <span className="text-[10px] text-white/40">Insira a chave Pix do seu estabelecimento. Esta chave será usada pelo robô para instruir pagamentos de Pix na entrega ou retirada.</span>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-white/80 font-bold uppercase tracking-wider">Nome do Favorecido (Pix)</label>
                        <input
                          type="text"
                          value={pixName}
                          onChange={(e) => setPixName(e.target.value)}
                          placeholder="Ex: Nome da sua Empresa ou Nome Completo"
                          className="glass-input w-full text-sm"
                          id="pixName"
                        />
                        <span className="text-[10px] text-white/40">Nome de quem receberá o Pix (beneficiário), para que o cliente confirme antes de efetuar a transferência.</span>
                      </div>
                    </div>
                  )}

                  {/* AI Instructions */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-white/80 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Instruções da Inteligência Artificial
                      </label>
                      <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full px-2 py-0.5 font-bold">Livre de Viés</span>
                    </div>
                    <textarea
                      value={systemInstruction}
                      onChange={(e) => setSystemInstruction(e.target.value)}
                      rows="5"
                      placeholder="Defina as regras, tom de voz e diretrizes de atendimento. Ex: 'Você é o atendente do Açougue do Zé. Seja muito amigável, responda com entusiasmo e ofereça nossos cortes especiais como picanha e alcatra. Se o cliente perguntar o preço, informe que a picanha está R$ 69/kg e a alcatra R$ 45/kg. Nunca responda sobre outros assuntos.'"
                      className="glass-input w-full text-sm font-sans resize-none"
                    />
                    <span className="text-[10px] text-white/40 flex items-center gap-1">
                      <Info className="w-3 h-3 text-purple-400" /> A IA se guiará estritamente pelas regras e produtos adicionados por você nesta caixa de texto.
                    </span>
                  </div>

                  {/* Human Takeover Pause Duration */}
                  <div className="flex flex-col gap-2 border-t border-black/5 dark:border-white/5 pt-4 mt-2">
                    <label className="text-xs text-foreground/80 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" /> Trava de Atendimento Humano (Takeover)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={agentTakeoverPauseDuration}
                        onChange={(e) => setAgentTakeoverPauseDuration(e.target.value)}
                        className="glass-input w-24 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">
                        minutos de pausa na IA quando você responder manualmente (celular ou painel).
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60">
                      Durante esse período, a Alice silenciará o robô apenas para aquele cliente específico, permitindo que você realize o atendimento de forma manual sem interrupções automáticas.
                    </span>
                  </div>
                </div>

                  {/* CARD 1.5: NEXUS ERP INTEGRATION */}
                  {niche === 'tech_repair' && (
                    <div className="glass-panel p-6 flex flex-col gap-5 animate-fade-in">
                      <div className="flex items-center gap-2.5 border-b border-black/5 dark:border-white/5 pb-3">
                        <Cpu className="w-5 h-5 text-indigo-400" />
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-white">Integração Nexus ERP</span>
                          <span className="text-xs text-white/40">Conecte a Alice diretamente ao seu sistema de gestão Nexus.</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-white/80 font-bold uppercase tracking-wider">URL da API do Nexus</label>
                        <input
                          type="url"
                          value={nexusApiUrl}
                          onChange={(e) => setNexusApiUrl(e.target.value)}
                          placeholder="Ex: https://api.nexusassistencia.com.br"
                          className="glass-input w-full text-sm"
                          id="nexusApiUrl"
                        />
                        <span className="text-[10px] text-white/40">URL base do seu ERP Nexus. A Alice enviará requisições para este endpoint para buscar O.S. e sincronizar catálogo.</span>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-white/80 font-bold uppercase tracking-wider">Chave de Acesso (API Key / Token)</label>
                        <input
                          type="password"
                          value={nexusApiKey}
                          onChange={(e) => setNexusApiKey(e.target.value)}
                          placeholder="Insira a chave de segurança do Nexus"
                          className="glass-input w-full text-sm"
                          id="nexusApiKey"
                        />
                        <span className="text-[10px] text-white/40">Chave de autenticação utilizada para autorizar as requisições seguras entre a Alice e o Nexus.</span>
                      </div>
                    </div>
                  )}

                {/* CARD 2: SIMPLIFIED WHATSAPP CONNECTION WIZARD */}
                <div className="glass-panel p-6 flex flex-col gap-5">
                  <div className="flex items-center gap-2.5 border-b border-black/5 dark:border-white/5 pb-3">
                    <Smartphone className="w-5 h-5 text-emerald-500" />
                    <div className="flex flex-col">
                      <span className="text-base font-bold text-white">Assistente de Conexão WhatsApp</span>
                      <span className="text-xs text-white/40">Integre o número de telefone da sua empresa à Alice.</span>
                    </div>
                  </div>

                  {/* Mode Selector Card Tabs */}
                  <div className="flex gap-4 p-1 bg-black/10 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setWppMode('qrcode')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        wppMode === 'qrcode'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" /> Conexão via QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setWppMode('meta')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        wppMode === 'meta'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" /> API Oficial da Meta
                    </button>
                  </div>

                  {wppMode === 'qrcode' ? (
                    /* QR Code Connection panel */
                    wppStatusError ? (
                      /* Backend unreachable */
                      <div className="flex flex-col items-center justify-center p-6 bg-red-950/10 rounded-xl border border-red-900/20 w-full gap-3 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                          <Smartphone className="w-6 h-6 text-red-400" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-red-400">Servidor Offline</span>
                          <span className="text-xs text-white/50 max-w-xs">Não foi possível conectar ao servidor. Certifique-se de que o backend está rodando na porta 3000.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => queryClient.invalidateQueries({ queryKey: ['whatsappStatus'] })}
                          className="glass-btn text-xs py-1.5 px-4 flex items-center gap-2 cursor-pointer border border-white/10"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
                        </button>
                      </div>
                    ) : wppStatus.status === 'connected' ? (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-6 items-center p-6 bg-emerald-500/5 rounded-xl border border-emerald-500/20 w-full animate-fade-in">
                          <div className="flex-1 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="text-sm font-bold text-emerald-400">WhatsApp Conectado! 🟢</span>
                            </div>
                            <p className="text-xs text-white/70 leading-relaxed">
                              Sua sessão do WhatsApp Web está ativa e respondendo autonomamente. A Alice está processando novas mensagens e executando agendamentos e pedidos automaticamente.
                            </p>
                            <div className="flex flex-col gap-1.5 text-xs text-white/50 pt-2 border-t border-white/5">
                              <span>• <strong>Aparelho vinculado:</strong> {wppStatus.user?.name || 'Aparelho Web'}</span>
                              <span>• <strong>Número de contato:</strong> +{wppStatus.user?.id?.split(':')[0] || 'Desconhecido'}</span>
                              <span>• <strong>Sincronização:</strong> Ativa e em tempo real</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-3 shrink-0 items-center">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <Check className="w-6 h-6 text-emerald-400" />
                            </div>
                            <button
                              type="button"
                              onClick={() => disconnectWppMutation.mutate()}
                              disabled={disconnectWppMutation.isPending}
                              className="glass-btn bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/40 text-xs py-1.5 px-3 rounded-xl transition cursor-pointer"
                            >
                              {disconnectWppMutation.isPending ? 'Desconectando...' : 'Desconectar WhatsApp'}
                            </button>
                          </div>
                        </div>
                        {/* Option to generate fresh QR to connect a different account */}
                        <button
                          type="button"
                          onClick={() => connectWppMutation.mutate()}
                          disabled={connectWppMutation.isPending}
                          className="flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white/70 transition py-2 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          {connectWppMutation.isPending || isGeneratingQr ? 'Gerando novo QR Code...' : 'Trocar conta / Gerar novo QR Code'}
                        </button>
                      </div>
                    ) : wppStatus.status === 'connecting' || isGeneratingQr ? (
                      <div className="flex flex-col md:flex-row gap-6 items-center p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 w-full">
                        <div className="flex-1 flex flex-col gap-3">
                          <span className="text-sm font-bold text-white">Sincronizando com o WhatsApp:</span>
                          <ul className="flex flex-col gap-2.5 text-xs text-white/70">
                            <li className="flex gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                              Abra o WhatsApp no seu aparelho celular.
                            </li>
                            <li className="flex gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                              Toque em <strong>Aparelhos Conectados</strong> nas configurações do WhatsApp.
                            </li>
                            <li className="flex gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                              Toque em <strong>Conectar aparelho</strong> e aponte para o QR Code ao lado.
                            </li>
                          </ul>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-4 h-4 rounded-full border-2 border-indigo-600/20 border-t-indigo-600 animate-spin shrink-0"></div>
                            <span className="text-xs text-white/50 font-bold uppercase tracking-wider animate-pulse">
                              {wppStatus.qrCode ? 'Aguardando leitura do QR Code...' : 'Gerando QR Code...'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Real Dynamic QR Code Component */}
                        <div className="w-44 h-44 bg-white p-3 rounded-2xl flex flex-col items-center justify-center shadow-xl border border-black/10 relative shrink-0">
                          {wppStatus.qrCode ? (
                            <img src={wppStatus.qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2 text-indigo-950 p-2 text-center">
                              <div className="w-8 h-8 rounded-full border-[3px] border-indigo-200 border-t-indigo-600 animate-spin"></div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-800">Gerando QR...</span>
                              <span className="text-[8px] text-indigo-500">Pode levar alguns segundos</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 w-full gap-4 min-h-[12rem] text-center">
                        <QrCode className="w-12 h-12 text-indigo-400 animate-pulse" />
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold text-white">Conectar WhatsApp via QR Code</span>
                          <span className="text-xs text-white/50">Gere um QR Code para vincular seu WhatsApp pessoal ou comercial sem precisar da API da Meta.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => connectWppMutation.mutate()}
                          disabled={connectWppMutation.isPending || isGeneratingQr}
                          className="glass-btn-primary py-2.5 px-6 text-xs flex items-center gap-2 cursor-pointer mt-2"
                        >
                          {connectWppMutation.isPending || isGeneratingQr ? (
                            <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Gerando QR Code...</>
                          ) : (
                            <><QrCode className="w-3.5 h-3.5" /> Gerar QR Code de Conexão</>
                          )}
                        </button>
                      </div>
                    )
                  ) : (
                    /* Existing Meta official connection form */
                    <div className="flex flex-col gap-5">
                      {/* Step 1: Copy Webhook */}
                      <div className="flex flex-col gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                        <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px]">1</span> Copie a URL do Webhook na Meta
                        </span>
                        <span className="text-xs text-white/60">No painel de desenvolvedores da Meta, salve esta URL no campo "URL de callback":</span>
                        
                        <div className="flex items-center gap-2 bg-black/20 dark:bg-black/40 rounded-xl px-3 py-2 border border-black/5 dark:border-white/5">
                          <span className="text-[11px] text-white/80 font-mono select-all truncate flex-1">{webhookUrl}</span>
                          <button type="button" onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')} className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-xs text-white/60 mt-1">E insira o Token de Verificação abaixo:</span>
                        <div className="flex items-center gap-2 bg-black/20 dark:bg-black/40 rounded-xl px-3 py-2 border border-black/5 dark:border-white/5">
                          <span className="text-[11px] text-white/80 font-mono select-all truncate flex-1">{verifyToken}</span>
                          <button type="button" onClick={() => copyToClipboard(verifyToken, 'Token de Verificação')} className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Step 2: Meta Credentials */}
                      <div className="flex flex-col gap-4">
                        <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px]">2</span> Cole seus Dados da Meta
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Phone ID */}
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-white/60 font-bold uppercase tracking-wider">ID do Número de Telefone</label>
                            <input
                              type="text"
                              value={phoneId}
                              onChange={(e) => setPhoneId(e.target.value)}
                              placeholder="15 dígitos gerados pela Meta"
                              className="glass-input w-full text-xs font-mono"
                            />
                          </div>

                          {/* Access Token */}
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Token de Acesso (Meta)</label>
                            <input
                              type="password"
                              value={metaToken}
                              onChange={(e) => setMetaToken(e.target.value)}
                              placeholder="Cole o token de acesso da Meta"
                              className="glass-input w-full text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CARD 3: STRIPE GATEWAY */}
                <div className="glass-panel p-6 flex flex-col gap-5">
                  <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                    <Lock className="w-5 h-5 text-indigo-400" />
                    <div className="flex flex-col">
                      <span className="text-base font-bold text-white">Configurações do Stripe</span>
                      <span className="text-xs text-white/40">Conecte sua conta do Stripe para que a Alice gere links de pagamentos automáticos.</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Stripe Publishable */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Stripe Publishable Key</label>
                      <input
                        type="text"
                        value={stripePublishable}
                        onChange={(e) => setStripePublishable(e.target.value)}
                        placeholder="pk_test_..."
                        className="glass-input w-full text-xs font-mono"
                      />
                    </div>

                    {/* Stripe Secret */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Stripe Secret Key</label>
                      <input
                        type="password"
                        value={stripeSecret}
                        onChange={(e) => setStripeSecret(e.target.value)}
                        placeholder="sk_test_..."
                        className="glass-input w-full text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* -------------------- TAB 2: CANAIS WEB & WIDGET -------------------- */}
            {activeTab === 'webchat' && (
              <div className="flex flex-col gap-8">
                
                {/* WIDGET STATUS & SETTINGS */}
                <div className="glass-panel p-6 flex flex-col gap-5">
                  <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                    <Globe className="w-5 h-5 text-indigo-400" />
                    <div className="flex flex-col">
                      <span className="text-base font-bold text-white">Widget de Chat Integrado</span>
                      <span className="text-xs text-white/40">Habilite e configure o botão de chat inteligente flutuante para o seu site.</span>
                    </div>
                  </div>

                  {/* Widget Enabled Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-white">Status do Widget</span>
                      <span className="text-xs text-white/50">Ativa ou desativa a exibição do chat flutuante no seu site.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={widgetEnabled}
                        onChange={(e) => setWidgetEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* Widget Color Selection */}
                  <div className="flex flex-col gap-3">
                    <label className="text-xs text-white/80 font-bold uppercase tracking-wider">Cor Primária do Widget</label>
                    <div className="flex flex-wrap items-center gap-3">
                      {colorOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setWidgetColor(opt.value)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            widgetColor === opt.value
                              ? 'border-white text-white shadow-glowing'
                              : 'border-white/5 bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                          style={{
                            boxShadow: widgetColor === opt.value ? `0 0 12px ${opt.value}33` : 'none'
                          }}
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.value }} />
                          {opt.name}
                        </button>
                      ))}
                      <input 
                        type="color" 
                        value={widgetColor}
                        onChange={(e) => setWidgetColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Greeting message */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-white/80 font-bold uppercase tracking-wider">Mensagem de Boas-vindas</label>
                    <input
                      type="text"
                      value={widgetGreeting}
                      onChange={(e) => setWidgetGreeting(e.target.value)}
                      placeholder="Ex: Olá! Como posso te ajudar hoje?"
                      className="glass-input w-full text-sm"
                    />
                    <span className="text-[10px] text-white/40">Esta mensagem é exibida assim que o cliente abre o chat pela primeira vez.</span>
                  </div>
                </div>

                {/* VISUAL PREVIEW CONTAINER */}
                <div className="glass-panel p-6 flex flex-col gap-5">
                  <span className="text-xs text-white/80 font-bold uppercase tracking-wider">Visualização em Tempo Real</span>
                  <div className="w-full min-h-[220px] bg-slate-50 dark:bg-[#0c0d14] rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-center p-6 relative overflow-hidden">
                    
                    {/* Simulated site content */}
                    <div className="flex flex-col gap-2 w-full max-w-sm text-center opacity-30 select-none">
                      <div className="h-4 bg-white/10 rounded-full w-2/3 mx-auto" />
                      <div className="h-3 bg-white/5 rounded-full w-4/5 mx-auto" />
                      <div className="h-3 bg-white/5 rounded-full w-3/5 mx-auto" />
                    </div>

                    {/* Simulated Widget Bubble */}
                    <div 
                      className="absolute bottom-6 right-6 w-12 h-12 rounded-full text-white flex items-center justify-center transition-all duration-300 shadow-lg border border-white/10 scale-105"
                      style={{ 
                        backgroundColor: widgetColor,
                        boxShadow: `0 8px 24px ${widgetColor}4d`,
                        opacity: widgetEnabled ? 1 : 0.2
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>

                    {/* Enabled/Disabled Indicator overlay */}
                    {!widgetEnabled && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                        <span className="text-xs font-bold text-white/60 uppercase tracking-wider px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">Widget Inativo</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* -------------------- TAB 3: MÓDULOS & HORÁRIOS -------------------- */}
            {activeTab === 'modules' && (
              <div className="flex flex-col gap-8">

                {/* MODULE TOGGLES */}
                <div className="glass-panel p-6 flex flex-col gap-5">
                  <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                    <ToggleLeft className="w-5 h-5 text-indigo-400" />
                    <div className="flex flex-col">
                      <span className="text-base font-bold text-white">Módulos Ativos</span>
                      <span className="text-xs text-white/40">Habilite apenas os módulos que o seu negócio utiliza. Módulos desabilitados somem da navegação e a IA não os menciona.</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <ModuleToggle
                      label="Produtos"
                      description="Catálogo de produtos físicos ou digitais para a IA apresentar e vender."
                      icon={Package}
                      iconColor="blue"
                      enabled={modules.products}
                      onChange={(v) => updateModule('products', v)}
                    />
                    <ModuleToggle
                      label="Serviços"
                      description="Catálogo de serviços prestados com preços e duração para a IA informar."
                      icon={Wrench}
                      iconColor="purple"
                      enabled={modules.services}
                      onChange={(v) => updateModule('services', v)}
                    />
                    <ModuleToggle
                      label="Pedidos"
                      description="Permite que a IA processe pedidos e gere links de pagamento via Stripe."
                      icon={ShoppingCart}
                      iconColor="emerald"
                      enabled={modules.orders}
                      onChange={(v) => updateModule('orders', v)}
                    />
                    <ModuleToggle
                      label="Agendamentos"
                      description="Permite que a IA marque agendamentos automaticamente no sistema."
                      icon={Calendar}
                      iconColor="amber"
                      enabled={modules.appointments}
                      onChange={(v) => updateModule('appointments', v)}
                    />
                  </div>
                </div>

                {/* APPOINTMENT HOURS */}
                {modules.appointments && (
                  <div className="glass-panel p-6 flex flex-col gap-5">
                    <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                      <AlarmClock className="w-5 h-5 text-amber-400" />
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-white">Horários de Agendamento</span>
                        <span className="text-xs text-white/40">A IA só confirmará agendamentos dentro dessas janelas de horário. Fora delas, informará os horários disponíveis ao cliente.</span>
                      </div>
                    </div>
                    {/* Minimum lead time */}
                    <div className="flex flex-col gap-2 border-b border-white/5 pb-4 mb-2">
                      <label className="text-xs text-white/80 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> Antecedência Mínima para Agendamento
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          max="72"
                          value={appointmentLeadTime}
                          onChange={(e) => setAppointmentLeadTime(e.target.value)}
                          className="glass-input w-24 text-sm"
                        />
                        <span className="text-xs text-white/60">
                          horas de antecedência mínimas necessárias para um cliente agendar um horário.
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40">
                        Se definido como 2 horas, por exemplo, o cliente só poderá agendar horários que sejam pelo menos 2 horas no futuro. Defina 0 para permitir agendamentos imediatos.
                      </span>
                    </div>
                    {/* Reminder lead time */}
                    <div className="flex flex-col gap-2 border-b border-white/5 pb-4 mb-2">
                      <label className="text-xs text-white/80 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <AlarmClock className="w-3.5 h-3.5 text-amber-400" /> Antecedência para Enviar Lembrete
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          max="72"
                          value={appointmentReminderLeadTime}
                          onChange={(e) => setAppointmentReminderLeadTime(e.target.value)}
                          className="glass-input w-24 text-sm"
                        />
                        <span className="text-xs text-white/60">
                          horas de antecedência para enviar a mensagem de lembrete antes do atendimento.
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40">
                        A Alice enviará uma mensagem automática no WhatsApp do cliente exatamente X horas antes do início do agendamento dele. Defina 0 para desativar lembretes automáticos.
                      </span>
                    </div>
                    {/* Slot interval minutes */}
                    <div className="flex flex-col gap-2 border-b border-white/5 pb-4 mb-2">
                      <label className="text-xs text-white/80 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> Intervalo de Horários para Enfileiramento
                      </label>
                      <div className="flex items-center gap-3">
                        <select
                          value={appointmentSlotInterval}
                          onChange={(e) => setAppointmentSlotInterval(parseInt(e.target.value))}
                          className="glass-input w-36 text-sm font-sans bg-white dark:bg-[#0d0e16] cursor-pointer"
                        >
                          <option value="15">15 minutos</option>
                          <option value="30">30 minutos</option>
                          <option value="60">60 minutos (1 hora)</option>
                        </select>
                        <span className="text-xs text-white/60">
                          alinhamento fixo dos minutos sugeridos/agendados pela IA.
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40">
                        Arredonda os horários oferecidos ao cliente em blocos fixos. Isso evita minutos quebrados (como 15:47) e garante que o slot não expire enquanto o cliente digita a resposta.
                      </span>
                    </div>
                    <BusinessHoursGrid
                      label="Dias e horários disponíveis para marcação"
                      icon={Clock}
                      hours={appointmentHours}
                      onChange={setAppointmentHours}
                    />
                  </div>
                )}

                {/* ORDER HOURS */}
                {modules.orders && (
                  <div className="glass-panel p-6 flex flex-col gap-5">
                    <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                      <ShoppingCart className="w-5 h-5 text-emerald-400" />
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-white">Horários para Pedidos</span>
                        <span className="text-xs text-white/40">A IA só aceitará pedidos dentro dessas janelas. Fora delas, informará ao cliente quando poderá fazer o pedido.</span>
                      </div>
                    </div>
                    <BusinessHoursGrid
                      label="Dias e horários disponíveis para pedidos"
                      icon={ShoppingCart}
                      hours={orderHours}
                      onChange={setOrderHours}
                    />
                  </div>
                )}

              </div>
            )}

            {/* -------------------- TAB 4: SEGURANÇA & LGPD -------------------- */}
            {activeTab === 'security' && (
              <div className="flex flex-col gap-8">
                
                {/* COMPLIANCE SETTINGS */}
                <div className="glass-panel p-6 flex flex-col gap-5">
                  <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <div className="flex flex-col">
                      <span className="text-base font-bold text-white">Privacidade & LGPD</span>
                      <span className="text-xs text-white/40">Garanta a conformidade jurídica com a proteção de dados de seus contatos.</span>
                    </div>
                  </div>

                  {/* LGPD Consent Banner Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex flex-col gap-1 max-w-[80%]">
                      <span className="text-sm font-semibold text-white">Solicitar Consentimento Ativo</span>
                      <span className="text-xs text-white/50">Se habilitado, a Alice enviará um aviso de privacidade legal antes de processar perguntas de novos clientes.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={lgpdConsentRequired}
                        onChange={(e) => setLgpdConsentRequired(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* Data Retention selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-white/80 font-bold uppercase tracking-wider">Prazo de Retenção de Conversas</label>
                    <div className="relative">
                      <select
                        value={dataRetentionMonths}
                        onChange={(e) => setDataRetentionMonths(parseInt(e.target.value))}
                        className="glass-input w-full text-sm font-sans bg-white dark:bg-[#0d0e16] appearance-none pr-10 cursor-pointer"
                      >
                        <option value="3" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">3 meses</option>
                        <option value="6" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">6 meses</option>
                        <option value="12" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">12 meses (Recomendado)</option>
                        <option value="24" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">24 meses</option>
                        <option value="120" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">Indefinido</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <span className="text-[10px] text-white/40">Os registros de chats mais antigos do que este período serão anonimizados ou excluídos permanentemente.</span>
                  </div>
                </div>

                {/* DATA ENCRYPTION SECURITY ALERT CAROUSEL */}
                <div className="glass-panel p-6 border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-3">
                  <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-emerald-400" /> Infraestrutura e Proteção Ativa
                  </span>
                  <p className="text-xs text-white/80 leading-relaxed">
                    Sua conta está operando sob criptografia rígida AES-256 em trânsito e em repouso. O isolamento de banco de dados do Supabase (RLS) garante que nenhuma informação de conversa ou cliente possa ser acessada por outros workspaces.
                  </p>
                  <span className="text-[10px] text-emerald-400/60 font-semibold">✓ Em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</span>
                </div>

              </div>
            )}

            {/* Save Buttons footer */}
            <div className="flex justify-end pt-4 border-t border-white/5">
              <button
                type="submit"
                disabled={loading}
                className="glass-btn-primary flex items-center gap-2"
              >
                {loading ? 'Salvando...' : (
                  <>
                    <Check className="w-4 h-4" /> Salvar Configurações
                  </>
                )}
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
};

export default Settings;
