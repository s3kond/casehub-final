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

// --- 0. ИНИЦИАЛИЗАЦИЯ БОТА ---
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const adminId = process.env.ADMIN_CHAT_ID;

// Приветствие при /start
bot.onText(/\/start/, (msg) => {
    const welcomeText = 
        `👋 **Welcome, ${msg.from.first_name}!**\n\n` +
        `You've just entered **CASEHUB** — the ultimate destination for premium iPhone protection and style.\n\n` +
        `🚀 Click the button below to explore our collection and start shopping!`;

    bot.sendMessage(msg.chat.id, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: "🛍 Open CASEHUB Store", web_app: { url: process.env.CLIENT_URL } }
            ]]
        }
    });
});

// --- 1. НАСТРОЙКА ХРАНИЛИЩА (MULTER) ---
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

// --- 2. ФУНКЦИИ УВЕДОМЛЕНИЙ ---

// Уведомление админа
const sendAdminNotification = async (order, isUpdate = false) => {
    if (!adminId) return;
    try {
        const itemsRaw = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        // Учитываем сокращенный ключ 'q' из оптимизации Stripe
        const itemsList = itemsRaw.map(i => `• ${i.name || `Product ID: ${i.id}`} (x${i.quantity || i.q})`).join('\n');
        
        // Очистка данных от спецсимволов для безопасности Markdown
        const safeName = String(order.customer_name || 'Customer').replace(/[_*[`]/g, '');
        const safeUsername = String(order.username || 'hidden').replace(/[_*[`]/g, '');
        const safeAddress = String(order.address || 'No address').replace(/[_*[`]/g, '');

        const title = isUpdate ? `✅ **ORDER PAID #${order.id}**` : `🆕 **NEW PENDING ORDER #${order.id}**`;

        const message = 
            `${title}\n\n` +
            `👤 **Customer:** ${safeName} (@${safeUsername})\n` +
            `📞 **Phone:** \`${order.phone}\`\n` +
            `📍 **Address:** ${safeAddress}\n\n` +
            `📦 **Items:** \n${itemsList}\n\n` +
            `💰 **TOTAL: $${order.total_price}**`;

        // Отправляем сообщение с удобной кнопкой для чата
        await bot.sendMessage(adminId, message, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { 
                        text: "💬 Chat with Customer", 
                        url: `tg://user?id=${order.customer_id}` 
                    }
                ]]
            }
        });

        console.log(`✅ Admin notified about order #${order.id}`);
    } catch (e) { 
        console.error("Admin Notification Error:", e.message); 
    }
};

// Улучшенное уведомление пользователя с полным составом заказа
const sendUserNotification = async (order) => {
    if (!order.customer_id) return;
    try {
        const itemsRaw = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const itemsList = itemsRaw.map(i => `• ${i.name || `Product ID: ${i.id}`} (x${i.quantity || i.q})`).join('\n');

        let keyboard = null;
        if (order.status === 'pending') {
            keyboard = { 
                inline_keyboard: [[{ text: "💳 Go to Payment", web_app: { url: `${process.env.CLIENT_URL}/profile` } }]] 
            };
        }

        const statusMap = {
            'pending': '🛒 **Order Created!**',
            'paid': '✅ **Payment Successful!**',
            'processing': '⚙️ **Packing Your Order...**',
            'shipped': '🚚 **Shipped & On Its Way!**',
            'delivered': '🏠 **Delivered!**'
        };

        const statusTitle = statusMap[order.status] || `Status: ${order.status.toUpperCase()}`;

        const message = 
            `🔔 **Order #${order.id} Update**\n\n` +
            `${statusTitle}\n\n` +
            `📦 **Order Content:**\n${itemsList}\n\n` +
            `💰 **Total: $${order.total_price}**\n\n` +
            `Thank you for choosing CASEHUB!`;
        
        await bot.sendMessage(order.customer_id, message, { 
            parse_mode: 'Markdown', 
            reply_markup: keyboard 
        }); 
    } catch (e) { console.error("User Notification Error:", e.message); }
};

// --- 3. БАЗА ДАННЫХ ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- 4. ВЕБХУК STRIPE ---
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const meta = session.metadata;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            
            // 1. Меняем статус на PAID
            const updateRes = await client.query(
                "UPDATE orders SET status = 'paid' WHERE id = $1 RETURNING *", 
                [meta.order_id]
            );
            const finalOrder = updateRes.rows[0];

            if (finalOrder) {
                // 2. Списываем остатки товара
                const items = JSON.parse(meta.items);
                for (const item of items) {
                    await client.query(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [item.q || item.quantity, item.id]);
                }

                await client.query('COMMIT');
                
                // 3. Уведомляем админа и юзера
                sendAdminNotification(finalOrder, true);
                sendUserNotification(finalOrder);

                // 4. Авто-перевод в статус "Ожидание отправки" (processing) через 5 минут
                setTimeout(async () => {
                    const resProc = await pool.query(
                        "UPDATE orders SET status = 'processing' WHERE id = $1 AND status = 'paid' RETURNING *", 
                        [finalOrder.id]
                    );
                    if (resProc.rows[0]) sendUserNotification(resProc.rows[0]);
                }, 5 * 60 * 1000);
            } else {
                await client.query('ROLLBACK');
            }
        } catch (e) { 
            await client.query('ROLLBACK'); 
            console.error("Webhook completed error:", e);
        } finally { client.release(); }
    }
    res.json({ received: true });
});

