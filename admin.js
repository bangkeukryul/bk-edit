/*!
 * admin.js — BK에딧 관리자 메뉴 (만든 사람용): 지금 버전 백업 · 관리용 주소 · 숨기기
 * 켜는 방법: 주소 뒤에 ?bkadmin  /  맨 아래 'BK에딧 · BK Agent'를 3초 안에 7번 누르기
 * 다른 BK 앱과 같은 주소(bangkeukryul.github.io)를 쓰므로 관리자 켜짐 표시('bkAdmin')를 함께 써요.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'bkAdmin', REPO = 'https://github.com/bangkeukryul/bk-edit', UP = REPO + '/upload/main', APP = 'https://bangkeukryul.github.io/bk-edit/';
  /* 백업할 파일 (폴더별로 따로 올려야 해요: 맨 위 · shorts · video) */
  const FILES = ['index.html', 'edit.js', 'edit.css', 'fx.js', 'handoff.js', 'terms.js', 'admin.js', 'bkkit.js', 'license.js', 'mp4mux.js', 'sw.js', 'manifest.webmanifest', 'README.md',
    'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'og.png',
    'shorts/edit.html', 'shorts/edit.css', 'shorts/ed-core.js', 'shorts/ed-render.js', 'shorts/ed-ui.js', 'shorts/engine.js', 'shorts/music.js', 'shorts/qr.js', 'shorts/lib.js', 'shorts/bkguard.js',
    'video/index.html', 'video/bke.js', 'video/board.js', 'video/style.css', 'video/studio.js', 'video/talk.js', 'video/pair.js', 'video/engine.js', 'video/music.js', 'video/qr.js', 'video/bkguard.js'];
  const OPTIONAL = ['README.md', 'admin.js'];

  // ── 켜기 / 끄기 ──
  try {
    const q = location.search;
    if (/[?&]bkadmin=off\b/.test(q)) localStorage.removeItem(KEY);
    else if (/[?&]bkadmin\b/.test(q)) localStorage.setItem(KEY, '1');
  } catch (e) { /* 저장 불가 */ }
  let n = 0, t = 0;
  const foot = $('bkFoot');
  if (foot) foot.addEventListener('click', e => {
    if (e.target.closest('#bkVer')) return;
    const now = Date.now(); if (now - t > 3000) n = 0; t = now; n++;
    if (n < 7) return; n = 0;
    let on = false; try { on = localStorage.getItem(KEY) === '1'; } catch (er) { /* 무시 */ }
    try { on ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, '1'); } catch (er) { /* 무시 */ }
    alert(on ? '관리자 메뉴를 숨겼어요.' : '🛠 관리자 메뉴를 켰어요. (이 휴대폰에서만 · 다른 BK 앱에서도 켜져요)');
    location.reload();
  });
  const off = $('adminOff');
  if (off) off.addEventListener('click', () => { if (!confirm('이 휴대폰에서 관리자 메뉴를 숨길까요?\n(BK에딧은 지금 관리자 미리보기라 첫 화면도 「준비 중」으로 바뀌어요)')) return; try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } location.reload(); });

  // ── 지금 버전 (sw.js 의 VERSION) ──
  (async () => { const el = $('adminVer'); if (!el) return; try { const s = await (await fetch('sw.js?v=' + Date.now(), { cache: 'no-store' })).text(); const m = s.match(/VERSION\s*=\s*'([^']+)'/); el.textContent = m ? m[1] : '알 수 없음'; } catch (e) { el.textContent = '확인 못 함 (인터넷 확인)'; } })();

  // ── 관리용 주소 복사 ──
  const ADMIN_TXT = `🛠 BK에딧 관리용 주소\n\n① 맨 위 파일 올리기\n${UP}\n\n② shorts 폴더 올리기\n${UP}/shorts\n\n③ video 폴더 올리기\n${UP}/video\n\n④ 저장소 (파일 목록 · 변경 기록)\n${REPO}\n\n`
    + `⑤ 관리자 메뉴 켜기 (내 휴대폰 전용)\n${APP}?bkadmin\n\n⑥ 앱 주소\n${APP}\n\n※ 업데이트 순서: 관리자 메뉴에서 백업 → 새 파일 올리기 → Commit changes → 1~2분 뒤 앱 두 번 열기`;
  async function copy(text, ok) {
    const m = $('adminCopyMsg'); const good = () => { if (m) { m.textContent = ok; m.style.color = '#16a34a'; } };
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return good(); } } catch (e) { /* 아래 */ }
    const a = document.createElement('textarea'); a.value = text; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); good(); } catch (e) { if (m) m.textContent = '주소를 길게 눌러 복사해 주세요.'; } a.remove();
  }
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.copy; copy(k === 'all' ? ADMIN_TXT : k === 'root' ? UP : UP + '/' + k, k === 'all' ? '✅ 복사했어요. 카톡 「나와의 채팅」에 붙여넣어 두세요.' : '✅ 올리기 주소를 복사했어요.');
  }));

  // ── 지금 버전 백업 (압축 없이 담는 zip · 폴더 그대로) ──
  const CRC = (() => { const tb = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[i] = c >>> 0; } return tb; })();
  function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(files) {
    const enc = new TextEncoder(), parts = [], cen = []; let off2 = 0; const now = new Date();
    const dt = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dd = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const h = len => { const b = new Uint8Array(len); return { b, v: new DataView(b.buffer) }; };
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length, L = h(30);
      L.v.setUint32(0, 0x04034b50, true); L.v.setUint16(4, 20, true); L.v.setUint16(6, 0x0800, true); L.v.setUint16(10, dt, true); L.v.setUint16(12, dd, true); L.v.setUint32(14, crc, true);
      L.v.setUint32(18, sz, true); L.v.setUint32(22, sz, true); L.v.setUint16(26, nm.length, true); parts.push(L.b, nm, f.data);
      const C = h(46); C.v.setUint32(0, 0x02014b50, true); C.v.setUint16(4, 20, true); C.v.setUint16(6, 20, true); C.v.setUint16(8, 0x0800, true); C.v.setUint16(12, dt, true); C.v.setUint16(14, dd, true);
      C.v.setUint32(16, crc, true); C.v.setUint32(20, sz, true); C.v.setUint32(24, sz, true); C.v.setUint16(28, nm.length, true); C.v.setUint32(42, off2, true); cen.push(C.b, nm);
      off2 += 30 + nm.length + sz;
    }
    const cl = cen.reduce((a, b) => a + b.length, 0), E = h(22);
    E.v.setUint32(0, 0x06054b50, true); E.v.setUint16(8, files.length, true); E.v.setUint16(10, files.length, true); E.v.setUint32(12, cl, true); E.v.setUint32(16, off2, true);
    return new Blob([...parts, ...cen, E.b], { type: 'application/zip' });
  }
  const msg = (text, col) => { const m = $('backupMsg'); if (m) { m.textContent = text; m.style.color = col || '#0f766e'; } };
  const bb = $('backupBtn');
  if (bb) bb.addEventListener('click', async () => {
    const d = new Date(), p = x => String(x).padStart(2, '0'), ds = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
    const out = [];
    try {
      for (let i = 0; i < FILES.length; i++) {
        const f = FILES[i]; msg(`사이트에서 파일을 받는 중… ${i + 1}/${FILES.length}`);
        const r = await fetch(f + '?backup=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) { if (OPTIONAL.includes(f)) continue; throw new Error(`${f} (${r.status})`); }
        out.push({ name: f, data: new Uint8Array(await r.arrayBuffer()) });
      }
    } catch (e) { msg('⚠️ 백업 실패: ' + e.message + ' — 인터넷 연결을 확인하고 다시 눌러 주세요.', '#dc2626'); return; }
    const root = out.filter(f => !f.name.includes('/')).map(f => f.name), sh = out.filter(f => f.name.startsWith('shorts/')).length, vd = out.filter(f => f.name.startsWith('video/')).length;
    const note = `BK에딧 백업\n백업한 때: ${d.toLocaleString('ko-KR')}\n버전: ${($('adminVer') || {}).textContent || ''}\n\n[되돌리는 방법]\n1. 이 zip을 압축 풀기 (폴더 안에 shorts · video 폴더가 있어요)\n`
      + `2. 맨 위 파일 ${root.length}개 → ${UP.replace('https://', '')}\n3. shorts 폴더 안 파일 ${sh}개 → ${UP.replace('https://', '')}/shorts\n4. video 폴더 안 파일 ${vd}개 → ${UP.replace('https://', '')}/video\n`
      + `   (각각 choose your files → 파일 모두 선택 → Commit changes)\n5. 1~2분 뒤 앱을 닫았다가 두 번 열기\n\n(이 안내 파일은 올리지 않아도 돼요)\n`;
    out.push({ name: '백업안내.txt', data: new TextEncoder().encode(note) });
    const blob = makeZip(out), name = `BK에딧_백업_${ds}.zip`;
    const file = new File([blob], name, { type: 'application/zip' });
    let shared = false;
    if ($('backupDrive') && $('backupDrive').checked) { try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'BK백업' }); shared = true; } } catch (e) { if (e && e.name === 'AbortError') shared = true; } }
    if (!shared) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); }
    msg(`✅ 백업 완료! ${shared ? '공유 화면으로 보냈어요' : '내 파일 → 다운로드에'} “${name}” (${Math.round(blob.size / 1024)}KB, 파일 ${out.length - 1}개)`, '#16a34a');
  });
})();
