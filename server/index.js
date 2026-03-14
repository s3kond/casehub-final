const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

// --- НАСТРОЙКА CORS И СТАТИКИ ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Промежуточное ПО для логов (чтобы видеть запросы в Render)
app.use((req, res, next) => {
    console.log(`📡 [${req.method}] ${req.url}`);
    next();
});

app.use(express.json({
    verify: (req, res, buf) => {
        if (req.originalUrl.startsWith('/api/webhook')) req.rawBody = buf;
    }
}));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

// --- ИНИЦИАЛИЗАЦИЯ БОТА ---
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const adminId = process.env.ADMIN_CHAT_ID;

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `👋 **Welcome, ${msg.from.first_name}!**\n\nExplore CASEHUB — premium iPhone protection.`, {
        parse_mode: 'Markdown',
        reply_markup: { 
            inline_keyboard: [[{ text: "🛍 Open Store", web_app: { url: "https://casehub-final.vercel.app" } }]] 
        }
    });
});

const sendAdminNotification = async (order, isUpdate = false) => {
    if (!adminId) return;
    try {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const list = items.map(i => `• ${i.name || i.id} (x${i.quantity || i.q})`).join('\n');
        const msg = `${isUpdate ? '✅ PAID' : '🆕 NEW'} #${order.id}\n👤 ${order.customer_name}\n📍 ${order.address}\n📦 Items:\n${list}\n💰 $${order.total_price}`;
        bot.sendMessage(adminId, msg);
    } catch (e) { console.error("Admin Notif Error:", e.message); }
};

// --- БАЗА ДАННЫХ ---
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

// --- MULTER ДЛЯ ФОТО ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// --- ВЕБХУК STRIPE ---
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

// --- API ЭНДПОИНТЫ (ТОВАРЫ) ---
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price_usd, stock, images, categories, status, china_url } = req.body;
        const result = await pool.query(
            `INSERT INTO products (name, price_usd, stock, images, categories, status, china_url) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, 
            [name, price_usd, stock || 0, images || [], categories || [], status || 'none', china_url]
        );
        console.log("✅ Товар добавлен:", name);
        res.json(result.rows[0]);
    } catch (err) { 
        console.error("❌ Ошибка добавления:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        console.log("🗑️ Товар удален, ID:", id);
        res.json({ success: true });
    } catch (err) { 
        console.error("❌ Ошибка удаления:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// --- API ЭНДПОИНТЫ (ЮЗЕРЫ И ЗАКАЗЫ) ---
app.post('/api/auth', async (req, res) => {
    try {
        const { id, username, first_name, photo_url } = req.body.user;
        const result = await pool.query(
            `INSERT INTO users (tg_id, username, first_name, photo_url) VALUES ($1, $2, $3, $4) 
             ON CONFLICT (tg_id) DO UPDATE SET username = $2, first_name = $3, photo_url = $4 RETURNING *`, 
            [id, username, first_name, photo_url]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { customer_id, customer_name, username, phone, address, items, total_price } = req.body;
        const resOrd = await pool.query(
            `INSERT INTO orders (customer_id, customer_name, username, phone, address, items, total_price, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
            [customer_id, customer_name, username || 'hidden', phone, address, JSON.stringify(items), total_price]
        );
        sendAdminNotification(resOrd.rows[0], false);
        res.json(resOrd.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/:customer_id', async (req, res) => {
    const result = await pool.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.customer_id]);
    res.json(result.rows);
});

// --- СТРАЙП И ЗАГРУЗКА ---
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { items, customer_id, order_id } = req.body;
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
            cancel_url: `https://casehub-final.vercel.app/cart?status=cancel`,
            metadata: { order_id: String(order_id), customer_id: String(customer_id) },
        });
        res.json({ url: session.url });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/upload', upload.array('images', 10), (req, res) => {
    try {
        const urls = req.files.map(file => `/uploads/${file.filename}`);
        res.json({ urls });
    } catch (err) { res.status(500).json({ error: "Ошибка загрузки файла" }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 CASEHUB Engine Live on port ${PORT}`));
