// Muestra el precio en moneda local (misma tabla que el checkout de Cakto).
// Si algo falla, queda el precio en US$ escrito en el HTML.
(function () {
  var root = document.documentElement;
  root.classList.add('pl-wait');
  var finished = false;
  function finish() { if (!finished) { finished = true; root.classList.remove('pl-wait'); } }
  setTimeout(finish, 1500);

  var LOC = { AR: 'es-AR', MX: 'es-MX', CO: 'es-CO', CL: 'es-CL', PE: 'es-PE', UY: 'es-UY', PY: 'es-PY', CR: 'es-CR', DO: 'es-DO', GT: 'es-GT' };
  var SYM = { ARS: '$', MXN: '$', COP: '$', CLP: '$', UYU: '$', DOP: 'RD$', PEN: 'S/', GTQ: 'Q', CRC: '₡', PYG: '₲' };
  var SHOWCODE = { ARS: 1, MXN: 1, COP: 1, CLP: 1, UYU: 1, DOP: 0, PEN: 0, GTQ: 0, CRC: 0, PYG: 0 };

  function num(v, locale) {
    var dec = (v >= 100 || v === Math.round(v)) ? 0 : 2;
    return new Intl.NumberFormat(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: true }).format(v);
  }
  function round2(v) { // 2 cifras significativas, para que los ejemplos sean redondos
    var p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
    return Math.round(v / p) * p;
  }
  function up2(v) { var p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1)); return Math.ceil(v / p) * p; }

  function apply(d) {
    if (!d || d.cur === 'USD' || !LOC[d.country] || !d.main) return;
    var loc = LOC[d.country], sym = SYM[d.cur] || '$', code = SHOWCODE[d.cur];
    function money(v) { return sym + ' ' + num(v, loc) + (code ? ' ' + d.cur : ''); }
    var r = d.main / 9.9;

    var cost = round2(6.7 * r), sale = round2(20 * r), profit = sale - cost;
    var ex = { cost: cost, sale: sale, profit: profit };

    [].forEach.call(document.querySelectorAll('[data-p]'), function (el) {
      var v = d[el.getAttribute('data-p')];
      if (!v) return;
      if (el.hasAttribute('data-big')) {
        el.innerHTML = '<small>' + sym + '</small>' + num(v, loc) + (code ? '<small style="margin-left:8px;vertical-align:baseline;font-size:18px">' + d.cur + '</small>' : '');
      } else el.textContent = money(v);
    });
    [].forEach.call(document.querySelectorAll('[data-ex]'), function (el) {
      el.textContent = money(ex[el.getAttribute('data-ex')]);
    });
    [].forEach.call(document.querySelectorAll('[data-usd]'), function (el) {
      el.textContent = money(round2(parseFloat(el.getAttribute('data-usd')) * r));
    });
    [].forEach.call(document.querySelectorAll('[data-per]'), function (el) {
      var a = el.getAttribute('data-per').split(':'), v = d[a[0]];
      if (v) el.textContent = money(up2(v / parseFloat(a[1])));
    });
  }

  fetch('/api/price', { credentials: 'omit' })
    .then(function (r) { return r.json(); })
    .then(apply)
    .catch(function () {})
    .then(finish);
})();
