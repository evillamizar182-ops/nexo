import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Package, 
  Settings, 
  Bell,
  LogOut,
  User as UserIcon,
  X,
  FileText,
  Sparkles,
  DollarSign,
  Scissors,
  ChevronRight,
  Zap,
  Menu
} from 'lucide-react';

import { useStore } from './store/useStore';
import Login from './Login';
import api from './api';

import DashboardView from './components/DashboardView';
import ChatMonitor from './components/ChatMonitor';
import FinanceView from './components/FinanceView';
import InventoryView from './components/InventoryView';
import IASettingsView from './components/IASettingsView';
import MetaTemplatesView from './components/MetaTemplatesView';
import AssistantView from './components/AssistantView';
import ProfileView from './components/ProfileView';
import BusinessSettingsView from './components/BusinessSettingsView';

// ── Framer Motion Variants (originales, intocables) ────────────
const sidebarVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } }
};

const App: React.FC = () => {
  const { isAuthenticated, authLoading, setAuthenticated, setAuthLoading, activeTab, setActiveTab, setUser } = useStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: number; text: string; time: string; type: string; read: boolean }>>([]);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Scroll listener para header
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setShowProfileMenu(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // La sesión se valida contra el servidor (la cookie httpOnly viaja sola).
    const checkSession = async () => {
      try {
        const response = await api.get('/auth/me');
        setUser(response.data);
        setAuthenticated(true);
      } catch (e) {
        setAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };
    checkSession();
  }, [setAuthenticated, setAuthLoading, setUser]);

  const handleLogout = async () => {
    setShowProfileMenu(false);
    try { await api.post('/auth/logout'); } catch { /* revocación best-effort */ }
    setAuthenticated(false);
    setUser(null);
  };

  const markAllRead = () => setNotifications(notifications.map(n => ({ ...n, read: true })));
  const deleteNotif = (id: number) => setNotifications(notifications.filter(n => n.id !== id));
  const unreadCount = notifications.filter(n => !n.read).length;

  // Mientras se valida la sesión contra el servidor, no parpadees el login.
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base, #0b0f1a)' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(29,78,216,0.25)', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return <Login />;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard',        icon: <LayoutDashboard size={18} /> },
    { id: 'finanzas',  label: 'Finanzas',          icon: <DollarSign size={18} /> },
    { id: 'chats',     label: 'Monitor',            icon: <MessageSquare size={18} /> },
    { id: 'asistente', label: 'Asistente IA',       icon: <Sparkles size={18} /> },
    { id: 'templates', label: 'Plantillas',          icon: <FileText size={18} /> },
    { id: 'inventory', label: 'Inventario',          icon: <Package size={18} /> },
    { id: 'settings',  label: 'Configuración IA',    icon: <Settings size={18} /> },
    { id: 'business',  label: 'Mi Barbería',         icon: <Scissors size={18} /> },
  ];

  const activeLabel = activeTab === 'profile'
    ? 'Perfil'
    : menuItems.find(i => i.id === activeTab)?.label ?? '';

  return (
    <div className="flex min-h-screen overflow-x-hidden relative bg-bg-base text-text-primary">
      
      {/* ── FASE 2: Ambient Light Background ─────────────────────────── */}
      <div className="ambient-bg">
        <div className="ambient-sphere ambient-sphere-1" />
        <div className="ambient-sphere ambient-sphere-2" />
        <div className="ambient-sphere ambient-sphere-3" />
      </div>

      {/* ── FASE 3: SIDEBAR PREMIUM DE CLASE MUNDIAL ─────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarCollapsed ? 88 : 260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="sidebar-dark flex flex-col fixed h-full z-40"
      >
        {/* Header del Sidebar */}
        <div className={`p-6 pb-5 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3.5">
            <motion.div
              whileHover={{ rotate: -10, scale: 1.05 }}
              style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-brand)' }}
              className="w-10 h-10 rounded-full text-white flex items-center justify-center flex-shrink-0"
            >
              <Scissors size={18} strokeWidth={2.5} />
            </motion.div>
            {!isSidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0">
                <span className="text-white block m-0 p-0 leading-none whitespace-nowrap"
                    style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700 }}>
                  NEXO IA
                </span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Separador */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: isSidebarCollapsed ? '0 16px' : '0 24px' }} />

        {/* Navegación */}
        <motion.nav
          variants={sidebarVariants}
          initial="hidden"
          animate="show"
          className={`flex-1 pt-4 space-y-1 overflow-y-auto custom-scrollbar ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}
        >
          {!isSidebarCollapsed && <span className="sidebar-group-label" style={{ paddingLeft: '12px' }}>Menú Principal</span>}

          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                variants={itemVariants}
                onClick={() => setActiveTab(item.id as any)}
                whileHover={{ x: isActive ? 0 : 3 }}
                className={`sidebar-nav-item${isActive ? ' active' : ''} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    style={{ background: 'var(--gradient-brand)' }}
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
                  />
                )}
                <motion.span
                  animate={{
                    rotate: isActive ? 5 : 0,
                    scale:  isActive ? 1.15 : 1,
                  }}
                  transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
                  className="nav-icon z-10 flex-shrink-0"
                >
                  {item.icon}
                </motion.span>
                {!isSidebarCollapsed && (
                  <span className="text-[13px] z-10 flex-1 text-left whitespace-nowrap">{item.label}</span>
                )}
              </motion.button>
            );
          })}
        </motion.nav>

        {/* Footer del sidebar — identidad pasiva; el único trigger del menú de perfil vive en el header */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: isSidebarCollapsed ? '16px 8px' : '16px' }}>
          <div className={`flex items-center p-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="flex items-center gap-3">
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--gradient-brand)',
                display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '13px', flexShrink: 0
              }}>
                NX
              </div>
              {!isSidebarCollapsed && (
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>Admin</p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Pro User</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <motion.main 
        initial={false}
        animate={{ marginLeft: isSidebarCollapsed ? 88 : 260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex-1 min-h-screen flex flex-col relative z-10"
      >
        {/* ── FASE 4: HEADER PRINCIPAL ─────────────────────────── */}
        <header className={`header-sticky${scrolled ? ' scrolled' : ''} px-6 lg:px-8 flex justify-between items-center sticky top-0 z-50 h-[64px]`}>
          
          {/* Controles Izquierda e Identidad */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-[36px] h-[36px] rounded-lg border border-border-default bg-white flex items-center justify-center text-text-secondary hover:text-brand-primary hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
            >
              <Menu size={18} />
            </button>
            <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Dashboard
              </span>
              <ChevronRight size={10} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {activeLabel}
              </span>
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>
              {activeLabel}
            </h2>
          </div>

          {/* Acciones del header */}
          <div className="flex items-center gap-4 relative">
            {/* Notificaciones */}
            <div className="relative" ref={notifRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  width: '40px', height: '40px',
                  borderRadius: '50%',
                  background: showNotifications ? 'rgba(29,78,216,0.10)' : '#ffffff',
                  border: '1px solid var(--border-default)',
                  color: showNotifications ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <Bell size={18} />
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      style={{
                        position: 'absolute', top: '-2px', right: '-2px',
                        width: '18px', height: '18px',
                        background: 'var(--brand-danger)',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '50%',
                        border: '2px solid var(--bg-surface)',
                      }}
                    >
                      {unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 16px)',
                      width: '320px',
                      background: 'rgba(255,255,255,0.95)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xl)',
                      boxShadow: 'var(--shadow-lg)',
                      padding: '16px',
                      zIndex: 50,
                      transformOrigin: 'top right',
                    }}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>
                        Notificaciones
                      </span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead}
                          style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                          Marcar leídas
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                      <AnimatePresence>
                        {notifications.length > 0 ? notifications.map(n => (
                          <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            style={{
                              display: 'flex', gap: '12px', padding: '12px 14px',
                              borderRadius: 'var(--radius-md)',
                              background: n.read ? 'transparent' : 'rgba(29,78,216,0.05)',
                              border: '1px solid var(--border-subtle)',
                              opacity: n.read ? 0.7 : 1,
                            }}
                            className="group relative"
                          >
                            <div style={{
                              width: '10px', height: '10px', borderRadius: '50%', marginTop: '3px', flexShrink: 0,
                              background: n.type === 'warning' ? 'var(--brand-warning)' :
                                          n.type === 'error' ? 'var(--brand-danger)' : 'var(--brand-success)',
                            }} />
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>{n.text}</p>
                              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>{n.time}</p>
                            </div>
                            <button onClick={() => deleteNotif(n.id)}
                              style={{ opacity: 0, padding: '2px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}
                              className="group-hover:opacity-100">
                              <X size={14} />
                            </button>
                          </motion.div>
                        )) : (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ textAlign: 'center', padding: '32px 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                            No tienes nuevas notificaciones
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
</div>
            {/* Avatar / Perfil Dropdown */}
            <div className="relative" ref={profileRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'var(--gradient-brand)',
                  border: '2px solid #ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 800, fontSize: '14px',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer'
                }}
              >
                NX
              </motion.button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 16px)',
                      width: '240px',
                      background: 'rgba(255,255,255,0.97)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xl)',
                      boxShadow: 'var(--shadow-lg)',
                      overflow: 'hidden',
                      zIndex: 50,
                      transformOrigin: 'top right',
                    }}
                  >
                    <div style={{ padding: '20px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(248,250,252,0.6)' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nexo Intelligence</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Sede Central</p>
                    </div>
                    <div style={{ padding: '8px' }}>
                      {[
                        { label: 'Perfil Local', icon: <UserIcon size={16}/>, tab: 'profile' },
                      ].map(item => (
                        <button key={item.tab}
                          onClick={() => { setActiveTab(item.tab as any); setShowProfileMenu(false); }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 12px', borderRadius: 'var(--radius-md)',
                            fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)',
                            background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(29,78,216,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand-primary)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
                        >
                          {item.icon} {item.label}
                        </button>
                      ))}
                      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '6px 12px' }} />
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 12px', borderRadius: 'var(--radius-md)',
                          fontSize: '13px', fontWeight: 600, color: 'var(--brand-danger)',
                          background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.06)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                      >
                        <LogOut size={16} /> Salida Segura
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Vista activa */}
        <div className="flex-1 p-8 relative max-w-7xl mx-auto w-full pb-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'circOut' }}
              className="h-full"
            >
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'chats'     && <ChatMonitor />}
              {activeTab === 'finanzas'  && <FinanceView />}
              {activeTab === 'asistente' && <AssistantView />}
              {activeTab === 'inventory' && <InventoryView />}
              {activeTab === 'profile'   && <ProfileView />}
              {activeTab === 'settings'  && <IASettingsView />}
              {activeTab === 'templates' && <MetaTemplatesView />}
              {activeTab === 'business'  && <BusinessSettingsView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
};

export default App;
