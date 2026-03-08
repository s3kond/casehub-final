import React, { useState } from 'react';
import { ChevronDown, Heart, AlertCircle } from 'lucide-react';
import { ALL_MODELS, STATUS_OPTIONS } from '../constants';

export const HomePage = ({
  products = [],
  activeCategory,
  setActiveCategory,
  setSelectedProduct,
  wishlist = [],
  toggleWishlist,
  getImageUrl
}: any) => {
  // Используем локальное состояние для открытия фильтра (это надежнее)
  const [isOpen, setIsOpen] = useState(false);

  // Фильтрация: убираем товары без остатка и фильтруем по категории (поддержка массива категорий)
  const filteredProducts = products?.filter((p: any) => {
    const hasStock = Number(p.stock) > 0;
    const matchesCategory = activeCategory === 'All' || 
      (Array.isArray(p.categories) && p.categories.includes(activeCategory)) ||
      (p.categories === activeCategory);
    
    return hasStock && matchesCategory;
  }) || [];

  const handleCategorySelect = (cat: string) => {
    setActiveCategory(cat);
    setIsOpen(false);
    // Добавляем тактильную отдачу для Telegram
    (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged();
  };

  return (
    <div className="p-4 animate-in fade-in duration-500">
      {/* SELECTOR (ФИЛЬТР МОДЕЛЕЙ) */}
      <div className="relative mb-6">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-zinc-900/50 backdrop-blur-xl p-5 rounded-[2rem] border border-white/10 flex justify-between items-center shadow-2xl active:scale-[0.98] transition-all"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Device: <span className="text-blue-500 ml-2">{activeCategory}</span>
          </span>
          <ChevronDown 
            size={18} 
            className={`transition-transform duration-500 text-blue-500 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {/* DROP-DOWN MENU */}
        {isOpen && (
          <>
            {/* Подложка, чтобы закрыть фильтр кликом в любое место вне меню */}
            <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
            
            <div className="absolute top-[115%] left-0 w-full bg-zinc-900/95 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl z-[100] max-h-72 overflow-y-auto p-3 animate-in zoom-in-95 duration-200">
              <button
                onClick={() => handleCategorySelect('All')}
                className={`w-full p-4 text-left text-[10px] font-black uppercase rounded-2xl mb-1 transition-all ${
                  activeCategory === 'All' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'hover:bg-white/5 text-zinc-400'
                }`}
              >
                All Models
              </button>
              {ALL_MODELS.map((cat: string) => (
                <button
                  key={cat}
                  onClick={() => handleCategorySelect(cat)}
                  className={`w-full p-4 text-left text-[10px] font-black uppercase rounded-2xl transition-all mb-1 ${
                    activeCategory === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* PRODUCT GRID (СЕТКА ТОВАРОВ) */}
      <main className="grid grid-cols-2 gap-4">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p: any) => (
            <div key={p.id} className="group relative active:scale-95 transition-all duration-300">
              <div
                onClick={() => setSelectedProduct(p)}
                className="relative aspect-[4/5] rounded-[2.5rem] bg-zinc-900 overflow-hidden border border-white/5 shadow-xl"
              >
                {/* ИЗОБРАЖЕНИЕ ТОВАРА */}
                <img
                  src={p.images?.[0] ? getImageUrl(p.images[0]) : 'https://via.placeholder.com/300x400?text=No+Image'}
                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                  alt={p.name}
                />
                
                {/* BADGES (NEW, TOP, SALE) */}
                <div className="absolute top-4 left-4">
                  {p.status && p.status !== 'none' && (
                    <div
                      className={`${
                        STATUS_OPTIONS.find((s) => s.id === p.status)?.color || 'bg-blue-600'
                      } px-3 py-1.5 rounded-full text-[8px] font-black uppercase text-white shadow-xl backdrop-blur-md`}
                    >
                      {p.status}
                    </div>
                  )}
                </div>

                {/* PRICE TAG (ЦЕННИК) */}
                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-[11px] font-black italic text-white shadow-lg">
                  ${p.price_usd || p.priceUsd || 0}
                </div>
              </div>

              {/* WISHLIST BUTTON */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWishlist(p.id);
                }}
                className={`absolute top-4 right-4 p-2.5 rounded-full backdrop-blur-md border border-white/10 transition-all ${
                  wishlist.includes(p.id)
                    ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/40'
                    : 'bg-black/20 text-white/60 hover:text-white'
                }`}
              >
                <Heart
                  size={14}
                  fill={wishlist.includes(p.id) ? 'currentColor' : 'none'}
                />
              </button>

              {/* TITLE */}
              <div className="mt-3 px-2">
                <p className="text-[9px] font-black text-zinc-500 uppercase truncate tracking-tighter opacity-80 group-hover:opacity-100 transition-opacity">
                  {p.name}
                </p>
              </div>
            </div>
          ))
        ) : (
          /* EMPTY STATE (ПУСТОЙ СКЛАД) */
          <div className="col-span-2 flex flex-col items-center justify-center py-32 text-zinc-600">
            <AlertCircle size={40} className="mb-4 opacity-10" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 text-center leading-relaxed">
              Warehouse is empty<br/>for this model
            </p>
          </div>
        )}
      </main>
    </div>
  );
};