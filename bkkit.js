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
.bkk .op small{display:block;font-weight:600;font-size:.78rem;color:#64748b;margin-top:2px}.bkk .op.hi{background:linear-gradient(135deg,#14b8a6,#0e7490);color:#fff;border:0}.bkk .op.hi small{color:#e0fffa}.bkk .op.wide{grid-column:1/-1;min-height:64px;background:linear-gradient(135deg,#f5f3ff,#fdf2f8);border-color:#ddd6fe;color:#5b21b6}
.bkk-rl{display:grid;grid-template-columns:64px 1fr auto;gap:8px;align-items:center;border:1.5px solid #e2e8f0;border-radius:14px;padding:6px;margin-bottom:6px}.bkk-rl i{width:64px;height:64px;border-radius:10px;background:#0f172a center/cover;display:block}.bkk-rl b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.9rem;line-height:1.3}.bkk-rl small{display:block;color:#64748b;font-size:.75rem}.bkk-rl button{min-height:44px;padding:0 12px;border-radius:12px;border:0;background:#5b21b6;color:#fff;font-weight:900}
.bkk-pg{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:8px 0}.bkk-pg button{min-width:42px;min-height:42px;border-radius:10px;border:1.5px solid #cbd5e1;background:#fff;font-weight:900;color:#5b21b6}.bkk-pg button.on{background:#5b21b6;color:#fff;border-color:#5b21b6}
.bkk-refbar{display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#f5f3ff,#fdf2f8);border:1.5px solid #ddd6fe;border-radius:14px;padding:6px 8px;margin:0 0 10px;font:15px/1.35 "Noto Sans KR",system-ui,sans-serif;color:#111827}.bkk-refbar i{flex:none;width:44px;height:44px;border-radius:8px;background:#0f172a center/cover}.bkk-refbar div{flex:1;min-width:0}.bkk-refbar div b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.88rem}.bkk-refbar div small{color:#7c3aed;font-weight:800;font-size:.75rem}.bkk-refbar button{flex:none;min-height:40px;padding:0 10px;border-radius:10px;border:0;background:#5b21b6;color:#fff;font-weight:900;font-size:.85rem}.bkk-refbar button.x{background:#fff;color:#64748b;border:1.5px solid #e2e8f0}
.bkk-refchip{flex:none;min-height:36px;padding:0 10px;border-radius:999px;border:0;background:#ede9fe;color:#5b21b6;font-weight:900;font-size:.82rem;max-width:42vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bkk-play{position:relative;width:100%;aspect-ratio:9/16;max-height:60vh;background:#000;border-radius:14px;overflow:hidden}.bkk-play iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.bkk-wg{margin:6px 0}.bkk-wg>span{display:block;font-weight:900;font-size:.82rem;color:#5b21b6;margin:6px 0 4px}.bkk-wg>div{display:flex;flex-wrap:wrap;gap:6px}.bkk-wg button{min-height:38px;padding:0 10px;border-radius:999px;border:1.5px solid #ddd6fe;background:#fff;color:#5b21b6;font-weight:800;font-size:.84rem}.bkk-wg button[aria-pressed=true]{background:#5b21b6;border-color:#5b21b6;color:#fff}
.bkk-tags span{display:inline-block;background:#ede9fe;color:#5b21b6;border-radius:8px;padding:0 6px;margin:0 4px 4px 0;font-weight:800;font-size:.8rem}
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
    ['scrap', '📰 스크랩', '신문 · 기사 캡처 사진'], ['text', '✍️ 글 넣기', opts.textHint || '쓰거나 붙여넣기'], ['funny', '😂 웃긴 말', '붙여넣으면 줄마다 자막'], ['music', '🎵 노래', 'Suno MP3 · 음악 파일'], ['ref', '🎯 내 레퍼런스', '담아 둔 잘된 영상 (따라 할 본보기)', 0, 'wide'],
  ].filter(b => opts[b[0]]);
  return new Promise(res => {
    const p = panel(`<h3>➕ 자료 넣기 <button type="button" data-x="close">✕</button></h3><div class="g2">${B.map(([k, l, s, hi, cls]) => `<button type="button" class="op${hi ? ' hi' : ''}${cls ? ' ' + cls : ''}" data-k="${k}">${l}<small>${s}</small></button>`).join('')}</div>`);
    p.box.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.x === 'close') { p.close(); res(null); return; }
      const k = b.dataset.k; if (!k) return; p.close();
      if (k === 'gallery') { const fs = (await pickFiles('image/*,video/*')).filter(media); if (fs.length) await askSave(fs); res(fs.length ? { kind: 'files', files: fs } : null); }
      else if (k === 'files') {
        const all = await pickFiles(''), fs = all.filter(media), au = opts.music ? all.filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(f.name || '')) : [];
        if (fs.length) await askSave(fs);
        if (!fs.length && !au.length && all.length) alert(opts.music ? '사진 · 영상 · 노래(MP3) 파일만 넣을 수 있어요' : '사진 · 영상 파일만 넣을 수 있어요');
        res(fs.length || au.length ? { kind: 'files', files: fs, music: au } : null);
      }
      else if (k === 'lib') { const fs = await fromLib(); res(fs.length ? { kind: 'files', files: fs } : null); }
      else if (k === 'scrap') { const fs = (await pickFiles('image/*')).filter(media); if (fs.length) await askSave(fs); res(fs.length ? { kind: 'scrap', files: fs } : null); }
      else if (k === 'ref') { const it = await refPick(); res(it ? { kind: 'ref', ref: it } : null); }
      else if (k === 'music') { const box = await musicBox(); const it = box.length ? await musicPick(box) : 'file'; if (it === 'file') { const fs = await pickFiles('audio/*,.mp3,.m4a,.wav', false); res(fs.length ? { kind: 'music', files: [], music: fs } : null); } else res(it ? musicOut(it) : null); }
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
/* ═══ 🎯 내 레퍼런스 (🔎 레퍼런스에서 📌 담은 영상 · IndexedDB 'bk-editapp-ref') — 주소 · 메모만, 영상 파일은 아님 ═══ */
const REFWHAT = [
  ['🎬 구성', [['hook', '🪝 첫 3초 후킹'], ['flow', '전체 흐름 (기승전결)'], ['twist', '반전 · 결말'], ['len', '⏱ 길이 · 장면 수']]],
  ['🕺 움직임', [['act', '동작 · 행동'], ['dance', '💃 춤 (안무)'], ['face', '표정 · 리액션'], ['gest', '손짓 · 몸짓'], ['move', '걷기 · 뛰기 · 동선']]],
  ['🎥 촬영', [['angle', '카메라 각도 (정면 · 위 · 아래)'], ['cam', '카메라 움직임 (줌 · 따라가기)'], ['shot', '화면 크기 (얼굴 · 전신)'], ['pace', '✂️ 컷 바뀌는 빠르기']]],
  ['👤 인물 · 장소', [['cast', '인물 수 · 관계'], ['outfit', '옷 · 소품'], ['place', '장소 · 배경'], ['light', '조명 · 색감 · 분위기']]],
  ['🗣 소리 · 말', [['tone', '말투 · 대사 리듬'], ['narr', '내레이션'], ['music', '🎵 음악 분위기 · 박자'], ['sfx', '효과음']]],
  ['💬 글자', [['cap', '💬 자막 모양 · 위치'], ['big', '큰 글씨 강조'], ['thumb', '🖼 썸네일 문구']]],
];
const REFLVL = [['feel', '느낌만'], ['similar', '비슷하게'], ['max', '동작까지 최대한']];
const REFTAG = Object.fromEntries(REFWHAT.flatMap(g => g[1]));
/** 묶음별 고르기 칩 (레퍼런스 메모 · 영상 만들기 참고 영상에서 같이 써요) */
function whatHTML(on) {
  return REFWHAT.map(([g, L]) => `<div class="bkk-wg"><span>${g}</span><div>${L.map(([k, l]) => `<button type="button" data-w="${k}" aria-pressed="${(on || []).includes(k)}">${l}</button>`).join('')}</div></div>`).join('');
}
function refFile(id) {
  return new Promise(res => {
    let r; try { r = indexedDB.open('bk-editapp-ref', 1); } catch (e) { return res(null); }
    r.onupgradeneeded = () => r.result.createObjectStore('r');
    r.onsuccess = () => { try { const q = r.result.transaction('r').objectStore('r').get(id); q.onsuccess = () => { const v = q.result; res(v && v.file ? new File([v.file], v.file.name || ((v.title || '참고영상') + '.mp4'), { type: v.file.type || 'video/mp4' }) : null); }; q.onerror = () => res(null); } catch (e) { res(null); } };
    r.onerror = () => res(null);
  });
}
const nview = n => { n = +n || 0; return n >= 1e8 ? (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억' : n >= 1e4 ? Math.round(n / 1e4).toLocaleString() + '만' : n.toLocaleString(); };
function refAll() {
  return new Promise(res => {
    let r; try { r = indexedDB.open('bk-editapp-ref', 1); } catch (e) { return res([]); }
    r.onupgradeneeded = () => r.result.createObjectStore('r');
    r.onsuccess = () => { try { const q = r.result.transaction('r').objectStore('r').getAll(); q.onsuccess = () => res((q.result || []).sort((a, b) => (b.at || 0) - (a.at || 0))); q.onerror = () => res([]); } catch (e) { res([]); } };
    r.onerror = () => res([]);
  });
}
/* ═══ 🎵 BK뮤직 노래함 (BK톡톡 · 같은 주소라 이 휴대폰에서 바로 읽어요 · 읽기만 해요) ═══ */
function musicBox() {
  return new Promise(res => {
    let r; try { r = indexedDB.open('bk-music'); } catch (e) { return res([]); }
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { /* 새로 만들지 않기 */ } };
    r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('songs')) { d.close(); return res([]); } try { const q = d.transaction('songs').objectStore('songs').getAll(); q.onsuccess = () => { d.close(); res((q.result || []).filter(s => s.blob).sort((a, b) => (b.at || 0) - (a.at || 0))); }; q.onerror = () => { d.close(); res([]); }; } catch (e) { d.close(); res([]); } };
    r.onerror = () => res([]);
  });
}
function dataFile(u, name) { try { const m = /^data:([^;]+);base64,(.*)$/.exec(u || ''); if (!m) return null; const b = atob(m[2]), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return new File([a], name, { type: m[1] }); } catch (e) { return null; } }
function musicOut(s) {
  const ext = (s.name && (s.name.match(/\.[^.]+$/) || [])[0]) || '.' + (((s.type || 'audio/mpeg').split('/')[1] || 'mp3').replace('mpeg', 'mp3'));
  const f = new File([s.blob], (s.title || '노래').replace(/[\\/:*?"<>|]/g, '') + ext, { type: s.type || s.blob.type || 'audio/mpeg' });
  return { kind: 'music', files: [], music: [f], title: s.title || '', lyrics: s.lyrics || '', cover: s.thumb ? dataFile(s.thumb, (s.title || '노래') + '_표지.jpg') : null };
}
function musicPick(box) {
  return new Promise(res => {
    const p = panel(`<h3>🎵 어떤 노래를 넣을까요? <button type="button" data-x="close">✕</button></h3>
      <div style="display:grid;gap:6px;max-height:52vh;overflow:auto">${box.map((s, i) => `<button type="button" class="bkk-rl" data-i="${i}" style="text-align:left;background:#fff"><i style="${s.thumb ? `background-image:url('${s.thumb}')` : ''};display:flex;align-items:center;justify-content:center;color:#fff">${s.thumb ? '' : '🎵'}</i><div style="min-width:0"><b>${esc(s.title || '노래')}</b><small>${s.lyrics ? '📝 가사 있음 · 자동으로 맞춰요' : '가사 없음'}</small></div><span style="font-weight:900;color:#5b21b6">고르기</span></button>`).join('')}</div>
      <button type="button" class="op" data-f="1" style="width:100%;margin-top:8px;min-height:56px">📁 휴대폰에서 MP3 고르기</button>
      <p style="color:#64748b;font-size:.85rem;margin:6px 0 0">🎵 BK뮤직 💾 내 노래함에 넣은 노래예요. 가사가 있으면 노래방 자막이 자동으로 들어가요.</p>`);
    p.box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.x) { p.close(); return res(null); } if (b.dataset.f) { p.close(); return res('file'); } if (b.dataset.i != null) { p.close(); res(box[+b.dataset.i]); } });
  });
}
const REFHOME = (location.pathname.match(/^(.*?\/bk-edit\/)/) || [, '/bk-edit/'])[1] + 'ref.html';
async function refPick() {
  const all = await refAll();
  return new Promise(res => {
    const p = panel(`<h3>🎯 내 레퍼런스 <button type="button" data-x="close">✕</button></h3>
      ${all.length ? '<input type="text" id="bkkRq" placeholder="🔍 찾기" style="width:100%;box-sizing:border-box;min-height:46px;border-radius:12px;border:1.5px solid #cbd5e1;padding:8px 12px;font-size:1rem;margin-bottom:8px">' : ''}
      <div id="bkkRl"></div><div class="bkk-pg" id="bkkRp"></div>
      <p style="color:#64748b;font-size:.85rem;margin:6px 0 0">💡 영상 파일이 아니라 <b>따라 할 본보기(주소 · 메모)</b>예요. <a href="${REFHOME}" style="color:#5b21b6;font-weight:800">🔎 레퍼런스에서 더 담기</a></p>`);
    let pg = 0, q = '';
    const draw = () => {
      const L = all.filter(r => !q || ((r.title || '') + ' ' + (r.memo || '')).includes(q)), n = Math.max(1, Math.ceil(L.length / 10)); if (pg >= n) pg = n - 1;
      p.box.querySelector('#bkkRl').innerHTML = L.slice(pg * 10, pg * 10 + 10).map(r => `<div class="bkk-rl"><i style="${r.thumb ? `background-image:url('${esc(r.thumb)}')` : ''}"></i><div style="min-width:0"><b>${esc(r.title || r.url)}</b><small>${r.views ? '👀 ' + nview(r.views) + '회 · ' : ''}${(r.tags || []).map(t => REFTAG[t] || '').filter(Boolean).join(' ')}</small></div><button type="button" data-id="${esc(r.id)}">고르기</button></div>`).join('')
        || `<p style="text-align:center;color:#64748b;padding:14px 0">${all.length ? '찾는 레퍼런스가 없어요' : '아직 담은 영상이 없어요.<br>🔎 레퍼런스에서 📌 담기를 해 주세요.'}</p>`;
      p.box.querySelector('#bkkRp').innerHTML = n < 2 ? '' : Array.from({ length: n }, (_, i) => `<button type="button" data-pg="${i}"${i === pg ? ' class="on"' : ''}>${i + 1}</button>`).join('');
    };
    draw();
    const f = p.box.querySelector('#bkkRq'); if (f) f.addEventListener('input', () => { q = f.value.trim(); pg = 0; draw(); });
    p.box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.x === 'close') { p.close(); res(null); return; }
      if (b.dataset.pg) { pg = +b.dataset.pg; draw(); return; }
      if (b.dataset.id) { const it = all.find(r => r.id === b.dataset.id); p.close(); res(it || null); }
    });
  });
}
async function refPlay(it) {
  const yt = it.kind === 'yt' && it.vid, f = it.kind === 'file' ? await refFile(it.id) : null, fu = f ? URL.createObjectURL(f) : '';
  const p = panel(`<h3>🎯 ${esc((it.title || '참고 영상').slice(0, 30))} <button type="button" data-x="close">✕</button></h3>
    ${f ? `<div class="bkk-play"><video src="${fu}" controls playsinline autoplay style="position:absolute;inset:0;width:100%;height:100%;background:#000"></video></div>` : it.kind === 'file' ? '<p>⚠️ 이 휴대폰에서 영상 파일을 찾지 못했어요</p>' : ''}
    ${yt ? `<div class="bkk-play"><iframe src="https://www.youtube-nocookie.com/embed/${esc(it.vid)}?playsinline=1&autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>` : ''}
    ${(it.tags && it.tags.length) || it.memo ? `<div class="bkk-tags" style="margin-top:8px">${(it.tags || []).map(t => `<span>${REFTAG[t] || t}</span>`).join('')}</div>${it.memo ? `<p style="margin:4px 0 0;background:#faf5ff;border-radius:10px;padding:8px">📝 ${esc(it.memo)}</p>` : ''}` : ''}
    ${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:10px;min-height:50px;line-height:50px;border-radius:14px;background:#ede9fe;color:#5b21b6;font-weight:900;text-decoration:none">↗ ${yt ? '유튜브' : '원래 사이트'}에서 보기</a>` : ''}`);
  const cl = () => { p.close(); if (fu) URL.revokeObjectURL(fu); };
  p.box.addEventListener('click', e => { if (e.target.closest('[data-x="close"]')) cl(); });
  p.el.addEventListener('click', e => { if (e.target === p.el) cl(); });
}
/** 이 화면(쇼츠 · 영상)에 붙인 참고 영상: 저장 · 위 띠 · 머리 작은 단추 */
const refKey = k => 'bkRefUse:' + k;
function refGet(k) { try { return JSON.parse(localStorage.getItem(refKey(k)) || 'null'); } catch (e) { return null; } }
function refSet(k, it) {
  try { if (it) localStorage.setItem(refKey(k), JSON.stringify({ id: it.id, url: it.url || '', kind: it.kind, vid: it.vid, title: it.title, thumb: it.thumb, views: it.views, ch: it.ch, tags: it.tags || [], lvl: it.lvl || '', memo: it.memo || '' })); else localStorage.removeItem(refKey(k)); } catch (e) { /* 무시 */ }
}
function refBar(k, hosts, onClear) {
  document.querySelectorAll('.bkk-refbar,.bkk-refchip').forEach(x => x.remove());
  const it = refGet(k); if (!it) return null;
  const head = document.querySelector('.bke-top');
  if (head) { const c = document.createElement('button'); c.type = 'button'; c.className = 'bkk-refchip'; c.textContent = '🎯 참고'; c.title = it.title || ''; c.onclick = () => refPlay(it); const last = head.querySelector('.bke-menu,.bke-sp'); head.insertBefore(c, last || null); }
  (hosts || []).filter(Boolean).forEach(h => {
    const d = document.createElement('div'); d.className = 'bkk-refbar';
    d.innerHTML = `<i style="${it.thumb ? `background-image:url('${esc(it.thumb)}')` : ''}"></i><div><small>🎯 참고 영상 (따라 할 본보기)</small><b>${esc(it.title || it.url)}</b></div><button type="button" data-r="play">▶ 보기</button><button type="button" class="x" data-r="x" aria-label="참고 영상 빼기">✕</button>`;
    d.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; if (b.dataset.r === 'play') refPlay(it); else if (confirm('참고 영상을 뺄까요?\n(📌 내 레퍼런스에는 그대로 남아요)')) { refSet(k, null); refBar(k, hosts, onClear); if (onClear) onClear(); } });
    h.insertBefore(d, h.firstChild);
  });
  return it;
}
g.BKKIT = { musicBox, musicOut, REFWHAT, REFLVL, REFTAG, whatHTML, refFile, refPick, refPlay, refGet, refSet, refBar, open, askSave, fromLib, textInput, dictate, stop, textCard, pickFiles };
})(window);
