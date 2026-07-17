import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, Calendar, Clock, TrendingUp, ArrowUpRight, 
  BarChart3, RefreshCw, AlertCircle, ArrowDownRight, 
  HelpCircle, Sparkles, CheckCircle2, ChevronRight
} from 'lucide-react';
import api from '../api';

interface FinanceStats {
  revenueThisMonth: number;
  totalAppointments: number;
  avgDurationMinutes: number;
  currency: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 } 
  }
};

// Animated Number Component
const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number, prefix?: string, suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    const duration = 1200;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = (currentTime - startTime) / duration;
      
      if (progress < 1) {
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setDisplayValue(Math.floor(value * easeOutQuart));
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);

  return <span>{prefix}{displayValue.toLocaleString('es-CO')}{suffix}</span>;
};

// Interactive SVG Area Chart Component
const InteractiveRevenueChart = () => {
  const data = [
    { label: 'Lun', value: 85000 },
    { label: 'Mar', value: 120000 },
    { label: 'Mié', value: 95000 },
    { label: 'Jue', value: 190000 },
    { label: 'Vie', value: 240000 },
    { label: 'Sáb', value: 310000 },
    { label: 'Dom', value: 180000 }
  ];

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxVal = Math.max(...data.map(d => d.value));
  const width = 500;
  const height = 180;
  const padding = 20;

  // Calculate coordinates
  const points = data.map((d, i) => {
    const x = padding + (i * (width - padding * 2)) / (data.length - 1);
    const y = height - padding - (d.value / maxVal) * (height - padding * 2 - 20);
    return { x, y };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="relative w-full h-full flex flex-col justify-between">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
          <TrendingUp size={14} className="text-accent-primary" /> Tendencia Semanal
        </h4>
      </div>

      <div className="relative flex-1 min-h-[140px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding + ratio * (height - padding * 2 - 20);
            return (
              <line 
                key={idx} 
                x1={padding} 
                y1={y} 
                x2={width - padding} 
                y2={y} 
                stroke="rgba(148, 163, 184, 0.08)" 
                strokeWidth="1" 
              />
            );
          })}

          {/* Area under the path */}
          <path d={areaD} fill="url(#chartGradient)" />

          {/* Line Path */}
          <path d={pathD} fill="none" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === i ? 6 : 4}
                fill={hoveredIndex === i ? '#1d4ed8' : '#FFFFFF'}
                stroke={hoveredIndex === i ? '#FFFFFF' : '#1d4ed8'}
                strokeWidth={hoveredIndex === i ? 2 : 2}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          ))}
        </svg>

        {/* Dynamic Tooltip overlay */}
        <AnimatePresence>
          {hoveredIndex !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bg-text-primary text-white p-2.5 rounded-lg shadow-xl text-xs z-20 pointer-events-none"
              style={{
                left: `${(hoveredIndex * 14.2) + 2}%`,
                top: '0px'
              }}
            >
              <div className="font-bold text-gray-400 uppercase tracking-wider text-[9px]">
                {data[hoveredIndex].label}
              </div>
              <div className="font-black text-white mt-0.5">
                ${data[hoveredIndex].value.toLocaleString('es-CO')} COP
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-between text-[10px] text-text-secondary font-bold px-2 pt-1">
        {data.map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    </div>
  );
};

