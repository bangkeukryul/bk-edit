/*! pair.js — BK영상 📷 사진마다 시작 문장 고르기 (🛠 관리자 미리보기)
 *  목소리를 넣으면 문장마다 시작 시간이 정해져요 → 사진 하나를 보고 「이 사진이 시작할 문장」을 톡 → 다음 사진.
 *  고르지 않으면 지금처럼 문장마다 차례로 바뀌어요. (BK쇼츠 「📷 사진마다 시작 가사 고르기」와 같은 방식) */
(function () {
  'use strict';
  const A = window.__app; if (!A) return;
  const S = A.S, $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), r = t - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
  S.startMap = S.startMap || {}; S.startOn = !!S.startOn;
  let OPEN = false, J = 1, WIN = 0;
  const segs = () => (S.narr && S.narr.on && S.narr.buffer && Array.isArray(S.narr.segs) ? S.narr.segs.filter(g => g.e > g.s) : []);
  const lead = () => (S.narr && S.narr.lead != null ? S.narr.lead : 0.35);
  const SM = () => S.startMap, ph = () => S.photos;
  const k = j => { const p = ph()[j]; return p ? SM()[p.id] : undefined; };
  function lo(j) { let gap = 0; for (let q = j - 1; q >= 0; q--) { if (k(q) != null) return k(q) + 1 + gap; gap++; } return gap; }   // 앞에 아직 안 고른 사진 몫도 남겨 둠
  function hi(j) { let gap = 0; for (let q = j + 1; q < ph().length; q++) { if (k(q) != null) return k(q) - 1 - gap; gap++; } return segs().length - 1 - gap; }
  function sug(j) {
    if (k(j) != null) return k(j); const a = lo(j), b = hi(j); if (a > b) return null;
    let q = j + 1; while (q < ph().length && k(q) == null) q++;
    const end = q < ph().length ? k(q) : segs().length, p = a - 1, step = (end - p) / (q - j + 1);
    return Math.min(b, Math.max(a, p + Math.max(1, Math.round(step))));
  }
  const done = () => ph().filter(p => SM()[p.id] != null).length;
  function nextOpen(from) { for (let q = from + 1; q < ph().length; q++) if (k(q) == null) return q; for (let q = 1; q <= from && q < ph().length; q++) if (k(q) == null) return q; return ph().length; }

  const box = document.createElement('div'); box.className = 'group adminOnly sp-box'; box.id = 'spBox';
  try { box.style.display = (localStorage.getItem('bkAdmin') === '1' || /[?&]bkadmin\b/.test(location.search)) ? '' : 'none'; } catch (e) { box.style.display = 'none'; }
  const anchor = $('#photoGrid'); if (anchor && anchor.parentNode) anchor.parentNode.parentNode.insertBefore(box, anchor.parentNode.nextSibling);
  const st = document.createElement('style');
  st.textContent = `.sp-box{border:2px solid #8b5cf6!important;background:#faf5ff!important}.sp-box h3{color:#6d28d9!important}
.sp-hd{display:flex;gap:10px;align-items:center;margin:4px 0 6px}.sp-hd img{width:68px;height:120px;object-fit:cover;border-radius:10px;flex:none;background:#222}.sp-hd b{display:block;font-size:1.02rem}.sp-hd small{color:#64748b}
.sp-c{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:2px solid #e2e8f0;background:#fff;border-radius:14px;padding:10px 12px;margin-top:6px;font-size:.98rem;line-height:1.35;cursor:pointer}
.sp-c b{flex:none;min-width:30px;height:30px;border-radius:15px;background:#ede9fe;color:#6d28d9;display:grid;place-items:center;font-size:.85rem}.sp-c span{flex:1;font-weight:700}.sp-c small{flex:none;color:#64748b;font-size:.75rem}
.sp-c.sel{border-color:#8b5cf6;background:#f3edff}.sp-c.sel b{background:#8b5cf6;color:#fff}.sp-c.cur{box-shadow:0 0 0 3px #22c55e inset}
.sp-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.sp-row button,.sp-more{border:0;border-radius:12px;padding:11px 6px;font-weight:800;background:#efe9fb;color:#4c2a9e;cursor:pointer}.sp-row button.pri{background:#8b5cf6;color:#fff}.sp-row button:disabled{opacity:.4}
.sp-more{display:block;width:100%;margin-top:6px;background:#fff;border:1.5px dashed #c4b5fd}
.sp-strip{display:flex;gap:5px;overflow-x:auto;padding:4px 2px 8px}.sp-strip button{flex:none;width:50px;border:2px solid #e2e8f0;border-radius:9px;padding:0;background:#fff;overflow:hidden;cursor:pointer}.sp-strip img{width:100%;height:60px;object-fit:cover;display:block}.sp-strip small{display:block;font-size:.66rem;font-weight:800;color:#4c2a9e;padding:2px 0}.sp-strip .no small{color:#dc2626}.sp-strip .on{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.35)}
.sp-on{background:#dcfce7;border-radius:10px;padding:8px 10px;font-weight:700;color:#166534;margin:4px 0}`;
  document.head.appendChild(st);

  function render() {
    const G = segs(), P = ph(), n = P.length;
    let h = `<h3>📷 사진마다 시작 문장 고르기 <small>🛠 관리자 미리보기</small></h3>`;
    if (!n) { box.innerHTML = h + '<p class="hint">사진을 먼저 넣어 주세요.</p>'; return; }
    if (!G.length) { box.innerHTML = h + '<p class="hint">🎙 <b>목소리를 먼저 넣어 주세요.</b> 목소리가 들어가야 문장마다 시작 시간이 정해져요.</p>'; return; }
    if (n > G.length) { box.innerHTML = h + `<p class="hint">사진(${n}장)이 문장(${G.length}개)보다 많아요. 사진을 줄이거나, 지금처럼 문장마다 차례로 쓰세요.</p>`; return; }
    if (!OPEN) {
      h += `<p class="hint" style="margin:0">사진 하나를 보고 그 사진이 <b>시작할 문장</b>을 톡 → 다음 사진. 한 사진이 여러 문장 동안 나오게 할 수 있어요. 고르지 않으면 지금처럼 <b>문장마다 차례로</b> 바뀌어요. (사진 ${n}장 · 문장 ${G.length}개)</p>`;
      if (S.startOn) h += `<div class="sp-on">✅ 지금: 사진마다 고른 문장에서 시작해요</div>`;
      h += `<div class="sp-row"><button type="button" class="pri" data-sp="go">📷 ${done() > 1 ? `이어서 고르기 (${done()} / ${n})` : '고르기 시작'}</button>${S.startOn ? '<button type="button" data-sp="off">↩ 문장마다 차례로</button>' : '<span></span>'}</div>`;
      box.innerHTML = h; return;
    }
    const lab = v => v != null ? `${v + 1}번` : '?';
    h += `<div class="sp-strip">${P.map((p, q) => `<button type="button" data-sp="to" data-v="${q}" class="${q === J ? 'on' : ''}${SM()[p.id] == null ? ' no' : ''}"><img src="${p.thumb}" alt=""><small>${q + 1}<br>${lab(SM()[p.id])}</small></button>`).join('')}</div>`;
    if (J < n) {
      const p = P[J], a = lo(J), b = hi(J), s = sug(J), cur = SM()[p.id], cand = []; for (let i = a; i <= b && cand.length < 6 + WIN; i++) cand.push(i);
      h += `<div class="sp-hd"><img src="${p.thumb}" alt=""><div><b>${J + 1}번째 사진 <small>/ ${n}</small></b><small>이 사진이 <b>시작할 문장</b>을 톡${cur != null ? ` · 지금: <b>${lab(cur)} 문장</b>` : ''}</small></div></div>`;
      h += cand.map(i => `<button type="button" class="sp-c${i === s ? ' sel' : ''}${i === cur ? ' cur' : ''}" data-sp="pick" data-v="${i}"><b>${i + 1}</b><span>${esc(G[i].t || '(문장 ' + (i + 1) + ')')}</span><small>${fmt(lead() + G[i].s)}</small></button>`).join('') || '<p class="hint">고를 수 있는 문장이 없어요 · 앞 사진을 다시 골라 주세요</p>';
      if (cand.length && cand[cand.length - 1] < b) h += `<button type="button" class="sp-more" data-sp="more">▼ 문장 더 보기</button>`;
      h += `<div class="sp-row"><button type="button" data-sp="to" data-v="${J - 1}"${J > 1 ? '' : ' disabled'}>◀ 앞 사진</button><button type="button" data-sp="to" data-v="${J + 1}">건너뛰기 ▶</button></div>`;
    } else h += `<p style="margin:6px 0"><b>${done() === n ? '✅ 사진을 모두 골랐어요 · ✅ 적용을 누르세요' : `아직 ${n - done()}장 남았어요 · 위에서 「?」 사진을 눌러요`}</b></p>`;
    h += `<p class="hint" style="margin:6px 0 0">1번째 사진은 영상 처음(1번 문장)부터 나와요.</p>
      <div class="sp-row"><button type="button" class="pri" data-sp="apply"${done() === n ? '' : ' disabled'}>✅ 적용 (${done()} / ${n})</button><button type="button" data-sp="close">닫기 (고른 건 남아요)</button></div>
      <div class="sp-row"><button type="button" data-sp="clear">🗑 처음부터 다시</button>${S.startOn ? '<button type="button" data-sp="off">↩ 문장마다 차례로</button>' : '<span></span>'}</div>`;
    const y0 = box.getBoundingClientRect().top; box.innerHTML = h; const y1 = box.getBoundingClientRect().top; if (Math.abs(y1 - y0) > 1) window.scrollBy(0, y1 - y0);
    const sp = box.querySelector('.sp-strip'), on = sp && sp.querySelector('.on'); if (sp && on) sp.scrollLeft = on.offsetLeft - sp.clientWidth / 2 + on.offsetWidth / 2;
  }
  // 사진이 바뀌면 (지워진 사진 정리)
  document.addEventListener('bk-photos', () => { const ids = new Set(ph().map(p => p.id)); Object.keys(SM()).forEach(id => { if (!ids.has(+id)) delete SM()[id]; }); if (ph()[0]) SM()[ph()[0].id] = 0; render(); });
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-sp]'); if (!b) return; const a = b.dataset.sp, v = b.dataset.v, n = ph().length;
    if (a === 'go') { OPEN = true; WIN = 0; if (ph()[0]) SM()[ph()[0].id] = 0; J = nextOpen(0); if (J >= n) J = n; return render(); }
    if (a === 'close') { OPEN = false; return render(); }
    if (a === 'more') { WIN += 6; return render(); }
    if (a === 'to') { J = Math.max(1, Math.min(n, +v)); WIN = 0; return render(); }
    if (a === 'pick') { const p = ph()[J]; if (!p) return; const x = +v; if (x < lo(J) || x > hi(J)) return A.toast('앞뒤 사진의 문장 사이에서 골라 주세요'); SM()[p.id] = x; J = nextOpen(J); WIN = 0; if (J >= n && done() === n) A.toast('✅ 모두 골랐어요 · ✅ 적용을 누르세요', 3500); return render(); }
    if (a === 'apply') { if (done() !== n) return; S.startOn = true; OPEN = false; A.scheduleRebuild(0); render(); return A.toast('📷 사진마다 고른 문장에서 시작하게 했어요 · ▶로 확인해 보세요', 4000); }
    if (a === 'off') { S.startOn = false; A.scheduleRebuild(0); render(); return A.toast('↩ 문장마다 차례로 바뀌게 되돌렸어요'); }
    if (a === 'clear') { if (!confirm('고른 문장을 모두 지울까요?')) return; S.startMap = {}; if (ph()[0]) SM()[ph()[0].id] = 0; S.startOn = false; J = 1; A.scheduleRebuild(0); return render(); }
  });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-tab="scene"]')) setTimeout(render, 30); });
  window.__pair = { render };
  render();
})();
