import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, User, Home, Settings, X, Box } from 'lucide-react';

import { HomePage } from './components/Home';
import { ProfilePage } from './components/Profile';
import { AdminPanel } from './components/Admin'; 
import { Cart } from './components/Cart';

const Navigation = ({ orders, userProfile }: any) => {
  const location = useLocation();
  const unpaidCount = orders?.filter((o: any) => o.status === 'pending').length || 0;

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
  const [orders, setOrders] = useState<any[]>([]);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
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

  // ПРЯМОЙ АДРЕС ТВОЕГО СЕРВЕРА
  const API_URL = 'https://casehub-server.onrender.com';

  const refreshProducts = useCallback(async () => {
    try {
      const prodRes = await fetch(`${API_URL}/api/products`);
      const prodData = await prodRes.json();
      console.log("Products loaded:", prodData);
      setProducts(Array.isArray(prodData) ? prodData : []);
    } catch (err) { console.error("Refresh error:", err); }
  }, [API_URL]);

  const fetchOrders = useCallback(async (tgId: string) => {
    if (!tgId) return;
    try {
      const orderRes = await fetch(`${API_URL}/api/orders/${tgId}`);
      const orderData = await orderRes.json();
      setOrders(Array.isArray(orderData) ? orderData : []);
    } catch (err) { console.error("Orders load error:", err); }
  }, [API_URL]);

  const fetchAllOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/orders`);
      const data = await res.json();
      setAdminOrders(Array.isArray(data) ? data : []);
    } catch (err) { console.error("Admin orders error:", err); }
  }, [API_URL]);

  useEffect(() => { localStorage.setItem('wishlist', JSON.stringify(wishlist)); }, [wishlist]);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready();
    tg?.expand();

    const loadAppData = async () => {
      try {
        await refreshProducts();
        
        // Получаем данные юзера из ТГ или ставим дефолт для тестов
        let tgUser = tg?.initDataUnsafe?.user || { id: 1822541018, username: 'vovchik', first_name: 'Vovchik' };

        const authRes = await fetch(`${API_URL}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: tgUser })
        });
        
        const userData = await authRes.json();
        console.log("User Auth Success:", userData);
        setUserProfile(userData);

        if (userData?.tg_id) {
          await fetchOrders(userData.tg_id);
        }
        if (userData?.role === 'admin') {
          await fetchAllOrders();
        }
      } catch (err) { 
        console.error("Critical Load Error:", err); 
      } finally { 
        setLoading(false); 
      }
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
      if (existing && existing.quantity >= (product.stock || 10)) {
        return prev;
      }
      return existing 
        ? prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...prev, { ...product, quantity: 1 }];
    });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0a0a0a] text-blue-500 font-black italic animate-pulse tracking-widest">HUB_LOADING...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-32">
        <header className="px-6 py-6 flex justify-between items-center sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-xl z-[500] border-b border-white/5">
          <Link to="/" className="text-2xl font-black italic uppercase tracking-tighter">CASE<span className="text-blue-500">HUB</span></Link>
          <button onClick={() => setIsCartOpen(true)} className="p-3 bg-zinc-900 rounded-2xl relative active:scale-90 transition-transform">
            <ShoppingCart size={22} />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-blue-600 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{cart.reduce((a, b) => a + b.quantity, 0)}</span>}
          </button>
        </header>

        <Routes>
          <Route path="/" element={<HomePage products={products} activeCategory={activeCategory} setActiveCategory={setActiveCategory} setSelectedProduct={setSelectedProduct} wishlist={wishlist} toggleWishlist={(id: number) => setWishlist(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} getImageUrl={getImageUrl} />} />
          <Route path="/profile" element={<ProfilePage userProfile={userProfile} orders={orders} wishlist={wishlist} products={products} setSelectedProduct={setSelectedProduct} getImageUrl={getImageUrl} API_URL={API_URL} />} />
          {userProfile?.role === 'admin' && (
            <Route path="/admin" element={<AdminPanel products={products} setProducts={setProducts} orders={adminOrders} setOrders={setAdminOrders} getImageUrl={getImageUrl} API_URL={API_URL} />} />
          )}
        </Routes>

        <Navigation orders={orders} userProfile={userProfile} />

        {selectedProduct && (
          <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xl flex items-end justify-center">
            <div className="absolute inset-0" onClick={() => setSelectedProduct(null)} />
            <div className="relative w-full max-w-lg bg-[#0a0a0a] rounded-t-[3rem] border-t border-white/10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
               <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full"><X size={20}/></button>
               <img src={getImageUrl(selectedProduct.images?.[0])} className="w-full aspect-square object-cover rounded-[2rem] mb-6" alt="" />
               <h2 className="text-2xl font-black uppercase italic mb-2">{selectedProduct.name}</h2>
               <p className="text-blue-500 font-black text-xl mb-4">${selectedProduct.price_usd}</p>
               <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase italic">Add to Cart</button>
            </div>
          </div>
        )}

        {isCartOpen && (
          <Cart 
            cart={cart} setCart={setCart} userProfile={userProfile} onClose={() => setIsCartOpen(false)} 
            getImageUrl={getImageUrl} API_URL={API_URL} refreshProducts={refreshProducts}
            fetchOrders={async () => { 
                await fetchOrders(userProfile?.tg_id); 
                if(userProfile?.role === 'admin') await fetchAllOrders(); 
            }} 
          />
        )}
      </div>
    </Router>
  );
}
