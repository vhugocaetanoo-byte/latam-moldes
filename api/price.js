// Cotação por país para mostrar o valor aproximado em moeda local ao lado do preço em US$.
// O preço de cobrança é o da Hotmart (em US$); aqui só entra a cotação de referência.
const COUNTRY_CUR = {
  AR: 'ARS', MX: 'MXN', CO: 'COP', CL: 'CLP', PE: 'PEN', UY: 'UYU',
  PY: 'PYG', CR: 'CRC', DO: 'DOP', GT: 'GTQ', BO: 'BOB', HN: 'HNL',
};
// Reserva caso a API de câmbio falhe (valores de 06/11/2026).
const FALLBACK = { ARS: 1545, MXN: 18.7, COP: 3237, CLP: 966, PEN: 3.45, UYU: 40.3, PYG: 6094, CRC: 454, DOP: 60.4, GTQ: 7.65, BOB: 12.1, HNL: 26.9 };
// A Hotmart converte US$ para moeda local com câmbio próprio = câmbio de mercado x margem.
// A cotação muda todo dia, então guardamos a MARGEM (percentual sobre o câmbio de mercado), não a taxa fixa.
// Margens medidas no checkout em 06/11/2026 (US$ 9,90 e 14,90; total que o comprador paga):
//  AR +18,6% | MX +23,4% (IVA de 16% somado ao preço) | CL +6,8% (IVA de 19% incluso) | CR +5,3%
//  UY +5,8% | PE +7,6% (Hotmart arredonda para inteiro) | CO +5,7%
// Demais países: +6% (média observada). Estimativa, nunca exata: o valor na página é sempre "≈".
const MARKUP = { AR: 1.1856, MX: 1.2341, CL: 1.0685, CR: 1.0535, UY: 1.0582, PE: 1.0756, CO: 1.0566 };
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
  const rate = (r[cur] || FALLBACK[cur]) * (MARKUP[country] || SPREAD);
  res.status(200).json({ country, cur, rate });
};
