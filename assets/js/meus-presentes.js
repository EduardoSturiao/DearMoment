/* ================================================================
   MEUS PRESENTES — lógica de exibição e exclusão
   Lê os presentes pagos da tabela `gifts` no Supabase, com as fotos
   embedadas via `gift_photos`. URLs públicas geradas pelo Storage.
================================================================ */

(function () {
  const BUCKET = 'gift-images';

  const db = window.sb;

  let giftsData      = [];
  let currentUserId  = null;
  let kebabActiveId  = null;

  /* ──────────────────────────────────────────────────────────
     QR Art — canvas decorado (estilo DearMoment)
  ────────────────────────────────────────────────────────── */

  function buildQrMatrix(url) {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();

    const mods = qr.getModuleCount();
    const cell = Math.floor(300 / mods);
    const size = cell * mods;

    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = size;
    const tc = tmp.getContext('2d');
    tc.fillStyle = '#ffffff';
    tc.fillRect(0, 0, size, size);
    tc.fillStyle = '#000000';
    for (let r = 0; r < mods; r++) {
      for (let c = 0; c < mods; c++) {
        if (qr.isDark(r, c)) tc.fillRect(c * cell, r * cell, cell, cell);
      }
    }
    return tmp;
  }

  function rrPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y,             x + r, y);
      ctx.closePath();
    }
  }

  function drawQrArt(canvas, url) {
    const SCALE = 2;
    const W = 680, H = 760;

    canvas.width        = W * SCALE;
    canvas.height       = H * SCALE;
    canvas.style.width  = '';
    canvas.style.height = '';

    const ctx      = canvas.getContext('2d');
    const qrCanvas = buildQrMatrix(url);
    ctx.scale(SCALE, SCALE);

    /* 1. Fundo */
    const bgGrad = ctx.createRadialGradient(W/2, H*0.38, 0, W/2, H*0.42, W * 1.05);
    bgGrad.addColorStop(0,    '#26103e');
    bgGrad.addColorStop(0.45, '#180c2c');
    bgGrad.addColorStop(1,    '#07080d');
    rrPath(ctx, 0, 0, W, H, 32);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,109,186,0.2)';
    ctx.lineWidth   = 1.5;
    rrPath(ctx, 1, 1, W-2, H-2, 31);
    ctx.stroke();
    ctx.restore();

    const amb = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.62);
    amb.addColorStop(0,   'rgba(255,109,186,0)');
    amb.addColorStop(0.5, 'rgba(255,109,186,0.04)');
    amb.addColorStop(1,   'rgba(255,109,186,0)');
    ctx.fillStyle = amb;
    ctx.fillRect(0, 0, W, H);

    /* 2. Partículas */
    const sparks = [
      {x:44,   y:56,    s:20, a:.52, t:'✦'},
      {x:W-46, y:64,    s:15, a:.42, t:'✦'},
      {x:30,   y:H-84,  s:17, a:.40, t:'✦'},
      {x:W-34, y:H-94,  s:20, a:.48, t:'✦'},
      {x:62,   y:148,   s:11, a:.22, t:'❤'},
      {x:W-60, y:162,   s:11, a:.22, t:'❤'},
      {x:38,   y:H-172, s:10, a:.18, t:'❤'},
      {x:W-40, y:H-182, s:10, a:.18, t:'❤'},
      {x:48,   y:H/2-8, s:8,  a:.13, t:'✦'},
      {x:W-46, y:H/2+6, s:8,  a:.13, t:'✦'},
    ];
    ctx.save();
    sparks.forEach(p => {
      ctx.globalAlpha  = p.a;
      ctx.fillStyle    = '#ff6dba';
      ctx.font         = p.s + 'px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.t, p.x, p.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    /* 3. Logo */
    ctx.save();
    ctx.shadowColor = '#ff6dba';
    ctx.shadowBlur  = 16;

    ctx.font = '700 22px "Syne","Sora",sans-serif';
    const dearW   = ctx.measureText('Dear').width;
    ctx.font = '400 22px "Syne","Sora",sans-serif';
    const momentW = ctx.measureText('Moment').width;

    const rR      = 11;
    const ringGap = 14;
    const ringsW  = rR * 2 + ringGap;
    const logoGap = 10;
    const totalW  = ringsW + logoGap + dearW + momentW;
    const lx      = W / 2 - totalW / 2;
    const cy      = 72;

    ctx.beginPath();
    ctx.arc(lx + rR, cy, rR, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff6dba';
    ctx.lineWidth   = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(lx + rR + ringGap, cy, rR, 0, Math.PI * 2);
    ctx.strokeStyle = '#d946a8';
    ctx.lineWidth   = 2.2;
    ctx.stroke();

    const textX = lx + ringsW + logoGap;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur   = 20;
    ctx.fillStyle    = '#ff6dba';
    ctx.font         = '700 22px "Syne","Sora",sans-serif';
    ctx.fillText('Dear', textX, cy);

    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#ffffff';
    ctx.font       = '400 22px "Syne","Sora",sans-serif';
    ctx.fillText('Moment', textX + dearW, cy);
    ctx.restore();

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle    = 'rgba(255,255,255,0.3)';
    ctx.font         = '300 11px "Sora",sans-serif';
    ctx.fillText('PRESENTES QUE FICAM NA MEMÓRIA', W/2, 100);
    ctx.restore();

    const topSep = ctx.createLinearGradient(W/2-170, 0, W/2+170, 0);
    topSep.addColorStop(0,   'rgba(255,109,186,0)');
    topSep.addColorStop(0.5, 'rgba(255,109,186,0.32)');
    topSep.addColorStop(1,   'rgba(255,109,186,0)');
    ctx.save();
    ctx.strokeStyle = topSep;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(W/2 - 170, 116); ctx.lineTo(W/2 + 170, 116);
    ctx.stroke();
    ctx.restore();

    /* 4. Título */
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor  = 'rgba(255,109,186,0.5)';
    ctx.shadowBlur   = 18;
    ctx.fillStyle    = '#ffffff';
    ctx.font         = '700 36px "Syne","Sora",sans-serif';
    ctx.fillText('Um presente feito', W/2, 170);
    ctx.fillText('só para você', W/2, 216);
    ctx.shadowBlur   = 0;
    ctx.fillStyle    = 'rgba(255,255,255,0.38)';
    ctx.font         = '300 13px "Sora",sans-serif';
    ctx.fillText('Aponte a câmera do celular para o código', W/2, 244);
    ctx.restore();

    /* 5. Frame QR */
    const QS = 350, QX = (W - QS) / 2, QY = 282, QBR = 22;

    ctx.save();
    ctx.shadowColor = '#ff6dba';
    ctx.shadowBlur  = 44;
    const qFrame = ctx.createLinearGradient(QX, QY, QX + QS, QY + QS);
    qFrame.addColorStop(0, 'rgba(255,109,186,0.16)');
    qFrame.addColorStop(1, 'rgba(255,109,186,0.06)');
    rrPath(ctx, QX, QY, QS, QS, QBR);
    ctx.fillStyle   = qFrame;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,109,186,0.52)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    [[QX,QY,1,1],[QX+QS,QY,-1,1],[QX,QY+QS,1,-1],[QX+QS,QY+QS,-1,-1]].forEach(([cx,cy,sx,sy]) => {
      ctx.save();
      ctx.strokeStyle = '#ff6dba';
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.shadowColor = '#ff6dba';
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.moveTo(cx + sx * 14, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * 14);
      ctx.stroke();
      ctx.restore();
    });

    const pad    = 28;
    const qrDst  = QS - pad * 2;
    const qrSrc  = qrCanvas.width;
    ctx.save();
    rrPath(ctx, QX + pad, QY + pad, qrDst, qrDst, 10);
    ctx.clip();
    ctx.drawImage(qrCanvas, 0, 0, qrSrc, qrSrc, QX + pad, QY + pad, qrDst, qrDst);
    ctx.restore();

    /* Coração central */
    ctx.save();
    ctx.shadowColor  = 'rgba(255,109,186,0.65)';
    ctx.shadowBlur   = 18;
    ctx.fillStyle    = '#1e1030';
    ctx.beginPath();
    ctx.arc(W/2, QY + QS/2, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle  = '#ff6dba';
    ctx.lineWidth    = 2;
    ctx.stroke();
    ctx.shadowBlur   = 8;
    ctx.font         = '24px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ff6dba';
    ctx.fillText('❤', W/2, QY + QS/2 + 1.5);
    ctx.restore();

    /* 6. Rodapé — separador + URL */
    const fy = QY + QS;

    const midSep = ctx.createLinearGradient(W/2-130, 0, W/2+130, 0);
    midSep.addColorStop(0,   'rgba(255,109,186,0)');
    midSep.addColorStop(0.5, 'rgba(255,109,186,0.28)');
    midSep.addColorStop(1,   'rgba(255,109,186,0)');
    ctx.save();
    ctx.strokeStyle = midSep;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(W/2-130, fy+28); ctx.lineTo(W/2+130, fy+28);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle    = 'rgba(255,109,186,0.42)';
    ctx.font         = '300 11px "Sora",sans-serif';
    ctx.fillText('dearmoment.com.br', W/2, fy + 62);
    ctx.restore();
  }

  /* ──────────────────────────────────────────────────────────
     Modal QR
  ────────────────────────────────────────────────────────── */

  function showQrModal(giftId) {
    const url    = `${window.location.origin}/presente.html?id=${encodeURIComponent(giftId)}`;
    const modal  = document.getElementById('qr-modal');
    const canvas = document.getElementById('qr-art-canvas');

    canvas.dataset.giftUrl = url;
    document.fonts.ready.then(() => drawQrArt(canvas, url));

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeQrModal() {
    document.getElementById('qr-modal').style.display = 'none';
    document.body.style.overflow = '';
  }

  /* ──────────────────────────────────────────────────────────
     Kebab dropdown (portal fixo no body)
  ────────────────────────────────────────────────────────── */

  function openKebabDropdown(btn, giftId) {
    const dd   = document.getElementById('mp-kebab-dd');
    const rect = btn.getBoundingClientRect();

    kebabActiveId = giftId;
    dd.style.display = 'block';

    const ddW = dd.offsetWidth  || 200;
    const ddH = dd.offsetHeight || 96;

    let top  = rect.bottom + 6;
    let left = rect.left;

    if (left + ddW > window.innerWidth - 8)  left = rect.right - ddW;
    if (top  + ddH > window.innerHeight - 8) top  = rect.top - ddH - 6;

    dd.style.top  = top + 'px';
    dd.style.left = left + 'px';
  }

  function closeKebabDropdown() {
    document.getElementById('mp-kebab-dd').style.display = 'none';
    kebabActiveId = null;
  }

  /* ──────────────────────────────────────────────────────────
     Dados
  ────────────────────────────────────────────────────────── */

  function processGift(g, isReceived) {
    const photos = Array.isArray(g.gift_photos) ? g.gift_photos : [];
    const cover  = photos.find(p => p.is_extra) ||
                   photos.slice().sort((a, b) => a.position - b.position)[0];
    const coverUrl = cover
      ? db.storage.from(BUCKET).getPublicUrl(cover.storage_path).data.publicUrl
      : null;
    return {
      id:         g.id,
      name1:      g.name1,
      name2:      g.name2,
      startDate:  g.start_date,
      plan:       g.plan,
      createdAt:  g.created_at,
      coverUrl,
      allPaths:   photos.map(p => p.storage_path),
      isReceived: !!isReceived,
    };
  }

  async function loadGifts() {
    if (!db) return [];

    const { data: userData } = await db.auth.getUser();
    const user = userData && userData.user;
    if (!user) {
      window.location.href = './login.html';
      return [];
    }
    currentUserId = user.id;

    const [ownResult, savedResult] = await Promise.all([
      db.from('gifts')
        .select('id, name1, name2, start_date, plan, paid, created_at, gift_photos(storage_path, is_extra, position)')
        .eq('paid', true)
        .eq('user_id', user.id),
      db.from('saved_gifts')
        .select('gift_id, gifts(id, name1, name2, start_date, plan, paid, created_at, gift_photos(storage_path, is_extra, position))')
        .eq('user_id', user.id),
    ]);

    if (ownResult.error)  console.error('Erro ao buscar presentes:', ownResult.error);
    if (savedResult.error) console.error('Erro ao buscar presentes salvos:', savedResult.error);

    const own    = (ownResult.data || []).map(g => processGift(g, false));
    const ownIds = new Set(own.map(g => g.id));

    const received = (savedResult.data || [])
      .filter(s => s.gifts && s.gifts.paid)
      .map(s => processGift(s.gifts, true))
      .filter(g => !ownIds.has(g.id));

    return [...own, ...received];
  }

  /* ──────────────────────────────────────────────────────────
     Render
  ────────────────────────────────────────────────────────── */

  function renderEmpty() {
    document.getElementById('mp-empty').style.display = 'flex';
    document.getElementById('mp-grid').style.display  = 'none';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;');
  }

  function renderGifts(gifts) {
    document.getElementById('mp-empty').style.display = 'none';
    const grid = document.getElementById('mp-grid');
    grid.style.display = 'grid';

    grid.innerHTML = gifts.map(gift => {
      const safeId    = escHtml(gift.id);
      const safeCover = gift.coverUrl ? escHtml(gift.coverUrl) : '';
      const coverHtml = safeCover
        ? `<div class="mp-card-cover"><img src="${safeCover}" alt="Foto do casal"></div>`
        : `<div class="mp-card-cover-placeholder"><i class="fa-regular fa-images"></i></div>`;

      const names = gift.name1 && gift.name2
        ? `${escHtml(gift.name1)} &amp; ${escHtml(gift.name2)}`
        : escHtml(gift.name1 || 'Homenagem sem título');

      const date = gift.startDate
        ? `Desde ${new Date(gift.startDate).toLocaleDateString('pt-BR')}`
        : '';

      const plan = gift.plan === 'vitalicio' ? 'Vitalício' : '24 Horas';

      const receivedBadge = gift.isReceived
        ? `<span class="mp-badge-received">Recebido</span>`
        : '';

      const deleteBtn = gift.isReceived
        ? `<button class="mp-card-delete" data-id="${safeId}" data-received="true" aria-label="Remover presente" title="Remover dos meus presentes"><i class="fa-solid fa-xmark"></i></button>`
        : `<button class="mp-card-delete" data-id="${safeId}" aria-label="Excluir presente" title="Excluir presente"><i class="fa-solid fa-trash"></i></button>`;

      return `
        <div class="mp-card" data-id="${safeId}">
          <a class="mp-card-inner" href="./presente.html?id=${encodeURIComponent(gift.id)}">
            ${coverHtml}
            <div class="mp-card-body">
              <div class="mp-card-names">${names}${receivedBadge}</div>
              ${date ? `<div class="mp-card-date">${escHtml(date)}</div>` : ''}
              <div class="mp-card-plan">
                <span class="mp-card-plan-badge">Plano ${escHtml(plan)}</span>
                <i class="fa-solid fa-arrow-right mp-card-arrow"></i>
              </div>
            </div>
          </a>
          <div class="mp-card-footer">
            <button class="mp-card-kebab" data-id="${safeId}" aria-label="Mais opções" title="Mais opções">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
          </div>
          ${deleteBtn}
        </div>
      `;
    }).join('');
  }

  /* ──────────────────────────────────────────────────────────
     Exclusão
  ────────────────────────────────────────────────────────── */

  async function deleteGift(giftId, allPaths, cardEl, isReceived) {
    const msg = isReceived
      ? 'Remover este presente dos seus presentes salvos?'
      : 'Tem certeza que deseja excluir este presente? Esta ação não pode ser desfeita.';
    if (!confirm(msg)) return;

    cardEl.style.opacity      = '0.4';
    cardEl.style.pointerEvents = 'none';

    try {
      if (isReceived) {
        const { error } = await db.from('saved_gifts')
          .delete()
          .eq('user_id', currentUserId)
          .eq('gift_id', giftId);
        if (error) throw error;
      } else {
        if (allPaths.length > 0) {
          await db.storage.from(BUCKET).remove(allPaths);
        }
        await db.from('gift_photos').delete().eq('gift_id', giftId);
        const { error } = await db.from('gifts').delete().eq('id', giftId);
        if (error) throw error;
      }

      await db.from('audit_log').insert({
        action:   isReceived ? 'saved_gift_removed' : 'gift_deleted',
        user_id:  currentUserId,
        gift_id:  giftId,
        metadata: isReceived ? null : { storage_paths_removed: allPaths.length },
      });

      cardEl.style.opacity = '0';
      setTimeout(() => {
        cardEl.remove();
        giftsData = giftsData.filter(g => g.id !== giftId);
        if (document.querySelectorAll('.mp-card').length === 0) renderEmpty();
      }, 300);

    } catch (err) {
      console.error('Erro ao excluir presente:', err);
      cardEl.style.opacity      = '1';
      cardEl.style.pointerEvents = '';
      alert('Erro ao processar a ação. Tente novamente.');
    }
  }

  /* ──────────────────────────────────────────────────────────
     Init
  ────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', async () => {
    giftsData = await loadGifts();
    if (giftsData.length === 0) {
      renderEmpty();
    } else {
      renderGifts(giftsData);
    }

    const grid = document.getElementById('mp-grid');

    /* Clique no grid: delete e kebab */
    grid.addEventListener('click', async (e) => {
      /* Delete */
      const deleteBtn = e.target.closest('.mp-card-delete');
      if (deleteBtn) {
        const giftId     = deleteBtn.dataset.id;
        const isReceived = deleteBtn.dataset.received === 'true';
        const gift       = giftsData.find(g => g.id === giftId);
        const cardEl     = deleteBtn.closest('.mp-card');
        await deleteGift(giftId, gift ? gift.allPaths : [], cardEl, isReceived);
        return;
      }

      /* Kebab */
      const kebabBtn = e.target.closest('.mp-card-kebab');
      if (kebabBtn) {
        e.preventDefault();
        e.stopPropagation();
        const giftId = kebabBtn.dataset.id;
        const dd     = document.getElementById('mp-kebab-dd');
        if (dd.style.display === 'block' && kebabActiveId === giftId) {
          closeKebabDropdown();
        } else {
          openKebabDropdown(kebabBtn, giftId);
        }
        return;
      }
    });

    /* Dropdown: botões de ação */
    document.getElementById('mp-kebab-dd').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !kebabActiveId) return;

      const giftId = kebabActiveId;
      closeKebabDropdown();

      if (btn.dataset.action === 'qr') {
        showQrModal(giftId);
      }

      if (btn.dataset.action === 'share') {
        const url = `${window.location.origin}/presente.html?id=${encodeURIComponent(giftId)}`;
        if (navigator.share) {
          navigator.share({ title: 'DearMoment — Seu presente especial', url }).catch(() => {});
        } else {
          navigator.clipboard.writeText(url).then(() => {
            alert('Link copiado!');
          }).catch(() => {
            prompt('Copie o link do presente:', url);
          });
        }
      }
    });

    /* Fecha dropdown ao clicar fora */
    document.addEventListener('click', (e) => {
      const dd = document.getElementById('mp-kebab-dd');
      if (dd.style.display !== 'block') return;
      if (!dd.contains(e.target) && !e.target.closest('.mp-card-kebab')) {
        closeKebabDropdown();
      }
    });

    /* Modal QR — fechar */
    document.getElementById('qr-modal-close').addEventListener('click', closeQrModal);
    document.getElementById('qr-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('qr-modal')) closeQrModal();
    });

    /* Modal QR — download */
    document.getElementById('qr-modal-download').addEventListener('click', () => {
      const canvas = document.getElementById('qr-art-canvas');
      const link   = document.createElement('a');
      link.download = 'dearmoment-qrcode.png';
      link.href     = canvas.toDataURL('image/png');
      link.click();
    });

    /* Modal QR — copiar link */
    document.getElementById('qr-modal-copy').addEventListener('click', () => {
      const canvas  = document.getElementById('qr-art-canvas');
      const url     = canvas.dataset.giftUrl || '';
      const icon    = document.getElementById('qr-copy-icon');
      const txtSpan = document.getElementById('qr-copy-text');
      navigator.clipboard.writeText(url).then(() => {
        icon.className    = 'fa-solid fa-check';
        txtSpan.textContent = ' Copiado!';
        setTimeout(() => {
          icon.className    = 'fa-solid fa-copy';
          txtSpan.textContent = ' Copiar link';
        }, 2000);
      });
    });
  });
})();
