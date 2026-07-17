import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, Users, AlertCircle, Edit3,
  Plus, Search, CheckCircle2, Package, Tag, Layers, 
  Trash2, DollarSign, X, Check, Eye, EyeOff
} from 'lucide-react';
import api from '../api';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } }
};

const tableRowVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }
};

const InventorySkeleton = () => (
  <div className="p-8 space-y-8 max-w-7xl mx-auto">
    <div className="h-12 w-64 bg-border animate-pulse rounded-2xl"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="h-32 bg-border animate-pulse rounded-2xl col-span-1"></div>
      <div className="h-32 bg-border animate-pulse rounded-2xl col-span-2"></div>
      <div className="h-[400px] bg-border animate-pulse rounded-2xl col-span-3"></div>
    </div>
  </div>
);

const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'low' | 'active'>('all');
  const [newProductModal, setNewProductModal] = useState(false);
  
  // New product form state
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState(0);
  const [newProductStock, setNewProductStock] = useState(0);

  const loadData = async () => {
    try {
      const resInv = await api.get('/dashboard/inventory');
      setProducts(resInv.data);
      const resClients = await api.get('/dashboard/clients');
      setClients(resClients.data.map((c: any) => ({
        id: c.id,
        nombre: c.name || 'Sin nombre',
        telefono: c.phoneHash.substring(0, 8) + '...',
        estado: 'Registrado',
        ultima: new Date(c.createdAt).toLocaleDateString('es-CO')
      })));
    } catch (e) { 
      console.error(e); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePriceChange = (id: string, newPrice: number) => {
    setProducts(products.map(p => p.id === id ? { ...p, price: newPrice } : p));
  };

  const handleStockChange = (id: string, newStock: number) => {
    setProducts(products.map(p => p.id === id ? { ...p, stock: newStock } : p));
  };

  const toggleProductActive = (id: string) => {
    setProducts(products.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const handleSave = async () => {
    try {
      for (const product of products) {
        await api.post('/dashboard/inventory', product);
      }
      setIsEditing(false);
      
      const notification = document.createElement('div');
      notification.className = "fixed bottom-10 right-10 bg-white border border-semantic-success text-text-primary px-6 py-4 rounded-2xl shadow-glow z-[100] font-bold text-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4";
      notification.innerHTML = `<span class="bg-semantic-success/10 text-semantic-success p-1.5 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> Cambios guardados exitosamente`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
      
      loadData();
    } catch (e) {
      console.error("Error al guardar inventario:", e);
      alert("Error al guardar los cambios");
    }
  };

  const handleAddNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const payload = {
      name: newProductName,
      price: newProductPrice,
      stock: newProductStock,
      isActive: true
    };

    try {
      await api.post('/dashboard/inventory', payload);
      setNewProductName('');
      setNewProductPrice(0);
      setNewProductStock(0);
      setNewProductModal(false);
      loadData();
    } catch (err) {
      console.error("Error al crear producto:", err);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este producto?")) return;
    try {
      // Toggle active status as soft delete
      const prod = products.find(p => p.id === id);
      if (prod) {
        await api.post('/dashboard/inventory', { ...prod, isActive: false, stock: 0 });
        loadData();
      }
    } catch (err) {
      console.error("Error al desactivar/eliminar producto:", err);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const lower = searchTerm.toLowerCase();
    return clients.filter(c => 
      c.nombre.toLowerCase().includes(lower) || 
      c.telefono.toLowerCase().includes(lower)
    );
  }, [clients, searchTerm]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (productFilter === 'low') return p.stock <= 3;
      if (productFilter === 'active') return p.isActive;
      return true;
    });
  }, [products, productFilter]);

  // Bento Metrics
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.stock <= 3).length;
  const activeCount = products.filter(p => p.isActive).length;

  if (loading) return <InventorySkeleton />;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-20 max-w-7xl mx-auto px-4"
    >
      {/* 🟢 HEADER DE SECCIÓN */}
      <motion.div variants={itemVariants} className="flex justify-between items-center bg-white border border-border-subtle p-4 rounded-lg shadow-sm">
        <div>
          <p className="text-xs text-text-secondary font-medium">Control y stock de consumibles del negocio</p>
        </div>
        <div className="flex gap-3">
          {isEditing ? (
            <motion.div className="flex gap-2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <button 
                onClick={() => { setIsEditing(false); loadData(); }} 
                className="px-4 py-2 border border-border bg-white/80 hover:bg-white text-text-secondary rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                className="btn-primary px-5 py-2 text-xs flex items-center gap-1.5 active:scale-95"
              >
                <Check size={14} strokeWidth={2.5} /> Guardar Todo
              </button>
            </motion.div>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEditing(true)} 
                className="px-4 py-2 bg-white/80 border border-border rounded-xl text-xs font-bold text-text-primary hover:bg-white flex items-center gap-2 transition-all active:scale-95 shadow-sm"
              >
                <Edit3 size={14} className="text-accent-primary" /> Editar Inventario
              </button>
              <button 
                onClick={() => setNewProductModal(true)}
                className="btn-primary px-5 py-2 text-xs flex items-center gap-1.5 active:scale-95"
              >
                <Plus size={14} strokeWidth={2.5} /> Nuevo Item
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────────
          BENTO BOX GRID INVENTORY
          ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Bento Card 1: Stats summary (col-span-1) */}
        <motion.div 
          variants={itemVariants}
          className="glass-panel p-6 flex flex-col justify-between min-h-[160px] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 text-accent-primary/10">
            <Package size={56} />
          </div>
          <div>
            <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Resumen General</p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div>
                <p className="text-2xl font-black text-text-primary">{totalProducts}</p>
                <p className="text-[9px] text-text-secondary font-bold uppercase mt-1">Items</p>
              </div>
              <div>
                <p className={`text-2xl font-black ${lowStockCount > 0 ? 'text-semantic-danger' : 'text-text-primary'}`}>{lowStockCount}</p>
                <p className="text-[9px] text-text-secondary font-bold uppercase mt-1">Bajo Stock</p>
              </div>
              <div>
                <p className="text-2xl font-black text-text-primary">{activeCount}</p>
                <p className="text-[9px] text-text-secondary font-bold uppercase mt-1">Activos</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 text-[9px] text-text-secondary font-bold uppercase flex items-center gap-1.5">
            <Layers size={12} className="text-accent-tertiary" /> Total categorías: 3
          </div>
        </motion.div>

        {/* Bento Card 2: Interactive Controls & Filters (col-span-2) */}
        <motion.div 
          variants={itemVariants}
          className="glass-panel p-6 flex flex-col justify-between min-h-[160px]"
        >
          <div>
            <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Filtrado & Búsqueda de Productos</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button 
                onClick={() => setProductFilter('all')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  productFilter === 'all' 
                    ? 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary' 
                    : 'bg-white/60 border-border/60 hover:bg-white text-text-secondary'
                }`}
              >
                Todos los productos
              </button>
              <button 
                onClick={() => setProductFilter('low')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  productFilter === 'low' 
                    ? 'bg-semantic-danger/10 border-semantic-danger/20 text-semantic-danger' 
                    : 'bg-white/60 border-border/60 hover:bg-white text-text-secondary'
                }`}
              >
                <AlertCircle size={14} /> Stock Crítico ({lowStockCount})
              </button>
              <button 
                onClick={() => setProductFilter('active')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  productFilter === 'active' 
                    ? 'bg-accent-tertiary/10 border-accent-tertiary/20 text-accent-tertiary' 
                    : 'bg-white/60 border-border/60 hover:bg-white text-text-secondary'
                }`}
              >
                Solo items activos ({activeCount})
              </button>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 text-[9px] text-text-secondary font-bold uppercase">
            Visualizando {filteredProducts.length} de {totalProducts} items
          </div>
        </motion.div>

        {/* Bento Card 3: Products Data Grid (col-span-3) */}
        <motion.div 
          variants={itemVariants}
          className="glass-panel col-span-3 p-0 overflow-hidden"
        >
          <div className="p-6 border-b border-border/40 flex justify-between items-center">
            <h4 className="text-xs font-black text-text-secondary uppercase tracking-widest">Catálogo de Artículos</h4>
            {isEditing && (
              <span className="text-[10px] text-accent-primary font-bold uppercase animate-pulse flex items-center gap-1">
                <AlertCircle size={12} /> Modo edición activo
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-secondary border-b border-border/40">
                  <th className="px-6 py-4 text-micro text-text-secondary w-16">Tipo</th>
                  <th className="px-6 py-4 text-micro text-text-secondary">Nombre de Producto</th>
                  <th className="px-6 py-4 text-micro text-text-secondary text-right">Precio unitario</th>
                  <th className="px-6 py-4 text-micro text-text-secondary text-center w-40">Stock / Nivel</th>
                  <th className="px-6 py-4 text-micro text-text-secondary text-center w-24">Estado</th>
                  <th className="px-6 py-4 text-micro text-text-secondary text-right w-28">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((p) => {
                    const isLow = p.stock <= 3;
                    const isShampoo = p.name?.toLowerCase().includes('shampoo');
                    const isWax = p.name?.toLowerCase().includes('cera');

                    return (
                      <motion.tr 
                        key={p.id}
                        variants={tableRowVariants}
                        layout
                        className={`hover:bg-white/40 transition-colors ${!p.isActive ? 'opacity-60' : ''}`}
                      >
                        {/* Avatar */}
                        <td className="px-6 py-4 text-center">
                          <div className="w-10 h-10 rounded-xl bg-bg-secondary border border-border flex items-center justify-center text-xl shadow-sm">
                            {isWax ? '💆‍♂️' : isShampoo ? '🧴' : '📦'}
                          </div>
                        </td>

                        {/* Name */}
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={p.name} 
                              onChange={(e) => setProducts(products.map(prod => prod.id === p.id ? { ...prod, name: e.target.value } : prod))}
                              className="w-full max-w-sm bg-white border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                            />
                          ) : (
                            <div>
                              <p className="font-bold text-xs text-text-primary">{p.name}</p>
                              <p className="text-[9px] text-text-secondary font-bold uppercase mt-0.5">ID: {p.id}</p>
                            </div>
                          )}
                        </td>

                        {/* Price */}
                        <td className="px-6 py-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-xs text-text-secondary font-bold">$</span>
                              <input 
                                type="number" 
                                value={p.price} 
                                onChange={(e) => handlePriceChange(p.id, parseInt(e.target.value))}
                                className="w-24 text-right bg-white border border-border rounded-xl px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-black text-text-primary">
                              ${(parseFloat(p.price) || 0).toLocaleString('es-CO')}
                            </span>
                          )}
                        </td>

                        {/* Stock Slider/Level */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[10px] text-text-secondary font-bold">
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={p.stock} 
                                  onChange={(e) => handleStockChange(p.id, parseInt(e.target.value))}
                                  className="w-14 bg-white border border-border rounded-lg py-0.5 text-center text-xs font-bold"
                                />
                              ) : (
                                <span className={isLow ? 'text-semantic-danger font-black' : 'font-medium'}>
                                  {p.stock} Unidades
                                </span>
                              )}
                              <span className="text-[9px] font-medium">Capacidad: 20</span>
                            </div>
                            <div className="h-1.5 w-full bg-bg-secondary rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((p.stock / 20) * 100, 100)}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className={`h-full rounded-full ${isLow ? 'bg-semantic-danger' : 'bg-accent-primary'}`}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4 text-center">
                          <span className={`badge ${
                            !p.isActive 
                              ? 'badge-danger' 
                              : isLow 
                                ? 'badge-warning' 
                                : 'badge-success'
                          }`}>
                            {!p.isActive ? 'Desactivado' : isLow ? 'Crítico' : 'Disponible'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => toggleProductActive(p.id)}
                                  className="p-1.5 rounded-lg border border-border bg-white hover:bg-bg-secondary text-text-secondary transition-all"
                                  title={p.isActive ? "Desactivar" : "Activar"}
                                >
                                  {p.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button 
                                  onClick={() => handleDeleteProduct(p.id)}
                                  className="p-1.5 rounded-lg border border-semantic-danger/20 bg-white hover:bg-semantic-danger/5 text-semantic-danger transition-all"
                                  title="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-text-secondary font-medium italic">Lista</span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Bento Card 4: Clients & Loyalty (col-span-3) */}
        <motion.div 
          variants={itemVariants}
          className="glass-panel col-span-3 p-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-sm font-black text-text-secondary uppercase tracking-widest">Cartera de Clientes Registrados</h3>
              <p className="text-[10px] text-text-secondary mt-0.5">Control de registros y estado de fidelización</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input 
                type="text" 
                placeholder="Buscar cliente por nombre..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/60 border border-border rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all" 
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-secondary border-b border-border/40">
                  <th className="px-6 py-3.5 text-micro text-text-secondary">Cliente</th>
                  <th className="px-6 py-3.5 text-micro text-text-secondary">Contacto ID</th>
                  <th className="px-6 py-3.5 text-micro text-text-secondary text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                <AnimatePresence mode="popLayout">
                  {filteredClients.map((c) => (
                    <motion.tr 
                      key={c.id} 
                      variants={tableRowVariants}
                      layout
                      className="hover:bg-white/40 transition-all group"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-xs text-text-primary group-hover:text-accent-primary transition-colors">{c.nombre}</p>
                          <p className="text-[9px] text-text-secondary font-medium uppercase mt-0.5">Fidelización: {c.ultima}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-text-secondary font-bold font-mono">{c.telefono}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="badge badge-info">
                          {c.estado}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                  {filteredClients.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-10 py-16 text-center text-xs text-text-secondary">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users size={28} className="text-border" />
                          <p className="font-bold">Sin resultados encontrados</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>

      {/* ────────────────────────────────────────────────────────
          MODAL: NUEVO PRODUCTO
          ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {newProductModal && (
          <div className="fixed inset-0 bg-text-primary/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-border rounded-2xl p-6 w-full max-w-md shadow-glow relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-accent-primary"></div>
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Plus size={16} className="text-accent-primary" /> Agregar Nuevo Artículo
                </h3>
                <button 
                  onClick={() => setNewProductModal(false)}
                  className="p-1 rounded-lg border border-border hover:bg-bg-secondary text-text-secondary transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleAddNewProduct} className="space-y-4">
                <div>
                  <label className="text-[10px] text-text-secondary font-black uppercase tracking-widest block mb-1">Nombre del artículo</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ej. Cera Moldeadora Mate" 
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-text-secondary font-black uppercase tracking-widest block mb-1">Precio COP</label>
                    <input 
                      type="number" 
                      required
                      placeholder="85000" 
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-secondary font-black uppercase tracking-widest block mb-1">Stock Inicial</label>
                    <input 
                      type="number" 
                      required
                      placeholder="10" 
                      value={newProductStock}
                      onChange={(e) => setNewProductStock(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-2 justify-end">
                  <button 
                    type="button"
                    onClick={() => setNewProductModal(false)}
                    className="px-4 py-2 border border-border bg-white text-text-secondary rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="btn-primary px-5 py-2 text-xs font-black uppercase"
                  >
                    Crear Producto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default InventoryView;
