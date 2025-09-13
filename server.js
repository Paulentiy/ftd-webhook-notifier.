const express = require('express');
const app = express();

app.use(express.json({ type: '*/*' }));
app.use(express.urlencoded({ extended: true }));

function pick(obj, keys, def = '') {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  return def;
}

async function notify(data) {
  console.log('[FTD-HOOK]', new Date().toISOString(), JSON.stringify(data));

  const payout   = Number(pick(data, ['payout','revenue','amount'], 0));
  if (!(payout > 0)) return;

  const currency = pick(data, ['currency','currency_code'], 'USD');
  const status   = String(pick(data, ['status','goal','state'], 'confirmed')).toLowerCase();
  const clickId  = pick(data, ['clickid','click_id','sub_id','subid','sub_id1'], '—');

  const text = [
    '🎉 Новый депозит (FTD)',
    `Сумма: ${payout} ${currency}`,
    `Статус: ${status}`,
    `ClickID: ${clickId}`
  ].join('\n');

  const token = process.env.TELEGRAM_TOKEN;
  const chatIds = (process.env.ADMIN_CHAT_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!token || chatIds.length === 0) return;

  const fetch = (await import('node-fetch')).default; // v3 ESM
  for (const chatId of chatIds) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
      });
    } catch (e) {
      console.error('TG send error:', e.message);
    }
  }
}

app.all('/ftd-hook', async (req, res) => {
  try {
    const data = Object.keys(req.body || {}).length ? req.body : req.query;
    await notify(data);
    res.status(200).send('OK');
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).send('ERR');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Webhook server running on port', PORT));
