// server.js
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- ESTADO EM MEMÓRIA (zera quando o servidor reinicia) ----
const stats = {
  quiz: {
    starts: 0,
    completions: 0,
    steps: {},          // ex: { "1": 10, "2": 8, ... }
    answers: {},        // ex: { motivo: {economia:5, trabalho:3}, ... }
  },
  sellers: {
    // ex: "Gabryel": { clicks: 5 }, ...
  },

  // ✅ NOVO: fluxo financiamento (PAN)
  finance: {
    intents: { // intenção final do usuário
      financiamento: 0,
      avista_cartao: 0
    },
    moto_selects: { // ex: {"JET 50S": 10}
    },
    pan_clicks: {   // ex: {"JET 50S": 7}
    },
    leads_pan: 0,       // total de leads PAN (clique no link de simulação)
    leads_seller: 0     // total de leads vendedor (clique no WhatsApp)
  }
};

function inc(obj, key, by = 1) {
  if (!key) return;
  if (!obj[key]) obj[key] = 0;
  obj[key] += by;
}

// ---- MIDDLEWARES ----
app.use(bodyParser.json());

// serve arquivos estáticos (index.html, dashboard.html, imagens, etc.)
app.use(express.static(path.join(__dirname)));

// ---- API DE TRACKING ----
app.post('/api/track', (req, res) => {
  const { type, step, questionKey, optionValue, sellerName, moto, value } = req.body || {};

  try {
    switch (type) {
      case 'quiz_start':
        stats.quiz.starts += 1;
        break;

      case 'step_view':
        inc(stats.quiz.steps, String(step || '0'));
        break;

      case 'answer':
        if (questionKey && optionValue) {
          if (!stats.quiz.answers[questionKey]) {
            stats.quiz.answers[questionKey] = {};
          }
          inc(stats.quiz.answers[questionKey], optionValue);
        }
        break;

      case 'quiz_complete':
        stats.quiz.completions += 1;
        break;

      // ✅ clique no vendedor (WhatsApp) — conta como lead vendedor
      case 'seller_click':
        if (sellerName) {
          if (!stats.sellers[sellerName]) {
            stats.sellers[sellerName] = { clicks: 0 };
          }
          stats.sellers[sellerName].clicks += 1;

          // separa leads
          stats.finance.leads_seller += 1;
        }
        break;

      // ✅ intenção final: financiamento vs avista/cartão
      case 'finance_intent':
        // no seu front você manda: { type:'finance_intent', value:'financiamento' | 'avista_cartao' }
        if (value === 'financiamento') stats.finance.intents.financiamento += 1;
        if (value === 'avista_cartao') stats.finance.intents.avista_cartao += 1;
        break;

      // ✅ moto escolhida no financiamento
      case 'finance_moto_select':
        // no seu front você manda: { type:'finance_moto_select', moto:'JET 50S' }
        if (moto) inc(stats.finance.moto_selects, moto);
        break;

      // ✅ clique para abrir simulação do PAN (conta como lead PAN)
      case 'finance_pan_click':
        // no seu front você manda: { type:'finance_pan_click', moto:'JET 50S', link:'...' }
        if (moto) inc(stats.finance.pan_clicks, moto);
        stats.finance.leads_pan += 1;
        break;

      default:
        break;
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Erro ao processar /api/track:', e);
    res.status(500).json({ ok: false });
  }
});

// ---- API DO DASHBOARD ----
app.get('/api/stats', (req, res) => {
  res.json(stats);
});

// ---- START ----
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
