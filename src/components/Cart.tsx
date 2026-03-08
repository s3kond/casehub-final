import React, { useState } from 'react';
import { ShoppingBag, X, Plus, Minus, Trash2, MapPin, Phone, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Cart = ({ cart, setCart, userProfile, onClose, getImageUrl, API_URL, refreshProducts, fetchOrders }: any) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  // Шаг оформления: 'form' (ввод данных) или 'selection' (выбор оплаты)
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'selection'>('form');

  // Расчет общей стоимости
  const totalPrice = cart.reduce((sum: number, item: any) => {
    const price = item.price_usd || item.priceUsd || 0;
    return sum + (Number(price) * item.quantity);
  }, 0);

  // Изменение количества с проверкой остатков
  const updateQuantity = (id: number, delta: number) => {
    setCart((prev: any[]) =>
      prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          if (delta > 0 && newQty > item.stock) {
            alert(`Sorry, only ${item.stock} in stock`);
            return item;
          }
          if (newQty > 0) {
            (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged();
            return { ...item, quantity: newQty };
          }
        }
        return item;
      })
    );
  };

  // Удаление товара
  const removeItem = (id: number) => {
    setCart((prev: any[]) => prev.filter(item => item.id !== id));
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
  };

  // Функция создания заказа (теперь всегда сначала создает запись в БД)
  const createOrder = async (isManual = false) => {
    if (!userProfile) return alert("Error: Open via Telegram");
    
    const orderData = {
      customer_id: userProfile.tg_id,
      customer_name: form.name,
      username: userProfile.username || 'no_username',
      phone: form.phone,
      address: form.address,
      items: cart,
      total_price: totalPrice,
    };

    try {
      // 1. ВСЕГДА сначала создаем заказ в базе (статус pending)
      const orderRes = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(orderData)
      });
      
      const createdOrder = await orderRes.json();

      if (!orderRes.ok) throw new Error("Failed to create order");

      (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');

      if (isManual) {
        // Если "Pay Later" — очищаем корзину и уходим в профиль
        setCart([]);
        if (fetchOrders) await fetchOrders(userProfile.tg_id); 
        onClose();
        navigate('/profile');
      } else {
        // 2. Если "Pay Now" — берем ID созданного заказа и идем в Stripe
        const stripeRes = await fetch(`${API_URL}/api/create-checkout-session`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ ...orderData, order_id: createdOrder.id })
        });
        
        const stripeData = await stripeRes.json();
        if (stripeData.url) {
          window.location.href = stripeData.url;
        } else {
          alert("Stripe session error");
        }
      }
    } catch (e) {
      console.error(e);
      alert("Order error. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-[#0a0a0a] flex flex-col animate-in slide-in-from-right duration-300">
      {/* HEADER */}
      <div className="flex justify-between items-center p-6 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <ShoppingBag className="text-blue-500" size={24} />
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">Your Bag</h2>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-zinc-500 active:scale-90 transition-transform">
          <X size={24} />
        </button>
      </div>

      {/* ITEMS LIST */}
      <div className="flex-grow overflow-y-auto p-6 space-y-4">
        {cart.length > 0 ? (
          <>
            {cart.map((item: any) => (
              <div key={item.id} className="bg-zinc-900/50 p-4 rounded-[2rem] flex items-center gap-4 border border-white/5 shadow-lg">
                <img 
                  src={getImageUrl(item.images?.[0])} 
                  className="w-20 h-20 rounded-2xl object-cover border border-white/10" 
                  alt={item.name}
                />
                <div className="flex-grow">
                  <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">{item.name}</p>
                  <p className="text-white font-black italic text-lg">${(item.price_usd || item.priceUsd)}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center bg-black/50 rounded-xl border border-white/5 p-1">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 text-zinc-400 hover:text-white"><Minus size={14}/></button>
                      <span className="px-3 text-xs font-black text-blue-500">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 text-zinc-400 hover:text-white"><Plus size={14}/></button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="p-2 text-red-500/50 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* DELIVERY FORM */}
            <div className="mt-8 space-y-3 bg-blue-600/5 p-6 rounded-[2.5rem] border border-blue-500/10">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Shipment Details</p>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16}/>
                <input 
                  placeholder="Full Name" 
                  className="w-full bg-black/50 border border-white/5 p-4 pl-12 rounded-2xl text-xs outline-none focus:border-blue-500 transition-colors text-white" 
                  onChange={e => setForm({...form, name: e.target.value})}
                  value={form.name}
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16}/>
                <input 
                  placeholder="Delivery Address" 
                  className="w-full bg-black/50 border border-white/5 p-4 pl-12 rounded-2xl text-xs outline-none focus:border-blue-500 transition-colors text-white"
                  onChange={e => setForm({...form, address: e.target.value})}
                  value={form.address}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16}/>
                <input 
                  placeholder="Phone Number" 
                  className="w-full bg-black/50 border border-white/5 p-4 pl-12 rounded-2xl text-xs outline-none focus:border-blue-500 transition-colors text-white"
                  onChange={e => setForm({...form, phone: e.target.value})}
                  value={form.phone}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
            <ShoppingBag size={64} className="text-white" />
            <p className="font-black uppercase tracking-widest text-[10px] text-white">Your bag is empty</p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      {cart.length > 0 && (
        <div className="p-8 bg-zinc-900 rounded-t-[3.5rem] border-t border-white/10 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-center mb-6 px-4">
            <span className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Total Amount</span>
            <span className="text-3xl font-black italic text-white leading-none">${totalPrice.toFixed(2)}</span>
          </div>

          {checkoutStep === 'form' ? (
            <button 
              onClick={() => form.name && form.address && form.phone ? setCheckoutStep('selection') : alert("Please fill in all details!")}
              className="w-full bg-blue-600 py-6 rounded-[2rem] font-black uppercase text-lg shadow-2xl shadow-blue-600/30 active:scale-[0.98] transition-all text-white"
            >
              Continue
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => createOrder(false)} 
                className="w-full bg-green-600 py-5 rounded-[1.5rem] font-black uppercase text-sm shadow-xl shadow-green-600/20 text-white"
              >
                💳 Pay Now (Card)
              </button>
              <button 
                onClick={() => createOrder(true)} 
                className="w-full bg-zinc-800 py-5 rounded-[1.5rem] font-black uppercase text-sm text-zinc-400"
              >
                ⏳ Pay Later
              </button>
              <button 
                onClick={() => setCheckoutStep('form')} 
                className="text-[10px] font-black uppercase text-zinc-600 mt-2 self-center"
              >
                ← Back to details
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};