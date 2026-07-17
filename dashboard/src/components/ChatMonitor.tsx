import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MessageSquare,
  ShieldAlert,
  Clock,
  CheckCheck,
  Zap,
  MessageCircle as Whatsapp
} from 'lucide-react';
import api from '../api';
import { useStore } from '../store/useStore';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } }
};

const messageVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 25 } }
};

const ChatSkeleton = () => (
  <div className="flex h-[calc(100vh-140px)] gap-8">
    <div className="w-96 bg-border animate-pulse rounded-card"></div>
    <div className="flex-1 bg-border animate-pulse rounded-card"></div>
  </div>
);

const ChatMonitor: React.FC = () => {
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedPhone, setSelectedPhone } = useStore();
  const [togglingMute, setTogglingMute] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChats = async () => {
    try {
      const res = await api.get('/dashboard/chats');
      setChats(res.data);
    } catch (e) { 
      console.error(e); 
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (phone: string) => {
    try {
      const res = await api.get(`/dashboard/chats/${phone}`);
      setMessages(res.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPhone) {
      loadMessages(selectedPhone);
      const interval = setInterval(() => loadMessages(selectedPhone), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedPhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedPhone) return;
    try {
      await api.post(`/dashboard/chats/${selectedPhone}/send`, { message: input });
      setInput('');
      loadMessages(selectedPhone);
    } catch (e) { console.error(e); }
  };

  // Silencia/reactiva a ESTE cliente de verdad en el backend (antes era un
  // interruptor puramente visual que no cambiaba nada en el bot real).
  const toggleIntervention = async (phone: string) => {
    const chat = chats.find(c => c.phone === phone);
    if (!chat || togglingMute) return;
    setTogglingMute(true);
    try {
      const endpoint = chat.isMuted ? 'unmute' : 'mute';
      await api.post(`/dashboard/chats/${phone}/${endpoint}`);
      setChats(prev => prev.map(c => c.phone === phone ? { ...c, isMuted: !c.isMuted } : c));
    } catch (e) {
      console.error('Error al cambiar intervención manual', e);
      alert('No se pudo cambiar el modo de intervención. Intenta de nuevo.');
    } finally {
      setTogglingMute(false);
    }
  };

  const currentChat = chats.find(c => c.phone === selectedPhone);

  if (loading) return <ChatSkeleton />;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex h-[calc(100vh-140px)] gap-8 max-w-7xl mx-auto pb-4"
    >
      {/* Lista de Chats */}
      <div className="w-96 glass-panel p-0 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-border bg-bg-secondary">
          <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
            <MessageSquare size={18} className="text-accent-primary" /> 
            Conversaciones
          </h3>
        </div>
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar"
        >
          <AnimatePresence>
            {chats.map((chat) => {
              const isSelected = selectedPhone === chat.phone;
              return (
                <motion.button
                  key={chat.phone}
                  variants={itemVariants}
                  layout
                  onClick={() => setSelectedPhone(chat.phone)}
                  className={`w-full p-4 rounded-card transition-colors flex items-center gap-4 relative overflow-hidden text-left ${
                    isSelected 
                      ? 'bg-accent-primary/10 border border-accent-primary/30' 
                      : 'hover:bg-bg-secondary border border-transparent'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 transition-colors ${
                    isSelected ? 'bg-accent-primary text-white shadow-soft' : 'bg-bg-secondary border border-border text-text-primary'
                  }`}>
                    {chat.name[0]}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <p className={`font-semibold text-sm truncate ${isSelected ? 'text-accent-primary' : 'text-text-primary'}`}>
                        {chat.name}
                      </p>
                      {chat.isMuted && (
                        <span className="shrink-0 badge badge-danger !px-1.5 !py-0.5 !text-[9px]">Manual</span>
                      )}
                    </div>
                    <p className={`text-xs truncate font-medium ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                       {chat.lastMessage || 'Sin mensajes nuevos'}
                    </p>
                  </div>
                  {isSelected && (
                    <motion.div 
                      layoutId="activeChat"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-accent-primary rounded-r-full"
                    />
                  )}
                </motion.button>
              )
            })}
          </AnimatePresence>
          {chats.length === 0 && (
             <p className="text-center py-10 text-sm text-text-secondary">Sin chats activos</p>
          )}
        </motion.div>
      </div>

      {/* Ventana de Chat */}
      <div className="flex-1 glass-panel p-0 flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">
          {!selectedPhone ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6"
            >
               <div className="w-20 h-20 bg-bg-secondary rounded-full flex items-center justify-center text-border border border-border">
                  <MessageSquare size={32} />
               </div>
               <div className="space-y-2">
                  <h3 className="text-xl font-bold text-text-primary">Buzón de Mensajes</h3>
                  <p className="text-sm text-text-secondary max-w-xs mx-auto">
                     Selecciona un cliente de la lista para iniciar la intervención humana asistida.
                  </p>
               </div>
            </motion.div>
          ) : (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col h-full"
            >
              {/* Header del Chat */}
              <div className="p-6 border-b border-border flex justify-between items-center bg-bg-secondary">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent-primary flex items-center justify-center font-bold text-white shadow-soft">
                    {currentChat?.name[0] || 'C'}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-base text-text-primary leading-tight">
                        {currentChat?.name || 'Cliente'}
                      </p>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase text-[#25D366] bg-[#25D366]/10">
                        <Whatsapp size={12} />
                        WhatsApp
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end mr-2">
                     <p className="text-micro text-text-secondary">Intervención</p>
                     <p className={`text-xs font-bold ${currentChat?.isMuted ? 'text-semantic-danger' : 'text-accent-primary'}`}>
                        {currentChat?.isMuted ? 'Manual (bot silenciado)' : 'IA Automática'}
                     </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: togglingMute ? 1 : 1.05 }}
                    whileTap={{ scale: togglingMute ? 1 : 0.95 }}
                    onClick={() => toggleIntervention(selectedPhone)}
                    disabled={togglingMute}
                    title={currentChat?.isMuted ? 'Reactivar respuestas automáticas del bot' : 'Silenciar al bot para este cliente (intervención manual)'}
                    className={`p-3 rounded-xl transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                      currentChat?.isMuted
                        ? 'bg-semantic-danger text-white hover:bg-red-700'
                        : 'bg-bg-primary border border-border text-text-secondary hover:text-accent-primary hover:border-accent-primary/30'
                    }`}
                  >
                    {currentChat?.isMuted ? <ShieldAlert size={20} /> : <Zap size={20} />}
                  </motion.button>
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-bg-primary relative custom-scrollbar">
                <AnimatePresence initial={false}>
                  {messages.map((m, i) => (
                    <motion.div 
                      key={i} 
                      variants={messageVariants}
                      initial="hidden"
                      animate="show"
                      layout
                      className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'} relative z-10`}
                    >
                      <div className={`max-w-[75%] p-4 rounded-2xl shadow-sm ${
                        m.role === 'user' 
                          ? 'bg-bg-secondary border border-border text-text-primary rounded-tl-sm' 
                          : 'bg-accent-primary text-white rounded-tr-sm'
                      }`}>
                        <p className={`text-sm font-medium leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'text-text-primary' : 'text-white'}`}>{m.content}</p>
                        <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${m.role === 'user' ? 'text-text-secondary' : 'text-white/80'}`}>
                          <Clock size={12} /> {new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          {m.role !== 'user' && <CheckCheck size={14} className="ml-1" />}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} className="h-2" />
              </div>

              {/* Input */}
              <div className="p-6 bg-bg-secondary border-t border-border">
                <form onSubmit={sendMessage} className="relative flex items-center">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="w-full bg-bg-primary border border-border rounded-input py-4 pl-6 pr-16 text-sm font-medium outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all text-text-primary"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="absolute right-2 w-10 h-10 bg-accent-primary text-white rounded-lg flex items-center justify-center transition-colors hover:bg-blue-800 shadow-soft disabled:opacity-50"
                    disabled={!input.trim()}
                  >
                    <Send size={18} />
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ChatMonitor;
