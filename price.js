// Mostra, junto al precio en US$, el valor aproximado en moneda local del país del visitante.
// Si algo falla, la página queda solo con US$.
(function () {
  var LOC = { AR: 'es-AR', MX: 'es-MX', CO: 'es-CO', CL: 'es-CL', PE: 'es-PE', UY: 'es-UY', PY: 'es-PY', CR: 'es-CR', DO: 'es-DO', GT: 'es-GT', BO: 'es-BO', HN: 'es-HN' };
  var SYM = { ARS: '$', MXN: '$', COP: '$', CLP: '$', UYU: '$', DOP: 'RD$', PEN: 'S/', GTQ: 'Q', BOB: 'Bs', HNL: 'L', CRC: '₡', PYG: '₲' };
  var SHOWCODE = { ARS: 1, MXN: 1, COP: 1, CLP: 1, UYU: 1, BOB: 1, HNL: 1, DOP: 0, PEN: 0, GTQ: 0, CRC: 0, PYG: 0 };

  function nice(v) { // 3 cifras significativas
    var p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 2));
    return Math.round(v / p) * p;
  }
  function fmt(v, locale) {
    var dec = v >= 100 || v === Math.round(v) ? 0 : 2;
    return new Intl.NumberFormat(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
  }

  function apply(d) {
    if (!d || !d.rate || !LOC[d.country]) return;
    var sym = SYM[d.cur] || '$', code = SHOWCODE[d.cur];
    [].forEach.call(document.querySelectorAll('[data-loc]'), function (el) {
      var usd = parseFloat(el.getAttribute('data-loc'));
      if (!usd) return;
      var v = el.hasAttribute('data-exact') ? Math.round(usd * d.rate) : nice(usd * d.rate);
      var pre = el.getAttribute('data-pre') || '≈ ';
      el.textContent = pre + sym + ' ' + fmt(v, LOC[d.country]) + (code ? ' ' + d.cur : '');
    });
  }

  fetch('/api/price', { credentials: 'omit', cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(apply)
    .catch(function () {});
})();