const FinanceView: React.FC = () => {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchFinance = async () => {
    try {
      const res = await api.get('/dashboard/finance');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching finance stats:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchFinance();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <div className="w-10 h-10 border-[3px] border-accent-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-text-secondary font-medium tracking-wide">Cargando reporte financiero...</p>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-20 max-w-7xl mx-auto px-4"
    >
      {/* Dynamic Header */}
      <motion.div variants={itemVariants} className="flex justify-between items-center bg-white border border-border-subtle p-4 rounded-lg shadow-sm">
        <div>
          <p className="text-xs text-text-secondary font-medium">Control de ingresos, transacciones y predicción AI</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-lg border border-border bg-white hover:bg-bg-base text-text-secondary hover:text-text-primary transition-all active:scale-95 shadow-sm"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          <div className="bg-white/80 border border-border rounded-xl px-4 py-2 flex items-center gap-2.5 shadow-sm text-xs font-bold text-text-primary">
            <Calendar size={14} className="text-accent-tertiary" />
            <span className="capitalize">{new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────────
          BENTO BOX GRID LAYOUT
          ──────────────────────────────────────────────────────── */}
      {/* ── FASE 5: BENTO BOX GRID LAYOUT (KPI CARDS PREMIUM) ────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Revenue Card (col-span-2 row-span-2) */}
        <motion.div 
          variants={itemVariants}
          style={{ '--kpi-accent': 'var(--gradient-brand)' } as React.CSSProperties}
          className="kpi-card md:col-span-2 md:row-span-2 flex flex-col justify-between min-h-[380px] group"
        >
          {/* Elemento Decorativo de Fondo */}
          <DollarSign 
            size={120} 
            className="absolute -bottom-4 -right-4 text-brand-primary opacity-[0.04] transform -rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none" 
          />

          <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                <p className="text-[12px] text-text-secondary uppercase tracking-[1px] font-semibold">Facturación del Mes</p>
              </div>
              <h3 className="font-display font-black tracking-tighter mt-1 flex items-baseline gap-2" style={{ fontSize: '48px', background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
                $<AnimatedNumber value={stats?.revenueThisMonth || 0} />
                <span className="text-text-tertiary text-lg font-bold uppercase" style={{ WebkitTextFillColor: 'var(--text-tertiary)' }}>{stats?.currency}</span>
              </h3>
            </div>

            {/* Ícono superior derecho */}
            <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center shrink-0 relative">
              <div className="absolute inset-0 bg-brand-primary opacity-15 rounded-full" />
              <DollarSign size={22} className="text-brand-primary relative z-10" />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 relative z-10">
            {/* Indicador de Tendencia */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-success/10 border border-brand-success/20 text-brand-success shadow-sm">
              <ArrowUpRight size={14} strokeWidth={2.5} />
              <span className="text-[12px] font-bold tracking-wide">+12.5%</span>
            </div>
            <span className="text-[11px] text-text-tertiary font-medium">vs. mes anterior</span>
          </div>

          {/* Interactive Chart Component */}
          <div className="mt-8 flex-1 relative z-10 h-[180px]">
            <InteractiveRevenueChart />
          </div>
        </motion.div>

        {/* Card 2: Appointments Status Card */}
        <motion.div 
          variants={itemVariants}
          style={{ '--kpi-accent': 'var(--gradient-success)' } as React.CSSProperties}
          className="kpi-card flex flex-col justify-between group h-full"
        >
          <Calendar size={100} className="absolute -bottom-6 -right-6 text-brand-success opacity-[0.04] transform rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none" />

          <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-success" />
                <p className="text-[12px] text-text-secondary uppercase tracking-[1px] font-semibold">Citas Atendidas</p>
              </div>
              <h3 className="font-display font-black tracking-tighter mt-1" style={{ fontSize: '42px', background: 'var(--gradient-success)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
                <AnimatedNumber value={stats?.totalAppointments || 0} />
              </h3>
            </div>
            <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center shrink-0 relative">
              <div className="absolute inset-0 bg-brand-success opacity-15 rounded-full" />
              <Calendar size={22} className="text-brand-success relative z-10" />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 relative z-10">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-success/10 border border-brand-success/20 text-brand-success shadow-sm self-start">
              <ArrowUpRight size={14} strokeWidth={2.5} />
              <span className="text-[12px] font-bold tracking-wide">+8.4%</span>
            </div>
            <div className="pt-4 border-t border-border-subtle flex justify-between items-center text-[11px] text-text-secondary font-medium">
              <span>Conversión comercial</span>
              <span className="font-bold text-text-primary">94.2%</span>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Avg Duration Card */}
        <motion.div 
          variants={itemVariants}
          style={{ '--kpi-accent': 'var(--gradient-brand-soft)' } as React.CSSProperties}
          className="kpi-card flex flex-col justify-between group h-full"
        >
          <Clock size={100} className="absolute -bottom-6 -right-6 text-brand-primary opacity-[0.03] transform -rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none" />

          <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
                <p className="text-[12px] text-text-secondary uppercase tracking-[1px] font-semibold">Tiempo Promedio</p>
              </div>
              <h3 className="font-display font-black tracking-tighter mt-1 flex items-baseline gap-1" style={{ fontSize: '42px', color: 'var(--text-primary)', lineHeight: 1 }}>
                <AnimatedNumber value={stats?.avgDurationMinutes || 0} />
                <span className="text-[14px] text-text-tertiary uppercase font-bold tracking-wide">Min</span>
              </h3>
            </div>
            <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center shrink-0 relative">
              <div className="absolute inset-0 bg-text-secondary opacity-10 rounded-full" />
              <Clock size={22} className="text-text-secondary relative z-10" />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 relative z-10">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary shadow-sm self-start">
              <ArrowDownRight size={14} strokeWidth={2.5} />
              <span className="text-[12px] font-bold tracking-wide">-5.2%</span>
            </div>
            <div className="pt-4 border-t border-border-subtle flex justify-between items-center text-[11px] text-text-secondary font-medium">
              <span>Eficiencia del equipo</span>
              <span className="font-bold text-brand-success flex items-center gap-1"><ArrowUpRight size={12}/> Optima</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── FASE 6: TABLAS PREMIUM ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6" id="transactions">
        
        {/* Table Container (col-span-2) */}
        <motion.div 
          variants={itemVariants} 
          className="glass-panel lg:col-span-2 p-0 overflow-hidden flex flex-col"
        >
          {/* Header de la tabla */}
          <div className="px-6 py-5 border-b-[2px] border-brand-primary/20 flex justify-between items-center bg-white/40">
            <div>
              <h4 style={{ fontFamily: 'Syne', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Historial de Operaciones</h4>
              <p className="text-[13px] text-text-secondary mt-0.5 font-medium">Últimos cobros registrados por la plataforma</p>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th>Cliente y Servicio</th>
                  <th>Fecha y Hora</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => {
                  const statusInfo = 
                    i === 1 ? { type: 'success', text: 'Completado', color: 'var(--brand-success)' } :
                    i === 4 ? { type: 'danger', text: 'Cancelado', color: 'var(--brand-danger)' } :
                    i === 5 ? { type: 'cyan', text: 'En Proceso', color: 'var(--brand-tertiary)' } :
                    { type: 'success', text: 'Completado', color: 'var(--brand-success)' };

                  return (
                    <tr key={i} className="group relative h-[56px] bg-white hover:bg-brand-primary/[0.03]">
                      {/* Borde izquierdo hover */}
                      <td className="p-0 w-0 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                      
                      <td className="px-6 py-3 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-brand-soft border border-brand-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-[12px] font-bold text-brand-primary">
                              {i % 2 === 0 ? 'M' : 'J'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[14px] font-bold text-text-primary m-0 leading-tight">Servicio #{1020 + i}</p>
                            <p className="text-[12px] text-text-secondary m-0 leading-tight mt-0.5">{i % 2 === 0 ? 'Corte Premium' : 'Barba Express'}</p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-3">
                        <p className="text-[14px] font-medium text-text-primary m-0 leading-tight">Hoy</p>
                        <p className="text-[12px] text-text-secondary m-0 leading-tight mt-0.5">{10 + i}:30 AM</p>
                      </td>
                      
                      <td className="px-6 py-3">
                        <p className="text-[14px] font-bold text-text-primary m-0">${(85000 + (i * 5000)).toLocaleString('es-CO')}</p>
                      </td>
                      
                      <td className="px-6 py-3">
                        <div className={`badge badge-${statusInfo.type}`}>
                          <div className="badge-dot badge-dot-active" style={{ background: statusInfo.color }} />
                          {statusInfo.text}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Card 4: AI Insights Panel (col-span-1) */}
        <motion.div 
          variants={itemVariants}
          style={{ '--kpi-accent': 'var(--gradient-brand)' } as React.CSSProperties}
          className="kpi-card p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2 mb-4 text-brand-primary">
              <Sparkles size={18} className="animate-pulse" />
              <h4 style={{ fontFamily: 'Syne', fontSize: '18px', fontWeight: 800 }}>IA Financiera</h4>
            </div>
            
            <p className="text-[14px] text-text-primary leading-relaxed mb-6 italic border-l-[3px] border-brand-primary pl-4 bg-brand-primary/5 p-4 rounded-r-xl">
              "Los miércoles registran la mayor demanda de citas largas. Ajusta los precios promocionales a mitad de semana para maximizar el ticket promedio."
            </p>

            <div className="space-y-4">
              <h5 className="text-[11px] font-bold text-text-secondary uppercase tracking-[1px] mb-2">Metas Mensuales</h5>
              
              <div>
                <div className="flex justify-between text-[12px] font-bold text-text-primary mb-1.5">
                  <span>Facturación</span>
                  <span>85%</span>
                </div>
                <div className="h-[6px] w-full bg-border-subtle rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} animate={{ width: '85%' }} transition={{ duration: 1, delay: 0.5 }}
                    style={{ background: 'var(--gradient-brand)' }} className="h-full rounded-full" 
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[12px] font-bold text-text-primary mb-1.5">
                  <span>Retención</span>
                  <span>92%</span>
                </div>
                <div className="h-[6px] w-full bg-border-subtle rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} animate={{ width: '92%' }} transition={{ duration: 1, delay: 0.6 }}
                    style={{ background: 'var(--gradient-success)' }} className="h-full rounded-full" 
                  />
                </div>
              </div>
            </div>
          </div>

        </motion.div>

      </div>

      {/* ── SECCIÓN DE COMISIONES POR BARBERO ──────────────────────── */}
      <div className="mt-6">
        <motion.div 
          variants={itemVariants}
          className="glass-panel p-6"
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 style={{ fontFamily: 'Syne', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Comisiones del Equipo
              </h4>
              <p className="text-[13px] text-text-secondary mt-0.5 font-medium">Rendimiento y pagos acumulados por barbero</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { id: 1, name: 'Juan Carlos', avatar: 'J', amount: 450000, percentage: 65, status: 'success', text: 'Alto' },
              { id: 2, name: 'Mario B.', avatar: 'M', amount: 380000, percentage: 55, status: 'cyan', text: 'Medio' },
              { id: 3, name: 'Luis R.', avatar: 'L', amount: 210000, percentage: 35, status: 'warning', text: 'Mejorable' },
              { id: 4, name: 'Carlos T.', avatar: 'C', amount: 150000, percentage: 25, status: 'danger', text: 'Bajo' }
            ].map(barber => (
              <div key={barber.id} className="p-4 rounded-lg border border-border-default bg-white hover:border-brand-primary/30 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                      {barber.avatar}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-text-primary leading-tight">{barber.name}</p>
                      <p className="text-[11px] text-text-secondary font-medium mt-0.5">Barbero Senior</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-[20px] font-black text-brand-primary leading-none">${barber.amount.toLocaleString('es-CO')}</p>
                  <p className="text-[11px] text-text-secondary mt-1">Comisión acumulada</p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 h-[6px] bg-border-subtle rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} animate={{ width: `${barber.percentage}%` }} transition={{ duration: 1, delay: 0.2 }}
                      style={{ background: barber.status === 'success' ? 'var(--gradient-success)' : barber.status === 'danger' ? 'var(--gradient-danger)' : 'var(--gradient-brand)' }} 
                      className="h-full rounded-full" 
                    />
                  </div>
                  <div className={`badge badge-${barber.status === 'cyan' ? 'info' : barber.status === 'danger' ? 'danger' : 'success'} !px-1.5 !py-0.5`}>
                    {barber.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default FinanceView;
