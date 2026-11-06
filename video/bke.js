/*! bke.js — BK에딧 🎬 영상 만들기 첫 화면 (미리보기 없이 · 어떤 영상 + ➕ 자료 넣기 + ✅ 선택 완료)
 * 고른 자료는 원래 칸(사진 · 영상 · 자료 메모 · 대본 · 음악)에 그대로 넣어 줘요 — 영상 만들기 기능은 그대로예요. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), B = document.body, PEND = [];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function start(on) { B.classList.toggle('bke-pre', on); window.scrollTo(0, 0); if (on) sync(); }
  function mirror(srcId, dstId) {
    const src = $(srcId), dst = $(dstId); if (!src || !dst) return;
    dst.innerHTML = [...src.querySelectorAll('button')].map((b, i) => `<button type="button" data-i="${i}" aria-pressed="${b.getAttribute('aria-pressed') === 'true'}">${b.innerHTML}</button>`).join('');
  }
  /* ① 주제 고르기 판 (한눈에 다 보이게 + ✍️ 직접 입력하기) */
  const TK = () => window.__bkeTalk;
  let picked = false;
  function topicName() { const t = TK(); if (!t) return ''; const o = t.TOPICS[t.topic] || {}; return t.topic === 'free' && t.custom ? '✍️ ' + t.custom : `${o.e || ''} ${o.n || ''}`; }
  function sync() {
    const b = $('bkeTopicBtn'); if (b) { b.textContent = picked ? `${topicName()} ✓ (바꾸기)` : '➕ 주제 고르기'; b.classList.toggle('on', picked); }
    const n = $('bkeTopicNow'); if (n) n.textContent = '주제: ' + topicName();
  }
  function topicSheet() {
    const t = TK(); if (!t) return;
    const d = document.createElement('div'); d.className = 'bkk-dim';
    d.innerHTML = `<div class="bkk"><h3>① 어떤 주제로 만들까요? <button type="button" data-x="close">✕</button></h3>
      <div class="tg">${Object.entries(t.TOPICS).filter(([k]) => k !== 'free').map(([k, o]) => `<button type="button" data-k="${k}" aria-pressed="${picked && t.topic === k}">${o.e} ${o.n}</button>`).join('')}</div>
      <button type="button" class="bb" data-x="free">✍️ 직접 입력하기</button>
      <div id="tFree" hidden><textarea id="tFreeTx" style="min-height:70px" placeholder="예: 겨울철 난방비 아끼는 법">${t.topic === 'free' ? (t.custom || '') : ''}</textarea><button type="button" class="bb pri" data-x="freeok">✅ 이 주제로</button></div></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.k) { t.setTopic(b.dataset.k); picked = true; sync(); d.remove(); return; }
      if (b.dataset.x === 'close') d.remove();
      if (b.dataset.x === 'free') { d.querySelector('#tFree').hidden = false; d.querySelector('#tFreeTx').focus(); }
      if (b.dataset.x === 'freeok') { const v = d.querySelector('#tFreeTx').value.trim(); if (!v) return alert('주제를 써 주세요'); t.setTopic('free', v); picked = true; sync(); d.remove(); }
    });
  }
  $('bkeTopicBtn').addEventListener('click', topicSheet);
  $('bkeTopicChange').addEventListener('click', topicSheet);
  /* 📎 넣은 자료 (대본 탭) — AI에게 보낼 때 함께 넘겨요 */
  const SENT = [];
  function showFiles() {
    const box = $('bkeFiles'); if (!box) return;
    box.innerHTML = SENT.length ? SENT.map(f => /^image/.test(f.type) ? `<img src="${f._u || ''}" alt="">` : '<div class="vd">🎞 영상</div>').join('') : '<p class="hint">넣은 사진이 없어요 · 글만 있으면 아래 자료 메모를 써요</p>';
  }
  $('bkeShareAI').addEventListener('click', async () => {
    const t = TK(); if (!t) return; const req = t.buildReq(), imgs = SENT.filter(f => /^image/.test(f.type)).slice(0, 10);
    const files = imgs.map((f, i) => new File([f], f.name || `자료${i + 1}.jpg`, { type: f.type || 'image/jpeg' }));
    try { await navigator.clipboard.writeText(req); } catch (e) { /* 무시 */ }
    try {
      if (files.length && navigator.canShare && navigator.canShare({ files, text: req })) { await navigator.share({ files, text: req }); return; }
      if (navigator.share) { await navigator.share({ text: req }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const b = $('tkReqBtn'); if (b) b.click(); alert('📋 요청서를 복사했어요. AI 앱에 붙여넣고, 사진은 📎로 첨부해 주세요.');
  });
  const isFile = x => x instanceof Blob;
  function render() {
    const box = $('bkePend'); box.hidden = !PEND.length;
    box.innerHTML = PEND.map((x, i) => isFile(x)
      ? `<div class="it" style="${x._u && /^image/.test(x.type) ? `background-image:url(${x._u})` : ''}">${/^video/.test(x.type) ? '🎞 영상' : x._scrap ? '📰 스크랩' : ''}<button type="button" data-x="${i}">✕</button></div>`
      : x.kind === 'music' ? `<div class="it mu">🎵<button type="button" data-x="${i}">✕</button></div>`
      : `<div class="it tx">${x.as === 'memo' ? '📰 기사 · 메모' : '📝 대본'}<br>${esc(x.text.slice(0, 18))}<button type="button" data-x="${i}">✕</button></div>`).join('') + `<span class="cnt">${PEND.length}개 담았어요</span>`;
    $('bkeDone').disabled = !PEND.length || !picked;
    $('bkeInfo').textContent = !picked ? '먼저 ① 주제를 골라 주세요' : PEND.length ? `${topicName()} · 자료 ${PEND.length}개 · 누르면 편집 화면으로 가요` : '② 자료 넣기로 사진 · 기사 글을 넣어 주세요';
    document.querySelectorAll('.bke-steps b').forEach((b, i) => b.classList.toggle('on', PEND.length ? i === 1 : i === 0));
  }
  $('bkePend').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (!b) return; const x = PEND.splice(+b.dataset.x, 1)[0]; if (x && x._u) URL.revokeObjectURL(x._u); render(); });
  const push = (fs, mark) => { for (const f of fs) { try { f._u = URL.createObjectURL(f); } catch (e) { /* 무시 */ } if (mark) f[mark] = 1; PEND.push(f); } render(); };
  $('bkeAdd').addEventListener('click', async () => {
    if (!window.BKKIT) return;
    const r = await window.BKKIT.open({ gallery: 1, files: 1, lib: 1, text: 1, textHint: '기사 · 자료 글 붙여넣기' });
    if (!r) return;
    if (r.kind === 'files') push(r.files);
    else if (r.kind === 'scrap') push(r.files, '_scrap');
    else if (r.kind === 'music') { PEND.push({ kind: 'music', file: r.files[0] }); render(); }
    else { PEND.push({ kind: 'text', text: r.text, as: r.kind === 'funny' ? 'script' : (r.as || 'memo') }); render(); }
  });
  function feed(id, files) { const el = $(id); if (!el || !files.length) return; try { const dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); el.files = dt.files; el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* 무시 */ } }
  function addText(id, t) { const el = $(id); if (!el) return; el.value = (el.value.trim() ? el.value.replace(/\s*$/, '\n') : '') + t; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  $('bkeDone').addEventListener('click', async () => {
    const files = PEND.filter(isFile), imgs = files.filter(f => /^image/.test(f.type)), vids = files.filter(f => /^video/.test(f.type));
    const memo = PEND.filter(x => !isFile(x) && x.as === 'memo'), script = PEND.filter(x => !isFile(x) && x.as === 'script'), mus = PEND.find(x => x.kind === 'music');
    feed('photoInput', imgs); feed('videoInput', vids); if (mus) feed('musicInput', [mus.file]);
    SENT.length = 0; files.forEach(f => SENT.push(f)); showFiles();
    memo.forEach(x => addText('tkMemo', x.text));
    if (script.length) { addText('tkAns', script.map(x => x.text).join('\n')); const p = $('tkParse'); if (p) setTimeout(() => p.click(), 150); }
    PEND.length = 0; render(); start(false);
    const tab = document.querySelector('.tabbar [data-tab="script"]'); if (tab) setTimeout(() => tab.click(), 250);
  });
  $('bkeSkip').addEventListener('click', () => start(false));
  $('bkeToStart').addEventListener('click', e => { e.target.closest('details').open = false; start(true); });
  // 대본 칸에도 🎤 말로 쓰기
  if (window.BKKIT) [['tkAns', '말한 대본이 한 줄씩 써져요'], ['tkMemo', '말한 내용이 자료 메모로 써져요']].forEach(([id, tip]) => {
    const ta = $(id); if (!ta) return;
    const w = document.createElement('div'); w.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:6px';
    w.innerHTML = `<button type="button" class="bkk-mic">🎤 말로 쓰기</button><small style="color:#64748b">${tip}</small>`;
    const live = document.createElement('div'); live.className = 'bkk-live';
    ta.insertAdjacentElement('afterend', live); ta.insertAdjacentElement('afterend', w);
    window.BKKIT.dictate(ta, w.firstChild, live);
  });
  showFiles(); setTimeout(sync, 300); sync(); render();
  $('bkeTopicBtn').addEventListener('click', () => setTimeout(render, 50)); document.addEventListener('click', e => { if (e.target.closest('.bkk-dim')) setTimeout(render, 80); });
})();
