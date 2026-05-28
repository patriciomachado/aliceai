import React, { useState } from 'react';
import { MessageSquare, Send, X, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const Widget = () => {
  const { showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [chatLog, setChatLog] = useState([
    { sender: 'ai', content: 'Olá! Sou a Alice, assistente virtual. Como posso ajudar você hoje?' }
  ]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;

    const userMsg = typed;
    setChatLog(prev => [...prev, { sender: 'user', content: userMsg }]);
    setTyped('');

    // Simulate quick automated AI reply trigger after 1.5 seconds
    setTimeout(() => {
      setChatLog(prev => [...prev, {
        sender: 'ai',
        content: 'Excelente pergunta! Posso buscar essa informação para você ou transferir para um atendente de suporte se preferir. Deseja continuar?'
      }]);
      showToast('Inteligência Artificial processou resposta no Widget.');
    }, 1500);
  };

  return (
    <div className="fixed bottom-6 left-6 z-40 select-none">
      {open ? (
        <div className="w-80 h-96 glass-panel rounded-2xl border border-white/10 flex flex-col justify-between shadow-glowing overflow-hidden bg-white dark:bg-[#090a0f] animate-scale-in">
          {/* Header */}
          <div className="p-3 border-b border-white/5 bg-gradient-to-r from-indigo-900/50 to-purple-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center relative">
                <Sparkles className="w-4 h-4 text-white" />
                <div className="w-2.5 h-2.5 bg-emerald-400 border-2 border-white dark:border-[#090a0f] rounded-full absolute bottom-0 right-0" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Alice Suporte</span>
                <span className="text-[10px] text-emerald-400 font-semibold">Online</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {chatLog.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                  msg.sender === 'ai'
                    ? 'bg-white/5 border border-white/10 text-white self-start'
                    : 'bg-indigo-600 text-white self-end shadow-glowing'
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>

          {/* Input field */}
          <form onSubmit={handleSend} className="p-2 border-t border-white/5 flex gap-2 bg-black/40">
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Digite sua dúvida..."
              className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
            />
            <button type="submit" className="glass-btn-primary p-2 flex items-center justify-center rounded-lg">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-glowing hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/10"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Widget;
