/*! song.js — 🎵 노래 쇼츠 도우미 (BK에딧 쇼츠 만들기)
 *  ✂️ 노래 구간: 🎶 전체 곡 · 🎯 하이라이트(30 · 45 · 60초 자동 찾기) · ⏱ 3분까지 · 🎼 플레이리스트에서 한 곡 (조용한 틈으로 나누기)
 *  📊 노래에 맞춰 움직이는 막대 (막대 · 물결 · 동그라미 · 대칭 / 무지개 · 네온 · 흰색 · 금색) — 미리보기 · MP4 모두
 *  📌 위 큰 제목 (2줄 · 검은 띠 또는 사진 위 글씨)
 *  모든 계산은 휴대폰 안에서만 해요. */
(function (g) {
'use strict';
const ED = g.ED, { clamp, SRC } = ED;
const fmt = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ═════════ 소리 세기 (0.1초마다) ═════════ */
function rmsTrack(buf, step) {
  step = step || .1; const sr = buf.sampleRate, n = Math.floor(buf.duration / step), hop = Math.floor(sr * step), out = new Float32Array(n);
  const ch = []; for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) ch.push(buf.getChannelData(c));
  for (let i = 0; i < n; i++) { let s = 0; const a = i * hop; for (let k = 0; k < hop; k += 4) { let v = 0; for (const d of ch) v += d[a + k] || 0; v /= ch.length; s += v * v; } out[i] = Math.sqrt(s / (hop / 4)); }
  return out;
}
/** 🎯 하이라이트: 가장 소리가 크고 꽉 찬 구간 (보통 후렴) — 시작은 바로 앞 조용한 곳으로 살짝 당겨요 */
function highlight(buf, len) {
  const R = rmsTrack(buf, .1), n = R.length, w = Math.round(len / .1); if (n <= w + 60) return 0;
  const pre = new Float64Array(n + 1); for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + R[i];
  let best = -1, at = 0; const lo = 50, hi = n - w - 30;   // 앞 5초 · 끝 3초는 피하기
  for (let s = lo; s <= hi; s++) { const m = (pre[s + w] - pre[s]) / w; if (m > best) { best = m; at = s; } }
  let q = at, qm = Infinity; for (let s = Math.max(lo, at - 30); s <= at; s++) { if (R[s] < qm) { qm = R[s]; q = s; } }   // 3초 안에서 숨 쉬는 곳
  return q * .1;
}
/** 🎼 플레이리스트 나누기: 1.2초 넘게 조용한 틈으로 곡을 나눠요 (30초 넘는 곡만) */
function splitSongs(buf) {
  const R = rmsTrack(buf, .1), n = R.length, sorted = Array.from(R).sort((a, b) => a - b), med = sorted[Math.floor(n / 2)] || .05, th = Math.max(.004, med * .08);
  const cuts = []; let run = 0;
  for (let i = 0; i < n; i++) { if (R[i] < th) run++; else { if (run >= 12) cuts.push((i - run / 2) * .1); run = 0; } }
  const pts = [0].concat(cuts, [buf.duration]), out = [];
  for (let i = 0; i < pts.length - 1; i++) { const s = pts[i], e = pts[i + 1]; if (e - s >= 30) out.push([s, e]); else if (out.length) out[out.length - 1][1] = e; }
  return out.length ? out : [[0, buf.duration]];
}
/* ═════════ WAV 만들기 (구간 + 앞 0.5초 · 끝 2초 부드럽게) ═════════ */
function wav(buf, s, e) {
  const sr = buf.sampleRate, a = Math.floor(s * sr), b = Math.min(buf.length, Math.floor(e * sr)), n = Math.max(1, b - a), nc = Math.min(2, buf.numberOfChannels);
  const fi = Math.floor(.5 * sr), fo = Math.floor(Math.min(2, (e - s) / 4) * sr);
  const out = new DataView(new ArrayBuffer(44 + n * nc * 2)), W = (o, t) => { for (let i = 0; i < t.length; i++) out.setUint8(o + i, t.charCodeAt(i)); };
  W(0, 'RIFF'); out.setUint32(4, 36 + n * nc * 2, true); W(8, 'WAVE'); W(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, nc, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * nc * 2, true); out.setUint16(32, nc * 2, true); out.setUint16(34, 16, true); W(36, 'data'); out.setUint32(40, n * nc * 2, true);
  const ch = []; for (let c = 0; c < nc; c++) ch.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    const gn = Math.min(1, s > .3 ? i / fi : 1, e < buf.duration - .3 ? (n - i) / fo : 1);
    for (let c = 0; c < nc; c++) { const v = clamp(ch[c][a + i] * gn, -1, 1); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  }
  return new Blob([out], { type: 'audio/wav' });
}

/* ═════════ ✂️ 노래 구간 고르기 판 ═════════ */
let PV = null;   // 들어 보기
function stopPv() { if (PV) { try { PV.stop(); } catch (e) { /* 무시 */ } PV = null; } }
function preview(buf, s, e) { stopPv(); const ac = ED.ac(), n = ac.createBufferSource(); n.buffer = buf; n.connect(ac.destination); n.start(0, s, Math.min(e - s, 20)); PV = n; n.onended = () => { if (PV === n) PV = null; }; }
async function cutSheet(h) {
  const P = ED.P, M = P.music, full = M.full || M.fileId, src = SRC.get(full), meta = P.srcs.find(x => x.id === full);
  if (!src || !src.buf) return h.toast('먼저 🎵 내 노래(MP3)를 넣어 주세요');
  const buf = src.buf, D = buf.duration;
  const dim = document.createElement('div'); dim.className = 'bkk-dim';
  let mode = M.cut ? M.cut.mode : 'full', L = M.cut && M.cut.len || 45, S = M.cut ? M.cut.s : 0, songs = null, si = 0;
  if (mode === 'hl' && !M.cut) S = highlight(buf, L);
  const range = () => mode === 'full' ? [0, D] : mode === 'max3' ? [0, Math.min(D, 178)] : mode === 'song' && songs ? songs[si] : [S, Math.min(D, S + L)];
  const draw = () => {
    const [s, e] = range();
    dim.innerHTML = `<div class="bkk"><h3>✂️ 노래 구간 고르기 <button type="button" data-x="close">✕</button></h3>
      <p style="margin:0 0 8px;color:#475569">🎵 ${(meta && meta.name || '내 노래').replace(/</g, '&lt;')} · 전체 <b>${fmt(D)}</b></p>
      <div class="seg" data-g="mode">${[['full', '🎶 전체 곡'], ['hl', '🎯 하이라이트'], ...(D > 180 ? [['max3', '⏱ 3분까지']] : []), ['song', '🎼 플레이리스트']].map(([k, l]) => `<button type="button" data-m="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>
      ${mode === 'hl' ? `<div class="seg">${[30, 45, 60].map(k => `<button type="button" data-l="${k}" aria-pressed="${L === k}">${k}초</button>`).join('')}</div>
        <p style="margin:6px 0">시작 <b>${fmt(s)}</b> → 끝 <b>${fmt(e)}</b> <small style="color:#64748b">(소리가 가장 꽉 찬 곳을 찾았어요)</small></p>
        <div class="seg"><button type="button" data-n="-5">◀ 5초 앞</button><button type="button" data-n="-1">◀ 1초</button><button type="button" data-n="1">1초 ▶</button><button type="button" data-n="5">5초 뒤 ▶</button></div>` : ''}
      ${mode === 'song' ? (songs ? `<p style="margin:6px 0">조용한 틈으로 <b>${songs.length}곡</b>을 찾았어요. 쓸 곡을 골라요.</p><div style="display:grid;gap:6px;max-height:34vh;overflow:auto">${songs.map(([a, b], i) => `<button type="button" data-s="${i}" class="op${i === si ? ' hi' : ''}" style="min-height:52px">${i + 1}번째 곡 · ${fmt(a)} ~ ${fmt(b)} <small>(${fmt(b - a)})</small></button>`).join('')}</div>` : '<p>🔎 곡 사이 조용한 틈을 찾는 중…</p>') : ''}
      ${mode === 'full' ? `<p style="margin:6px 0">노래 <b>처음부터 끝까지</b> 써요.${D > 180 ? ' <b style="color:#b91c1c">⚠️ 3분이 넘으면 유튜브 쇼츠가 아니라 일반 영상으로 올라가요.</b>' : ''}</p>` : ''}
      ${mode === 'max3' ? '<p style="margin:6px 0">유튜브 쇼츠는 <b>3분까지</b>예요. 2분 58초에서 부드럽게 끝나요.</p>' : ''}
      <div class="seg" style="margin-top:10px"><button type="button" data-a2="pv">▶ 들어 보기</button><button type="button" data-a2="stop">■ 멈춤</button></div>
      <button type="button" class="op hi" data-a2="ok" style="width:100%;min-height:56px;margin-top:8px">✅ ${mode === 'full' ? '전체 곡으로 쓰기' : `이 구간(${fmt(e - s)})으로 쓰기`}</button>
      <p style="color:#64748b;font-size:.82rem;margin:8px 0 0">💡 원래 노래 파일은 그대로 두고, 고른 구간만 따로 만들어 써요. 가사 박자를 맞춰 두었다면 같이 옮겨요. 사진 시간은 아래 「🎵 노래 끝까지 맞추기」를 한 번 더 눌러 주세요.</p></div>`;
  };
  draw(); document.body.appendChild(dim);
  const close = () => { stopPv(); dim.remove(); };
  dim.addEventListener('click', async e => {
    if (e.target === dim || e.target.closest('[data-x]')) return close();
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.m) { mode = b.dataset.m; if (mode === 'hl') S = highlight(buf, L); if (mode === 'song' && !songs) { draw(); await new Promise(r => setTimeout(r, 30)); songs = splitSongs(buf); } return draw(); }
    if (b.dataset.l) { L = +b.dataset.l; S = highlight(buf, L); return draw(); }
    if (b.dataset.n) { S = clamp(S + +b.dataset.n, 0, Math.max(0, D - L)); return draw(); }
    if (b.dataset.s) { si = +b.dataset.s; return draw(); }
    const [s, en] = range();
    if (b.dataset.a2 === 'pv') return preview(buf, s, en);
    if (b.dataset.a2 === 'stop') return stopPv();
    if (b.dataset.a2 === 'ok') { close(); await h.useCut(mode === 'full' ? null : { mode, s, e: en, len: L }, full, buf); }
  });
}
/** 구간 → WAV 파일 (전체 곡이면 null) */
function cutFile(buf, c, name) { return new File([wav(buf, c.s, c.e)], (name || '노래').replace(/\.\w+$/, '') + `_${fmt(c.s).replace(':', '')}-${fmt(c.e).replace(':', '')}.wav`, { type: 'audio/wav' }); }

/* ═════════ 📊 움직이는 막대 ═════════ */
const NB = 32, FPS = 30, VIZ = new Map();
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
}
function spectrum(id) {
  const hit = VIZ.get(id); if (hit) return hit.ready ? hit : null;
  const s = SRC.get(id); if (!s || !s.buf) return null;
  const buf = s.buf, nF = Math.floor(buf.duration * FPS), N = 1024, sr = buf.sampleRate, d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0;
  const o = { ready: false, n: nF, v: new Uint8Array(nF * NB) }; VIZ.set(id, o);
  const edges = Array.from({ length: NB + 1 }, (_, i) => Math.round(2 + (N / 2 - 2) * Math.pow(i / NB, 2.2)));
  const win = new Float32Array(N).map((_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (N - 1)));
  let f = 0;
  const chunk = () => {
    const end = Math.min(nF, f + 600), re = new Float32Array(N), im = new Float32Array(N);
    for (; f < end; f++) {
      const a = Math.floor(f / FPS * sr); for (let i = 0; i < N; i++) { re[i] = ((d0[a + i] || 0) + (d1[a + i] || 0)) * .5 * win[i]; im[i] = 0; }
      fft(re, im);
      for (let b = 0; b < NB; b++) { let m = 0; for (let k = edges[b]; k < Math.max(edges[b] + 1, edges[b + 1]); k++) m = Math.max(m, Math.hypot(re[k], im[k])); o.v[f * NB + b] = clamp(Math.round((Math.log10(1 + m) / 2.2) * 255 * (1 + b / NB * .8)), 0, 255); }
    }
    if (f < nF) setTimeout(chunk, 0); else { o.ready = true; if (ED.redraw) ED.redraw(); }
  };
  setTimeout(chunk, 0); return null;
}
const COLS = { rainbow: null, neon: ['#22d3ee', '#a855f7', '#ec4899'], white: ['#ffffff', '#ffffff', '#e2e8f0'], gold: ['#fde68a', '#f59e0b', '#fbbf24'], pink: ['#fbcfe8', '#f472b6', '#ec4899'], sky: ['#bae6fd', '#38bdf8', '#0ea5e9'] };
function colAt(c, i, n, t) { if (c === 'rainbow') return `hsl(${(i / n * 300 + t * 40) % 360},95%,62%)`; const L = COLS[c] || COLS.neon; return L[Math.floor(i / n * L.length) % L.length]; }
/** 🎶 노래 스티커: 영상 어디든 · 손가락으로 옮기고 두 손가락으로 크기 · 노래 따라 / 그냥 출렁 */
const STYLES = [['bars', '📊 막대'], ['mirror', '🔊 대칭'], ['wave', '〰 물결'], ['line', '📈 주파수 선'], ['ring', '⭕ 둥근 막대'], ['heart', '💗 하트 두근'], ['dots', '⚪ 점 통통'], ['notes', '🎵 음표'], ['ripple', '🌊 퍼지는 원']];
let BOX = null;   // 마지막으로 그린 스티커 자리 (손가락으로 잡기)
function vizVals(t, M, V) {
  let sp = null; if (V.mode !== 'auto' && M.kind === 'file' && M.fileId) sp = spectrum(M.fileId);
  if (sp) { const dur = sp.n / FPS, f = clamp(Math.floor((dur > 0 ? t % dur : 0) * FPS), 0, sp.n - 1); return i => sp.v[f * NB + (i % NB)] / 255; }
  const beat = Math.pow(Math.abs(Math.sin(t * Math.PI * 2)), 3);   // 그냥 출렁 (1초에 두 번 쿵)
  return i => clamp(.25 + .35 * Math.abs(Math.sin(t * (3 + (i % 7) * .9) + i * 1.7)) + .35 * beat * (1 - (i % NB) / NB * .6), 0, 1);
}
function drawViz(x, W, H, t) {
  BOX = null;
  const P = ED.P, V = P && P.viz; if (!V || !V.on) return;
  const v = vizVals(t, P.music, V), m = Math.min(W, H), k = V.k || 'bars', c = V.col || 'rainbow', sz = V.size || 1;
  const cx = (V.x == null ? .5 : V.x) * W, cy = (V.y == null ? ({ top: .3, mid: .5, bottom: .74 }[V.pos] || .74) : V.y) * H, bw0 = W * .7 * sz, hmax = m * .16 * sz;
  x.save(); x.globalAlpha = V.alpha || .95; x.shadowColor = c === 'white' ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.35)'; x.shadowBlur = m * .012;
  let bw = bw0, bh = hmax * 2;
  if (k === 'bars' || k === 'mirror') {
    const n = 24, gap = bw * .012, w = (bw - gap * (n - 1)) / n, x0 = cx - bw / 2;
    for (let i = 0; i < n; i++) { const h = Math.max(m * .006, v(i) * hmax); x.fillStyle = colAt(c, i, n, t); const xx = x0 + i * (w + gap); if (k === 'mirror') x.fillRect(xx, cy - h, w, h * 2); else x.fillRect(xx, cy + hmax - h, w, h); }
  } else if (k === 'wave' || k === 'line') {
    x.lineWidth = m * .008 * Math.max(.6, sz); x.lineJoin = 'round';
    const layers = k === 'wave' ? 3 : 1;
    for (let L = 0; L < layers; L++) { x.beginPath(); for (let i = 0; i <= 120; i++) { const p = i / 120, b = Math.floor(p * NB), amp = v(b) * hmax * (k === 'line' ? .9 : .7 - L * .18), y = k === 'line' ? cy + Math.sin(p * Math.PI * 22 + t * 9) * amp * Math.sin(p * Math.PI) : cy + Math.sin(p * Math.PI * (6 + L * 2) + t * (5 + L)) * amp; const xx = cx - bw / 2 + p * bw; if (i) x.lineTo(xx, y); else x.moveTo(xx, y); } x.strokeStyle = colAt(c, L * 10, 30, t); x.globalAlpha = (V.alpha || .95) * (1 - L * .25); x.stroke(); }
  } else if (k === 'ring') {
    const r = m * .1 * sz, n = 48; bw = bh = (r + hmax) * 2;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 - Math.PI / 2, h = Math.max(m * .01, v(i) * hmax * .9); x.strokeStyle = colAt(c, i, n, t); x.lineWidth = m * .011 * sz; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.lineTo(cx + Math.cos(a) * (r + h), cy + Math.sin(a) * (r + h)); x.stroke(); }
  } else if (k === 'heart') {
    const s = m * .12 * sz * (.85 + .35 * v(2)); bw = bh = s * 2.4; x.fillStyle = colAt(c, 3, 10, t); x.beginPath(); x.moveTo(cx, cy + s * .9);
    x.bezierCurveTo(cx - s * 1.6, cy - s * .2, cx - s * .7, cy - s * 1.3, cx, cy - s * .45); x.bezierCurveTo(cx + s * .7, cy - s * 1.3, cx + s * 1.6, cy - s * .2, cx, cy + s * .9); x.fill();
  } else if (k === 'dots') {
    const n = 9, step = bw / n; for (let i = 0; i < n; i++) { const h = v(i * 3) * hmax, r = m * .022 * sz; x.fillStyle = colAt(c, i, n, t); x.beginPath(); x.arc(cx - bw / 2 + step * (i + .5), cy + hmax * .5 - h, r, 0, Math.PI * 2); x.fill(); }
  } else if (k === 'notes') {
    x.textAlign = 'center'; x.textBaseline = 'middle'; const N = ['♪', '♫', '♩', '♬'];
    for (let i = 0; i < 8; i++) { const ph = (t * .35 + i / 8) % 1, xx = cx - bw / 2 + ((i * 37) % 100) / 100 * bw, yy = cy + hmax - ph * hmax * 2, fs = m * (.05 + .03 * v(i * 4)) * sz; x.globalAlpha = (V.alpha || .95) * Math.sin(ph * Math.PI); x.fillStyle = colAt(c, i, 8, t); x.font = `900 ${Math.round(fs)}px sans-serif`; x.fillText(N[i % 4], xx, yy); }
  } else if (k === 'ripple') {
    const R = m * .16 * sz; bw = bh = R * 2.2; x.lineWidth = m * .008 * sz;
    for (let i = 0; i < 4; i++) { const ph = (t * .6 + i / 4) % 1; x.globalAlpha = (V.alpha || .95) * (1 - ph); x.strokeStyle = colAt(c, i, 4, t); x.beginPath(); x.arc(cx, cy, R * (.2 + ph * .9) * (.9 + .2 * v(i * 5)), 0, Math.PI * 2); x.stroke(); }
  }
  x.restore();
  BOX = { l: cx - bw / 2, t: cy - bh / 2, w: bw, h: bh, W, H };
}
/* 손가락으로 옮기기 · 두 손가락으로 크기 (미리보기 화면) */
(function () {
  const cv = document.getElementById('cv'); if (!cv) return;
  const pts = new Map(); let st = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.addEventListener('pointerdown', e => {
    const P = ED.P, V = P && P.viz; if (!V || !V.on || !BOX) return;
    const [px, py] = pos(e), m = Math.max(16, Math.min(BOX.W, BOX.H) * .05);
    if (!pts.size && !(px >= BOX.l - m && px <= BOX.l + BOX.w + m && py >= BOX.t - m && py <= BOX.t + BOX.h + m)) return;
    pts.set(e.pointerId, [px, py]); e.stopImmediatePropagation(); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    const L = [...pts.values()];
    st = L.length >= 2 ? { pinch: Math.hypot(L[0][0] - L[1][0], L[0][1] - L[1][1]), size: V.size || 1 } : { sx: px, sy: py, ox: V.x == null ? (BOX.l + BOX.w / 2) / BOX.W : V.x, oy: V.y == null ? (BOX.t + BOX.h / 2) / BOX.H : V.y };
  }, true);
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !st) return; e.stopImmediatePropagation();
    const V = ED.P.viz, p = pos(e); pts.set(e.pointerId, p); const L = [...pts.values()];
    if (L.length >= 2 && st.pinch) V.size = clamp(Math.round(st.size * Math.hypot(L[0][0] - L[1][0], L[0][1] - L[1][1]) / st.pinch * 100) / 100, .4, 2.6);
    else if (st.sx != null) { V.x = clamp(st.ox + (p[0] - st.sx) / cv.width, .05, .95); V.y = clamp(st.oy + (p[1] - st.sy) / cv.height, .05, .95); }
    if (ED.redraw) ED.redraw();
  }, true);
  const up = e => { if (!pts.has(e.pointerId)) return; e.stopImmediatePropagation(); pts.delete(e.pointerId); if (!pts.size) { st = null; if (ED.commit) ED.commit(); } else { const V = ED.P.viz, L = [...pts.values()]; st = { sx: L[0][0], sy: L[0][1], ox: V.x, oy: V.y }; } };
  cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
})();

/* ═════════ 🎯 가사 박자 자동 맞추기 (목소리 나오는 곳 찾기) ═════════ */
function vocalRegions(buf) {
  const sr = buf.sampleRate, N = 2048, hop = Math.floor(sr * .1), n = Math.floor((buf.length - N) / hop), d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0;
  const lo = Math.floor(300 / sr * N), hi = Math.floor(3400 / sr * N), E = new Float32Array(Math.max(0, n)), re = new Float32Array(N), im = new Float32Array(N);
  for (let f = 0; f < n; f++) {
    const a = f * hop; for (let i = 0; i < N; i++) { re[i] = ((d0[a + i] || 0) + (d1[a + i] || 0)) * .5; im[i] = 0; }
    fft(re, im); let mid = 0, all = 1e-9; for (let k = 2; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k]; all += p; if (k >= lo && k <= hi) mid += p; }
    E[f] = Math.sqrt(mid) * (mid / all);   // 사람 목소리 대역이 크고 많이 차지할수록
  }
  const S = E.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) { s += E[j]; c++; } return s / c; });
  const sorted = Array.from(S).sort((p, q) => p - q), th = sorted[Math.floor(n * .45)] || 0;
  const R = []; let s0 = -1;
  for (let i = 0; i <= n; i++) { const on = i < n && S[i] > th; if (on && s0 < 0) s0 = i; if (!on && s0 >= 0) { R.push([s0 * .1, i * .1]); s0 = -1; } }
  const M = []; R.forEach(r => { const l = M[M.length - 1]; if (l && r[0] - l[1] < 1.2) l[1] = r[1]; else M.push(r.slice()); });
  return M.filter(r => r[1] - r[0] >= 1.5);
}
/** 가사 줄마다 시간 넣기: 글자 수만큼 목소리 구간에 차례로 나눠 담아요 */
function autoSync(buf, lines) {
  const R = vocalRegions(buf); if (!R.length || !lines.length) return false;
  const wt = lines.map(l => Math.max(2, (String(l.text).match(/[가-힣A-Za-z0-9]/g) || []).length) + 2), W = wt.reduce((p, q) => p + q, 0), A = R.reduce((p, r) => p + r[1] - r[0], 0);
  const at = pos => { let left = pos / W * A; for (const [s, e] of R) { if (left <= e - s) return s + left; left -= e - s; } return R[R.length - 1][1]; };
  let cum = 0; lines.forEach((l, i) => { l.t = Math.round(at(cum) * 10) / 10; cum += wt[i]; });
  return true;
}

/* ═════════ 📌 위 큰 제목 ═════════ */
const FREQ = new Set();
function drawTitle(x, W, H) {
  const P = ED.P, T = P && P.ttl; if (!T || !T.on || !((T.l1 || '').trim() || (T.l2 || '').trim())) return;
  const fk = (T.font || 'blackhan') + (T.l1 || '') + (T.l2 || ''); if (!FREQ.has(fk)) { FREQ.add(fk); ED.loadFonts([T.font || 'blackhan'], (T.l1 || '') + (T.l2 || '')).then(() => ED.redraw && ED.redraw()); }
  const m = Math.min(W, H), L = [T.l1 || '', T.l2 || ''].filter(s => s.trim()), band = T.st === 'band';
  const font = T.font || 'blackhan', px0 = m * .105 * (T.size || 1);
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  if (band) { x.fillStyle = '#000'; x.fillRect(0, 0, W, H * (.06 + L.length * .085 * (T.size || 1))); }
  L.forEach((s, i) => {
    let px = px0; x.font = ED.fspec(font, px); while (x.measureText(s).width > W * .9 && px > 10) { px *= .92; x.font = ED.fspec(font, px); }
    const y = H * (band ? .055 : .07) + px * .75 + i * px * 1.18, col = i === 0 ? (T.c1 || '#ffe14d') : (T.c2 || '#ffffff');
    if (!band) { x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = px * .25; x.lineWidth = px * .16; x.strokeStyle = '#111'; x.strokeText(s, W / 2, y); x.shadowBlur = 0; }
    x.fillStyle = col; x.fillText(s, W / 2, y);
  });
  x.restore();
}
function drawSong(x, W, H, t) { try { drawViz(x, W, H, t); drawTitle(x, W, H); } catch (e) { /* 그리기 실패는 무시 */ } }

/* ═════════ 🎵 노래 쇼츠 꾸미기 판 (음악 탭 안) ═════════ */
function ui(P, h) {
  const V = P.viz || {}, T = P.ttl || {}, M = P.music, has = M.kind === 'file' && M.fileId, c = M.cut;
  const btn = (a, v, l, on) => `<button type="button" data-a="${a}" data-v="${v}" aria-pressed="${!!on}">${l}</button>`;
  return `<div class="grp" style="background:#f5f3ff;border:2px solid #c4b5fd;border-radius:14px;padding:10px 12px;margin-top:10px"><h3 style="margin-top:0">🎵 노래 쇼츠 꾸미기</h3>
    ${has ? `<button type="button" data-a="songcut" class="pri" style="width:100%">✂️ 노래 구간 고르기 <small style="display:block;font-weight:600">${c ? `지금: ${c.mode === 'hl' ? '🎯 하이라이트' : c.mode === 'max3' ? '⏱ 3분까지' : '🎼 플레이리스트 한 곡'} ${fmt(c.s)}~${fmt(c.e)}` : '지금: 🎶 전체 곡'} · 하이라이트 · 3분까지 · 플레이리스트 나누기</small></button>`
      : '<p class="hint">📁 위에서 <b>내 노래(MP3)</b>를 넣으면 ✂️ 구간 고르기 · 📊 움직이는 막대를 쓸 수 있어요.</p>'}
    <h4>🎶 노래 스티커 <small>(미리보기에서 손가락으로 옮기고 · 두 손가락으로 크기)</small></h4><div class="chips">${btn('viz', 'off', '끄기', !V.on)}${STYLES.map(([k, l]) => btn('viz', k, l, V.on && V.k === k)).join('')}</div>
    ${V.on ? `<div class="chips">${[['rainbow', '🌈 무지개'], ['white', '🤍 흰색'], ['neon', '💜 네온'], ['gold', '✨ 금색'], ['pink', '🩷 분홍'], ['sky', '🩵 하늘']].map(([k, l]) => btn('vizc', k, l, (V.col || 'rainbow') === k)).join('')}</div>
      <div class="chips">${btn('vizm', 'song', '🎵 노래 따라', V.mode !== 'auto')}${btn('vizm', 'auto', '✨ 그냥 출렁', V.mode === 'auto')}${[[.7, '작게'], [1, '보통'], [1.5, '크게']].map(([k, l]) => btn('vizs', k, l, (V.size || 1) === k)).join('')}${btn('vizc0', 'ctr', '⊕ 가운데로', 0)}</div>
      <div class="chips">${[[.5, '반투명'], [.8, '조금 투명'], [.95, '선명']].map(([k, l]) => btn('viza', k, l, (V.alpha || .95) === k)).join('')}</div>` : ''}
    <h4>📌 위 큰 제목 (영상 내내)</h4><div class="chips">${btn('ttl', 'off', '끄기', !T.on)}${btn('ttl', 'photo', '🖼 사진 위 글씨', T.on && T.st !== 'band')}${btn('ttl', 'band', '⬛ 검은 띠', T.on && T.st === 'band')}</div>
    ${T.on ? `<input type="text" data-a="ttl1" value="${(T.l1 || '').replace(/"/g, '&quot;')}" placeholder="첫째 줄 (예: 그날에)" style="width:100%;margin-top:6px"><input type="text" data-a="ttl2" value="${(T.l2 || '').replace(/"/g, '&quot;')}" placeholder="둘째 줄 (예: 머물러있네)" style="width:100%;margin-top:6px">
      <div class="chips">${[['#ffe14d', '🟡'], ['#ffffff', '⚪'], ['#ff7eb3', '🩷'], ['#7dd3fc', '🔵'], ['#fb923c', '🟠']].map(([k, l]) => btn('ttlc1', k, '첫 줄 ' + l, (T.c1 || '#ffe14d') === k)).join('')}</div>
      <div class="chips">${[['#ffffff', '⚪'], ['#ffe14d', '🟡'], ['#ff7eb3', '🩷'], ['#7dd3fc', '🔵'], ['#fb923c', '🟠']].map(([k, l]) => btn('ttlc2', k, '둘째 ' + l, (T.c2 || '#ffffff') === k)).join('')}</div>
      <div class="chips">${[['blackhan', '굵은 글씨'], ['nanumpen', '손글씨'], ['jua', '둥근 글씨']].map(([k, l]) => btn('ttlf', k, l, (T.font || 'blackhan') === k)).join('')}${[[.8, '작게'], [1, '보통'], [1.2, '크게']].map(([k, l]) => btn('ttls', k, l, (T.size || 1) === k)).join('')}</div>` : ''}
  </div>`;
}
/** 판 단추 · 글 칸 처리 — 처리했으면 true */
function act(a, v, P, h) {
  P.viz = P.viz || {}; P.ttl = P.ttl || {};
  if (a === 'songcut') { cutSheet(h); return true; }
  if (a === 'viz') { if (v === 'off') P.viz.on = 0; else { P.viz.on = 1; P.viz.k = v; if (P.music.fileId) spectrum(P.music.fileId); } return 're'; }
  if (a === 'vizc') { P.viz.col = v; return 're'; } if (a === 'vizp') { P.viz.pos = v; return 're'; } if (a === 'vizs') { P.viz.size = +v; return 're'; }
  if (a === 'vizm') { P.viz.mode = v; return 're'; } if (a === 'viza') { P.viz.alpha = +v; return 're'; } if (a === 'vizc0') { P.viz.x = .5; P.viz.y = .5; return 're'; }
  if (a === 'ttl') { if (v === 'off') P.ttl.on = 0; else { P.ttl.on = 1; P.ttl.st = v; if (!P.ttl.l1 && !P.ttl.l2) { const mt = P.srcs.find(x => x.id === (P.music.full || P.music.fileId)); P.ttl.l1 = mt ? mt.name.replace(/\.\w+$/, '').replace(/_\d+-\d+$/, '').slice(0, 14) : ''; } ED.loadFonts([P.ttl.font || 'blackhan'], (P.ttl.l1 || '') + (P.ttl.l2 || '')).then(() => ED.redraw && ED.redraw()); } return 're'; }
  if (a === 'ttlc1') { P.ttl.c1 = v; return 're'; } if (a === 'ttlc2') { P.ttl.c2 = v; return 're'; } if (a === 'ttls') { P.ttl.size = +v; return 're'; }
  if (a === 'ttlf') { P.ttl.font = v; ED.loadFonts([v], (P.ttl.l1 || '') + (P.ttl.l2 || '')).then(() => ED.redraw && ED.redraw()); return 're'; }
  return false;
}
function input(a, v, P) { if (a === 'ttl1' || a === 'ttl2') { P.ttl = P.ttl || {}; P.ttl[a === 'ttl1' ? 'l1' : 'l2'] = v; return true; } return false; }
/** 영상 만들기 전에 글꼴 · 막대 준비 */
async function prep(P) { if (P.ttl && P.ttl.on) await ED.loadFonts([P.ttl.font || 'blackhan'], (P.ttl.l1 || '') + (P.ttl.l2 || '')); if (P.viz && P.viz.on && P.music.fileId) { spectrum(P.music.fileId); for (let i = 0; i < 200 && !(VIZ.get(P.music.fileId) || {}).ready; i++) await new Promise(r => setTimeout(r, 100)); } }

g.BKSONG = { ui, act, input, cutSheet, cutFile, highlight, splitSongs, drawSong, prep, spectrum, autoSync, vocalRegions };
ED.drawSong = drawSong;
})(window);
