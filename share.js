/*! share.js — 📤 BK에딧 다른 사람에게 나눠 주기: QR · 주소 복사 · 카톡으로 보내기 · QR 안내 카드 저장 (관리자 메뉴) */
(function () {
  'use strict';
  const APP = 'https://bangkeukryul.github.io/bk-edit/', GUIDE = APP + 'guide.html';
  const MSG = `🎬 BK에딧 — 휴대폰으로 쉽게 만드는 영상 편집 앱

✂️ 편집하기 · 🎵 쇼츠 만들기(노래 · 가사 자막) · 🎬 영상 만들기
설치 없이 크롬에서 바로 써요. 사진 · 영상은 내 휴대폰에만 저장돼요.

① 아래 주소를 크롬으로 열기
${APP}
② ⋮ → 「홈 화면에 추가」(앱 설치)
③ 약관 동의 → 라이선스 화면에서 「💬 카톡으로 라이선스 요청」

📖 사용 설명서: ${GUIDE}`;
  function qr(canvas, text, px) {
    const q = window.BKQR.encode(text), n = q.size, quiet = 3, cell = Math.floor(px / (n + quiet * 2)), s = cell * (n + quiet * 2);
    canvas.width = canvas.height = s; const x = canvas.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.fillStyle = '#0f172a';
    for (let y = 0; y < n; y++) for (let i = 0; i < n; i++) if (q.dark(i, y)) x.fillRect((i + quiet) * cell, (y + quiet) * cell, cell, cell);
    return canvas;
  }
  const loadImg = src => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
  async function card() {   // 1080 × 1440 안내 카드 (카톡 · 인쇄용)
    const W = 1080, H = 1440, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#14b8a6'); gr.addColorStop(1, '#0e7490'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const F = '"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
    const icon = await loadImg('icon-192.png'); if (icon) { g.save(); g.beginPath(); g.arc(W / 2, 170, 95, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.clip(); g.drawImage(icon, W / 2 - 85, 85, 170, 170); g.restore(); }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `900 92px ${F}`; g.fillText('BK에딧', W / 2, 360);
    g.font = `700 40px ${F}`; g.fillText('휴대폰으로 쉽게 만드는 영상 편집 앱', W / 2, 425);
    g.font = `600 34px ${F}`; g.fillStyle = '#ccfbf1'; g.fillText('✂️ 편집하기 · 🎵 쇼츠 만들기 · 🎬 영상 만들기', W / 2, 480);
    g.fillStyle = '#fff'; const bx = W / 2 - 260; g.beginPath(); g.roundRect ? g.roundRect(bx - 30, 520, 580, 580, 40) : g.rect(bx - 30, 520, 580, 580); g.fill();
    g.drawImage(qr(document.createElement('canvas'), APP, 520), bx, 550, 520, 520);
    g.fillStyle = '#fff'; g.font = `800 40px ${F}`; g.fillText('📷 휴대폰 카메라로 찍으면 바로 열려요', W / 2, 1160);
    g.font = `600 33px ${F}`; g.fillStyle = '#e0fffa';
    ['① 크롬으로 열기 → ⋮ → 「홈 화면에 추가」', '② 약관 동의 → 라이선스 요청 (카톡)', '③ 사진 · 영상 · 노래를 넣고 💾 만들기'].forEach((t, i) => g.fillText(t, W / 2, 1230 + i * 52));
    g.font = `600 26px ${F}`; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText('BK에딧 · BK Agent', W / 2, H - 30);
    return new Promise(r => c.toBlob(r, 'image/png'));
  }
  async function copy(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (er) { /* 무시 */ } a.remove(); return ok; } }
  function open() {
    const d = document.createElement('div'); d.className = 'bkk-dim';
    d.innerHTML = `<div class="bkk" style="text-align:center"><h3 style="text-align:left">📤 BK에딧 나눠 주기 <button type="button" data-x="close">✕</button></h3>
      <canvas id="shQr" style="width:240px;height:240px;border-radius:14px;box-shadow:0 2px 10px #0002"></canvas>
      <p style="margin:6px 0 2px;font-weight:800;word-break:break-all">${APP}</p><p style="margin:0 0 10px;color:#64748b;font-size:.85rem">📷 상대방 휴대폰 카메라로 이 QR을 찍게 하세요</p>
      <div class="g2"><button type="button" class="op hi" data-s="kakao">💬 카톡으로 보내기<small>주소 + 쓰는 법</small></button><button type="button" class="op" data-s="card">🖼 QR 안내 카드<small>저장 · 보내기 · 인쇄</small></button>
      <button type="button" class="op" data-s="url">📋 주소 복사<small>앱 주소만</small></button><button type="button" class="op" data-s="guide">📖 사용 설명서<small>열기 · 주소 복사</small></button></div>
      <p class="shMsg" style="min-height:1.4em;color:#059669;font-weight:800;margin:8px 0 0"></p>
      <p style="text-align:left;color:#64748b;font-size:.82rem;margin:6px 0 0">💡 받은 사람은 <b>약관 동의 → 라이선스 화면</b>에서 「💬 카톡으로 라이선스 요청」을 눌러 기기 코드를 보내요. BK라이선스에서 키를 만들어 보내 주면 바로 써요.</p></div>`;
    document.body.appendChild(d); qr(d.querySelector('#shQr'), APP, 480);
    const say = t => { d.querySelector('.shMsg').textContent = t; };
    d.addEventListener('click', async e => {
      if (e.target === d || e.target.closest('[data-x]')) return d.remove();
      const b = e.target.closest('[data-s]'); if (!b) return; const k = b.dataset.s;
      if (k === 'url') return say(await copy(APP) ? '✅ 주소를 복사했어요' : '주소를 길게 눌러 복사해 주세요');
      if (k === 'kakao') { try { if (navigator.share) { await navigator.share({ text: MSG }); return say('✅ 보냈어요'); } } catch (er) { if (er && er.name === 'AbortError') return; } return say(await copy(MSG) ? '✅ 안내 글을 복사했어요 · 카톡에 붙여넣기' : '복사가 안 됐어요'); }
      if (k === 'guide') { await copy(GUIDE); window.open('guide.html', '_blank'); return say('📖 설명서 주소도 복사해 뒀어요'); }
      if (k === 'card') {
        say('🖼 카드 만드는 중…'); const blob = await card(); if (!blob) return say('카드를 만들지 못했어요');
        const f = new File([blob], 'BK에딧_QR안내.png', { type: 'image/png' });
        try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: MSG }); return say('✅ 보냈어요'); } } catch (er) { if (er && er.name === 'AbortError') return say(''); }
        const a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return say('✅ 내 파일 → 다운로드에 저장했어요');
      }
    });
  }
  window.BKSHARE = { open, card };
  document.addEventListener('click', e => { if (e.target.closest('#shareApp')) open(); });
})();
