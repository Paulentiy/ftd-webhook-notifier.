// server.js — FTD webhook → Telegram push (Render)

const express = require('express');
const app = express();

// --- parsers (JSON + x-www-form-urlencoded) ---
app.use(express.json({ type: '*/*' }));
app.use(express.urlencoded({ extended: true }));

// --- tiny helper ---
function pick(obj, keys, def = '') {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return def;
}

// --- send message to Telegram ---
async function sendToTelegram(text) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatIds = (process.env.ADMIN_CHAT_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!token || !chatIds.length) {
    console.error('Missing TELEGRAM_TOKEN or ADMIN_CHAT_IDS');
    return;
  }

  // node-fetch v3 is ESM — import dynamically
  const fetch = (await import('node-fetch')).default;

  await Promise.all(
    chatIds.map(chat_id =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // remove_keyboard: true => гарантированно спрячем старые клавиатуры у клиентов
        body: JSON.stringify({ chat_id, text, reply_markup: { remove_keyboard: true } })
      }).catch(e => console.error('TG send error:', e.message))
    )
  );
}

// --- core formatter & notifier ---
async function notifyFTD(data) {
  console.log('[FTD-HOOK]', new Date().toISOString(), JSON.stringify(data));

  const payout   = Number(pick(data, ['payout', 'revenue', 'amount'], 0));
  if (!(payout > 0)) return; // шлём только депозиты/выплаты

  const currency = pick(data, ['currency', 'currency_code'], 'USD');
  const status   = String(pick(data, ['status', 'goal', 'state'], 'confirmed')).toLowerCase();
  const clickId  = pick(data, ['clickid', 'click_id', 'sub_id', 'subid', 'sub_id1'], '—');

  // Менеджер из Keitaro (sub5)
  const manager  = pick(data, ['sub5', 'sub_5', 'sub_id_5'], '');

  // опциональные поля — если придут, покажем
  const offer    = pick(data, ['offer', 'offer_name'], '');
  const geo      = pick(data, ['country', 'geo', 'country_code'], '');
  const campaign = pick(data, ['campaign', 'campaign_name'], '');

  const lines = [
    '🎉 Новый депозит (FTD)',
    campaign && `Кампания: ${campaign}`,
    offer && `Оффер: ${offer}`,
    geo && `GEO: ${geo}`,
    manager && `Менеджер: ${manager}`,
    `Сумма: ${payout} ${currency}`,
    status && `Статус: ${status}`,
    `ClickID: ${clickId}`
  ].filter(Boolean);

  await sendToTelegram(lines.join('\n'));
}

// --- universal webhook (GET/POST, JSON/FORM/Query) ---
app.all('/ftd-hook', async (req, res) => {
  try {
    const data = Object.keys(req.body || {}).length ? req.body : req.query;
    await notifyFTD(data);
    res.status(200).send('OK');
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).send('ERR');
  }
});

// --- simple healthcheck ---
app.get('/health', (_, res) => res.send('ok'));

// --- start server ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Webhook server running on port', PORT));
