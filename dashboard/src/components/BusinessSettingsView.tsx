import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  MapPin, 
  Plus, 
  Trash2, 
  Save,
  Sparkles
} from 'lucide-react';
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

const listVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

const SettingsSkeleton = () => (
  <div className="p-10 flex flex-col justify-center items-center gap-4 text-text-secondary h-96">
    <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
    <span className="text-micro">Cargando configuración...</span>
  </div>
);

interface Barber {
  nombre: string;
  activo: boolean;
  comision: number;
}

interface Service {
  id: string;
  nombre: string;
  precio: number;
  duracion_min: number;
}

const MINUTE_OPTIONS = ['00', '15', '30', '45'];

// "HH:MM" (24h, lo que espera el backend) -> partes en 12h para mostrar/editar.
function to12h(time24: string): { hour: number; minute: string; period: 'AM' | 'PM' } {
  const [h, m] = (time24 || '08:00').split(':').map(Number);
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let hour = h % 12;
  if (hour === 0) hour = 12;
  const minute = MINUTE_OPTIONS.includes(String(m).padStart(2, '0')) ? String(m).padStart(2, '0') : '00';
  return { hour, minute, period };
}

// Partes en 12h -> "HH:MM" (24h) para guardar/comparar en el backend.
function to24h(hour12: number, minute: string, period: 'AM' | 'PM'): string {
  let hour = hour12 % 12;
  if (period === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

/**
 * Selector de hora en formato 12h con AM/PM — siempre igual sin importar el
 * idioma/región del sistema operativo de quien lo usa (a diferencia de
 * <input type="time">, cuyo formato visible depende del navegador/SO).
 * Internamente sigue produciendo "HH:MM" 24h, que es lo que usan las tools
 * de agenda del bot.
 */
const TimeInput12h: React.FC<{ value: string; onChange: (value24h: string) => void }> = ({ value, onChange }) => {
  const { hour, minute, period } = to12h(value);
  const selectClass = "bg-transparent text-sm font-mono font-medium outline-none text-text-primary appearance-none cursor-pointer";

  return (
    <div className="w-full flex items-center gap-1 bg-bg-primary border border-border rounded-input pl-9 pr-2 py-2.5 relative focus-within:ring-2 focus-within:ring-accent-primary/20 focus-within:border-accent-primary transition-all">
      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
      <select
        aria-label="Hora"
        value={hour}
        onChange={(e) => onChange(to24h(Number(e.target.value), minute, period))}
        className={selectClass}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-text-secondary text-xs">:</span>
      <select
        aria-label="Minutos"
        value={minute}
        onChange={(e) => onChange(to24h(hour, e.target.value, period))}
        className={selectClass}
      >
        {MINUTE_OPTIONS.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        aria-label="AM/PM"
        value={period}
        onChange={(e) => onChange(to24h(hour, minute, e.target.value as 'AM' | 'PM'))}
        className={`${selectClass} ml-1 font-bold text-accent-primary`}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

const BusinessSettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('Mi Barbería');
  const [location, setLocation] = useState('');
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('20:00');
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [newBarberName, setNewBarberName] = useState('');
  
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState(20000);
  const [newServiceDuration, setNewServiceDuration] = useState(30);

  const [newInstruction, setNewInstruction] = useState('');

  const [activeField, setActiveField] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await api.get('/dashboard/config');
      if (res.data) {
        setBusinessName(res.data.name || 'Mi Negocio');
        
        const config = res.data.config || {};
        setLocation(config.ubicacion || '');
        
        if (config.horario) {
          setOpeningTime(config.horario.apertura || '08:00');
          setClosingTime(config.horario.cierre || '20:00');
        }
        
        const loadedBarbers = Array.isArray(config.barberos) ? config.barberos : [];
        setBarbers(loadedBarbers.map((b: any) => ({
          nombre: b.nombre,
          activo: b.activo,
          comision: Number.isFinite(Number(b.comision)) ? Number(b.comision) : 50,
        })));
        
        if (config.servicios) {
          const loadedServices = Object.entries(config.servicios).map(([key, val]: [string, any]) => ({
            id: key,
            nombre: val.nombre || '',
            precio: Number(val.precio) || 0,
            duracion_min: Number(val.duracion_min) || 30
          }));
          setServices(loadedServices);
        } else {
          setServices([]);
        }

        setInstructions(Array.isArray(config.tono) ? config.tono : []);
      }
    } catch (e) {
      console.error('Error al cargar la configuración:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      const res = await api.get('/dashboard/config');
      const existingConfig = res.data?.config || {};

      const servicesObj: Record<string, { nombre: string; precio: number; duracion_min: number }> = {};
      services.forEach((s) => {
        servicesObj[s.id] = {
          nombre: s.nombre,
          precio: Number(s.precio),
          duracion_min: Number(s.duracion_min)
        };
      });

      // openingTime/closingTime ya vienen en "HH:MM" 24h desde <TimeInput12h>
      // (que solo expone al usuario un selector en formato 12h con AM/PM).
      const updatedConfig = {
        ...existingConfig,
        ubicacion: location,
        horario: {
          apertura: openingTime,
          cierre: closingTime
        },
        barberos: barbers,
        servicios: servicesObj,
        tono: instructions
      };

      await api.put('/dashboard/config', {
        name: businessName,
        config: updatedConfig
      });

      const notification = document.createElement('div');
      notification.className = "fixed bottom-10 right-10 bg-semantic-success text-white px-6 py-4 rounded-card shadow-hover z-[100] font-semibold text-sm animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3";
      notification.innerHTML = `<span class="bg-white/20 p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> Configuración Guardada`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 3000);

      loadData();
    } catch (e) {
      console.error('Error al guardar configuración:', e);
      alert('Ocurrió un error al guardar los cambios.');
    }
  };

  const handleAddBarber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarberName.trim()) return;
    const exists = barbers.some(b => b.nombre.toLowerCase() === newBarberName.toLowerCase().trim());
    if (exists) {
      alert('Este barbero ya se encuentra registrado.');
      return;
    }
    setBarbers([...barbers, { nombre: newBarberName.trim(), activo: true, comision: 50 }]);
    setNewBarberName('');
  };

  const handleToggleBarber = (index: number) => {
    setBarbers(barbers.map((b, i) => i === index ? { ...b, activo: !b.activo } : b));
  };

  const handleCommissionChange = (index: number, value: string) => {
    const num = Math.min(100, Math.max(0, Number(value) || 0));
    setBarbers(barbers.map((b, i) => i === index ? { ...b, comision: num } : b));
  };

  const handleDeleteBarber = (index: number) => {
    setBarbers(barbers.filter((_, i) => i !== index));
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    
    const newService: Service = {
      id: Date.now().toString(),
      nombre: newServiceName.trim(),
      precio: Number(newServicePrice),
      duracion_min: Number(newServiceDuration)
    };

    setServices([...services, newService]);
    setNewServiceName('');
    setNewServicePrice(20000);
    setNewServiceDuration(30);
  };

  const handleDeleteService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const handleAddInstruction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstruction.trim()) return;
    setInstructions([...instructions, newInstruction.trim()]);
    setNewInstruction('');
  };

  const handleDeleteInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-12 pb-24 max-w-7xl mx-auto"
    >
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 px-2">
        <div>
          <p className="text-micro text-text-secondary">
            Administrar datos, equipo, precios y horarios
          </p>
        </div>
        
        <motion.button 
          whileHover={{ scale: 1.04, boxShadow: '0 8px 20px rgba(29,78,216,0.18)' }}
          whileTap={{ scale: 0.96 }}
          onClick={handleSave}
          className="flex items-center gap-2 px-8 py-3.5 bg-accent-primary text-white rounded-btn text-sm font-semibold transition-colors hover:bg-blue-800 shadow-soft"
        >
          <Save size={18} /> Guardar Cambios
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COL 1: General Info & Hours */}
        <div className="space-y-8 lg:col-span-1">
          <motion.div variants={itemVariants} className="glass-panel space-y-6">
            <h3 className="font-bold text-sm flex items-center gap-2 text-text-primary">
              <div className="w-2 h-2 rounded-full bg-accent-primary"></div>
              1. Datos del Negocio
            </h3>

            <div className="space-y-4">
              <div className="space-y-2 group">
                <label className={`text-micro transition-colors duration-200 ml-1 ${activeField === 'business' ? 'text-accent-primary' : 'text-text-secondary'}`}>Nombre Comercial</label>
                <input 
                  type="text" 
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onFocus={() => setActiveField('business')}
                  onBlur={() => setActiveField(null)}
                  className="w-full bg-bg-primary border border-border rounded-input px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all text-text-primary"
                  placeholder="Ej: Nexo Barbershop"
                />
              </div>

              <div className="space-y-2 group">
                <label className={`text-micro transition-colors duration-200 ml-1 ${activeField === 'location' ? 'text-accent-primary' : 'text-text-secondary'}`}>Dirección / Ubicación</label>
                <div className="relative">
                  <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${activeField === 'location' ? 'text-accent-primary' : 'text-text-secondary'}`} size={16} />
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onFocus={() => setActiveField('location')}
                    onBlur={() => setActiveField(null)}
                    className="w-full bg-bg-primary border border-border rounded-input pl-10 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all text-text-primary"
                    placeholder="Calle 123, Bogotá"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-panel space-y-6">
            <h3 className="font-bold text-sm flex items-center gap-2 text-text-primary">
              <div className="w-2 h-2 rounded-full bg-accent-primary"></div>
              2. Horario Operativo
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-micro text-text-secondary ml-1">Apertura</label>
                <TimeInput12h value={openingTime} onChange={setOpeningTime} />
              </div>

              <div className="space-y-2">
                <label className="text-micro text-text-secondary ml-1">Cierre</label>
                <TimeInput12h value={closingTime} onChange={setClosingTime} />
              </div>
            </div>
            <p className="text-[11px] font-medium text-text-secondary leading-snug">
              El bot solo ofrecerá citas dentro de esta franja, todos los días de la semana.
            </p>
          </motion.div>
        </div>

        {/* COL 2: Barberos (Equipo) */}
        <div className="space-y-8 lg:col-span-1">
          <motion.div variants={itemVariants} className="glass-panel space-y-5 flex flex-col h-[500px]">
            <h3 className="font-bold text-sm flex items-center gap-2 text-text-primary">
              <div className="w-2 h-2 rounded-full bg-accent-tertiary"></div>
              3. Equipo (Barberos)
            </h3>

            <form onSubmit={handleAddBarber} className="flex gap-2">
              <input 
                type="text" 
                value={newBarberName}
                onChange={(e) => setNewBarberName(e.target.value)}
                placeholder="Nombre del barbero..."
                className="flex-1 bg-bg-primary border border-border rounded-input px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-accent-tertiary/20 focus:border-accent-tertiary transition-all text-text-primary"
              />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                className="p-3 bg-bg-secondary border border-border hover:bg-accent-tertiary hover:text-white hover:border-accent-tertiary text-text-secondary rounded-btn transition-colors"
              >
                <Plus size={18} />
              </motion.button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              <AnimatePresence>
                {barbers.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center text-center p-8 text-sm text-text-secondary">
                    No hay barberos agregados
                  </motion.div>
                ) : (
                  barbers.map((b, index) => (
                    <motion.div 
                      key={index}
                      variants={listVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      layout
                      className="p-3 bg-bg-secondary border border-border rounded-card group space-y-2.5"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${b.activo ? 'bg-semantic-success' : 'bg-text-secondary'}`}></div>
                          <span className={`text-sm font-semibold ${b.activo ? 'text-text-primary' : 'text-text-secondary line-through'}`}>{b.nombre}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleBarber(index)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                              b.activo
                                ? 'bg-semantic-success/10 text-semantic-success border border-semantic-success/20 hover:bg-semantic-success/20'
                                : 'bg-bg-primary text-text-secondary border border-border hover:bg-gray-100'
                            }`}
                          >
                            {b.activo ? 'Activo' : 'Inactivo'}
                          </button>
                          <button
                            onClick={() => handleDeleteBarber(index)}
                            className="p-1.5 text-text-secondary hover:text-semantic-danger transition-colors rounded-md hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Comisión</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={b.comision}
                          onChange={(e) => handleCommissionChange(index, e.target.value)}
                          className="w-16 bg-bg-primary border border-border rounded-md px-2 py-1 text-xs font-semibold text-text-primary outline-none focus:ring-2 focus:ring-accent-tertiary/20 focus:border-accent-tertiary transition-all"
                        />
                        <span className="text-xs font-semibold text-text-secondary">%</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* COL 3: Servicios y Precios */}
        <div className="space-y-8 lg:col-span-1">
          <motion.div variants={itemVariants} className="glass-panel space-y-5 flex flex-col h-[500px]">
            <h3 className="font-bold text-sm flex items-center gap-2 text-text-primary">
              <div className="w-2 h-2 rounded-full bg-accent-primary"></div>
              4. Servicios y Catálogo
            </h3>

            <form onSubmit={handleAddService} className="bg-bg-secondary border border-border p-4 rounded-card space-y-3">
              <input 
                type="text" 
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Nombre del servicio..."
                className="w-full bg-bg-primary border border-border rounded-input px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-accent-primary">$</span>
                  <input 
                    type="number" 
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(Number(e.target.value))}
                    placeholder="Precio"
                    className="w-full bg-bg-primary border border-border rounded-input pl-6 pr-2 py-2 text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                    required
                  />
                </div>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" size={12} />
                  <input 
                    type="number" 
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(Number(e.target.value))}
                    placeholder="Min"
                    className="w-full bg-bg-primary border border-border rounded-input pl-7 pr-2 py-2 text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                    required
                  />
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-2 bg-accent-primary text-white rounded-btn transition-colors hover:bg-blue-800 font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Agregar
              </motion.button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              <AnimatePresence>
                {services.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center text-center p-8 text-sm text-text-secondary">
                    No hay servicios registrados
                  </motion.div>
                ) : (
                  services.map((s) => (
                    <motion.div 
                      key={s.id}
                      variants={listVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      layout
                      className="flex justify-between items-center p-3 bg-bg-secondary border border-border rounded-card group"
                    >
                      <div>
                        <p className="text-sm font-bold text-text-primary leading-tight">{s.nombre}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-accent-primary">${(s.precio).toLocaleString()}</span>
                          <span className="w-1 h-1 rounded-full bg-border"></span>
                          <span className="text-[10px] text-text-secondary font-semibold">{s.duracion_min} min</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleDeleteService(s.id)}
                        className="p-1.5 text-text-secondary hover:text-semantic-danger transition-colors rounded-md hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

      </div>

      {/* Row 2: Instructions (Pautas) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2">
          <motion.div variants={itemVariants} className="glass-panel space-y-6 flex flex-col min-h-[350px]">
            <div className="space-y-1">
              <h3 className="font-bold text-sm flex items-center gap-2 text-text-primary">
                <div className="w-2 h-2 rounded-full bg-accent-primary"></div>
                5. Instrucciones y Pautas para IA
              </h3>
              <p className="text-xs text-text-secondary font-medium ml-4">
                Establece reglas específicas y políticas comerciales que la IA recordará en WhatsApp.
              </p>
            </div>

            <form onSubmit={handleAddInstruction} className="flex gap-2">
              <input 
                type="text" 
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                placeholder="Ej: Sugiere combo nexo premium si el cliente duda..."
                className="flex-1 bg-bg-primary border border-border rounded-input px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all text-text-primary"
              />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                className="px-6 bg-accent-primary text-white rounded-btn transition-colors hover:bg-blue-800 font-semibold text-sm"
              >
                Agregar
              </motion.button>
            </form>

            <div className="flex-1 space-y-2 mt-4 custom-scrollbar overflow-y-auto">
              <AnimatePresence>
                {instructions.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center text-center p-8 text-sm text-text-secondary">
                    Sin pautas personalizadas. El bot usará protocolos estándar.
                  </motion.div>
                ) : (
                  instructions.map((inst, index) => (
                    <motion.div 
                      key={index}
                      variants={listVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      layout
                      className="flex justify-between items-start gap-4 p-4 bg-bg-secondary border border-border rounded-card group"
                    >
                      <div className="flex items-start gap-3 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-primary shrink-0 mt-2"></div>
                        <span className="text-sm font-medium text-text-primary leading-relaxed">{inst}</span>
                      </div>
                      
                      <button 
                        onClick={() => handleDeleteInstruction(index)}
                        className="p-1.5 text-text-secondary hover:text-semantic-danger transition-colors rounded-md hover:bg-red-50 shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <motion.div variants={itemVariants} className="glass-panel space-y-3 bg-accent-primary/5 border-accent-primary/20">
             <h3 className="text-micro text-accent-primary flex items-center gap-2">
               <Sparkles size={14} /> Red Neuronal Sincronizada
             </h3>
             <p className="text-xs text-text-primary font-medium leading-relaxed">
               Cada vez que agregas un barbero o precio, Nexo IA reestructura automáticamente su prompt en la nube.
             </p>
             <p className="text-xs text-text-secondary font-medium leading-relaxed">
               No necesitas compilar código ni reiniciar el servidor. Es inmediato.
             </p>
          </motion.div>
          
        </div>

      </div>

    </motion.div>
  );
};

export default BusinessSettingsView;
