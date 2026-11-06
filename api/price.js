// >>> TEMPLATE (variante Hotmart EXATA). Para uma oferta nova, trocar só: OFFERS (preço em US$ -> caminho do checkout da Hotmart),
// >>> COUNTRY_CUR (países), e MARKUP/SPREAD (margens do fallback). Origem: projeto Moldes de Mesa Posta (SOUSPLAT LATAM), 2026-11-06.
// /api/price
// Preço em moeda local IGUAL ao do checkout da Hotmart.
// 1) Para o país do visitante (?country=XX ou x-vercel-ip-country), pede à Hotmart o checkout de cada oferta
//    (mesma chamada que o próprio checkout faz ao trocar de país) e lê o TOTAL que o comprador paga (com IVA quando existe).
// 2) Se isso falhar, usa a última leitura boa (até 6 h) e, depois, uma estimativa: câmbio de mercado x margem da Hotmart.
// 3) Se o país não tem moeda local, responde em US$ (rate: null) e a página fica só com o preço em dólar.
// Nunca quebra a página: qualquer erro cai no passo seguinte.

const OFFERS = {            // preço em US$ -> página do checkout da oferta
  '4.9': '/H108180582X?off=jtkn79co',
  '6.9': '/H108180582X?off=qfowq912',
  '9.9': '/I108153698I?off=tp9ekqwm&checkoutMode=10',
  '14.9': '/I108153698I?off=bsitvsaf',
};
const BASE = 'https://pay.hotmart.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const COUNTRY_CUR = {
  AR: 'ARS', MX: 'MXN', CO: 'COP', CL: 'CLP', PE: 'PEN', UY: 'UYU',
  PY: 'PYG', CR: 'CRC', DO: 'DOP', GT: 'GTQ', BO: 'BOB', HN: 'HNL',
};

// ---- Estimativa (só se a leitura exata falhar) ----
const FALLBACK = { ARS: 1545, MXN: 18.7, COP: 3237, CLP: 966, PEN: 3.45, UYU: 40.3, PYG: 6094, CRC: 454, DOP: 60.4, GTQ: 7.65, BOB: 12.1, HNL: 26.9 };
// A Hotmart converte US$ com câmbio próprio = câmbio de mercado x margem (+ IVA em alguns países).
// Margens medidas no checkout em 06/11/2026. Demais países: +6 % (estimativa).
const MARKUP = { AR: 1.1856, MX: 1.2341, CL: 1.0685, CR: 1.0535, UY: 1.0582, PE: 1.0756, CO: 1.0566 };
const SPREAD = 1.06;
const FX_TTL = 6 * 60 * 60 * 1000;
let fxCache = null;
async function rates() {
  if (fxCache && Date.now() - fxCache.at < FX_TTL) return fxCache.rates;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    if (j.result !== 'success') throw new Error('fx');
    fxCache = { at: Date.now(), rates: j.rates };
    return j.rates;
  } catch (e) {
    return fxCache ? fxCache.rates : FALLBACK;
  }
}

// ---- Leitura exata no checkout da Hotmart ----
const EXACT_TTL = 15 * 60 * 1000;       // refrescar a cada 15 min por país
const EXACT_STALE = 6 * 60 * 60 * 1000; // se a Hotmart falhar, aceitar leitura de até 6 h
const exactCache = new Map();           // país -> { at, cur, amounts }
const inflight = new Map();
let lastError = null;   // só para diagnóstico em deploys de teste (nunca vai na resposta de produção)

function readCheckout(html) {
  // O checkout da Hotmart embute os dados da página em <script type="application/json"> (formato "devalue").
  const re = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].indexOf('checkoutLoadId') === -1) continue;   // (visto de EE. UU. el checkout no trae 'currencyFrom': ya está en US$)
    const arr = JSON.parse(m[1]);
    const root = arr.find((el) => el && typeof el === 'object' && !Array.isArray(el) && 'checkoutLoadId' in el && 'products' in el);
    if (!root) continue;
    const loadId = arr[root.checkoutLoadId];
    const product = arr[arr[root.products][0]];
    const offerKey = arr[arr[product.offer].key];
    if (typeof loadId === 'string' && typeof offerKey === 'string') return { loadId, offerKey };
  }
  throw new Error('estrutura do checkout mudou');
}

async function checkoutAmount(path, country, expectedCur) {
  const r = await fetch(BASE + path, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('checkout http ' + r.status);
  const { loadId, offerKey } = readCheckout(await r.text());
  const body = { tax: {}, device: 'DESKTOP', items: [{ offer: offerKey, quantity: 1 }], countryIsoCode: country, checkoutLoadId: loadId, loadRelatedProducts: false };
  const l = await fetch(BASE + '/api/next/load?hash=' + encodeURIComponent(loadId), {
    method: 'POST',
    headers: { 'user-agent': UA, 'content-type': 'application/json', origin: BASE, referer: BASE + path },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!l.ok) throw new Error('load http ' + l.status);
  const j = await l.json();
  const methods = j && j.data && j.data.products && j.data.products[0] && j.data.products[0].offer && j.data.products[0].offer.paymentMethods;
  if (!Array.isArray(methods) || !methods.length) throw new Error('sem métodos de pagamento');
  const card = methods.find((x) => x.type === 'CREDIT_CARD') || methods[0];
  const v = Number(card.amount && card.amount.value);
  if (!isFinite(v) || v <= 0 || card.amount.currency !== expectedCur) throw new Error('moeda inesperada');
  return v;
}

async function readExact(country) {
  const cur = COUNTRY_CUR[country];
  const keys = Object.keys(OFFERS);
  const vals = await Promise.all(keys.map((k) => checkoutAmount(OFFERS[k], country, cur)));
  const amounts = {};
  keys.forEach((k, i) => { amounts[k] = Math.round(vals[i] * 100) / 100; });
  const entry = { at: Date.now(), cur, amounts };
  exactCache.set(country, entry);
  return entry;
}

async function getExact(country) {
  const c = exactCache.get(country);
  if (c && Date.now() - c.at < EXACT_TTL) return c;
  if (!inflight.has(country)) inflight.set(country, readExact(country).finally(() => inflight.delete(country)));
  try {
    return await inflight.get(country);
  } catch (e) {
    lastError = String((e && e.message) || e);
    console.warn('[price] leitura exata falhou, usando estimativa:', country, lastError);
    if (c && Date.now() - c.at < EXACT_STALE) return c;
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');   // a resposta muda por país: nunca em cache (CDN ou navegador)
  let country = String((req.headers && req.headers['x-vercel-ip-country']) || '').toUpperCase();
  try { const q = new URL(req.url, 'http://x').searchParams.get('country'); if (q) country = q.toUpperCase(); } catch (e) {}
  const cur = COUNTRY_CUR[country];
  if (!cur) return res.status(200).json({ country, cur: 'USD', rate: null });

  const exact = await getExact(country);
  if (exact) {
    return res.status(200).json({ country, cur, exact: true, rate: exact.amounts['9.9'] / 9.9, amounts: exact.amounts });
  }
  // Estimativa
  const r = await rates();
  const rate = (r[cur] || FALLBACK[cur]) * (MARKUP[country] || SPREAD);
  const amounts = {};
  Object.keys(OFFERS).forEach((k) => { amounts[k] = Math.round(parseFloat(k) * rate); });
  const out = { country, cur, exact: false, rate, amounts };
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production' && lastError) out.err = lastError;
  return res.status(200).json(out);
};
