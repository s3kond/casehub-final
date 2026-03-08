import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, User, Home, Settings, X, Box } from 'lucide-react';

import { HomePage } from './components/Home';
import { ProfilePage } from './components/Profile';
import { AdminPanel } from './components/Admin'; 
import { Cart } from './components/Cart';

// Вспомогательный компонент для навигации с поддержкой уведомлений (Badge)
const Navigation = ({ orders, userProfile }: any) => {
  const location = useLocation();
  const unpaidCount = orders.filter((o: any) => o.status === 'pending').length;

  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-sm max-w-sm bg-zinc-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[3rem] flex justify-around py-5 z-[500]">
      <Link to="/" className={location.pathname === '/' ? 'text-blue-500' : 'text-zinc-500'}>
        <Home size={26} />
      </Link>
      
      {userProfile?.role === 'admin' && (
        <Link to="/admin" className={location.pathname === '/admin' ? 'text-blue-500' : 'text-zinc-500'}>
          <Settings size={26} />
        </Link>
      )}

      <Link to="/profile" className="relative group">
        <User size={26} className={location.pathname === '/profile' ? 'text-blue-500' : 'text-zinc-500'} />
        {unpaidCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#0a0a0a] animate-pulse">
            {unpaidCount}
          </span>
        )}
      </Link>
    </nav>
  );
};

