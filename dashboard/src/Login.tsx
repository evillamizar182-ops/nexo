import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, Scissors, CheckCircle, Loader2 } from 'lucide-react';
import api from './api';
import { useStore } from './store/useStore';

// ── Framer Motion Variants (originales intocables) ─────────────
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut', staggerChildren: 0.1 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } }
};

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { setAuthenticated, setUser } = useStore();

  // ── Lógica original intocable ──────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // El servidor responde con Set-Cookie httpOnly (el token NO llega a JS).
      const response = await api.post('/auth/login', { email, password });
      const { user } = response.data;
      setUser(user);
      setSuccess(true);
      setTimeout(() => setAuthenticated(true), 700);
    } catch (err: any) {
      const data = err.response?.data;
      const status = err.response?.status;
      let msg = data?.message || data?.error;
      if (status === 429) msg = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
      else if (status === 401) msg = 'Credenciales inválidas. Verifica tu email y contraseña.';
      else if (!err.response) msg = 'No se pudo conectar con el servidor. ¿Está encendido el backend?';
      setError(msg || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>

      {/* ── PANEL IZQUIERDO — Marca 45% ─────────────────────── */}
      <div style={{
        width: '45%', flexShrink: 0,
        background: '#0f172a',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 40px',
      }}>

        {/* Formas geométricas flotantes */}
        <div className="animate-float" style={{
          position: 'absolute', top: '8%', right: '10%',
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.10)', pointerEvents: 'none',
        }} />
        <div className="animate-float-delay-1" style={{
          position: 'absolute', bottom: '15%', left: '8%',
          width: '80px', height: '80px',
          background: 'rgba(255,255,255,0.07)',
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          pointerEvents: 'none',
        }} />
        <div className="animate-float-delay-2" style={{
          position: 'absolute', top: '55%', right: '6%',
          width: '60px', height: '60px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '16px', transform: 'rotate(20deg)',
          pointerEvents: 'none',
        }} />

        {/* Contenido del panel izquierdo */}
        <motion.div
          variants={containerVariants} initial="hidden" animate="show"
          style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: '340px' }}
        >
          {/* Ícono */}
          <motion.div variants={itemVariants}
            whileHover={{ scale: 1.05, rotate: 5 }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '72px', height: '72px', borderRadius: '20px',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: 'white', marginBottom: '24px',
            }}
          >
            <Scissors size={32} strokeWidth={1.8} />
          </motion.div>

          {/* Nombre */}
          <motion.h1 variants={itemVariants} style={{
            fontFamily: 'Syne, sans-serif', fontSize: '52px', fontWeight: 900,
            color: 'white', letterSpacing: '-1px', margin: '0 0 12px',
            lineHeight: 0.95,
          }}>
            NEXO<br />IA
          </motion.h1>

          {/* Línea decorativa */}
          <motion.div variants={itemVariants} style={{
            width: '40px', height: '3px', background: 'rgba(255,255,255,0.5)',
            borderRadius: '999px', margin: '0 auto 16px',
          }} />

          {/* Tagline */}
          <motion.p variants={itemVariants} style={{
            fontStyle: 'italic', fontSize: '16px', fontWeight: 400,
            color: 'rgba(255,255,255,0.80)', margin: '0 0 36px', lineHeight: 1.5,
          }}>
            Tu imagen, nuestro arte
          </motion.p>

          {/* Pills */}
          <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {['✓ Gestión fácil', '✓ Control total', '✓ Tiempo real'].map(item => (
              <div key={item} style={{
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.20)',
                borderRadius: '999px', padding: '7px 20px',
                fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.90)',
                display: 'inline-block', textAlign: 'center',
              }}>
                {item}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ── PANEL DERECHO — Formulario 55% ──────────────────── */}
      <div style={{
        flex: 1, background: '#ffffff',
        boxShadow: 'inset 8px 0 32px rgba(15,23,42,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 40px',
        position: 'relative',
      }}>
        <motion.div
          variants={containerVariants} initial="hidden" animate="show"
          style={{ width: '100%', maxWidth: '400px' }}
        >
          {/* Header del formulario */}
          <motion.div variants={itemVariants} style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontFamily: 'Syne, sans-serif', fontSize: '32px', fontWeight: 800,
              color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: '0 0 8px',
              lineHeight: 1.1,
            }}>
              Bienvenido de vuelta
            </h2>
            <p style={{
              fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6,
            }}>
              Ingresa tus credenciales para acceder al panel
            </p>
            <div style={{
              width: '40px', height: '3px',
              background: 'var(--gradient-brand)',
              borderRadius: '999px', marginTop: '20px',
            }} />
          </motion.div>

          {/* Formulario */}
          <motion.form variants={itemVariants} onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Campo email */}
            <div style={{ position: 'relative', paddingTop: '8px' }}>
              <motion.label
                initial={false}
                animate={{
                  y: (activeField === 'email' || email) ? -24 : 2,
                  scale: (activeField === 'email' || email) ? 0.85 : 1,
                  color: activeField === 'email' ? 'var(--brand-primary)' : 'var(--text-tertiary)',
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{
                  position: 'absolute', left: '16px', top: '20px',
                  fontSize: '14px', fontWeight: 600, transformOrigin: 'left',
                  pointerEvents: 'none', zIndex: 10, background: 'white',
                  padding: '0 4px',
                }}
              >
                Email de Acceso
              </motion.label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setActiveField('email')}
                onBlur={() => setActiveField(null)}
                required
                style={{
                  width: '100%', height: '54px',
                  padding: '0 16px',
                  fontSize: '15px', fontWeight: 500,
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${activeField === 'email' ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                  background: 'rgba(255,255,255,0.98)',
                  color: 'var(--text-primary)',
                  boxShadow: activeField === 'email' ? '0 0 0 3px rgba(29,78,216,0.12)' : 'none',
                  transition: 'all 0.2s ease', outline: 'none',
                }}
              />
            </div>

            {/* Campo contraseña */}
            <div style={{ position: 'relative', paddingTop: '8px' }}>
              <motion.label
                initial={false}
                animate={{
                  y: (activeField === 'password' || password) ? -24 : 2,
                  scale: (activeField === 'password' || password) ? 0.85 : 1,
                  color: activeField === 'password' ? 'var(--brand-primary)' : 'var(--text-tertiary)',
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{
                  position: 'absolute', left: '16px', top: '20px',
                  fontSize: '14px', fontWeight: 600, transformOrigin: 'left',
                  pointerEvents: 'none', zIndex: 10, background: 'white',
                  padding: '0 4px',
                }}
              >
                Contraseña
              </motion.label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setActiveField('password')}
                onBlur={() => setActiveField(null)}
                required
                style={{
                  width: '100%', height: '54px',
                  padding: '0 48px 0 16px',
                  fontSize: '15px', fontWeight: 500,
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${activeField === 'password' ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                  background: 'rgba(255,255,255,0.98)',
                  color: 'var(--text-primary)',
                  boxShadow: activeField === 'password' ? '0 0 0 3px rgba(29,78,216,0.12)' : 'none',
                  transition: 'all 0.2s ease', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', padding: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.2s, transform 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                <motion.div animate={{ rotate: showPassword ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </motion.div>
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '12px 14px',
                    background: 'rgba(220,38,38,0.06)',
                    borderLeft: '3px solid var(--brand-danger)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  <AlertCircle size={16} style={{ color: 'var(--brand-danger)', flexShrink: 0, marginTop: '1px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--brand-danger)', margin: 0 }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botón de login */}
            <motion.button
              whileHover={{ translateY: success ? 0 : -2, boxShadow: success ? 'var(--shadow-success)' : 'var(--shadow-brand-lg)', filter: 'brightness(1.05)' }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading || success}
              style={{
                width: '100%', height: '54px',
                background: success ? 'var(--gradient-success)' : 'var(--gradient-brand)',
                color: 'white', borderRadius: 'var(--radius-md)',
                fontSize: '15px', fontWeight: 700, letterSpacing: '0.3px',
                border: 'none', cursor: loading || success ? 'default' : 'pointer',
                boxShadow: success ? 'var(--shadow-success)' : 'var(--shadow-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'background 0.3s ease, box-shadow 0.3s ease',
              }}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div key="loading" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Verificando...
                  </motion.div>
                ) : success ? (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={18} /> Acceso concedido
                  </motion.div>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Entrar al Sistema
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.form>

          {/* Footer */}
          <motion.p variants={itemVariants}
            style={{ textAlign: 'center', marginTop: '28px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            ¿Problemas para acceder?{' '}
            <span style={{ color: 'var(--brand-primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
              Contacta al administrador
            </span>
          </motion.p>
        </motion.div>
      </div>

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Login;
