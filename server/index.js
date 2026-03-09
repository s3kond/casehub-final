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

// --- 0. НАСТРОЙКА CORS (ИСПРАВЛЕНО ДЛЯ VERCEL) ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));

app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 1. ИНИЦИАЛИЗАЦИЯ БОТА ---
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const adminId = process.env.ADMIN_CHAT_ID;

bot.onText(/\/start/, (msg) => {
    const welcomeText = 
        `👋 **Welcome, ${msg.from.first_name}!**\n\n` +
        `You've just entered **CASEHUB** — premium iPhone protection.\n\n` +
        `🚀 Click the button below to start shopping!`;

    bot.sendMessage(msg.chat.id, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: "🛍 Open CASEHUB Store", web_app: { url: "https://casehub-final.vercel.app" } }
            ]]
        }
    });
});

// --- 2. НАСТРОЙКА ХРАНИЛИЩА (MULTER) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// --- 3. ФУНКЦИИ УВЕДОМЛЕНИЙ ---
const sendAdminNotification = async (order, isUpdate = false) => {
    if (!adminId) return;
    try {
        const itemsRaw = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const itemsList = itemsRaw.map(i => `• ${i.name || `ID: ${i.id}`} (x${i.quantity || i.q})`).join('\n');
        const title = isUpdate ? `✅ **ORDER PAID #${order.id}**` : `🆕 **NEW PENDING ORDER #${order.id}**`;

        const message = `${title}\n\n👤 **Customer:** ${order.customer_name}\n📞 **Phone:** ${order.phone}\n📍 **Address:** ${order.address}\n\n📦 **Items:**\n${itemsList}\n\n💰 **TOTAL: $${order.total_price}**`;
        await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
    } catch (e) { console.error("Admin Notif Error:", e.message); }
};

const sendUserNotification = async (order) => {
    if (!order.customer_id) return;
    try {
        const statusMap = { 'pending': '🛒 Order Created!', 'paid': '✅ Payment Successful!', 'shipped': '🚚 Shipped!' };
        const message = `🔔 **Order #${order.id}**\n\n${statusMap[order.status] || order.status}\n💰 **Total: $${order.total_price}**`;
        await bot.sendMessage(order.customer_id, message, { parse_mode: 'Markdown' }); 
    } catch (e) { console.error("User Notif Error:", e.message); }
};

// --- 4. БАЗА ДАННЫХ ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- 5. ВЕБХУК STRIPE ---
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const meta = session.metadata;
        try {
            const updateRes = await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1 RETURNING *", [meta.order_id]);
            if (updateRes.rows[0]) {
                sendAdminNotification(updateRes.rows[0], true);
                sendUserNotification(updateRes.rows[0]);
            }
        } catch (e) { console.error("Webhook process error:", e); }
    }
    res.json({ received: true });
});

// --- 6. API ЭНДПОИНТЫ ---
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth', async (req, res) => {
    const { id, username, first_name, photo_url } = req.body.user;
    const result = await pool.query(
        `INSERT INTO users (tg_id, username, first_name, photo_url) 
         VALUES ($1, $2, $3, $4) ON CONFLICT (tg_id) 
         DO UPDATE SET username = $2, first_name = $3, photo_url = $4 RETURNING *`, 
        [id, username, first_name, photo_url]
    );
    res.json(result.rows[0]);
});

app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { items, customer_id, customer_name, username, phone, address, order_id } = req.body;
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.map(item => ({
                price_data: { currency: 'usd', product_data: { name: item.name }, unit_amount: Math.round((item.price_usd || item.priceUsd) * 100) },
                quantity: item.quantity,
            })),
            mode: 'payment',
            success_url: `https://casehub-final.vercel.app/profile?status=success`,
            cancel_url: `https://casehub-final.vercel.app/cart?status=cancel`,
            metadata: { order_id: String(order_id), customer_id: String(customer_id), items: JSON.stringify(items.map(i => ({ id: i.id, q: i.quantity }))) },
        });
        res.json({ url: session.url });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { customer_id, customer_name, username, phone, address, items, total_price } = req.body;
        const orderRes = await pool.query(
            `INSERT INTO orders (customer_id, customer_name, username, phone, address, items, total_price, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [customer_id, customer_name, username || 'hidden', phone, address, JSON.stringify(items), total_price, 'pending']
        );
        sendAdminNotification(orderRes.rows[0], false);
        sendUserNotification(orderRes.rows[0]);
        res.json(orderRes.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/:customer_id', async (req, res) => {
    const result = await pool.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.customer_id]);
    res.json(result.rows);
});

app.get('/api/admin/orders', async (req, res) => {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
});

app.post('/api/upload', upload.array('images', 10), (req, res) => {
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ urls });
});

// --- ИНИЦИАЛИЗАЦИЯ ---
const initDB = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (tg_id BIGINT PRIMARY KEY, username TEXT, first_name TEXT, photo_url TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT, price_usd DECIMAL, stock INTEGER DEFAULT 0, images TEXT[] DEFAULT '{}', categories TEXT[] DEFAULT '{}', status TEXT DEFAULT 'none', china_url TEXT, created_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, customer_id BIGINT, customer_name TEXT, username TEXT, phone TEXT, address TEXT, items JSONB, total_price DECIMAL, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW());
    `);
    console.log("✅ CASEHUB Engine Ready");
};
initDB();

app.listen(process.env.PORT || 5000, () => console.log(`🚀 Server running`));
