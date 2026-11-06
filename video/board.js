/*! board.js — BK에딧 🎬 영상 만들기 「🎞 영상 클립」 장면 보드
 * 순서: Flow(위 화면)에서 ① 기준 이미지 ② 장면 이미지 ③ 이미지에서 영상 → 내려받기 → 여기(아래 화면)로 한꺼번에 가져오기
 * 장면 사진 · 영상은 📥 보관함(bk-lib)에도 담고, 장면 사진은 이 휴대폰(IndexedDB 'bk-editapp-video')에 장면 번호로 저장해요.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), A = window.__app, TK = () => window.__bkeTalk;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, ms) => A.toast(m, ms);
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  /* 장면 사진 저장소 */
  let dbp = null;
  function db() { if (dbp) return dbp; dbp = new Promise((res, rej) => { const r = indexedDB.open('bk-editapp-video', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return dbp; }
  async function tx(mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('img', mode), q = fn(t.objectStore('img')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); }
  const IMG = new Map();   // 장면 번호(0부터) → Blob
  const URLS = new Map();
  async function loadImgs() { try { const keys = await tx('readonly', s => s.getAllKeys()); for (const k of keys || []) IMG.set(+k, await tx('readonly', s => s.get(k))); } catch (e) { /* 없음 */ } }
  async function setImg(i, b) { IMG.set(i, b); if (URLS.has(i)) { URL.revokeObjectURL(URLS.get(i)); URLS.delete(i); } try { await tx('readwrite', s => s.put(b, i)); } catch (e) { /* 공간 */ } }
  const urlOf = i => { const b = IMG.get(i); if (!b) return ''; if (!URLS.has(i)) URLS.set(i, URL.createObjectURL(b)); return URLS.get(i); };
  const toLib = fs => { try { if (window.BKLIB) window.BKLIB.addMany(fs); } catch (e) { /* 무시 */ } };
  const byTime = fs => fs.slice().sort((a, b) => (a.lastModified || 0) - (b.lastModified || 0) || String(a.name).localeCompare(String(b.name), 'ko', { numeric: true }));
  async function copy(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); let r = false; try { r = document.execCommand('copy'); } catch (_) { /* 무시 */ } a.remove(); return r; } }
  async function copyImg(b) {
    try {
      const bm = await createImageBitmap(b), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0);
      const png = await new Promise(r => c.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); return true;
    } catch (e) { return false; }
  }
  /* 📋 다음 복사: 기준 이미지 → 장면1 이미지 → 장면1 영상 → 장면2 이미지 → … */
  function queue() {
    const t = TK(); if (!t) return []; const q = [], sh = t.sheet();
    if (sh) q.push({ k: 'sheet', label: '기준 이미지 (주인공 · 장소)', text: sh });
    t.scenes().forEach((s, i) => {
      if (s.img) q.push({ k: 'img', i, label: `장면 ${s.n} · 🖼 이미지 프롬프트`, text: s.img });
      q.push({ k: 'vid', i, label: `장면 ${s.n} · 🎬 영상 프롬프트 + 대사`, text: vidText(s) });
    });
    return q;
  }
  const vidText = s => `${s.vid || s.d || ''}${s.lines.length ? ` The character speaks in Korean: "${s.lines.join(' ').replace(/"/g, "'")}"` : ''}`.trim();
  const DONE = () => { try { return new Set(JSON.parse(ls('bkeCopied') || '[]')); } catch (e) { return new Set(); } };
  const mark = key => { const d = DONE(); d.add(key); ls('bkeCopied', JSON.stringify([...d])); };
  let idx = +(ls('bkeCopyIdx') || 0);
  function renderNext() {
    const q = queue(), b = $('bkbNext'); if (!b) return;
    if (!q.length) { b.disabled = true; b.innerHTML = '📋 다음 복사<small>먼저 📝 대본·장면에서 AI 답을 정리해 주세요</small>'; return; }
    if (idx >= q.length) idx = q.length; b.disabled = idx >= q.length;
    b.innerHTML = idx >= q.length ? '🎉 다 복사했어요<small>「처음부터」로 다시 할 수 있어요</small>' : `📋 다음 복사 (${idx + 1}/${q.length})<small>${esc(q[idx].label)}</small>`;
  }
  /* 보드 그리기 */
  function render() {
    const t = TK(), box = $('bkBoard'); if (!t || !box) return;
    const sc = t.scenes(), done = DONE(), sh = t.sheet();
    $('bkbEmpty').hidden = !!sc.length;
    $('bkbSheet').hidden = !sh; if (sh) $('bkbSheetTx').textContent = sh;
    box.innerHTML = sc.map((s, i) => {
      const iu = urlOf(i), ck = k => done.has(k) ? ' ✓' : '';
      return `<div class="bkb-c" data-i="${i}">
        <div class="bkb-h"><b>장면 ${s.n}</b><span>${s.dur.toFixed(0)}초 안팎</span>${s.clip ? '<em>🎬 영상 있음</em>' : iu ? '<em class="y">🖼 사진만</em>' : ''}</div>
        <p class="bkb-l">💬 ${esc(s.lines.join(' '))}</p>${s.d ? `<p class="bkb-d">🎬 ${esc(s.d)}</p>` : ''}
        <div class="bkb-row">
          <div class="bkb-th">${s.clip ? `<img src="${s.clip.thumb}" alt=""><i>🎞</i>` : iu ? `<img src="${iu}" alt="장면 ${s.n} 사진" draggable="true">` : '<span>사진 없음</span>'}</div>
          <div class="bkb-bt">
            ${s.img ? `<button type="button" data-a="cpi" class="${done.has('img' + i) ? 'ok' : ''}">📋 🖼 이미지 프롬프트${ck('img' + i)}</button>` : ''}
            ${iu ? `<button type="button" data-a="cpp">🖼 사진 복사 (Flow에 붙여넣기)</button>` : ''}
            <button type="button" data-a="cpv" class="${done.has('vid' + i) ? 'ok' : ''}">📋 🎬 영상 프롬프트 + 대사${ck('vid' + i)}</button>
            <div class="bkb-2"><label>🖼 사진<input type="file" accept="image/*" data-in="img"></label><label>🎞 영상<input type="file" accept="video/*" data-in="vid"></label></div>
          </div></div></div>`;
    }).join('');
    renderNext();
  }
  /* 버튼들 */
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'bkbNext') { const q = queue(); if (idx >= q.length) return; const it = q[idx]; if (await copy(it.text)) { mark(it.k === 'sheet' ? 'sheet' : it.k + it.i); toast(`📋 ${it.label} 복사 · 위 Flow 입력 칸에 붙여넣어요`, 2600); idx++; ls('bkeCopyIdx', String(idx)); render(); } else toast('복사가 안 됐어요 · 한 번 더 눌러 주세요'); return; }
    if (b.id === 'bkbPrev') { idx = Math.max(0, idx - 1); ls('bkeCopyIdx', String(idx)); renderNext(); return; }
    if (b.id === 'bkbReset') { idx = 0; ls('bkeCopyIdx', '0'); ls('bkeCopied', '[]'); render(); return; }
    if (b.id === 'bkbSheetCp') { if (await copy(TK().sheet())) { mark('sheet'); toast('📋 기준 이미지 프롬프트를 복사했어요'); } return; }
    if (b.id === 'bkbAll') {
      const q = queue(); if (!q.length) return; b.disabled = true;
      for (let k = 0; k < q.length; k++) { b.textContent = `📋 담는 중… ${k + 1}/${q.length}`; await copy(q[k].text); await new Promise(r => setTimeout(r, 700)); }
      b.disabled = false; b.textContent = '📋 전부 차례로 키보드 클립보드에 담기'; toast('📋 다 담았어요 · Flow 입력 칸에서 키보드의 📋(클립보드)를 열어 골라 붙여넣어요', 5000); return;
    }
    if (b.id === 'bkbFlow') { const u = (TK().tool() || [])[2] || 'https://flow.google.com/'; window.open(u, '_blank', 'noopener'); return; }
    if (b.id === 'bkbGrid') return gridSheet();
    const c = b.closest('.bkb-c'); if (!c) return; const i = +c.dataset.i, s = TK().scenes()[i]; if (!s) return;
    if (b.dataset.a === 'cpi') { if (await copy(s.img)) { mark('img' + i); toast(`📋 장면 ${s.n} 이미지 프롬프트 복사`); render(); } }
    if (b.dataset.a === 'cpv') { if (await copy(vidText(s))) { mark('vid' + i); toast(`📋 장면 ${s.n} 영상 프롬프트 + 대사 복사`); render(); } }
    if (b.dataset.a === 'cpp') { const ok = await copyImg(IMG.get(i)); toast(ok ? `🖼 장면 ${s.n} 사진을 복사했어요 · Flow 입력 칸을 길게 눌러 붙여넣어요` : '이 휴대폰은 사진 복사가 안 돼요 · 사진을 꾹 눌러 위 Flow로 끌어다 놓거나, Flow의 ＋로 다운로드에서 골라 주세요', 4500); }
  });
  document.addEventListener('change', async e => {
    const inp = e.target; if (!inp.matches || !inp.files) return;
    if (inp.id === 'bkbImgs' || inp.id === 'bkbVids') {
      const fs = byTime(Array.from(inp.files)); inp.value = ''; if (!fs.length) return;
      const sc = TK().scenes(); if (!sc.length) return toast('먼저 📝 대본·장면에서 AI 답을 정리해 주세요');
      toLib(fs);
      if (inp.id === 'bkbImgs') {
        let start = 0; while (start < sc.length && IMG.has(start)) start++; if (start + fs.length > sc.length) start = 0;   // 빈 장면부터 · 넘치면 처음부터
        for (let k = 0; k < fs.length && start + k < sc.length; k++) await setImg(start + k, fs[k]);
        toast(`🖼 사진 ${Math.min(fs.length, sc.length - start)}장을 내려받은 순서대로 장면 ${start + 1}부터 넣고 📥 보관함에도 담았어요`, 4500);
      } else {
        let start = sc.findIndex(s => !s.clip); if (start < 0 || start + fs.length > sc.length) start = 0;
        A.busy && A.busy(true, '영상 넣는 중…');
        for (let k = 0; k < fs.length && start + k < sc.length; k++) await TK().setClip(start + k, fs[k]);
        A.busy && A.busy(false);
        toast(`🎞 영상 ${Math.min(fs.length, sc.length - start)}개를 내려받은 순서대로 장면 ${start + 1}부터 넣고 📥 보관함에도 담았어요`, 4500);
      }
      render(); return;
    }
    const c = inp.closest && inp.closest('.bkb-c'); if (!c || !inp.dataset.in) return;
    const f = inp.files[0]; inp.value = ''; if (!f) return; const i = +c.dataset.i; toLib([f]);
    if (inp.dataset.in === 'img') await setImg(i, f); else await TK().setClip(i, f);
    render();
  });
  /* 🧩 스토리보드 한 장 → 칸 나누기 */
  function gridSheet() {
    const sc = TK().scenes(); if (!sc.length) return toast('먼저 📝 대본·장면에서 AI 답을 정리해 주세요');
    const d = document.createElement('div'); d.className = 'bkk-dim';
    d.innerHTML = `<div class="bkk"><h3>🧩 스토리보드 칸 나누기 <button type="button" data-x="close">✕</button></h3>
      <p class="muted">여러 장면을 한 장에 칸으로 그린 그림을 넣으면 칸마다 잘라 장면에 차례로 넣어요.</p>
      <div class="seg" id="gLay"><button type="button" data-v="2x4" aria-pressed="true">2칸 × 4줄 (8장면)</button><button type="button" data-v="2x2" aria-pressed="false">2 × 2 (4장면)</button><button type="button" data-v="3x3" aria-pressed="false">3 × 3</button></div>
      <div class="seg" id="gStart">${[0, 4].filter(v => v < sc.length).map(v => `<button type="button" data-v="${v}" aria-pressed="${v === 0}">장면 ${v + 1}부터</button>`).join('')}</div>
      <button type="button" class="bb" data-x="req">📋 스토리보드 요청 글 복사 (제미나이 · Flow용)</button>
      <label class="bb pri" style="display:flex;align-items:center;justify-content:center;cursor:pointer">🧩 그림 고르고 나누기<input type="file" accept="image/*" id="gFile" hidden></label></div>`;
    document.body.appendChild(d);
    const val = id => d.querySelector(`#${id} [aria-pressed=true]`).dataset.v;
    d.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.x === 'close') { d.remove(); return; }
      if (b.closest('.seg')) { b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
      if (b.dataset.x === 'req') {
        const [cc, rr] = val('gLay').split('x').map(Number), st = +val('gStart'), part = sc.slice(st, st + cc * rr), t = TK();
        const txt = `Make ONE storyboard image: a grid of ${cc} columns × ${rr} rows, ${part.length} vertical 9:16 panels, thin white gutters, no text, no numbers, no captions.\nSame characters, outfit, place and style in every panel.\n${t.sheet() ? `Characters & style: ${t.sheet()}\n` : ''}${part.map((s, k) => `Panel ${k + 1} (left to right, top to bottom): ${s.img || s.d}`).join('\n')}`;
        if (await copy(txt)) toast('📋 스토리보드 요청 글을 복사했어요'); return;
      }
    });
    d.querySelector('#gFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return; const [cc, rr] = val('gLay').split('x').map(Number), st = +val('gStart');
      const bm = await createImageBitmap(f), w = bm.width / cc, h = bm.height / rr, pad = Math.round(Math.min(w, h) * 0.01), out = [];
      for (let r = 0; r < rr; r++) for (let c2 = 0; c2 < cc; c2++) {
        const cv = document.createElement('canvas'); cv.width = Math.round(w - pad * 2); cv.height = Math.round(h - pad * 2);
        cv.getContext('2d').drawImage(bm, c2 * w + pad, r * h + pad, cv.width, cv.height, 0, 0, cv.width, cv.height);
        out.push(await new Promise(res => cv.toBlob(b => res(new File([b], `장면${st + out.length + 1}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.92)));
      }
      let n = 0; for (let k = 0; k < out.length && st + k < sc.length; k++) { await setImg(st + k, out[k]); n++; }
      toLib(out.slice(0, n)); d.remove(); render(); toast(`🧩 ${n}칸으로 나눠 장면 ${st + 1}부터 넣고 📥 보관함에도 담았어요`, 4000);
    });
  }
  /* 클립이 없을 때 위쪽 미리보기 작게 */
  setInterval(() => { document.body.classList.toggle('bke-noclip', !(A.S.photos && A.S.photos.length)); }, 1000);
  window.__bkeBoard = render;
  loadImgs().then(render);
  document.querySelectorAll('.tabbar [data-tab="scene"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 50)));
})();
