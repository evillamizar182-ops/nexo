import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  category: string;
  language: string;
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

const MetaTemplatesView: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([
    { id: '1', name: 'bienvenida_cliente', status: 'APPROVED', category: 'MARKETING', language: 'es' },
    { id: '2', name: 'confirmacion_cita', status: 'APPROVED', category: 'UTILITY', language: 'es' },
    { id: '3', name: 'recordatorio_24h', status: 'PENDING', category: 'UTILITY', language: 'es' },
    { id: '4', name: 'promo_fin_de_semana', status: 'REJECTED', category: 'MARKETING', language: 'es' },
  ]);

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-20 max-w-7xl mx-auto"
    >
      <motion.div variants={itemVariants} className="px-2">
        <p className="text-micro text-text-secondary">Gestión de mensajes oficiales (HSM)</p>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-panel p-0 border border-border rounded-card bg-bg-card shadow-soft overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg-secondary border-b border-border">
              <th className="px-8 py-5 text-micro text-text-secondary uppercase tracking-widest">Nombre de Plantilla</th>
              <th className="px-8 py-5 text-micro text-text-secondary uppercase tracking-widest">Categoría</th>
              <th className="px-8 py-5 text-micro text-text-secondary uppercase tracking-widest">Estado</th>
            </tr>
          </thead>
          <motion.tbody 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="divide-y divide-border"
          >
            <AnimatePresence>
              {templates.map((t) => (
                <motion.tr 
                  key={t.id} 
                  variants={itemVariants}
                  whileHover={{ backgroundColor: '#f8fafc' }}
                  className="group transition-colors"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-bg-secondary border border-border flex items-center justify-center text-text-secondary group-hover:text-accent-primary group-hover:border-accent-primary/30 transition-colors">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">{t.name}</p>
                        <p className="text-xs text-text-secondary font-medium mt-0.5">ID: {t.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="badge badge-info">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      {t.status === 'APPROVED' && (
                        <>
                          <CheckCircle2 size={16} className="text-semantic-success" />
                          <span className="text-xs font-bold text-semantic-success uppercase tracking-wide">Aprobada</span>
                        </>
                      )}
                      {t.status === 'PENDING' && (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                            <RefreshCw size={16} className="text-semantic-warning" />
                          </motion.div>
                          <span className="text-xs font-bold text-semantic-warning uppercase tracking-wide">Pendiente</span>
                        </>
                      )}
                      {t.status === 'REJECTED' && (
                        <>
                          <AlertCircle size={16} className="text-semantic-danger" />
                          <span className="text-xs font-bold text-semantic-danger uppercase tracking-wide">Rechazada</span>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </motion.tbody>
        </table>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div 
          variants={itemVariants}
          whileHover={{ y: -4, boxShadow: '0 8px 20px rgba(29,78,216,0.10)' }}
          className="glass-panel p-8 bg-accent-primary/5 border border-accent-primary/20 flex flex-col justify-center transition-all"
        >
          <Sparkles className="text-accent-primary mb-5" size={28} />
          <h4 className="text-lg font-bold text-text-primary mb-2">IA + Plantillas</h4>
          <p className="text-sm text-text-secondary leading-relaxed font-medium">
            Nexo IA puede sugerir automáticamente cuándo enviar una plantilla aprobada para re-activar clientes inactivos o confirmar citas sin intervención humana.
          </p>
        </motion.div>
        
        <motion.div 
          variants={itemVariants}
          whileHover={{ y: -4 }}
          className="glass-panel p-8 flex flex-col justify-center transition-all"
        >
          <AlertCircle className="text-semantic-warning mb-5" size={28} />
          <h4 className="text-lg font-bold text-text-primary mb-2">Políticas de Meta</h4>
          <p className="text-sm text-text-secondary leading-relaxed font-medium">
            Recuerda que las plantillas de marketing requieren aprobación previa y pueden tener costos adicionales por conversación iniciada por el negocio.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default MetaTemplatesView;
