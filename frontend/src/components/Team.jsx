import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  ShieldCheck, 
  Mail, 
  Plus, 
  Trash2,
  UserCheck
} from 'lucide-react';

const Team = () => {
  const { showToast } = useApp();

  // 1. Fetch team members list
  const { data: team = [], isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const res = await api.get('/team');
      return res.data;
    }
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2.5 py-0.5 font-bold uppercase">Administrador</span>;
      case 'manager': return <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5 font-bold uppercase">Gerente</span>;
      default: return <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2.5 py-0.5 font-bold uppercase">Atendente</span>;
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full shrink-0">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Gerenciamento de Equipe</h1>
          <p className="text-white/60 text-sm">Controle as permissões de acesso da sua equipe e distribua conversas automaticamente por atendente.</p>
        </div>
        <button
          onClick={() => showToast('Disponível na versão PRO.', 'warning')}
          className="glass-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Convidar Membro
        </button>
      </div>

      {/* Team table grid */}
      <div className="glass-panel overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-white/40">Carregando membros...</div>
        ) : team.length === 0 ? (
          <div className="p-12 text-center text-xs text-white/40">Nenhum operador cadastrado</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xs text-white/50 font-bold uppercase">
                <th className="p-4">Operador</th>
                <th className="p-4">Email</th>
                <th className="p-4">Cargo Permissão</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {team.map((member) => (
                <tr key={member.id || member.email} className="hover:bg-white/5 transition-all">
                  <td className="p-4 font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-400" /> {member.name}
                  </td>
                  <td className="p-4 text-white/60">
                    <span className="flex items-center gap-1.5 text-xs"><Mail className="w-3.5 h-3.5 text-indigo-400" /> {member.email}</span>
                  </td>
                  <td className="p-4">{getRoleBadge(member.role)}</td>
                  <td className="p-4">
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                      ● Ativo
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => showToast('Ação restrita a administradores do workspace.', 'error')}
                      className="text-red-400 hover:text-red-300 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Team;
