// ===== Cipher (数字密码): the rules. No DOM, so the host's page and the Node tests run the same code =====
// Tiles: ids 0..23 are numbers, id = 2 × value + colour (colour 0 black, 1 white), so the id is also the sort key:
// black 5 < white 5 < black 6. Ids 24 and 25 are the two keys (jokers): black and white. A guess names a value 0..11, or 12 for a key.
// Everyone sees the colour of every tile; a tile's value is seen by its owner, and by everyone once it is cracked.
// A round: deal 4 tiles each (3 each with four players), sorted; keys go anywhere their owner likes.
// On your turn draw a tile (pick black or white), then point at someone's hidden tile and name its value.
// Right: it is cracked (turned face up) and you may guess again or stop, which hides your new tile in your row.
// Wrong: your new tile goes into your row face up. With nothing left to draw, a miss turns up one of your own tiles instead.
// When all your tiles are face up you're out; the last player with a hidden tile wins the round.
(function (G) {
  'use strict';
  const JK = 24, KEY = 12, NT = 26;
  const colorOf = id => id >= JK ? id - JK : id & 1;
  const valOf = id => id >= JK ? KEY : id >> 1;
  const idOf = (v, c) => v === KEY ? JK + c : v * 2 + c;
  const isKey = id => id >= JK;

  const DEFAULT_RULES = { keys: true, timer: 60 };
  const TIMERS = [0, 30, 60, 90];
  function cleanRules(r) {
    r = Object.assign({}, DEFAULT_RULES, r && typeof r === 'object' ? r : {});
    return { keys: !!r.keys, timer: TIMERS.includes(r.timer | 0) ? r.timer | 0 : DEFAULT_RULES.timer };
  }
  const handSize = n => n >= 4 ? 3 : 4;

  function cryptoRand() {
    const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    if (!c) return Math.random;
    const buf = new Uint32Array(64); let i = 64;
    return () => { if (i >= 64) { c.getRandomValues(buf); i = 0; } return buf[i++] / 4294967296; };
  }
  function seeded(seed) {
    let a = seed >>> 0 || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const randInt = (rnd, n) => Math.min(n - 1, Math.floor(rnd() * n));
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = randInt(rnd, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // The gaps (0 = far left … n = far right) where tile id can go in a row: every gap that keeps the numbers in order.
  // A key fits anywhere, and a number next to a key may have two or more gaps to choose from.
  function slotsFor(ids, id) {
    const n = ids.length, out = [];
    if (isKey(id)) { for (let i = 0; i <= n; i++) out.push(i); return out; }
    for (let i = 0; i <= n; i++) {
      let ok = true;
      for (let j = 0; j < i && ok; j++) if (!isKey(ids[j]) && ids[j] > id) ok = false;
      for (let j = i; j < n && ok; j++) if (!isKey(ids[j]) && ids[j] < id) ok = false;
      if (ok) out.push(i);
    }
    return out;
  }
  const rowIds = row => row.map(t => t.id);
  const hiddenLeft = row => row.reduce((n, t) => n + (t.open ? 0 : 1), 0);

  class Table {
    constructor(o) {
      o = o || {};
      this.rules = cleanRules(o.rules);
      this.seats = [null, null, null, null];
      this.R = null;
      this.evn = 0;        // event counter: keeps counting across rounds, so screens can tell new events from old
      this.round = 0;
      this.first = -1;     // who started the last round (the next round starts one seat on)
      this.rnd = o.rnd || cryptoRand();
    }
    players() { return [0, 1, 2, 3].filter(s => this.seats[s]); }
    ev(e) { e.n = ++this.evn; const R = this.R; R.ev.push(e); if (R.ev.length > 60) R.ev.splice(0, R.ev.length - 60); return e; }

    startRound() {
      const ps = this.players();
      if (ps.length < 2) return false;
      const rnd = this.rnd;
      const deck = [];
      for (let i = 0; i < 24; i++) deck.push(i);
      if (this.rules.keys) deck.push(24, 25);
      shuffle(deck, rnd);
      // public tile ids for the screens: a separate shuffle, so a tile's uid says nothing about its value
      const uids = shuffle(deck.map((_, i) => i + 1), rnd);
      const mk = (id, i) => ({ id, u: uids[i], open: false, bad: [] });
      let k = 0;
      if (this.first < 0 || !ps.includes(this.first)) this.first = ps[randInt(rnd, ps.length)];
      else this.first = ps[(ps.indexOf(this.first) + 1) % ps.length];
      const R = this.R = {
        no: ++this.round, ps, rows: [null, null, null, null], setup: [[], [], [], []], pool: [], go: false,
        phase: 'setup', cur: -1, stage: '', hold: null, out: [], win: -1, rank: null, pts: null,
        st: [null, null, null, null], ev: [], turns: 0, first: this.first, hand: handSize(ps.length),
      };
      for (const s of ps) {
        const mine = [];
        for (let j = 0; j < R.hand; j++, k++) mine.push(mk(deck[k], k));
        R.rows[s] = mine.filter(t => !isKey(t.id)).sort((a, b) => a.id - b.id);
        R.setup[s] = mine.filter(t => isKey(t.id));
        R.st[s] = { hit: 0, miss: 0 };
      }
      for (; k < deck.length; k++) R.pool.push(mk(deck[k], k));
      this.ev({ k: 'deal', no: R.no });
      return true;
    }
    // The host calls go() once the deal has been shown. The round starts when that has happened and every key is placed,
    // so how long the deal takes never tells anyone who was holding a key.
    go() { const R = this.R; if (!R || R.phase !== 'setup') return; R.go = true; this.maybePlay(); }
    maybePlay() {
      const R = this.R;
      if (R.phase !== 'setup' || !R.go || R.ps.some(s => R.setup[s].length)) return;
      R.phase = 'play';
      this.ev({ k: 'play' });
      this.turn(R.first);
    }
    alive() { const R = this.R; return R ? R.ps.filter(s => !R.out.includes(s)) : []; }
    turn(s) {
      const R = this.R;
      R.cur = s; R.turns++; R.hold = null;
      R.stage = R.pool.length ? 'draw' : 'guess';
      this.ev({ k: 'turn', s });
    }
    pending() {
      const R = this.R;
      if (!R || R.phase === 'end') return [];
      if (R.phase === 'setup') return R.ps.filter(s => R.setup[s].length);
      return [R.cur];
    }
    // put a tile into a row at gap `at`; returns the index it went to
    place(s, t, at) { this.R.rows[s].splice(at, 0, t); return at; }
    flip(s, t, why) {
      const R = this.R;
      t.open = true;
      this.ev({ k: 'flip', s, u: t.u, id: t.id, why });
      if (!hiddenLeft(R.rows[s]) && !R.out.includes(s)) { R.out.push(s); this.ev({ k: 'out', s, by: -1 }); }
    }
    endTurn() {
      const R = this.R;
      if (R.phase !== 'play') return;
      if (this.alive().length <= 1) { this.finish(); return; }
      const ps = R.ps;
      let i = ps.indexOf(R.cur);
      for (let n = 0; n < ps.length; n++) { i = (i + 1) % ps.length; if (!R.out.includes(ps[i])) break; }
      this.turn(ps[i]);
    }
    finish() {
      const R = this.R;
      // the drawn tile, if a round ends while someone holds one, goes into its row so the final table is complete
      if (R.hold) { const sl = slotsFor(rowIds(R.rows[R.cur]), R.hold.id); this.place(R.cur, R.hold, sl[randInt(this.rnd, sl.length)]); R.hold = null; }
      R.phase = 'end'; R.stage = '';
      const alive = this.alive();
      R.win = alive.length ? alive[0] : (R.out.length ? R.out[R.out.length - 1] : -1);
      // best first: the winner, then the others in reverse order of going out. Points: one for every player you outlasted
      R.rank = [R.win].concat(R.out.slice().reverse().filter(s => s !== R.win));
      R.pts = [0, 0, 0, 0];
      R.rank.forEach((s, i) => { R.pts[s] = R.rank.length - 1 - i; const p = this.seats[s]; if (p) { p.score = (p.score || 0) + R.pts[s]; if (i === 0) p.wins = (p.wins || 0) + 1; } });
      this.ev({ k: 'end', win: R.win });
    }

    // a player's move. Returns 'ok' or a reason it was refused
    act(s, a) {
      const R = this.R;
      if (!R || !a || typeof a !== 'object' || R.phase === 'end') return 'no';
      if (R.phase === 'setup') {
        if (a.k !== 'place' || !R.setup[s] || !R.setup[s].length) return 'no';
        const at = a.at | 0, row = R.rows[s];
        if (at < 0 || at > row.length) return 'bad';
        this.place(s, R.setup[s].shift(), at);
        this.maybePlay();
        return 'ok';
      }
      if (s !== R.cur) return 'turn';
      const row = R.rows[s];
      if (R.stage === 'draw') {
        if (a.k !== 'draw') return 'no';
        const c = a.c === 1 ? 1 : 0;
        const i = R.pool.findIndex(t => colorOf(t.id) === c);
        if (i < 0) return 'empty';
        R.hold = R.pool.splice(i, 1)[0];
        R.stage = 'guess';
        this.ev({ k: 'draw', s, c, u: R.hold.u });
        return 'ok';
      }
      if (a.k === 'guess' && (R.stage === 'guess' || R.stage === 'decide')) {
        const o = a.t | 0, i = a.i | 0, v = a.v | 0;
        if (o === s || o < 0 || o > 3 || !R.rows[o] || R.out.includes(o)) return 'bad';
        const t = R.rows[o][i];
        if (!t || t.open) return 'bad';
        if (v < 0 || v > KEY || (v === KEY && !this.rules.keys)) return 'bad';
        const hit = valOf(t.id) === v;
        if (hit) {
          R.st[s].hit++;
          t.open = true; t.by = s;
          this.ev({ k: 'guess', s, t: o, u: t.u, v, ok: true, id: t.id });
          if (!hiddenLeft(R.rows[o])) { R.out.push(o); this.ev({ k: 'out', s: o, by: s }); }
          if (this.alive().length <= 1) { this.finish(); return 'ok'; }
          R.stage = 'decide';
          return 'ok';
        }
        R.st[s].miss++;
        if (!t.bad.includes(v)) t.bad.push(v);
        this.ev({ k: 'guess', s, t: o, u: t.u, v, ok: false });
        if (R.hold) {
          // the drawn tile goes into the row face up. Where a key sits next to it there may be a choice of gap:
          // that is picked at random, so nobody can tell from it where the key was
          const h = R.hold, sl = slotsFor(rowIds(row), h.id);
          R.hold = null;
          this.place(s, h, sl[randInt(this.rnd, sl.length)]);
          this.flip(s, h, 'miss');
          this.endTurn();
          return 'ok';
        }
        const hid = row.filter(x => !x.open);
        if (hid.length <= 1) { if (hid.length) this.flip(s, hid[0], 'miss'); this.endTurn(); return 'ok'; }
        R.stage = 'reveal';
        return 'ok';
      }
      if (a.k === 'stop' && R.stage === 'decide') {
        if (R.hold) {
          const sl = slotsFor(rowIds(row), R.hold.id);
          let at = sl[0];
          if (sl.length > 1) { at = a.at | 0; if (a.at == null || !sl.includes(at)) return 'slot'; }
          const h = R.hold; R.hold = null;
          this.place(s, h, at);
          this.ev({ k: 'stop', s, u: h.u });
        } else this.ev({ k: 'stop', s, u: 0 });
        this.endTurn();
        return 'ok';
      }
      if (a.k === 'reveal' && R.stage === 'reveal') {
        const t = row[a.i | 0];
        if (!t || t.open) return 'bad';
        this.flip(s, t, 'miss');
        this.endTurn();
        return 'ok';
      }
      return 'no';
    }

    // what seat s may see: their own tiles, every tile's colour, cracked tiles, wrong guesses. Everything once the round is over
    view(s) {
      const R = this.R;
      const v = { me: s, rules: Object.assign({}, this.rules), round: this.round, evn: this.evn,
        seats: this.seats.map(p => p && { name: p.name, av: p.av | 0, bot: !!p.bot, lv: p.lv | 0, conn: p.conn !== false, auto: !!p.auto, score: p.score | 0, wins: p.wins | 0, g: p.g === 'm' ? 'm' : 'f' }) };
      if (!R) return v;
      const end = R.phase === 'end', setup = R.phase === 'setup';
      const tv = (t, see) => { const x = { u: t.u, c: colorOf(t.id), open: !!t.open }; if (see) x.v = valOf(t.id); if (t.bad.length) x.bad = t.bad.slice(); if (t.by != null) x.by = t.by; return x; };
      const pool = [0, 0]; for (const t of R.pool) pool[colorOf(t.id)]++;
      v.R = {
        no: R.no, ps: R.ps.slice(), phase: R.phase, cur: R.cur, stage: R.stage, out: R.out.slice(), win: R.win, turns: R.turns, hand: R.hand, first: R.first,
        rank: R.rank && R.rank.slice(), pts: R.pts && R.pts.slice(), pool, st: R.st.map(x => x && Object.assign({}, x)),
        // while the tiles are being arranged nobody sees anyone else's row: its length or order would tell who holds a key
        rows: R.rows.map((row, o) => row && (setup && o !== s ? null : row.map(t => tv(t, end || t.open || o === s)))),
        hold: R.hold ? tv(R.hold, end || R.cur === s) : null,
        setup: setup ? R.setup[s].map(t => tv(t, true)) : [],
        ev: R.ev.slice(-30).map(e => Object.assign({}, e)),
      };
      const o = this.options(s);
      if (o) v.opt = o;
      return v;
    }
    options(s) {
      const R = this.R;
      if (!R || R.phase === 'end') return null;
      if (R.phase === 'setup') return R.setup[s] && R.setup[s].length ? { k: 'place', slots: slotsFor(rowIds(R.rows[s]), R.setup[s][0].id) } : null;
      if (s !== R.cur) return null;
      if (R.stage === 'draw') { const c = [0, 0]; for (const t of R.pool) c[colorOf(t.id)]++; return { k: 'draw', c }; }
      if (R.stage === 'guess') return { k: 'guess' };
      if (R.stage === 'decide') return { k: 'decide', slots: R.hold ? slotsFor(rowIds(R.rows[s]), R.hold.id) : [] };
      if (R.stage === 'reveal') return { k: 'reveal' };
      return null;
    }

    toJSON() { return { rules: this.rules, seats: this.seats, R: this.R, evn: this.evn, round: this.round, first: this.first }; }
    static fromJSON(o, rnd) {
      const T = new Table({ rules: o && o.rules, rnd });
      if (!o) return T;
      T.seats = Array.isArray(o.seats) ? o.seats.slice(0, 4).concat([null, null, null, null]).slice(0, 4) : T.seats;
      T.R = o.R || null; T.evn = o.evn | 0; T.round = o.round | 0; T.first = o.first == null ? -1 : o.first | 0;
      return T;
    }
  }

  const CX = { JK, KEY, NT, colorOf, valOf, idOf, isKey, DEFAULT_RULES, TIMERS, cleanRules, handSize, slotsFor, Table, cryptoRand, seeded, shuffle, randInt };
  G.CX = CX;
  if (typeof module !== 'undefined' && module.exports) module.exports = CX;
})(typeof window !== 'undefined' ? window : globalThis);
