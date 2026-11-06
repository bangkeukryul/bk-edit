/*! handoff.js — 1차 편집(🎵 쇼츠 만들기 · 🎬 영상 만들기)에서 만든 MP4를 BK에딧 「✂️ 편집하기」로 바로 넘기기
 * 같은 휴대폰 · 같은 주소라서 파일을 내려받지 않고 IndexedDB 'bk-editapp'에 프로젝트로 넣은 뒤 편집 화면을 열어요.
 * 같은 1차 작업을 다시 보내면 「영상만 바꿀까요?」 → 최종 편집에서 넣은 효과 · 글자 · 더빙은 그대로 둬요.
 */
(function (g) {
'use strict';
const uid = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('bk-editapp', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('p'); r.result.createObjectStore('f'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store), q = fn(s); t.oncomplete = () => { d.close(); res(q && q.result); }; t.onerror = () => { d.close(); rej(t.error); }; });
}
function meta(blob) {
  return new Promise(res => {
    const v = document.createElement('video'), u = URL.createObjectURL(blob); v.muted = true; v.preload = 'metadata';
    const done = () => { const r = { dur: isFinite(v.duration) ? v.duration : 0, w: v.videoWidth || 1080, h: v.videoHeight || 1920 }; URL.revokeObjectURL(u); res(r); };
    v.onloadedmetadata = done; v.onerror = done; setTimeout(done, 10000); v.src = u;
  });
}
const ratioOf = (w, h) => w / h > 1.3 ? '16:9' : w / h < .8 ? '9:16' : '1:1';
function ask(prev) {
  return new Promise(res => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#0008;display:flex;align-items:center;justify-content:center;padding:18px;font:16px/1.55 "Noto Sans KR",system-ui,sans-serif';
    d.innerHTML = `<div style="background:#fff;color:#111827;border-radius:22px;padding:20px;max-width:380px;width:100%">
      <b style="font-size:1.15rem">✂️ 이미 보낸 프로젝트가 있어요</b><p style="margin:8px 0 12px;color:#475569">「${String(prev.name).replace(/[<>&]/g, '')}」<br>어떻게 할까요?</p>
      <button data-v="replace" style="display:block;width:100%;min-height:56px;margin:8px 0;border:0;border-radius:14px;background:#0d9488;color:#fff;font-weight:900;font-size:1rem">🔄 영상만 새것으로 바꾸기<br><small style="font-weight:600">넣어 둔 효과 · 글자 · 더빙은 그대로</small></button>
      <button data-v="new" style="display:block;width:100%;min-height:52px;margin:8px 0;border:0;border-radius:14px;background:#e8eef8;color:#174782;font-weight:900;font-size:1rem">🆕 새 프로젝트로 만들기</button>
      <button data-v="" style="display:block;width:100%;min-height:46px;border:0;background:none;color:#64748b;font-weight:800">취소</button></div>`;
    d.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; d.remove(); res(b.dataset.v); });
    document.body.appendChild(d);
  });
}
/** blob: 완성 MP4 · o: { key(같은 1차 작업 구분), name, from, base(BK에딧 주소, 기본 '../') } */
async function send(blob, o) {
  o = o || {};
  const m = await meta(blob), sid = uid('s');
  const all = (await tx('p', 'readonly', s => s.getAll())) || [];
  const prev = all.filter(r => !r.trash && r.P && r.P.link && r.P.link === o.key).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  let mode = 'new';
  if (prev) { mode = await ask(prev); if (!mode) return false; }
  await tx('f', 'readwrite', s => s.put(blob, sid));
  const fmeta = { id: sid, kind: 'video', name: (o.from || '1차 영상') + '.mp4', type: blob.type || 'video/mp4', size: blob.size, dur: m.dur };
  let rec;
  if (mode === 'replace') {
    rec = prev; const P = rec.P, old = P.main;
    P.srcs.push(fmeta);
    for (const c of P.clips) if (c.src === old) { c.src = sid; c.in = Math.min(c.in || 0, Math.max(0, m.dur - .1)); c.out = Math.min(Math.max(c.out || m.dur, c.in + .1), m.dur); }
    for (const a of P.auds || []) if (a.src === old) { a.src = sid; a.out = Math.min(a.out, m.dur); }
    P.main = sid; rec.at = Date.now();
    const used = P.clips.some(c => c.src === old) || (P.auds || []).some(a => a.src === old);
    if (old && !used) { P.srcs = P.srcs.filter(x => x.id !== old); try { await tx('f', 'readwrite', s => s.delete(old)); } catch (e) { /* 무시 */ } }
  } else {
    const P = { v: 1, id: uid('p'), name: o.name || '1차 편집 영상', ratio: ratioOf(m.w, m.h), photoDur: 3, srcs: [fmeta],
      clips: [{ id: uid('c'), kind: 'video', src: sid, in: 0, out: m.dur, dur: 0, speed: 1, vol: 1, mute: 0, fit: 'blur', fi: 0, fo: 0 }],
      auds: [], texts: [], fx: [], script: '', nRec: 1, created: Date.now(), link: o.key || '', main: sid, from: o.from || '' };
    rec = { id: P.id, name: P.name, at: Date.now(), created: P.created, trash: 0, dur: m.dur, cover: '', P };
  }
  await tx('p', 'readwrite', s => s.put(rec, rec.id));
  location.href = (o.base || '../') + '?open=' + encodeURIComponent(rec.id);
  return true;
}
g.BKHAND = { send };
})(window);
