import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Power, Heart, ShieldAlert, Sparkles, Save, CheckCircle2 } from 'lucide-react';
import api from '../api';

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

const DEFAULT_WELCOME = "¡Hola! Bienvenido a Nexo Barbershop. ¿En qué podemos ayudarte hoy? 💈";
const DEFAULT_PROMO = "Este mes: 10% de descuento en productos de cuidado capilar.";

const IASettingsView: React.FC = () => {
  const [botActive, setBotActive] = useState(true);
  const [botLoading, setBotLoading] = useState(true);
  const [togglingBot, setTogglingBot] = useState(false);
  const [tone, setTone] = useState('friendly');
  const [welcomeMsg, setWelcomeMsg] = useState(DEFAULT_WELCOME);
  const [promo, setPromo] = useState(DEFAULT_PROMO);

  const personalities = [
    { id: 'friendly', label: 'Amigable', desc: 'Cercano, usa emojis y es muy atento.', instruction: 'Usa un lenguaje cercano, amable y muchos emojis de barbería.' },
    { id: 'pro', label: 'Profesional', desc: 'Serio, directo y enfocado en la eficiencia.', instruction: 'Sé profesional, formal, serio y muy eficiente en las respuestas.' },
    { id: 'funny', label: 'Divertido', desc: 'Relajado, hace bromas ligeras de barbería.', instruction: 'Usa un tono relajado, divertido y haz bromas ligeras sobre el cabello.' }
  ];

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/dashboard/config');
        const config = res.data?.config;
        if (config) {
          // Hidratar con lo ya guardado — antes esta pantalla siempre volvía
          // a mostrar los valores de ejemplo, y "Aplicar Cambios" los pisaba
          // encima de la configuración real sin que el dueño se diera cuenta.
          if (typeof config.welcomeMessage === 'string' && config.welcomeMessage) {
            setWelcomeMsg(config.welcomeMessage);
          }
          if (typeof config.personality === 'string' && config.personality) {
            // personality se guarda como "<instrucción del tono> <promo>";
            // separamos por la instrucción conocida para reconstruir ambos campos.
            const matchedTone = personalities.find(p => config.personality.startsWith(p.instruction));
            if (matchedTone) {
              setTone(matchedTone.id);
              setPromo(config.personality.slice(matchedTone.instruction.length).trim() || DEFAULT_PROMO);
            } else {
              setPromo(config.personality);
            }
          }
        }
      } catch (e) {
        console.error("Error loading config", e);
      }
    };

    const fetchBotStatus = async () => {
      try {
        const res = await api.get('/dashboard/bot/status');
        setBotActive(!res.data.paused);
      } catch (e) {
        console.error("Error loading bot status", e);
      } finally {
        setBotLoading(false);
      }
    };

    fetchConfig();
    fetchBotStatus();
  }, []);

  const toggleBot = async () => {
    setTogglingBot(true);
    try {
      const res = botActive
        ? await api.post('/dashboard/bot/pause')
        : await api.post('/dashboard/bot/resume');
      setBotActive(!res.data.paused);
    } catch (e) {
      console.error("Error al cambiar estado del bot", e);
      alert('No se pudo cambiar el estado del bot. Intenta de nuevo.');
    } finally {
      setTogglingBot(false);
    }
  };

  const handleSave = async () => {
    try {
      const personality = personalities.find(p => p.id === tone)?.instruction || '';
      
      const res = await api.get('/dashboard/config');
      const existingConfig = res.data?.config || {};

      await api.put('/dashboard/config', { 
        name: res.data?.name || 'Nexo Barbershop',
        config: {
          ...existingConfig,
          personality: `${personality} ${promo}`, 
          welcomeMessage: welcomeMsg 
        }
      });

      const notification = document.createElement('div');
      notification.className = "fixed bottom-10 right-10 bg-semantic-success text-white px-6 py-4 rounded-card shadow-hover z-[100] font-semibold text-sm animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3";
      notification.innerHTML = `<span class="bg-white/20 p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> ¡Cerebro de Nexo IA actualizado!`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    } catch (e) {
      console.error("Error al guardar ajustes de IA:", e);
      alert("Error al guardar la configuración");
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto space-y-10 pb-20"
    >
      <motion.div variants={itemVariants} className="flex justify-between items-center">
        <div>
          <p className="text-micro text-text-secondary">Sincronización en tiempo real con la lógica del Bot</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.04, boxShadow: '0 8px 20px rgba(29,78,216,0.18)' }}
          whileTap={{ scale: 0.96 }}
          onClick={handleSave}
          className="flex items-center gap-2 px-8 py-3.5 bg-accent-primary text-white rounded-btn text-sm font-semibold transition-colors hover:bg-blue-800"
        >
          <Save size={18} /> Aplicar Cambios
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Interruptor Maestro */}
        <div className="lg:col-span-1 space-y-6">
           <motion.div 
             variants={itemVariants}
             className={`glass-panel border-2 transition-colors duration-500 ${
               botActive ? 'border-accent-tertiary/30 bg-accent-tertiary/5' : 'border-semantic-danger/30 bg-semantic-danger/5'
             }`}
           >
              <div className="flex flex-col items-center text-center gap-6">
                 <motion.div 
                   animate={botActive ? { scale: [1, 1.1, 1] } : {}}
                   transition={{ repeat: Infinity, duration: 2 }}
                   className={`p-5 rounded-full transition-colors duration-500 ${
                     botActive ? 'bg-accent-tertiary/20 text-accent-tertiary shadow-soft' : 'bg-semantic-danger/20 text-semantic-danger'
                   }`}
                 >
                    <Power size={32} />
                 </motion.div>
                 <div>
                    <h3 className="font-bold text-sm text-text-primary">Estado Maestro</h3>
                    <p className={`text-micro mt-1 ${botActive ? 'text-accent-tertiary' : 'text-semantic-danger'}`}>
                       {botLoading ? 'Consultando...' : botActive ? 'IA Operativa' : 'IA Fuera de Servicio'}
                    </p>
                 </div>
                 <motion.button
                   whileHover={{ scale: togglingBot ? 1 : 1.02 }}
                   whileTap={{ scale: togglingBot ? 1 : 0.98 }}
                   onClick={toggleBot}
                   disabled={botLoading || togglingBot}
                   className={`w-full py-3 rounded-btn text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                     botActive
                       ? 'bg-semantic-danger text-white hover:bg-red-700'
                       : 'bg-brand-success text-white hover:bg-green-800'
                   }`}
                 >
                   {togglingBot ? 'Aplicando...' : botActive ? 'Pausar Agente' : 'Iniciar Agente'}
                 </motion.button>
                 <p className="text-[11px] text-text-secondary font-medium -mt-2">
                   {botActive
                     ? 'El bot responde a todos los clientes por WhatsApp.'
                     : 'El bot está pausado de verdad: no responderá a ningún cliente hasta que lo reactives.'}
                 </p>
              </div>
           </motion.div>

           <motion.div variants={itemVariants} className="glass-panel space-y-4">
              <h3 className="text-micro text-text-secondary flex items-center gap-2">
                <ShieldAlert size={14} className="text-accent-primary" /> Protocolo de Seguridad
              </h3>
              <p className="text-xs text-text-secondary font-medium leading-relaxed">
                Cualquier cambio aquí se aplica instantáneamente al modelo de lenguaje. No requiere reinicio del servidor.
              </p>
           </motion.div>
        </div>

        {/* Configuraciones de Voz y Texto */}
        <div className="lg:col-span-2 space-y-8">
           <motion.div variants={itemVariants} className="glass-panel space-y-6">
              <h3 className="font-bold text-sm flex items-center gap-2 text-text-primary">
                <div className="w-2 h-2 rounded-full bg-accent-primary"></div> 1. Personalidad Nexo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 {personalities.map((p) => (
                   <motion.button
                     key={p.id}
                     whileHover={{ scale: 1.02, y: -2 }}
                     whileTap={{ scale: 0.98 }}
                     onClick={() => setTone(p.id)}
                     className={`p-5 rounded-card border-2 transition-colors text-left space-y-3 ${
                       tone === p.id 
                         ? 'border-accent-primary bg-accent-primary/5 shadow-soft' 
                         : 'border-border bg-bg-secondary hover:border-gray-300'
                     }`}
                   >
                     <div className={`transition-colors ${tone === p.id ? 'text-accent-primary' : 'text-text-secondary'}`}>
                        {p.id === 'friendly' ? <Heart size={20} /> : p.id === 'pro' ? <Settings size={20} /> : <Sparkles size={20} />}
                     </div>
                     <p className={`text-sm font-bold ${tone === p.id ? 'text-accent-primary' : 'text-text-primary'}`}>{p.label}</p>
                     <p className="text-xs text-text-secondary font-medium leading-tight">{p.desc}</p>
                   </motion.button>
                 ))}
              </div>
           </motion.div>

           <motion.div variants={itemVariants} className="glass-panel space-y-6">
              <h3 className="font-bold text-sm flex items-center gap-2 text-text-primary">
                <div className="w-2 h-2 rounded-full bg-accent-primary"></div> 2. Canales de Respuesta
              </h3>
              
              <div className="space-y-6">
                 <div className="space-y-2 group">
                    <label className="text-micro text-text-secondary group-focus-within:text-accent-primary transition-colors ml-1">Mensaje de Bienvenida</label>
                    <textarea 
                      value={welcomeMsg}
                      onChange={(e) => setWelcomeMsg(e.target.value)}
                      rows={2}
                      className="w-full bg-bg-primary border border-border rounded-input p-4 text-sm font-medium text-text-primary outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all resize-none"
                    />
                 </div>

                 <div className="space-y-2 group">
                    <label className="text-micro text-text-secondary group-focus-within:text-accent-primary transition-colors ml-1 flex items-center gap-1.5">
                       <Sparkles size={14} /> Promoción o Contexto Especial
                    </label>
                    <textarea 
                      value={promo}
                      onChange={(e) => setPromo(e.target.value)}
                      rows={2}
                      className="w-full bg-accent-primary/5 border border-accent-primary/20 rounded-input p-4 text-sm font-semibold text-accent-primary outline-none focus:ring-2 focus:ring-accent-primary/30 transition-all resize-none"
                      placeholder="Ej: 10% de descuento en cortes los martes..."
                    />
                    <p className="text-xs text-text-secondary font-medium mt-2 ml-1">
                       Este texto se inyecta directamente en la memoria a corto plazo de la IA.
                    </p>
                 </div>
              </div>
           </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default IASettingsView;
