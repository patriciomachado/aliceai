import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { Download, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Analytics = () => {
  const { showToast, darkMode } = useApp();
  const tooltipBg = darkMode ? '#090a0f' : '#ffffff';
  const tooltipBorder = darkMode ? '#223' : '#e2e8f0';

  // Load weekly log data
  const { data: chartData } = useQuery({
    queryKey: ['analyticsData'],
    queryFn: async () => {
      const res = await api.get('/analytics/conversations');
      return res.data;
    }
  });

  const handleExport = () => {
    showToast('Exportando dados analíticos em formato CSV...');
    window.open('http://localhost:3000/api/analytics/export', '_blank');
  };

  return (
    <div className="flex flex-col gap-8 w-full shrink-0">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Relatórios & Analytics</h1>
          <p className="text-white/60 text-sm">Acompanhe as métricas de conversão de leads, receita faturada e produtividade do cérebro de IA.</p>
        </div>
        <button
          onClick={handleExport}
          className="glass-btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Exportar Dados (CSV)
        </button>
      </div>

      {/* Grid reports graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: Revenue totals */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <span className="text-base font-bold text-white">Métricas de Sentimento dos Clientes</span>
          <span className="text-xs text-white/50">Monitore o índice de satisfação compilado nas mensagens de WhatsApp.</span>

          <div className="w-full h-80 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#223" />
                <XAxis dataKey="name" stroke="#667" fontSize={11} />
                <YAxis stroke="#667" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '12px', color: darkMode ? '#fff' : '#000' }} />
                <Legend />
                <Line type="monotone" dataKey="sentiment" name="Média de Humor" stroke="#ec4899" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Conversation volume */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <span className="text-base font-bold text-white">Volume de Atendimentos por Dia</span>
          <span className="text-xs text-white/50">Mapeie os horários e dias de maior tráfego de mensagens na plataforma.</span>

          <div className="w-full h-80 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#223" />
                <XAxis dataKey="name" stroke="#667" fontSize={11} />
                <YAxis stroke="#667" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '12px', color: darkMode ? '#fff' : '#000' }} />
                <Legend />
                <Bar dataKey="volume" name="Mensagens Recebidas" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Analytics;
