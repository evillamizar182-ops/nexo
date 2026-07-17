import React, { useEffect, useState, useRef } from 'react';
import { motion, animate, useInView } from 'framer-motion';
import { 
  Users,
  DollarSign,
  Calendar,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  XAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import api from '../api';

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { type: 'spring', stiffness: 300, damping: 20 } 
  }
};

// Componente para contador animado
const AnimatedNumber = ({ value, prefix = "" }: { value: number, prefix?: string }) => {
  const ref = useRef<HTMLHeadingElement>(null);
  
  useEffect(() => {
    const node = ref.current;
    if (node) {
      const controls = animate(0, value, {
        duration: 1.5,
        ease: "easeOut",
        onUpdate(val) {
          node.textContent = `${prefix}${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        }
      });
      return () => controls.stop();
    }
  }, [value, prefix]);

  return <h3 ref={ref} className="text-3xl font-bold mt-2 text-text-primary">{prefix}0</h3>;
};

const DashboardSkeleton = () => (
  <div className="p-10 w-full h-full space-y-8">
    <div className="h-12 w-64 bg-border animate-pulse rounded-lg"></div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {[1,2,3,4].map(i => <div key={i} className="h-40 bg-border animate-pulse rounded-card"></div>)}
    </div>
  </div>
);

const DashboardView: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const chartRef = useRef(null);
  const isChartInView = useInView(chartRef, { once: true, margin: "-50px" });

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data);
    } catch (e) {
      console.error("Error al cargar datos del dashboard:", e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <DashboardSkeleton />;

  const revenueHistory = [
    { name: 'Lun', value: 450000 },
    { name: 'Mar', value: 380000 },
    { name: 'Mie', value: 520000 },
    { name: 'Jue', value: 610000 },
    { name: 'Vie', value: 850000 },
    { name: 'Sab', value: 1200000 },
    { name: 'Dom', value: 0 },
    { name: 'L (P)', value: 500000, isPredictive: true },
    { name: 'M (P)', value: 450000, isPredictive: true },
  ];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-10 pb-20"
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Ingresos Hoy"
          value={stats?.revenueThisMonth || 0}
          prefix="$"
          icon={<DollarSign size={20} />}
          trend="Mes"
          trendUp={true}
        />
        <MetricCard
          title="Citas del Mes"
          value={stats?.appointmentsThisMonth || 0}
          icon={<Calendar size={20} />}
          trend="Total"
          trendUp={true}
        />
        <MetricCard
          title="Clientes Totales"
          value={stats?.totalClients || 0}
          icon={<Users size={20} />}
          trend="Global"
          trendUp={true}
        />
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Gráfico */}
        <motion.div
          ref={chartRef}
          variants={itemVariants}
          className="glass-panel"
        >
          <div className="flex justify-between items-center mb-8">
            <div className="space-y-1">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="text-accent-primary" size={20} /> Proyección Semanal
              </h3>
              <p className="text-micro text-text-secondary">Inteligencia Predictiva</p>
            </div>
            <div className="text-right">
               <p className="text-xl font-bold text-text-primary">$4.5M</p>
               <p className="text-micro text-accent-tertiary">Estimado Mensual</p>
            </div>
          </div>
          
          <div className="h-80 w-full">
            {isChartInView && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueHistory}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-accent-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
                    itemStyle={{ color: 'var(--color-accent-primary)', fontWeight: '700', fontSize: '13px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="var(--color-accent-primary)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

const MetricCard = ({ title, value, icon, trend, trendUp, onClick, prefix = "", suffix = "" }: any) => {
  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ y: -2, boxShadow: "0 8px 20px rgba(15,23,42,0.08)" }}
      className="glass-panel group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-bg-secondary text-accent-primary rounded-xl transition-transform duration-500 group-hover:scale-110">
          {icon}
        </div>
        <div className="text-right flex items-center gap-1 badge badge-info">
           <motion.span
             animate={{ y: trendUp ? [0, -3, 0] : [0, 3, 0] }}
             transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
           >
             {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
           </motion.span>
           {trend}
        </div>
      </div>
      <div>
        <p className="text-micro text-text-secondary">{title}</p>
        <AnimatedNumber value={value} prefix={prefix} />
      </div>
    </motion.div>
  );
};


export default DashboardView;
