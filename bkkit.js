/*! bkkit.js — BK에딧 공용 도구 (편집하기 · 쇼츠 만들기 · 영상 만들기가 함께 씀)
 * ① ➕ 자료 넣기 판: 📷 갤러리 · 📁 내 파일 · 📥 내 보관함 · 📰 스크랩 · ✍️ 글 · 😂 웃긴 말 · 🎵 노래
 * ② 갤러리 · 내 파일에서 고르면 「📥 보관함에도 담아 둘까요?」 (BK쇼츠와 같은 보관함 'bk-lib' · lib.js 필요)
 * ③ 🎤 말로 쓰기: 크롬 음성 인식 (말한 소리는 글자로 바뀌는 동안만 구글로 가요 · 녹음 파일은 만들지 않아요)
 */
(function (g) {
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const PREF = 'bkPickSave';   // ask · always · never
(function css() {
  if (document.getElementById('bkkCss')) return;
  const s = document.createElement('style'); s.id = 'bkkCss';
  s.textContent = `.bkk-dim{position:fixed;inset:0;z-index:2147482000;background:#0007;display:flex;align-items:flex-end;justify-content:center;font:17px/1.5 "Noto Sans KR",system-ui,sans-serif;color:#111827}
.bkk{width:100%;max-width:560px;max-height:86vh;overflow:auto;background:#fff;border-radius:24px 24px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px #0003}
.bkk h3{margin:2px 0 10px;font-size:1.25rem;display:flex;justify-content:space-between;align-items:center}.bkk h3 button{width:46px;height:46px;border-radius:50%;border:0;background:#eef2f7;font-size:1.2rem}
.bkk .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bkk .op{min-height:76px;border-radius:16px;border:1.5px solid #dbe3ef;background:#fff;font-weight:900;font-size:1rem;padding:8px;text-align:center}
.bkk .op small{display:block;font-weight:600;font-size:.78rem;color:#64748b;margin-top:2px}.bkk .op.hi{background:linear-gradient(135deg,#14b8a6,#0e7490);color:#fff;border:0}.bkk .op.hi small{color:#e0fffa}
.bkk .bb{display:block;width:100%;min-height:56px;margin-top:10px;border-radius:16px;border:0;font-weight:900;font-size:1.05rem;background:#e8eef8;color:#174782}.bkk .bb.pri{background:#0d9488;color:#fff}.bkk .bb:disabled{opacity:.45}
.bkk textarea{width:100%;min-height:150px;border:1.5px solid #dbe3ef;border-radius:14px;padding:12px;font:inherit;box-sizing:border-box}
.bkk .lg{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px}.bkk .lg button{position:relative;aspect-ratio:1;border:2px solid transparent;border-radius:12px;background:#0f172a center/cover no-repeat;padding:0;color:#fff;font-size:1.4rem}
.bkk .lg button.on{border-color:#0d9488;box-shadow:0 0 0 3px #0d948866}.bkk .lg button i{position:absolute;left:4px;top:4px;min-width:24px;height:24px;border-radius:12px;background:#0d9488;font-style:normal;font-size:.8rem;font-weight:900;line-height:24px}
.bkk .lg button em{position:absolute;right:4px;bottom:3px;font-style:normal;font-size:.75rem;background:#0009;border-radius:6px;padding:0 4px}
.bkk .muted{color:#64748b;font-size:.9rem}.bkk .ck{display:flex;gap:8px;align-items:center;margin-top:10px;font-weight:700}.bkk .ck input{width:22px;height:22px}
.bkk .seg{display:flex;gap:6px;margin:8px 0}.bkk .seg button{flex:1;min-height:48px;border-radius:12px;border:1.5px solid #dbe3ef;background:#fff;font-weight:800}.bkk .seg button[aria-pressed=true]{background:#0d9488;color:#fff;border-color:#0d9488}
.bkk-mic{min-height:44px;padding:6px 14px;border-radius:999px;border:0;background:#fee2e2;color:#b91c1c;font-weight:900;font-size:.95rem;cursor:pointer}.bkk-mic.on{background:#dc2626;color:#fff;animation:bkkp 1.2s infinite}
@keyframes bkkp{50%{box-shadow:0 0 0 8px #dc262633}}.bkk-live{color:#94a3b8;font-size:.9rem;min-height:1.3em;margin-top:4px}`;
  document.head.appendChild(s);
})();
function panel(html) {
  const d = document.createElement('div'); d.className = 'bkk-dim'; d.innerHTML = `<div class="bkk">${html}</div>`; document.body.appendChild(d);
  return { el: d, box: d.firstChild, close: () => d.remove() };
}
function pickFiles(accept, multiple) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; if (accept) i.accept = accept; i.multiple = multiple !== false; i.style.display = 'none';
    let done = false; const fin = v => { if (done) return; done = true; i.remove(); res(v); };
    i.addEventListener('change', () => fin(Array.from(i.files || []))); document.body.appendChild(i); i.click();
    window.addEventListener('focus', () => setTimeout(() => fin(Array.from(i.files || [])), 1200), { once: true });
  });
}
const media = f => /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif|mp4|mov|m4v|webm|3gp)$/i.test(f.name || '');

