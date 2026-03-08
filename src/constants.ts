export const IPHONE_SERIES = ['17', '16', '15', '14', '13', '12', '11'];

// Автоматическая генерация всех моделей iPhone
export const ALL_MODELS = (() => {
  const models = [];
  IPHONE_SERIES.forEach((num) => {
    const n = parseInt(num);
    models.push(`iPhone ${num}`, `iPhone ${num} Pro`, `iPhone ${num} Pro Max`);
    if (n >= 14) models.push(`iPhone ${num} Plus`);
    if (n === 12 || n === 13) models.push(`iPhone ${num} mini`);
  });
  return models;
})();

// Опции бейджиков для товаров в магазине
export const STATUS_OPTIONS = [
  { id: 'none', label: 'Standard', color: 'bg-zinc-800' },
  { id: 'hit', label: 'HOT', color: 'bg-orange-600' },
  { id: 'top', label: 'BEST', color: 'bg-blue-600' },
  { id: 'new', label: 'NEW', color: 'bg-green-600' },
  { id: 'sale', label: 'SALE', color: 'bg-red-600' },
];

// Расширенная цепочка статусов заказа
export const ORDER_STATUSES = [
  { 
    id: 'pending', 
    label: '⏳ Awaiting Payment', 
    color: 'text-zinc-500', 
    bg: 'bg-zinc-500/10' 
  },
  { 
    id: 'paid', 
    label: '✅ Paid', 
    color: 'text-green-500', 
    bg: 'bg-green-500/10' 
  },
  { 
    id: 'processing', 
    label: '📦 Awaiting Shipment', 
    color: 'text-orange-500', 
    bg: 'bg-orange-500/10' 
  },
  { 
    id: 'shipped', 
    label: '🚚 Shipped', 
    color: 'text-blue-500', 
    bg: 'bg-blue-500/10' 
  },
  { 
    id: 'delivered', 
    label: '🏠 Delivered', 
    color: 'text-green-600', 
    bg: 'bg-green-600/10' 
  },
  { 
    id: 'received', 
    label: '🤝 Received', 
    color: 'text-zinc-400', 
    bg: 'bg-zinc-400/10' 
  }
];