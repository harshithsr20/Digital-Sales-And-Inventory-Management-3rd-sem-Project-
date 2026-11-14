/* DukaanHub animation layer — additive only. Linked from index.html. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supported = 'IntersectionObserver' in window && typeof Element.prototype.animate === 'function';
  if (reduceMotion || !supported) return; // page stays exactly as authored

  var EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
  var EASE_POP = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#<>_';

  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- start things when their trigger scrolls into view ---------- */
  var jobs = new Map();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      var list = jobs.get(entry.target) || [];
      jobs.delete(entry.target);
      list.forEach(function (fn) { try { fn(); } catch (e) {} });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  function onView(trigger, fn) {
    if (!jobs.has(trigger)) jobs.set(trigger, []);
    jobs.get(trigger).push(fn);
    io.observe(trigger);
  }

  /* ---------- building blocks ---------- */
  // Paused fade-and-rise: element is held hidden until its trigger enters view.
  // Uses the independent `translate` property so hover transforms are untouched.
  function rise(el, delay, dist) {
    var a = el.animate(
      [{ opacity: 0, translate: '0 ' + (dist || 18) + 'px' }, { opacity: 1, translate: '0 0' }],
      { duration: 700, delay: delay || 0, easing: EASE_OUT, fill: 'backwards' }
    );
    a.pause();
    return a;
  }

  function item(el, trigger, delay, dist, extras) {
    var a = rise(el, delay, dist);
    onView(trigger, function () {
      a.play();
      (extras || []).forEach(function (fn) { if (fn) fn(delay); });
    });
  }

  function stagger(container, step, base, dist, extrasFor) {
    Array.prototype.forEach.call(container.children, function (child, i) {
      item(child, container, (base || 0) + i * step, dist, extrasFor ? extrasFor(child) : null);
    });
  }

  function firstText(el) {
    if (!el) return null;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) { if (/\S/.test(n.nodeValue)) return n; }
    return null;
  }

  /* ---------- number count-up (ends on the exact original text) ---------- */
  function prepCount(el) {
    if (!el) return null;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), node;
    while ((node = w.nextNode())) { if (/\d/.test(node.nodeValue)) break; }
    if (!node) return null;
    var orig = node.nodeValue;
    var m = orig.match(/\d[\d,]*(?:\.\d+)?/);
    if (!m) return null;
    var raw = m[0];
    var grouped = raw.indexOf(',') > -1;
    var decimals = (raw.split('.')[1] || '').length;
    var target = parseFloat(raw.replace(/,/g, ''));
    var pre = orig.slice(0, m.index);
    var post = orig.slice(m.index + raw.length);
    function fmt(v) {
      return grouped
        ? v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : v.toFixed(decimals);
    }
    node.nodeValue = pre + fmt(0) + post;
    return function (delay) {
      setTimeout(function () {
        var t0 = performance.now(), dur = 1300;
        (function tick(now) {
          var p = Math.min(1, (now - t0) / dur);
          if (p < 1) {
            node.nodeValue = pre + fmt(target * (1 - Math.pow(1 - p, 3))) + post;
            requestAnimationFrame(tick);
          } else {
            node.nodeValue = orig;
          }
        })(t0);
      }, delay || 0);
    };
  }

  /* ---------- terminal-style text decode for the mono labels ---------- */
  function prepScramble(el) {
    var node = firstText(el);
    if (!node) return null;
    var finalText = node.nodeValue;
    return function (delay) {
      setTimeout(function () {
        var t0 = performance.now(), dur = 650, len = finalText.length;
        (function frame(now) {
          var p = Math.min(1, (now - t0) / dur), out = '';
          for (var i = 0; i < len; i++) {
            var ch = finalText.charAt(i);
            if (!/[A-Za-z0-9]/.test(ch) || p >= 0.25 + 0.75 * (i / len)) out += ch;
            else out += GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
          }
          if (p < 1) { node.nodeValue = out; requestAnimationFrame(frame); }
          else { node.nodeValue = finalText; }
        })(t0);
      }, delay || 0);
    };
  }

  function cardExtras(card) {
    var out = [];
    var s = prepScramble(card.querySelector('span.font-mono.block'));
    if (s) out.push(function (d) { s(d + 200); });
    all('[class~="font-medium"], [class~="space-y-2.5"] span[class~="text-[#F5F5F5]"]', card).forEach(function (n) {
      var c = prepCount(n);
      if (c) out.push(function (d) { c(d + 250); });
    });
    return out;
  }

  /* ================= HERO: metric cards cascade in after the panel ================= */
  var hero = document.querySelector('main > section');
  if (hero) {
    all('.hero-animate-5 .interactive-card', hero).forEach(function (c, i) {
      item(c, c, 800 + i * 110, 14, cardExtras(c));
    });
  }

  /* ================= SECTION HEADERS (eyebrow decodes, title rises) ================= */
  all('main .max-w-xl').forEach(function (h) {
    var s = prepScramble(h.querySelector('span.font-mono'));
    Array.prototype.forEach.call(h.children, function (c, i) {
      item(c, h, i * 110, 16, i === 0 && s ? [function (d) { s(d + 80); }] : null);
    });
  });

  /* ================= CARD GRIDS (staggered) ================= */
  all('main > section').slice(1).forEach(function (sec) {
    var inPanel = sec.id === 'analytics';
    all('[class~="md:grid-cols-3"], [class~="md:grid-cols-2"]', sec).forEach(function (g, gi) {
      stagger(g, 90, inPanel && gi === 0 ? 160 : 0, 18, cardExtras);
    });
  });

  /* ================= ANALYTICS PANEL ================= */
  var panel = document.querySelector('#analytics [class~="space-y-6"]');
  if (panel) item(panel, panel, 0, 22);

  var chartSvg = document.querySelector('#analytics svg');
  if (chartSvg) {
    var box = chartSvg.closest('[class~="p-5"]') || chartSvg.parentNode;
    item(box, box, 250, 18);

    var DRAW = 1700, START = 350, X0 = 60, X1 = 698;
    var chartAnims = [];
    var mk = function (el, kf, opts) {
      var a = el.animate(kf, Object.assign({ fill: 'backwards' }, opts));
      a.pause();
      chartAnims.push(a);
      return a;
    };

    // gridlines draw out left → right
    all('line[stroke="#2A2A2A"]', chartSvg).forEach(function (ln, i) {
      mk(ln, [{ opacity: 0, scale: '0 1' }, { opacity: 1, scale: '1 1' }], { duration: 700, delay: 60 + i * 90, easing: EASE_OUT });
    });

    // axis + month labels fade in
    all('text', chartSvg).forEach(function (t, i) {
      mk(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay: 150 + i * 28, easing: 'ease-out' });
    });

    // trend line draws itself; the gradient area wipes in behind it
    var line = chartSvg.querySelector('polyline');
    var area = chartSvg.querySelector('polygon');
    try {
      var len = line.getTotalLength();
      var dash = len + ' ' + len;
      mk(line,
        [{ strokeDasharray: dash, strokeDashoffset: len + 3 }, { strokeDasharray: dash, strokeDashoffset: 0 }],
        { duration: DRAW, delay: START, easing: 'linear' });
    } catch (e) {}
    if (area) {
      mk(area, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }],
        { duration: DRAW, delay: START, easing: 'linear' });
    }

    // data points pop in as the line reaches them (peak gets the biggest pop)
    all('circle', chartSvg).forEach(function (c) {
      var cx = parseFloat(c.getAttribute('cx'));
      var f = Math.max(0, Math.min(1, (cx - X0) / (X1 - X0)));
      var peak = c.classList.contains('chart-peak-pulse');
      var kf = peak ? [{ scale: 0 }, { scale: 1 }] : [{ opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1 }];
      mk(c, kf, { duration: peak ? 650 : 420, delay: START + f * DRAW - 80, easing: EASE_POP });
    });

    // October marker line fades in right as the line reaches it
    var pk = chartSvg.querySelector('line[stroke="#C8FF00"]');
    if (pk) {
      var pf = (parseFloat(pk.getAttribute('x1')) - X0) / (X1 - X0);
      mk(pk, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: START + pf * DRAW, easing: 'ease-out' });
    }

    var yoy = prepCount(box.querySelector('span[class~="text-xs"]'));
    onView(box, function () {
      chartAnims.forEach(function (a) { a.play(); });
      if (yoy) yoy(START);
    });
  }

  // volume bars grow up from the baseline, one after another
  var barWrap = document.querySelector('#analytics .h-16');
  if (barWrap) {
    var barAnims = Array.prototype.map.call(barWrap.children, function (b, i) {
      var a = b.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
        { duration: 800, delay: 120 + i * 55, easing: EASE_OUT, fill: 'backwards' });
      a.pause();
      return a;
    });
    onView(barWrap, function () { barAnims.forEach(function (a) { a.play(); }); });
  }

  /* ================= FAQ, CTA, FOOTER ================= */
  var faq = document.querySelector('#faq [class~="space-y-3"]');
  if (faq) stagger(faq, 85, 0, 14);

  var cta = document.querySelector('#get-started .interactive-card');
  if (cta) {
    item(cta, cta, 0, 24);
    stagger(cta, 100, 160, 14);
  }

  var footer = document.querySelector('footer');
  if (footer) {
    Array.prototype.forEach.call(footer.children, function (c, i) { item(c, c, i * 120, 10); });
  }

  /* ================= CURSOR SPOTLIGHT ================= */
  if (window.matchMedia('(hover: hover)').matches) {
    // one fixed, seamless glow for the whole page (eases after the cursor)
    var glow = document.createElement('div');
    glow.id = 'fx-glow';
    document.body.appendChild(glow);
    var tx = 0, ty = 0, gx = 0, gy = 0, running = false;
    function follow() {
      gx += (tx - gx) * 0.18; gy += (ty - gy) * 0.18;
      glow.style.setProperty('--gx', gx.toFixed(1) + 'px');
      glow.style.setProperty('--gy', gy.toFixed(1) + 'px');
      if (Math.abs(tx - gx) > 0.4 || Math.abs(ty - gy) > 0.4) requestAnimationFrame(follow);
      else running = false;
    }

    // cards + panels also get their own local glow
    var SPOT = '.interactive-card, #analytics [class~="space-y-6"], #analytics [class~="p-5"]';
    document.addEventListener('pointermove', function (e) {
      if (glow.style.opacity !== '1') { gx = tx = e.clientX; gy = ty = e.clientY; glow.style.opacity = '1'; }
      tx = e.clientX; ty = e.clientY;
      if (!running) { running = true; requestAnimationFrame(follow); }
      var n = e.target;
      if (!n || !n.closest) return;
      n = n.closest(SPOT);
      while (n) {
        var r = n.getBoundingClientRect();
        n.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        n.style.setProperty('--my', (e.clientY - r.top) + 'px');
        n = n.parentElement ? n.parentElement.closest(SPOT) : null;
      }
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { glow.style.opacity = '0'; });
  }

  /* ================= SECTION TITLES: left-to-right wipe ================= */
  all('main .max-w-xl h2').forEach(function (h) {
    var a = h.animate(
      [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }],
      { duration: 900, delay: 110, easing: EASE_OUT, fill: 'backwards' }
    );
    a.pause();
    onView(h.parentNode, function () { a.play(); });
  });

  /* ================= PRIMARY BUTTONS: magnetic pull + click ripple ================= */
  all('.btn-primary-action').forEach(function (btn) {
    if (window.matchMedia('(hover: hover)').matches) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) / r.width;
        var y = (e.clientY - (r.top + r.height / 2)) / r.height;
        btn.style.translate = (x * 8).toFixed(1) + 'px ' + (y * 6).toFixed(1) + 'px';
      });
      btn.addEventListener('pointerleave', function () { btn.style.translate = ''; });
    }
    btn.addEventListener('pointerdown', function (e) {
      var r = btn.getBoundingClientRect();
      var d = Math.max(r.width, r.height) * 2.4;
      var rip = document.createElement('span');
      rip.className = 'fx-ripple';
      rip.style.width = rip.style.height = d + 'px';
      rip.style.left = (e.clientX - r.left) + 'px';
      rip.style.top = (e.clientY - r.top) + 'px';
      btn.appendChild(rip);
      setTimeout(function () { if (rip.parentNode) rip.parentNode.removeChild(rip); }, 650);
    });
  });

  /* ================= SCROLL PROGRESS HAIRLINE ================= */
  var bar = document.createElement('div');
  bar.id = 'fx-progress';
  document.body.appendChild(bar);
  var queued = false;
  function paintProgress() {
    queued = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
  }
  window.addEventListener('scroll', function () {
    if (!queued) { queued = true; requestAnimationFrame(paintProgress); }
  }, { passive: true });
  paintProgress();
})();
