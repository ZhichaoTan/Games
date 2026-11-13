/* Keeps the page at its normal size on phones. Shared by the hub, Hold'em and Mahjong (each build inlines it in <head>).
   iOS Safari ignores user-scalable=no, so a double tap or a pinch could zoom the page, and inside a game the table
   then wouldn't pinch back out. Double taps are covered by touch-action:manipulation on every element, pinches by
   cancelling Safari's gesture events. If the page still ends up zoomed (a text field, a system setting), pinching is
   allowed again until it's back to normal size and a small note says how to zoom out. */
(function () {
  var root = document.documentElement, vv = window.visualViewport;
  var st = document.createElement('style');
  st.textContent = '*,*::before,*::after{touch-action:manipulation}html.zoomed #game{touch-action:manipulation}' +
    '#zoomhint{position:fixed;left:0;top:0;z-index:2147483000;display:flex;justify-content:center;pointer-events:none;transform-origin:0 0;opacity:0;transition:opacity .25s}' +
    '#zoomhint.on{opacity:1}#zoomhint span{margin-top:calc(env(safe-area-inset-top,0px) + 10px);padding:9px 16px;border-radius:999px;background:rgba(12,14,13,.9);color:#f4efe4;' +
    'font:700 14px/1.2 -apple-system,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.12);white-space:nowrap}';
  (document.head || root).appendChild(st);
  var zoomed = function () { return !!vv && vv.scale > 1.02; };
  // The note only shows for a real, visible zoom on a touch screen: a slightly-off scale that iOS can leave behind after the
  // keyboard or a rotation (Zhichao saw the note at normal size, 2026-11-13), a desktop trackpad pinch, or a focused text field don't count.
  var touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  var typing = function () { var a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
  var bigZoom = function () { return zoomed() && vv.scale > 1.12 && vv.width < innerWidth * 0.9 && touch && !typing(); };
  var block = function (e) { if (!zoomed() && e.cancelable) e.preventDefault(); };
  document.addEventListener('gesturestart', block, { passive: false });
  document.addEventListener('gesturechange', block, { passive: false });
  document.addEventListener('touchmove', function (e) {
    if ((e.touches && e.touches.length > 1) || (e.scale && e.scale !== 1)) block(e);
  }, { passive: false });
  if (!vv) return;
  var hint = null, timer = 0;
  var place = function () {
    if (!hint) return;
    hint.style.width = innerWidth + 'px';
    hint.style.transform = 'translate(' + vv.offsetLeft + 'px,' + vv.offsetTop + 'px) scale(' + (1 / vv.scale) + ')';
  };
  var sync = function () {
    var z = zoomed();
    if (z !== root.classList.contains('zoomed')) root.classList.toggle('zoomed', z);
    clearTimeout(timer);
    if (z) {
      if (!hint) {
        hint = document.createElement('div'); hint.id = 'zoomhint'; hint.setAttribute('aria-hidden', 'true');
        hint.appendChild(document.createElement('span'));
        document.body.appendChild(hint);
      }
      hint.firstChild.textContent = /^zh/.test(root.lang) ? '双指捏合，缩回原来大小' : 'Pinch with two fingers to zoom back out';
      place();
      timer = setTimeout(function () { if (bigZoom()) { place(); hint.classList.add('on'); } }, 1500);
    } else if (hint) hint.classList.remove('on');
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', function () { if (zoomed()) place(); });
})();
