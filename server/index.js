const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// 1. CORS - полная свобода для Vercel и локальных тестов
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));

// 2. ЛОГИ ЗАПРОСОВ (Для отладки в Render)
app.use((req, res, next) => {
    console.log(`📡 [${req.method}] ${req.url}`);
    next();
});

// 3. ПАПКА С ФОТО (Статика)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

// 4. ВЕБХУК STRIPE (Обязательно ПЕРЕД express.json)
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) { 
        console.error("❌ Webhook Error:", err.message);
        return res.status(400).send(`Error: ${err.message}`); 
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata.order_id;
        await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);
        console.log(`✅ Заказ #${orderId} оплачен! Статус обновлен.`);
    }
    res.json({ received: true });
});

app.use(express.json());

// 5. БАЗА ДАННЫХ И БОТ
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// --- ЭНДПОИНТЫ ТОВАРОВ ---
app.get('/api/products', async (req, res) => {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(result.rows);
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price_usd, stock, images, categories, status } = req.body;
        const result = await pool.query(
            'INSERT INTO products (name, price_usd, stock, images, categories, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, price_usd, stock, images, categories, status]
        );
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ЭНДПОИНТЫ ЗАКАЗОВ ---

// Для админки (ВСЕ заказы)
app.get('/api/admin/orders', async (req, res) => {
    try {
        console.log("👨‍💻 Запрос всех заказов для админ-панели");
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Для пользователя (только его заказы)
app.get('/api/orders/:customer_id', async (req, res) => {
    const result = await pool.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.customer_id]);
    res.json(result.rows);
});

app.post('/api/orders', async (req, res) => {
    const { customer_id, customer_name, phone, address, items, total_price } = req.body;
    const result = await pool.query(
        'INSERT INTO orders (customer_id, customer_name, phone, address, items, total_price, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [customer_id, customer_name, phone, address, JSON.stringify(items), total_price, 'pending']
    );
    res.json(result.rows[0]);
});

// --- СТРАЙП (ОПЛАТА) ---
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { items, order_id, customer_id } = req.body;
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.map(i => ({
                price_data: { 
                    currency: 'usd', 
                    product_data: { name: i.name || "iPhone Case" }, 
                    unit_amount: Math.round(parseFloat(i.price_usd || i.priceUsd) * 100) 
                },
                quantity: i.quantity || 1,
            })),
            mode: 'payment',
            success_url: `https://casehub-final.vercel.app/profile?status=success`,
            cancel_url: `https://casehub-final.vercel.app/profile?status=cancel`,
            metadata: { order_id: String(order_id), customer_id: String(customer_id) }
        });
        res.json({ url: session.url });
    } catch (e) { 
        console.error("❌ Stripe Error:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// --- АВТОРИЗАЦИЯ ---
app.post('/api/auth', async (req, res) => {
    const { id, username, first_name } = req.body.user;
    const result = await pool.query(
        'INSERT INTO users (tg_id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (tg_id) DO UPDATE SET username = $2 RETURNING *',
        [id, username, first_name]
    );
    res.json(result.rows[0]);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 CASEHUB Engine 100% Ready on port ${PORT}`));
