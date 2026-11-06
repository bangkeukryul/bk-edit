/*! ref.js — 🔎 레퍼런스: 유튜브 검색(내 키 · 이 휴대폰에만) + 📌 내 레퍼런스(주소 · 메모) → 🎬 영상 만들기 「참고 영상」으로
 *  영상 파일은 내려받지 않아요 (약관 · 저작권). 주소 · 제목 · 썸네일 · 내 메모만 이 휴대폰(IndexedDB 'bk-editapp-ref')에 저장해요. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const KEYNAME = 'bkYtKey', API = 'https://www.googleapis.com/youtube/v3/';
  const TAGS = [['hook', '🪝 첫 3초 후킹'], ['cap', '💬 자막'], ['music', '🎵 음악'], ['len', '⏱ 길이'], ['pace', '✂️ 장면 빠르기'], ['flow', '🎬 구성'], ['thumb', '🖼 썸네일']];
  const TAGTXT = Object.fromEntries(TAGS);

  /* ── 저장 (IndexedDB) ── */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('bk-editapp-ref', 1); r.onupgradeneeded = () => r.result.createObjectStore('r'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('r', mode), s = t.objectStore('r'), out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
  const all = () => tx('readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => (y.at || 0) - (x.at || 0)));
  const put = r => tx('readwrite', s => s.put(r, r.id));
  const del = id => tx('readwrite', s => s.delete(id));

  /* ── 작은 도우미 ── */
  const toast = (t, ms) => { const d = document.createElement('div'); d.textContent = t; d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111827;color:#fff;padding:12px 18px;border-radius:14px;font-weight:800;z-index:2147483000;max-width:90vw;text-align:center'; document.body.appendChild(d); setTimeout(() => d.remove(), ms || 2200); };
  const st = document.createElement('style'); st.textContent = '.rs-dim{position:fixed;inset:0;z-index:2147482000;background:#0008;display:flex;align-items:flex-end;justify-content:center}.rs{width:100%;max-width:560px;max-height:90vh;overflow:auto;background:#fff;border-radius:24px 24px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom))}.rs h3{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:1.1rem}.rs h3 span{flex:1}.rs h3 button{flex:none;width:46px;height:46px;border-radius:50%;border:0;background:#f1f5f9;font-size:1.2rem}';
  document.head.appendChild(st);
  function sheet(title, html) {
    const d = document.createElement('div'); d.className = 'rs-dim'; d.innerHTML = `<div class="rs"><h3><span>${title}</span><button type="button" data-x="1">✕</button></h3>${html}</div>`;
    document.body.appendChild(d); const close = () => d.remove();
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-x]')) close(); });
    return { box: d.firstChild, close };
  }
  const views = n => { n = +n || 0; return n >= 1e8 ? (n / 1e8).toFixed(n >= 1e9 ? 0 : 1).replace(/\.0$/, '') + '억' : n >= 1e4 ? Math.round(n / 1e4).toLocaleString() + '만' : n.toLocaleString(); };
  const isoSec = s => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || '') || []; return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0); };
  const mmss = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';
  const ymd = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
  function parse(u) {
    u = String(u || '').trim(); const m = u.match(/https?:\/\/\S+/); if (m) u = m[0];
    const yt = u.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
    if (yt && /youtu/.test(u)) return { kind: 'yt', vid: yt[1], url: 'https://www.youtube.com/watch?v=' + yt[1], id: 'yt:' + yt[1] };
    if (/tiktok\.com/.test(u)) return { kind: 'tt', url: u, id: 'tt:' + u.replace(/[?#].*$/, '') };
    if (/instagram\.com/.test(u)) return { kind: 'ig', url: u, id: 'ig:' + u.replace(/[?#].*$/, '') };
    if (/^https?:\/\//.test(u)) return { kind: 'web', url: u, id: 'web:' + u };
    return null;
  }
  const BADGE = { yt: '▶ 유튜브', tt: '🎵 틱톡', ig: '📸 인스타', web: '🔗 링크' };

  /* ── 탭 ── */
  document.querySelector('.rtabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) tab(b.dataset.t); });
  function tab(t) { document.querySelectorAll('.rtabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === t))); $('tFind').hidden = t !== 'find'; $('tMine').hidden = t !== 'mine'; if (t === 'mine') drawMine(); }

  /* ── 🔑 키 (이 휴대폰에만) ── */
  const key = () => (LS(KEYNAME) || '').trim();
  const showKey = on => { $('keyBox').hidden = !on; };
  showKey(!key());
  $('keySave').addEventListener('click', () => { const k = $('keyIn').value.trim(); if (!/^AIza[\w-]{20,}$/.test(k)) return alert('키 모양이 달라요. 「AIza」로 시작하는 키를 그대로 붙여넣어 주세요.'); LS(KEYNAME, k); $('keyIn').value = ''; showKey(false); toast('🔑 저장했어요 (이 휴대폰에만)'); });
  $('keyEdit').addEventListener('click', () => { showKey($('keyBox').hidden); if (!$('keyBox').hidden) $('keyBox').scrollIntoView({ behavior: 'smooth' }); });

  /* ── 고르기 (기억) ── */
  const OPT = Object.assign({ sLen: 'short', sWhen: '365', sMin: '1000000', sOrd: 'viewCount' }, JSON.parse(LS('bkRefOpt') || '{}'));
  ['sLen', 'sWhen', 'sMin', 'sOrd'].forEach(id => {
    const box = $(id), set = v => box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    set(OPT[id]); box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; OPT[id] = b.dataset.v; set(b.dataset.v); LS('bkRefOpt', JSON.stringify(OPT)); });
  });
  const other = () => { const q = encodeURIComponent($('q').value.trim()); $('toTT').href = 'https://www.tiktok.com/search?q=' + q; $('toIG').href = 'https://www.instagram.com/explore/search/keyword/?q=' + q; };
  $('q').addEventListener('input', other); other();

  /* ── 오늘 쓴 양 (구글 무료: 하루 10,000점 · 검색 100점) ── */
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });   // 구글은 미국 서부 자정에 다시 채워요
  const quota = add => { let q = {}; try { q = JSON.parse(LS('bkRefQuota') || '{}'); } catch (e) { /* 없음 */ } if (q.d !== today()) q = { d: today(), u: 0 }; if (add) { q.u += add; LS('bkRefQuota', JSON.stringify(q)); } $('quota').textContent = `오늘 검색 약 ${Math.floor(q.u / 100)}번 · 하루 약 100번까지 무료 (오후 4~5시쯤 다시 채워져요)`; };
  quota(0);

  /* ── 유튜브 검색 ── */
  let NEXT = '', LAST = '', SEEN = new Set(), busy = false;
  async function api(path, p) {
    const u = API + path + '?' + new URLSearchParams(Object.assign({ key: key() }, p)).toString();
    const r = await fetch(u); const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      const why = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || '', msg = (j.error && j.error.message) || '';
      if (/quota/i.test(why)) throw new Error('오늘 무료 검색을 다 썼어요. 내일(오후 4~5시쯤 뒤) 다시 해 주세요.');
      if (/keyInvalid|API key not valid/i.test(why + msg)) throw new Error('검색 키가 맞지 않아요. 「🔑 검색 키 바꾸기」에서 다시 넣어 주세요.');
      if (/referer|referrer|blocked/i.test(why + msg)) throw new Error('키 잠금 설정에 이 주소가 없어요. 키 「웹사이트 제한」에 https://bangkeukryul.github.io/* 를 넣어 주세요.');
      if (/accessNotConfigured|disabled|has not been used/i.test(why + msg)) throw new Error('구글 클라우드에서 「YouTube Data API v3」 사용 버튼을 눌러 주세요.');
      throw new Error('검색이 안 됐어요 (' + (why || r.status) + ')');
    }
    return j;
  }
  async function details(ids) {   // 조회수 · 길이 (1점)
    if (!ids.length) return []; quota(1);
    const j = await api('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(','), maxResults: 50 });
    return (j.items || []).map(v => ({ kind: 'yt', vid: v.id, id: 'yt:' + v.id, url: 'https://www.youtube.com/watch?v=' + v.id, title: v.snippet.title, ch: v.snippet.channelTitle, date: v.snippet.publishedAt, views: +(v.statistics && v.statistics.viewCount) || 0, sec: isoSec(v.contentDetails && v.contentDetails.duration), thumb: (v.snippet.thumbnails.high || v.snippet.thumbnails.medium || v.snippet.thumbnails.default || {}).url }));
  }
  async function search(more) {
    if (busy) return; const q = $('q').value.trim(); if (!q) { $('q').focus(); return; }
    if (!key()) { showKey(true); $('keyBox').scrollIntoView({ behavior: 'smooth' }); return toast('먼저 🔑 검색 키를 넣어 주세요'); }
    if (!more) { NEXT = ''; SEEN = new Set(); $('res').innerHTML = ''; LAST = q; }
    busy = true; const btn = $('rMore'); if (btn) btn.remove();
    const wait = document.createElement('p'); wait.className = 'rmsg'; wait.textContent = '🔎 찾는 중…'; $('res').appendChild(wait);
    try {
      const p = { part: 'snippet', type: 'video', q: LAST, maxResults: 50, order: OPT.sOrd, regionCode: 'KR', relevanceLanguage: 'ko', safeSearch: 'moderate' };
      if (OPT.sLen === 'short') p.videoDuration = 'short';
      if (+OPT.sWhen) p.publishedAfter = new Date(Date.now() - OPT.sWhen * 864e5).toISOString();
      if (NEXT) p.pageToken = NEXT;
      quota(100); const j = await api('search', p); NEXT = j.nextPageToken || '';
      const ids = (j.items || []).map(x => x.id && x.id.videoId).filter(id => id && !SEEN.has(id)); ids.forEach(id => SEEN.add(id));
      let list = await details(ids);
      const got = list.length;
      list = list.filter(v => v.views >= +OPT.sMin && (OPT.sLen !== 'short' || (v.sec > 0 && v.sec <= 180)));
      if (OPT.sOrd === 'viewCount') list.sort((a, b) => b.views - a.views);
      wait.remove();
      const saved = new Set((await all()).map(r => r.id));
      list.forEach(v => $('res').insertAdjacentHTML('beforeend', card(v, saved.has(v.id), false)));
      RES = RES.concat(list);
      const info = document.createElement('p'); info.className = 'rhint'; info.style.textAlign = 'center';
      info.textContent = `${got}개 중 조건에 맞는 ${list.length}개` + (list.length ? '' : ' — 최소 조회수 · 기간을 낮춰 보세요');
      $('res').appendChild(info);
      if (NEXT) $('res').insertAdjacentHTML('beforeend', '<button type="button" class="rmore" id="rMore">⬇ 더 찾기 (검색 1번 더 써요)</button>');
    } catch (e) { wait.textContent = '⚠️ ' + e.message; }
    busy = false;
  }
  let RES = [];
  $('go').addEventListener('click', () => { RES = []; search(false); });
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); RES = []; search(false); } });
  $('res').addEventListener('click', e => { if (e.target.closest('#rMore')) { search(true); return; } act(e, false); });

  /* ── 카드 ── */
  function card(v, saved, mine) {
    const meta = [v.views ? `<span class="vw">👀 ${views(v.views)}회</span>` : '', v.ch ? esc(v.ch) : '', v.date ? ymd(v.date) : ''].filter(Boolean).join(' · ');
    const memo = mine && ((v.tags && v.tags.length) || v.memo) ? `<p class="memo">${(v.tags || []).map(t => `<span>${esc(TAGTXT[t] || t)}</span>`).join('')}${esc(v.memo || '')}</p>` : '';
    return `<div class="rv" data-id="${esc(v.id)}"><div class="th" style="${v.thumb ? `background-image:url('${esc(v.thumb)}')` : ''}"><em>${BADGE[v.kind] || ''}</em>${v.sec ? `<i>${mmss(v.sec)}</i>` : ''}</div>
      <div style="min-width:0"><b>${esc(v.title || v.url)}</b><small>${meta}</small>
      <div class="acts">${v.kind === 'yt' ? '<button type="button" data-a="play">▶ 보기</button>' : `<a href="${esc(v.url)}" target="_blank" rel="noopener">↗ 열기</a>`}
      ${mine ? '<button type="button" data-a="memo">📝 메모</button><button type="button" data-a="make">🎬 이걸로 만들기</button><button type="button" class="red" data-a="del">🗑</button>'
        : `<button type="button" data-a="save" class="${saved ? 'on' : ''}">${saved ? '✅ 담았어요' : '📌 담기'}</button>`}</div></div>${memo}</div>`;
  }
  async function act(e, mine) {
    const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.closest('.rv').dataset.id, a = b.dataset.a;
    const list = mine ? await all() : RES, v = list.find(x => x.id === id); if (!v) return;
    if (a === 'play') return play(v);
    if (a === 'save') { const has = (await all()).find(x => x.id === id); if (has) return toast('이미 담아 둔 영상이에요'); const r = Object.assign({}, v, { at: Date.now(), tags: [], memo: '' }); await put(r); b.textContent = '✅ 담았어요'; b.classList.add('on'); count(); memoSheet(r, true); return; }
    if (a === 'memo') return memoSheet(v, false);
    if (a === 'del') { if (!confirm('내 레퍼런스에서 뺄까요?\n「' + (v.title || v.url) + '」')) return; await del(id); drawMine(); return; }
    if (a === 'make') return make(v);
  }
  function play(v) {
    const s = sheet('▶ ' + esc((v.title || '').slice(0, 40)), `<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.vid)}?playsinline=1&autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
      <p class="rhint">${v.views ? `👀 ${views(v.views)}회 · ` : ''}${esc(v.ch || '')}</p><a class="big sec" href="${esc(v.url)}" target="_blank" rel="noopener">↗ 유튜브 앱에서 보기</a>`);
    return s;
  }
  function memoSheet(v, fresh) {
    const s = sheet(fresh ? '📌 담았어요 — 무엇을 참고할까요?' : '📝 메모', `<span class="rlbl" style="margin-top:0">제목</span><input class="rin" id="mTitle" value="${esc(v.title || '')}" placeholder="이 영상 이름" style="margin-bottom:8px">
      <div class="chips2" id="mTags">${TAGS.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${(v.tags || []).includes(k)}">${l}</button>`).join('')}</div>
      <span class="rlbl">메모 (선택)</span><textarea class="rin" id="mTxt" rows="4" placeholder="예: 첫 장면에 결과부터 보여 줌 · 자막이 크고 노랑">${esc(v.memo || '')}</textarea>
      <button type="button" class="big pri" id="mOk" style="background:#5b21b6">💾 저장</button>`);
    s.box.querySelector('#mTags').addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
    s.box.querySelector('#mOk').addEventListener('click', async () => {
      v.tags = [...s.box.querySelectorAll('#mTags [aria-pressed=true]')].map(b => b.dataset.k); v.memo = s.box.querySelector('#mTxt').value.trim(); v.title = s.box.querySelector('#mTitle').value.trim() || v.title; await put(v); s.close(); toast('💾 저장했어요'); if (!$('tMine').hidden) drawMine();
    });
  }
  function make(v) {
    LS('bkeRefPick', JSON.stringify({ url: v.url, title: v.title || '', tags: v.tags || [], memo: v.memo || '', at: Date.now() }));
    location.href = 'video/?ref=1';
  }

  /* ── 📌 내 레퍼런스 ── */
  async function count() { const n = (await all()).length; $('mineN').textContent = n ? `(${n})` : ''; }
  async function drawMine() {
    const q = $('mFind').value.trim(), list = (await all()).filter(r => !q || ((r.title || '') + ' ' + (r.memo || '') + ' ' + (r.ch || '')).includes(q));
    $('mine').innerHTML = list.map(r => card(r, true, true)).join('') || `<p class="rmsg">${q ? '찾는 레퍼런스가 없어요' : '아직 담은 영상이 없어요.<br>🔎 찾기에서 📌 담기, 또는 위에 주소를 붙여넣어 주세요.'}</p>`;
    count();
  }
  $('mine').addEventListener('click', e => act(e, true));
  $('mFind').addEventListener('input', drawMine);
  $('paste').addEventListener('click', async () => { try { const t = await navigator.clipboard.readText(); if (t) { $('url').value = t.trim(); return; } } catch (e) { /* 아래 */ } $('url').focus(); toast('칸을 꾹 눌러 「붙여넣기」 해 주세요'); });
  $('addUrl').addEventListener('click', async () => {
    const p = parse($('url').value); if (!p) return alert('유튜브 · 틱톡 · 인스타 주소를 붙여넣어 주세요.');
    if ((await all()).find(x => x.id === p.id)) return toast('이미 담아 둔 영상이에요');
    const r = Object.assign({ title: '', at: Date.now(), tags: [], memo: '' }, p);
    $('addUrl').disabled = true;
    try {
      if (p.kind === 'yt') {
        r.thumb = `https://i.ytimg.com/vi/${p.vid}/hqdefault.jpg`;
        if (key()) { const d = (await details([p.vid]))[0]; if (d) Object.assign(r, d); }
        else { try { const j = await (await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(p.url))).json(); r.title = j.title || ''; r.ch = j.author_name || ''; } catch (e) { /* 제목 없이 */ } }
      } else if (p.kind === 'tt') {
        try { const j = await (await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(p.url))).json(); r.title = j.title || ''; r.ch = j.author_name || ''; r.thumb = j.thumbnail_url || ''; } catch (e) { /* 제목 없이 */ }
      }
    } catch (e) { /* 정보 없이 담기 */ }
    if (!r.title) r.title = BADGE[p.kind] + ' 영상';
    await put(r); $('url').value = ''; $('addUrl').disabled = false; await drawMine(); memoSheet(r, true);
  });
  count();
  if (/[?&]t=mine/.test(location.search)) tab('mine');
})();
