import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Package, Clock, Heart, ChevronRight } from 'lucide-react';
import { ORDER_STATUSES } from '../constants';

export const ProfilePage = ({ userProfile, orders, wishlist, products, setSelectedProduct, getImageUrl, API_URL }: any) => {
  const navigate = useNavigate();

  // Фильтруем неоплаченные заказы для уведомлений
  const unpaidOrders = orders.filter((o: any) => o.status === 'pending');

  if (!userProfile) {
    return (
      <div className="p-20 text-center opacity-20 uppercase font-black tracking-[0.2em] animate-pulse">
        Open in Telegram
      </div>
    );
  }

  // ОБЪЕДИНЕННАЯ И ИСПРАВЛЕННАЯ ФУНКЦИЯ ОПЛАТЫ
  const handlePayNow = async (order: any) => {
    try {
      console.log("Оплачиваем существующий заказ:", order.id);
      
      const res = await fetch(`${API_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true' 
        },
        body: JSON.stringify({
          // Гарантируем корректный формат товаров (массив объектов)
          items: Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]'),
          customer_id: order.customer_id,
          customer_name: order.customer_name,
          username: order.username,
          phone: order.phone,
          address: order.address,
          order_id: order.id 
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Server Error");
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e: any) { 
      console.error("Payment error detail:", e);
      alert(`Payment error: ${e.message}`); 
    }
  };

  const favoriteProducts = products.filter((p: any) => wishlist.includes(p.id));

  const handleGoToProduct = (p: any) => {
    setSelectedProduct(p);
    navigate('/');
  };

  return (
    <div className="relative p-6 space-y-10 animate-in fade-in pb-48">
      
      {/* 1. ПРЕМИАЛЬНОЕ УВЕДОМЛЕНИЕ ВВЕРХУ (ГРАДИЕНТ) */}
      {unpaidOrders.length > 0 && (
        <div className="mx-2 mb-2">
          <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-[2rem] p-4 flex items-center gap-4 backdrop-blur-md">
            <div className="bg-red-600 shadow-lg shadow-red-600/40 p-3 rounded-2xl animate-pulse">
              <Clock size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black uppercase text-white tracking-tight">Waiting for Payment</h4>
              <p className="text-[9px] text-zinc-400 font-bold uppercase leading-tight mt-0.5">
                You have {unpaidOrders.length} order(s) that need your attention.
              </p>
            </div>
            <button 
              onClick={() => window.scrollTo({ top: 1000, behavior: 'smooth' })}
              className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-colors"
            >
              View
            </button>
          </div>
        </div>
      )}

      {/* 2. ПРЫГАЮЩЕЕ УВЕДОМЛЕНИЕ ВНИЗУ (ДЛЯ АКЦЕНТА) */}
      {unpaidOrders.length > 0 && (
        <div className="fixed bottom-24 left-6 right-6 z-50 animate-bounce">
          <div className="bg-red-600 p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/20">
             <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg"><Clock size={16} className="text-white"/></div>
                <p className="text-[10px] font-black uppercase text-white tracking-tighter">
                  Finish your order payment!
                </p>
             </div>
             <ChevronRight size={16} className="text-white"/>
          </div>
        </div>
      )}

      {/* USER HEADER */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-24 h-24 bg-zinc-900 rounded-[2.5rem] border-4 border-blue-600 overflow-hidden shadow-2xl flex items-center justify-center">
          {userProfile.photo_url ? (
            <img src={userProfile.photo_url} className="w-full h-full object-cover" alt="avatar" />
          ) : (
            <UserCircle size={48} className="text-zinc-700" />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">{userProfile.first_name}</h2>
          <p className="text-[10px] text-zinc-500 font-black tracking-widest">@{userProfile.username}</p>
        </div>
      </div>

      {/* WISHLIST SECTION */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2 px-2">
          <Heart size={12} className="text-red-500 fill-red-500" /> Wishlist ({favoriteProducts.length})
        </h3>
        {favoriteProducts.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar px-2">
            {favoriteProducts.map((p: any) => (
              <div key={p.id} onClick={() => handleGoToProduct(p)} className="min-w-[130px] max-w-[130px] group active:scale-95 transition-all cursor-pointer">
                <div className="relative aspect-square rounded-[2rem] bg-zinc-900 border border-white/5 overflow-hidden mb-2 shadow-xl">
                  <img src={getImageUrl(p.images?.[0])} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />
                  <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-xl text-[9px] font-black italic border border-white/10 text-blue-500">${p.price_usd}</div>
                </div>
                <p className="text-[9px] font-black uppercase truncate px-1 opacity-60 transition-opacity">{p.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900/20 border border-dashed border-white/5 rounded-[2.5rem] p-8 text-center mx-2">
            <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">No favorites yet</p>
          </div>
        )}
      </div>

      {/* ORDERS SECTION */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2 px-2">
          <Package size={12} /> My Orders ({orders.length})
        </h3>
        <div className="space-y-3 px-2">
          {orders.length > 0 ? (
            orders.map((order: any) => {
              const currentStatus = ORDER_STATUSES.find(s => s.id === order.status) || ORDER_STATUSES[0];
              return (
                <div key={order.id} className="bg-zinc-900/40 p-5 rounded-[2.5rem] border border-white/5 shadow-lg transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Order #{order.id}</p>
                      <p className="text-[9px] text-white font-black uppercase mt-1">Recipient: {order.customer_name}</p>
                      {order.created_at && (
                        <div className="flex items-center gap-1 text-zinc-600 text-[8px] font-bold uppercase mt-1">
                          <Clock size={10} /> {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter ${currentStatus.bg} ${currentStatus.color}`}>
                      {currentStatus.label}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="space-y-1 opacity-40 text-[8px] font-bold uppercase max-w-[60%]">
                      <p className="truncate">Address: {order.address}</p>
                    </div>
                    <p className="text-xl font-black italic text-white leading-none">${order.total_price}</p>
                  </div>

                  {order.status === 'pending' && (
                    <button 
                      onClick={() => handlePayNow(order)}
                      className="w-full mt-4 bg-blue-600 py-3 rounded-xl font-black uppercase text-[10px] text-white shadow-lg shadow-blue-600/20 active:scale-95 transition-transform"
                    >
                      💳 Pay Now with Card
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-zinc-900/20 border border-dashed border-white/5 rounded-[2.5rem] p-8 text-center">
              <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">History is empty</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};