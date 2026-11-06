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
    const files = imgs.map((f, i) => new File([f], f.name || `자료${i + 1}.jpg`, { type: f.type || 'image/jpeg' })).concat(window.__bkeRefFiles ? window.__bkeRefFiles() : []);
    try { await navigator.clipboard.writeText(req); } catch (e) { /* 무시 */ }
    try {
      if (files.length && navigator.canShare && navigator.canShare({ files, text: req })) { await navigator.share({ files, text: req }); return; }
      if (files.length > 1 && navigator.canShare) { const f2 = files.filter(f => !/^video/.test(f.type)); if (f2.length && navigator.canShare({ files: f2, text: req })) { await navigator.share({ files: f2, text: req }); alert('⚠️ 참고 영상은 커서 함께 못 보냈어요 (모아보기 그림은 보냈어요). AI 앱에서 📎로 영상을 따로 첨부해 주세요.'); return; } }
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
    const r = await window.BKKIT.open({ gallery: 1, files: 1, lib: 1, text: 1, ref: 1, textHint: '기사 · 자료 글 붙여넣기' });
    if (!r) return;
    if (r.kind === 'ref') { window.BKKIT.refSet('video', r.ref); useRef(r.ref, true); return; }
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
  /* 🔄 새로 시작: 예전 주제 · 자료 · 대본 · AI 답 · 장면 · 장면 사진 · 복사 표시를 한 번에 지우기 (화면 스타일 · 장면 길이 · 분량 설정과 📥 보관함 · 라이선스는 그대로) */
  document.addEventListener('click', e => {
    const b = e.target.closest('.bke-reset'); if (!b) return;
    const m = b.closest('details'); if (m) m.open = false;
    if (!confirm('🔄 새로 시작할까요?\n\n지워지는 것: 주제 · 넣은 자료 · 자료 메모 · AI 답 · 대본 · 장면 카드 · 장면 사진 · 넣은 영상 · 목소리\n그대로인 것: 📥 보관함 · 화면 스타일 · 장면 길이 · 라이선스\n\n필요한 대본은 먼저 복사해 두세요.')) return;
    window.__bkeResetting = true;
    const wipe = () => { try { Object.keys(localStorage).filter(x => x.indexOf('bkdraft:bk-edit/video') === 0).forEach(x => localStorage.removeItem(x)); } catch (er) { /* 무시 */ } };
    document.querySelectorAll('textarea,input[type=text]').forEach(x => { x.value = ''; }); wipe(); window.addEventListener('pagehide', wipe);   // 나가며 저장되는 쓰던 내용까지 지우기
    location.replace(location.pathname + '?bkereset=' + Date.now());
  });
  /* 🧹 자료 메모 지우기 */
  if ($('tkMemoClr')) $('tkMemoClr').addEventListener('click', e => { e.preventDefault(); const m = $('tkMemo'); if (!m.value.trim() || !confirm('자료 메모를 모두 지울까요?')) return; m.value = ''; m.dispatchEvent(new Event('input', { bubbles: true })); });
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
  /* 🎞 참고 영상 (선택): 영상 + 모아보기 그림(장면 6장) · 링크 · 따라 할 점 → 요청서와 공유에 함께 */
  const REF = { files: [], sheet: null };
  const KIT = window.BKKIT || {}, WHAT = KIT.REFTAG || {};
  const MOVE = ['act', 'dance', 'face', 'gest', 'move', 'angle', 'cam', 'shot'];
  function setWhat(on) { const el = $('bkeRefWhat'); if (el && KIT.whatHTML) el.innerHTML = KIT.whatHTML(on); }
  function setLvl(v) { const el = $('bkeRefLvl'); if (el && KIT.REFLVL) el.innerHTML = KIT.REFLVL.map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${k === v}">${l}</button>`).join(''); }
  setWhat(['hook', 'flow', 'act', 'tone']); setLvl('similar');
  if ($('bkeRefLvl')) $('bkeRefLvl').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) setLvl(b.dataset.v); });
  async function contact(f) {   // 참고 영상에서 장면 6장을 뽑아 한 장의 모아보기 그림으로 (ChatGPT처럼 영상을 못 보는 AI용)
    return new Promise(res => {
      const v = document.createElement('video'), u = URL.createObjectURL(f); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = u;
      const fin = r => { URL.revokeObjectURL(u); res(r); }; setTimeout(() => fin(null), 15000);
      v.onloadedmetadata = async () => {
        const n = 6, w = 300, h = Math.round(w * (v.videoHeight || 16) / (v.videoWidth || 9)), c = document.createElement('canvas'); c.width = w * 3; c.height = h * 2; const x = c.getContext('2d');
        for (let i = 0; i < n; i++) { await new Promise(r => { v.onseeked = r; v.currentTime = Math.min(v.duration - 0.1, (i + 0.5) * v.duration / n); setTimeout(r, 2000); }); x.drawImage(v, (i % 3) * w, Math.floor(i / 3) * h, w, h); x.fillStyle = '#fde047'; x.font = '900 28px sans-serif'; x.fillText(String(i + 1), (i % 3) * w + 10, Math.floor(i / 3) * h + 36); }
        c.toBlob(b => fin(b ? new File([b], '참고영상_모아보기.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', .85);
      };
      v.onerror = () => fin(null);
    });
  }
  function showRef() { const box = $('bkeRefFiles'); if (!box) return; box.innerHTML = REF.files.map(f => `<div class="vd" style="width:96px;height:96px;border-radius:10px;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8rem">🎞 ${esc((f.name || '').slice(0, 10))}</div>`).join('') + (REF.sheet ? `<img src="${URL.createObjectURL(REF.sheet)}" alt="">` : ''); }
  if ($('bkeRefAdd')) $('bkeRefAdd').addEventListener('click', async () => {
    if (!window.BKKIT) return; const r = await window.BKKIT.open({ gallery: 1, files: 1, lib: 1 }); if (!r || !r.files) return;
    const vs = r.files.filter(f => /^video/.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name || '')).slice(0, 1); if (!vs.length) return alert('참고 영상(동영상 파일)을 골라 주세요');
    if (vs[0].size > 60 * 1048576) alert('⚠️ 영상이 커서(60MB 넘음) 공유가 안 될 수 있어요. 1분 안팎 영상을 권해요.');
    REF.files = vs; REF.sheet = await contact(vs[0]); showRef(); window.BKKIT && document.getElementById('bkeRef') && (document.getElementById('bkeRef').open = true);
  });
  if ($('bkeRefClear')) $('bkeRefClear').addEventListener('click', () => { REF.files = []; REF.sheet = null; showRef(); });
  if ($('bkeRefWhat')) $('bkeRefWhat').addEventListener('click', e => { const b = e.target.closest('button[data-w]'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
  window.__bkeRef = () => {
    const link = ($('bkeRefLink') && $('bkeRefLink').value.trim()) || '', note = ($('bkeRefNote') && $('bkeRefNote').value.trim()) || '';
    if (!REF.files.length && !link) return '';
    const rm = (window.__bkeRefMemo || '').trim();
    const on = [...document.querySelectorAll('#bkeRefWhat button[aria-pressed=true]')].map(b => b.dataset.w), what = on.map(k => (WHAT[k] || '').replace(/^[^\s가-힣A-Za-z0-9(]+\s/u, '')).filter(Boolean);
    const lvl = (document.querySelector('#bkeRefLvl [aria-pressed=true]') || { dataset: {} }).dataset.v || 'similar', mv = on.some(k => MOVE.includes(k));
    const L = { feel: '느낌 · 분위기만 참고해 줘.', similar: '고른 점들을 비슷하게 따라 해 줘.', max: '동작까지 최대한 비슷하게 — 참고 영상을 장면별로 나눠, 각 장면의 동작 · 춤 · 표정 · 손짓 · 카메라 각도 · 카메라 움직임을 초 단위로 아주 자세히 분석해서 우리 장면의 영상 프롬프트(영어)에 그대로 구체적으로 넣어 줘 (예: 0-2s: she raises her right arm, spins once, claps twice; camera slowly zooms in).' };
    return `\n\n[참고 영상]\n${REF.files.length ? '- 첨부한 참고 영상(과 장면 모아보기 그림)을 꼭 처음부터 끝까지 보고 분석해 줘.\n' : ''}${link ? `- 참고 링크: ${link}\n` : ''}${rm ? `- 내가 본 점: ${rm}\n` : ''}${note ? `- 자세히: ${note}\n` : ''}- 따라 할 점: ${what.join(' · ') || '전체적인 느낌'}\n- 얼마나: ${L[lvl]}\n${mv ? '- 움직임 · 촬영: 영상 프롬프트마다 참고 영상의 동작 · 카메라를 구체적인 영어 동사로 적어 줘 (raises, spins, claps, leans, walks toward camera, close-up, tracking shot 등). "dancing"처럼 뭉뚱그리지 말 것.\n' : ''}- 인물 · 대사 · 내용은 내 자료와 설정(등장인물)으로 새로 만들어 줘. 장면 · 대사 · 음악을 그대로 베끼지 말 것.`;
  };
  window.__bkeRefFiles = () => REF.files.concat(REF.sheet ? [REF.sheet] : []);
  /* 🎯 참고 영상 (내 레퍼런스): 링크 · 따라 할 점 · 메모 → 「🎞 참고 영상」 칸 + 위 띠 */
  function useRef(pk, fresh) {
    if (!pk || !(pk.url || pk.kind === 'file')) return;
    if ($('bkeRefLink')) $('bkeRefLink').value = pk.url || '';
    if ((pk.tags || []).length) setWhat(pk.tags);
    if (pk.lvl) setLvl(pk.lvl);
    window.__bkeRefMemo = [pk.title ? `「${pk.title}」` : '', pk.memo || ''].filter(Boolean).join(' ');
    if (pk.kind === 'file' && KIT.refFile) KIT.refFile(pk.id).then(async f => { if (!f) return; REF.files = [f]; showRef(); REF.sheet = await contact(f); showRef(); });
    if (fresh && $('bkeRef')) $('bkeRef').open = true;
    showRefBar();
    if (fresh) { const t = document.createElement('div'); t.textContent = '🎯 참고 영상을 붙였어요 — 위 띠에서 ▶ 다시 볼 수 있어요'; t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#111827;color:#fff;padding:12px 16px;border-radius:14px;font-weight:800;z-index:2147483000;max-width:90vw;text-align:center'; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
  }
  function clearRef() { if ($('bkeRefLink')) $('bkeRefLink').value = ''; window.__bkeRefMemo = ''; REF.files = []; REF.sheet = null; showRef(); }
  function showRefBar() { if (window.BKKIT) window.BKKIT.refBar('video', [$('bkeStart'), document.querySelector('[data-panel="script"] .bke-src')], clearRef); }
  try {
    const pk = JSON.parse(localStorage.getItem('bkeRefPick') || 'null');
    if (pk && (pk.url || pk.kind === 'file') && /[?&]ref=1/.test(location.search)) { localStorage.removeItem('bkeRefPick'); history.replaceState(null, '', location.pathname); if (window.BKKIT) window.BKKIT.refSet('video', pk); useRef(pk, true); }
    else if (window.BKKIT && window.BKKIT.refGet('video')) useRef(window.BKKIT.refGet('video'), false);
  } catch (e) { /* 무시 */ }
  showFiles(); setTimeout(sync, 300); sync(); render();
  $('bkeTopicBtn').addEventListener('click', () => setTimeout(render, 50)); document.addEventListener('click', e => { if (e.target.closest('.bkk-dim')) setTimeout(render, 80); });
})();
