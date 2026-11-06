// Cotação por país para mostrar o valor aproximado em moeda local ao lado do preço em US$.
// O preço de cobrança é o da Hotmart (em US$); aqui só entra a cotação de referência.
const COUNTRY_CUR = {
  AR: 'ARS', MX: 'MXN', CO: 'COP', CL: 'CLP', PE: 'PEN', UY: 'UYU',
  PY: 'PYG', CR: 'CRC', DO: 'DOP', GT: 'GTQ', BO: 'BOB', HN: 'HNL',
};
// Reserva caso a API de câmbio falhe (valores de 06/11/2026).
const FALLBACK = { ARS: 1545, MXN: 18.7, COP: 3237, CLP: 966, PEN: 3.45, UYU: 40.3, PYG: 6094, CRC: 454, DOP: 60.4, GTQ: 7.65, BOB: 12.1, HNL: 26.9 };
// Taxa efetiva que a Hotmart cobra (já com spread/impostos), medida no checkout.
// AR: US$ 9,90 = $ 18.139 e US$ 14,90 = $ 27.300 => 1832,22. Demais países: câmbio de mercado + 6% (estimativa;
// para ficar exato, medir no checkout da Hotmart com VPN e colocar aqui).
const HOTMART_RATE = { AR: 1832.22 };
const SPREAD = 1.06;
const TTL = 6 * 60 * 60 * 1000;
let cache = null;

async function rates() {
  if (cache && Date.now() - cache.at < TTL) return cache.rates;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    if (j.result !== 'success') throw new Error('fx');
    cache = { at: Date.now(), rates: j.rates };
    return j.rates;
  } catch (e) {
    return cache ? cache.rates : FALLBACK;
  }
}

module.exports = async (req, res) => {
  const q = (req.query && req.query.country) || '';
  const country = String(q || req.headers['x-vercel-ip-country'] || '').toUpperCase();
  res.setHeader('Cache-Control', 'no-store');
  const cur = COUNTRY_CUR[country];
  if (!cur) return res.status(200).json({ country, cur: 'USD', rate: null });
  const r = await rates();
  const rate = HOTMART_RATE[country] || (r[cur] || FALLBACK[cur]) * SPREAD;
  res.status(200).json({ country, cur, rate });
};
