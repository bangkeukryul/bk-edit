/*! pick.js — 🎵 쇼츠 만들기 첫 화면: 「어떤 영상 · 화면」을 한 줄 + 바꾸기 ▸ → 아래에서 올라오는 고르기 판 (옆으로 밀지 않게) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  function make(o) {
    const box = $(o.id); if (!box) return;
    const holder = document.createElement('div'); holder.hidden = true; box.parentNode.insertBefore(holder, box);
    const row = document.createElement('div'); row.className = 'pk-row';
    row.innerHTML = `<span class="pk-t">${o.title}</span><b class="pk-v"></b><button type="button" class="pk-b">바꾸기 ▸</button>`;
    holder.parentNode.insertBefore(row, holder); holder.appendChild(box);
    if (o.hideLabel) { const l = o.hideLabel(); if (l) l.hidden = true; }
    const upd = () => { const b = box.querySelector('[aria-pressed="true"]'); row.querySelector('.pk-v').textContent = b ? b.textContent.replace(/추천$/, '').trim() : '고르지 않음'; };
    let dim = null;
    const close = () => { if (!dim) return; holder.appendChild(box); dim.remove(); dim = null; upd(); };
    row.querySelector('.pk-b').addEventListener('click', () => {
      dim = document.createElement('div'); dim.className = 'bkk-dim';
      dim.innerHTML = `<div class="bkk"><h3>${o.title} <button type="button" data-x="close">✕</button></h3></div>`;
      dim.firstChild.appendChild(box); document.body.appendChild(dim);
      dim.addEventListener('click', e => { if (e.target.closest('[data-x="close"]') || e.target === dim) { close(); return; } if (box.contains(e.target) && e.target.closest('button')) setTimeout(close, 250); });
    });
    box.addEventListener('click', e => { if (dim && e.target.closest('button')) setTimeout(close, 250); }, true);   // 버튼을 다시 그려도 닫히게
    upd(); setInterval(() => { if (!dim) upd(); }, 1200);
  }
  make({ id: 'pGrid', title: '🎬 어떤 영상' });
  make({ id: 'rChips', title: '📱 화면', hideLabel: () => document.querySelector('.rrow > span') });
  const h = document.querySelector('#start h2.bke-h'); if (h) h.textContent = '② 어떤 영상 · 화면';
})();
