import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// helper pick
function pick(obj, keys, def = '') {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  return def;
}

async function notifyFTD(data) {
  console.log('[FTD-HOOK]', new Date().toISOString(), JSON.stringify(data));

  const payout   = Number(pick(data, ['payout','revenue','amount'], 0));
  if (!(payout > 0)) return; // только депозиты

  const currency = pick(data, ['currency','currency_code'], 'USD');
  const status   = String(pick(data, ['status','goal','state'], 'confirmed')).toLowerCase();
  const clickId  = pick(data, ['clickid','click_id','sub_id','subid','sub_id1'], '—');
  const offer    = pick(data, ['offer','offer_name'], '');
  const geo      = pick(data, ['country','geo','country_code'], '');
  const campaign = pick(data, ['campaign','campaign_name'], '');

  const lines = [
    '🎉 Новый депозит (FTD)',
    campaign && `Кампания: ${campaign}`,
    offer && `Оффер: ${offer}`,
    geo && `GEO: ${geo}`,
    `Сумма: ${payout} ${currency}`,
    status && `Статус: ${status}`,
    `ClickID: ${clickId}`
  ].filter(Boolean);

  const text = lines.join('\n');

  const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const chatId of ADMIN_CHAT_IDS) {
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, reply_markup: { remove_keyboard: true } })
      });
    } catch (e) {
      console.error('TG send error:', e.message);
    }
  }
}

// endpoint для Keitaro постбеков
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

// healthcheck
app.get('/health', (_, res) => res.send('ok'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Webhook server running on port', PORT));
