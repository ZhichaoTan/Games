function EngineFactory(isWorker) {
  "use strict";
  // ===== Board geometry (16x16 padded) =====
  var KING = 0, ADVISOR = 1, BISHOP = 2, KNIGHT = 3, ROOK = 4, CANNON = 5, PAWN = 6;
  var IN_BOARD = new Uint8Array(256), IN_FORT = new Uint8Array(256), BOARD_SQS = [];
  for (var r = 3; r <= 12; r++) for (var f = 3; f <= 11; f++) {
    IN_BOARD[r * 16 + f] = 1; BOARD_SQS.push(r * 16 + f);
    if ((r <= 5 || r >= 10) && f >= 6 && f <= 8) IN_FORT[r * 16 + f] = 1;
  }
  var KING_DELTA = [-16, -1, 1, 16], ADVISOR_DELTA = [-17, -15, 15, 17];
  var KNIGHT_DELTA = [[-33, -31], [-18, 14], [-14, 18], [31, 33]];
  var KNIGHT_CHECK_DELTA = [[-33, -18], [-31, -14], [14, 31], [18, 33]];
  var MVV = [50, 10, 10, 30, 40, 30, 2];

  function SIDE_TAG(sd) { return 8 + (sd << 3); }
  function OPP_SIDE_TAG(sd) { return 16 - (sd << 3); }
  function SQ_FORWARD(sq, sd) { return sq - 16 + (sd << 5); }
  function HOME_HALF(sq, sd) { return (sq & 0x80) != (sd << 7); }
  function AWAY_HALF(sq, sd) { return (sq & 0x80) == (sd << 7); }
  function SRC(mv) { return mv & 255; }
  function DST(mv) { return mv >> 8; }
  function MOVE(s, d) { return s + (d << 8); }
  function FLIP(sq) { return 254 - sq; }

  // ===== Evaluation tables (red view, row 0 = top / black back rank) =====
  var BASE = [0, 120, 120, 400, 900, 450, 30];
  var PST = [
    [ // king
      0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
      0,0,0,-9,-12,-9,0,0,0, 0,0,0,-4,-6,-4,0,0,0, 0,0,0,4,10,4,0,0,0],
    [ // advisor
      0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0, 0,0,0,0,6,0,0,0,0, 0,0,0,2,0,2,0,0,0],
    [ // bishop
      0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,
      0,0,-2,0,0,0,-2,0,0, 0,0,0,0,0,0,0,0,0,
      -4,0,0,0,8,0,0,0,-4, 0,0,0,0,0,0,0,0,0, 0,0,2,0,0,0,2,0,0],
    [ // knight
      4,8,16,12,4,12,16,8,4, 4,10,28,16,8,16,28,10,4, 12,14,16,20,18,20,16,14,12,
      8,24,18,24,20,24,18,24,8, 6,16,14,18,16,18,14,16,6, 4,12,16,14,12,14,16,12,4,
      2,6,8,6,10,6,8,6,2, 4,2,8,8,4,8,8,2,4, 0,2,4,4,-2,4,4,2,0, 0,-4,0,0,0,0,0,-4,0],
    [ // rook
      14,14,12,18,16,18,12,14,14, 16,20,18,24,26,24,18,20,16, 12,12,12,18,18,18,12,12,12,
      12,18,16,22,22,22,16,18,12, 12,14,12,18,18,18,12,14,12, 12,16,14,20,20,20,14,16,12,
      6,10,8,14,14,14,8,10,6, 4,8,6,14,12,14,6,8,4, 8,4,8,16,8,16,8,4,8, -2,10,6,14,12,14,6,10,-2],
    [ // cannon
      6,4,0,-10,-12,-10,0,4,6, 2,2,0,-4,-14,-4,0,2,2, 2,2,0,-10,-8,-10,0,2,2,
      0,0,-2,4,10,4,-2,0,0, 0,0,0,2,8,2,0,0,0, -2,0,4,2,6,2,4,0,-2,
      0,0,0,2,4,2,0,0,0, 4,0,8,6,10,6,8,0,4, 0,2,4,6,6,6,4,2,0, 0,0,2,6,6,6,2,0,0],
    [ // pawn
      0,3,6,9,12,9,6,3,0, 38,56,76,100,140,100,76,56,38, 34,46,62,80,100,80,62,46,34,
      30,40,50,54,60,54,50,40,30, 26,32,38,38,40,38,38,32,26, 0,0,-2,0,6,0,-2,0,0,
      0,0,-2,0,3,0,-2,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0]
  ];
  var VL = []; // VL[pc][sq]
  for (var pc = 0; pc < 24; pc++) VL.push(new Int16Array(256));
  BOARD_SQS.forEach(function (sq) {
    var row = (sq >> 4) - 3, col = (sq & 15) - 3;
    for (var t = 0; t < 7; t++) {
      var v = BASE[t] + PST[t][row * 9 + col];
      VL[8 + t][sq] = v; VL[16 + t][FLIP(sq)] = v;
    }
  });

  // ===== Zobrist =====
  var seed = 0x9E3779B9;
  function rnd32() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  var ZKEY = [], ZLOCK = [];
  for (var p2 = 0; p2 < 24; p2++) { var a = new Int32Array(256), b = new Int32Array(256); for (var s2 = 0; s2 < 256; s2++) { a[s2] = rnd32(); b[s2] = rnd32(); } ZKEY.push(a); ZLOCK.push(b); }
  var ZPLAYER_KEY = rnd32(), ZPLAYER_LOCK = rnd32();

  var MATE = 10000, BAN = MATE - 100, WIN = MATE - 200, DRAW = 20, LIMIT_DEPTH = 64;

  // ===== Position =====
  function Position() { this.clear(); }
  Position.prototype.clear = function () {
    this.sq = new Uint8Array(256); this.sd = 0; this.vlRed = 0; this.vlBlack = 0;
    this.key = 0; this.lock = 0; this.kingSq = [0, 0]; this.distance = 0;
    this.mvList = [0]; this.pcList = [0]; this.keyList = [0]; this.chkList = [false];
  };
  Position.prototype.addPiece = function (s, pc, del) {
    this.sq[s] = del ? 0 : pc;
    if (pc < 16) { if (del) this.vlRed -= VL[pc][s]; else this.vlRed += VL[pc][s]; }
    else { if (del) this.vlBlack -= VL[pc][s]; else this.vlBlack += VL[pc][s]; }
    this.key ^= ZKEY[pc][s]; this.lock ^= ZLOCK[pc][s];
    if (!del && (pc & 7) == KING) this.kingSq[pc < 16 ? 0 : 1] = s;
  };
  Position.prototype.startpos = function () {
    this.clear();
    var back = [ROOK, KNIGHT, BISHOP, ADVISOR, KING, ADVISOR, BISHOP, KNIGHT, ROOK];
    for (var i = 0; i < 9; i++) { this.addPiece(12 * 16 + 3 + i, 8 + back[i]); this.addPiece(3 * 16 + 3 + i, 16 + back[i]); }
    var self = this;
    [4, 10].forEach(function (f) { self.addPiece(10 * 16 + f, 8 + CANNON); self.addPiece(5 * 16 + f, 16 + CANNON); });
    [3, 5, 7, 9, 11].forEach(function (f) { self.addPiece(9 * 16 + f, 8 + PAWN); self.addPiece(6 * 16 + f, 16 + PAWN); });
    this.chkList[0] = this.checked();
  };
  Position.prototype.evaluate = function () {
    var v = this.vlRed - this.vlBlack + this.positional();
    return (this.sd == 0 ? v : -v) + 3;
  };
  // structural terms the piece-square tables cannot see (red-minus-black)
  var EV_ATT = [0, 0, 0, 1, 2, 1, 0];
  Position.prototype.positional = function () {
    var sqs = this.sq, att = [0, 0], adv = [0, 0], bis = [0, 0], pawnX = [0, 0], big = 0, out = [0, 0];
    var cann = [], rooks = [], kn = [], n, s, pc, sd, t;
    for (n = 0; n < 90; n++) {
      s = BOARD_SQS[n]; pc = sqs[s]; if (!pc) continue;
      sd = pc >> 4 == 1 ? 1 : 0; t = pc & 7;
      if (t == ADVISOR) adv[sd]++; else if (t == BISHOP) bis[sd]++;
      else if (t == PAWN) { if (AWAY_HALF(s, sd)) { pawnX[sd]++; att[sd]++; } }
      else if (t != KING) {
        att[sd] += EV_ATT[t]; big += t == ROOK ? 6 : 3;
        if (t == CANNON) cann.push(s, sd); else if (t == ROOK) rooks.push(s, sd); else kn.push(s, sd);
      }
    }
    var phase = big > 36 ? 1 : big / 36;
    for (sd = 0; sd < 2; sd++) {
      var a = att[1 - sd];
      // advisors and bishops matter in proportion to the attackers facing them
      out[sd] += adv[sd] * (5 * a - 16) + bis[sd] * (4 * a - 14);
      // crossed pawns grow stronger as the board empties
      out[sd] += pawnX[sd] * Math.round(28 * (1 - phase));
    }
    var i, d, dl, k, cnt, ks;
    for (i = 0; i < cann.length; i += 2) {
      s = cann[i]; sd = cann[i + 1]; ks = this.kingSq[1 - sd];
      if ((s & 15) == (ks & 15)) { // cannon on the enemy king's file
        dl = s < ks ? 16 : -16; cnt = 0;
        for (d = s + dl; d != ks; d += dl) if (sqs[d]) cnt++;
        if (cnt == 0) out[sd] += 50 + 10 * att[sd]; else if (cnt == 1) out[sd] += 12;
      }
    }
    for (i = 0; i < rooks.length; i += 2) {
      s = rooks[i]; sd = rooks[i + 1]; cnt = 0;
      for (k = 0; k < 4; k++) { dl = KING_DELTA[k]; d = s + dl; while (IN_BOARD[d] && !sqs[d]) { cnt++; d += dl; } }
      out[sd] += 2 * cnt - 8;
    }
    for (i = 0; i < kn.length; i += 2) {
      s = kn[i]; sd = kn[i + 1]; cnt = 0;
      for (k = 0; k < 4; k++) { if (sqs[s + KING_DELTA[k]]) continue;
        for (var j = 0; j < 2; j++) { d = s + KNIGHT_DELTA[k][j]; if (IN_BOARD[d] && !(sqs[d] && (sqs[d] >> 4 == 1 ? 1 : 0) == sd)) cnt++; } }
      out[sd] += cnt <= 1 ? -18 : 3 * cnt - 9;
    }
    return out[0] - out[1];
  };
  Position.prototype.material = function (sd) { return sd == 0 ? this.vlRed : this.vlBlack; };
  Position.prototype.changeSide = function () { this.sd = 1 - this.sd; this.key ^= ZPLAYER_KEY; this.lock ^= ZPLAYER_LOCK; };
  Position.prototype.movePiece = function (mv) {
    var s = SRC(mv), d = DST(mv), cap = this.sq[d];
    if (cap) this.addPiece(d, cap, true);
    var pc = this.sq[s]; this.addPiece(s, pc, true); this.addPiece(d, pc);
    this.pcList.push(cap); this.mvList.push(mv);
  };
  Position.prototype.undoMovePiece = function () {
    var mv = this.mvList.pop(), cap = this.pcList.pop(), s = SRC(mv), d = DST(mv);
    var pc = this.sq[d]; this.addPiece(d, pc, true); this.addPiece(s, pc);
    if (cap) this.addPiece(d, cap);
  };
  Position.prototype.makeMove = function (mv) {
    var k = this.key;
    this.movePiece(mv);
    if (this.checked()) { this.undoMovePiece(); return false; }
    this.keyList.push(k); this.changeSide(); this.chkList.push(this.checked()); this.distance++;
    return true;
  };
  Position.prototype.undoMakeMove = function () {
    this.distance--; this.chkList.pop(); this.changeSide(); this.keyList.pop(); this.undoMovePiece();
  };
  Position.prototype.nullMove = function () {
    this.mvList.push(0); this.pcList.push(0); this.keyList.push(this.key); this.changeSide(); this.chkList.push(false); this.distance++;
  };
  Position.prototype.undoNullMove = function () {
    this.distance--; this.chkList.pop(); this.changeSide(); this.keyList.pop(); this.pcList.pop(); this.mvList.pop();
  };
  Position.prototype.inCheck = function () { return this.chkList[this.chkList.length - 1]; };
  Position.prototype.captured = function () { return this.pcList[this.pcList.length - 1] != 0; };
  Position.prototype.checked = function () {
    var sd = this.sd, s = this.kingSq[sd], opp = OPP_SIDE_TAG(sd), sqs = this.sq;
    if (sqs[s] != SIDE_TAG(sd) + KING) return false;
    if (sqs[SQ_FORWARD(s, sd)] == opp + PAWN || sqs[s - 1] == opp + PAWN || sqs[s + 1] == opp + PAWN) return true;
    for (var i = 0; i < 4; i++) {
      if (sqs[s + ADVISOR_DELTA[i]] != 0) continue;
      for (var j = 0; j < 2; j++) if (sqs[s + KNIGHT_CHECK_DELTA[i][j]] == opp + KNIGHT) return true;
    }
    for (i = 0; i < 4; i++) {
      var dl = KING_DELTA[i], d = s + dl;
      while (IN_BOARD[d]) { var pc = sqs[d]; if (pc) { if (pc == opp + ROOK || pc == opp + KING) return true; break; } d += dl; }
      d += dl;
      while (IN_BOARD[d]) { pc = sqs[d]; if (pc) { if (pc == opp + CANNON) return true; break; } d += dl; }
    }
    return false;
  };
  Position.prototype.generate = function (capOnly) {
    var mvs = [], sd = this.sd, self = SIDE_TAG(sd), opp = OPP_SIDE_TAG(sd), sqs = this.sq;
    for (var n = 0; n < 90; n++) {
      var s = BOARD_SQS[n], pc = sqs[s];
      if ((pc & self) == 0) continue;
      var i, j, d, pd, dl;
      switch (pc - self) {
        case KING:
          for (i = 0; i < 4; i++) { d = s + KING_DELTA[i]; if (!IN_FORT[d]) continue; pd = sqs[d];
            if (capOnly ? (pd & opp) : !(pd & self)) mvs.push(MOVE(s, d)); }
          break;
        case ADVISOR:
          for (i = 0; i < 4; i++) { d = s + ADVISOR_DELTA[i]; if (!IN_FORT[d]) continue; pd = sqs[d];
            if (capOnly ? (pd & opp) : !(pd & self)) mvs.push(MOVE(s, d)); }
          break;
        case BISHOP:
          for (i = 0; i < 4; i++) { d = s + ADVISOR_DELTA[i]; if (!(IN_BOARD[d] && HOME_HALF(d, sd) && sqs[d] == 0)) continue;
            d += ADVISOR_DELTA[i]; pd = sqs[d]; if (capOnly ? (pd & opp) : !(pd & self)) mvs.push(MOVE(s, d)); }
          break;
        case KNIGHT:
          for (i = 0; i < 4; i++) { if (sqs[s + KING_DELTA[i]]) continue;
            for (j = 0; j < 2; j++) { d = s + KNIGHT_DELTA[i][j]; if (!IN_BOARD[d]) continue; pd = sqs[d];
              if (capOnly ? (pd & opp) : !(pd & self)) mvs.push(MOVE(s, d)); } }
          break;
        case ROOK:
          for (i = 0; i < 4; i++) { dl = KING_DELTA[i]; d = s + dl;
            while (IN_BOARD[d]) { pd = sqs[d]; if (pd == 0) { if (!capOnly) mvs.push(MOVE(s, d)); } else { if (pd & opp) mvs.push(MOVE(s, d)); break; } d += dl; } }
          break;
        case CANNON:
          for (i = 0; i < 4; i++) { dl = KING_DELTA[i]; d = s + dl;
            while (IN_BOARD[d]) { pd = sqs[d]; if (pd == 0) { if (!capOnly) mvs.push(MOVE(s, d)); } else break; d += dl; }
            d += dl;
            while (IN_BOARD[d]) { pd = sqs[d]; if (pd) { if (pd & opp) mvs.push(MOVE(s, d)); break; } d += dl; } }
          break;
        case PAWN:
          d = SQ_FORWARD(s, sd);
          if (IN_BOARD[d]) { pd = sqs[d]; if (capOnly ? (pd & opp) : !(pd & self)) mvs.push(MOVE(s, d)); }
          if (AWAY_HALF(s, sd)) for (dl = -1; dl <= 1; dl += 2) { d = s + dl;
            if (IN_BOARD[d]) { pd = sqs[d]; if (capOnly ? (pd & opp) : !(pd & self)) mvs.push(MOVE(s, d)); } }
          break;
      }
    }
    return mvs;
  };
  Position.prototype.legalMoves = function () {
    var out = [], mvs = this.generate(false);
    for (var i = 0; i < mvs.length; i++) if (this.makeMove(mvs[i])) { this.undoMakeMove(); out.push(mvs[i]); }
    return out;
  };
  Position.prototype.isMate = function () { return this.legalMoves().length == 0; };
  Position.prototype.repStatus = function (recur) {
    var selfSide = false, perp = true, oppPerp = true, idx = this.mvList.length - 1;
    while (this.mvList[idx] > 0 && this.pcList[idx] == 0) {
      if (selfSide) {
        perp = perp && this.chkList[idx];
        if (this.keyList[idx] == this.key) { recur--; if (recur == 0) return 1 + (perp ? 2 : 0) + (oppPerp ? 4 : 0); }
      } else oppPerp = oppPerp && this.chkList[idx];
      selfSide = !selfSide; idx--;
    }
    return 0;
  };
  Position.prototype.drawValue = function () { return (this.distance & 1) == 0 ? -DRAW : DRAW; };
  Position.prototype.repValue = function (rep) {
    var ban = this.distance - BAN;
    var v = ((rep & 2) ? ban : 0) + ((rep & 4) ? -ban : 0);
    return v == 0 ? this.drawValue() : v;
  };
  Position.prototype.fromMoves = function (moves) {
    this.startpos();
    for (var i = 0; i < moves.length; i++) if (!this.makeMove(moves[i])) throw new Error("illegal move in history " + i);
    this.distance = 0;
  };
  Position.prototype.clone = function () {
    var p = new Position();
    p.sq.set(this.sq); p.sd = this.sd; p.vlRed = this.vlRed; p.vlBlack = this.vlBlack; p.key = this.key; p.lock = this.lock;
    p.kingSq = this.kingSq.slice(); p.distance = this.distance; p.mvList = this.mvList.slice(); p.pcList = this.pcList.slice();
    p.keyList = this.keyList.slice(); p.chkList = this.chkList.slice();
    return p;
  };
  // insufficient material: neither side has attacking units
  Position.prototype.noAttackers = function () {
    for (var n = 0; n < 90; n++) { var t = this.sq[BOARD_SQS[n]] & 7, pc = this.sq[BOARD_SQS[n]]; if (pc && (t == ROOK || t == KNIGHT || t == CANNON || t == PAWN)) return false; }
    return true;
  };

  // ===== Opening book =====
  function iccs(str) { // "h2e2" -> mv
    var sf = str.charCodeAt(0) - 97, sr = +str[1], df = str.charCodeAt(2) - 97, dr = +str[3];
    return MOVE((9 - sr + 3) * 16 + sf + 3, (9 - dr + 3) * 16 + df + 3);
  }
  var BOOK_LINES = [
    "h2e2 h9g7 h0g2 i9h9 i0h0 b9c7 b0c2 b7a7", "h2e2 h9g7 h0g2 g6g5 i0h0 i9h9 b0c2 b9c7",
    "h2e2 b9c7 h0g2 h9g7 i0h0 i9h9", "h2e2 h7e7 h0g2 h9g7 i0h0 i9h9 b0c2 b9c7",
    "h2e2 b7e7 h0g2 b9c7 i0h0", "h2e2 b9c7 h0g2 h7f7 i0h0 h9g7",
    "c0e2 c6c5 b0c2 b9c7", "c0e2 h9g7 h0g2 g6g5", "c0e2 b7e7 b0c2 b9c7",
    "g3g4 h7g7 b0c2 b9c7", "g3g4 c6c5 b0c2 b9c7", "b0c2 h9g7 g3g4 g6g5", "h0g2 h9g7 g3g4 g6g5",
    "b2e2 h9g7 b0c2 i9h9", "h2e2 h9g7"
  ];
  var BOOK = null;
  function buildBook() {
    BOOK = {};
    var p = new Position();
    BOOK_LINES.forEach(function (line) {
      p.startpos();
      line.split(" ").forEach(function (m) {
        var mv = iccs(m), k = p.key + ":" + p.lock;
        if (p.legalMoves().indexOf(mv) < 0) throw new Error("bad book move " + m + " in " + line);
        (BOOK[k] = BOOK[k] || []).push(mv);
        p.makeMove(mv);
      });
    });
  }
  function bookMove(pos) {
    if (!BOOK) buildBook();
    var list = BOOK[pos.key + ":" + pos.lock];
    if (!list || !list.length) return 0;
    var mv = list[Math.floor(Math.random() * list.length)];
    return pos.legalMoves().indexOf(mv) >= 0 ? mv : 0;
  }

  // ===== Search =====
  var HASH_BITS = 20, HASH_SIZE = 1 << HASH_BITS, HASH_MASK = HASH_SIZE - 1;
  var HASH_ALPHA = 1, HASH_BETA = 2, HASH_PV = 3;
  function Search(pos) {
    this.pos = pos;
    this.hLock = new Int32Array(HASH_SIZE); this.hDepth = new Int8Array(HASH_SIZE); this.hFlag = new Uint8Array(HASH_SIZE);
    this.hVl = new Int16Array(HASH_SIZE); this.hMv = new Uint16Array(HASH_SIZE); this.hUsed = new Uint8Array(HASH_SIZE); this.age = 1;
    this.history = new Int32Array(65536); this.killers = [];
  }
  Search.prototype.resetTables = function () {
    // the hash survives between moves (entries carry a search age); history is only damped
    this.age = this.age >= 250 ? 1 : this.age + 1; if (this.age == 1) this.hUsed.fill(0);
    for (var h = 0; h < 65536; h++) this.history[h] >>= 3;
    this.killers = [];
    for (var i = 0; i < LIMIT_DEPTH + 2; i++) this.killers.push([0, 0]);
  };
  Search.prototype.probeHash = function (alpha, beta, depth) {
    var p = this.pos, i = p.key & HASH_MASK;
    this.hashMv = 0;
    if (!this.hUsed[i] || this.hLock[i] != p.lock) return -MATE;
    this.hashMv = this.hMv[i];
    var vl = this.hVl[i], mate = false;
    if (vl > WIN) { if (vl <= BAN) return -MATE; vl -= p.distance; mate = true; }
    else if (vl < -WIN) { if (vl >= -BAN) return -MATE; vl += p.distance; mate = true; }
    if (this.hDepth[i] >= depth || mate) {
      var fl = this.hFlag[i];
      if (fl == HASH_BETA) return vl >= beta ? vl : -MATE;
      if (fl == HASH_ALPHA) return vl <= alpha ? vl : -MATE;
      return vl;
    }
    return -MATE;
  };
  Search.prototype.recordHash = function (flag, vl, depth, mv) {
    var p = this.pos, i = p.key & HASH_MASK;
    if (this.hUsed[i] == this.age && this.hDepth[i] > depth && this.hLock[i] == p.lock && mv == 0) return;
    if (vl > WIN) { if (mv == 0 && vl <= BAN) return; vl += p.distance; }
    else if (vl < -WIN) { if (mv == 0 && vl >= -BAN) return; vl -= p.distance; }
    this.hUsed[i] = this.age; this.hLock[i] = p.lock; this.hDepth[i] = depth; this.hFlag[i] = flag; this.hVl[i] = vl; this.hMv[i] = mv;
  };
  Search.prototype.timeUp = function () {
    if ((++this.nodes & 2047) == 0 && Date.now() > this.deadline) this.stopped = true;
    return this.stopped;
  };
  Search.prototype.quiesc = function (alpha, beta) {
    var p = this.pos;
    if (this.timeUp()) return 0;
    var rep = p.repStatus(1); if (rep) return p.repValue(rep);
    if (p.distance >= LIMIT_DEPTH) return p.evaluate();
    var best = -MATE, mvs, i, n, vl, sc = [];
    if (p.inCheck()) {
      mvs = p.generate(false);
      for (i = 0; i < mvs.length; i++) sc.push(this.history[mvs[i]]);
    } else {
      vl = p.evaluate();
      if (vl > best) { if (vl >= beta) return vl; best = vl; if (vl > alpha) alpha = vl; }
      mvs = p.generate(true);
      for (i = 0; i < mvs.length; i++) sc.push(MVV[p.sq[DST(mvs[i])] & 7] * 8 - MVV[p.sq[SRC(mvs[i])] & 7]);
    }
    for (n = 0; n < mvs.length; n++) {
      var bi = n; for (i = n + 1; i < mvs.length; i++) if (sc[i] > sc[bi]) bi = i;
      var t = mvs[n]; mvs[n] = mvs[bi]; mvs[bi] = t; t = sc[n]; sc[n] = sc[bi]; sc[bi] = t;
      if (best > -MATE && !p.inCheck() && best + BASE[p.sq[DST(mvs[n])] & 7] + 160 <= alpha) continue;
      if (!p.makeMove(mvs[n])) continue;
      vl = -this.quiesc(-beta, -alpha);
      p.undoMakeMove();
      if (this.stopped) return 0;
      if (vl > best) { if (vl >= beta) return vl; best = vl; if (vl > alpha) alpha = vl; }
    }
    return best == -MATE ? p.distance - MATE : best;
  };
  Search.prototype.searchFull = function (alpha, beta, depth, noNull) {
    var p = this.pos;
    if (p.distance > 0) {
      if (depth <= 0) return this.quiesc(alpha, beta);
      if (this.timeUp()) return 0;
      var rep = p.repStatus(1); if (rep) return p.repValue(rep);
      var mateVl = p.distance - MATE; if (mateVl >= beta) return mateVl;
      var hv = this.probeHash(alpha, beta, depth);
      if (hv > -MATE) return hv;
      if (p.distance >= LIMIT_DEPTH) return p.evaluate();
      if (!noNull && !p.inCheck() && p.material(p.sd) > 1300) {
        p.nullMove();
        var nv = -this.searchFull(-beta, 1 - beta, depth - (depth >= 7 ? 4 : 3), true);
        p.undoNullMove();
        if (this.stopped) return 0;
        if (nv >= beta) return nv;
      }
    } else this.probeHash(alpha, beta, depth);
    var hashMv = this.hashMv, killer = this.killers[p.distance] || [0, 0];
    var mvs = p.generate(false), sc = new Array(mvs.length), i, n;
    for (i = 0; i < mvs.length; i++) {
      var mv = mvs[i], cap = p.sq[DST(mv)];
      if (mv == hashMv) sc[i] = 1 << 30;
      else if (cap) sc[i] = (1 << 29) + MVV[cap & 7] * 8 - MVV[p.sq[SRC(mv)] & 7];
      else if (mv == killer[0]) sc[i] = (1 << 28) + 2;
      else if (mv == killer[1]) sc[i] = (1 << 28) + 1;
      else sc[i] = this.history[mv];
    }
    var best = -MATE, mvBest = 0, flag = HASH_ALPHA, legal = 0;
    var inChk = p.inCheck(), futile = p.distance > 0 && !inChk && depth <= 2 && alpha > -WIN && beta < WIN && p.evaluate() + (depth == 1 ? 120 : 260) <= alpha;
    for (n = 0; n < mvs.length; n++) {
      var bi = n; for (i = n + 1; i < mvs.length; i++) if (sc[i] > sc[bi]) bi = i;
      var t = mvs[n]; mvs[n] = mvs[bi]; mvs[bi] = t; t = sc[n]; sc[n] = sc[bi]; sc[bi] = t;
      mv = mvs[n];
      if (!p.makeMove(mv)) continue;
      legal++;
      if (futile && legal > 1 && !p.captured() && !p.inCheck()) { p.undoMakeMove(); continue; }
      var nd = p.inCheck() ? depth : depth - 1, vl;
      if (best == -MATE) vl = -this.searchFull(-beta, -alpha, nd, false);
      else {
        // light late-move reduction for quiet, late moves
        var red = (nd >= 2 && legal > 3 && !inChk && !p.captured() && !p.inCheck() && sc[n] < (1 << 28)) ? (legal > 12 && nd >= 5 ? 2 : 1) : 0;
        vl = -this.searchFull(-alpha - 1, -alpha, nd - red, false);
        if (vl > alpha && red) vl = -this.searchFull(-alpha - 1, -alpha, nd, false);
        if (vl > alpha && vl < beta) vl = -this.searchFull(-beta, -alpha, nd, false);
      }
      p.undoMakeMove();
      if (this.stopped) return 0;
      if (vl > best) {
        best = vl;
        if (vl >= beta) { flag = HASH_BETA; mvBest = mv; break; }
        if (vl > alpha) { flag = HASH_PV; mvBest = mv; alpha = vl; }
      }
    }
    if (best == -MATE) return p.distance - MATE;
    this.recordHash(flag, best, depth, mvBest);
    if (mvBest && !p.sq[DST(mvBest)]) {
      this.history[mvBest] += depth * depth;
      var k = this.killers[p.distance];
      if (k && k[0] != mvBest) { k[1] = k[0]; k[0] = mvBest; }
    }
    if (p.distance == 0 && mvBest) this.rootBest = mvBest;
    return best;
  };
  Search.prototype.pv = function (first, maxLen) {
    var p = this.pos, line = [], made = 0, seen = {};
    var mv = first;
    while (mv && line.length < maxLen) {
      if (p.legalMoves().indexOf(mv) < 0) break;
      p.makeMove(mv); made++; line.push(mv);
      var k = p.key + ":" + p.lock; if (seen[k]) break; seen[k] = 1;
      var i = p.key & HASH_MASK;
      mv = (this.hUsed[i] && this.hLock[i] == p.lock) ? this.hMv[i] : 0;
    }
    while (made--) p.undoMakeMove();
    return line;
  };
  // Root search returning scores for every legal move (used for weak levels)
  Search.prototype.rootScores = function (depth) {
    var p = this.pos, out = [], mvs = p.legalMoves();
    for (var i = 0; i < mvs.length; i++) {
      p.makeMove(mvs[i]);
      var vl = -this.searchFull(-MATE, MATE, depth - 1, false);
      p.undoMakeMove();
      out.push({ mv: mvs[i], vl: vl });
    }
    return out;
  };
  Search.prototype.think = function (opt) {
    // opt: {maxDepth, timeMs}
    var p = this.pos;
    this.resetTables(); this.nodes = 0; this.stopped = false; this.rootBest = 0;
    this.deadline = Date.now() + (opt.timeMs || 1e9);
    var legal = p.legalMoves();
    if (!legal.length) return { mv: 0, vl: p.distance - MATE, depth: 0, pv: [] };
    var bestMv = legal[0], bestVl = 0, depthDone = 0, maxD = opt.maxDepth || 40;
    for (var d = 1; d <= maxD; d++) {
      this.rootBest = 0;
      var vl;
      if (d >= 4 && bestVl > -WIN && bestVl < WIN) {
        var lo = bestVl - 40, hi = bestVl + 40;
        for (;;) {
          vl = this.searchFull(lo, hi, d, false);
          if (this.stopped) break;
          if (vl <= lo) lo = Math.max(-MATE, lo - (hi - lo) * 2); else if (vl >= hi) hi = Math.min(MATE, hi + (hi - lo) * 2); else break;
        }
      } else vl = this.searchFull(-MATE, MATE, d, false);
      if (this.stopped) { if (this.rootBest && d > 1 && legal.indexOf(this.rootBest) >= 0) bestMv = this.rootBest; break; }
      if (this.rootBest) bestMv = this.rootBest;
      bestVl = vl; depthDone = d;
      if (vl > WIN || vl < -WIN) break; // mate found
      if (opt.timeMs && Date.now() > this.deadline - (opt.timeMs * 0.55)) break; // next iteration unlikely to finish
    }
    if (legal.indexOf(bestMv) < 0) bestMv = legal[0];
    return { mv: bestMv, vl: bestVl, depth: depthDone, pv: this.pv(bestMv, 12), nodes: this.nodes };
  };

  // ===== Levels =====
  var LEVELS = [
    { name: "小白", depth: 1, noise: 220, book: false },
    { name: "菜鸟", depth: 2, noise: 110, book: true },
    { name: "入门", depth: 3, noise: 55, book: true },
    { name: "初级", depth: 4, noise: 22, book: true },
    { name: "中级", time: 700, noise: 0, book: true },
    { name: "高级", time: 1800, noise: 0, book: true },
    { name: "大师", time: 4500, noise: 0, book: true }
  ];
  function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function aiMove(search, level) {
    var L = LEVELS[level], p = search.pos;
    if (L.book && p.mvList.length < 14) { var bm = bookMove(p); if (bm) return { mv: bm, vl: 0, depth: 0, pv: [bm], book: true }; }
    if (L.noise) {
      search.resetTables(); search.nodes = 0; search.stopped = false; search.deadline = Date.now() + 6000;
      // warm up ordering
      for (var d = 1; d < L.depth; d++) search.searchFull(-MATE, MATE, d, false);
      var list = search.rootScores(L.depth);
      if (!list.length) return { mv: 0, vl: p.distance - MATE, pv: [] };
      var bestRaw = -1e9;
      list.forEach(function (e) { if (e.vl > bestRaw) bestRaw = e.vl; });
      var pick = null, pickVl = -1e9;
      list.forEach(function (e) {
        var v = e.vl;
        // never ignore a forced mate for the engine, but weak levels may miss defending
        var noisy = (v > WIN) ? v + 5000 : v + gauss() * L.noise;
        if (noisy > pickVl) { pickVl = noisy; pick = e; }
      });
      return { mv: pick.mv, vl: pick.vl, depth: L.depth, pv: [pick.mv] };
    }
    return search.think({ timeMs: L.time });
  }

  var api = {
    Position: Position, Search: Search, LEVELS: LEVELS, aiMove: aiMove, iccs: iccs, bookMove: bookMove,
    SRC: SRC, DST: DST, MOVE: MOVE, MATE: MATE, WIN: WIN, BAN: BAN, buildBook: buildBook
  };

  if (isWorker) {
    var wpos = new Position(), wsearch = new Search(wpos);
    self.onmessage = function (e) {
      var m = e.data;
      try {
        if (m.type == "ai") {
          wpos.fromMoves(m.moves);
          var r = aiMove(wsearch, m.level);
          self.postMessage({ type: "ai", id: m.id, mv: r.mv, vl: r.vl, pv: r.pv, depth: r.depth });
        } else if (m.type == "analyze") {
          wpos.fromMoves(m.moves);
          var res;
          if (wpos.isMate()) res = { mv: 0, vl: -MATE, pv: [], depth: 0 };
          else res = wsearch.think({ timeMs: m.timeMs, maxDepth: m.maxDepth });
          self.postMessage({ type: "analyze", id: m.id, ply: m.ply, mv: res.mv, vl: res.vl, pv: res.pv, depth: res.depth });
        }
      } catch (err) { self.postMessage({ type: "error", id: m.id, msg: String(err) }); }
    };
  }
  return api;
}
if (typeof module !== "undefined") module.exports = EngineFactory;
