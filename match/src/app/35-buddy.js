// ===== a friend above the board: one of the six peeks over the board's top edge. It blinks, cheers at big moves, gasps at specials and dozes off when you stop =====
const BUD = { c: -1, face: '', want: 'idle', until: 0, on: false };
function budShow(c) { BUD.c = c; BUD.face = ''; BUD.want = 'idle'; BUD.until = 0; budPlace(); }
// where it fits: in the free space between the numbers and the board (on a short screen there is none, and it stays away)
function budPlace() {
  const el = $('buddy'), gm = $('game');
  if (!V.g || gm.hidden || BUD.c < 0 || !R.c) { el.hidden = true; BUD.on = false; return; }
  const top = $('stage').getBoundingClientRect().top - gm.getBoundingClientRect().top;
  const room = R.by - R.c * 0.1 - top;
  const s = Math.round(Math.min(R.c * 2.1, (room - 4) / 0.74, 130));
  BUD.on = s >= 58;
  el.hidden = !BUD.on;
  if (!BUD.on) return;
  Object.assign(el.style, { left: R.bx + 'px', width: R.c * V.W + 'px', top: Math.round(top) + 'px', height: Math.round(room) + 'px' });
  el.style.setProperty('--bs', s + 'px');
  BUD.face = ''; budPaint();
}
// a face for a while (ms), with a little hop
function budFace(f, ms, hop) {
  if (!BUD.on) return;
  BUD.want = f; BUD.until = ms ? now() + ms : 0;
  budPaint();
  if (hop) { const el = $('buddy'); el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); }
}
function budPaint() {
  const f = BUD.want;
  if (f === BUD.face) return;
  BUD.face = f;
  const id = 'bd' + (picN++).toString(36);
  const one = (face, cls) => `<span class="${cls}">${A.svg(0, BUD.c, face, id + cls)}</span>`;
  $('buddy').firstElementChild.innerHTML = f === 'idle' ? one('idle', 'b1') + one('blink', 'b2') : one(f, 'b1') + (f === 'sleep' ? '<i class="zz">z</i><i class="zz">z</i>' : '');
}
// every frame: back to its usual face when a reaction is over; happy or tired at the end; asleep after 15 s without a move
function budTick() {
  if (!BUD.on) return;
  const g = U.g, t = now();
  if (BUD.until && t > BUD.until) BUD.until = 0;
  if (!BUD.until) {
    let f = 'idle';
    if (g && g.over) f = g.mode === 'level' && !g.won ? 'sleep' : 'happy';
    else if (live() && !U.tut && t - U.lastInput > 15000) f = 'sleep';
    BUD.want = f;
  }
  budPaint();
}
$('buddy').firstElementChild.addEventListener('animationend', e => { if (e.animationName === 'budhop') $('buddy').classList.remove('hop'); });
