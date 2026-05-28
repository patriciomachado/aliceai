import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  Calendar, 
  Clock, 
  Plus, 
  MapPin, 
  CheckCircle2, 
  User,
  LayoutGrid,
  Kanban,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ChevronDown
} from 'lucide-react';

const Appointments = () => {
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'kanban'
  
  // Editing states
  const [editingAppointment, setEditingAppointment] = useState(null);
  
  // Custom delete confirmation states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);
  
  // Form states
  const [customer, setCustomer] = useState('');
  const [service, setService] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('scheduled');

  // 1. Fetch appointments
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const res = await api.get('/appointments');
      return res.data;
    }
  });

  // Fetch customers list for selection
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data;
    }
  });

  // 2. Book appointment mutation
  const bookAppointmentMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/appointments', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      handleCloseModal();
      showToast('Agendamento cadastrado com sucesso! 🎉');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Erro ao registrar agendamento.');
    }
  });

  // 3. Edit appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/appointments/${editingAppointment.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      handleCloseModal();
      showToast('Agendamento atualizado com sucesso! 🎉');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Erro ao atualizar agendamento.');
    }
  });

  // 4. Quick status update mutation (for Kanban)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await api.put(`/appointments/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      showToast('Status do agendamento atualizado!');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Erro ao atualizar status.');
    }
  });

  // 5. Cancel appointment mutation (DELETE in backend marks status as cancelled)
  const cancelAppointmentMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      showToast('Agendamento marcado como cancelado.');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Erro ao cancelar agendamento.');
    }
  });

  // 6. Permanent Delete appointment mutation
  const deletePermanentMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/appointments/${id}?permanent=true`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      handleCloseModal();
      showToast('Agendamento excluído permanentemente! 🗑️');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Erro ao excluir agendamento.');
    }
  });

  const handleDeletePermanent = (id) => {
    setAppointmentToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeletePermanent = () => {
    if (appointmentToDelete) {
      deletePermanentMutation.mutate(appointmentToDelete);
      setDeleteConfirmOpen(false);
      setAppointmentToDelete(null);
    }
  };

  const handleOpenNew = () => {
    setEditingAppointment(null);
    setCustomer('');
    setService('');
    
    // Set default date to today in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setTime('10:00');
    setDuration('60');
    setNotes('');
    setStatus('scheduled');
    setModalOpen(true);
  };

  const handleOpenEdit = (ap) => {
    setEditingAppointment(ap);
    setCustomer(ap.customer_id);
    setService(ap.service_type);
    setDate(ap.scheduled_date);
    
    // Format time from HH:MM:SS to HH:MM
    const formattedTime = ap.scheduled_time ? ap.scheduled_time.slice(0, 5) : '10:00';
    setTime(formattedTime);
    setDuration(ap.duration_minutes || '60');
    setNotes(ap.notes || '');
    setStatus(ap.status || 'scheduled');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingAppointment(null);
    setCustomer('');
    setService('');
    setDate('');
    setTime('');
    setDuration('60');
    setNotes('');
    setStatus('scheduled');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customer || !service || !date || !time) return;

    const payload = {
      customer_id: customer,
      service_type: service,
      scheduled_date: date,
      scheduled_time: time.length === 5 ? `${time}:00` : time,
      duration_minutes: parseInt(duration, 10) || 60,
      notes: notes || null,
      status
    };

    if (editingAppointment) {
      updateAppointmentMutation.mutate(payload);
    } else {
      bookAppointmentMutation.mutate(payload);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed': 
        return <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2.5 py-0.5 font-bold uppercase flex items-center gap-1"><Check className="w-3 h-3" /> Confirmado</span>;
      case 'completed': 
        return <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-0.5 font-bold uppercase flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Concluído</span>;
      case 'cancelled': 
        return <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2.5 py-0.5 font-bold uppercase flex items-center gap-1"><X className="w-3 h-3" /> Cancelado</span>;
      default: 
        return <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5 font-bold uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Agendado</span>;
    }
  };

  // Kanban Columns definition
  const columns = [
    { id: 'scheduled', name: 'Agendado', bg: 'border-amber-500/10 bg-amber-950/5', hoverBg: 'hover:bg-amber-950/10', titleColor: 'text-amber-400' },
    { id: 'confirmed', name: 'Confirmado', bg: 'border-indigo-500/10 bg-indigo-950/5', hoverBg: 'hover:bg-indigo-950/10', titleColor: 'text-indigo-400' },
    { id: 'completed', name: 'Concluído', bg: 'border-emerald-500/10 bg-emerald-950/5', hoverBg: 'hover:bg-emerald-950/10', titleColor: 'text-emerald-400' },
    { id: 'cancelled', name: 'Cancelado', bg: 'border-red-500/10 bg-red-950/5', hoverBg: 'hover:bg-red-950/10', titleColor: 'text-red-400' }
  ];

  // Helper to transition cards to next/previous column in Kanban
  const transitionStatus = (ap, direction) => {
    const statusOrder = ['scheduled', 'confirmed', 'completed', 'cancelled'];
    const currentIndex = statusOrder.indexOf(ap.status);
    let nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < statusOrder.length) {
      updateStatusMutation.mutate({ id: ap.id, status: statusOrder[nextIndex] });
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full shrink-0">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Agendamento & Calendário</h1>
          <p className="text-white/60 text-sm">Gerencie horários de atendimentos de clientes em tempo real, integrados perfeitamente ao assistente.</p>
        </div>
        
        <div className="flex items-center gap-4 self-end sm:self-center">
          {/* Toggle View */}
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow' : 'text-white/60 hover:text-white'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grade
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow' : 'text-white/60 hover:text-white'}`}
            >
              <Kanban className="w-3.5 h-3.5" /> Kanban
            </button>
          </div>

          <button
            onClick={handleOpenNew}
            className="glass-btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Horário
          </button>
        </div>
      </div>

      {/* Grid Mode View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full p-12 text-center text-xs text-white/40">Carregando horários...</div>
          ) : appointments.length === 0 ? (
            <div className="col-span-full p-12 text-center text-xs text-white/40">Nenhum compromisso agendado</div>
          ) : appointments.map((ap) => (
            <div key={ap.id} className="glass-panel p-6 flex flex-col justify-between gap-5 glow-card transition hover:-translate-y-1">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 text-white/70 font-semibold">{ap.service_type}</span>
                  <span className="text-xs text-white/40 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {ap.scheduled_time ? ap.scheduled_time.slice(0, 5) : '00:00'}</span>
                </div>
                <span className="text-base font-bold text-white flex items-center gap-2 mt-1">
                  <User className="w-4 h-4 text-indigo-400" /> {ap.customers?.name || 'Cliente'}
                </span>
                <p className="text-xs text-white/60 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-indigo-400" /> {ap.scheduled_date}</p>
                {ap.notes && (
                  <p className="text-[11px] text-white/50 border-t border-white/5 pt-2 mt-1 italic">"{ap.notes}"</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Local</span>
                <span className="text-xs text-indigo-400 font-bold flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Loja Física</span>
              </div>

              <div className="flex items-center gap-2 justify-between mt-1">
                <div>
                  {getStatusBadge(ap.status)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(ap)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-white/75 transition cursor-pointer"
                    title="Editar Agendamento"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {ap.status !== 'cancelled' && (
                    <button
                      onClick={() => cancelAppointmentMutation.mutate(ap.id)}
                      className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-amber-400 transition cursor-pointer"
                      title="Cancelar Agendamento"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeletePermanent(ap.id)}
                    className="p-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-lg text-red-400 transition cursor-pointer"
                    title="Excluir Permanentemente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kanban Board Mode View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start overflow-x-auto pb-4">
          {columns.map((col) => {
            const colAppts = appointments.filter(ap => ap.status === col.id);
            return (
              <div key={col.id} className={`glass-panel border p-4 flex flex-col gap-4 min-h-[500px] shrink-0 min-w-[260px] ${col.bg}`}>
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className={`font-bold text-sm tracking-wide ${col.titleColor}`}>{col.name}</span>
                  <span className="text-xs bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-white/50 font-bold">{colAppts.length}</span>
                </div>

                {/* Column Cards */}
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-1">
                  {colAppts.length === 0 ? (
                    <div className="p-8 text-center text-[10px] text-white/20 border border-dashed border-white/5 rounded-xl">Sem compromissos</div>
                  ) : (
                    colAppts.map((ap) => (
                      <div key={ap.id} className="glass-panel p-4 flex flex-col gap-3 glow-card-small transition hover:translate-x-0.5 bg-[#0f111c]/60">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/70 font-semibold self-start">{ap.service_type}</span>
                          <span className="text-xs font-bold text-white leading-tight flex items-center gap-1.5 mt-1">
                            <User className="w-3 h-3 text-indigo-400 shrink-0" /> {ap.customers?.name || 'Cliente'}
                          </span>
                          <div className="flex flex-col gap-1 text-[10px] text-white/40 mt-1">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {ap.scheduled_date}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {ap.scheduled_time ? ap.scheduled_time.slice(0, 5) : '00:00'} ({ap.duration_minutes || 60}m)</span>
                          </div>
                          {ap.notes && (
                            <p className="text-[10px] text-white/50 italic leading-snug border-t border-white/5 pt-1.5 mt-1">"{ap.notes}"</p>
                          )}
                        </div>

                        {/* Kanban Action Bar */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-1">
                          <div className="flex items-center gap-1">
                            <button
                              disabled={ap.status === 'scheduled'}
                              onClick={() => transitionStatus(ap, -1)}
                              className="p-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none rounded transition text-white/60 cursor-pointer"
                              title="Recuar status"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <button
                              disabled={ap.status === 'cancelled'}
                              onClick={() => transitionStatus(ap, 1)}
                              className="p-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none rounded transition text-white/60 cursor-pointer"
                              title="Avançar status"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(ap)}
                              className="p-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded transition text-white/60 hover:text-white cursor-pointer"
                              title="Editar Agendamento"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            {ap.status !== 'cancelled' && (
                              <button
                                onClick={() => cancelAppointmentMutation.mutate(ap.id)}
                                className="p-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded transition text-amber-400 cursor-pointer"
                                title="Cancelar Agendamento"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePermanent(ap.id)}
                              className="p-1 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded transition text-red-400 cursor-pointer"
                              title="Excluir Permanentemente"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CRUD Modal overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 max-w-md w-full flex flex-col gap-6 animate-scale-in bg-white dark:bg-[#090a0f]">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">{editingAppointment ? 'Editar Agendamento' : 'Criar Agendamento'}</span>
              <span className="text-xs text-white/50">Configure horários e serviços para sincronização inteligente.</span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
               <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Cliente</label>
                <div className="relative">
                  <select
                    required
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className="glass-input w-full bg-white dark:bg-[#0d0e16] appearance-none pr-10 cursor-pointer"
                  >
                    <option value="" className="bg-[#090a0f] text-white">Selecione um cliente...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#090a0f] text-white">
                        {c.name} ({c.whatsapp || c.phone || 'Sem número'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Tipo de Serviço</label>
                <input
                  type="text"
                  required
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="glass-input w-full"
                  placeholder="Reparo de iPhone 14"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">Data</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">Horário</label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-medium">Duração (Minutos)</label>
                  <input
                    type="number"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>

                {editingAppointment && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-white/60 font-medium">Status</label>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="glass-input w-full bg-white dark:bg-[#0d0e16] appearance-none pr-10 cursor-pointer"
                      >
                        <option value="scheduled" className="bg-[#090a0f] text-white">Agendado</option>
                        <option value="confirmed" className="bg-[#090a0f] text-white">Confirmado</option>
                        <option value="completed" className="bg-[#090a0f] text-white">Concluído</option>
                        <option value="cancelled" className="bg-[#090a0f] text-white">Cancelado</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-medium">Notas / Observações</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="glass-input w-full min-h-[4rem]"
                  placeholder="Observações ou orientações sobre o reparo..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                {editingAppointment && (
                  <button
                    type="button"
                    onClick={() => handleDeletePermanent(editingAppointment.id)}
                    className="glass-btn bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 mr-auto transition cursor-pointer"
                  >
                    Excluir Permanentemente
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="glass-btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={bookAppointmentMutation.isPending || updateAppointmentMutation.isPending}
                  className="glass-btn-primary"
                >
                  {bookAppointmentMutation.isPending || updateAppointmentMutation.isPending ? 'Salvando...' : editingAppointment ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Premium Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 max-w-sm w-full flex flex-col gap-5 border border-red-500/20 bg-gradient-to-b from-[#1c0c10] to-[#0a0a0f] text-center shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)] animate-scale-in">
            <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-400 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <Trash2 className="w-5 h-5" />
            </div>
            
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-extrabold text-white tracking-tight">Excluir Permanentemente</h3>
              <p className="text-xs text-white/60 leading-relaxed px-1">
                Tem certeza de que deseja <span className="text-red-400 font-semibold">excluir permanentemente</span> este agendamento do banco de dados? Esta ação é irreversível e não pode ser desfeita.
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setAppointmentToDelete(null);
                }}
                className="glass-btn bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 py-2 px-4 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeletePermanent}
                className="glass-btn bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 text-xs rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.3)] transition cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
