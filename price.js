// >>> TEMPLATE (variante Hotmart EXATA). Pares com api-price.hotmart-exato.js (vira api/price.js). Vira price.js na raiz do site.
// >>> HTML: <div class="loc" data-loc="USD"></div> abaixo de cada preço em US$; diferenças: (<span data-loc-diff="9.9-4.9"></span>) dentro de <span class="aprox" data-loc-wrap hidden>.
// Muestra, junto al precio en US$, el precio en la moneda local del visitante.
// Con exact:true el valor es el mismo total que muestra el checkout de Hotmart (leído por /api/price);
// si no se pudo leer, la API manda una estimación (exact:false) y se muestra con "≈".
// Si algo falla o el país no tiene moneda local, la página queda solo con US$.
(function () {
  var LOC = { AR: 'es-AR', MX: 'es-MX', CO: 'es-CO', CL: 'es-CL', PE: 'es-PE', UY: 'es-UY', PY: 'es-PY', CR: 'es-CR', DO: 'es-DO', GT: 'es-GT', BO: 'es-BO', HN: 'es-HN' };
  var SYM = { ARS: '$', MXN: '$', COP: '$', CLP: '$', UYU: '$', DOP: 'RD$', PEN: 'S/', GTQ: 'Q', BOB: 'Bs', HNL: 'L', CRC: '₡', PYG: '₲' };
  var SHOWCODE = { ARS: 1, MXN: 1, COP: 1, CLP: 1, UYU: 1, BOB: 1, HNL: 1, DOP: 0, PEN: 0, GTQ: 0, CRC: 0, PYG: 0 };

  function nice(v) { // 3 cifras significativas
    var p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 2));
    return Math.round(v / p) * p;
  }
  function fmt(v, locale, exact) {
    var dec = exact ? (v === Math.round(v) ? 0 : 2) : (v >= 100 || v === Math.round(v) ? 0 : 2);
    return new Intl.NumberFormat(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
  }

  function apply(d) {
    if (!d || !d.rate || !LOC[d.country]) return;
    var sym = SYM[d.cur] || '$', code = SHOWCODE[d.cur], locale = LOC[d.country], amounts = d.amounts || {};
    function text(v, exact, pre) { return pre + sym + ' ' + fmt(v, locale, exact) + (code ? ' ' + d.cur : ''); }
    function show(el) { var wrap = el.closest('[data-loc-wrap]'); if (wrap) wrap.hidden = false; }

    // Precios de las ofertas: data-loc="9.9" (US$)
    [].forEach.call(document.querySelectorAll('[data-loc]'), function (el) {
      var usd = parseFloat(el.getAttribute('data-loc'));
      if (!usd) return;
      var known = amounts[String(usd)];
      var v = known != null ? known : (el.hasAttribute('data-exact') ? Math.round(usd * d.rate) : nice(usd * d.rate));
      var isExact = d.exact === true && known != null;
      el.textContent = text(v, isExact, el.getAttribute('data-pre') || (isExact ? '' : '≈ '));
      show(el);
    });

    // Diferencias entre dos ofertas: data-loc-diff="9.9-4.9" (siempre aproximado: es una resta)
    [].forEach.call(document.querySelectorAll('[data-loc-diff]'), function (el) {
      var k = el.getAttribute('data-loc-diff').split('-');
      var a = amounts[String(parseFloat(k[0]))], b = amounts[String(parseFloat(k[1]))];
      var v = (a != null && b != null) ? a - b : Math.round((parseFloat(k[0]) - parseFloat(k[1])) * d.rate);
      el.textContent = text(Math.round(v * 100) / 100, d.exact === true, '≈ ');
      show(el);
    });

    var note = document.getElementById('fxNote');
    if (note) {
      if (d.exact === true) note.textContent = 'Precio en tu moneda, tal como lo muestra el checkout. Puede variar levemente con el tipo de cambio.';
      note.hidden = false;
    }
  }

  // ?country=AR en la URL de la página fuerza el país (para probar sin VPN)
  var forced = (new URLSearchParams(location.search).get('country') || '').toUpperCase();
  fetch('/api/price' + (/^[A-Z]{2}$/.test(forced) ? '?country=' + forced : ''), { credentials: 'omit', cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(apply)
    .catch(function () {});
})();
