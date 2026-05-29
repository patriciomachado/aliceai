import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Sparkles, MessageSquare, ShoppingBag, Cpu, Calendar } from 'lucide-react';

const Welcome = () => {
  return (
    <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-[#020205] text-white font-sans overflow-y-auto selection:bg-indigo-600 selection:text-white relative">
      {/* Background neon glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="absolute top-[40%] right-[30%] w-[30%] h-[30%] rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>

      {/* Left side: Branding & Bento Features */}
      <div className="flex-1 flex flex-col justify-between p-8 lg:p-16 z-10 border-r border-white/5">
        {/* Header Logo */}
        <div className="flex items-center gap-3">
          <img src="/logoalice.png" alt="Alice Logo" className="w-10 h-10 rounded-2xl object-cover shadow-lg shadow-indigo-600/30" />
          <span className="text-xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70 uppercase font-outfit">Alice</span>
        </div>

        {/* Hero Section */}
        <div className="my-12 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 mb-6 uppercase tracking-wider animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> IA Autônoma Ativa
          </div>
          <h1 className="text-4xl lg:text-5xl font-black leading-tight tracking-tight font-outfit">
            A inteligência que gerencia seu negócio de <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">forma autônoma.</span>
          </h1>
          <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-lg">
            Alice atende clientes no WhatsApp, processa pedidos multicanal (varejo, açougue, lanchonete), agenda serviços de forma inteligente e gerencia todo o faturamento de maneira autônoma.
          </p>
        </div>

        {/* Bento Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div className="glass-panel p-5 border border-white/5 bg-white/2 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-white">Atendimento Autônomo</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Agente IA de conversação no WhatsApp que tira dúvidas, envia catálogos e vende de verdade.
            </p>
          </div>

          <div className="glass-panel p-5 border border-white/5 bg-white/2 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-white">Multi-Nichos de Pedidos</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Adaptação inteligente para açougues (balança/cortes), lanchonetes (adicionais) e varejo.
            </p>
          </div>

          <div className="glass-panel p-5 border border-white/5 bg-white/2 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Cpu className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-white">Automações Poderosas</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Fluxos de trabalho com webhook e regras condicionais que ativam ações automáticas.
            </p>
          </div>

          <div className="glass-panel p-5 border border-white/5 bg-white/2 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-white">Agendamento Inteligente</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Reserva de horários no calendário sincronizados com a disponibilidade do prestador.
            </p>
          </div>
        </div>

        {/* Footer text */}
        <div className="mt-12 text-xs text-white/30">
          &copy; 2026 Alice Platform. Todos os direitos reservados.
        </div>
      </div>

      {/* Right side: Glass card containing Clerk's login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 z-10">
        <div className="glass-panel p-6 border border-white/10 shadow-2xl relative bg-black/40 backdrop-blur-2xl max-w-md w-full rounded-3xl">
          <SignIn 
            routing="hash"
            appearance={{
              variables: {
                colorPrimary: '#6366f1',
                colorBackground: '#020205',
                colorText: '#ffffff',
                colorTextSecondary: '#a1a1aa',
                colorInputBackground: '#090a0f',
                colorInputText: '#ffffff',
                colorBorder: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
              },
              elements: {
                card: 'bg-transparent border-0 shadow-none p-0 m-0 w-full',
                headerTitle: 'text-white font-extrabold text-2xl tracking-tight text-center font-outfit',
                headerSubtitle: 'text-white/50 text-sm font-medium text-center',
                socialButtonsBlockButton: 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all font-semibold rounded-xl py-2.5 shadow-sm',
                socialButtonsBlockButtonText: 'text-white font-medium text-sm',
                formButtonPrimary: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition-all font-bold rounded-xl py-3 shadow-lg shadow-indigo-600/20 active:scale-95 text-sm uppercase tracking-wider',
                formFieldInput: 'bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent rounded-xl py-2.5 px-4 text-sm font-medium font-sans',
                formFieldLabel: 'text-white/60 font-bold text-xs uppercase tracking-wide',
                footerActionText: 'text-white/50 text-xs',
                footerActionLink: 'text-indigo-400 hover:text-indigo-300 font-bold transition text-xs',
                dividerText: 'text-white/30 font-bold text-xs uppercase tracking-wide',
                dividerLine: 'bg-white/10',
                identityPreviewText: 'text-white',
                identityPreviewEditButton: 'text-indigo-400 hover:text-indigo-300 font-semibold',
                formFieldInputShowPasswordButton: 'text-white/40 hover:text-white',
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Welcome;
