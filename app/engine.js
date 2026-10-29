// Daily horoscope image engine: parsing, design variants, 1080×1350 canvas drawing, caption checks.
window.Duang = (() => {
  const W = 1080, H = 1350, P = 56;

  // ---------- palette & variants ----------
  const DAY_COLORS = { 'อาทิตย์': '#EE6A6A', 'จันทร์': '#F5C842', 'อังคาร': '#F28BB0', 'พุธ': '#5CC48A', 'พฤหัส': '#F29440', 'พฤหัสบดี': '#F29440', 'ศุกร์': '#6EC1F0', 'เสาร์': '#A98AEB' };
  const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  const DAY_ORDER = DAYS.map(d => DAY_COLORS[d]);
  const GOLD = '#E8C268', SUB = '#B9BDE0', NAVY = '#161937';
  const THEMES = {
    midnight: { bg: '#12142B', card: '#1D2044', glow: ['#3A3F92', '#5B3C86'] },
    indigo:   { bg: '#14112F', card: '#221E4C', glow: ['#4A3A9A', '#2F4C9A'] },
    deepsea:  { bg: '#0E1729', card: '#182844', glow: ['#1F5A86', '#2E3F8E'] },
    plum:     { bg: '#191029', card: '#2A1B42', glow: ['#6A2F7E', '#3B3C8C'] }
  };
  const DIMS = [
    { key: 'theme', label: 'โทนพื้นหลัง', spec: 'midnight', pool: ['midnight', 'midnight', 'midnight', 'indigo', 'deepsea', 'plum'],
      names: { midnight: 'กลางคืน (ต้นแบบ)', indigo: 'คราม', deepsea: 'ทะเลลึก', plum: 'ม่วงพลัม' } },
    { key: 'bg', label: 'ลายพื้นหลัง', spec: 'stars', pool: ['stars', 'nebula', 'orbits', 'constellation', 'milky'],
      names: { stars: 'ดาวกระจาย (ต้นแบบ)', nebula: 'เนบิวลา', orbits: 'วงโคจร', constellation: 'กลุ่มดาว', milky: 'ทางช้างเผือก' } },
    { key: 'icon', label: 'ไอคอนหัว', spec: 'crescent', pool: ['crescent', 'crescent', 'planet', 'fullmoon', 'sparkles'],
      names: { crescent: 'จันทร์เสี้ยว (ต้นแบบ)', planet: 'ดาวเคราะห์', fullmoon: 'จันทร์เต็มดวง', sparkles: 'ประกายดาว' } },
    { key: 'badge', label: 'ป้ายหัว', spec: 'outline', pool: ['outline', 'soft', 'sparkle'],
      names: { outline: 'กรอบทอง (ต้นแบบ)', soft: 'พื้นทองจาง', sparkle: 'กรอบ + ประกาย' } },
    { key: 'chip', label: 'แถบวันเกิด', spec: 'full', pool: ['full', 'full', 'inset', 'slant'],
      names: { full: 'เต็มแถบ (ต้นแบบ)', inset: 'ป้ายลอย', slant: 'ตัดเฉียง' } },
    { key: 'card', label: 'การ์ด', spec: 'plain', pool: ['plain', 'outline', 'glow'],
      names: { plain: 'เรียบ (ต้นแบบ)', outline: 'ขอบสีวัน', glow: 'ไล่สีวัน' } },
    { key: 'rating', label: 'คะแนน', spec: 'dot', pool: ['dot', 'dot', 'star', 'diamond', 'bar'],
      names: { dot: 'จุด (ต้นแบบ)', star: 'ดาว', diamond: 'เพชร', bar: 'แท่ง' } },
    { key: 'ratingColor', label: 'สีคะแนน', spec: 'gold', pool: ['gold', 'gold', 'day'],
      names: { gold: 'ทอง (ต้นแบบ)', day: 'สีประจำวัน' } },
    { key: 'cta', label: 'ปุ่มอ่านต่อ', spec: 'pill', pool: ['pill', 'filled', 'text'],
      names: { pill: 'กรอบทอง (ต้นแบบ)', filled: 'ปุ่มทอง', text: 'ตัวอักษร + ลูกศร' } },
    { key: 'mascot', label: 'ท่ามาสคอต', spec: 'wave', pool: ['wave', 'thumbs', 'heart', 'hips', 'bubbles', 'cheer', 'peace', 'apple'],
      names: { wave: 'โบกมือ', thumbs: 'ยกนิ้ว', heart: 'มินิฮาร์ต', hips: 'เท้าเอว', bubbles: 'เป่าฟองสบู่', cheer: 'ชูมือดีใจ', peace: 'ชูสองนิ้ว', apple: 'กอดแอปเปิ้ล', none: 'ไม่แสดง (ใช้ไอคอนดวงดาว)' } }
  ];

  // ---------- mascot poses (transparent cut-outs of the page's character) ----------
  const mascots = {};
  function loadMascots(base = 'mascot/') {
    const names = DIMS.find(d => d.key === 'mascot').pool;
    return Promise.all(names.map(n => new Promise(res => {
      const img = new Image();
      img.onload = () => { mascots[n] = img; res(); };
      img.onerror = () => res();
      img.src = `${base}${n}.webp`;
    })));
  }

  // ---------- seeded random ----------
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
  }
  function rngFrom(seed) {
    let a = hash(seed);
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  // ---------- text helpers ----------
  const F = {
    display: s => `400 ${s}px Chonburi, Kanit, serif`,
    k4: s => `400 ${s}px Kanit, Tahoma, sans-serif`,
    k5: s => `500 ${s}px Kanit, Tahoma, sans-serif`,
    k6: s => `600 ${s}px Kanit, Tahoma, sans-serif`
  };
  function fit(ctx, str, font, size, maxW, min = Math.round(size * 0.55)) {
    let s = size;
    ctx.font = font(s);
    while (s > min && ctx.measureText(str).width > maxW) { s -= 1; ctx.font = font(s); }
    return s;
  }
  function text(ctx, str, x, y, font, size, color, align = 'left', maxW = 9999) {
    fit(ctx, str, font, size, maxW);
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }
  const thaiLen = s => String(s).replace(/[ัิ-ฺ็-๎]/g, '').length;
  function rgba(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return `rgba(232,194,104,${a})`;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  const validHex = h => /^#?[0-9a-f]{6}$/i.test(String(h || '').trim());
  const hexOf = h => { const s = String(h).trim(); return s.startsWith('#') ? s : '#' + s; };

  // ---------- shapes ----------
  function rr(ctx, x, y, w, h, r) {
    const R = typeof r === 'number' ? [r, r, r, r] : r;
    ctx.beginPath();
    ctx.moveTo(x + R[0], y);
    ctx.lineTo(x + w - R[1], y); ctx.arcTo(x + w, y, x + w, y + R[1], R[1]);
    ctx.lineTo(x + w, y + h - R[2]); ctx.arcTo(x + w, y + h, x + w - R[2], y + h, R[2]);
    ctx.lineTo(x + R[3], y + h); ctx.arcTo(x, y + h, x, y + h - R[3], R[3]);
    ctx.lineTo(x, y + R[0]); ctx.arcTo(x, y, x + R[0], y, R[0]);
    ctx.closePath();
  }
  function sparkle(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.closePath();
  }
  function starPath(ctx, cx, cy, ro, ri) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / 5;
      ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
  }
  function crescentPath(ctx, cx, cy, R, ox, oy, r) {
    const d = Math.hypot(ox, oy), phi = Math.atan2(oy, ox);
    const a = Math.acos(Math.max(-1, Math.min(1, (R * R + d * d - r * r) / (2 * R * d))));
    const pm = { x: cx + R * Math.cos(phi - a), y: cy + R * Math.sin(phi - a) };
    const pp = { x: cx + R * Math.cos(phi + a), y: cy + R * Math.sin(phi + a) };
    const b1 = Math.atan2(pm.y - cy - oy, pm.x - cx - ox), b2 = Math.atan2(pp.y - cy - oy, pp.x - cx - ox);
    const norm = t => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const passesCw = norm(phi + Math.PI - b1) < norm(b2 - b1);
    ctx.beginPath();
    ctx.arc(cx, cy, R, phi + a, phi - a + 2 * Math.PI, false);
    ctx.arc(cx + ox, cy + oy, r, b1, b2, !passesCw);
    ctx.closePath();
  }

  // ---------- drawing ----------
  function drawBackground(ctx, v, rng, T) {
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    if (v.bg === 'nebula') {
      for (let i = 0; i < 3; i++) {
        const x = rng() * W, y = i === 0 ? rng() * 260 : rng() * H, r = 360 + rng() * 300;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(T.glow[i % 2], 0.42)); g.addColorStop(1, rgba(T.glow[i % 2], 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    } else {
      const g = ctx.createRadialGradient(W * (0.55 + rng() * 0.4), 40, 0, W * 0.8, 40, 620);
      g.addColorStop(0, rgba(T.glow[0], 0.28)); g.addColorStop(1, rgba(T.glow[0], 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (v.bg === 'orbits') {
      const corners = [[W * 0.86, -30], [-80, H * 0.52], [W + 60, H * 0.7], [W * 0.15, -120]];
      const [ox, oy] = pick(rng, corners);
      ctx.lineWidth = 1.5;
      for (let r = 170; r < 1500; r += 105 + rng() * 30) {
        ctx.strokeStyle = rgba(GOLD, 0.07); ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.stroke();
        const a = rng() * Math.PI * 2;
        ctx.fillStyle = rgba(GOLD, 0.35); ctx.beginPath(); ctx.arc(ox + r * Math.cos(a), oy + r * Math.sin(a), 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (v.bg === 'milky') {
      const x0 = -100, y0 = 300 + rng() * 120, x1 = W + 100, y1 = -60 + rng() * 80;
      for (let i = 0; i < 520; i++) {
        const t = rng(), off = (rng() + rng() + rng() - 1.5) * 90;
        const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny);
        const x = x0 + (x1 - x0) * t + nx / nl * off, y = y0 + (y1 - y0) * t + ny / nl * off;
        ctx.fillStyle = `rgba(255,255,255,${0.08 + rng() * 0.35})`;
        ctx.beginPath(); ctx.arc(x, y, 0.5 + rng() * 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    // scattered stars — every layout gets its own field
    const n = 90 + Math.floor(rng() * 70);
    for (let i = 0; i < n; i++) {
      const x = rng() * W, y = rng() * H, gold = rng() < 0.2;
      ctx.fillStyle = gold ? rgba(GOLD, 0.25 + rng() * 0.45) : `rgba(255,255,255,${0.12 + rng() * 0.45})`;
      ctx.beginPath(); ctx.arc(x, y, 0.5 + rng() * 1.4, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 4 + Math.floor(rng() * 4); i++) {
      ctx.fillStyle = rgba(GOLD, 0.25 + rng() * 0.3);
      sparkle(ctx, rng() * W, rng() < 0.6 ? rng() * 300 : 1180 + rng() * 160, 4 + rng() * 6); ctx.fill();
    }
    if (v.bg === 'constellation') {
      const pts = [];
      const bx = 470 + rng() * 120, by = 40;
      for (let i = 0; i < 6; i++) pts.push([bx + rng() * 300, by + rng() * 230]);
      pts.sort((a, b) => a[0] - b[0]);
      ctx.strokeStyle = rgba(GOLD, 0.2); ctx.lineWidth = 1.5;
      ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.stroke();
      pts.forEach(p => { ctx.fillStyle = rgba(GOLD, 0.6); ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fill(); });
    }
  }

  // The icon is drawn at its design size around (cx, cy) and scaled down into the badge row;
  // line widths are divided by the scale so strokes stay 2–3px in the final image.
  function drawIcon(ctx, v, T, L) {
    const s = 0.6, ox = W - L.M - 58, oy = L.badgeY + 32;
    const cx = 0, cy = 0;
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(s, s);
    const lw = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'lineWidth');
    Object.defineProperty(ctx, 'lineWidth', { configurable: true, get() { return lw.get.call(ctx); }, set(w) { lw.set.call(ctx, w / s); } });
    ctx.strokeStyle = GOLD; ctx.fillStyle = GOLD; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (v.icon === 'crescent') {
      crescentPath(ctx, cx - 6, cy + 4, 62, 26, -20, 52); ctx.stroke();
      ctx.lineWidth = 2.5;
      sparkle(ctx, cx + 46, cy - 46, 18); ctx.stroke();
      sparkle(ctx, cx + 58, cy + 14, 9); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 24, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
    } else if (v.icon === 'planet') {
      ctx.save(); ctx.translate(cx, cy + 4); ctx.rotate(-0.38);
      ctx.beginPath(); ctx.ellipse(0, 0, 78, 22, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.fillStyle = T.bg; ctx.beginPath(); ctx.arc(cx, cy + 4, 42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(cx, cy + 4); ctx.rotate(-0.38);
      ctx.beginPath(); ctx.ellipse(0, 0, 78, 22, 0, 0, Math.PI); ctx.stroke(); ctx.restore();
      ctx.lineWidth = 2.5; sparkle(ctx, cx - 62, cy - 52, 14); ctx.stroke();
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(cx + 66, cy - 50, 3, 0, Math.PI * 2); ctx.fill();
    } else if (v.icon === 'fullmoon') {
      ctx.beginPath(); ctx.arc(cx, cy, 54, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
      [[-16, -14, 11], [18, 8, 8], [-6, 24, 6], [22, -22, 5]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(cx + x, cy + y, r, 0, Math.PI * 2); ctx.stroke(); });
      ctx.globalAlpha = 1; ctx.setLineDash([3, 9]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 78, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 2.5; sparkle(ctx, cx + 70, cy - 58, 12); ctx.stroke();
    } else {
      ctx.lineWidth = 3; sparkle(ctx, cx - 6, cy + 4, 46); ctx.stroke();
      ctx.lineWidth = 2.5; sparkle(ctx, cx + 50, cy - 44, 18); ctx.stroke();
      sparkle(ctx, cx - 58, cy - 46, 11); ctx.stroke();
      sparkle(ctx, cx + 48, cy + 48, 9); ctx.stroke();
      [[cx - 52, cy + 40], [cx + 18, cy - 70], [cx + 70, cy + 6]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });
    }
    delete ctx.lineWidth;
    ctx.restore();
  }

  // Daily: one row per birth day under a tall title. Weekly: tighter margins and a shorter header
  // so the 3 + 4 card grid has room for its longer readings.
  const LAYOUT = {
    day:  { M: P, badge: 'ดูดวงรายวัน', badgeY: P - 8, titleY: 236, titleSize: 112, subY: 284, mascotBottom: 320, mascotH: 282, top: 310 },
    week: { M: 32, badge: 'ดูดวงรายสัปดาห์', badgeY: 30, titleY: 186, titleSize: 96, subY: 236, mascotBottom: 276, mascotH: 248, top: 264 }
  };

  function drawHeader(ctx, v, T, d, L) {
    const M = L.M, badge = L.badge;
    ctx.font = F.k5(23);
    const bw = ctx.measureText(badge).width + 44 + (v.badge === 'sparkle' ? 40 : 0), bh = 44, by = L.badgeY;
    rr(ctx, M, by, bw, bh, bh / 2);
    if (v.badge === 'soft') { ctx.fillStyle = rgba(GOLD, 0.16); ctx.fill(); }
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
    let tx = M + 22;
    if (v.badge === 'sparkle') { ctx.fillStyle = GOLD; sparkle(ctx, M + 28, by + bh / 2, 7); ctx.fill(); tx += 20; }
    text(ctx, badge, tx, by + 30, F.k5, 23, GOLD);
    if (v.badge === 'sparkle') { ctx.fillStyle = GOLD; sparkle(ctx, M + bw - 28, by + bh / 2, 7); ctx.fill(); }

    const m = v.mascot !== 'none' && mascots[v.mascot];
    let textMax = W - M * 2 - 70;
    if (m) textMax = drawMascot(ctx, m, L) - M - 12;
    else drawIcon(ctx, v, T, L);

    const date = String(d.date || '').trim();
    if (d.type === 'week') {
      drawTitle(ctx, 'ดวงประจำ', 'สัปดาห์', 'rainbow', L, textMax);
      if (date) text(ctx, `ตรวจดวงวันที่ ${date}`, M, L.subY, F.k5, 29, SUB, 'left', m ? textMax : W - M * 2);
    } else {
      const day = String(d.dayTitle || '').trim().replace(/^วัน/, '');
      drawTitle(ctx, 'ดวงวัน', day, DAY_COLORS[day] || DAY_COLORS[day.replace(/บดี$/, '')] || GOLD, L, textMax);
      if (date) text(ctx, `ตรวจดวงประจำวัน${/^\d/.test(date) ? 'ที่ ' : ''}${date}`, M, L.subY, F.k5, 29, SUB, 'left', m ? textMax : W - M * 2);
    }
  }

  // Bust sits on the first card (its flat bottom tucks under the card, drawn later); returns its left edge.
  function drawMascot(ctx, img, L) {
    const bottom = L.mascotBottom, h = L.mascotH;
    const w = h * img.width / img.height;
    const right = W - L.M + 14, left = right - w, top = bottom - h;
    const cx = left + w / 2, cy = top + h * 0.45;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.75);
    g.addColorStop(0, rgba(GOLD, 0.26)); g.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = g; ctx.fillRect(left - h, top - h, w + 2 * h, 2 * h);
    ctx.save();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    sparkle(ctx, left + 10, top + 34, 13); ctx.stroke();
    sparkle(ctx, right - 4, top + 6, 9); ctx.stroke();
    ctx.restore();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, left, top, w, h);
    return left;
  }

  // `a` in glowing gold, `b` in a day color ("ดวงวัน" + day name), or across all 7 day colors for the week.
  function drawTitle(ctx, a, b, bColor, L, maxW) {
    const x = L.M - 2, y = L.titleY;
    let size = L.titleSize;
    ctx.font = F.display(size);
    while (size > 60 && ctx.measureText(a + b).width > maxW) { size -= 1; ctx.font = F.display(size); }
    const wa = ctx.measureText(a).width;
    const gold = ctx.createLinearGradient(0, y - size * 0.9, 0, y + size * 0.1);
    gold.addColorStop(0, '#FFF3C9'); gold.addColorStop(0.5, '#F2CC6E'); gold.addColorStop(1, '#D29A35');
    let dc = bColor;
    if (bColor === 'rainbow') {
      const wb = ctx.measureText(b).width;
      dc = ctx.createLinearGradient(x + wa, 0, x + wa + wb, 0);
      DAY_ORDER.forEach((c, i) => dc.addColorStop(i / (DAY_ORDER.length - 1), c));
    }
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    // glow pass, then a same-color stroke so the single-weight display face reads heavier
    ctx.shadowColor = rgba(GOLD, 0.55); ctx.shadowBlur = 30;
    ctx.fillStyle = gold; ctx.fillText(a, x, y);
    ctx.shadowColor = typeof dc === 'string' ? rgba(dc, 0.6) : rgba(GOLD, 0.45);
    ctx.fillStyle = dc; ctx.fillText(b, x + wa, y);
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, size * 0.028);
    ctx.strokeStyle = gold; ctx.strokeText(a, x, y); ctx.fillStyle = gold; ctx.fillText(a, x, y);
    ctx.strokeStyle = dc; ctx.strokeText(b, x + wa, y); ctx.fillStyle = dc; ctx.fillText(b, x + wa, y);
    ctx.restore();
  }

  function ratingMark(ctx, shape, x, cy, s, on, cOn, cOff) {
    ctx.fillStyle = on ? cOn : cOff;
    if (shape === 'dot') { ctx.beginPath(); ctx.arc(x + s / 2, cy, s / 2, 0, Math.PI * 2); ctx.fill(); }
    else if (shape === 'star') { starPath(ctx, x + s / 2, cy, s * 0.74, s * 0.32); ctx.fill(); }
    else if (shape === 'diamond') {
      ctx.beginPath(); ctx.moveTo(x + s / 2, cy - s * 0.6); ctx.lineTo(x + s, cy); ctx.lineTo(x + s / 2, cy + s * 0.6); ctx.lineTo(x, cy); ctx.closePath(); ctx.fill();
    } else { rr(ctx, x, cy - 5, s, 10, 5); ctx.fill(); }
  }

  function drawRow(ctx, v, T, item, i, y, h) {
    const x = P, w = W - P * 2;
    const dayName = String(item.day || '').trim();
    const dc = DAY_COLORS[dayName] || DAY_ORDER[i % 7];

    const R = 20;
    rr(ctx, x, y, w, h, R); ctx.fillStyle = T.card; ctx.fill();
    if (v.card === 'glow') {
      ctx.save(); rr(ctx, x, y, w, h, R); ctx.clip();
      const g = ctx.createLinearGradient(x, 0, x + w * 0.7, 0);
      g.addColorStop(0, rgba(dc, 0.18)); g.addColorStop(1, rgba(dc, 0));
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
    }
    if (v.card === 'outline') { rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, R); ctx.strokeStyle = rgba(dc, 0.45); ctx.lineWidth = 1.5; ctx.stroke(); }

    let chipCx = x + 90;
    ctx.save();
    if (v.chip === 'inset') {
      rr(ctx, x + 9, y + 9, 162, h - 18, 14); ctx.fillStyle = dc; ctx.fill();
    } else {
      rr(ctx, x, y, w, h, R); ctx.clip(); ctx.fillStyle = dc; ctx.beginPath();
      if (v.chip === 'slant') { ctx.moveTo(x, y); ctx.lineTo(x + 196, y); ctx.lineTo(x + 166, y + h); ctx.lineTo(x, y + h); chipCx = x + 88; }
      else { ctx.rect(x, y, 180, h); }
      ctx.fill();
    }
    ctx.restore();
    const cy = y + h / 2;
    text(ctx, 'เกิดวัน', chipCx, cy - 12, F.k5, 19, NAVY, 'center', 150);
    text(ctx, dayName, chipCx, cy + 30, F.display, 37, NAVY, 'center', 152);

    const mx = x + 204, mw = 572;
    text(ctx, String(item.headline || ''), mx, y + h * 0.43, F.k5, 31, '#FFFFFF', 'left', mw);

    const groups = [['งาน', item.work], ['เงิน', item.money], ['ความรัก', item.love]];
    let ls = 20, s = v.rating === 'bar' ? 16 : 12;
    const gap = v.rating === 'bar' ? 5 : 6;
    const layout = () => {
      ctx.font = F.k4(ls);
      const lw = groups.map(g => ctx.measureText(g[0]).width);
      const markW = 5 * s + 4 * gap;
      const inner = lw.reduce((a, b) => a + b, 0) + 3 * (10 + markW);
      return { lw, markW, inner };
    };
    let L = layout();
    while (L.inner + 2 * 16 > mw && ls > 16) { ls -= 1; s = Math.max(9, s - 0.5); L = layout(); }
    const ggap = Math.min(40, (mw - L.inner) / 2);
    const ry = y + h - 27;
    const cOn = v.ratingColor === 'day' ? dc : GOLD, cOff = rgba(SUB, 0.22);
    let gx = mx;
    groups.forEach((g, gi) => {
      text(ctx, g[0], gx, ry + ls * 0.36, F.k4, ls, SUB);
      let px = gx + L.lw[gi] + 10;
      const val = Math.max(0, Math.min(5, Math.round(Number(g[1]) || 0)));
      for (let k = 0; k < 5; k++) { ratingMark(ctx, v.rating, px, ry, s, k < val, cOn, cOff); px += s + gap; }
      gx += L.lw[gi] + 10 + L.markW + ggap;
    });

    ctx.strokeStyle = rgba(SUB, 0.16); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 792, y + 16); ctx.lineTo(x + 792, y + h - 16); ctx.stroke();
    const rc = x + 880;
    text(ctx, 'เลขมงคล', rc, y + 29, F.k4, 17, SUB, 'center', 150);
    text(ctx, String(item.luckyNumber ?? ''), rc, y + 76, F.display, 42, GOLD, 'center', 150);
    const cname = String(item.luckyColorName || '');
    const cs = fit(ctx, cname, F.k4, 17, 120);
    const cw = ctx.measureText(cname).width, dotR = 7, tot = dotR * 2 + 7 + cw;
    const sx = rc - tot / 2, ccy = y + h - 12;
    ctx.fillStyle = validHex(item.luckyColorHex) ? hexOf(item.luckyColorHex) : GOLD;
    ctx.beginPath(); ctx.arc(sx + dotR, ccy - 6, dotR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, cname, sx + dotR * 2 + 7, ccy, F.k4, cs, SUB);
  }

  // points down: the full reading is in the comments under the post
  function drawArrow(ctx, x, cy, w, color) {
    const cx = x + w / 2;
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 11); ctx.moveTo(cx - 8, cy + 3); ctx.lineTo(cx, cy + 11); ctx.lineTo(cx + 8, cy + 3); ctx.stroke();
  }

  // P here is the layout's side margin (the weekly grid uses a narrower one); the CTA is daily only.
  function drawFooter(ctx, v, T, S, P, showCta = true) {
    const cy = H - P - 36, ax = P + 36;
    ctx.save(); ctx.beginPath(); ctx.arc(ax, cy, 34, 0, Math.PI * 2); ctx.clip();
    if (S.avatarImg) {
      const iw = S.avatarImg.naturalWidth || S.avatarImg.width, ih = S.avatarImg.naturalHeight || S.avatarImg.height;
      const sc = 68 / Math.min(iw, ih);
      ctx.drawImage(S.avatarImg, ax - iw * sc / 2, cy - ih * sc / 2, iw * sc, ih * sc);
    } else {
      ctx.fillStyle = T.card; ctx.fillRect(ax - 36, cy - 36, 72, 72);
      const name = (S.pageName || '').trim();
      text(ctx, name ? [...name][0] : '✦', ax, cy + 14, F.display, 36, GOLD, 'center');
    }
    ctx.restore();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ax, cy, 35.5, 0, Math.PI * 2); ctx.stroke();

    const tx = P + 72 + 18;
    const cta = showCta ? (S.cta || '').trim() : '';
    let ctaLeft = W - P;
    if (cta) {
      const fs = fit(ctx, cta, F.k5, 24, 470);
      const tw = ctx.measureText(cta).width;
      const arrowW = 26;
      if (v.cta === 'text') {
        const x0 = W - P - tw - arrowW - 10;
        text(ctx, cta, x0, cy + 8, F.k5, fs, GOLD);
        ctx.strokeStyle = rgba(GOLD, 0.6); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, cy + 22); ctx.lineTo(x0 + tw, cy + 22); ctx.stroke();
        drawArrow(ctx, W - P - arrowW, cy, arrowW, GOLD);
        ctaLeft = x0;
      } else {
        const bw = tw + 48 + arrowW + 10, bh = 58, bx = W - P - bw;
        rr(ctx, bx, cy - bh / 2, bw, bh, bh / 2);
        if (v.cta === 'filled') { ctx.fillStyle = GOLD; ctx.fill(); }
        else { ctx.fillStyle = rgba(GOLD, 0.08); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke(); }
        const col = v.cta === 'filled' ? NAVY : GOLD;
        text(ctx, cta, bx + 24, cy + 8, F.k5, fs, col);
        drawArrow(ctx, bx + 24 + tw + 10, cy, arrowW, col);
        ctaLeft = bx;
      }
    }
    const nameMax = Math.max(160, ctaLeft - tx - 24);
    text(ctx, (S.pageName || '').trim(), tx, cy - 4, F.k6, 30, '#FFFFFF', 'left', nameMax);
    text(ctx, (S.pageSub || '').trim(), tx, cy + 28, F.k4, 21, SUB, 'left', nameMax);
  }

  // ---------- public: variants ----------
  // history: [{date, key}] of designs already posted; overrides: {dim: value} locks.
  function chooseVariants(d, reroll, overrides, history) {
    const others = (history || []).filter(h => h.date !== d.date).map(h => h.key);
    // the mascot pose should also differ from the last posted day
    const mi = DIMS.findIndex(dim => dim.key === 'mascot');
    const lastPose = others[0] ? others[0].split('/')[mi] : null;
    let v, key, seed;
    for (let attempt = 0; attempt < 24; attempt++) {
      seed = `${d.date}|${d.dayTitle}|${reroll}|${attempt}`;
      const rng = rngFrom(seed);
      v = {};
      DIMS.forEach(dim => { const r = pick(rng, dim.pool); v[dim.key] = (overrides || {})[dim.key] || r; });
      key = DIMS.map(dim => v[dim.key]).join('/');
      const poseRepeats = !(overrides || {}).mascot && v.mascot === lastPose;
      if (!others.includes(key) && !poseRepeats) break;
    }
    return { v, key, seed };
  }

  // ---------- public: draw ----------
  function draw(canvas, d, chosen, S) {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const { v, seed } = chosen;
    const rng = rngFrom(seed + '#decor');
    const T = THEMES[v.theme];
    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, v, rng, T);
    const week = d.type === 'week', L = week ? LAYOUT.week : LAYOUT.day;
    drawHeader(ctx, v, T, d, L);
    if (week) drawWeekGrid(ctx, v, T, d.days.slice(0, 7), L);
    else {
      const rows = d.days.slice(0, 7);
      const top = L.top, bottom = H - P - 72 - 26, gap = 10;
      const rowH = (bottom - top - gap * (rows.length - 1)) / rows.length;
      rows.forEach((item, i) => drawRow(ctx, v, T, item, i, top + i * (rowH + gap), rowH));
    }
    drawFooter(ctx, v, T, S, L.M, !week);
  }

  // ---------- weekly: 3 cards over 4, each with the reading plus love / single / health ----------
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  const CLUSTER = /\S[ัิ-ฺ็-๎]*|\s+/g;
  const words = t => segmenter ? [...segmenter.segment(t)].map(x => x.segment) : (t.match(/\s+|\S+/g) || []);
  // Thai has no spaces between words, so lines break at dictionary word boundaries (Intl.Segmenter),
  // falling back to character clusters for anything wider than a line. `indent` shortens the first line.
  function wrapThai(ctx, t, maxW, indent = 0) {
    const lines = [];
    let cur = '', limit = maxW - indent;
    const push = () => { lines.push(cur.trim()); cur = ''; limit = maxW; };
    for (const wd of words(String(t).replace(/\s+/g, ' ').trim())) {
      const next = cur + wd;
      if (ctx.measureText(next.trimEnd()).width <= limit) { cur = next; continue; }
      if (!wd.trim()) { push(); continue; }
      if (/^[ๆฯ.,!?)\]"'”]/.test(wd) && cur.trim()) { cur = next; continue; } // never start a line with these
      if (cur.trim()) push();
      if (ctx.measureText(wd).width > limit) {
        for (const c of wd.match(CLUSTER) || []) {
          if (cur && ctx.measureText(cur + c).width > limit) push();
          cur += c;
        }
      } else cur = wd;
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines;
  }

  const WEEK_PARTS = [['love', 'ความรัก'], ['single', 'คนโสด'], ['health', 'สุขภาพ']];
  function weekBlocks(ctx, item, w, s) {
    ctx.font = F.k4(s);
    const blocks = [{ lines: wrapThai(ctx, item.reading || '', w), color: '#FFFFFF' }];
    WEEK_PARTS.forEach(([k, label]) => {
      const t = String(item[k] || '').trim();
      if (!t) return;
      ctx.font = F.k5(s * 0.9);
      const pw = ctx.measureText(label).width + s * 0.9;
      ctx.font = F.k4(s);
      blocks.push({ label, pw, lines: wrapThai(ctx, t, w, pw + s * 0.4), color: '#DCDFF5' });
    });
    const lh = s * 1.46, gap = s * 0.5;
    return { blocks, lh, gap, height: blocks.reduce((a, b) => a + b.lines.length * lh, 0) + gap * (blocks.length - 1) };
  }

  function drawWeekGrid(ctx, v, T, items, L) {
    const M = L.M, gap = 14, band = 58, pad = 16;
    const top = L.top, bottom = H - M - 72 - 16;
    const rowH = (bottom - top - gap) / 2;
    [[0, 3], [3, 7]].forEach(([a, b], r) => {
      const row = items.slice(a, b), n = row.length;
      const w = (W - 2 * M - gap * (n - 1)) / n, y = top + r * (rowH + gap);
      const bodyH = rowH - band - pad * 2;
      // one text size per row, the largest at which every card in the row fits
      let s = 24;
      row.forEach(it => { while (s > 14 && weekBlocks(ctx, it, w - pad * 2, s).height > bodyH) s -= 0.5; });
      row.forEach((it, k) => drawWeekCard(ctx, v, T, it, a + k, M + k * (w + gap), y, w, rowH, s, band, pad));
    });
  }

  function drawWeekCard(ctx, v, T, item, i, x, y, w, h, s, band, pad) {
    const dayName = String(item.day || '').trim();
    const dc = DAY_COLORS[dayName] || DAY_ORDER[i % 7];
    const R = 18;
    rr(ctx, x, y, w, h, R); ctx.fillStyle = T.card; ctx.fill();
    if (v.card === 'glow') {
      ctx.save(); rr(ctx, x, y, w, h, R); ctx.clip();
      const g = ctx.createLinearGradient(0, y, 0, y + h * 0.7);
      g.addColorStop(0, rgba(dc, 0.2)); g.addColorStop(1, rgba(dc, 0));
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
    }
    if (v.card === 'outline') { rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, R); ctx.strokeStyle = rgba(dc, 0.5); ctx.lineWidth = 1.5; ctx.stroke(); }

    // day band across the top, in the same three styles as the daily day chip
    let bx = x, bw = w, by = y, bh = band;
    ctx.save();
    if (v.chip === 'inset') {
      bx = x + 10; bw = w - 20; by = y + 10; bh = band - 10;
      rr(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = dc; ctx.fill();
    } else {
      rr(ctx, x, y, w, h, R); ctx.clip(); ctx.fillStyle = dc; ctx.beginPath();
      if (v.chip === 'slant') { bw = w * 0.8; ctx.moveTo(x, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw - 24, y + band); ctx.lineTo(x, y + band); bw -= 12; }
      else ctx.rect(x, y, w, band);
      ctx.fill();
    }
    ctx.restore();
    const pre = 'เกิดวัน', bcy = by + bh / 2;
    let ns = 32;
    const measure = () => { ctx.font = F.k5(ns * 0.56); const a = ctx.measureText(pre).width; ctx.font = F.display(ns); return [a, ctx.measureText(dayName).width]; };
    let [wa, wn] = measure();
    while (ns > 20 && wa + 8 + wn > bw - 24) { ns -= 1; [wa, wn] = measure(); }
    const lx = bx + (bw - (wa + 8 + wn)) / 2;
    text(ctx, pre, lx, bcy + ns * 0.36, F.k5, ns * 0.56, NAVY);
    text(ctx, dayName, lx + wa + 8, bcy + ns * 0.4, F.display, ns, NAVY);

    // body: spread any spare height between the paragraphs
    const tw = w - pad * 2, L = weekBlocks(ctx, item, tw, s);
    const bodyH = h - band - pad * 2;
    const gap = L.blocks.length > 1 ? Math.min(s * 1.4, L.gap + (bodyH - L.height) / (L.blocks.length - 1)) : 0;
    let ty = y + band + pad;
    L.blocks.forEach(bk => {
      let ix = 0;
      if (bk.label) {
        const ph = s * 1.24, pcy = ty + L.lh / 2;
        rr(ctx, x + pad, pcy - ph / 2, bk.pw, ph, ph / 2); ctx.fillStyle = rgba(dc, 0.22); ctx.fill();
        text(ctx, bk.label, x + pad + bk.pw / 2, pcy + s * 0.32, F.k5, s * 0.9, dc, 'center');
        ix = bk.pw + s * 0.4;
      }
      bk.lines.forEach((ln, li) => {
        text(ctx, ln, x + pad + (li ? 0 : ix), ty + L.lh / 2 + s * 0.36, F.k4, s, bk.color);
        ty += L.lh;
      });
      ty += gap;
    });
  }

  // ---------- public: parse Claude's answer ----------
  // One blank line before every section start: each birth-day header, the closing note, the hashtags.
  // Lines inside a section stay together; runs of blank lines collapse to one.
  const SECTION_START = /^(?:[🔴🟡🩷🟢🟠🔵🟣🟤⚪⚫]|คนเกิดวัน|ดวงเป็นแนวทาง|.*เพื่อความบันเทิง|#)/u;
  function formatCaption(t) {
    const out = [];
    for (const raw of femaleVoice(String(t || '')).replace(/\r/g, '').split('\n')) {
      const line = raw.replace(/\s+$/, '');
      const prev = out[out.length - 1];
      const hashtagRun = line.startsWith('#') && prev && prev.startsWith('#');
      if (line && SECTION_START.test(line.trim()) && prev && !hashtagRun) out.push('');
      out.push(line);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // The page speaks as a woman: male polite particles become ค่ะ / คะ (คะ after นะ and question words).
  function femaleVoice(t) {
    return t
      .replace(/(นะ|ไหม|มั้ย|หรือเปล่า|หรือยัง|ไหน|อะไร|ยังไง|อย่างไร|เหรอ|หรอ|กี่|ใคร)(\s*)ครับ/g, '$1$2คะ')
      .replace(/ครับ\s*\?/g, 'คะ?')
      .replace(/ครับผม|ครับ/g, 'ค่ะ');
  }

  // Make sure the hashtag line carries the post's own day, e.g. #ดวงวันพุธ (put first).
  function ensureDayTag(t, dayTitle, fixedTag) {
    const day = String(dayTitle || '').trim().replace(/^วัน/, '').replace(/\s+/g, '');
    if (!day && !fixedTag) return t;
    const tag = fixedTag || `#ดวงวัน${day}`;
    if (new RegExp(`${tag}(?![\\u0E00-\\u0E7F])`).test(t)) return t;
    const lines = t.split('\n');
    const i = lines.findIndex(l => l.trim().startsWith('#'));
    if (i >= 0) lines[i] = `${tag} ${lines[i].trim()}`;
    else lines.push('', tag);
    return lines.join('\n');
  }

  function cleanCaption(t) {
    // strip chat markdown first so section headers start with their emoji, then space the sections
    return formatCaption(t
      .replace(/\*\*|__/g, '')
      .replace(/^\s*(แคปชัน|caption)[^\n]*\n/i, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*---+\s*$/gm, ''));
  }
  // The AI writes the short post caption, then this marker line, then the full reading for the first comment.
  const COMMENT_MARK = /^[ \t]*=+[ \t]*คอมเมนต์[ \t]*=+[ \t]*$/m;
  function parse(raw) {
    const msgs = [];
    const s = String(raw || '').trim().replace(/\*\*|__/g, '');
    let obj = null, caption = '', comment = '';
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      // the caption is what Claude writes after the JSON block; chat lines before it are dropped
      try { obj = JSON.parse(fence[1]); caption = s.slice(fence.index + fence[0].length); } catch {}
    }
    if (!obj) { try { obj = JSON.parse(s); } catch {} }
    if (!obj) {
      const a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a >= 0 && b > a) { try { obj = JSON.parse(s.slice(a, b + 1)); caption = s.slice(b + 1).replace(/^\s*```/, ''); } catch {} }
    }
    const mark = caption.match(COMMENT_MARK);
    if (mark) { comment = cleanCaption(caption.slice(mark.index + mark[0].length)); caption = caption.slice(0, mark.index); }
    caption = cleanCaption(caption);
    if (!obj) return { msgs: [['err', 'ยังหาดวงในข้อความที่วางไม่เจอ ลองกลับไปที่แอป AI แล้วกดคัดลอกคำตอบทั้งหมดอีกครั้ง']] };
    if (!Array.isArray(obj.days) || obj.days.length < 7) return { msgs: [['err', 'ดวงยังไม่ครบ 7 วัน (อาทิตย์ถึงเสาร์) ลองคัดลอกคำสั่งใหม่แล้วให้ AI เขียนอีกครั้ง']] };
    if (obj.type === 'week' || obj.days.some(x => x && x.reading)) {
      // weekly: the image carries the whole reading, so there is no comment and no ratings
      obj.type = 'week'; obj.days = obj.days.slice(0, 7);
      obj.days.forEach(it => ['reading', 'love', 'single', 'health'].forEach(k => { if (typeof it[k] === 'string') it[k] = femaleVoice(it[k]); }));
      if (caption) caption = ensureDayTag(caption, '', '#ดวงประจำสัปดาห์');
      if (!obj.date) msgs.push(['warn', 'ไม่มีช่วงวันที่ ภาพจะไม่มีวันที่']);
      obj.days.forEach((it, i) => {
        const n = it.day || `ช่อง ${i + 1}`;
        if (!String(it.reading || '').trim()) msgs.push(['warn', `${n}: ไม่มีคำทำนาย`]);
        if (thaiLen([it.reading, it.love, it.single, it.health].join('')) > 260) msgs.push(['warn', `${n}: คำทำนายยาวไป ตัวหนังสือจะเล็กลง`]);
      });
      return { obj, caption, comment: '', msgs };
    }
    if (caption) caption = ensureDayTag(caption, obj.dayTitle);
    if (!comment) msgs.push(['warn', 'ไม่มีคำทำนายฉบับเต็มสำหรับคอมเมนต์ ลองคัดลอกคำสั่งใหม่แล้วให้ AI เขียนอีกครั้ง']);
    if (!obj.date) msgs.push(['warn', 'ไม่มีวันที่ ภาพจะไม่มีวันที่']);
    if (!obj.dayTitle) msgs.push(['warn', 'ไม่มีชื่อวัน หัวข้อจะเหลือแค่ "ดวงวัน"']);
    obj.days.slice(0, 7).forEach((it, i) => {
      const n = it.day || `แถว ${i + 1}`;
      if (thaiLen(it.headline || '') > 24) msgs.push(['warn', `${n}: คำทำนายยาวไป ตัวหนังสือจะเล็กลง`]);
      ['work', 'money', 'love'].forEach(k => { const x = Number(it[k]); if (!(x >= 0 && x <= 5)) msgs.push(['warn', `${n}: คะแนน ${k} ควรเป็นเลข 0–5`]); });
      if (it.luckyColorHex && !validHex(it.luckyColorHex)) msgs.push(['warn', `${n}: รหัสสีไม่ถูกต้อง ใช้สีทองแทน`]);
      if (!DAY_COLORS[String(it.day || '').trim()]) msgs.push(['warn', `${n}: ไม่รู้จักชื่อวันนี้ ใช้สีตามลำดับแถวแทน`]);
    });
    obj.days = obj.days.slice(0, 7);
    return { obj, caption, comment, msgs };
  }

  // ---------- public: caption checks (Facebook) ----------
  const CAPTION_RULES = [
    ['err', /(พิมพ์|คอมเมนต์|คอมเม้น|เมนต์|เม้น)\s*["“'”]?\s*(สาธุ|รับ|ขอ|99|๙๙|เอา)/, 'ขอให้คนพิมพ์หรือคอมเมนต์เพื่อรับโชค Facebook จะลดการมองเห็นโพสต์'],
    ['err', /(แชร์|ส่งต่อ|share)/i, 'ชวนแชร์หรือส่งต่อ Facebook จะลดการมองเห็นโพสต์'],
    ['err', /(แท็ก|แทก|tag)/i, 'ชวนแท็กเพื่อน Facebook จะลดการมองเห็นโพสต์'],
    ['err', /กด\s*(ไลก์|ไลค์|like|ถูกใจ|หัวใจ|รีแอค|react)/i, 'ขอให้กดไลก์ Facebook จะลดการมองเห็นโพสต์'],
    ['err', /(หวย|เลขเด็ด|สลาก|ลอตเตอรี่|ล็อตเตอรี่|เลขท้าย|แทงเลข|พนัน|บาคาร่า|คาสิโน)/, 'พูดถึงหวยหรือการพนัน เสี่ยงผิดกฎ Facebook'],
    ['warn', /(100\s*%|การันตี|รับประกัน|รวยแน่|ถูกแน่|ได้แน่นอน)/, 'มีคำรับประกันผล ควรเลี่ยง'],
    ['warn', /(โอน|ค่าครู|ทักแชท|inbox|ราคา\s*\d|บาท)/i, 'มีเรื่องเงินหรือชวนทักแชทซื้อของ ควรเลี่ยง'],
    ['warn', /(ลงทุน|หุ้น|คริปโต|crypto|เทรด|รักษา|หายป่วย)/i, 'มีคำแนะนำเรื่องลงทุนหรือสุขภาพ ควรเลี่ยง']
  ];
  function checkCaption(t) {
    const out = [];
    if (!String(t || '').trim()) return [['warn', 'ยังไม่มีแคปชัน']];
    CAPTION_RULES.forEach(([k, re, msg]) => { const m = t.match(re); if (m) out.push([k, `${msg} (คำว่า "${m[0]}")`]); });
    const tags = t.match(/#[^\s#]+/g) || [];
    if (tags.length > 5) out.push(['warn', `แฮชแท็กเยอะไป (${tags.length} อัน) ใช้ 3–5 อันพอ`]);
    const longPara = t.split(/\n\s*\n/).filter(p => p.replace(/\s/g, '').length > 260);
    if (longPara.length) out.push(['warn', 'มีย่อหน้าที่ยาวเกินไป อ่านยากบนมือถือ']);
    if (!/(ความบันเทิง|วิจารณญาณ)/.test(t)) out.push(['warn', 'ยังไม่มีข้อความ "เพื่อความบันเทิง โปรดใช้วิจารณญาณ"']);
    if (!out.length) out.push(['ok', 'แคปชันปลอดภัย โพสต์ได้']);
    return out;
  }
  // The comment carries the full reading, so only the wording rules apply (no hashtag or disclaimer checks).
  function checkComment(t) {
    const out = [];
    CAPTION_RULES.forEach(([k, re, msg]) => { const m = String(t || '').match(re); if (m) out.push([k, `คอมเมนต์: ${msg} (คำว่า "${m[0]}")`]); });
    return out;
  }

  // ---------- public: prompt for Claude ----------
  function thaiDate(dt) {
    return {
      wd: new Intl.DateTimeFormat('th-TH', { weekday: 'long' }).format(dt).replace(/^วัน/, ''),
      ds: new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt)
    };
  }
  function buildPrompt(dt, pageName) {
    const { wd, ds } = thaiDate(dt);
    return `เขียนดูดวงรายวันสำหรับคนเกิดทั้ง 7 วัน (อาทิตย์ถึงเสาร์) ประจำวัน${wd}ที่ ${ds}

ตอบเป็น JSON ก่อน ตามรูปแบบนี้เป๊ะๆ (ใส่ใน code block)
{
  "date": "${ds}",
  "dayTitle": "${wd}",
  "days": [
    { "day": "อาทิตย์", "headline": "...", "work": 1-5, "money": 1-5, "love": 1-5, "luckyNumber": "..", "luckyColorName": "..", "luckyColorHex": "#RRGGBB" },
    ... ให้ครบ 7 รายการตามลำดับ อาทิตย์ จันทร์ อังคาร พุธ พฤหัส ศุกร์ เสาร์ (ใช้ชื่อวันตามนี้เป๊ะๆ)
  ]
}

กติกาของ JSON
- headline สั้น อ่านแล้วเข้าใจทันที ไม่เกิน 24 ตัวอักษร (ไม่นับสระบน-ล่างและวรรณยุกต์)
- แต่ละวันใช้คำขึ้นต้นและโทนต่างกัน อย่าใช้รูปประโยคซ้ำกันทั้ง 7 แถว
- คะแนนต้องสอดคล้องกับ headline และแต่ละวันไม่ควรได้คะแนนชุดเดียวกัน
- luckyNumber เป็นตัวเลข 1–2 หลัก, luckyColorName ชื่อสีภาษาไทยคำเดียวสั้นๆ, luckyColorHex รหัสสีของสีนั้น

หลัง JSON ให้เขียน 2 ส่วน เป็นข้อความธรรมดา ไม่ใส่ code block ไม่ใช้ตัวหนาหรือเครื่องหมาย markdown

ส่วนที่ 1 แคปชันโพสต์ Facebook แบบสั้น (ไม่ต้องใส่คำทำนายรายวันเกิด) ตามโครงนี้
บรรทัดที่ 1: ประโยคเปิดสั้นๆ ไม่เกิน 60 ตัวอักษร บอกว่าเป็นดวงวัน${wd}ที่ ${ds}
บรรทัดที่ 2: บอกสั้นๆ ว่าอ่านคำทำนายฉบับเต็มของทุกวันเกิดได้ที่คอมเมนต์ใต้โพสต์ ลงท้ายด้วย 👇
(เว้นหนึ่งบรรทัด)
"ดวงเป็นแนวทางเพื่อความบันเทิง โปรดใช้วิจารณญาณ" และชวนติดตามเพจ${pageName ? ' ' + pageName : ''} ไว้อ่านดวงใหม่ทุกวันแบบสุภาพ 1 บรรทัด
(เว้นหนึ่งบรรทัด)
แฮชแท็ก 3–5 อัน ต้องมี #ดวงวัน${wd} เป็นอันแรกเสมอ ตามด้วยแฮชแท็กทั่วไป เช่น #ดูดวงรายวัน #ดวงวันนี้

จากนั้นขึ้นบรรทัดใหม่ แล้วพิมพ์บรรทัดนี้ตามตัวเป๊ะๆ
=== คอมเมนต์ ===

ส่วนที่ 2 คำทำนายฉบับเต็ม (จะนำไปโพสต์เป็นคอมเมนต์แรกใต้โพสต์) ตามโครงนี้
บรรทัดแรก: คำทำนายฉบับเต็ม ดวงวัน${wd}ที่ ${ds}
(เว้นหนึ่งบรรทัด)
แล้วแยกเป็นช่วงของแต่ละวันเกิด ครบ 7 วัน เว้นบรรทัดว่างระหว่างช่วง แต่ละช่วงเป็นแบบนี้
🔴 คนเกิดวันอาทิตย์   (ใช้ 🔴 อาทิตย์, 🟡 จันทร์, 🩷 อังคาร, 🟢 พุธ, 🟠 พฤหัส, 🔵 ศุกร์, 🟣 เสาร์)
งาน: 1–2 ประโยค
เงิน: 1–2 ประโยค
ความรัก: 1–2 ประโยค
เลขมงคล .. · สีมงคล ..
(ข้อมูลต้องตรงกับ JSON)
ปิดท้าย: "ดวงเป็นแนวทางเพื่อความบันเทิง โปรดใช้วิจารณญาณ" (ส่วนนี้ไม่ต้องมีแฮชแท็ก)

${promptRules('ใช้อีโมจิเฉพาะหัวข้อแต่ละวันและ 👇 ในแคปชัน')}`;
  }

  // Voice and Facebook rules shared by the daily and weekly prompts.
  function promptRules(emoji) {
    return `ผู้เขียนเป็นผู้หญิง ใช้คำลงท้าย "ค่ะ" หรือ "คะ" (คำถาม) เท่านั้น ห้ามใช้ "ครับ" และห้ามแทนตัวเองว่า "ผม"
เว้นบรรทัดว่าง 1 บรรทัดหลังจบแต่ละส่วนเสมอ

ข้อห้าม (ผิดกฎหรือ Facebook ลดการมองเห็น)
- ห้ามขอให้พิมพ์ "สาธุ" หรือคอมเมนต์เพื่อรับโชค ห้ามชวนแชร์ แท็กเพื่อน หรือกดไลก์เพื่อรับดวง
- ห้ามพูดถึงหวย เลขเด็ด สลาก หรือการพนัน และห้ามโยงเลขมงคลกับการเสี่ยงโชคด้วยเงิน
- ห้ามรับประกันผล (เช่น รวยแน่ 100%) ห้ามชวนซื้อของแก้ดวงหรือโอนเงิน
- ห้ามให้คำแนะนำเจาะจงเรื่องการลงทุนหรือสุขภาพ
- ${emoji} ไม่ใส่อีโมจิรกทุกบรรทัด ไม่ใช้เครื่องหมาย !!! ซ้ำๆ`;
  }

  // Monday to Sunday starting at `start`, e.g. "2 – 8 พฤศจิกายน 2569" or "30 พฤศจิกายน – 6 ธันวาคม 2569".
  function weekRange(start) {
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const a = thaiDate(start).ds, b = thaiDate(end).ds;
    if (start.getFullYear() !== end.getFullYear()) return `${a} – ${b}`;
    if (start.getMonth() !== end.getMonth()) return `${a.replace(/\s*\S+$/, '')} – ${b}`;
    return `${start.getDate()} – ${b}`;
  }

  function buildWeekPrompt(start, pageName) {
    const range = weekRange(start);
    return `เขียนดูดวงประจำสัปดาห์สำหรับคนเกิดทั้ง 7 วัน (อาทิตย์ถึงเสาร์) ของวันที่ ${range}

ตอบเป็น JSON ก่อน ตามรูปแบบนี้เป๊ะๆ (ใส่ใน code block)
{
  "type": "week",
  "date": "${range}",
  "days": [
    { "day": "อาทิตย์", "reading": "...", "love": "...", "single": "...", "health": "..." },
    ... ให้ครบ 7 รายการตามลำดับ อาทิตย์ จันทร์ อังคาร พุธ พฤหัส ศุกร์ เสาร์ (ใช้ชื่อวันตามนี้เป๊ะๆ)
  ]
}

กติกาของ JSON
- reading ภาพรวมเรื่องงานและการเงินของสัปดาห์ 2 ประโยค ยาวราว 60–90 ตัวอักษร
- love ความรักของคนมีคู่ 1 ประโยค ราว 30–50 ตัวอักษร
- single ความรักของคนโสด 1 ประโยค ราว 30–50 ตัวอักษร
- health สุขภาพ 1 ประโยคสั้น ราว 20–40 ตัวอักษร เป็นข้อควรระวังทั่วไป เช่น พักผ่อน ความเครียด ห้ามแนะนำยาหรือการรักษา และห้ามทำนายโรคร้ายแรง
- แต่ละวันมีทั้งเรื่องดีและเรื่องที่ควรระวัง ใช้คำขึ้นต้นและโทนต่างกัน อย่าใช้รูปประโยคซ้ำกัน
- น้ำเสียงอบอุ่น ให้กำลังใจ ไม่ทำนายเรื่องน่ากลัว เช่น ความตาย อุบัติเหตุร้ายแรง คดีความ การหย่าร้าง
- ไม่ต้องใส่ชื่อวันหรือคำว่า "คนเกิดวัน..." ซ้ำในข้อความ

หลัง JSON ให้เขียนแคปชันโพสต์ Facebook แบบสั้น เป็นข้อความธรรมดา ไม่ใส่ code block ไม่ใช้ตัวหนาหรือเครื่องหมาย markdown ตามโครงนี้
บรรทัดที่ 1: ประโยคเปิดสั้นๆ ไม่เกิน 60 ตัวอักษร บอกว่าเป็นดวงประจำสัปดาห์ ${range}
บรรทัดที่ 2: ชวนดูดวงของวันเกิดตัวเองในภาพ เพื่อเตรียมตัวรับสัปดาห์ใหม่ 1 ประโยค
(เว้นหนึ่งบรรทัด)
"ดวงเป็นแนวทางเพื่อความบันเทิง โปรดใช้วิจารณญาณ" และชวนติดตามเพจ${pageName ? ' ' + pageName : ''} ไว้อ่านดวงใหม่ทุกสัปดาห์แบบสุภาพ 1 บรรทัด
(เว้นหนึ่งบรรทัด)
แฮชแท็ก 3–5 อัน ต้องมี #ดวงประจำสัปดาห์ เป็นอันแรกเสมอ ตามด้วยแฮชแท็กทั่วไป เช่น #ดูดวง #ดวงรายสัปดาห์

${promptRules('ใช้อีโมจิได้ไม่เกิน 2 ตัวในแคปชัน')}`;
  }

  return { W, H, DIMS, loadMascots, chooseVariants, draw, parse, formatCaption, checkCaption, checkComment, buildPrompt, buildWeekPrompt, weekRange, thaiDate };
})();
