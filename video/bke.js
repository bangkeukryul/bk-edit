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
  function sync() { mirror('tkTopics', 'bkeTopics'); mirror('tkLen', 'bkeLen'); }
  [['bkeTopics', 'tkTopics'], ['bkeLen', 'tkLen']].forEach(([d, s]) => $(d).addEventListener('click', e => { const x = e.target.closest('button'); if (!x) return; const real = $(s).querySelectorAll('button')[+x.dataset.i]; if (real) real.click(); setTimeout(sync, 60); }));
  const isFile = x => x instanceof Blob;
  function render() {
    const box = $('bkePend'); box.hidden = !PEND.length;
    box.innerHTML = PEND.map((x, i) => isFile(x)
      ? `<div class="it" style="${x._u && /^image/.test(x.type) ? `background-image:url(${x._u})` : ''}">${/^video/.test(x.type) ? '🎞 영상' : x._scrap ? '📰 스크랩' : ''}<button type="button" data-x="${i}">✕</button></div>`
      : x.kind === 'music' ? `<div class="it mu">🎵<button type="button" data-x="${i}">✕</button></div>`
      : `<div class="it tx">${x.as === 'memo' ? '📰 기사 · 메모' : '📝 대본'}<br>${esc(x.text.slice(0, 18))}<button type="button" data-x="${i}">✕</button></div>`).join('') + `<span class="cnt">${PEND.length}개 담았어요</span>`;
    $('bkeDone').disabled = !PEND.length;
    $('bkeInfo').textContent = PEND.length ? `${PEND.length}개 · 누르면 편집 화면으로 가요` : '➕ 자료 넣기로 사진 · 기사 · 글을 넣어 주세요';
    document.querySelectorAll('.bke-steps b').forEach((b, i) => b.classList.toggle('on', PEND.length ? i === 1 : i === 0));
  }
  $('bkePend').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (!b) return; const x = PEND.splice(+b.dataset.x, 1)[0]; if (x && x._u) URL.revokeObjectURL(x._u); render(); });
  const push = (fs, mark) => { for (const f of fs) { try { f._u = URL.createObjectURL(f); } catch (e) { /* 무시 */ } if (mark) f[mark] = 1; PEND.push(f); } render(); };
  $('bkeAdd').addEventListener('click', async () => {
    if (!window.BKKIT) return;
    const r = await window.BKKIT.open({ gallery: 1, files: 1, lib: 1, scrap: 1, text: 1, funny: 1, music: 1, textModes: [['memo', '📰 기사 · 자료 메모로'], ['script', '📝 대본으로 바로']], textHint: '기사 · 자료 · 대본' });
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
    memo.forEach(x => addText('tkMemo', x.text));
    if (script.length) { addText('tkAns', script.map(x => x.text).join('\n')); const p = $('tkParse'); if (p) setTimeout(() => p.click(), 150); }
    PEND.length = 0; render(); start(false);
    const tab = document.querySelector(`.tabbar [data-tab="${(memo.length || script.length) ? 'script' : 'scene'}"]`); if (tab) setTimeout(() => tab.click(), 250);
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
  setTimeout(sync, 300); sync(); render();
})();
