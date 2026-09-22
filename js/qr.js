/* Local QR (byte mode, ECC M) so install codes never depend on a remote image. */
(function (root) {
  'use strict';
  var EXP = [], LOG = [];
  (function () {
    var x = 1, i;
    for (i = 0; i < 256; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }

  function rsPoly(n) {
    var p = [1], i, j, next, a;
    for (i = 0; i < n; i++) {
      a = EXP[i];
      next = [0].concat(p);
      for (j = 0; j < p.length; j++) next[j] ^= mul(p[j], a);
      p = next;
    }
    return p;
  }

  function rsEncode(data, nsym) {
    var gen = rsPoly(nsym);
    var out = data.slice();
    var i, j, coef;
    for (i = 0; i < nsym; i++) out.push(0);
    for (i = 0; i < data.length; i++) {
      coef = out[i];
      if (!coef) continue;
      for (j = 0; j < gen.length; j++) out[i + j] ^= mul(gen[j], coef);
    }
    return out.slice(data.length);
  }

  /* version: [size, dataBytes M, ecPerBlock, group1blocks, group1data, group2blocks, group2data] */
  var VER = {
    1: [21, 16, 10, 1, 16, 0, 0],
    2: [25, 28, 16, 1, 28, 0, 0],
    3: [29, 44, 26, 1, 44, 0, 0],
    4: [33, 64, 18, 2, 32, 0, 0],
    5: [37, 86, 24, 2, 43, 0, 0],
    6: [41, 108, 16, 4, 27, 0, 0],
    7: [45, 124, 18, 4, 31, 0, 0],
    8: [49, 154, 22, 2, 38, 2, 39],
    9: [53, 182, 22, 3, 36, 2, 37],
    10: [57, 216, 26, 4, 43, 1, 44]
  };

  function bitsToBytes(bits) {
    var bytes = [], i, v, b;
    for (i = 0; i < bits.length; i += 8) {
      v = 0;
      for (b = 0; b < 8; b++) v = (v << 1) | (bits[i + b] || 0);
      bytes.push(v);
    }
    return bytes;
  }

  function pushBits(arr, val, n) {
    var i;
    for (i = n - 1; i >= 0; i--) arr.push((val >> i) & 1);
  }

  function encodeData(text, version) {
    var spec = VER[version];
    var cap = spec[1];
    var bytes = [];
    var i;
    for (i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 255);
    var bits = [];
    pushBits(bits, 0x4, 4);
    pushBits(bits, bytes.length, version < 10 ? 8 : 16);
    for (i = 0; i < bytes.length; i++) pushBits(bits, bytes[i], 8);
    var totalBits = cap * 8;
    var remain = totalBits - bits.length;
    if (remain < 0) return null;
    pushBits(bits, 0, Math.min(4, remain));
    while (bits.length % 8) bits.push(0);
    var pad = [0xec, 0x11], p = 0;
    var data = bitsToBytes(bits);
    while (data.length < cap) data.push(pad[p++ % 2]);
    return data;
  }

  function interleave(version, data) {
    var spec = VER[version];
    var ecn = spec[2];
    var g1n = spec[3], g1d = spec[4], g2n = spec[5], g2d = spec[6];
    var blocks = [], i, j, take, block, ec, off = 0;
    for (i = 0; i < g1n; i++) {
      take = data.slice(off, off + g1d); off += g1d;
      ec = rsEncode(take, ecn);
      blocks.push({ d: take, e: ec });
    }
    for (i = 0; i < g2n; i++) {
      take = data.slice(off, off + g2d); off += g2d;
      ec = rsEncode(take, ecn);
      blocks.push({ d: take, e: ec });
    }
    var out = [];
    var maxD = g2n ? Math.max(g1d, g2d) : g1d;
    for (i = 0; i < maxD; i++) {
      for (j = 0; j < blocks.length; j++) if (i < blocks[j].d.length) out.push(blocks[j].d[i]);
    }
    for (i = 0; i < ecn; i++) {
      for (j = 0; j < blocks.length; j++) out.push(blocks[j].e[i]);
    }
    return out;
  }

  function finder(mod, x, y) {
    var r, c, dx, dy, m;
    for (r = -1; r <= 7; r++) {
      for (c = -1; c <= 7; c++) {
        dx = x + c; dy = y + r;
        if (dy < 0 || dx < 0 || dy >= mod.length || dx >= mod.length) continue;
        m = (r >= 0 && r <= 6 && c >= 0 && c <= 6) &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        mod[dy][dx] = m ? 1 : 0;
      }
    }
  }

  function timingAndFinders(mod, reserved) {
    var n = mod.length, i, j;
    finder(mod, 0, 0); finder(mod, n - 7, 0); finder(mod, 0, n - 7);
    for (i = 0; i < 8; i++) {
      for (j = 0; j < 8; j++) {
        reserved[i][j] = 1;
        reserved[i][n - 8 + j] = 1;
        reserved[n - 8 + i][j] = 1;
      }
    }
    for (i = 0; i < n; i++) {
      if (!reserved[6][i]) { mod[6][i] = i % 2 ? 0 : 1; reserved[6][i] = 1; }
      if (!reserved[i][6]) { mod[i][6] = i % 2 ? 0 : 1; reserved[i][6] = 1; }
    }
    reserved[8][8] = 1;
  }

  function alignment(mod, reserved, version) {
    if (version < 2) return;
    var pos = [6], last = VER[version][0] - 7, i, j, x, y, r, c, dx, dy, dark;
    if (version === 2) pos = [6, 18];
    else if (version === 3) pos = [6, 22];
    else if (version === 4) pos = [6, 26];
    else if (version === 5) pos = [6, 30];
    else if (version === 6) pos = [6, 34];
    else if (version === 7) pos = [6, 22, 38];
    else if (version === 8) pos = [6, 24, 42];
    else if (version === 9) pos = [6, 26, 46];
    else pos = [6, 28, 50];
    for (i = 0; i < pos.length; i++) {
      for (j = 0; j < pos.length; j++) {
        x = pos[j]; y = pos[i];
        if ((x < 8 && y < 8) || (x > last && y < 8) || (x < 8 && y > last)) continue;
        for (r = -2; r <= 2; r++) {
          for (c = -2; c <= 2; c++) {
            dx = x + c; dy = y + r;
            dark = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
            mod[dy][dx] = dark ? 1 : 0;
            reserved[dy][dx] = 1;
          }
        }
      }
    }
  }

  function place(mod, reserved, bytes) {
    var n = mod.length, bit = 0, total = bytes.length * 8;
    function bitAt(k) { return (bytes[k >> 3] >> (7 - (k & 7))) & 1; }
    var col, row, up, pair, c, r;
    for (col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      up = ((n - 1 - col) / 2) % 2 === 0;
      for (pair = 0; pair < n; pair++) {
        row = up ? n - 1 - pair : pair;
        for (c = 0; c < 2; c++) {
          r = col - c;
          if (reserved[row][r]) continue;
          mod[row][r] = bit < total ? bitAt(bit) : 0;
          bit++;
        }
      }
    }
  }

  function maskFn(m, r, c) {
    if (m === 0) return (r + c) % 2 === 0;
    if (m === 1) return r % 2 === 0;
    if (m === 2) return c % 3 === 0;
    if (m === 3) return (r + c) % 3 === 0;
    if (m === 4) return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    if (m === 5) return ((r * c) % 2) + ((r * c) % 3) === 0;
    if (m === 6) return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }

  function applyMask(mod, reserved, m) {
    var n = mod.length, r, c, out = [];
    for (r = 0; r < n; r++) {
      out[r] = [];
      for (c = 0; c < n; c++) out[r][c] = reserved[r][c] ? mod[r][c] : (mod[r][c] ^ (maskFn(m, r, c) ? 1 : 0));
    }
    return out;
  }

  function formatBits(mask) {
    var data = (0x00 << 3) | mask;
    var rem = data << 10;
    var gen = 0x537;
    var i;
    for (i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= gen << (i - 10);
    return (data << 10 | rem) ^ 0x5412;
  }

  function drawFormat(mod, bits) {
    var n = mod.length, i;
    for (i = 0; i < 8; i++) {
      mod[8][n - 1 - i] = (bits >> i) & 1;
      mod[i < 6 ? i : i + 1][8] = (bits >> i) & 1;
    }
    for (i = 0; i < 7; i++) {
      mod[n - 7 + i][8] = (bits >> (8 + i)) & 1;
      mod[8][i < 6 ? i : i + 1] = (bits >> (14 - i)) & 1;
    }
    mod[n - 8][8] = 1;
  }

  function score(mod) {
    var n = mod.length, s = 0, r, c, run, k;
    for (r = 0; r < n; r++) {
      run = 1;
      for (c = 1; c < n; c++) {
        if (mod[r][c] === mod[r][c - 1]) run++;
        else { if (run >= 5) s += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) s += 3 + (run - 5);
    }
    for (c = 0; c < n; c++) {
      run = 1;
      for (r = 1; r < n; r++) {
        if (mod[r][c] === mod[r - 1][c]) run++;
        else { if (run >= 5) s += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) s += 3 + (run - 5);
    }
    var dark = 0;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (mod[r][c]) dark++;
    k = Math.abs((dark * 100) / (n * n) - 50) / 5;
    return s + k * 10;
  }

  function build(text) {
    var version, data, bytes, size, mod, reserved, r, c, m, masked, best, bestScore, bits;
    for (version = 2; version <= 10; version++) {
      data = encodeData(text, version);
      if (data) break;
    }
    if (!data) return null;
    bytes = interleave(version, data);
    size = VER[version][0];
    mod = []; reserved = [];
    for (r = 0; r < size; r++) {
      mod[r] = []; reserved[r] = [];
      for (c = 0; c < size; c++) { mod[r][c] = 0; reserved[r][c] = 0; }
    }
    timingAndFinders(mod, reserved);
    alignment(mod, reserved, version);
    for (c = 0; c < 9; c++) { reserved[8][c] = 1; reserved[c][8] = 1; }
    for (c = 0; c < 8; c++) { reserved[8][size - 1 - c] = 1; reserved[size - 1 - c][8] = 1; }
    reserved[size - 8][8] = 1;
    place(mod, reserved, bytes);
    best = null; bestScore = 1e9;
    for (m = 0; m < 8; m++) {
      masked = applyMask(mod, reserved, m);
      bits = formatBits(m);
      drawFormat(masked, bits);
      var sc = score(masked);
      if (sc < bestScore) { bestScore = sc; best = masked; }
    }
    return best;
  }

  function toSvg(text, px) {
    var grid = build(String(text || ''));
    if (!grid) return '';
    px = px || 196;
    var n = grid.length, m = 2, i, j, d = '';
    var s = px / (n + m * 2);
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        if (grid[i][j]) d += 'M' + (j + m) + ',' + (i + m) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + m * 2) + ' ' + (n + m * 2) +
      '" width="' + px + '" height="' + px + '" shape-rendering="crispEdges" aria-label="QR code">' +
      '<rect width="100%" height="100%" fill="#fff"/>' +
      '<path fill="#0d0f0c" d="' + d + '"/></svg>';
  }

  root.GOO = root.GOO || {};
  root.GOO.qrSvg = toSvg;
})(window);
