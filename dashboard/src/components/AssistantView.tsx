import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  Cpu,
  User,
  Terminal,
  Zap,
  CheckCircle2
} from 'lucide-react';
import api from '../api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } }
};

// Usa el mismo cerebro que el bot real (Claude + prompt del negocio + tools de
// lectura), pero sin reserve_appointment — así el dueño puede preguntar lo que
// sea sobre su negocio sin crear citas reales por accidente.
const AssistantView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'assistant',
      text: 'Puedes preguntarme lo que sea sobre tu negocio: precios, disponibilidad, inventario, horarios. Respondo con IA real usando tus datos configurados. No creo citas reales aquí — para eso, WhatsApp.',
      timestamp: 'Ahora'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const history = messages.map(m => ({ role: m.sender, content: m.text }));

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await api.post('/dashboard/assistant/ask', { message: userMsg.text, history });
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: res.data?.reply || 'No obtuve respuesta. Intenta de nuevo.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Error al consultar al asistente', err);
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: 'No pude responder en este momento. Intenta de nuevo en unos segundos.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-20 max-w-7xl mx-auto"
    >
      <motion.div variants={itemVariants} className="flex justify-between items-end px-2">
        <div>
          <p className="text-micro text-text-secondary">IA real de tu negocio — no le habla a clientes reales ni crea citas</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-accent-tertiary bg-accent-tertiary/10 px-4 py-2 rounded-btn border border-accent-tertiary/20">
          <Zap size={14} />
          Preview
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Chat Simulator Sandbox */}
        <motion.div variants={itemVariants} className="lg:col-span-2 glass-panel p-0 bg-bg-card border-border rounded-card flex flex-col h-[650px] shadow-soft overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-border bg-bg-secondary">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary">
                <Bot size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary">Nexo IA</h4>
                <p className="text-xs font-medium text-text-secondary">IA real con los datos de tu negocio — no le habla a clientes reales ni agenda citas de verdad</p>
              </div>
            </div>
            <span className="badge badge-warning">Preview</span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-bg-primary custom-scrollbar">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id} 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex gap-3 max-w-[85%] items-end">
                    {msg.sender === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-soft">
                        N
                      </div>
                    )}
                    <div className={`p-4 rounded-2xl shadow-sm ${
                      msg.sender === 'user' 
                        ? 'bg-bg-secondary text-text-primary border border-border rounded-br-sm' 
                        : 'bg-accent-primary text-white rounded-bl-sm'
                    }`}>
                      <p className={`text-sm font-medium leading-relaxed ${msg.sender === 'user' ? 'text-text-primary' : 'text-white'}`}>{msg.text}</p>
                    </div>
                    {msg.sender === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center shrink-0 text-text-secondary shadow-sm">
                        <User size={16} />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-text-secondary font-semibold mt-1.5 px-2">{msg.timestamp}</span>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-end gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-soft">
                    N
                  </div>
                  <div className="p-4 rounded-2xl bg-accent-primary rounded-bl-sm flex gap-1.5 items-center">
                    <motion.div className="w-2 h-2 bg-white rounded-full" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                    <motion.div className="w-2 h-2 bg-white rounded-full" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                    <motion.div className="w-2 h-2 bg-white rounded-full" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={chatEndRef} className="h-4" />
          </div>

          {/* Chat Form */}
          <div className="p-6 bg-bg-secondary border-t border-border">
            <form onSubmit={handleSend} className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe un mensaje de prueba..." 
                className="w-full bg-bg-primary border border-border rounded-input py-4 pl-6 pr-16 text-sm font-medium outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all text-text-primary"
              />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!input.trim()}
                className="absolute right-2 w-10 h-10 bg-accent-primary text-white rounded-lg flex items-center justify-center transition-colors hover:bg-blue-800 shadow-soft disabled:opacity-50"
              >
                <Send size={18} />
              </motion.button>
            </form>
          </div>
        </motion.div>

        {/* AI Performance and Analytics Sidebar */}
        <div className="space-y-6">

          <motion.div variants={itemVariants} className="glass-panel space-y-6 border border-border bg-bg-card">
            <h4 className="text-sm font-bold flex items-center gap-2 text-text-primary">
              <Cpu size={16} className="text-accent-primary" /> Parámetros del Cerebro
            </h4>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-text-secondary">Ventana 24 horas</span>
                <span className="badge badge-success text-[10px]">Estricta</span>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-panel space-y-5 border border-border bg-bg-card">
            <h4 className="text-sm font-bold flex items-center gap-2 text-text-primary">
              <Terminal size={16} className="text-accent-primary" /> Funciones (Tools)
            </h4>
            <div className="grid grid-cols-1 gap-3 text-xs font-mono text-text-secondary">
              <div className="p-2 bg-bg-secondary border border-border rounded-md flex items-center gap-2">
                <CheckCircle2 size={12} className="text-semantic-success shrink-0" /> check_availability
              </div>
              <div className="p-2 bg-bg-secondary border border-border rounded-md flex items-center gap-2">
                <CheckCircle2 size={12} className="text-semantic-success shrink-0" /> check_inventory
              </div>
              <div className="p-2 bg-bg-secondary border border-border rounded-md flex items-center gap-2">
                <CheckCircle2 size={12} className="text-semantic-success shrink-0" /> get_services
              </div>
              <div className="p-2 bg-bg-secondary border border-border rounded-md flex items-center gap-2 opacity-50">
                reserve_appointment <span className="text-[10px] normal-case">(solo WhatsApp)</span>
              </div>
            </div>
          </motion.div>

        </div>

      </div>
    </motion.div>
  );
};

export default AssistantView;
