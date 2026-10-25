/* Ynot — Diwali layer.
   Adds decoration and a gift guide on top of the normal home page.
   It changes no existing logic: the gift buttons press the cart's own
   "+" buttons. If anything here fails, the page carries on as normal. */
(function () {
  var GIFTS = [
    // index = position in the page's VIBES array (and the cart rows)
    { i: 0, name: 'Black Bloom', tag: 'For girls', c: '#FF2D87', who: 'for the one who owns the room', notes: 'Floral. Elegant. Unforgettable.' },
    { i: 3, name: 'Amour Belle', tag: 'For girls', c: '#C77DFF', who: 'for the dreamer', notes: 'Romantic. Dreamy. Charming.' },
    { i: 1, name: 'Legacy', tag: 'For boys', c: '#00E58F', who: 'for the fearless one', notes: 'Fresh. Bold. Fearless.' },
    { i: 2, name: 'Dark Rogue', tag: 'For boys', c: '#3D7BFF', who: 'for the night owl', notes: 'Woody. Mysterious. Addictive.' }
  ];

  var DIYA = '<svg width="56" height="46" viewBox="0 0 64 52" aria-hidden="true">' +
    '<g class="dw-flame"><path d="M32 2c5 7 7 11 7 15a7 7 0 0 1-14 0c0-4 2-8 7-15z" fill="#FFD23F"/>' +
    '<path d="M32 9c2.5 3.5 3.5 6 3.5 8a3.5 3.5 0 0 1-7 0c0-2 1-4.5 3.5-8z" fill="#FF7A00"/></g>' +
    '<path d="M4 28h56c-2 13-13 21-28 21S6 41 4 28z" fill="#B8441B"/>' +
    '<path d="M4 28h56" stroke="#F3C24A" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="18" cy="37" r="2.2" fill="#F3C24A"/><circle cx="32" cy="40" r="2.2" fill="#F3C24A"/><circle cx="46" cy="37" r="2.2" fill="#F3C24A"/></svg>';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function safely(name, fn) {
    try { fn(); } catch (e) { if (window.console) console.warn('[diwali] ' + name, e); }
  }

  function toran(bar) {
    var t = el('div', 'dw-toran');
    t.setAttribute('aria-hidden', 'true');
    var rope = el('div', 'dw-rope'), r = '';
    for (var k = 0; k < 120; k++) r += (k % 5 === 2) ? '<i class="l"></i>' : '<i></i>';
    rope.innerHTML = r;
    var strands = el('div', 'dw-strands'), s = '';
    [4, 2, 5, 3, 4, 2, 4, 3, 5, 2, 4].forEach(function (n) {
      s += '<div class="dw-strand">' + new Array(n + 1).join('<i></i>') + '<b></b></div>';
    });
    strands.innerHTML = s;
    t.appendChild(rope); t.appendChild(strands);
    bar.parentNode.insertBefore(t, bar);
  }

  function topbar(bar) {
    var spans = bar.querySelectorAll('span');
    for (var k = 0; k < spans.length; k++) {
      if (spans[k].textContent.trim() === 'Out now') {
        spans[k].textContent = 'Happy Diwali';
        spans[k].className = 'dw-hello';
        break;
      }
    }
    var strip = el('div', 'dw-strip', '<p>Order early for Diwali &middot; dispatched in 1&ndash;3 working days &middot; free delivery across India</p>');
    bar.parentNode.insertBefore(strip, bar.nextSibling);
  }

  function hero() {
    var hand = document.querySelector('.hero .hand');
    if (hand) hand.innerHTML = 'Four vibes. One for every cousin. Happy <em>Diwali</em>.';
    var stage = document.getElementById('stage');
    if (stage) {
      var row = el('div', 'dw-diyas');
      row.setAttribute('aria-hidden', 'true');
      row.innerHTML = new Array(6).join('<div class="dw-diya">' + DIYA + '</div>');
      stage.parentNode.insertBefore(row, stage.nextSibling);
    }
  }

  function gifts() {
    var drop = document.getElementById('drop');
    if (!drop) return;
    var petals = '';
    var cols = ['#FF2D87', '#FFA41B', '#3D7BFF', '#00E58F'];
    for (var p = 0; p < 8; p++) {
      petals += '<ellipse cx="0" cy="-24" rx="7" ry="14" fill="' + cols[p % 4] + '" transform="rotate(' + (p * 45) + ')"/>';
    }
    var sec = el('section', 'dw-gifts wrap');
    sec.id = 'diwali';
    sec.setAttribute('aria-labelledby', 'dw-gifts-h');
    var cards = GIFTS.map(function (g) {
      return '<article class="dw-card" style="--c:' + g.c + '">' +
        '<span class="dw-tag">' + g.tag + '</span>' +
        '<p class="dw-who">' + g.who + '</p>' +
        '<h3>' + g.name + '</h3>' +
        '<p class="dw-notes">' + g.notes + '</p>' +
        '<button type="button" data-i="' + g.i + '">Gift ' + g.name + ' &middot; &#8377;599</button>' +
        '</article>';
    }).join('');
    sec.innerHTML =
      '<div class="dw-rangoli" aria-hidden="true"><span></span>' +
      '<svg width="80" height="80" viewBox="-40 -40 80 80">' + petals +
      '<circle r="13" fill="#C77DFF"/><circle r="6" fill="#FFD23F"/></svg><span></span></div>' +
      '<p class="dw-eyebrow">The Diwali gift guide</p>' +
      '<h2 id="dw-gifts-h">Who are you <em>gifting</em>?</h2>' +
      '<p class="dw-lede">Four vibes, one for every cousin. Tap one and it goes straight into your cart below.</p>' +
      '<div class="dw-grid">' + cards + '</div>';
    drop.parentNode.insertBefore(sec, drop);

    sec.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-i]');
      if (!b) return;
      var rows = document.querySelectorAll('#cart .crow');
      var row = rows[+b.getAttribute('data-i')];
      var plus = row && row.querySelector('.plus');
      if (!plus) return;
      plus.click();
      b.classList.add('done');
      b.innerHTML = 'Added &mdash; one more?';
      drop.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function footer() {
    var big = document.querySelector('footer .bigfoot');
    if (big) big.parentNode.insertBefore(el('p', 'dw-wish', 'Shubh Deepavali from Ynot'), big);
  }

  function build() {
    var bar = document.querySelector('header.bar');
    if (!bar) return;
    safely('toran', function () { toran(bar); });
    safely('topbar', function () { topbar(bar); });
    safely('hero', hero);
    safely('gifts', gifts);
    safely('footer', footer);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