/** 📥 보관함에도 담아 둘까요? */
async function askSave(files) {
  if (!g.BKLIB || !files || !files.length) return;
  let pref = ls(PREF) || 'ask';
  if (pref === 'never') return;
  const big = files.filter(f => /^video\//.test(f.type) && f.size > 200 * 1048576);
  if (pref === 'ask') {
    pref = await new Promise(res => {
      const p = panel(`<h3>📥 보관함에도 담아 둘까요?</h3><p class="muted">담아 두면 다음에 「📥 내 보관함」에서 바로 꺼내 써요. (BK쇼츠와 같은 보관함이에요)${big.length ? `<br>⚠️ 큰 영상 ${big.length}개가 있어요 — 휴대폰 저장 공간을 많이 써요.` : ''}</p>
        <button type="button" class="bb pri" data-v="always">📥 담고 넣기</button><button type="button" class="bb" data-v="never">▶ 그냥 넣기 (이번만 쓰기)</button>
        <label class="ck"><input type="checkbox" id="bkkNo"> 다음부터 묻지 않기 (고른 대로 저절로)</label>`);
      p.box.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; if (p.box.querySelector('#bkkNo').checked) ls(PREF, b.dataset.v); p.close(); res(b.dataset.v); });
    });
  }
  if (pref === 'always') { try { await g.BKLIB.addMany(files); } catch (e) { /* 공간 부족은 무시 */ } }
}
/** 📥 내 보관함에서 고르기 → File 목록 (고른 순서) */
async function fromLib() {
  if (!g.BKLIB) { alert('보관함을 열 수 없어요'); return []; }
  const L = await g.BKLIB.list();
  if (!L.length) { alert('📥 보관함이 비어 있어요.\n갤러리 · 내 파일에서 고를 때 「📥 담고 넣기」를 누르면 담겨요.'); return []; }
  const nImg = L.filter(m => m.kind === 'image').length, nVid = L.length - nImg;
  return new Promise(res => {
    const sel = [];
    const p = panel(`<h3>📥 내 보관함 <button type="button" data-x="close">✕</button></h3><p class="muted">사진 ${nImg}장 · 영상 ${nVid}개 · 톡톡 고르면 고른 순서대로 번호가 붙어요</p>
      <div class="lg">${L.map(m => `<button type="button" data-id="${esc(m.id)}" style="${m.th ? `background-image:url(${m.th})` : ''}">${m.th ? '' : (m.kind === 'video' ? '🎞' : '🖼')}${m.kind === 'video' ? '<em>🎞</em>' : ''}</button>`).join('')}</div>
      <button type="button" class="bb pri" data-x="ok" disabled>사진 · 영상을 톡톡 골라 주세요</button><button type="button" class="bb" data-x="del" disabled>🗑 고른 것 보관함에서 빼기 (갤러리 원본은 그대로)</button>`);
    const upd = () => { p.box.querySelectorAll('.lg button').forEach(b => { const i = sel.indexOf(b.dataset.id); b.classList.toggle('on', i >= 0); const t = b.querySelector('i'); if (t) t.remove(); if (i >= 0) b.insertAdjacentHTML('afterbegin', `<i>${i + 1}</i>`); });
      const ok = p.box.querySelector('[data-x="ok"]'); ok.disabled = !sel.length; ok.textContent = sel.length ? `✅ ${sel.length}개 넣기` : '사진 · 영상을 톡톡 골라 주세요'; p.box.querySelector('[data-x="del"]').disabled = !sel.length; };
    p.box.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.id) { const i = sel.indexOf(b.dataset.id); if (i >= 0) sel.splice(i, 1); else sel.push(b.dataset.id); upd(); return; }
      if (b.dataset.x === 'close') { p.close(); res([]); }
      if (b.dataset.x === 'del') { if (!confirm(`고른 ${sel.length}개를 보관함에서 뺄까요?\n(휴대폰 갤러리의 원본은 그대로예요)`)) return; for (const id of sel) { try { await g.BKLIB.del(id); } catch (er) { /* 무시 */ } } p.close(); res(await fromLib()); }
      if (b.dataset.x === 'ok') { b.textContent = '꺼내는 중…'; let fs = []; try { fs = (await Promise.all(sel.map(id => g.BKLIB.getFile(id)))).filter(Boolean); } catch (er) { fs = []; } p.close(); res(fs); }
    });
  });
}
/** 글 넣기 · 웃긴 말 붙여넣기 */
function textInput(kind, modes) {
  return new Promise(res => {
    const funny = kind === 'funny';
    let as = modes ? modes[0][0] : '';
    const p = panel(`<h3>${funny ? '😂 웃긴 말 붙여넣기' : '✍️ 글 넣기'} <button type="button" data-x="close">✕</button></h3>
      <p class="muted">${funny ? '한 줄 = 한 장면 자막이에요. 복사한 글을 붙여넣거나 🎤로 말해도 돼요.' : '쓰거나 붙여넣어요. 🎤를 누르고 말하면 글씨로 써져요.'}</p>
      ${modes ? `<div class="seg">${modes.map(([v, l]) => `<button type="button" data-as="${v}" aria-pressed="${v === as}">${l}</button>`).join('')}</div>` : ''}
      <textarea id="bkkTx" placeholder="${funny ? '예: 월요일 아침 출근길 표정\n점심 메뉴 고를 때 내 표정' : '여기에 글을 써요'}"></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px"><button type="button" class="bkk-mic" id="bkkMic">🎤 말로 쓰기</button><button type="button" class="bkk-mic" style="background:#e8eef8;color:#174782" id="bkkPaste">📋 붙여넣기</button></div><div class="bkk-live" id="bkkLive"></div>
      <button type="button" class="bb pri" data-x="ok">✅ 넣기</button>`);
    const tx = p.box.querySelector('#bkkTx');
    dictate(tx, p.box.querySelector('#bkkMic'), p.box.querySelector('#bkkLive'));
    p.box.querySelector('#bkkPaste').addEventListener('click', async () => { try { const t = await navigator.clipboard.readText(); tx.value += (tx.value && !/\n$/.test(tx.value) ? '\n' : '') + t; } catch (e) { tx.focus(); alert('칸을 길게 눌러 붙여넣기 해 주세요'); } });
    p.box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.as) { as = b.dataset.as; p.box.querySelectorAll('[data-as]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
      if (b.dataset.x === 'close') { stopAll(); try { tx.blur(); } catch (er) { /* 무시 */ } p.close(); res(null); }
      if (b.dataset.x === 'ok') { stopAll(); const t = tx.value.trim(); try { tx.blur(); } catch (er) { /* 무시 */ } p.close(); res(t ? { text: t, as } : null); }
    });
    setTimeout(() => tx.focus(), 200);
  });
}