// --- 5. API ЭНДПОИНТЫ ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Получение ВСЕХ заказов для админ-панели
app.get('/api/admin/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upload', upload.array('images', 10), (req, res) => {
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ urls });
});

app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { items, customer_id, customer_name, username, phone, address, order_id } = req.body;
        let baseUrl = (process.env.CLIENT_URL || '').replace(/\/$/, "");
        if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.map(item => ({
                price_data: { 
                    currency: 'usd', 
                    product_data: { name: item.name }, 
                    unit_amount: Math.round((item.price_usd || item.priceUsd) * 100) 
                },
                quantity: item.quantity,
            })),
            mode: 'payment',
            success_url: `${baseUrl}/profile?status=success`,
            cancel_url: `${baseUrl}/cart?status=cancel`,
            metadata: {
                order_id: String(order_id),
                customer_id: String(customer_id),
                customer_name, 
                username: username || 'hidden', 
                phone, 
                address,
                // ОПТИМИЗАЦИЯ СИМВОЛОВ (ID и Q)
                items: JSON.stringify(items.map(i => ({ id: i.id, q: i.quantity }))) 
            },
        });
        res.json({ url: session.url });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', async (req, res) => {
    const client = await pool.connect();
    try {
        const { customer_id, customer_name, username, phone, address, items, total_price } = req.body;
        await client.query('BEGIN');
        const orderRes = await client.query(
            `INSERT INTO orders (customer_id, customer_name, username, phone, address, items, total_price, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [customer_id, customer_name, username || 'hidden', phone, address, JSON.stringify(items), total_price, 'pending']
        );
        await client.query('COMMIT');
        
        sendAdminNotification(orderRes.rows[0], false);
        sendUserNotification(orderRes.rows[0]);
        
        res.json(orderRes.rows[0]);
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/auth', async (req, res) => {
    const { id, username, first_name, photo_url } = req.body.user;
    const result = await pool.query(`INSERT INTO users (tg_id, username, first_name, photo_url) VALUES ($1, $2, $3, $4) ON CONFLICT (tg_id) DO UPDATE SET username = $2, first_name = $3, photo_url = $4 RETURNING *`, [id, username, first_name, photo_url]);
    res.json(result.rows[0]);
});

app.get('/api/products', async (req, res) => {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(result.rows);
});

app.post('/api/products', async (req, res) => {
    const { name, price_usd, stock, images, categories, status, china_url } = req.body;
    const result = await pool.query(`INSERT INTO products (name, price_usd, stock, images, categories, status, china_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [name, price_usd, stock, Array.isArray(images) ? images : [], Array.isArray(categories) ? categories : [], status, china_url]);
    res.json(result.rows[0]);
});

app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price_usd, stock, images, categories, status, china_url } = req.body;
    const result = await pool.query(`UPDATE products SET name=$1, price_usd=$2, stock=$3, images=$4, categories=$5, status=$6, china_url=$7 WHERE id=$8 RETURNING *`, [name, price_usd, stock, images, categories, status, china_url, id]);
    res.json(result.rows[0]);
});

app.get('/api/orders/:customer_id', async (req, res) => {
    const result = await pool.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.customer_id]);
    res.json(result.rows);
});

app.patch('/api/orders/:id', async (req, res) => {
    const result = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [req.body.status, req.params.id]);
    if (result.rows[0]) sendUserNotification(result.rows[0]);
    res.json(result.rows[0]);
});

const initDB = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (tg_id BIGINT PRIMARY KEY, username TEXT, first_name TEXT, photo_url TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT, price_usd DECIMAL, stock INTEGER DEFAULT 0, images TEXT[] DEFAULT '{}', categories TEXT[] DEFAULT '{}', status TEXT DEFAULT 'none', china_url TEXT, created_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, customer_id BIGINT, customer_name TEXT, username TEXT, phone TEXT, address TEXT, items JSONB, total_price DECIMAL, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW());
    `);
    console.log("✅ CASEHUB Engine & Bot Ready");
};
initDB();

app.listen(5000, () => console.log(`🚀 Server running on port 5000`));