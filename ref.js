/*! ref.js — 🔎 레퍼런스: 유튜브 검색(내 키 · 이 휴대폰에만) + 📌 내 레퍼런스(주소 · 메모) → 🎬 영상 만들기 「참고 영상」으로
 *  영상 파일은 내려받지 않아요 (약관 · 저작권). 주소 · 제목 · 썸네일 · 내 메모만 이 휴대폰(IndexedDB 'bk-editapp-ref')에 저장해요. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const KEYNAME = 'bkYtKey', API = 'https://www.googleapis.com/youtube/v3/';
  const KIT = window.BKKIT || {}, TAGTXT = KIT.REFTAG || {}, LVL = Object.fromEntries(KIT.REFLVL || []);

  /* ── 저장 (IndexedDB) ── */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('bk-editapp-ref', 1); r.onupgradeneeded = () => r.result.createObjectStore('r'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('r', mode), s = t.objectStore('r'), out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
  const all = () => tx('readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => (y.at || 0) - (x.at || 0)));
  const put = r => tx('readwrite', s => s.put(r, r.id));
  const del = id => tx('readwrite', s => s.delete(id));

  /* ── 작은 도우미 ── */
  const toast = (t, ms) => { document.querySelectorAll('.rtoast').forEach(x => x.remove()); const d = document.createElement('div'); d.className = 'rtoast'; d.textContent = t; d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111827;color:#fff;padding:12px 18px;border-radius:14px;font-weight:800;z-index:2147483000;max-width:90vw;text-align:center'; document.body.appendChild(d); setTimeout(() => d.remove(), ms || 2200); };
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
  const BADGE = { yt: '▶ 유튜브', tt: '🎵 틱톡', ig: '📸 인스타', web: '🔗 링크', file: '📁 내 영상' };

  /* ── 탭 ── */
  document.querySelector('.rtabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) tab(b.dataset.t); });
  function tab(t) { document.querySelectorAll('.rtabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === t))); $('tFind').hidden = t !== 'find'; $('tMine').hidden = t !== 'mine'; if (t === 'mine') drawMine(); }

  /* ── 🔑 키 (이 휴대폰에만) ── */
  const key = () => (LS(KEYNAME) || '').trim();
  const showKey = on => { $('keyBox').hidden = !on; };
  showKey(!key());
  $('keySave').addEventListener('click', () => { const k = $('keyIn').value.trim(); if (!/^AIza[\w-]{20,}$/.test(k)) return alert('키 모양이 달라요. 「AIza」로 시작하는 키를 그대로 붙여넣어 주세요.'); LS(KEYNAME, k); $('keyIn').value = ''; quota(0); showKey(false); toast('🔑 저장했어요 (이 휴대폰에만)'); });
  /* 📖 사용 설명서 */
  const GUIDE = `<div class="guide">
    <p style="margin:0">🔎 레퍼런스는 <b>잘된 영상(본보기)</b>을 찾아 📌 담아 두고, 🎵 쇼츠 · 🎬 영상 만들 때 <b>따라 할 본보기</b>로 붙여 쓰는 곳이에요.<br>영상 파일을 내려받는 게 아니라 <b>주소 · 제목 · 내 메모</b>만 이 휴대폰에 저장해요.</p>
    <h4>① 유튜브에서 찾기 (🔎 찾기 탭)</h4>
    <ol><li>검색어 쓰기 (띄어쓰기 하면 더 잘 나와요: 「사자 원숭이」)</li><li>조건 고르기 — 📱 길이 · 📅 기간 · 👀 최소 조회수 · 🌏 나라 · ↕ 순서 · 🔧 더 좁히기</li><li>맨 아래 <b>🔎 이 조건으로 찾기</b> (100점)</li><li>그림을 누르면 ▶ 재생 · <b>↗ 유튜브</b>는 유튜브 앱으로 · <b>📌 담기</b></li></ol>
    <div class="tip">💡 한 번에 맞추기: <b>🔥 요즘 터진 것</b>(최근 1주 · 하루 조회수 순) · <b>🐣 작은 채널 대박</b>(구독자 10만 이하 · 구독자 대비)<br>💡 결과가 없으면 까닭이 나와요. 👀 조회수 · 🌏 나라 · 📺 채널 크기를 바꾸면 받은 영상에서 바로 다시 걸러요 (0점).</div>
    <h4>② 유튜브 검색 키 만들기 (처음 한 번 · 무료)</h4>
    <div class="tip">유튜브 찾기는 구글이 주는 <b>API 키</b>가 있어야 해요. 하루 <b>10,000점</b>(검색 약 100번)까지 무료이고 카드 등록은 필요 없어요.</div>
    <ol>
      <li>크롬 ⋮ → <b>새 시크릿 탭</b> → 아래 주소를 열고 내 구글 계정으로 로그인<br><code>https://console.cloud.google.com/projectcreate</code><button type="button" class="cp" data-cp="https://console.cloud.google.com/projectcreate">복사</button><br>· 「액세스 차단됨 · 2단계 인증」이 나오면: 구글 계정 → 보안 → <b>2단계 인증</b>을 켜고 몇 분 뒤 다시</li>
      <li>프로젝트 이름 <b>BK에딧</b> → <b>만들기</b></li>
      <li>아래 주소 → 위 프로젝트가 BK에딧인지 확인 → <b>사용</b><br><code>https://console.cloud.google.com/apis/library/youtube.googleapis.com</code><button type="button" class="cp" data-cp="https://console.cloud.google.com/apis/library/youtube.googleapis.com">복사</button></li>
      <li><b>+ 사용자 인증 정보 만들기</b> → (물어보면) <b>공개 데이터</b> → 다음 → 키가 나오면 <b>복사</b><br><code>https://console.cloud.google.com/apis/credentials</code><button type="button" class="cp" data-cp="https://console.cloud.google.com/apis/credentials">복사</button></li>
      <li>BK에딧 🔎 레퍼런스 오른쪽 위 <b>🔑</b> → 붙여넣기 → <b>저장</b></li>
      <li>🔒 (권장) 키 <b>수정</b> → 애플리케이션 제한: <b>웹사이트</b> → <code>https://bangkeukryul.github.io/*</code><button type="button" class="cp" data-cp="https://bangkeukryul.github.io/*">복사</button> · API 제한: <b>YouTube Data API v3</b>만 → 저장 → 5분 뒤 사용</li>
    </ol>
    <div class="tip warn">⚠️ 키는 <b>이 휴대폰에만</b> 저장돼요. 카톡 · 메일 · 채팅창에 붙여넣지 마세요.<br>「키 잠금 설정에 이 주소가 없어요」가 나오면 6번의 웹사이트 주소를 넣거나, 새 키를 만들어 주세요.</div>
    <h4>③ 🔋 점수</h4>
    <ul><li>검색 1번 = <b>100점</b> (결과 최대 50개) · 쪽 넘기기 · ▶ 보기 · 다시 거르기는 <b>0점</b></li><li>조건에 맞는 게 적으면 한 번 더 자동으로 찾아요 (100점 더)</li><li>매일 오후 4~5시쯤 10,000점으로 다시 채워져요 · 키를 바꾸면 10,000점부터</li></ul>
    <h4>④ 인스타 · 틱톡 영상 담기</h4>
    <div class="tip">인스타 · 틱톡은 일반인이 쓸 수 있는 검색 기능(API)이 없어서 BK에딧 안에서 찾을 수는 없어요. 대신 <b>주소(링크)로 담아요.</b></div>
    <ol><li>인스타 · 틱톡에서 마음에 드는 영상의 <b>✈️ 공유(종이비행기)</b> 또는 <b>⋯</b> → <b>링크 복사</b></li><li>BK에딧 🔎 레퍼런스 → <b>📌 내 레퍼런스</b> 탭</li><li><b>📋 붙여넣기</b> → <b>📌 담기</b></li><li>📝 메모에서 <b>제목</b>(예: 「강아지 · 고양이 우유 AI」)과 🪝 후킹 등을 적어 두기<br>· 인스타는 제목 · 그림을 가져올 수 없어서 직접 적어 두면 찾기 쉬워요</li></ol>
    <div class="tip">💡 「🎵 틱톡에서 찾기 · 📸 인스타에서 찾기」 단추는 검색어로 그 앱 · 사이트를 열어 줘요. 거기서 보고 링크를 복사해 오세요.</div>
    <h4>⑤ 쇼츠 · 영상 만들 때 쓰기</h4>
    <ol><li>📌 내 레퍼런스 → <b>🎬 이걸로 만들기 ▸</b> → 🎵 쇼츠 / 🎬 영상 고르기<br>또는 쇼츠 · 영상 만들기 <b>➕ 자료 넣기 → 🎯 내 레퍼런스</b></li><li>화면 맨 위에 <b>「🎯 참고 영상」 띠</b>가 생겨요 — ▶ 보기로 언제든 다시 보고, ✕로 빼요</li><li>🎬 영상 만들기는 AI 요청서에 링크 · 따라 할 점 · 메모가 함께 들어가요 (형식만 참고 · 새로 만들기)</li></ol>
    <div class="tip warn">⚠️ 다른 사람 영상은 <b>형식 · 흐름만 참고</b>해요. 장면 · 대사 · 음악을 그대로 베끼면 저작권 문제가 될 수 있어요.</div>
  </div>`;
  function help() {
    const s = sheet('📖 레퍼런스 사용 설명서', GUIDE);
    s.box.addEventListener('click', async e => { const b = e.target.closest('[data-cp]'); if (!b) return; try { await navigator.clipboard.writeText(b.dataset.cp); b.textContent = '✅ 복사됨'; } catch (er) { b.textContent = '길게 눌러 복사'; } });
  }
  $('helpBtn').addEventListener('click', help);
  $('helpLine').addEventListener('click', help);
  if (key()) $('helpLine').hidden = true;   // 키를 넣은 뒤에는 📖 단추만 (오른쪽 위)
  $('keyEdit').addEventListener('click', () => { tab('find'); showKey($('keyBox').hidden); if (!$('keyBox').hidden) { $('keyBox').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => $('keyIn').focus(), 300); } });

  /* ── 고르기 (기억) ── */
  const OPT = Object.assign({ sLen: 'short', sWhen: '365', sMin: '1000000', sOrd: 'viewCount', sNat: 'ko', sCh: '0' }, JSON.parse(LS('bkRefOpt') || '{}'));
  const SETS = {};
  const moreOn = () => { $('moreOn').textContent = +OPT.sCh ? '켜짐' : ''; $('moreOn').hidden = !+OPT.sCh; };
  ['sLen', 'sWhen', 'sMin', 'sOrd', 'sNat', 'sCh'].forEach(id => {
    const box = $(id), set = v => box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    SETS[id] = v => { OPT[id] = v; set(v); LS('bkRefOpt', JSON.stringify(OPT)); moreOn(); if (id !== 'sWhen' && RAW.length && !busy) { refilter(); PG = 0; drawRes(); } };
    set(OPT[id]); box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) SETS[id](b.dataset.v); });
  });
  moreOn(); if (+OPT.sCh) $('moreBox').open = true;
  /* 🔥 한 번에 맞추기 */
  document.querySelector('.presets').addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    if (b.dataset.p === 'hot') { SETS.sCh('0'); SETS.sWhen('7'); SETS.sOrd('daily'); SETS.sMin('100000'); toast('🔥 최근 1주 · 하루 조회수 순 · 10만 이상으로 맞췄어요'); }
    else { SETS.sCh('100000'); SETS.sOrd('ratio'); SETS.sMin('100000'); $('moreBox').open = true; toast('🐣 구독자 10만 이하 · 구독자 대비 터진 순 · 10만 이상으로 맞췄어요'); }
    if ($('q').value.trim()) search(false); else $('q').focus();
  });
  const other = () => { const q = encodeURIComponent($('q').value.trim()); $('toTT').href = 'https://www.tiktok.com/search?q=' + q; $('toIG').href = 'https://www.instagram.com/explore/search/keyword/?q=' + q; };
  $('q').addEventListener('input', other); other();

  /* ── 🔋 오늘 쓴 양 (구글 무료: 하루 10,000점 · 검색 1번 100점 · 조회수 확인 1점) — 이 휴대폰에서 쓴 것만 세요 ── */
  const DAY = 10000;
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });   // 구글은 미국 서부 자정(한국 오후 4~5시)에 다시 채워요
  function quota(add, full) {
    let q = {}; try { q = JSON.parse(LS('bkRefQuota') || '{}'); } catch (e) { /* 없음 */ }
    const kid = key().slice(-6);
    if (q.d !== today() || (q.k || '') !== kid) q = { d: today(), u: 0, n: 0, k: kid };   // 날이 바뀌거나 키를 바꾸면 10,000점부터
    if (add) { q.u += add; if (add >= 100) q.n = (q.n || 0) + 1; }
    if (full) q.u = Math.max(q.u, DAY);
    if (add || full) LS('bkRefQuota', JSON.stringify(q));
    const left = Math.max(0, DAY - q.u), pct = left / DAY, can = Math.floor(left / 101), col = pct > .5 ? '#16a34a' : pct > .1 ? '#f59e0b' : '#dc2626';
    $('qBar').innerHTML = `<div class="qt">🔋 오늘 유튜브 무료 검색 <small>(이 휴대폰 기준)</small></div>
      <div class="qtrack"><i style="width:${(pct * 100).toFixed(1)}%;background:${col}"></i></div>
      <div class="qn"><b style="color:${col}">남은 ${left.toLocaleString()}점</b> / 10,000점</div>
      <div class="qs">오늘 <b>${q.n || 0}번</b> 검색함 · 약 <b>${can}번</b> 더 할 수 있어요</div>
      <div class="qs2">검색 1번 = 100점 (결과 최대 50개) · 쪽 넘기기 · ▶ 보기는 0점 · 매일 오후 4~5시쯤 다시 10,000점</div>`;
    return left;
  }
  quota(0);
  async function canSpend() {   // 찾기 전에 남은 점수 확인
    const left = quota(0);
    if (left < 100) { alert('🔋 오늘 무료 검색을 다 썼어요.\n오후 4~5시쯤 다시 10,000점으로 채워져요.\n\n(지금 받은 결과는 쪽을 넘기며 계속 볼 수 있어요)'); return false; }
    if (left < 1000) return confirm(`🔋 오늘 남은 점수가 ${left.toLocaleString()}점이에요 (검색 약 ${Math.floor(left / 101)}번).\n\n100점을 써서 찾을까요?`);
    if (left < 2000) toast(`🔋 오늘 남은 검색이 약 ${Math.floor(left / 101)}번이에요`, 2600);
    return true;
  }

  /* ── 유튜브 검색 ── */
  let NEXT = '', LAST = '', SEEN = new Set(), busy = false, RES = [], RAW = [], CUT = {}, PG = 0, ERR = '';
  const PER = 10;
  async function api(path, p) {
    const u = API + path + '?' + new URLSearchParams(Object.assign({ key: key() }, p)).toString();
    const r = await fetch(u); const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      const why = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || '', msg = (j.error && j.error.message) || '';
      if (/quota/i.test(why)) { quota(0, true); throw new Error('오늘 무료 검색을 다 썼어요. 오후 4~5시쯤 다시 채워져요. (다른 휴대폰 · 프로그램에서 같은 키를 썼을 수도 있어요)'); }
      if (/keyInvalid|API key not valid/i.test(why + msg)) throw new Error('검색 키가 맞지 않아요. 「🔑 검색 키 바꾸기」에서 다시 넣어 주세요.');
      if (/referer|referrer|blocked/i.test(why + msg)) throw new Error('키 잠금 설정에 이 주소가 없어요. 키 「웹사이트 제한」에 https://bangkeukryul.github.io/* 를 넣어 주세요.');
      if (/accessNotConfigured|disabled|has not been used/i.test(why + msg)) throw new Error('구글 클라우드에서 「YouTube Data API v3」 사용 버튼을 눌러 주세요.');
      throw new Error('검색이 안 됐어요 (' + (why || r.status) + ')');
    }
    return j;
  }
  async function details(ids) {   // 조회수 · 길이 (1점)
    if (!ids.length) return [];
    const j = await api('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(','), maxResults: 50 }); quota(1);   // 구글이 받아 준 뒤에만 세기
    return (j.items || []).map(v => ({ kind: 'yt', vid: v.id, id: 'yt:' + v.id, url: 'https://www.youtube.com/watch?v=' + v.id, title: v.snippet.title, ch: v.snippet.channelTitle, chId: v.snippet.channelId, lang: (v.snippet.defaultAudioLanguage || v.snippet.defaultLanguage || '').toLowerCase(), desc: (v.snippet.description || '').slice(0, 200), date: v.snippet.publishedAt, views: +(v.statistics && v.statistics.viewCount) || 0, sec: isoSec(v.contentDetails && v.contentDetails.duration), thumb: (v.snippet.thumbnails.high || v.snippet.thumbnails.medium || v.snippet.thumbnails.default || {}).url }));
  }
  async function onePage() {   // 검색 1번 (100점) → 조건에 맞는 것만
    const p = { part: 'snippet', type: 'video', q: LAST, maxResults: 50, order: OPT.sOrd === 'relevance' ? 'relevance' : 'viewCount', safeSearch: 'moderate' };
    if (OPT.sNat === 'ko') { p.regionCode = 'KR'; p.relevanceLanguage = 'ko'; }
    if (OPT.sLen === 'short') p.videoDuration = 'short';
    if (+OPT.sWhen) p.publishedAfter = new Date(Date.now() - OPT.sWhen * 864e5).toISOString();
    if (NEXT) p.pageToken = NEXT;
    const j = await api('search', p); quota(100); NEXT = j.nextPageToken || '';   // 키 잠금 등으로 막히면 점수를 세지 않아요
    const ids = (j.items || []).map(x => x.id && x.id.videoId).filter(id => id && !SEEN.has(id)); ids.forEach(id => SEEN.add(id));
    const raw = await details(ids);
    raw.forEach(v => { v.ko = isKo(v); delete v.desc; v.daily = Math.round(v.views / Math.max(1, (Date.now() - new Date(v.date)) / 864e5)); });
    await subs(raw);
    RAW = RAW.concat(raw); refilter();
  }
  /* 받은 영상(RAW)을 지금 조건으로 다시 거르기 — 유튜브에 다시 묻지 않아서 0점 · 뺀 까닭도 세어 둬요 */
  function why(v) {
    if (OPT.sLen === 'short' && !(v.sec > 0 && v.sec <= 180)) return 'len';
    if (v.views < +OPT.sMin) return 'views';
    if (!natOk(v)) return 'nat';
    if (+OPT.sCh && !(v.subs != null && v.subs <= +OPT.sCh)) return 'ch';
    return '';
  }
  function refilter() {
    CUT = {}; const L = [];
    RAW.forEach(v => { const w = why(v); if (w) CUT[w] = (CUT[w] || 0) + 1; else L.push(v); });
    const by = { viewCount: v => v.views, daily: v => v.daily, ratio: v => v.ratio || 0 }[OPT.sOrd];
    if (by) L.sort((a, b) => by(b) - by(a));
    RES = L;
  }
  const cutTxt = () => {
    const N = { views: `👀 조회수 ${views(+OPT.sMin)} 미만`, nat: OPT.sNat === 'ko' ? '🌏 외국 영상' : '🌏 한국 영상', len: '📱 3분 넘는 영상', ch: `📺 구독자 ${views(+OPT.sCh)} 넘는(또는 비공개) 채널` };
    return Object.entries(CUT).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${N[k]} ${n}개`).join(' · ');
  };
  function whyBox() {
    if (!LAST || busy) return '';
    if (!SEEN.size) return ERR ? '' : `<div class="why"><b>🔍 유튜브에 이 조건으로 찾은 영상이 없어요</b><p>검색어를 바꾸거나 (띄어쓰기 예: 「사자 원숭이」) 📅 기간을 넓혀 보세요.</p>${+OPT.sWhen && OPT.sWhen !== '0' ? '<button type="button" data-fix="when">📅 기간 「전체」로 다시 찾기 (100점)</button>' : ''}</div>`;
    const fix = [];
    if (CUT.views) fix.push(`<button type="button" data-fix="views">👀 조회수 「${+OPT.sMin > 100000 ? '10만' : '상관없음'}」으로 보기 (0점)</button>`);
    if (CUT.nat) fix.push('<button type="button" data-fix="nat">🌏 나라 「모두」로 보기 (0점)</button>');
    if (CUT.ch) fix.push('<button type="button" data-fix="ch">📺 채널 크기 「상관없음」으로 보기 (0점)</button>');
    if (+OPT.sWhen && OPT.sWhen !== '0' && RES.length < 5) fix.push(`<button type="button" data-fix="when">📅 기간 「${OPT.sWhen === '7' ? '1달' : OPT.sWhen === '30' ? '1년' : '전체'}」로 다시 찾기 (100점)</button>`);
    if (!RES.length) return `<div class="why"><b>🔍 유튜브에서 받은 ${RAW.length}개 중 조건에 맞는 게 없어요</b><p>뺀 영상: ${cutTxt()}</p>${fix.join('')}<p class="sm">👆 위에서 👀 조회수 · 🌏 나라 · 📺 채널 크기 · ↕ 순서를 바꾸면 받은 영상에서 <b>바로 다시 걸러요 (0점)</b>. 📅 기간 · 검색어를 바꾸면 새로 찾아요 (100점).</p></div>`;
    return `<p class="rhint" style="text-align:center">유튜브에서 받은 ${RAW.length}개 중 ${RES.length}개${Object.keys(CUT).length ? `<br>뺀 영상: ${cutTxt()}` : ''}</p>${RES.length < 5 && fix.length ? `<div class="why">${fix.join('')}</div>` : ''}`;
  }
  /* 📺 채널 구독자 수 (50개 채널에 1점) → 구독자 대비 몇 배 */
  async function subs(list) {
    const ids = [...new Set(list.map(v => v.chId).filter(Boolean))]; if (!ids.length) return;
    try {
      const j = await api('channels', { part: 'statistics', id: ids.slice(0, 50).join(','), maxResults: 50 }); quota(1);
      const m = {}; (j.items || []).forEach(c => { m[c.id] = c.statistics && !c.statistics.hiddenSubscriberCount ? +c.statistics.subscriberCount : null; });
      list.forEach(v => { const n = m[v.chId]; v.subs = n == null ? null : n; v.ratio = n ? Math.round(v.views / n * 10) / 10 : 0; });
    } catch (e) { /* 구독자 수 없이 */ }
  }
  /* 🌏 나라: 영상 말 정보(ko) 또는 제목에 한글이 있으면 한국 영상으로 봐요 */
  const isKo = v => v.ko != null ? v.ko : /^ko/.test(v.lang || '') || /[가-힣]/.test(v.title || '') || (!v.lang && /[가-힣]{4,}/.test(v.desc || ''));
  const natOk = v => OPT.sNat === 'ko' ? isKo(v) : OPT.sNat === 'foreign' ? !isKo(v) : true;
  async function search(more) {
    if (busy) return; const q = $('q').value.trim();
    if (!more && !q) { $('q').focus(); return; }
    if (!key()) { showKey(true); $('keyBox').scrollIntoView({ behavior: 'smooth' }); return toast('먼저 🔑 검색 키를 넣어 주세요'); }
    if (!(await canSpend())) return;
    if (!more) { NEXT = ''; SEEN = new Set(); RES = []; RAW = []; CUT = {}; PG = 0; LAST = q; }
    const before = RES.length; busy = true; ERR = ''; drawRes('🔎 찾는 중…');
    try {
      await onePage();
      if (RES.length - before < 5 && NEXT && quota(0) >= 200) { drawRes('🔎 조건에 맞는 영상이 적어서 한 번 더 찾는 중… (100점)'); await onePage(); }   // 한 번만 더
      if (more && RES.length > before) toast(`⬇ ${RES.length - before}개 더 찾았어요`);
    } catch (e) { ERR = '⚠️ ' + e.message; }
    busy = false; drawRes();
  }
  function pager(n, pg) {
    if (n < 2) return '';
    return `<div class="ppages">${pg > 0 ? `<button type="button" data-pg="${pg - 1}">◀</button>` : ''}${Array.from({ length: n }, (_, i) => `<button type="button" data-pg="${i}"${i === pg ? ' class="on"' : ''}>${i + 1}</button>`).join('')}${pg < n - 1 ? `<button type="button" data-pg="${pg + 1}">▶</button>` : ''}</div>`;
  }
  async function drawRes(wait) {
    const box = $('res');
    if (wait) { box.innerHTML = (RES.length ? box.innerHTML : '') + `<p class="rmsg">${wait}</p>`; return; }
    const saved = new Set((await all()).map(r => r.id)), n = Math.max(1, Math.ceil(RES.length / PER)); if (PG >= n) PG = n - 1;
    box.innerHTML = (RES.length ? `<p class="rhint" style="text-align:center;margin:0">${PG * PER + 1}~${Math.min(RES.length, PG * PER + PER)}번째 · ${PG + 1}/${n}쪽</p>` : '')
      + RES.slice(PG * PER, PG * PER + PER).map(v => card(v, saved.has(v.id), false)).join('')
      + pager(n, PG) + (ERR ? `<p class="rmsg" style="color:#dc2626">${esc(ERR)}</p>` : '') + whyBox()
      + (NEXT && PG === n - 1 ? '<button type="button" class="rmore" id="rMore">⬇ 다음 50개 더 찾기 (100점)</button>' : '');
  }
  $('go').addEventListener('click', () => search(false));
  $('go2').addEventListener('click', () => { if (!$('q').value.trim()) { $('q').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('q').focus(); return toast('위 칸에 무엇을 찾을지 써 주세요'); } search(false); });
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(false); } });
  $('res').addEventListener('click', e => {
    if (e.target.closest('#rMore')) { search(true); return; }
    const fx = e.target.closest('[data-fix]');
    if (fx) {
      const k = fx.dataset.fix;
      if (k === 'views') SETS.sMin(+OPT.sMin > 100000 ? '100000' : '0');
      else if (k === 'nat') SETS.sNat('all');
      else if (k === 'ch') SETS.sCh('0');
      else if (k === 'when') { SETS.sWhen(OPT.sWhen === '7' ? '30' : OPT.sWhen === '30' ? '365' : '0'); search(false); return; }
      toast('🔁 받은 영상에서 다시 걸렀어요 (0점)'); return;
    }
    const pg = e.target.closest('[data-pg]'); if (pg) { PG = +pg.dataset.pg; drawRes(); $('res').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    act(e, false);
  });

  /* ── 카드 ── */
  function st2(v) {
    const a = [];
    if (v.subs != null && v.subs !== undefined) a.push(`👥 구독자 ${views(v.subs)}`); else if ('subs' in v) a.push('👥 구독자 비공개');
    if (v.ratio >= 1) a.push(`🔥 구독자의 ${v.ratio >= 10 ? Math.round(v.ratio) : v.ratio}배`);
    if (v.daily) a.push(`📈 하루 ${views(v.daily)}회`);
    return a.length ? `<span class="st2">${a.join(' · ')}</span>` : '';
  }
  function card(v, saved, mine) {
    const meta = [v.views ? `<span class="vw">👀 ${views(v.views)}회</span>` : '', v.ch ? esc(v.ch) : '', v.date ? ymd(v.date) : ''].filter(Boolean).join(' · ');
    const memo = mine && ((v.tags && v.tags.length) || v.memo || v.lvl) ? `<p class="memo">${v.lvl && LVL[v.lvl] ? `<span style="background:#5b21b6;color:#fff">🎚 ${esc(LVL[v.lvl])}</span>` : ''}${(v.tags || []).map(t => `<span>${esc(TAGTXT[t] || t)}</span>`).join('')}${esc(v.memo || '')}</p>` : '';
    const go = v.kind === 'yt' || v.kind === 'file' ? 'play' : 'open';
    return `<div class="rv" data-id="${esc(v.id)}"><div class="th" data-a="${go}" role="button" style="${v.thumb ? `background-image:url('${esc(v.thumb)}')` : ''}"><em>${BADGE[v.kind] || ''}</em>${v.sec ? `<i>${mmss(v.sec)}</i>` : ''}${v.kind === 'yt' || v.kind === 'file' ? '<span class="pl">▶</span>' : ''}</div>
      <div style="min-width:0"><b data-a="${go}" role="button">${esc(v.title || v.url)}</b><small>${meta}</small>${st2(v)}
      <div class="acts">${v.kind === 'yt' ? `<button type="button" data-a="play">▶ 보기</button><a href="${esc(v.url)}" target="_blank" rel="noopener">↗ 유튜브</a>` : v.kind === 'file' ? '<button type="button" data-a="play">▶ 보기</button>' : `<a href="${esc(v.url)}" target="_blank" rel="noopener">↗ 열기</a>`}
      ${mine ? '<button type="button" data-a="memo">📝 메모</button><button type="button" data-a="make">🎬 이걸로 만들기 ▸</button><button type="button" class="red" data-a="del">🗑</button>'
        : `<button type="button" data-a="save" class="${saved ? 'on' : ''}">${saved ? '✅ 담았어요' : '📌 담기'}</button>`}</div></div>${memo}</div>`;
  }
  async function act(e, mine) {
    const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('.rv').dataset.id, a = b.dataset.a;
    const list = mine ? await all() : RES, v = list.find(x => x.id === id); if (!v) return;
    if (a === 'play') return play(v);
    if (a === 'open') { window.open(v.url, '_blank', 'noopener'); return; }
    if (a === 'save') { const has = (await all()).find(x => x.id === id); if (has) return toast('이미 담아 둔 영상이에요'); const r = Object.assign({}, v, { at: Date.now(), tags: [], memo: '' }); await put(r); b.textContent = '✅ 담았어요'; b.classList.add('on'); count(); memoSheet(r, true); return; }
    if (a === 'memo') return memoSheet(v, false);
    if (a === 'del') { if (!confirm('내 레퍼런스에서 뺄까요?\n「' + (v.title || v.url) + '」')) return; await del(id); drawMine(); return; }
    if (a === 'make') return make(v);
  }
  function play(v) {
    if (v.kind === 'file') {
      const u = v.file ? URL.createObjectURL(v.file) : '';
      const s = sheet('▶ ' + esc((v.title || '').slice(0, 40)), u ? `<div class="player"><video src="${u}" controls playsinline autoplay style="position:absolute;inset:0;width:100%;height:100%;background:#000"></video></div>` : '<p>⚠️ 영상 파일을 찾지 못했어요</p>');
      const d = s.box.parentNode, ob = new MutationObserver(() => { if (!d.isConnected) { URL.revokeObjectURL(u); ob.disconnect(); } }); ob.observe(document.body, { childList: true });
      return s;
    }
    const s = sheet('▶ ' + esc((v.title || '').slice(0, 40)), `<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.vid)}?playsinline=1&autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
      <p class="rhint">${v.views ? `👀 ${views(v.views)}회 · ` : ''}${esc(v.ch || '')}</p><a class="big sec" href="${esc(v.url)}" target="_blank" rel="noopener">↗ 유튜브 앱에서 보기</a>`);
    return s;
  }
  function memoSheet(v, fresh) {
    const s = sheet(fresh ? '📌 담았어요 — 무엇을 참고할까요?' : '📝 메모', `<span class="rlbl" style="margin-top:0">제목</span><input class="rin" id="mTitle" value="${esc(v.title || '')}" placeholder="이 영상 이름" style="margin-bottom:8px">
      <span class="rlbl">🎯 무엇을 따라 할까요? <small style="font-weight:600;color:#64748b">(여러 개 골라요)</small></span>
      <div id="mTags">${KIT.whatHTML ? KIT.whatHTML(v.tags || []) : ''}</div>
      <span class="rlbl">🎚 얼마나 비슷하게</span><div class="seg" id="mLvl">${(KIT.REFLVL || []).map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${(v.lvl || 'similar') === k}">${l}</button>`).join('')}</div>
      <span class="rlbl">✍️ 자세히 적기 (선택)</span><textarea class="rin" id="mTxt" rows="4" placeholder="예: 0:03 손뼉 두 번 → 0:05 오른팔 들고 한 바퀴 · 첫 장면에 결과부터 · 자막이 크고 노랑">${esc(v.memo || '')}</textarea>
      <button type="button" class="big pri" id="mOk" style="background:#5b21b6">💾 저장</button>`);
    s.box.querySelector('#mTags').addEventListener('click', e => { const b = e.target.closest('button[data-w]'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
    s.box.querySelector('#mLvl').addEventListener('click', e => { const b = e.target.closest('button'); if (b) s.box.querySelectorAll('#mLvl button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    s.box.querySelector('#mOk').addEventListener('click', async () => {
      v.tags = [...s.box.querySelectorAll('#mTags [aria-pressed=true]')].map(b => b.dataset.w); v.lvl = (s.box.querySelector('#mLvl [aria-pressed=true]') || {}).dataset ? s.box.querySelector('#mLvl [aria-pressed=true]').dataset.v : 'similar'; v.memo = s.box.querySelector('#mTxt').value.trim(); v.title = s.box.querySelector('#mTitle').value.trim() || v.title; await put(v); s.close(); toast('💾 저장했어요'); if (!$('tMine').hidden) drawMine();
    });
  }
  function make(v) {
    const s = sheet('🎬 어디에서 참고할까요?', `<p class="rhint" style="margin:0 0 8px">${esc(v.title || v.url || '')}</p>
      <button type="button" class="big pri" data-go="shorts/edit.html" style="background:linear-gradient(135deg,#ec4899,#f97316)">🎵 쇼츠 만들기에서 참고</button>
      <button type="button" class="big pri" data-go="video/" style="background:linear-gradient(135deg,#0ea5e9,#0d9488)">🎬 영상 만들기에서 참고 (AI 요청서에 들어가요)</button>
      <p class="rhint">고른 곳 맨 위에 「🎯 참고 영상」 띠가 생겨요. ➕ 자료 넣기 → 🎯 내 레퍼런스에서도 고를 수 있어요.</p>`);
    s.box.addEventListener('click', e => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      LS('bkeRefPick', JSON.stringify({ id: v.id, url: v.url || '', kind: v.kind, vid: v.vid, title: v.title || '', thumb: v.thumb || '', views: v.views || 0, ch: v.ch || '', tags: v.tags || [], lvl: v.lvl || '', memo: v.memo || '', at: Date.now() }));
      location.href = b.dataset.go + '?ref=1';
    });
  }

  /* ── 📌 내 레퍼런스 ── */
  async function count() { const n = (await all()).length; $('mineN').textContent = n ? `(${n})` : ''; }
  let MPG = 0;
  async function drawMine() {
    const q = $('mFind').value.trim(), list = (await all()).filter(r => !q || ((r.title || '') + ' ' + (r.memo || '') + ' ' + (r.ch || '')).includes(q));
    const n = Math.max(1, Math.ceil(list.length / PER)); if (MPG >= n) MPG = n - 1;
    $('mine').innerHTML = (list.slice(MPG * PER, MPG * PER + PER).map(r => card(r, true, true)).join('') + pager(n, MPG)) || `<p class="rmsg">${q ? '찾는 레퍼런스가 없어요' : '아직 담은 영상이 없어요.<br>🔎 찾기에서 📌 담기, 또는 위에 주소를 붙여넣어 주세요.'}</p>`;
    count();
  }
  $('mine').addEventListener('click', e => { const pg = e.target.closest('[data-pg]'); if (pg) { MPG = +pg.dataset.pg; drawMine(); $('mine').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; } act(e, true); });
  $('mFind').addEventListener('input', () => { MPG = 0; drawMine(); });
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
  /* 📁 내 영상 파일 담기 (내 휴대폰에 있는 · 내려받아 둔 참고 영상) — 이 휴대폰 안에만 저장 */
  function frame(f) {
    return new Promise(res => {
      const v = document.createElement('video'), u = URL.createObjectURL(f); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = u;
      const fin = r => { URL.revokeObjectURL(u); res(r); }; setTimeout(() => fin({}), 8000);
      v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
      v.onseeked = () => { try { const w = 240, h = Math.round(w * (v.videoHeight || 16) / (v.videoWidth || 9)), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(v, 0, 0, w, h); fin({ thumb: c.toDataURL('image/jpeg', .7), sec: Math.round(v.duration || 0) }); } catch (e) { fin({ sec: Math.round(v.duration || 0) }); } };
      v.onerror = () => fin({});
    });
  }
  $('addFile').addEventListener('click', () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*'; i.multiple = true;
    i.onchange = async () => {
      const fs = Array.from(i.files || []).filter(f => /^video/.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name)); if (!fs.length) return;
      if (fs.some(f => f.size > 60 * 1048576)) toast('⚠️ 60MB 넘는 영상은 AI에게 보낼 때 안 갈 수 있어요 · 짧게 잘라 넣으면 좋아요', 3500);
      let last = null;
      for (const [n, f] of fs.entries()) {
        const fr = await frame(f);
        last = { id: 'file:' + Date.now() + '_' + n, kind: 'file', url: '', title: f.name.replace(/\.\w+$/, ''), file: f, sec: fr.sec || 0, thumb: fr.thumb || '', at: Date.now() + n, tags: [], memo: '', lvl: 'similar' };
        await put(last);
      }
      await drawMine(); toast(`📁 내 영상 ${fs.length}개를 담았어요`); if (fs.length === 1) memoSheet(last, true);
    };
    i.click();
  });
  count();
  if (/[?&]t=mine/.test(location.search)) tab('mine');
})();