/** ➕ 자료 넣기 판. opts: 보일 버튼들 (gallery · files · lib · scrap · text · funny · music) · textModes
 *  → { kind:'files'|'scrap'|'text'|'funny'|'music', files?, text?, as? } 또는 null */
function open(opts) {
  opts = Object.assign({ gallery: 1, files: 1, lib: 1 }, opts || {});
  const B = [
    ['gallery', '📷 사진 · 🎞 영상', '휴대폰 갤러리', 1], ['files', '📁 내 파일', '다운로드한 사진 · 영상'], ['lib', '📥 내 보관함', '담아 둔 사진 · 영상'],
    ['scrap', '📰 스크랩', '신문 · 기사 캡처 사진'], ['text', '✍️ 글 넣기', opts.textHint || '쓰거나 붙여넣기'], ['funny', '😂 웃긴 말', '붙여넣으면 줄마다 자막'], ['music', '🎵 노래', 'MP3 · 음악 파일'],
  ].filter(b => opts[b[0]]);
  return new Promise(res => {
    const p = panel(`<h3>➕ 자료 넣기 <button type="button" data-x="close">✕</button></h3><div class="g2">${B.map(([k, l, s, hi]) => `<button type="button" class="op${hi ? ' hi' : ''}" data-k="${k}">${l}<small>${s}</small></button>`).join('')}</div>`);
    p.box.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.x === 'close') { p.close(); res(null); return; }
      const k = b.dataset.k; if (!k) return; p.close();
      if (k === 'gallery') { const fs = (await pickFiles('image/*,video/*')).filter(media); if (fs.length) await askSave(fs); res(fs.length ? { kind: 'files', files: fs } : null); }
      else if (k === 'files') { const fs = (await pickFiles('')).filter(media); if (fs.length) await askSave(fs); else if (fs) { /* 고른 게 없음 */ } res(fs.length ? { kind: 'files', files: fs } : null); }
      else if (k === 'lib') { const fs = await fromLib(); res(fs.length ? { kind: 'files', files: fs } : null); }
      else if (k === 'scrap') { const fs = (await pickFiles('image/*')).filter(media); if (fs.length) await askSave(fs); res(fs.length ? { kind: 'scrap', files: fs } : null); }
      else if (k === 'music') { const fs = await pickFiles('audio/*,.mp3,.m4a,.wav', false); res(fs.length ? { kind: 'music', files: fs } : null); }
      else { const r = await textInput(k, k === 'text' ? opts.textModes : null); res(r ? Object.assign({ kind: k }, r) : null); }
    });
  });
}

