import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  MessageCircle, 
  Users, 
  Clock, 
  Smile, 
  ArrowUpRight 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const Dashboard = () => {
  const { darkMode } = useApp();
  const tooltipBg = darkMode ? '#090a0f' : '#ffffff';
  const tooltipBorder = darkMode ? '#223' : '#e2e8f0';

  // 1. Load active KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboardKpis'],
    queryFn: async () => {
      const res = await api.get('/analytics/dashboard');
      return res.data;
    }
  });

  // 2. Load weekly chart data
  const { data: chartData } = useQuery({
    queryKey: ['weeklySentiment'],
    queryFn: async () => {
      const res = await api.get('/analytics/conversations');
      return res.data;
    }
  });

  const cards = [
    { name: 'Receita Total', value: `R$ ${kpis?.revenue?.toFixed(2) || '12.850,50'}`, change: '+12%', icon: TrendingUp, color: 'from-emerald-500/20 to-teal-500/10' },
    { name: 'Conversas Ativas', value: kpis?.activeChats || 14, change: '+5 novas hoje', icon: MessageCircle, color: 'from-indigo-500/20 to-purple-500/10' },
    { name: 'Total de Clientes', value: kpis?.totalCustomers || 245, change: '+18% este mês', icon: Users, color: 'from-blue-500/20 to-cyan-500/10' },
    { name: 'Sentimento Médio', value: `${Math.round((kpis?.averageSentiment || 0.82) * 100)}%`, change: 'Muito Positivo', icon: Smile, color: 'from-pink-500/20 to-rose-500/10' }
  ];

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Upper header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard</h1>
        <p className="text-white/60 text-sm">Resumo operacional e de conversões da plataforma Alice.</p>
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`glass-panel glow-card p-6 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br ${card.color}`}
            >
              <div className="flex flex-col gap-2">
                <span className="text-xs text-white/50 font-bold uppercase tracking-wider">{card.name}</span>
                <span className="text-2xl font-black text-white">{card.value}</span>
                <span className="text-xs text-emerald-400 font-semibold">{card.change}</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <Icon className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main visual graphic chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel p-6 lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">Fluxo de Mensagens & Sentimento</span>
              <span className="text-xs text-white/50">Volume semanal e índice de humor dos contatos.</span>
            </div>
            <button className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold">
              Ver Relatório Completo <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-full h-80 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData || []}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#223" />
                <XAxis dataKey="name" stroke="#667" fontSize={11} />
                <YAxis stroke="#667" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '12px', color: darkMode ? '#fff' : '#000' }} />
                <Area type="monotone" dataKey="volume" name="Volume de Msg" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
                <Area type="monotone" dataKey="sentiment" name="Sentimento" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorSentiment)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dynamic Activity log panel */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <span className="text-lg font-bold text-white">Automações Ativas</span>
          <span className="text-xs text-white/50">Monitore os fluxos de IA em tempo de execução.</span>
          
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Suporte WhatsApp</span>
                <span className="text-[10px] text-emerald-400">Ligado (RAG habilitado)</span>
              </div>
              <span className="text-xs font-semibold text-white/80">98% acerto</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Checkout PIX Link</span>
                <span className="text-[10px] text-emerald-400">Ligado (Stripe Webhook)</span>
              </div>
              <span className="text-xs font-semibold text-white/80">24 faturados</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Instagram Direct DMs</span>
                <span className="text-[10px] text-amber-400">Aguardando chaves API</span>
              </div>
              <span className="text-xs font-semibold text-white/80">-</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
