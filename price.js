// Reemplaza los precios en US$ por el precio en la moneda local del visitante.
// Con exact:true el valor es el mismo total que muestra el checkout de Hotmart (leído por /api/price).
// Si algo falla o el país no tiene moneda local, la página queda en US$ (el HTML ya trae el US$ escrito).
(function () {
  var root = document.documentElement;
  function done() { root.classList.remove('pl-wait'); }
  var LOC = { AR: 'es-AR', MX: 'es-MX', CO: 'es-CO', CL: 'es-CL', PE: 'es-PE', UY: 'es-UY', PY: 'es-PY', CR: 'es-CR', DO: 'es-DO', GT: 'es-GT', BO: 'es-BO', HN: 'es-HN' };
  var SYM = { ARS: '$', MXN: '$', COP: '$', CLP: '$', UYU: '$', DOP: 'RD$', PEN: 'S/', GTQ: 'Q', BOB: 'Bs', HNL: 'L', CRC: '₡', PYG: '₲' };
  var SHOWCODE = { ARS: 1, MXN: 1, COP: 1, CLP: 1, UYU: 1, BOB: 1, HNL: 1, DOP: 0, PEN: 0, GTQ: 0, CRC: 0, PYG: 0 };

  function nice(v) { var p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 2)); return Math.round(v / p) * p; }
  function up3(v) { var p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1)); return Math.ceil(v / p) * p; }
  function num(v, locale, exact) {
    var dec = exact ? (v === Math.round(v) ? 0 : 2) : (v >= 100 || v === Math.round(v) ? 0 : 2);
    return new Intl.NumberFormat(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
  }

  function apply(d) {
    if (!d || !d.rate || !LOC[d.country]) return;
    var sym = SYM[d.cur] || '$', code = SHOWCODE[d.cur], locale = LOC[d.country], amounts = d.amounts || {};
    function money(v, exact) { return sym + ' ' + num(v, locale, exact) + (code ? ' ' + d.cur : ''); }
    function priceOf(usd) {
      var known = amounts[String(usd)];
      if (known != null) return { v: known, exact: d.exact === true };
      return { v: nice(usd * d.rate), exact: false, derived: true };
    }
    function q(attr, fn) { [].forEach.call(document.querySelectorAll('[' + attr + ']'), function (el) { try { fn(el, el.getAttribute(attr)); } catch (e) {} }); }

    // Precio de una oferta: <span data-pl="9.9">
    q('data-pl', function (el, a) { var p = priceOf(parseFloat(a)); el.textContent = (p.exact || p.derived ? '' : '≈ ') + money(p.v, p.exact); });
    // Precio grande de tarjeta: <div data-pl-big="14.9">
    q('data-pl-big', function (el, a) {
      var p = priceOf(parseFloat(a));
      el.innerHTML = '<small>' + sym + '</small>' + num(p.v, locale, p.exact) + (code ? '<small class="cc">' + d.cur + '</small>' : '');
    });
    // Ejemplos ilustrativos en US$ convertidos por la cotización: <span data-pl-usd="10">
    q('data-pl-usd', function (el, a) { el.textContent = money(nice(parseFloat(a) * d.rate), false); });
    // Ejemplo de margen: data-pl-ex="cost|sale|profit" (6,70 x 3 = 20; ganancia = 20 - 6,70)
    var cost = nice(6.7 * d.rate), sale = nice(20 * d.rate), ex = { cost: cost, sale: sale, profit: sale - cost };
    q('data-pl-ex', function (el, a) { el.textContent = money(ex[a], false); });
    // Diferencia entre dos ofertas: data-pl-diff="14.9-9.9"
    q('data-pl-diff', function (el, a) {
      var k = a.split('-'), x = priceOf(parseFloat(k[0])), y = priceOf(parseFloat(k[1]));
      el.textContent = money(Math.round((x.v - y.v) * 100) / 100, d.exact === true);
    });
    // Precio por unidad: data-pl-per="6.9:32" (redondeado hacia arriba)
    q('data-pl-per', function (el, a) { var k = a.split(':'); el.textContent = money(up3(priceOf(parseFloat(k[0])).v / parseFloat(k[1])), false); });

    var note = document.getElementById('fxNote');
    if (note) note.hidden = false;
  }

  // ?country=AR en la URL de la página fuerza el país (para probar sin VPN)
  var forced = (new URLSearchParams(location.search).get('country') || '').toUpperCase();
  fetch('/api/price' + (/^[A-Z]{2}$/.test(forced) ? '?country=' + forced : ''), { credentials: 'omit', cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(apply)
    .catch(function () {})
    .then(done);
})();
