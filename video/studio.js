/*!
 * studio.js — BK영상 화면 동작 (장면 · 꾸미기 · 미리보기 · 영상 만들기)
 * 영상 엔진(engine.js · mp4mux.js · music.js)은 BK쇼츠와 같은 것을 씀. 대본 · 목소리 · AI 장면은 talk.js
 */
(function () {
  'use strict';
  const E = window.ENG;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // ═════════ 설정 ═════════
  const PRESETS = {
    news: { n: '📺 뉴스', v: { font: 'noto', size: 70, color: '#ffffff', stroke: '#000000', strokeW: 4, shadow: true, box: true, boxColor: '#000000', boxOp: 0.55, yPos: 74, topColor: '#ffffff', botColor: '#e5e7eb' } },
    variety: { n: '💛 예능', v: { font: 'blackhan', size: 84, color: '#ffe14d', stroke: '#111111', strokeW: 10, shadow: true, box: false, yPos: 72, topColor: '#ffe14d', botColor: '#ffffff' } },
    cinema: { n: '🎬 시네마', v: { font: 'nanumgothic', size: 64, color: '#ffffff', stroke: '#000000', strokeW: 3, shadow: true, box: false, yPos: 80, topColor: '#ffffff', botColor: '#d1d5db' } },
    calm: { n: '🌙 감성', v: { font: 'gowunbatang', size: 68, color: '#ffffff', stroke: '#000000', strokeW: 5, shadow: true, box: false, yPos: 50, topColor: '#ffffff', botColor: '#e5e7eb' } },
    white: { n: '⬜ 흰 상자', v: { font: 'noto', size: 66, color: '#111827', stroke: '#ffffff', strokeW: 0, shadow: false, box: true, boxColor: '#ffffff', boxOp: 0.88, yPos: 74, topColor: '#ffffff', botColor: '#e5e7eb' } },
  };
  const DEF = Object.assign({
    preset: 'news', align: 'center', anim: 'none', lineSp: 1.35, boxColor: '#000000', boxOp: 0.55,
    showCh: true, showSrc: true, topFont: 'same', topSize: 62, topY: 9, botFont: 'same', botSize: 34, botY: 96,
    motion: 'random', strength: 0.1, trans: 'soft', fit: 'auto', filter: 'none', vignette: 0.2,
    volume: 1, bgmStart: 0, fadeOut: 2, talkBgm: 0.15, sound: 'mine', flowVol: 0.25, res: '1080', fps: '30', hq: false,
  }, PRESETS.news.v);
  const KEY = 'bk-edit-video.v1';
  function loadSettings() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEF); } }
  let saveTimer = 0;
  const saveSettings = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S.set)); } catch (e) { /* 저장 불가 */ } }, 300); };
  const S = { set: loadSettings(), photos: [], audio: null, narr: null, talkMap: [], busy: false };
  let uid = 1;

  // ═════════ 공통 ═════════
  let toastTimer = 0;
  function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms); }
  function busy(on, text) { $('#screenBusy').hidden = !on; if (text) $('#busyText').textContent = text; }
  const fmtTime = s => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
  const FMT = { size: v => `${v}`, volume: v => `${Math.round(v * 100)}%`, talkBgm: v => `${Math.round(v * 100)}%`, yPos: v => `${v}%`, strength: v => `${Math.round(v * 100)}%` };

  function syncControls() {
    $$('[data-k]').forEach(el => {
      const k = el.dataset.k, v = S.set[k];
      if (el.classList.contains('seg') || el.classList.contains('chips')) el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(String(v) === b.dataset.v)));
      else if (el.type === 'checkbox') el.checked = !!v;
      else if (el.value !== String(v)) el.value = v;
    });
    $$('output[data-o]').forEach(o => { const k = o.dataset.o; o.textContent = FMT[k] ? FMT[k](S.set[k]) : S.set[k]; });
  }
  function setVal(k, v) {
    S.set[k] = v; saveSettings();
    const o = document.querySelector(`output[data-o="${k}"]`); if (o) o.textContent = FMT[k] ? FMT[k](v) : v;
    if (k === 'res' || k === 'fps' || k === 'hq') return;
    scheduleRebuild(k === 'size' || k === 'yPos' ? 120 : 200);
  }
  function bindControls() {
    $$('[data-k]').forEach(el => {
      const k = el.dataset.k;
      if (el.classList.contains('seg') || el.classList.contains('chips')) {
        el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); setVal(k, b.dataset.v); });
      } else {
        const ev = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
        el.addEventListener(ev, () => { let v = el.type === 'checkbox' ? el.checked : el.value; if (el.type === 'range') v = parseFloat(v); setVal(k, v); });
      }
    });
  }
  // 자막 스타일 묶음
  $('#presets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button type="button" data-v="${k}">${p.n}</button>`).join('');
  $('#presets').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    Object.assign(S.set, PRESETS[b.dataset.v].v, { preset: b.dataset.v }); saveSettings(); syncControls(); scheduleRebuild(0);
  });

  // ═════════ 탭 ═════════
  function showTab(name) {
    $$('.panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
    $$('.tabbar button').forEach(b => { if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (name === 'make') updateSummary();
    const panels = $('.panels');
    const y = panels.getBoundingClientRect().top + window.scrollY - $('.stage').offsetHeight - 8;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) });
    document.dispatchEvent(new CustomEvent('bk-tab', { detail: name }));
  }
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.go)));

  // ═════════ 사진 · 영상 ═════════
  async function keepPhoto(file) {
    const { img, release } = await E.loadImage(file);
    try {
      const iw = img.naturalWidth, ih = img.naturalHeight, sc = Math.min(1, 2400 / Math.max(iw, ih));
      const c = E.mkCanvas(iw * sc, ih * sc), x = c.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92)); c.width = 0; c.height = 0;
      if (!blob) throw new Error('사진 저장 실패'); return blob;
    } finally { release(); }
  }
  async function makeThumb(file) {
    const { img, release } = await E.loadImage(file);
    try {
      const c = E.mkCanvas(180, 320), x = c.getContext('2d'), iw = img.naturalWidth, ih = img.naturalHeight, s = Math.max(180 / iw, 320 / ih);
      x.drawImage(img, (180 - iw * s) / 2, (320 - ih * s) / 2, iw * s, ih * s); return c.toDataURL('image/jpeg', 0.75);
    } finally { release(); }
  }
  async function addPhotos(files) {
    const all = Array.from(files || []);
    const vids = all.filter(f => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name));
    const list = all.filter(f => !vids.includes(f));
    if (vids.length) await addVideos(vids);
    if (!list.length) return;
    let bad = 0;
    for (let i = 0; i < list.length; i++) {
      busy(true, `사진 불러오는 중… ${i + 1}/${list.length}`);
      try { const kept = await keepPhoto(list[i]); S.photos.push({ id: uid++, kind: 'photo', file: kept, name: list[i].name, thumb: await makeThumb(kept) }); } catch (e) { bad++; }
    }
    busy(false);
    if (bad) toast(`${bad}장은 열 수 없는 형식이라 건너뛰었어요 (JPG·PNG 권장)`);
    renderPhotos(); scheduleRebuild(0);
  }
  let vidBox = null;
  function mkClipVideo(url) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto'; v.src = url;
    if (!vidBox) { vidBox = document.createElement('div'); vidBox.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none'; document.body.appendChild(vidBox); }
    vidBox.appendChild(v); return v;
  }
  function waitVideo(v) {
    return new Promise((res, rej) => {
      if (v.readyState >= 2) return res();
      const ok = () => { clean(); res(); }, bad = () => { clean(); rej(new Error('영상을 열 수 없어요')); };
      const clean = () => { v.removeEventListener('loadeddata', ok); v.removeEventListener('error', bad); };
      v.addEventListener('loadeddata', ok); v.addEventListener('error', bad);
      setTimeout(() => { clean(); v.readyState >= 1 ? res() : rej(new Error('영상을 열 수 없어요')); }, 15000);
    });
  }
  async function addVideos(files) {
    const list = Array.from(files || []); if (!list.length) return;
    let bad = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i]; busy(true, `영상 불러오는 중… ${i + 1}/${list.length}`);
      let src = f; if (f.size <= 200 * 1048576) { try { src = new Blob([await f.arrayBuffer()], { type: f.type || 'video/mp4' }); } catch (e) { src = f; } }
      const url = URL.createObjectURL(src), el = mkClipVideo(url), xel = mkClipVideo(url);
      try {
        await waitVideo(el);
        const dur = isFinite(el.duration) ? el.duration : 0; if (!(dur > 0.3)) throw new Error('짧음');
        el.play().then(() => el.pause()).catch(() => {}); xel.play().then(() => xel.pause()).catch(() => {});
        await E.seekVideo(el, Math.min(0.4, dur / 2));
        const c = E.mkCanvas(180, 320), x = c.getContext('2d'), iw = el.videoWidth || 9, ih = el.videoHeight || 16, s = Math.max(180 / iw, 320 / ih);
        x.fillStyle = '#000'; x.fillRect(0, 0, 180, 320); try { x.drawImage(el, (180 - iw * s) / 2, (320 - ih * s) / 2, iw * s, ih * s); } catch (e) { /* 그림 없음 */ }
        S.photos.push({ id: uid++, kind: 'video', file: src, name: f.name, thumb: c.toDataURL('image/jpeg', 0.75), url, el, xel, dur, abuf: null });
      } catch (e) { bad++; el.remove(); xel.remove(); URL.revokeObjectURL(url); }
    }
    busy(false);
    if (bad) toast(`${bad}개는 열 수 없는 영상이라 건너뛰었어요 (MP4 권장)`);
    renderPhotos(); scheduleRebuild(0);
  }
  function freeItem(p) { if (p.kind !== 'video') return; p.el.pause(); p.xel.pause(); p.el.remove(); p.xel.remove(); p.el.src = ''; p.xel.src = ''; URL.revokeObjectURL(p.url); }
  function renderPhotos() {
    $('#photoGrid').innerHTML = S.photos.map((p, i) => `<li data-id="${p.id}"><img src="${p.thumb}" alt="${i + 1}번"><span class="num tnum">${i + 1}</span>${p.kind === 'video' ? `<span class="vbadge tnum">▶ ${fmtTime(p.dur)}</span>` : ''}
      <div class="acts"><button type="button" data-act="left" aria-label="앞으로">◀</button><button type="button" data-act="del" aria-label="삭제">✕</button><button type="button" data-act="right" aria-label="뒤로">▶</button></div></li>`).join('');
    $('#photoEmpty').hidden = S.photos.length > 0;
    $('#screenEmpty').hidden = S.photos.length > 0;
    $('#playBtn').disabled = $('#scrub').disabled = !S.photos.length;
    document.dispatchEvent(new Event('bk-photos'));
  }
  $('#photoGrid').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = +b.closest('li').dataset.id, i = S.photos.findIndex(p => p.id === id);
    if (b.dataset.act === 'del') { freeItem(S.photos[i]); S.photos.splice(i, 1); }
    else if (b.dataset.act === 'left' && i > 0) [S.photos[i - 1], S.photos[i]] = [S.photos[i], S.photos[i - 1]];
    else if (b.dataset.act === 'right' && i < S.photos.length - 1) [S.photos[i + 1], S.photos[i]] = [S.photos[i], S.photos[i + 1]];
    renderPhotos(); scheduleRebuild(0);
  });
  $('#photoInput').addEventListener('change', e => { addPhotos(e.target.files); e.target.value = ''; });
  $('#videoInput').addEventListener('change', e => { addVideos(e.target.files); e.target.value = ''; });

  // ═════════ 배경음악 ═════════
  async function setMusic(file) {
    busy(true, '음악 읽는 중…');
    try { const info = await E.analyzeAudio(file); S.audio = Object.assign({ file, name: file.name }, info); P.audioKey = null; renderMusic(); scheduleRebuild(0); toast('배경음악을 넣었어요'); }
    catch (e) { toast(e.message || '음악을 열 수 없어요'); } finally { busy(false); }
  }
  async function setBuiltin(kind) {
    pause(); busy(true, '음악 만드는 중… (처음 한 번 몇 초 걸려요)');
    try { const buf = await window.BKMUSIC.render(kind, 90); const info = E.analyzeBuffer(buf); S.audio = Object.assign({ builtin: kind, name: window.BKMUSIC.label(kind) }, info); P.audioKey = null; renderMusic(); scheduleRebuild(0); toast('배경음악을 넣었어요 · ▶로 들어 보세요'); }
    catch (e) { toast('음악을 만들지 못했어요'); } finally { busy(false); }
  }
  if (window.BKMUSIC) $('#builtinList').innerHTML = window.BKMUSIC.LIST.map(([g, items]) => `<p class="mlbl">${g}</p><div class="chips">${items.map(([k, l]) => `<button type="button" data-m="${k}">${l}</button>`).join('')}</div>`).join('');
  $('#builtinList').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (b) setBuiltin(b.dataset.m); });
  function renderMusic() {
    const a = S.audio;
    $$('#builtinList button').forEach(b => b.setAttribute('aria-pressed', String(!!a && a.builtin === b.dataset.m)));
    $('#musicNow').hidden = !a; if (a) $('#musicName').textContent = `🎵 ${a.name} · ${fmtTime(a.duration)}`;
  }
  $('#musicInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) setMusic(f); e.target.value = ''; });
  $('#musicRemove').addEventListener('click', () => { pause(); S.audio = null; P.audioKey = null; renderMusic(); scheduleRebuild(0); });

  // ═════════ 프로젝트: 목소리 문장 시간에 맞춰 장면 · 자막 · 소리 ═════════
  const TRANS = { soft: ['crossfade', 0.6], fast: ['zoom', 0.4], fun: ['random', 0.7], none: ['crossfade', 0] };
  function buildProject() {
    if (!S.photos.length) return null;
    const st = S.set, mode = st.sound || 'mine', N = mode !== 'flow' && S.narr && S.narr.on && S.narr.buffer ? S.narr : null;
    let scenes, total, subs = [], audio = null;
    const G = S.groupsFn ? S.groupsFn() : [], mapG = S.talkMap || [];
    if (mode === 'flow' && G.length) {        // 🎬 Flow 소리 그대로: 장면마다 만든 클립 길이대로 · 클립 속 소리 · 대사 자막
      scenes = []; total = 0; const clips = [];
      G.forEach(g => {
        const i = S.photos.findIndex(p => p.id === mapG[g.idx[0]]), it = i >= 0 ? S.photos[i] : null;
        const img = i >= 0 ? i : (S.photos.length ? scenes.length % S.photos.length : 0), dur = it && it.kind === 'video' ? it.dur : Math.max(2, g.dur);
        scenes.push({ img, start: total, end: total + dur, text: '', clipStart: 0 });
        const tl = g.lines.reduce((a, l) => a + l.length, 0) || 1; let t = total;
        g.lines.forEach(l => { const d = dur * l.length / tl; subs.push({ start: t, end: t + d - 0.05, text: l, anim: null }); t += d; });
        if (it && it.kind === 'video' && it.abuf) clips.push({ buffer: it.abuf, at: total, offset: 0, dur });
        total += dur;
      });
      audio = { buffer: S.audio && st.volume > 0 ? S.audio.buffer : null, start: st.bgmStart, volume: st.volume * 0.35, fadeIn: 0.5, fadeOut: st.fadeOut, clips, duck: [], clipVolume: 1 };
    } else if (N) {
      const lead = N.lead == null ? 0.35 : N.lead, tail = 1.2, segs = N.segs.filter(g => g.e > g.s), n = Math.max(1, segs.length);
      total = lead + N.duration + tail;
      const bounds = [0]; for (let k = 1; k < n; k++) bounds.push(lead + (segs[k - 1].e + segs[k].s) / 2); bounds.push(total);
      const map = S.talkMap || [], used = new Set(map.filter(v => v != null));
      const pool = S.photos.map((p, i) => i).filter(i => !used.has(S.photos[i].id));
      // 정해 둔 영상이 없는 문장: 남은 사진 · 배경을 차례로 → 남은 게 없으면 앞 장면을 이어서 (같은 클립을 다시 틀지 않음)
      let rr = 0; const pick = k => { const i = map[k] != null ? S.photos.findIndex(p => p.id === map[k]) : -1; if (i >= 0) return i; if (pool.length) return pool[rr++ % pool.length]; return scenes.length ? scenes[scenes.length - 1].img : 0; };
      scenes = [];
      // 📷 사진마다 시작 문장을 골라 두었으면 (pair.js) → 사진이 그 문장이 시작하는 순간에 바뀌어요
      const SM = S.startMap || {}, ks = S.photos.map(p => SM[p.id]);
      const useSM = S.startOn && S.photos.length && ks.every(v => v != null && v < n) && ks.every((v, i) => i === 0 || v > ks[i - 1]);
      if (useSM) S.photos.forEach((p, i) => { const s0 = i === 0 ? 0 : bounds[ks[i]], e0 = i + 1 < ks.length ? bounds[ks[i + 1]] : total; if (e0 > s0) scenes.push({ img: i, start: s0, end: e0, text: '', clipStart: 0 }); });
      else for (let k = 0; k < n; k++) { const img = pick(k), last = scenes[scenes.length - 1]; if (last && last.img === img) last.end = bounds[k + 1]; else scenes.push({ img, start: bounds[k], end: bounds[k + 1], text: '', clipStart: 0 }); }
      // 클립이 장면보다 조금 짧으면 천천히 늘려 채움 (최대 약 1.6배 느리게 · 더 짧으면 끝 화면에서 멈춤)
      scenes.forEach(sc => { const it = S.photos[sc.img], len = sc.end - sc.start; if (it.kind === 'video' && it.dur + 0.05 < len && it.dur / len >= 0.6) sc.rate = (it.dur - 0.06) / len; });
      subs = segs.filter(g => (g.t || '').trim()).map(g => ({ start: lead + g.s, end: Math.min(total - 0.2, lead + g.e + 0.12), text: g.t, anim: null }));
      const vol = st.volume * st.talkBgm;
      audio = { buffer: S.audio && vol > 0 ? S.audio.buffer : null, start: st.bgmStart, volume: vol, fadeIn: 0.5, fadeOut: st.fadeOut, clips: [{ buffer: N.buffer, at: lead, offset: 0, dur: N.duration }], duck: [], clipVolume: N.gain || 1 };
      if (mode === 'mix') scenes.forEach(sc => { const it = S.photos[sc.img]; if (it && it.kind === 'video' && it.abuf) audio.clips.push({ buffer: it.abuf, at: sc.start, offset: 0, dur: sc.end - sc.start, vol: st.flowVol == null ? 0.25 : st.flowVol }); });   // 🔀 섞기: 클립 소리는 작게
    } else {                                   // 목소리 전: 장면만 3초씩 미리보기
      const per = 3; total = S.photos.length * per;
      scenes = S.photos.map((p, i) => ({ img: i, start: i * per, end: (i + 1) * per, text: '', clipStart: 0 }));
      if (S.audio) audio = { buffer: S.audio.buffer, start: st.bgmStart, volume: st.volume * 0.6, fadeIn: 0.5, fadeOut: st.fadeOut, clips: [], duck: [], clipVolume: 1 };
    }
    const cs = S.chsrc ? S.chsrc() : { ch: '', src: '' }, tr = TRANS[st.trans] || TRANS.soft;
    return {
      photos: S.photos.slice(), scenes, total, subs,
      style: { font: st.font, size: +st.size, color: st.color, stroke: st.stroke, strokeW: st.strokeW, shadow: st.shadow, box: st.box, boxColor: st.boxColor, boxOp: st.boxOp, align: st.align, yPos: +st.yPos, anim: st.anim, lineSp: st.lineSp },
      topText: st.showCh && cs.ch ? `● ${cs.ch}` : '', bottomText: st.showSrc && cs.src ? `자료출처=${cs.src}` : '',
      fixedStyle: { top: { font: st.topFont, size: st.topSize, color: st.topColor, y: st.topY }, bottom: { font: st.botFont, size: st.botSize, color: st.botColor, y: st.botY } },
      transition: tr[0], newTrans: true, transDur: tr[1], motion: st.motion, strength: st.strength, fit: st.fit, filter: st.filter,
      particles: [], density: 1, stickers: [], frame: 'none', frameImg: null, vignette: st.vignette, overlayVideo: null, ovOpacity: 0.8, fadeEdges: true,
      audio, card: null,
    };
  }

  // ═════════ 미리보기 ═════════
  const P = { canvas: $('#preview'), ctx: null, W: 540, H: 960, cache: new E.BaseCache(40), r: null, pj: null, t: 0, playing: false, raf: 0, actx: null, src: null, startAt: 0, t0: 0, perf0: 0, audioKey: null, audioBuf: null, gen: 0 };
  P.ctx = P.canvas.getContext('2d', { alpha: false }); P.ctx.imageSmoothingQuality = 'high';
  let rebuildTimer = 0;
  function scheduleRebuild(delay = 220) { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, delay); }
  async function rebuild() {
    const gen = ++P.gen, pj = buildProject();
    if (!pj) { if (P.r) { P.r.destroy(); P.r = null; } P.pj = null; pause(); P.ctx.fillStyle = '#000'; P.ctx.fillRect(0, 0, P.W, P.H); updateTime(); updateSummary(); return; }
    const r = new E.Renderer(pj, P.W, P.H, P.cache); await r.init();
    if (gen !== P.gen) { r.destroy(); return; }
    const old = P.r; P.r = r; P.pj = pj; if (old) old.destroy();
    $('#scrub').max = pj.total.toFixed(2); if (P.t >= pj.total) P.t = 0;
    updateSummary();
    if (P.playing) { const key = audioKey(pj); if (key !== P.audioKey) { const t = currentTime(); stopAudio(); P.t = t; await startAudio(t); } }
    else drawStill();
  }
  async function drawStill() {
    const r = P.r; if (!r) return;
    const tt = P.t < 0.05 ? Math.min(1.2, r.pj.total / 2) : P.t;
    r.syncPlay(tt, false);
    try { await r.ensureFor(tt); } catch (e) { toast('사진을 불러오지 못했어요'); return; }
    if (r !== P.r || P.playing) return;
    r.draw(P.ctx, tt); updateTime();
  }
  function updateTime() { const tot = P.pj ? P.pj.total : 0; $('#timeLbl').textContent = `${fmtTime(P.t)} / ${fmtTime(tot)}`; const sc = $('#scrub'); if (document.activeElement !== sc) sc.value = P.t; }
  function updateSummary() {
    const pj = P.pj;
    $('#sumLen').textContent = pj ? `${pj.total.toFixed(1)}초` : '–'; $('#sumScenes').textContent = pj ? `${pj.scenes.length}개` : '–'; $('#sumSubs').textContent = pj ? `${pj.subs.length}개` : '–';
    $('#makeWarn').textContent = !S.narr ? '⚠️ 아직 목소리가 없어요 (🎙 목소리 탭)' : !S.photos.length ? '⚠️ 장면(사진 · 영상 · 배경)이 없어요 (🎬 장면 탭)' : '';
  }
  function audioKey(pj) {
    if (!pj.audio) return 'none';
    const a = pj.audio;
    return [S.audio ? S.audio.name + S.audio.duration : '-', a.start, a.volume, a.fadeOut, pj.total.toFixed(2), S.narr && S.narr.on ? S.narr.id + ':' + (S.narr.gain || 1) + ':' + S.narr.lead : ''].join('|');
  }
  async function startAudio(t) {
    const pj = P.pj; if (!pj || !pj.audio) { P.src = null; return; }
    const key = audioKey(pj);
    if (P.audioKey !== key || !P.audioBuf) { P.audioBuf = await E.renderAudio(pj.audio, pj.total, 44100); P.audioKey = key; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!P.actx) P.actx = new AC();
    if (P.actx.state === 'suspended') await P.actx.resume();
    const src = P.actx.createBufferSource(); src.buffer = P.audioBuf; src.connect(P.actx.destination); src.start(0, Math.min(t, P.audioBuf.duration - 0.01));
    P.src = src; P.startAt = P.actx.currentTime; P.t0 = t;
  }
  function stopAudio() { if (P.src) { try { P.src.stop(); } catch (e) { /* 이미 멈춤 */ } P.src.disconnect(); P.src = null; } }
  function currentTime() { if (P.src && P.actx) return P.t0 + (P.actx.currentTime - P.startAt); return P.t0 + (performance.now() - P.perf0) / 1000; }
  async function play() {
    if (!P.r || P.playing) return;
    const r = P.r; if (P.t >= P.pj.total - 0.05) P.t = 0;
    busy(true, '미리보기 준비 중…');
    const AC = window.AudioContext || window.webkitAudioContext; if (!P.actx) P.actx = new AC();
    try { for (let k = 0; k < r.pj.scenes.length; k++) { busy(true, `미리보기 준비 중… ${k + 1}/${r.pj.scenes.length}`); await r.loadScene(k); } await startAudio(P.t); }
    catch (e) { busy(false); toast(e.message || '미리보기를 시작하지 못했어요'); return; }
    busy(false); P.playing = true; P.perf0 = performance.now(); P.t0 = P.src ? P.t0 : P.t; setPlayIcon(true);
    const loop = () => {
      if (!P.playing) return;
      const t = currentTime();
      if (!P.pj || t >= P.pj.total) { pause(); P.t = 0; drawStill(); return; }
      P.t = t; if (P.r) { P.r.syncPlay(t, true); P.r.draw(P.ctx, t); } updateTime(); P.raf = requestAnimationFrame(loop);
    };
    P.raf = requestAnimationFrame(loop);
  }
  function pause() { if (P.playing) P.t = currentTime(); P.playing = false; cancelAnimationFrame(P.raf); stopAudio(); if (P.r) P.r.syncPlay(0, false); setPlayIcon(false); }
  function setPlayIcon(on) { $('#playBtn .i-play').hidden = on; $('#playBtn .i-pause').hidden = !on; $('#playBtn').setAttribute('aria-label', on ? '일시정지' : '재생'); }
  $('#playBtn').addEventListener('click', () => (P.playing ? pause() : play()));
  $('#scrub').addEventListener('input', e => { if (P.playing) pause(); P.t = parseFloat(e.target.value); drawStill(); });

  // ═════════ 영상 만들기 ═════════
  const X = { ctl: null, url: null, file: null, wake: null };
  async function doExport() {
    const pj = buildProject();
    if (!pj) { toast('먼저 장면(사진 · 영상 · 배경)을 넣어 주세요'); showTab('scene'); return; }
    if (!S.narr) { toast('먼저 목소리를 넣어 주세요'); showTab('voice'); return; }
    pause();
    const W = S.set.res === '720' ? 720 : 1080, H = S.set.res === '720' ? 1280 : 1920, fps = +S.set.fps;
    pj.exporting = true; X.ctl = { aborted: false }; S.busy = true;
    $('#exportBtn').disabled = true; $('#progress').hidden = false; $('#result').hidden = true; setProg(0, '준비 중…');
    try { if (navigator.wakeLock) X.wake = await navigator.wakeLock.request('screen'); } catch (e) { X.wake = null; }
    try {
      const res = await E.exportVideo(pj, { W, H, fps, hq: S.set.hq }, (i, n, sec, phase) => {
        if (phase === 'audio') { setProg(0, '소리 준비 중…'); return; }
        const eta = i > 10 ? sec / i * (n - i) : 0;
        setProg(i / n, `${Math.round(i / n * 100)}% · ${i}/${n} 프레임${eta ? ` · 약 ${Math.ceil(eta)}초 남음` : ''}`);
      }, X.ctl);
      showResult(res, W, H, fps, pj.total);
    } catch (e) { $('#progress').hidden = true; toast(e.message || '영상을 만들지 못했어요', 5000); console.error(e); }
    finally { S.busy = false; $('#exportBtn').disabled = false; if (X.wake) { X.wake.release().catch(() => {}); X.wake = null; } }
  }
  function setProg(f, text) { $('#progBar').style.width = `${Math.round(f * 100)}%`; $('#progText').textContent = text; }
  function stamp() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
  function showResult(res, W, H, fps, total) {
    $('#progress').hidden = true; if (X.url) URL.revokeObjectURL(X.url);
    const name = `BK영상_${stamp()}.mp4`;
    X.file = new File([res.blob], name, { type: 'video/mp4' }); X.url = URL.createObjectURL(res.blob);
    $('#resultVideo').src = X.url; const a = $('#downloadLink'); a.href = X.url; a.download = name;
    let info = `${W}x${H} · ${fps}fps · ${total.toFixed(1)}초 · ${(res.blob.size / 1048576).toFixed(1)}MB`;
    if (res.audioCodec === 'opus') info += ' · 오디오 Opus'; if (res.warning) info += ` · ${res.warning}`;
    $('#resultInfo').textContent = info; $('#result').hidden = false; toast('영상이 완성됐어요!');
  }
  $('#exportBtn').addEventListener('click', doExport);
  $('#cancelBtn').addEventListener('click', () => { if (X.ctl) X.ctl.aborted = true; });
  $('#downloadLink').addEventListener('click', () => setTimeout(() => toast('내 파일 → 다운로드 폴더(갤러리 ‘Download’ 앨범)에 저장했어요', 4500), 300));
  $('#shareBtn').addEventListener('click', async () => {
    if (!X.file) return;
    let ok = false; try { ok = !!(navigator.canShare && navigator.canShare({ files: [X.file] })); } catch (e) { ok = false; }
    if (ok) { try { await navigator.share({ files: [X.file] }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    $('#downloadLink').click(); toast('영상을 저장했어요 · 유튜브 · 인스타 · 틱톡 앱에서 ‘다운로드’ 폴더의 영상을 올려 주세요', 5000);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.busy) toast('영상을 만드는 중이에요. 화면을 켠 채로 기다려 주세요', 4000); if (document.hidden && P.playing) pause(); });

  // ═════════ PWA ═════════
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
  $('#installBtn').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice.catch(() => {}); deferredPrompt = null; $('#installBtn').hidden = true; });
  if (false) {   /* BK에딧 안의 복사본: 오프라인 저장은 BK에딧(sw.js)이 맡아요 */
    const had = !!navigator.serviceWorker.controller; let pendingReload = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had || window.__rl) return;
      if (S.busy) { pendingReload = true; return; }
      if (S.photos.length || S.narr) { toast('새 버전이 나왔어요 · 다음에 앱을 열 때 바뀌어요', 4000); return; }
      window.__rl = 1; location.reload();
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {}));
    setInterval(() => { if (pendingReload && !S.busy && !S.photos.length) location.reload(); }, 5000);
  }

  // ═════════ 시작 ═════════
  if (!E.supportInfo().video) { $('#supportWarn').hidden = false; $('#supportWarn').textContent = '이 브라우저에서는 영상 저장(WebCodecs)이 안 돼요. 안드로이드는 크롬, 아이폰은 최신 사파리에서 열어 주세요.'; $('#exportBtn').disabled = true; }
  bindControls(); syncControls(); renderPhotos(); renderMusic(); updateTime();
  window.__app = { S, P, buildProject, addPhotos, addVideos, setMusic, setBuiltin, doExport, scheduleRebuild, showTab, toast, busy, syncControls, setVal, renderPhotos };
})();
