// Preço local por país, lido da própria tabela do checkout da Cakto.
// Países em LOCAL mostram moeda local; qualquer outro fica em US$.
const LINKS = { main: 'xpdc66x', up: 'kfwsi8b_1285750', down: '3bgxoas' };
const USD = { main: 9.9, up: 6.9, down: 4.9 };
const LOCAL = ['AR', 'MX', 'CO', 'CL', 'PE', 'UY', 'PY', 'CR', 'DO', 'GT'];
const TTL = 30 * 60 * 1000;
const SNAPSHOT = require('./snapshot.json');

let cache = null; // { at, table }

function parse(html) {
  const re = /country_code\\":\\"([A-Z]{2})\\",\\"currency\\":\\"([A-Z]{3})\\",\\"price_local\\":\\"([\d.]+)\\"/g;
  const out = {};
  let m;
  while ((m = re.exec(html))) out[m[1]] = { cur: m[2], v: parseFloat(m[3]) };
  return out;
}

async function load() {
  const table = {};
  for (const k of Object.keys(LINKS)) {
    const r = await fetch('https://pay.cakto.com.br/' + LINKS[k], {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; price-sync)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error('cakto ' + r.status);
    const p = parse(await r.text());
    if (Object.keys(p).length < 20) throw new Error('parse');
    for (const c of LOCAL) {
      if (!p[c]) continue;
      (table[c] = table[c] || { cur: p[c].cur })[k] = p[c].v;
    }
  }
  return table;
}

async function getTable() {
  if (cache && Date.now() - cache.at < TTL) return cache.table;
  try {
    const table = await load();
    cache = { at: Date.now(), table };
    return table;
  } catch (e) {
    if (cache) return cache.table; // mantém o último bom
    return SNAPSHOT; // nunca fica sem preço
  }
}

module.exports = async (req, res) => {
  const q = (req.query && req.query.country) || '';
  const country = String(q || req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const table = await getTable();
  const row = LOCAL.includes(country) ? table[country] : null;
  res.setHeader('Cache-Control', 'private, max-age=600');
  if (!row || !row.main) return res.status(200).json({ country, cur: 'USD', main: USD.main, up: USD.up, down: USD.down });
  res.status(200).json({ country, cur: row.cur, main: row.main, up: row.up || null, down: row.down || null });
};