/* ── 🎤 말로 쓰기 (한 문장 말하고 쉬면 다음 줄) ── */
let REC = null;
function stopAll() { if (REC) { REC.keep = false; try { REC.r.stop(); } catch (e) { /* 무시 */ } } }
function dictate(ta, btn, live) {
  const SR = g.SpeechRecognition || g.webkitSpeechRecognition;
  if (!SR) { btn.disabled = true; btn.textContent = '🎤 이 브라우저는 안 돼요'; return; }
  btn.addEventListener('click', () => {
    if (REC && REC.btn === btn) { stopAll(); return; }
    stopAll();
    const r = new SR(); r.lang = 'ko-KR'; r.continuous = true; r.interimResults = true;
    const st = { r, btn, keep: true }; REC = st; btn.classList.add('on'); btn.textContent = '🔴 듣고 있어요 · 누르면 멈춤';
    r.onresult = e => {
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const s = e.results[i][0].transcript.trim(); if (!s) continue;
        if (e.results[i].isFinal) { ta.value += (ta.value && !/\n$/.test(ta.value) ? '\n' : '') + s; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.scrollTop = ta.scrollHeight; }
        else tmp += s + ' ';
      }
      if (live) live.textContent = tmp ? '… ' + tmp : '';
    };
    r.onerror = e => { if (e.error === 'not-allowed') alert('🎤 마이크를 쓸 수 없어요. 크롬 주소창 왼쪽 자물쇠 → 마이크 허용'); else if (e.error === 'network') alert('🎤 말로 쓰기는 인터넷이 연결되어 있어야 해요'); st.keep = false; };
    r.onend = () => { if (REC === st && st.keep) { try { r.start(); return; } catch (e) { /* 끝 */ } } if (REC === st) REC = null; btn.classList.remove('on'); btn.textContent = '🎤 말로 쓰기'; if (live) live.textContent = ''; };
    try { r.start(); } catch (e) { REC = null; btn.classList.remove('on'); btn.textContent = '🎤 말로 쓰기'; }
  });
}
const stop = stopAll;
/** 글자를 그린 사진(글 화면 카드) 만들기 */
function textCard(text, w, h) {
  const c = document.createElement('canvas'); c.width = w || 1080; c.height = h || 1920; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, c.width, c.height); gr.addColorStop(0, '#0f766e'); gr.addColorStop(1, '#1e3a8a'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
  const fs = Math.round(Math.min(c.width, c.height) * .075); x.font = `900 ${fs}px "Noto Sans KR", sans-serif`; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const L = []; for (const para of String(text).split('\n')) { let line = ''; for (const ch of para) { if (x.measureText(line + ch).width > c.width * .82 && line) { L.push(line); line = ch; } else line += ch; } L.push(line); }
  const lh = fs * 1.45, y0 = c.height / 2 - (L.length - 1) * lh / 2; L.forEach((l, i) => x.fillText(l, c.width / 2, y0 + i * lh));
  return new Promise(r => c.toBlob(b => r(new File([b], '글화면_' + Date.now() + '.png', { type: 'image/png' })), 'image/png'));
}
g.BKKIT = { open, askSave, fromLib, textInput, dictate, stop, textCard, pickFiles };
})(window);
