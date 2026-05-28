import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  Plus, 
  Search, 
  Tag, 
  Trash2, 
  Edit3, 
  Mail, 
  Phone,
  ChevronDown 
} from 'lucide-react';

const Customers = () => {
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  
  // Modal toggle states
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // 1. Fetch CRM customers list
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', search, selectedTag],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: { search, tag: selectedTag }
      });
      return res.data;
    }
  });

  // 2. Mutator to create a customer
  const createCustomerMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/customers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setWhatsapp('');
      setTagsInput('');
      showToast('Cliente adicionado com sucesso!');
    }
  });

  // 3. Mutator to delete customer
  const deleteCustomerMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showToast('Cliente removido com sucesso.');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    createCustomerMutation.mutate({
      name,
      email: email || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      tags: tagsInput ? tagsInput.split(',').map(t => t.trim()) : []
    });
  };

  return (
    <div className="flex flex-col gap-8 w-full shrink-0">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Clientes (CRM)</h1>
          <p className="text-white/60 text-sm">Gerencie contatos de leads, histórico de compras e tags de categorização.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="glass-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* Filters panels */}
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-white/30"
          />
        </div>

        <div className="relative">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-white/5 border border-white/5 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground dark:text-white/80 cursor-pointer appearance-none animate-none"
          >
            <option value="" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">Filtrar por Tag</option>
            <option value="vip" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">VIP</option>
            <option value="lead-quente" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">Lead Quente</option>
            <option value="atencao" className="bg-white dark:bg-[#090a0f] text-foreground dark:text-white">Atenção</option>
          </select>
          <ChevronDown className="w-4 h-4 text-white/40 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Grid listing table */}
      <div className="glass-panel overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-white/40">Carregando contatos...</div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-xs text-white/40">Nenhum cliente cadastrado</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xs text-white/50 font-bold uppercase">
                <th className="p-4">Cliente</th>
                <th className="p-4">Contato</th>
                <th className="p-4">Tags</th>
                <th className="p-4">Total Gasto</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {customers.map((c) => {
                const tags = Array.isArray(c.tags) ? c.tags : JSON.parse(c.tags || '[]');
                return (
                  <tr key={c.id} className="hover:bg-white/5 transition-all">
                    <td className="p-4 font-bold text-white">{c.name}</td>
                    <td className="p-4 flex flex-col gap-1">
                      {c.email && <span className="flex items-center gap-1.5 text-white/60 text-xs"><Mail className="w-3.5 h-3.5 text-indigo-400" /> {c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1.5 text-white/60 text-xs"><Phone className="w-3.5 h-3.5 text-indigo-400" /> {c.phone}</span>}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-white/5 text-white/80 border border-white/10 rounded-full px-2.5 py-0.5 flex items-center gap-1"
                          >
                            <Tag className="w-2.5 h-2.5 text-indigo-400" /> {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-emerald-400">R$ {Number(c.lifetime_value).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button className="text-white/60 hover:text-white transition cursor-pointer">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteCustomerMutation.mutate(c.id)}
                          className="text-red-400 hover:text-red-300 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CRUD creator Modal overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 max-w-md w-full flex flex-col gap-6 animate-scale-in bg-white dark:bg-[#090a0f]">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">Adicionar Novo Cliente</span>
              <span className="text-xs text-white/50">Crie o registro CRM do lead para mapear automações.</span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Telefone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="glass-input w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">WhatsApp</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="glass-input w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Tags (separadas por vírgula)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="glass-input w-full"
                  placeholder="vip, lead-quente"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="glass-btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createCustomerMutation.isPending}
                  className="glass-btn-primary"
                >
                  {createCustomerMutation.isPending ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
