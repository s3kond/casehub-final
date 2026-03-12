const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhook')) req.rawBody = buf;
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const adminId = process.env.ADMIN_CHAT_ID;

// Бот и уведомления
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `👋 **Welcome, ${msg.from.first_name}!**\n\nExplore CASEHUB — premium iPhone protection.`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: "🛍 Open Store", web_app: { url: "https://casehub-final.vercel.app" } }]] }
    });
});

const sendAdminNotification = async (order, isUpdate = false) => {
    if (!adminId) return;
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const list = items.map(i => `• ${i.name} (x${i.quantity || i.q})`).join('\n');
    const msg = `${isUpdate ? '✅ PAID' : '🆕 NEW'} #${order.id}\n👤 ${order.customer_name}\n📍 ${order.address}\n📦 Items:\n${list}\n💰 $${order.total_price}`;
    bot.sendMessage(adminId, msg);
};

// База данных
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Вебхук Stripe
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) { return res.status(400).send(`Error: ${err.message}`); }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const resUpd = await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1 RETURNING *", [session.metadata.order_id]);
        if (resUpd.rows[0]) sendAdminNotification(resUpd.rows[0], true);
    }
    res.json({ received: true });
});

// API Эндпоинты
app.get('/api/products', async (req, res) => {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(result.rows);
});

app.post('/api/auth', async (req, res) => {
    const { id, username, first_name, photo_url } = req.body.user;
    const result = await pool.query(
        `INSERT INTO users (tg_id, username, first_name, photo_url) VALUES ($1, $2, $3, $4) 
         ON CONFLICT (tg_id) DO UPDATE SET username = $2, first_name = $3, photo_url = $4 RETURNING *`, 
        [id, username, first_name, photo_url]
    );
    res.json(result.rows[0]);
});

app.post('/api/create-checkout-session', async (req, res) => {
    const { items, customer_id, order_id } = req.body;
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map(i => ({
            price_data: { currency: 'usd', product_data: { name: i.name }, unit_amount: Math.round((i.price_usd || i.priceUsd) * 100) },
            quantity: i.quantity,
        })),
        mode: 'payment',
        success_url: `https://casehub-final.vercel.app/profile?status=success`,
        cancel_url: `https://casehub-final.vercel.app/cart?status=cancel`,
        metadata: { order_id: String(order_id), customer_id: String(customer_id) },
    });
    res.json({ url: session.url });
});

app.post('/api/orders', async (req, res) => {
    const { customer_id, customer_name, username, phone, address, items, total_price } = req.body;
    const resOrd = await pool.query(
        `INSERT INTO orders (customer_id, customer_name, username, phone, address, items, total_price, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
        [customer_id, customer_name, username, phone, address, JSON.stringify(items), total_price]
    );
    sendAdminNotification(resOrd.rows[0], false);
    res.json(resOrd.rows[0]);
});

app.get('/api/orders/:customer_id', async (req, res) => {
    const result = await pool.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.customer_id]);
    res.json(result.rows);
});

app.listen(process.env.PORT || 5000, () => console.log(`🚀 Live`));
