import React, { useState, useRef } from 'react';
import { Trash2, Edit3, Plus, X, Upload, Phone, MapPin, User, Package, Clock, Smartphone, Box, ExternalLink, Check, Star, ChevronRight, ShoppingBag } from 'lucide-react';
import { ALL_MODELS, STATUS_OPTIONS, ORDER_STATUSES } from '../constants';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'bg-green-500 text-white';
    case 'top': return 'bg-orange-500 text-white';
    case 'sale': return 'bg-red-500 text-white';
    default: return 'bg-zinc-700 text-zinc-300';
  }
};

export const AdminPanel = ({ products, setProducts, orders, setOrders, getImageUrl, API_URL }: any) => {
  const [activeTab, setActiveTab] = useState('inventory');
  const [expandedOrder, setExpandedOrder] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({ 
    id: null as any, 
    name: '', 
    price: '', 
    stock: '10', 
    images: [] as string[], 
    chinaUrl: '', 
    categories: [] as string[], 
    status: 'none' 
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('images', f));
    
    try {
        const res = await fetch(`${API_URL}/api/upload`, { 
          method: 'POST', 
          headers: { 'ngrok-skip-browser-warning': 'true' },
          body: formData 
        });
        const data = await res.json();
        if (data.urls) setForm(prev => ({ ...prev, images: [...prev.images, ...data.urls] }));
    } catch (err) { alert("Upload error"); }
  };

  const handleSaveProduct = async () => {
    const productData = { 
      name: form.name, 
      price_usd: Number(form.price) || 0, 
      stock: Number(form.stock) || 0, 
      images: form.images, 
      categories: form.categories, 
      status: form.status, 
      china_url: form.chinaUrl || '' 
    };

    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `${API_URL}/api/products/${form.id}` : `${API_URL}/api/products`;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(productData)
        });

        if (res.ok) {
            const saved = await res.json();
            setProducts(form.id ? products.map((p: any) => p.id === form.id ? saved : p) : [saved, ...products]);
            setForm({ id: null, name: '', price: '', stock: '10', images: [], chinaUrl: '', categories: [], status: 'none' });
            alert("Success!");
        }
    } catch (err) { alert("Error saving product"); }
  };

  return (
    <div className="p-6 pb-40 space-y-8 text-white bg-black min-h-screen">
      {/* TABS */}
      <div className="flex bg-zinc-900 p-1.5 rounded-[2rem] border border-white/5 shadow-xl">
        <button onClick={() => setActiveTab('inventory')} className={`flex-grow py-4 rounded-[1.5rem] text-[9px] font-black uppercase transition-all ${activeTab === 'inventory' ? 'bg-blue-600 shadow-lg' : 'text-zinc-500'}`}>Inventory</button>
        <button onClick={() => setActiveTab('orders')} className={`flex-grow py-4 rounded-[1.5rem] text-[9px] font-black uppercase transition-all ${activeTab === 'orders' ? 'bg-blue-600 shadow-lg' : 'text-zinc-500'}`}>Orders ({orders.length})</button>
      </div>

      {activeTab === 'inventory' ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* PRODUCT FORM */}
          <div className="bg-zinc-900/40 p-8 rounded-[3rem] border border-white/10 space-y-4 shadow-2xl">
            <h3 className="text-blue-500 font-black uppercase italic">{form.id ? 'Edit' : 'New'} Product</h3>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Product Name" className="w-full bg-black/50 p-4 rounded-2xl border border-white/5 outline-none focus:border-blue-500/50 transition-colors" />
            <div className="grid grid-cols-2 gap-4">
              <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="Price $" className="bg-black/50 p-4 rounded-2xl border border-white/5 outline-none text-blue-400 font-bold" />
              <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="Stock" className="bg-black/50 p-4 rounded-2xl border border-white/5 outline-none text-zinc-300 font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <p className="text-[8px] font-black text-zinc-500 uppercase ml-2">Badge Status</p>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-black/50 p-4 rounded-2xl border border-white/5 outline-none text-[10px] font-black uppercase text-zinc-400">
                    {STATUS_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
               </div>
               <div className="space-y-1">
                  <p className="text-[8px] font-black text-zinc-500 uppercase ml-2">China Link</p>
                  <input value={form.chinaUrl} onChange={e => setForm({...form, chinaUrl: e.target.value})} placeholder="https://..." className="w-full bg-black/50 p-4 rounded-2xl border border-white/5 outline-none text-[10px] text-blue-300" />
               </div>
            </div>
            <div className="flex gap-2 overflow-x-auto py-2">
                <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 shrink-0 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center text-zinc-500 bg-black/20 hover:border-blue-500/50"><Upload size={20}/></button>
                <input type="file" ref={fileInputRef} hidden multiple onChange={handleFileUpload} />
                {form.images.map((img, i) => (
                    <div key={i} className="relative w-20 h-20 shrink-0 border border-white/5 rounded-2xl overflow-hidden shadow-lg">
                      <img src={getImageUrl(img)} className="w-full h-full object-cover" alt="" />
                      <button onClick={() => setForm({...form, images: form.images.filter((_, idx) => idx !== i)})} className="absolute top-1 right-1 bg-red-600 p-1.5 rounded-full"><X size={10}/></button>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-3 bg-black/30 rounded-2xl border border-white/5">
                {ALL_MODELS.map(m => (
                    <button key={m} onClick={() => setForm({...form, categories: form.categories.includes(m) ? form.categories.filter(c => c !== m) : [...form.categories, m]})} className={`p-2 rounded-xl text-[8px] font-black uppercase border transition-all ${form.categories.includes(m) ? 'border-blue-500 text-blue-500 bg-blue-500/10' : 'border-white/5 text-zinc-600'}`}>{m}</button>
                ))}
            </div>
            <button onClick={handleSaveProduct} className="w-full bg-blue-600 py-5 rounded-[2rem] font-black uppercase italic shadow-xl active:scale-[0.98] transition-all">
              {form.id ? 'Update Product' : 'Create Product'}
            </button>
            {form.id && <button onClick={() => setForm({id: null, name: '', price: '', stock: '10', images: [], chinaUrl: '', categories: [], status: 'none'})} className="w-full text-[10px] text-zinc-500 uppercase font-black">Cancel Editing</button>}
          </div>

          {/* INVENTORY LIST */}
          <div className="space-y-4">
            <h3 className="text-zinc-500 font-black uppercase text-[10px] ml-4 tracking-[0.2em]">Active Inventory</h3>
            {products.map((p: any) => (
              <div key={p.id} className="bg-zinc-900/30 p-5 rounded-[2.5rem] border border-white/5 flex items-center gap-4 group">
                <img src={getImageUrl(p.images?.[0])} className="w-16 h-16 rounded-[1.5rem] object-cover border border-white/5" alt="" />
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-[11px] font-black uppercase truncate">{p.name}</h4>
                    {p.status && p.status !== 'none' && <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase ${getStatusColor(p.status)}`}>{p.status}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-blue-500 font-black text-sm italic">${p.price_usd}</p>
                    <span className="text-[9px] font-black text-zinc-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">Stock: {p.stock}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setForm({ id: p.id, name: p.name, price: String(p.price_usd), stock: String(p.stock), images: p.images || [], chinaUrl: p.china_url || '', categories: p.categories || [], status: p.status || 'none' }); window.scrollTo({top: 0, behavior: 'smooth'})}} className="p-3 bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit3 size={16}/></button>
                  <button onClick={() => confirm('Delete?') && fetch(`${API_URL}/api/products/${p.id}`, {method:'DELETE', headers: {'ngrok-skip-browser-warning': 'true'}}).then(()=>setProducts(products.filter((x:any)=>x.id!==p.id)))} className="p-3 bg-red-600/10 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ORDERS TAB */
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
          {orders.map((o: any) => (
            <div key={o.id} className="bg-zinc-900/40 rounded-[2.5rem] border border-white/10 p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-500 font-black text-[10px]">#{o.id}</div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white">{o.customer_name}</p>
                      <p className="text-[8px] text-zinc-500 font-bold">{new Date(o.created_at).toLocaleDateString()}</p>
                   </div>
                </div>
                <p className="text-white font-black italic text-xl">${o.total_price}</p>
              </div>

              <div className="grid gap-2 text-[10px] font-bold uppercase">
                <div className="flex items-center gap-2 text-white">
                  <User size={12} className="text-blue-500" /> 
                  <span>{o.customer_name}</span>
                  {o.username && o.username !== 'hidden' ? (
                    <a href={`https://t.me/${o.username}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 lowercase font-medium hover:underline transition-all">
                      (tg: @{o.username})
                    </a>
                  ) : <span className="text-zinc-600 lowercase font-medium">(tg: @hidden)</span>}
                </div>
                <div className="flex items-center gap-2 text-zinc-300">
                  <Phone size={12} className="text-blue-500" /> {o.phone}
                </div>
                <div className="flex items-start gap-2 text-zinc-500 bg-black/20 p-3 rounded-xl">
                  <MapPin size={12} className="shrink-0 text-blue-500" /> {o.address}
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setExpandedOrder(o)}
                  className="flex-grow bg-white/5 hover:bg-blue-600 transition-all p-4 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border border-white/5"
                >
                  <ShoppingBag size={14} /> View Items ({Array.isArray(o.items) ? o.items.length : JSON.parse(o.items || '[]').length})
                </button>
                <select 
                  value={o.status} 
                  onChange={e => {
                    fetch(`${API_URL}/api/orders/${o.id}`, { 
                      method: 'PATCH', 
                      headers: {'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'}, 
                      body: JSON.stringify({status: e.target.value}) 
                    });
                    setOrders(orders.map((ord: any) => ord.id === o.id ? {...ord, status: e.target.value} : ord));
                  }} 
                  className="bg-zinc-800 p-4 rounded-xl text-[9px] font-black uppercase border border-white/5 text-white outline-none"
                >
                  {ORDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: ORDER DETAILS */}
      {expandedOrder && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-zinc-900 rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-white/5 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase italic leading-none">Order <span className="text-blue-500">#{expandedOrder.id}</span></h2>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{expandedOrder.customer_name}</p>
                </div>
              </div>
              <button onClick={() => setExpandedOrder(null)} className="p-3 bg-white/5 rounded-full hover:bg-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Ordered Items:</p>
              {(Array.isArray(expandedOrder.items) ? expandedOrder.items : JSON.parse(expandedOrder.items || '[]')).map((item: any, idx: number) => {
                // ПЫТАЕМСЯ НАЙТИ ТОВАР В ИНВЕНТАРЕ ПО ID ДЛЯ ОТОБРАЖЕНИЯ АКТУАЛЬНЫХ ДАННЫХ
                const fullProduct = products.find((p: any) => p.id === item.id);
                
                return (
                  <div key={idx} className="bg-black/40 p-4 rounded-[2rem] border border-white/5 flex items-center gap-4 group">
                    <img 
                      src={getImageUrl(fullProduct?.images?.[0] || item.images?.[0] || item.image)} 
                      className="w-16 h-16 rounded-2xl object-cover border border-white/10" 
                      alt="" 
                    />
                    <div className="flex-grow min-w-0">
                      <p className="text-[11px] font-black uppercase truncate">
                        {fullProduct?.name || item.name || `Product ID: ${item.id}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-blue-500 font-black text-xs">x{item.quantity || item.q}</span>
                        <span className="text-[10px] text-zinc-500 font-bold italic">${fullProduct?.price_usd || item.price_usd || item.priceUsd}</span>
                      </div>
                    </div>
                    {(fullProduct?.china_url || item.china_url) && (
                      <a 
                        href={fullProduct?.china_url || item.china_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-4 bg-orange-500/10 text-orange-500 rounded-2xl hover:bg-orange-500 hover:text-white transition-all flex flex-col items-center gap-1"
                      >
                        <ExternalLink size={16} />
                        <span className="text-[7px] font-black uppercase">China</span>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-8 bg-black/40 border-t border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Customer Total</span>
                  <span className="text-2xl font-black italic text-blue-500">${expandedOrder.total_price}</span>
                </div>
                <button onClick={() => setExpandedOrder(null)} className="w-full py-5 bg-zinc-800 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-700 transition-all mt-4">Close Details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};