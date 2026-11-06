/*! pick.js — 긴 목록은 「지금 고른 것 한 줄 + 바꾸기 ▸」 → 아래에서 올라오는 고르기 판 (세로 길이 줄이기) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  function make(o) {
    const box = $(o.id); if (!box) return;
    const holder = document.createElement('div'); holder.hidden = true; box.parentNode.insertBefore(holder, box);
    const row = document.createElement('div'); row.className = 'pk-row';
    row.innerHTML = `<span class="pk-t">${o.title}</span><b class="pk-v"></b><button type="button" class="pk-b">바꾸기 ▸</button>`;
    holder.parentNode.insertBefore(row, holder); holder.appendChild(box);
    const upd = () => { row.querySelector('.pk-v').textContent = o.now() || '고르지 않음'; };
    let dim = null;
    const close = () => { if (!dim) return; holder.appendChild(box); dim.remove(); dim = null; upd(); };
    row.querySelector('.pk-b').addEventListener('click', () => {
      dim = document.createElement('div'); dim.className = 'bkk-dim';
      dim.innerHTML = `<div class="bkk"><h3>${o.title} <button type="button" data-x="close">✕</button></h3>${o.tip ? `<p class="muted">${o.tip}</p>` : ''}</div>`;
      dim.firstChild.appendChild(box); document.body.appendChild(dim);
      dim.addEventListener('click', e => { if (e.target.closest('[data-x="close"]') || e.target === dim) { close(); return; } if (e.target.closest('button') && box.contains(e.target)) setTimeout(close, o.keepOpen ? 99999 : 250); });
      box.addEventListener('change', () => setTimeout(close, 400), { once: true });
    });
    upd(); setTimeout(upd, 800); setInterval(() => { if (!dim) upd(); }, 1500);
  }
  const pressed = id => { const b = document.querySelector(`#${id} [aria-pressed="true"]`); return b ? b.textContent.trim() : ''; };
  // 🎵 배경음악: 기본 음악 · 팝 · 찬송가 · 이벤트 · 내 음악 파일
  const bl = $('builtinList'), mi = $('musicInput') && $('musicInput').closest('label');
  if (bl && mi) { const w = document.createElement('div'); w.id = 'bkeMusicPick'; bl.parentNode.insertBefore(w, bl); w.appendChild(bl); w.appendChild(mi); }
  make({ id: 'bkeMusicPick', title: '🎵 배경음악', tip: '저작권 걱정 없는 기본 음악이에요. 내 음악 파일도 넣을 수 있어요.', now: () => { const n = $('musicNow'); if (n && !n.hidden && $('musicName').textContent.trim()) return $('musicName').textContent; return pressed('builtinList') || '없음'; } });
  make({ id: 'presets', title: '💬 자막 스타일', now: () => pressed('presets') });
  make({ id: 'bkeLook', title: '🎨 화면 스타일', now: () => pressed('bkeLook') });
})();
