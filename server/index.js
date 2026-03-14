const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// 1. CORS - максимально разрешаем всё для Vercel
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));

// Логи запросов
app.use((req, res, next) => {
    console.log(`📡 [${req.method}] ${req.url}`);
    next();
});

// Вебхук Stripe должен быть ПЕРЕД express.json()
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) { return res.status(400).send(`Error: ${err.message}`); }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [session.metadata.order_id]);
        console.log(`✅ Заказ #${session.metadata.order_id} помечен как оплаченный`);
    }
    res.json({ received: true });
});

app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Эндпоинты
app.get('/api/products', async (req, res) => {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(result.rows);
});

// СОЗДАНИЕ СЕССИИ (Фикс для профиля и корзины)
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
        console.error("Stripe Error:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/orders', async (req, res) => {
    const { customer_id, customer_name, phone, address, items, total_price } = req.body;
    const result = await pool.query(
        'INSERT INTO orders (customer_id, customer_name, phone, address, items, total_price, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [customer_id, customer_name, phone, address, JSON.stringify(items), total_price, 'pending']
    );
    res.json(result.rows[0]);
});

app.get('/api/orders/:customer_id', async (req, res) => {
    const result = await pool.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.customer_id]);
    res.json(result.rows);
});

app.post('/api/auth', async (req, res) => {
    const { id, username, first_name } = req.body.user;
    const result = await pool.query(
        'INSERT INTO users (tg_id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (tg_id) DO UPDATE SET username = $2 RETURNING *',
        [id, username, first_name]
    );
    res.json(result.rows[0]);
});

app.listen(process.env.PORT || 5000, () => console.log('🚀 Server 100% Ready'));
