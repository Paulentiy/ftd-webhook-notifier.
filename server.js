const express = require('express');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const app = express();
app.use(bodyParser.json({ type: '*/*' }));

// Postback от партнёрки (или Keitaro-дублирование)
app.post('/ftd-hook', async (req, res) => {
  try {
    const data = req.body || {};
    const payout   = Number(data.payout || data.revenue || 0);
    const currency = data.currency || data.currency_code || 'USD';
    const status   = (data.status || '').toLowerCase();
    const campaign = data.campaign || data.campaign_name || '—';
    const offer    = data.offer || data.offer_name || '—';
    const geo      = data.country || data.geo || '—';
    const clickId  = data.clickid || data.click_id || '—';

    // считаем FTD только payout > 0
    if (payout > 0) {
      const msg =
        `🎉 Новый депозит (FTD)\n` +
        `Кампания: ${campaign}\n` +
        `Оффер: ${offer}\n` +
        `GEO: ${geo}\n` +
        `Сумма: ${payout} ${currency}\n` +
        `Статус: ${status}\n` +
        `ClickID: ${clickId}`;

      for (const chatId of ADMIN_CHAT_IDS) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ chat_id: chatId, text: msg })
        });
      }
    }

    res.status(200).send('OK');
  } catch (e) {
    console.error('Webhook error', e.message);
    res.status(500).send('ERR');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Webhook server running on port', port));
