// Cotação por país para mostrar o valor aproximado em moeda local ao lado do preço em US$.
// O preço de cobrança é o da Hotmart (em US$); aqui só entra a cotação de referência.
const COUNTRY_CUR = {
  AR: 'ARS', MX: 'MXN', CO: 'COP', CL: 'CLP', PE: 'PEN', UY: 'UYU',
  PY: 'PYG', CR: 'CRC', DO: 'DOP', GT: 'GTQ', BO: 'BOB', HN: 'HNL',
};
// Reserva caso a API de câmbio falhe (valores de 06/11/2026).
const FALLBACK = { ARS: 1545, MXN: 18.7, COP: 3237, CLP: 966, PEN: 3.45, UYU: 40.3, PYG: 6094, CRC: 454, DOP: 60.4, GTQ: 7.65, BOB: 12.1, HNL: 26.9 };
// Taxa efetiva (total que o comprador paga na Hotmart, já com spread e IVA quando aplicável),
// medida no checkout em 06/11/2026 com US$ 9,90 e 14,90:
//  AR 18.139 / 27.300 | MX 228,52 / 344,52 (IVA 16% somado) | CL 10.219 / 15.379 (IVA 19% incluso)
//  CR 4.737 / 7.129   | UY 422 / 634 | PE S/ 37 / 55 (Hotmart arredonda para inteiro)
// Demais países: câmbio de mercado + 6% (média observada em CL, CR e UY; estimativa).
// Para ficar exato, medir no checkout da Hotmart e acrescentar aqui.
const HOTMART_RATE = { AR: 1832.22, MX: 23.1, CL: 1032.2, CR: 478.47, UY: 42.6, PE: 3.71 };
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