export default function App() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]); // ЛИЧНЫЕ ЗАКАЗЫ (для профиля)
  const [adminOrders, setAdminOrders] = useState<any[]>([]); // ВСЕ ЗАКАЗЫ (для админки)
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<number[]>(() => {
    const saved = localStorage.getItem('wishlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

const API_URL = 'https://casehub-server.onrender.com';

  // 1. Обновление товаров
  const refreshProducts = useCallback(async () => {
    try {
      const prodRes = await fetch(`${API_URL}/api/products`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      const prodData = await prodRes.json();
      setProducts(Array.isArray(prodData) ? prodData : []);
    } catch (err) { console.error("Refresh error:", err); }
  }, [API_URL]);

  // 2. Загрузка личных заказов
  const fetchOrders = useCallback(async (tgId: string) => {
    if (!tgId) return;
    try {
      const orderRes = await fetch(`${API_URL}/api/orders/${tgId}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      const orderData = await orderRes.json();
      setOrders(Array.isArray(orderData) ? orderData : []);
    } catch (err) { console.error("Orders load error:", err); }
  }, [API_URL]);

  // 3. Загрузка ВСЕХ заказов (для админа)
  const fetchAllOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/orders`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      const data = await res.json();
      setAdminOrders(Array.isArray(data) ? data : []);
    } catch (err) { console.error("Admin orders load error:", err); }
  }, [API_URL]);

  useEffect(() => { localStorage.setItem('wishlist', JSON.stringify(wishlist)); }, [wishlist]);

  useEffect(() => {
    document.body.style.overflow = (selectedProduct || isCartOpen) ? 'hidden' : 'unset';
  }, [selectedProduct, isCartOpen]);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready();
    tg?.expand();

    const loadAppData = async () => {
      try {
        await refreshProducts();
        let tgUser = tg?.initDataUnsafe?.user || { id: 0, username: 'guest', first_name: 'Guest' };

        const authRes = await fetch(`${API_URL}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({ user: tgUser })
        });
        const userData = await authRes.json();
        setUserProfile(userData);

        if (userData.tg_id) {
          await fetchOrders(userData.tg_id); // Свои заказы грузим всегда
        }
        if (userData.role === 'admin') {
          await fetchAllOrders(); // Все заказы грузим только если админ
        }
      } catch (err) { console.error("Load error:", err); } finally { setLoading(false); }
    };
    loadAppData();
  }, [refreshProducts, fetchOrders, fetchAllOrders, API_URL]);

  const getImageUrl = (path: string) => {
    if (!path) return 'https://via.placeholder.com/300';
    return path.startsWith('http') ? path : `${API_URL}${path}`;
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing && existing.quantity >= product.stock) {
        alert(`Limit reached! Only ${product.stock} available.`);
        return prev;
      }
      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const toggleWishlist = (id: number) => {
    setWishlist(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged();
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#050505] font-black italic text-blue-500 animate-pulse uppercase tracking-widest">HUB_LOADING...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-32">
        <header className="px-6 py-6 flex justify-between items-center sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-xl z-[500] border-b border-white/5">
          <Link to="/" className="text-2xl font-black italic uppercase tracking-tighter">CASE<span className="text-blue-500">HUB</span></Link>
          <button onClick={() => { setIsCartOpen(true); (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); }} className="p-3 bg-zinc-900 rounded-2xl relative active:scale-90 transition-transform">
            <ShoppingCart size={22} />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-blue-600 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold animate-in zoom-in">{cart.reduce((a, b) => a + b.quantity, 0)}</span>}
          </button>
        </header>

        <Routes>
          <Route path="/" element={<HomePage products={products} activeCategory={activeCategory} setActiveCategory={setActiveCategory} setSelectedProduct={setSelectedProduct} wishlist={wishlist} toggleWishlist={toggleWishlist} getImageUrl={getImageUrl} />} />
          <Route path="/profile" element={<ProfilePage userProfile={userProfile} orders={orders} wishlist={wishlist} products={products} setSelectedProduct={setSelectedProduct} getImageUrl={getImageUrl} API_URL={API_URL} />} />
          {userProfile?.role === 'admin' && (
            <Route path="/admin" element={<AdminPanel products={products} setProducts={setProducts} orders={adminOrders} setOrders={setAdminOrders} getImageUrl={getImageUrl} API_URL={API_URL} />} />
          )}
        </Routes>

        <Navigation orders={orders} userProfile={userProfile} />

        {/* MODAL: PRODUCT DETAILS */}
        {selectedProduct && (
          <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={() => setSelectedProduct(null)} />
            <div className="relative w-full max-w-lg bg-[#0a0a0a] rounded-t-[3rem] sm:rounded-[3rem] border-t border-white/10 flex flex-col max-h-[92vh] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden">
              <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 z-[1100] p-3 bg-black/50 rounded-full text-white/70 border border-white/10 hover:text-white"><X size={20} /></button>
              <div className="overflow-y-auto p-6 pt-0">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 mb-6" />
                <img src={getImageUrl(selectedProduct.images?.[0])} className="w-full aspect-square object-cover rounded-[2.5rem] shadow-2xl border border-white/5 mb-8" alt={selectedProduct.name} />
                <div className="space-y-6 px-2 pb-32">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl font-black uppercase italic leading-none tracking-tighter">{selectedProduct.name}</h2>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedProduct.categories?.map((cat: string) => (<span key={cat} className="bg-blue-500/10 text-blue-500 text-[8px] font-black px-2 py-0.5 rounded border border-blue-500/20 uppercase">{cat}</span>))}
                      </div>
                    </div>
                    <p className="text-blue-500 font-black text-2xl italic">${selectedProduct.price_usd || selectedProduct.priceUsd}</p>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2"><Box size={16} className="text-zinc-500" /><span className="text-[10px] font-black uppercase text-zinc-500">Availability</span></div>
                    <span className={`text-sm font-black ${Number(selectedProduct.stock) <= 0 ? 'text-red-500' : 'text-white'}`}>{Number(selectedProduct.stock) > 0 ? `${selectedProduct.stock} in stock` : 'Sold Out'}</span>
                  </div>
                  <p className="text-zinc-400 text-sm leading-relaxed font-medium">{selectedProduct.description || "Premium Hub Edition. Crafted with precision."}</p>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 w-full p-6 pt-10 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
                <button disabled={Number(selectedProduct.stock) <= 0} onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className={`w-full py-5 rounded-[2rem] font-black uppercase italic text-lg transition-all shadow-2xl ${Number(selectedProduct.stock) <= 0 ? 'bg-zinc-800 text-zinc-500' : 'bg-blue-600 text-white shadow-blue-600/30 active:scale-[0.97]'}`}>{Number(selectedProduct.stock) <= 0 ? 'Out of Stock' : 'Add to Cart'}</button>
              </div>
            </div>
          </div>
        )}

        {isCartOpen && (
          <Cart 
            cart={cart} setCart={setCart} userProfile={userProfile} onClose={() => setIsCartOpen(false)} 
            getImageUrl={getImageUrl} API_URL={API_URL} refreshProducts={refreshProducts}
            fetchOrders={async () => { 
                await fetchOrders(userProfile.tg_id); 
                if(userProfile.role === 'admin') await fetchAllOrders(); 
            }} 
          />
        )}
      </div>
    </Router>
  );
}