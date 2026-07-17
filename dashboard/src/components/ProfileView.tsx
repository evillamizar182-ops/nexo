import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  MapPin, 
  Mail, 
  Phone, 
  Shield,
  Save,
  Building2, 
  Key,
  Server
} from 'lucide-react';
import api from '../api';
import { useStore } from '../store/useStore';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 } as const
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } }
};

const ProfileView: React.FC = () => {
  const { user } = useStore();
  const [businessName, setBusinessName] = useState('Mi Negocio');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dbStatus, setDbStatus] = useState<'connected' | 'syncing'>('connected');

  // Floating label active states
  const [activeField, setActiveField] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/dashboard/config');
        if (res.data) {
          setBusinessName(res.data.name || 'Mi Negocio');
          // Hidratar con lo ya guardado — antes esta pantalla siempre mostraba
          // un teléfono/dirección de ejemplo, y guardar sin darse cuenta
          // pisaba los datos reales del negocio con esos valores de mentira.
          const config = res.data.config || {};
          if (typeof config.phone === 'string') setPhone(config.phone);
          if (typeof config.address === 'string') setAddress(config.address);
        }
      } catch (e) {
        console.error("Error loading config", e);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbStatus('syncing');

    try {
      const res = await api.get('/dashboard/config');
      const existingConfig = res.data?.config || {};

      await api.put('/dashboard/config', {
        name: businessName,
        config: {
          ...existingConfig,
          address,
          phone
        }
      });

      setTimeout(() => {
        setDbStatus('connected');
        const notification = document.createElement('div');
        notification.className = "fixed bottom-10 right-10 bg-semantic-success text-white px-6 py-4 rounded-card shadow-hover z-[100] font-semibold text-sm animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3";
        notification.innerHTML = `<span class="bg-white/20 p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> Perfil Local Guardado`;
        document.body.appendChild(notification);
        setTimeout(() => {
          notification.classList.remove('slide-in-from-bottom-4', 'fade-in');
          notification.style.opacity = '0';
          notification.style.transform = 'translateY(20px)';
          notification.style.transition = 'all 0.3s ease';
          setTimeout(() => notification.remove(), 300);
        }, 3000);
      }, 800);

    } catch (e) {
      console.error(e);
      setDbStatus('connected');
      alert("Error al actualizar perfil");
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto space-y-8 pb-20"
    >
      
      {/* Header */}
      <motion.div variants={itemVariants}>
        <p className="text-text-secondary text-micro">Configuración local y credenciales del servidor</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side - Profile Summary Card */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div variants={itemVariants} className="glass-panel text-center flex flex-col items-center gap-5">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="w-24 h-24 rounded-[24px] bg-accent-primary/10 text-accent-primary flex items-center justify-center shadow-soft"
            >
              <span className="font-black text-3xl tracking-tighter">NX</span>
            </motion.div>
            
            <div>
              <h3 className="text-lg font-bold text-text-primary">{businessName}</h3>
              <p className="text-micro text-accent-primary mt-1">Sede Central - Activa</p>
            </div>

            <div className="h-px bg-border w-full"></div>

            <div className="w-full space-y-4 text-left">
              <div className="flex items-center gap-3 text-sm text-text-secondary font-medium">
                <Shield size={16} className="text-accent-primary shrink-0" />
                <span>Nivel Administrativo: Owner</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-text-secondary font-medium">
                <Key size={16} className="text-accent-primary shrink-0" />
                <span>JWT tokens: Firmados localmente</span>
              </div>
            </div>
          </motion.div>

          {/* Infrastructure Health Status */}
          <motion.div variants={itemVariants} className="glass-panel space-y-6">
            <h4 className="text-micro text-text-secondary flex items-center gap-2">
              <Server size={14} className="text-accent-primary" /> Infraestructura Nexo
            </h4>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-micro text-text-secondary">
                  <span>Conexión Supabase</span>
                  <span className="text-semantic-success">Excelente</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-semantic-success"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-micro text-text-secondary">
                  <span>Carga de Memoria Cache</span>
                  <span className="text-accent-primary">12%</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '12%' }}
                    transition={{ duration: 1, delay: 0.7 }}
                    className="h-full bg-accent-primary"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Side - Profile Inputs Form */}
        <div className="lg:col-span-2">
          <motion.form 
            variants={itemVariants}
            onSubmit={handleSave} 
            className="glass-panel space-y-8"
          >
            <h3 className="text-sm font-bold flex items-center gap-2 text-text-primary">
              <div className="w-2 h-2 rounded-full bg-accent-primary"></div> Información Básica
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {[
                { id: 'business', label: 'Nombre Comercial', icon: Building2, value: businessName, set: setBusinessName, type: 'text' },
                { id: 'phone', label: 'Número de WhatsApp', icon: Phone, value: phone, set: setPhone, type: 'text' }
              ].map((field) => (
                <motion.div key={field.id} variants={itemVariants} className="space-y-2">
                  <label
                    className={`text-micro transition-colors duration-200 ml-1 ${
                      activeField === field.id ? 'text-accent-primary' : 'text-text-secondary'
                    }`}
                  >
                    {field.label}
                  </label>
                  <div className="relative group">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center transition-colors duration-200 ${
                      activeField === field.id ? 'text-accent-primary' : 'text-text-secondary'
                    }`}>
                      <field.icon size={18} />
                    </div>
                    <input
                      type={field.type}
                      value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                      onFocus={() => setActiveField(field.id)}
                      onBlur={() => setActiveField(null)}
                      className="w-full pl-11 pr-4 py-3 text-sm transition-all focus:ring-4 focus:ring-accent-primary/10"
                      required
                    />
                  </div>
                </motion.div>
              ))}

              {/* Cuenta de acceso: solo lectura aquí. Antes se podían "editar"
                  nombre/email del admin pero al guardar se ignoraban en
                  silencio — nunca llegaban a tocar la cuenta real. */}
              {[
                { id: 'admin', label: 'Administrador Asignado', icon: User, value: user?.name || '—' },
                { id: 'email', label: 'Email de Acceso', icon: Mail, value: user?.email || '—' },
              ].map((field) => (
                <div key={field.id} className="space-y-2">
                  <label className="text-micro text-text-secondary ml-1">{field.label}</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-text-tertiary">
                      <field.icon size={18} />
                    </div>
                    <input
                      type="text"
                      value={field.value}
                      disabled
                      title="Se gestiona desde el inicio de sesión, no desde este formulario"
                      className="w-full pl-11 pr-4 py-3 text-sm text-text-secondary bg-bg-secondary cursor-not-allowed"
                    />
                  </div>
                </div>
              ))}

            </div>

            <motion.div variants={itemVariants} className="space-y-2">
              <label 
                className={`text-micro transition-colors duration-200 ml-1 ${
                  activeField === 'address' ? 'text-accent-primary' : 'text-text-secondary'
                }`}
              >
                Dirección Central
              </label>
              <div className="relative group">
                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center transition-colors duration-200 ${
                  activeField === 'address' ? 'text-accent-primary' : 'text-text-secondary'
                }`}>
                  <MapPin size={18} />
                </div>
                <input 
                  type="text" 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  onFocus={() => setActiveField('address')}
                  onBlur={() => setActiveField(null)}
                  className="w-full pl-11 pr-4 py-3 text-sm transition-all focus:ring-4 focus:ring-accent-primary/10"
                  required
                />
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="flex justify-end pt-4">
              <motion.button 
                whileHover={{ scale: 1.04, boxShadow: '0 8px 20px rgba(29,78,216,0.18)' }}
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={dbStatus === 'syncing'}
                className="flex items-center gap-2 px-8 py-3.5 bg-accent-primary text-white rounded-btn text-sm font-semibold transition-colors disabled:opacity-50 hover:bg-blue-800"
              >
                {dbStatus === 'syncing' ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Save size={18} />
                  </motion.div>
                ) : (
                  <Save size={18} /> 
                )}
                {dbStatus === 'syncing' ? 'Sincronizando...' : 'Guardar Ajustes'}
              </motion.button>
            </motion.div>

          </motion.form>
        </div>

      </div>
    </motion.div>
  );
};

export default ProfileView;
