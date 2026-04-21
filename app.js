// ─── Constants ────────────────────────────────────────────────────────────────
const SHIFT_STATES = ['empty', 'day', 'night', 'daynight', 'off', 'leave'];
const SHIFT_LABELS = { empty: '', day: 'D', night: 'N', daynight: 'D/N', off: 'B', leave: 'Sİ' };
const SHIFT_HOURS = { empty: 0, day: 8, night: 16, daynight: 24, off: 0, leave: 0 };

const SHIFT_MENU = [
  { state: 'day', label: 'D', desc: 'Gündüz' },
  { state: 'night', label: 'N', desc: 'Gece' },
  { state: 'daynight', label: 'D/N', desc: 'Gündüz / Gece' },
  { state: 'off', label: 'B', desc: 'Boş (İstekli)' },
  { state: 'leave', label: 'Sİ', desc: 'Senelik İzin' },
  { state: 'empty', label: '—', desc: 'Temizle' },
];

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const TR_DAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const AVATAR_COLORS = [
  ['#3b82f6', '#1e40af'], ['#8b5cf6', '#4c1d95'], ['#14b8a6', '#0f766e'],
  ['#f59e0b', '#92400e'], ['#ec4899', '#831843'], ['#10b981', '#064e3b'],
  ['#f97316', '#7c2d12'], ['#06b6d4', '#155e75'], ['#a855f7', '#581c87'],
  ['#ef4444', '#7f1d1d'], ['#84cc16', '#365314'], ['#6366f1', '#312e81'],
];

const STORAGE_KEY = 'nobet_listesi_v2';

// ─── Turkish Public Holidays ──────────────────────────────────────────────────
// Fixed: [month(0-indexed), day]
const TR_FIXED_HOLIDAYS = [
  [0, 1],   // Yılbaşı
  [3, 23],  // Ulusal Egemenlik ve Çocuk Bayramı
  [4, 1],   // Emek ve Dayanışma Günü
  [4, 19],  // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  [6, 15],  // Demokrasi ve Millî Birlik Günü
  [7, 30],  // Zafer Bayramı
  [9, 29],  // Cumhuriyet Bayramı
];

// Variable (religious) holidays: { year: [[month0, day], ...] }
const TR_VARIABLE_HOLIDAYS = {
  2024: [[3, 10], [3, 11], [3, 12], [5, 16], [5, 17], [5, 18], [5, 19]],
  2025: [[2, 30], [2, 31], [3, 1], [5, 6], [5, 7], [5, 8], [5, 9]],
  2026: [[2, 20], [2, 21], [2, 22], [4, 27], [4, 28], [4, 29], [4, 30]],
  2027: [[2, 9], [2, 10], [2, 11], [4, 16], [4, 17], [4, 18], [4, 19]],
};

/** Returns a Set of day numbers that are public holidays for the given year/month */
function getHolidayDays(year, month) {
  const days = new Set();
  TR_FIXED_HOLIDAYS.forEach(([m, d]) => {
    if (m === month) days.add(d);
  });
  const variable = TR_VARIABLE_HOLIDAYS[year] || [];
  variable.forEach(([m, d]) => {
    if (m === month) days.add(d);
  });
  return days;
}

// ─── Default nurses ───────────────────────────────────────────────────────────
const DEFAULT_NURSES = [
  'ElifEce', 'Sümeyye', 'Rabia', 'Beyza', 'Ayşu',
  'Damla', 'Berivan', 'Ayşe'
];

// ─── State ────────────────────────────────────────────────────────────────────
let storage = loadStorage();

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed

let mobileViewMode = 'card'; // 'card' | 'table'
let _prevIsMobile = null;

// ─── Storage helpers ──────────────────────────────────────────────────────────
function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.nurses) parsed.nurses = [...DEFAULT_NURSES];
      if (!parsed.schedule) parsed.schedule = {};
      if (!parsed.preferences) parsed.preferences = {};
      return parsed;
    }
  } catch (e) { /* ignore */ }
  return { nurses: [...DEFAULT_NURSES], schedule: {}, preferences: {} };
}

function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (e) {
    showToast('⚠️', 'Veri kaydedilemedi (localStorage dolu olabilir)');
  }
}

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Returns (and ensures) the schedule object for the current month */
function getMonthSchedule(year, month) {
  const key = monthKey(year, month);
  if (!storage.schedule[key]) {
    storage.schedule[key] = {};
  }
  storage.nurses.forEach(name => {
    if (!storage.schedule[key][name]) {
      storage.schedule[key][name] = {};
    }
  });
  return storage.schedule[key];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getDayOfWeek(year, month, day) {
  return new Date(year, month, day).getDay();
}

function escapeName(name) {
  return encodeURIComponent(name).replace(/%/g, '_pct_');
}

function decodeName(encoded) {
  return decodeURIComponent(encoded.replace(/_pct_/g, '%'));
}

// ─── Nurse Preferences ───────────────────────────────────────────────────────
/**
 * Tercih seviyeleri (5 kademe):
 *   day-only    : Sadece Gündüz   — gece neredeyse hiç yazılmaz
 *   day-prefer  : Çoğunlukla Gündüz — gece ihtiyaç halinde yazılabilir
 *   any         : Fark Etmez
 *   night-prefer: Çoğunlukla Gece — gündüz ihtiyaç halinde yazılabilir
 *   night-only  : Sadece Gece     — gündüz neredeyse hiç yazılmaz
 */
const PREF_LEVELS = ['day-only', 'day-prefer', 'any', 'night-prefer', 'night-only'];

/** Hemşirenin vardiya tercihini döndürür; eski değerleri yeni sisteme normalize eder */
function getPreference(name) {
  const raw = (storage.preferences && storage.preferences[name]) || 'any';
  if (raw === 'day')   return 'day-prefer';
  if (raw === 'night') return 'night-prefer';
  return raw;
}

/** Tercih butonu tıklanınca çağrılır (nurseEncoded ile) */
function setPreference(nurseEncoded, pref) {
  const name = decodeName(nurseEncoded);
  if (!storage.preferences) storage.preferences = {};
  storage.preferences[name] = pref;
  saveStorage();
  renderNurseList();
}

/**
 * Gündüz (day) veya gece (night) ataması için skor döndürür.
 * Düşük skor = bu vardiya tipine daha uygun.
 *
 *   day-only    : gündüz -6 / gece +10  → gece son çare
 *   day-prefer  : gündüz -4 / gece  +3  → gece ihtiyaç halinde
 *   any         : gündüz  0 / gece   0  → dengeli
 *   night-prefer: gündüz +3 / gece  -4  → gündüz ihtiyaç halinde
 *   night-only  : gündüz+10 / gece  -6  → gündüz son çare
 */
function prefScore(name, shiftType) {
  const p = getPreference(name);
  if (p === 'day-only')    return shiftType === 'day' ? -6 : 10;
  if (p === 'day-prefer')  return shiftType === 'day' ? -4 :  3;
  if (p === 'any')         return 0;
  if (p === 'night-prefer') return shiftType === 'night' ? -4 :  3;
  if (p === 'night-only')   return shiftType === 'night' ? -6 : 10;
  // eski değerleri geriye dönük destekle
  if (p === 'day')   return shiftType === 'day'   ? -4 :  5;
  if (p === 'night') return shiftType === 'night' ? -4 :  5;
  return 0;
}

// ─── Mobile helpers ───────────────────────────────────────────────────────────
function isMobile() { return window.innerWidth < 768; }

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function toggleViewMode() {
  mobileViewMode = mobileViewMode === 'card' ? 'table' : 'card';
  const btn = document.getElementById('viewToggleBtn');
  if (btn) {
    btn.textContent = mobileViewMode === 'card' ? '📊' : '📋';
    btn.title = mobileViewMode === 'card' ? 'Tablo Görünümüne Geç' : 'Kart Görünümüne Geç';
  }
  renderTable();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderTable();
  renderStats();
  renderTestPanel();
}

function renderHeader() {
  const monthName = TR_MONTHS[currentMonth];
  const year = currentYear;
  document.getElementById('monthName').textContent = monthName;
  document.getElementById('yearName').textContent = year;
  // Mobil floating bar'a da yansıt
  const mobMonth = document.getElementById('mobMonthName');
  const mobYear = document.getElementById('mobYearName');
  if (mobMonth) mobMonth.textContent = monthName;
  if (mobYear) mobYear.textContent = year;
}

/** Ekran boyutuna göre uygun render fonksiyonunu çağırır */
function renderTable() {
  if (isMobile() && mobileViewMode === 'card') {
    renderTableMobile();
  } else {
    renderTableDesktop();
  }
}

/** Masaüstü: standart yatay tablo görünümü */
function renderTableDesktop() {
  document.getElementById('desktopView').style.display = '';
  document.getElementById('mobileView').style.display = 'none';

  const days = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  const thead = document.getElementById('tableThead');
  const tbody = document.getElementById('tableTbody');

  // ── Header row ──
  const holidays = getHolidayDays(currentYear, currentMonth);

  let headerHTML = `<tr>
    <th class="nurse-col-header">Hemşire</th>`;

  for (let d = 1; d <= 31; d++) {
    if (d <= days) {
      const dow = getDayOfWeek(currentYear, currentMonth, d);
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidays.has(d) && !isWeekend;
      const cls = isHoliday ? ' holiday' : isWeekend ? ' weekend' : '';
      headerHTML += `<th class="day-header${cls}">
        <span class="day-num">${d}</span>
        <span class="day-name">${TR_DAYS_SHORT[dow]}</span>
      </th>`;
    } else {
      headerHTML += `<th class="day-header" style="opacity:0.2"><span class="day-num">-</span></th>`;
    }
  }
  headerHTML += `<th class="nurse-col-header col-total" style="text-align:center;min-width:72px;border-left:2px solid var(--border-light)">Toplam</th>`;
  headerHTML += `<th class="nurse-col-header col-target" style="text-align:center;min-width:72px;">Hedef</th>`;
  headerHTML += `<th class="nurse-col-header col-mesai" style="text-align:center;min-width:72px;right:0;position:sticky;">Mesai</th></tr>`;
  thead.innerHTML = headerHTML;

  // ── Body rows ──
  let bodyHTML = '';
  storage.nurses.forEach((name, ni) => {
    const colors = AVATAR_COLORS[ni % AVATAR_COLORS.length];
    const initials = name.substring(0, 2).toUpperCase();
    const nurseKey = escapeName(name);

    if (!monthSch[name]) monthSch[name] = {};

    bodyHTML += `<tr data-nurse="${nurseKey}">
      <td class="nurse-name-cell">
        <div class="nurse-info">
          <div class="nurse-avatar" style="background:linear-gradient(135deg,${colors[0]},${colors[1]});">${initials}</div>
          <span class="nurse-name-text">${name}</span>
        </div>
      </td>`;

    let shiftHours = 0, leaveCount = 0;
    for (let d = 1; d <= 31; d++) {
      if (d <= days) {
        const shift = monthSch[name][d] || 'empty';
        if (shift !== 'empty') shiftHours += SHIFT_HOURS[shift];
        if (shift === 'leave') leaveCount++;
        const dow = getDayOfWeek(currentYear, currentMonth, d);
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = holidays.has(d) && !isWeekend;
        const colCls = isHoliday ? ' holiday-col' : isWeekend ? ' weekend-col' : '';
        bodyHTML += `<td class="shift-cell${colCls}"
          data-nurse="${nurseKey}"
          data-day="${d}"
          onclick="cycleShift('${nurseKey}', ${d}, this)">
          <div class="cell-inner ${shift}">${SHIFT_LABELS[shift]}</div>
        </td>`;
      } else {
        bodyHTML += `<td class="shift-cell disabled"><div class="cell-inner empty"></div></td>`;
      }
    }

    const target = MONTHLY_TARGET - leaveCount * 8;
    bodyHTML += `<td class="row-total col-total">
      <div class="total-badge" id="total-${nurseKey}">
        ${totalBadgeHTML(shiftHours)}
      </div>
    </td>`;
    bodyHTML += `<td class="row-target col-target">
      <div class="target-badge" id="target-${nurseKey}">
        ${targetBadgeHTML(target, leaveCount)}
      </div>
    </td>`;
    bodyHTML += `<td class="row-mesai col-mesai">
      <div class="mesai-badge" id="mesai-${nurseKey}">
        ${mesaiBadgeHTML(shiftHours, target)}
      </div>
    </td></tr>`;
  });

  tbody.innerHTML = bodyHTML;
}

/** Mobil: her hemşire için haftalık kart satırları */
function renderTableMobile() {
  document.getElementById('desktopView').style.display = 'none';
  document.getElementById('mobileView').style.display = 'flex';

  const days = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  let html = '';

  storage.nurses.forEach((name, ni) => {
    const colors = AVATAR_COLORS[ni % AVATAR_COLORS.length];
    const initials = name.substring(0, 2).toUpperCase();
    const nurseKey = escapeName(name);

    if (!monthSch[name]) monthSch[name] = {};

    // Toplam saat ve izin hesapla
    let shiftHours = 0, mobLeave = 0;
    for (let d = 1; d <= days; d++) {
      const s = monthSch[name][d] || 'empty';
      shiftHours += SHIFT_HOURS[s];
      if (s === 'leave') mobLeave++;
    }
    const mobTarget = MONTHLY_TARGET - mobLeave * 8;

    html += `
    <div class="nurse-card">
      <div class="nurse-card-header">
        <div class="nurse-avatar" style="background:linear-gradient(135deg,${colors[0]},${colors[1]});width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;color:white;">${initials}</div>
        <span class="nurse-card-name">${name}</span>
        <div class="nurse-card-totals">
          <div class="nurse-card-total"  id="total-${nurseKey}">${totalBadgeHTML(shiftHours)}</div>
          <div class="nurse-card-target" id="target-${nurseKey}">${targetBadgeHTML(mobTarget, mobLeave)}</div>
          <div class="nurse-card-mesai"  id="mesai-${nurseKey}">${mesaiBadgeHTML(shiftHours, mobTarget)}</div>
        </div>
      </div>
      <div class="nurse-card-body">`;

    // 7'li hafta satırları
    const mobHolidays = getHolidayDays(currentYear, currentMonth);
    for (let weekStart = 1; weekStart <= days; weekStart += 7) {
      const weekEnd = Math.min(weekStart + 6, days);
      html += `<div class="week-row">`;

      for (let d = weekStart; d <= weekEnd; d++) {
        const dow = getDayOfWeek(currentYear, currentMonth, d);
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = mobHolidays.has(d) && !isWeekend;
        const shift = monthSch[name][d] || 'empty';
        const cellCls = isHoliday ? ' holiday-col' : isWeekend ? ' weekend-col' : '';
        const dayCls = isWeekend ? ' weekend' : isHoliday ? ' holiday' : '';
        html += `<div class="mobile-cell${cellCls}" onclick="cycleShift('${nurseKey}', ${d}, this)">
            <span class="mob-day-n${dayCls}">${d}</span>
            <div class="cell-inner ${shift}">${SHIFT_LABELS[shift]}</div>
          </div>`;
      }

      // Son satır eksik ise boş hücre (grid hizası için)
      for (let f = weekEnd - weekStart + 1; f < 7; f++) {
        html += `<div class="mobile-cell" style="pointer-events:none;opacity:0;"></div>`;
      }

      html += `</div>`; // .week-row
    }

    html += `</div></div>`; // .nurse-card-body + .nurse-card
  });

  document.getElementById('mobileView').innerHTML = html;
}

function renderStats() {
  const days = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  let total = 0, dayCount = 0, nightCount = 0, dnCount = 0, leaveCount = 0, totalHours = 0;

  storage.nurses.forEach(name => {
    for (let d = 1; d <= days; d++) {
      const s = monthSch[name]?.[d] || 'empty';
      if (s === 'day') { total++; dayCount++; totalHours += 8; }
      else if (s === 'night') { total++; nightCount++; totalHours += 16; }
      else if (s === 'daynight') { total++; dnCount++; totalHours += 24; }
      else if (s === 'leave') { leaveCount++; }
    }
  });

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDay').textContent = dayCount;
  document.getElementById('statNight').textContent = nightCount;
  document.getElementById('statDN').textContent = dnCount;
  document.getElementById('statLeave').textContent = leaveCount;
  document.getElementById('statHours').textContent = totalHours + 's';
}

// ─── Test Paneli ─────────────────────────────────────────────────────────────

const DEV_MODE = true; // geliştirme bitti mi? false yapınca panel gizlenir

/**
 * Mevcut aya ait çizelgeyi 3 kurala göre kontrol eder ve paneli günceller.
 *
 * Kural 1 — Mesai saati eşitliği:
 *   Takımın %30'u mesai (>160s) alıyorsa herkesin mesaisi olmak zorunda.
 *   Mesaisi olanlar arasındaki max-min farkı ≤ 8 saat olmalı.
 *
 * Kural 2 — Haftasonu gün eşitliği:
 *   Herkesin haftasonu vardiya sayısı; max – min ≤ 1 olmalı.
 *
 * Kural 3 — Boş gün eşitliği:
 *   Herkesin boş (empty/off) gün sayısı; max – min ≤ 1 olmalı.
 */
function renderTestPanel() {
  const panel = document.getElementById('testPanel');
  if (!panel) return;
  if (!DEV_MODE) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  const nurses = storage.nurses;
  if (!nurses || nurses.length === 0) { panel.innerHTML = ''; return; }

  const days     = daysInMonth(currentYear, currentMonth);
  const holidays = getHolidayDays(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);

  // ── Hesaplamalar ──
  const hourLoad    = {};
  const weekendLoad = {};
  const offLoad     = {};

  nurses.forEach(n => {
    hourLoad[n] = 0; weekendLoad[n] = 0; offLoad[n] = 0;
    for (let d = 1; d <= days; d++) {
      const s   = monthSch[n]?.[d] || 'empty';
      const dow = getDayOfWeek(currentYear, currentMonth, d);
      const isWe  = dow === 0 || dow === 6;
      const isHol = holidays.has(d) && !isWe;
      const active = isWe || isHol;

      hourLoad[n] += SHIFT_HOURS[s];

      if (active && (s === 'day' || s === 'night' || s === 'daynight')) weekendLoad[n]++;
      if (!s || s === 'empty' || s === 'off') offLoad[n]++;
    }
  });

  // ── Kural 1: Mesai eşitliği ──
  const TARGET = 160;
  const mesaiNurses  = nurses.filter(n => hourLoad[n] > TARGET);
  const mesaiFraction = mesaiNurses.length / nurses.length;
  const mesaiTriggered = mesaiFraction >= 0.3;

  let card1Class, card1Verdict, card1Detail;
  if (!mesaiTriggered) {
    card1Class   = 'tc-pass';
    card1Verdict = '✅ Mesai yok';
    card1Detail  = `Takımın ${Math.round(mesaiFraction*100)}%'i mesai yapıyor (&lt;30% — kural aktif değil).`;
  } else {
    const noMesai = nurses.filter(n => hourLoad[n] <= TARGET);
    const mesaiVals = mesaiNurses.map(n => hourLoad[n]);
    const spread = Math.max(...mesaiVals) - Math.min(...mesaiVals);
    const allHaveMesai = noMesai.length === 0;
    const spreadOk = spread <= 8;
    card1Class   = (allHaveMesai && spreadOk) ? 'tc-pass' : 'tc-fail';
    card1Verdict = (allHaveMesai && spreadOk) ? '✅ GEÇTİ' : '❌ BAŞARISIZ';
    card1Detail  = `Takımın ${Math.round(mesaiFraction*100)}%'i mesai yapıyor (≥30% — kural aktif).<br>` +
      (allHaveMesai ? '' : `<b style="color:#f87171">Mesaisiz: ${noMesai.join(', ')}</b><br>`) +
      `Mesai farkı: <b>${spread}s</b> (tolerans ≤8s)`;
  }

  // ── Kural 2: Haftasonu eşitliği ──
  const weVals   = nurses.map(n => weekendLoad[n]);
  const weMax    = Math.max(...weVals), weMin = Math.min(...weVals);
  const weSpread = weMax - weMin;
  const card2Class   = weSpread <= 1 ? 'tc-pass' : weSpread <= 2 ? 'tc-warn' : 'tc-fail';
  const card2Verdict = weSpread <= 1 ? '✅ GEÇTİ' : weSpread <= 2 ? '⚠️ UYARI' : '❌ BAŞARISIZ';
  const weAvg    = (weVals.reduce((a,b)=>a+b,0)/nurses.length).toFixed(1);
  const card2Detail  = `Min: ${weMin} · Max: ${weMax} · Ort: ${weAvg} · Fark: <b>${weSpread}</b> (tolerans ≤1)`;

  // ── Kural 3: Boş gün eşitliği ──
  const offVals   = nurses.map(n => offLoad[n]);
  const offMax    = Math.max(...offVals), offMin = Math.min(...offVals);
  const offSpread = offMax - offMin;
  const card3Class   = offSpread <= 1 ? 'tc-pass' : offSpread <= 2 ? 'tc-warn' : 'tc-fail';
  const card3Verdict = offSpread <= 1 ? '✅ GEÇTİ' : offSpread <= 2 ? '⚠️ UYARI' : '❌ BAŞARISIZ';
  const offAvg    = (offVals.reduce((a,b)=>a+b,0)/nurses.length).toFixed(1);
  const card3Detail  = `Min: ${offMin} · Max: ${offMax} · Ort: ${offAvg} · Fark: <b>${offSpread}</b> (tolerans ≤1)`;

  // ── Bar yardımcısı ──
  function bars(loadMap, unit, tol) {
    const vals  = nurses.map(n => loadMap[n]);
    const avg   = vals.reduce((a,b)=>a+b,0)/vals.length;
    const maxV  = Math.max(...vals, 1);
    return nurses.map(n => {
      const v   = loadMap[n];
      const d   = v - avg;
      const pct = Math.round((v / maxV) * 100);
      const bCls = Math.abs(d) <= tol ? 'tb-ok' : d > 0 ? 'tb-over' : 'tb-under';
      const dCls = Math.abs(d) <= tol ? 'td-ok' : d > 0 ? 'td-pos' : 'td-neg';
      const sign = d > 0 ? '+' : '';
      return `<div class="test-bar-row">
        <span class="test-bar-name" title="${n}">${n}</span>
        <div class="test-bar-track"><div class="test-bar-fill ${bCls}" style="width:${pct}%"></div></div>
        <span class="test-bar-val">${v}${unit}</span>
        <span class="test-bar-delta ${dCls}">${sign}${d.toFixed(0)}</span>
      </div>`;
    }).join('');
  }

  panel.innerHTML = `
    <div class="test-panel-header">
      <span class="test-panel-title">🧪 Test Paneli</span>
      <span class="test-panel-badge">GELİŞTİRME MODU</span>
    </div>
    <div class="test-checks">

      <div class="test-card ${card1Class}">
        <div class="test-card-label">1 · Mesai Saati Eşitliği</div>
        <div class="test-card-verdict">${card1Verdict}</div>
        <div class="test-card-detail">${card1Detail}</div>
        <div class="test-bar-list">${bars(hourLoad, 's', 8)}</div>
      </div>

      <div class="test-card ${card2Class}">
        <div class="test-card-label">2 · Haftasonu Gün Eşitliği</div>
        <div class="test-card-verdict">${card2Verdict}</div>
        <div class="test-card-detail">${card2Detail}</div>
        <div class="test-bar-list">${bars(weekendLoad, 'g', 1)}</div>
      </div>

      <div class="test-card ${card3Class}">
        <div class="test-card-label">3 · Boş Gün Eşitliği</div>
        <div class="test-card-verdict">${card3Verdict}</div>
        <div class="test-card-detail">${card3Detail}</div>
        <div class="test-bar-list">${bars(offLoad, 'g', 1)}</div>
      </div>

    </div>`;
}

// ─── Cycle shift on cell click ────────────────────────────────────────────────
// ─── Shift Dropdown ───────────────────────────────────────────────────────────

let _activeDropdown = null;

function cycleShift(nurseEncoded, day, td) {
  // Aynı hücreye tekrar tıklanınca kapat
  if (_activeDropdown && _activeDropdown.cell === td) {
    closeShiftDropdown();
    return;
  }
  closeShiftDropdown();
  openShiftDropdown(nurseEncoded, day, td);
}

function openShiftDropdown(nurseEncoded, day, td) {
  const name = decodeName(nurseEncoded);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  const current = monthSch[name]?.[day] || 'empty';

  const menu = document.createElement('div');
  menu.className = 'shift-dropdown';
  menu.setAttribute('role', 'menu');

  SHIFT_MENU.forEach(({ state, label, desc }) => {
    const item = document.createElement('button');
    const isClear = state === 'empty';
    item.className = 'shift-dropdown-item' +
      (state === current ? ' active' : '') +
      (isClear ? ' clear-item' : '');
    item.setAttribute('role', 'menuitem');
    item.innerHTML =
      `<span class="cell-inner ${state}">${isClear ? '' : label}</span>` +
      `<span class="shift-dropdown-desc">${desc}</span>`;
    item.onclick = (e) => {
      e.stopPropagation();
      applyShift(name, nurseEncoded, day, td, state);
      closeShiftDropdown();
    };
    menu.appendChild(item);
  });

  // Portal: body'e ekle, tablo layout'unu bozmaz
  document.body.appendChild(menu);

  // Hücrenin viewport konumuna göre fixed pozisyon hesapla
  positionDropdown(menu, td);

  // Tablo scroll'u veya resize'da pozisyonu güncelle
  const tableWrapper = document.querySelector('.table-wrapper') || document.querySelector('.main-content');
  const onScroll = () => positionDropdown(menu, td);
  tableWrapper?.addEventListener('scroll', onScroll);
  window.addEventListener('resize', onScroll);

  _activeDropdown = { cell: td, menu, onScroll, tableWrapper };
}

function positionDropdown(menu, anchor) {
  const MENU_W = 185;
  const GAP = 6;
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Önce boyutu ölç
  menu.style.visibility = 'hidden';
  menu.style.top = '-9999px';
  menu.style.left = '-9999px';
  const mh = menu.offsetHeight || 210;

  // Yatay: hücrenin ortası, sağa taşarsa sola yasla
  let left = rect.left + rect.width / 2 - MENU_W / 2;
  if (left + MENU_W > vw - 8) left = vw - MENU_W - 8;
  if (left < 8) left = 8;

  // Dikey: önce aşağı dene, sığmazsa yukarı
  let top = rect.bottom + GAP;
  if (top + mh > vh - 8) top = rect.top - mh - GAP;

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.style.width = MENU_W + 'px';
  menu.style.visibility = '';
}

function applyShift(name, nurseEncoded, day, td, state) {
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  if (!monthSch[name]) monthSch[name] = {};
  monthSch[name][day] = state;
  saveStorage();

  const inner = td.querySelector('.cell-inner');
  inner.className = `cell-inner ${state}`;
  inner.textContent = SHIFT_LABELS[state];

  updateRowTotal(name, nurseEncoded);
  renderStats();
}

function closeShiftDropdown() {
  if (!_activeDropdown) return;
  const { menu, onScroll, tableWrapper } = _activeDropdown;
  tableWrapper?.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
  menu.remove();
  _activeDropdown = null;
}

// Dışarı tıklayınca kapat
document.addEventListener('click', (e) => {
  if (_activeDropdown && !_activeDropdown.cell.contains(e.target) && !_activeDropdown.menu.contains(e.target)) {
    closeShiftDropdown();
  }
});
// Escape tuşu ile kapat
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeShiftDropdown();
});

const MONTHLY_TARGET = 160;

function calcNurseStats(name, year, month) {
  const days = daysInMonth(year, month);
  const monthSch = getMonthSchedule(year, month);
  let hours = 0, leaveCount = 0;
  for (let d = 1; d <= days; d++) {
    const s = monthSch[name]?.[d] || 'empty';
    hours += SHIFT_HOURS[s];
    if (s === 'leave') leaveCount++;
  }
  const target = MONTHLY_TARGET - leaveCount * 8;
  return { hours, leaveCount, target };
}

function totalBadgeHTML(hours) {
  return `<span class="hours">${hours}s</span>`;
}

function targetBadgeHTML(target, leaveCount) {
  const note = leaveCount > 0
    ? `<span class="target-leave">${leaveCount}×Sİ</span>`
    : '';
  return `<span class="target-hours">${target}s</span>${note}`;
}

function mesaiBadgeHTML(hours, target) {
  const diff = hours - target;
  if (diff > 0) return `<span class="mesai-pos">+${diff}s</span>`;
  if (diff < 0) return `<span class="mesai-neg">${diff}s</span>`;
  return `<span class="mesai-zero">—</span>`;
}

function updateRowTotal(name, nurseKey) {
  const { hours, leaveCount, target } = calcNurseStats(name, currentYear, currentMonth);
  const totalEl = document.getElementById(`total-${nurseKey}`);
  const targetEl = document.getElementById(`target-${nurseKey}`);
  const mesaiEl = document.getElementById(`mesai-${nurseKey}`);
  if (totalEl) totalEl.innerHTML = totalBadgeHTML(hours);
  if (targetEl) targetEl.innerHTML = targetBadgeHTML(target, leaveCount);
  if (mesaiEl) mesaiEl.innerHTML = mesaiBadgeHTML(hours, target);
}

// ─── Auto Schedule ────────────────────────────────────────────────────────────

function openAutoModal() {
  document.getElementById('autoMonthLabel').textContent =
    `${TR_MONTHS[currentMonth]} ${currentYear}`;
  updateAutoPreview();

  ['autoMinDay', 'autoMinNight', 'autoMinDayWe', 'autoMinNightWe'].forEach(id => {
    document.getElementById(id).oninput = updateAutoPreview;
  });

  document.getElementById('autoModal').classList.add('open');
}

function closeAutoModal() {
  document.getElementById('autoModal').classList.remove('open');
}

function updateAutoPreview() {
  const minDay = Math.max(1, parseInt(document.getElementById('autoMinDay').value) || 2);
  const minNight = Math.max(1, parseInt(document.getElementById('autoMinNight').value) || 2);
  const minDayWe = Math.max(1, parseInt(document.getElementById('autoMinDayWe').value) || 1);
  const minNightWe = Math.max(1, parseInt(document.getElementById('autoMinNightWe').value) || 1);
  const total = storage.nurses.length;
  const days = daysInMonth(currentYear, currentMonth);
  const holidays = getHolidayDays(currentYear, currentMonth);

  const maxPerDay = Math.max(minDay + minNight, minDayWe + minNightWe);
  const preview = document.getElementById('autoPreview');

  if (total < maxPerDay) {
    preview.style.background = 'rgba(239,68,68,0.08)';
    preview.style.borderColor = 'rgba(239,68,68,0.3)';
    preview.style.color = '#DC2626';
    preview.innerHTML = `❌ Yeterli hemşire yok! En kalabalık gün için <strong>${maxPerDay}</strong> hemşire gerekiyor, listede <strong>${total}</strong> hemşire var.`;
    document.getElementById('btn-run-auto').disabled = true;
    document.getElementById('btn-run-auto').style.opacity = '0.4';
    return;
  }

  // Toplam tahmini vardiya sayısı
  let needed = 0;
  for (let d = 1; d <= days; d++) {
    const dow = getDayOfWeek(currentYear, currentMonth, d);
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidays.has(d) && !isWeekend;
    needed += (isWeekend || isHoliday) ? (minDayWe + minNightWe) : (minDay + minNight);
  }
  const perNurse = total > 0 ? Math.round(needed / total) : 0;
  const perNurseHours = perNurse * 12;

  preview.style.background = 'rgba(59,130,246,0.08)';
  preview.style.borderColor = 'rgba(59,130,246,0.2)';
  preview.style.color = 'var(--text-secondary)';
  preview.innerHTML =
    `📋 <strong style="color:var(--text-primary)">${days} günlük</strong> çizelge<br>` +
    `📅 Hafta içi: <strong style="color:var(--shift-day-text)">${minDay}G</strong> + <strong style="color:var(--shift-night-text)">${minNight}N</strong> · ` +
    `Haftasonu/Tatil: <strong style="color:var(--shift-day-text)">${minDayWe}G</strong> + <strong style="color:var(--shift-night-text)">${minNightWe}N</strong><br>` +
    `👩‍⚕️ Hemşire başı tahminen <strong style="color:var(--text-primary)">~${perNurse} vardiya</strong> · ` +
    `<strong style="color:var(--brand-cta)">~${perNurseHours} saat/ay</strong>`;
  document.getElementById('btn-run-auto').disabled = false;
  document.getElementById('btn-run-auto').style.opacity = '';
}

// ─── Saf algoritma: storage'a dokunmaz, snapshot üzerinde çalışır ────────────

/**
 * Verilen snapshot'tan başlayarak tek bir çizelge üretir.
 * Storage'a yazmaz; yeni sch nesnesi döndürür.
 */
function _buildScheduleFromSnapshot(snapshot, nurses, year, month, minDay, minNight, minDayWe, minNightWe) {
  const days     = daysInMonth(year, month);
  const holidays = getHolidayDays(year, month);

  // Snapshot'ın derin kopyasını al — her denemede aynı başlangıçtan yola çık
  const sch = {};
  nurses.forEach(n => { sch[n] = { ...(snapshot[n] || {}) }; });

  const hourLoad = {};
  nurses.forEach(n => {
    hourLoad[n] = 0;
    for (let d = 1; d <= days; d++) hourLoad[n] += SHIFT_HOURS[sch[n][d] || 'empty'];
  });

  const weekendLoad = {};
  nurses.forEach(n => {
    weekendLoad[n] = 0;
    for (let d = 1; d <= days; d++) {
      const dow = getDayOfWeek(year, month, d);
      const isWe = dow === 0 || dow === 6;
      const s = sch[n][d];
      if (isWe && (s === 'day' || s === 'night' || s === 'daynight')) weekendLoad[n]++;
    }
  });

  function restDaysAfterDayStreak(nurse, day) {
    let rest = 0;
    for (let i = day - 1; i >= 1; i--) {
      const s = sch[nurse][i];
      if (s === 'empty' || s === 'off' || s === undefined) rest++;
      else if (s === 'day') return rest;
      else return 0;
    }
    return 0;
  }

  function isAvailable(nurse, day, shiftType) {
    const current = sch[nurse][day];
    if (current !== 'empty' && current !== undefined) return false;
    const prev = sch[nurse][day - 1];
    if (prev === 'night' || prev === 'daynight') return false;
    if (shiftType === 'day' && prev === 'day') {
      let streak = 1;
      for (let i = day - 2; i >= 1; i--) {
        if (sch[nurse][i] === 'day') streak++;
        else break;
      }
      if (streak >= 2) return false;
    }
    return true;
  }

  const sortForShift = (pool, shiftType, isWeekendDay, day) =>
    [...pool].sort((a, b) => {
      const restBonusA = restDaysAfterDayStreak(a, day) >= 3 ? -4 : 0;
      const restBonusB = restDaysAfterDayStreak(b, day) >= 3 ? -4 : 0;
      const weBonusA = isWeekendDay ? weekendLoad[a] * 2 : 0;
      const weBonusB = isWeekendDay ? weekendLoad[b] * 2 : 0;
      const sa = prefScore(a, shiftType) + (hourLoad[a] / 8) * 2 + restBonusA + weBonusA + Math.random() * 1.5;
      const sb = prefScore(b, shiftType) + (hourLoad[b] / 8) * 2 + restBonusB + weBonusB + Math.random() * 1.5;
      return sa - sb;
    });

  let skipped = 0;

  for (let d = 1; d <= days; d++) {
    const dow      = getDayOfWeek(year, month, d);
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidays.has(d) && !isWeekend;
    const useWe    = isWeekend || isHoliday;
    const needDay   = useWe ? minDayWe  : minDay;
    const needNight = useWe ? minNightWe : minNight;

    const dayPool     = sortForShift(nurses.filter(n => isAvailable(n, d, 'day')), 'day', useWe, d);
    const dayAssigned = dayPool.slice(0, needDay);
    if (dayAssigned.length < needDay) { skipped++; continue; }

    const daySet      = new Set(dayAssigned);
    const nightPool   = sortForShift(nurses.filter(n => isAvailable(n, d, 'night') && !daySet.has(n)), 'night', useWe, d);
    const nightAssigned = nightPool.slice(0, needNight);
    if (nightAssigned.length < needNight) { skipped++; continue; }

    dayAssigned.forEach(n => { sch[n][d] = 'day';   hourLoad[n] += 8;  if (useWe) weekendLoad[n]++; });
    nightAssigned.forEach(n => { sch[n][d] = 'night'; hourLoad[n] += 16; if (useWe) weekendLoad[n]++; });
  }

  return { sch, hourLoad, weekendLoad, skipped };
}

/**
 * Üretilen çizelgeyi 3 kural açısından değerlendirir.
 * Döndürülen her test: { pass: bool, warn: bool, label, detail, spread }
 * passCount: 0–3 (kaç test geçti)
 */
function _evaluateSchedule(sch, nurses, year, month) {
  const days     = daysInMonth(year, month);
  const holidays = getHolidayDays(year, month);
  const TARGET   = 160;

  const hourLoad    = {};
  const weekendLoad = {};
  const offLoad     = {};

  nurses.forEach(n => {
    hourLoad[n] = 0; weekendLoad[n] = 0; offLoad[n] = 0;
    for (let d = 1; d <= days; d++) {
      const s   = sch[n][d] || 'empty';
      const dow = getDayOfWeek(year, month, d);
      const isWe  = dow === 0 || dow === 6;
      const isHol = holidays.has(d) && !isWe;
      hourLoad[n]    += SHIFT_HOURS[s];
      if ((isWe || isHol) && (s === 'day' || s === 'night' || s === 'daynight')) weekendLoad[n]++;
      if (s === 'empty' || s === 'off') offLoad[n]++;
    }
  });

  // Kural 1: Mesai eşitliği
  const mesaiNurses   = nurses.filter(n => hourLoad[n] > TARGET);
  const mesaiFraction = mesaiNurses.length / nurses.length;
  const mesaiActive   = mesaiFraction >= 0.3;
  let t1pass = true, t1warn = false;
  let t1spread = 0, t1detail = '';
  if (mesaiActive) {
    const noMesai  = nurses.filter(n => hourLoad[n] <= TARGET);
    const mVals    = mesaiNurses.map(n => hourLoad[n]);
    t1spread       = mVals.length > 1 ? Math.max(...mVals) - Math.min(...mVals) : 0;
    t1pass         = noMesai.length === 0 && t1spread <= 8;
    t1warn         = !t1pass && noMesai.length === 0 && t1spread <= 16;
    t1detail       = mesaiActive
      ? `${Math.round(mesaiFraction * 100)}% mesai · fark ${t1spread}s` +
        (noMesai.length ? ` · mesaisiz: ${noMesai.join(', ')}` : '')
      : `${Math.round(mesaiFraction * 100)}% mesai (kural aktif değil)`;
  } else {
    t1detail = `${Math.round(mesaiFraction * 100)}% mesai (<30%, kural aktif değil)`;
  }

  // Kural 2: Haftasonu eşitliği
  const weVals   = nurses.map(n => weekendLoad[n]);
  const weSpread = Math.max(...weVals) - Math.min(...weVals);
  const t2pass   = weSpread <= 1;
  const t2warn   = weSpread === 2;
  const t2detail = `Min ${Math.min(...weVals)} – Max ${Math.max(...weVals)} · fark ${weSpread}g`;

  // Kural 3: Boş gün eşitliği
  const offVals   = nurses.map(n => offLoad[n]);
  const offSpread = Math.max(...offVals) - Math.min(...offVals);
  const t3pass    = offSpread <= 1;
  const t3warn    = offSpread === 2;
  const t3detail  = `Min ${Math.min(...offVals)} – Max ${Math.max(...offVals)} · fark ${offSpread}g`;

  const passCount = (t1pass ? 1 : 0) + (t2pass ? 1 : 0) + (t3pass ? 1 : 0);
  const warnCount = (t1warn ? 1 : 0) + (t2warn ? 1 : 0) + (t3warn ? 1 : 0);

  return {
    t1: { pass: t1pass, warn: t1warn, detail: t1detail, label: 'Mesai Saati', spread: t1spread },
    t2: { pass: t2pass, warn: t2warn, detail: t2detail, label: 'Haftasonu', spread: weSpread },
    t3: { pass: t3pass, warn: t3warn, detail: t3detail, label: 'Boş Gün', spread: offSpread },
    passCount,
    warnCount,
    score: passCount * 10 + warnCount,  // sıralama skoru: önce passCount, sonra warnCount
  };
}

/**
 * Otomatik çizelge algoritması
 *
 * Kurallar (bkz. ÇizelgeKuralları.md):
 *   1. Sadece 'empty' hücreler doldurulur; Sİ, B ve manuel atamalar korunur.
 *   2. Gece (N) çalışan hemşire ertesi gün aktif vardiyaya (D/N/D+N) atanamaz.
 *   3. Ardışık 2+ gündüz sonrası en az 1 gün mola zorunlu.
 *   4. Hafta içi ve haftasonu/tatil için ayrı minimum kadro uygulanır.
 *   5. Yük dengesi: az vardiyası olan önce seçilir.
 *   6. Tercih puanı: tercih eşleşmesi skoru düşürür, ters tercih skoru artırır.
 *
 * Retry mantığı:
 *   Tüm testler başarısız olduğunda en fazla MAX_AUTO_RETRIES kez yeniden dener.
 *   En az 1 test geçen ilk sonucu uygular.
 *   Başarısız denemeler popup'ta gösterilir.
 */
const MAX_AUTO_RETRIES = 20;

function runAutoSchedule() {
  const minDay    = Math.max(1, parseInt(document.getElementById('autoMinDay').value) || 2);
  const minNight  = Math.max(1, parseInt(document.getElementById('autoMinNight').value) || 2);
  const minDayWe  = Math.max(1, parseInt(document.getElementById('autoMinDayWe').value) || 1);
  const minNightWe = Math.max(1, parseInt(document.getElementById('autoMinNightWe').value) || 1);

  const nurses    = [...storage.nurses];
  const maxPerDay = Math.max(minDay + minNight, minDayWe + minNightWe);
  if (nurses.length < maxPerDay) {
    showToast('❌', 'Yeterli hemşire yok!');
    return;
  }

  const mk = monthKey(currentYear, currentMonth);
  if (!storage.schedule[mk]) storage.schedule[mk] = {};

  // Mevcut ayın snapshot'ını al — her deneme bu noktadan başlar
  const snapshot = {};
  nurses.forEach(n => { snapshot[n] = { ...(storage.schedule[mk][n] || {}) }; });

  const failedAttempts = [];  // tamamen başarısız denemeler
  let bestResult = null;      // en yüksek skora sahip deneme
  let bestScore  = -1;

  for (let attempt = 1; attempt <= MAX_AUTO_RETRIES; attempt++) {
    const { sch, skipped } = _buildScheduleFromSnapshot(
      snapshot, nurses, currentYear, currentMonth,
      minDay, minNight, minDayWe, minNightWe
    );
    const evaluation = _evaluateSchedule(sch, nurses, currentYear, currentMonth);

    // En az 1 test geçti mi?
    if (evaluation.passCount >= 1) {
      // Bu denemeyi uygula ve döngüyü bitir
      nurses.forEach(n => { storage.schedule[mk][n] = sch[n]; });
      saveStorage();
      closeAutoModal();
      renderAll();

      const label = `${TR_MONTHS[currentMonth]} ${currentYear}`;
      const passIcons = [evaluation.t1, evaluation.t2, evaluation.t3].map(t => t.pass ? '✅' : t.warn ? '⚠️' : '❌').join(' ');
      showToast('🎲', `${label} oluşturuldu (${attempt}. deneme) ${passIcons}`);

      if (failedAttempts.length > 0) {
        openFailedAttemptsModal(failedAttempts, attempt);
      }
      return;
    }

    // Bu deneme tamamen başarısız — geçmişe ekle
    const attemptScore = evaluation.score;
    failedAttempts.push({ attempt, evaluation, skipped });

    if (attemptScore > bestScore) {
      bestScore  = attemptScore;
      bestResult = { attempt, sch, evaluation, skipped };
    }
  }

  // MAX_RETRIES sonunda hiç geçemeyen durum — en iyisini uygula
  if (bestResult) {
    nurses.forEach(n => { storage.schedule[mk][n] = bestResult.sch[n]; });
  }
  saveStorage();
  closeAutoModal();
  renderAll();

  showToast('⚠️', `${MAX_AUTO_RETRIES} denemede tüm testler başarısız — en iyi seçildi`);
  if (failedAttempts.length > 0) {
    openFailedAttemptsModal(failedAttempts, null);
  }
}

// ─── Başarısız Alternatifler Modal ───────────────────────────────────────────

function openFailedAttemptsModal(attempts, winningAttempt) {
  const body = document.getElementById('failedAttemptsBody');
  const note = document.getElementById('failedAttemptsFooterNote');

  if (winningAttempt) {
    note.textContent = `${attempts.length} başarısız denemenin ardından ${winningAttempt}. denemede en az 1 test geçildi.`;
  } else {
    note.textContent = `${attempts.length} denemede hiçbir test geçilemedi. En yüksek skorlu sonuç uygulandı.`;
  }

  const testIcon = (t) => t.pass ? '✅' : t.warn ? '⚠️' : '❌';
  const spreadColor = (pass, warn) => pass ? '#4ade80' : warn ? '#fbbf24' : '#f87171';

  body.innerHTML = attempts.map(({ attempt, evaluation: ev, skipped }) => {
    const { t1, t2, t3 } = ev;
    return `
      <div style="
        margin: 8px 16px;
        padding: 12px 14px;
        border-radius: 8px;
        border: 1px solid var(--modal-divider);
        background: var(--surface, rgba(0,0,0,0.15));
      ">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="
            font-size:0.7em;font-weight:700;
            background:rgba(148,163,184,0.12);
            color:var(--text-muted);
            padding:2px 8px;border-radius:99px;
          ">#${attempt}. DENEME</span>
          ${skipped > 0 ? `<span style="font-size:0.7em;color:#f87171;">${skipped} gün atlandı</span>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="text-align:center;padding:8px;border-radius:6px;background:rgba(${t1.pass?'74,222,128':'248,113,113'},0.07);">
            <div style="font-size:1.1em;">${testIcon(t1)}</div>
            <div style="font-size:0.68em;font-weight:700;color:var(--text-muted);margin:2px 0;">Mesai Saati</div>
            <div style="font-size:0.72em;color:${spreadColor(t1.pass, t1.warn)};">${t1.detail}</div>
          </div>
          <div style="text-align:center;padding:8px;border-radius:6px;background:rgba(${t2.pass?'74,222,128':'248,113,113'},0.07);">
            <div style="font-size:1.1em;">${testIcon(t2)}</div>
            <div style="font-size:0.68em;font-weight:700;color:var(--text-muted);margin:2px 0;">Haftasonu</div>
            <div style="font-size:0.72em;color:${spreadColor(t2.pass, t2.warn)};">${t2.detail}</div>
          </div>
          <div style="text-align:center;padding:8px;border-radius:6px;background:rgba(${t3.pass?'74,222,128':'248,113,113'},0.07);">
            <div style="font-size:1.1em;">${testIcon(t3)}</div>
            <div style="font-size:0.68em;font-weight:700;color:var(--text-muted);margin:2px 0;">Boş Gün</div>
            <div style="font-size:0.72em;color:${spreadColor(t3.pass, t3.warn)};">${t3.detail}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('failedAttemptsModal').classList.add('open');
}

function closeFailedAttemptsModal() {
  document.getElementById('failedAttemptsModal').classList.remove('open');
}

// ─── Month navigation ─────────────────────────────────────────────────────────

function prevMonth() {
  if (currentMonth === 0) { currentMonth = 11; currentYear--; }
  else currentMonth--;
  renderAll();
}

function nextMonth() {
  if (currentMonth === 11) { currentMonth = 0; currentYear++; }
  else currentMonth++;
  renderAll();
}

// ─── Clear current month ──────────────────────────────────────────────────────
function clearAll() {
  const label = `${TR_MONTHS[currentMonth]} ${currentYear}`;
  showConfirm(
    `🗑️ ${label} Temizlensin mi?`,
    `${label} ayına ait tüm nöbet verileri silinecek. Bu işlem geri alınamaz.`,
    () => {
      const key = monthKey(currentYear, currentMonth);
      storage.schedule[key] = {};
      saveStorage();
      renderAll();
      showToast('🗑️', `${label} verileri temizlendi`);
    }
  );
}

// ─── Print Schedule ───────────────────────────────────────────────────────────
function printSchedule() {
  const monthName = TR_MONTHS[currentMonth];
  const year = currentYear;
  const days = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);

  let headerCells = `<th class="p-nurse">HEMŞİRE</th>`;
  const printHolidays = getHolidayDays(currentYear, currentMonth);

  for (let d = 1; d <= days; d++) {
    const dow = getDayOfWeek(currentYear, currentMonth, d);
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = printHolidays.has(d) && !isWeekend;
    const hCls = isHoliday ? 'holiday' : isWeekend ? 'weekend' : '';
    headerCells += `<th class="${hCls}">${d}<br><span class="dn">${TR_DAYS_SHORT[dow]}</span></th>`;
  }
  headerCells += `<th class="p-total">TOPLAM</th>`;
  headerCells += `<th class="p-target">HEDEF</th>`;
  headerCells += `<th class="p-mesai">MESAİ</th>`;

  let bodyRows = '';
  storage.nurses.forEach((name, ni) => {
    let hours = 0, pLeave = 0;
    let cells = `<td class="p-nurse-name">${name}</td>`;
    for (let d = 1; d <= days; d++) {
      const s = monthSch[name]?.[d] || 'empty';
      if (s !== 'empty') hours += SHIFT_HOURS[s];
      if (s === 'leave') pLeave++;
      const label = SHIFT_LABELS[s];
      const dow = getDayOfWeek(currentYear, currentMonth, d);
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = printHolidays.has(d) && !isWeekend;
      const colCls = isHoliday ? 'col-holiday' : isWeekend ? 'col-weekend' : '';
      const shiftCls = s !== 'empty' ? `cell-${s}` : '';
      cells += `<td class="${[colCls, shiftCls].filter(Boolean).join(' ')}">${label}</td>`;
    }
    const pTarget = MONTHLY_TARGET - pLeave * 8;
    const pMesai = hours - pTarget;
    const mesaiLabel = pMesai > 0 ? `+${pMesai}s` : pMesai < 0 ? `${pMesai}s` : '—';
    cells += `<td class="p-total-cell">${hours}s</td>`;
    cells += `<td class="p-target-cell">${pTarget}s${pLeave > 0 ? ` (${pLeave}Sİ)` : ''}</td>`;
    cells += `<td class="p-mesai-cell${pMesai > 0 ? ' p-mesai-pos' : pMesai < 0 ? ' p-mesai-neg' : ''}">${mesaiLabel}</td>`;
    const rowCls = ni % 2 === 1 ? 'alt' : '';
    bodyRows += `<tr class="${rowCls}">${cells}</tr>`;
  });

  const legendHTML = `
    <div class="legend">
      <span class="lchip day-chip">D</span> Gündüz 08:00–16:00 &nbsp;&nbsp;
      <span class="lchip night-chip">N</span> Gece 16:00–08:00 &nbsp;&nbsp;
      <span class="lchip dn-chip">D/N</span> 24 Saat 08:00–08:00 &nbsp;&nbsp;
      <span class="lchip weekend-chip">C/P</span> Hafta Sonu &nbsp;&nbsp;
      <span class="lchip holiday-chip">T</span> Resmi Tatil
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>${monthName} ${year} - Hemşire Nöbet Listesi</title>
<style>
  @page { size: A4 landscape; margin: 10mm 8mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8px;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    border-bottom: 2px solid #1e40af;
    padding-bottom: 4px;
  }
  .header h1 {
    font-size: 15px;
    font-weight: 800;
    color: #1e3a8a;
    letter-spacing: 0.5px;
  }
  .header .subtitle { font-size: 9px; color: #64748b; margin-top: 1px; }
  .header .hospital { font-size: 9px; color: #94a3b8; }
  .legend {
    font-size: 8px;
    color: #334155;
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .lchip {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 700;
    font-size: 7.5px;
  }
  .day-chip   { background:#fef3c7; color:#92400e; border:1px solid #f59e0b; }
  .night-chip { background:#ede9fe; color:#4c1d95; border:1px solid #8b5cf6; }
  .dn-chip    { background:#ccfbf1; color:#0f766e; border:1px solid #14b8a6; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  thead tr { background: #1e3a8a; color: #fff; }
  thead th {
    padding: 4px 1px;
    text-align: center;
    font-size: 7.5px;
    font-weight: 700;
    border: 0.5px solid #3b5998;
    line-height: 1.2;
  }
  thead th.p-nurse  { width: 68px; text-align: left; padding-left: 5px; }
  thead th.p-total  { width: 28px; background: #1e40af; }
  thead th.p-target { width: 26px; background: #334155; }
  thead th.p-mesai  { width: 26px; background: #7f1d1d; }
  thead th.weekend  { background: #831843; color: #fce7f3; }
  thead th.holiday  { background: #7c2d12; color: #ffedd5; }
  thead th .dn      { font-size: 6.5px; font-weight: 400; opacity: 0.8; display:block; }
  tbody td {
    text-align: center;
    padding: 3px 1px;
    border: 0.5px solid #cbd5e1;
    font-size: 8px;
    font-weight: 700;
    height: 22px;
    line-height: 1;
  }
  tbody tr.alt td { background: #f8fafc; }
  td.p-nurse-name {
    text-align: left;
    padding-left: 5px;
    font-size: 8px;
    font-weight: 600;
    color: #1e3a8a;
    background: #eff6ff !important;
    border-right: 1.5px solid #93c5fd;
    white-space: nowrap;
    overflow: hidden;
  }
  td.p-target-cell {
    background: #f1f5f9 !important;
    color: #475569;
    font-weight: 700;
    font-size: 8px;
    border-left: 1px solid #cbd5e1;
  }
  td.p-mesai-cell {
    background: #f8fafc !important;
    color: #94a3b8;
    font-weight: 700;
    font-size: 8px;
    border-left: 1px solid #cbd5e1;
  }
  td.p-mesai-pos { background: #fff1f2 !important; color: #dc2626; }
  td.p-mesai-neg { background: #f8fafc !important; color: #94a3b8; }
  td.p-total-cell {
    background: #dbeafe !important;
    color: #1d4ed8;
    font-weight: 800;
    font-size: 8.5px;
    border-left: 1.5px solid #93c5fd;
  }
  td.cell-day     { background: #fef3c7; color: #92400e; }
  td.cell-night   { background: #ede9fe; color: #4c1d95; }
  td.cell-daynight{ background: #ccfbf1; color: #0f766e; }
  td.cell-leave   { background: #fce7f3; color: #9d174d; }
  td.col-weekend  { background: #fdf2f8; }
  td.col-holiday  { background: #fff7ed; }
  td.col-weekend.cell-day     { background: #fde8ef; }
  td.col-weekend.cell-night   { background: #f3e8fd; }
  td.col-weekend.cell-daynight{ background: #e8fdf8; }
  td.col-weekend.cell-leave   { background: #fce7f3; }
  td.col-holiday.cell-day     { background: #fef0d0; }
  td.col-holiday.cell-night   { background: #ede9fe; }
  td.col-holiday.cell-daynight{ background: #ccfbf1; }
  td.col-holiday.cell-leave   { background: #fce7f3; }
  .weekend-chip { background:#fce7f3; color:#831843; border:1px solid #f9a8d4; }
  .holiday-chip { background:#ffedd5; color:#7c2d12; border:1px solid #fdba74; }
  .footer {
    margin-top: 6px;
    font-size: 7px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>🏥 ${monthName.toUpperCase()} ${year} — HEMŞİRE NÖBET LİSTESİ</h1>
    <div class="subtitle">Aylık Vardiya Çalışma Programı</div>
  </div>
  <div class="hospital">Çalışma Programı</div>
</div>
${legendHTML}
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer">
  <span>Yazdırma tarihi: ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
  <span>D = 8 saat &nbsp;|&nbsp; N = 16 saat &nbsp;|&nbsp; D/N = 24 saat</span>
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=1100,height=750');
  win.addEventListener('unload', () => URL.revokeObjectURL(url), { once: true });
}

// ─── Download as TXT ──────────────────────────────────────────────────────────
function downloadTxt() {
  const monthName = TR_MONTHS[currentMonth].toUpperCase();
  const year = currentYear;
  const days = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);

  let lines = [];
  lines.push(`---`);
  lines.push(``);
  lines.push(`# ${monthName} ${year} - Çalışma Programı`);
  lines.push(``);
  lines.push(`| Hemşire | Çalıştığı Günler ve Vardiyalar |`);
  lines.push(`|---------|-------------------------------|`);

  storage.nurses.forEach(name => {
    let shifts = [];
    for (let d = 1; d <= days; d++) {
      const s = monthSch[name]?.[d] || 'empty';
      if (s !== 'empty') shifts.push(`${d}(${SHIFT_LABELS[s]})`);
    }
    const shiftStr = shifts.length > 0 ? shifts.join(', ') : '—';
    lines.push(`| **${name}** | ${shiftStr} |`);
  });

  lines.push(``);
  lines.push(`---`);

  const content = lines.join('\n');
  const encoded = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  const a = document.createElement('a');
  a.href = encoded;
  a.download = `${TR_MONTHS[currentMonth]}_${year}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast('✅', `${TR_MONTHS[currentMonth]} ${year} dosyası indirildi`);
}

// ─── Import / Export Data ─────────────────────────────────────────────────────

async function exportData() {
  const mk = monthKey(currentYear, currentMonth);
  const monthData = storage.schedule[mk] || {};

  const payload = {
    type: 'nurse_monthly_export',
    schedule: monthData
  };

  const dataStr = JSON.stringify(payload, null, 2);

  try {
    // Modern Tarayıcılarda Klasör / Dosya Seçme Penceresi Aç (Save As)
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: `nobet_${mk}.json`,
        types: [{
          description: 'JSON Dosyası',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(dataStr);
      await writable.close();
      showToast('💾', `${TR_MONTHS[currentMonth]} ${currentYear} dışa aktarıldı`);
    } else {
      // Eski Tarayıcılar için Fallback
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nobet_${mk}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('💾', `${TR_MONTHS[currentMonth]} ${currentYear} dışa aktarıldı`);
    }
  } catch (err) {
    // Kullanıcı pencereyi iptal etmezse hatayı göster
    if (err.name !== 'AbortError') {
      showToast('❌', 'Dışa aktarma başarısız oldu!');
      console.error(err);
    }
  }
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.type === 'nurse_monthly_export' && parsed.schedule) {
        const label = `${TR_MONTHS[currentMonth]} ${currentYear}`;
        showConfirm(
          `📂 ${label} İçe Aktarılsın mı?`,
          `Dosyadaki tüm nöbetler o an ekranda açık olan <strong>${label}</strong> ayının üzerine yazılacak. Onaylıyor musunuz?`,
          () => {
            const mk = monthKey(currentYear, currentMonth);
            storage.schedule[mk] = parsed.schedule;

            // Eğer dosyada listede olmayan bir hemşire varsa onu ana hemşire listesine ekle
            Object.keys(parsed.schedule).forEach(nurse => {
              if (!storage.nurses.includes(nurse)) {
                storage.nurses.push(nurse);
              }
            });

            saveStorage();
            renderNurseList();
            renderAll();
            document.getElementById('importFile').value = ''; // Reset input
            showToast('📂', `${label} verileri başarıyla içe aktarıldı`);
          }
        );
      } else {
        showToast('❌', 'Geçersiz ay yedek dosyası!');
        document.getElementById('importFile').value = '';
      }
    } catch (err) {
      showToast('❌', 'Dosya okunamadı!');
      document.getElementById('importFile').value = '';
    }
  };
  reader.readAsText(file);
}

// ─── Nurse Manager Modal ──────────────────────────────────────────────────────
function openNurseModal() {
  renderNurseList();
  document.getElementById('nurseModal').classList.add('open');
}

function closeNurseModal() {
  document.getElementById('nurseModal').classList.remove('open');
}

function renderNurseList() {
  const list = document.getElementById('nurseListItems');
  list.innerHTML = storage.nurses.map((name, i) => {
    const pref = getPreference(name);
    const enc = escapeName(name);
    const avatarStyle =
      `background:linear-gradient(135deg,${AVATAR_COLORS[i % AVATAR_COLORS.length][0]},${AVATAR_COLORS[i % AVATAR_COLORS.length][1]});` +
      `width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;` +
      `font-size:11px;font-weight:700;flex-shrink:0;color:white;`;
    return `
    <div class="nurse-list-item" draggable="true" data-index="${i}"
         ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dropItem(event)">
      <span class="drag-handle">⠿</span>
      <span class="nurse-avatar" style="${avatarStyle}">${name.substring(0, 2).toUpperCase()}</span>
      <span class="nurse-item-name">${name}</span>
      <div class="pref-toggle" title="Vardiya Tercihi">
        <button class="pref-btn${pref === 'day-only'    ? ' pref-active-day-only'    : ''}" onclick="setPreference('${enc}','day-only')"    title="Sadece Gündüz">☀️☀️</button>
        <button class="pref-btn${pref === 'day-prefer'  ? ' pref-active-day-prefer'  : ''}" onclick="setPreference('${enc}','day-prefer')"  title="Çoğunlukla Gündüz">☀️</button>
        <button class="pref-btn${pref === 'any'         ? ' pref-active-any'         : ''}" onclick="setPreference('${enc}','any')"         title="Fark Etmez">⚖️</button>
        <button class="pref-btn${pref === 'night-prefer'? ' pref-active-night-prefer': ''}" onclick="setPreference('${enc}','night-prefer')" title="Çoğunlukla Gece">🌙</button>
        <button class="pref-btn${pref === 'night-only'  ? ' pref-active-night-only'  : ''}" onclick="setPreference('${enc}','night-only')"  title="Sadece Gece">🌙🌙</button>
      </div>
      <div class="nurse-item-actions">
        <button class="icon-btn" onclick="removeNurse(${i})" title="Sil">🗑️</button>
      </div>
    </div>`;
  }).join('');
}


function addNurse() {
  const input = document.getElementById('newNurseName');
  const name = input.value.trim();
  if (!name) return;
  if (storage.nurses.includes(name)) {
    showToast('⚠️', 'Bu isim zaten listede mevcut');
    return;
  }
  storage.nurses.push(name);
  saveStorage();
  input.value = '';
  renderNurseList();
  renderAll();
  showToast('✅', `${name} listeye eklendi`);
}

function removeNurse(index) {
  const name = storage.nurses[index];
  showConfirm(
    `🗑️ Hemşire Silinsin mi?`,
    `<strong>${name}</strong> hemşiresini listeden çıkarmak istediğinize emin misiniz?\nBu hemşireye ait tüm vardiya verileri de silinecek.`,
    () => {
      storage.nurses.splice(index, 1);
      // Tercih ve veriyi temizle
      if (storage.preferences) delete storage.preferences[name];
      Object.keys(storage.schedule).forEach(k => {
        delete storage.schedule[k][name];
      });
      saveStorage();
      renderNurseList();
      renderAll();
      showToast('🗑️', `${name} listeden çıkarıldı`);
    }
  );
}

// Drag & Drop reorder
let dragSrcIndex = null;

function dragStart(e) {
  dragSrcIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.add('dragging');
}

function dragOver(e) { e.preventDefault(); }

function dropItem(e) {
  e.preventDefault();
  const targetIndex = parseInt(e.currentTarget.dataset.index);
  if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
  const [moved] = storage.nurses.splice(dragSrcIndex, 1);
  storage.nurses.splice(targetIndex, 0, moved);
  saveStorage();
  renderNurseList();
  renderAll();
  dragSrcIndex = null;
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').innerHTML = message.replace(/\n/g, '<br>');
  confirmCallback = onConfirm;
  document.getElementById('confirmModal').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmModal').classList.remove('open');
  confirmCallback = null;
}

function doConfirm() {
  const cb = confirmCallback;
  closeConfirm();
  if (cb) cb();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimeout = null;
function showToast(icon, msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastIcon').textContent = icon;
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ─── Menu Modal ─────────────────────────────────────────────────────────────────
function openMenuModal() {
  document.getElementById('menuModal').classList.add('open');
}
function closeMenuModal() {
  document.getElementById('menuModal').classList.remove('open');
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

const THEME_KEY = 'nobet_theme';

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon = document.getElementById('themeToggleIcon');
  const label = document.getElementById('themeToggleLabel');
  if (!icon || !label) return;
  if (dark) {
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    label.textContent = 'Aydınlık Temaya Geç';
  } else {
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    label.textContent = 'Karanlık Temaya Geç';
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = !isDark;
  localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  applyTheme(next);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'dark');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // Enter tuşu ile hemşire ekleme
  document.getElementById('newNurseName').addEventListener('keydown', e => {
    if (e.key === 'Enter') addNurse();
  });

  // Modallarda backdrop'a tıklayınca kapat
  document.getElementById('nurseModal').addEventListener('click', function (e) {
    if (e.target === this) closeNurseModal();
  });
  document.getElementById('confirmModal').addEventListener('click', function (e) {
    if (e.target === this) closeConfirm();
  });
  document.getElementById('autoModal').addEventListener('click', function (e) {
    if (e.target === this) closeAutoModal();
  });
  document.getElementById('menuModal').addEventListener('click', function (e) {
    if (e.target === this) closeMenuModal();
  });


  // Görünüm toggle butonunu başlat
  const toggleBtn = document.getElementById('viewToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = '📊';
    toggleBtn.title = 'Tablo Görünümüne Geç';
  }

  // İlk mobil durumunu kaydet; ekran boyutu/yönü değişince yeniden render
  _prevIsMobile = isMobile();
  window.addEventListener('resize', debounce(() => {
    const nowMobile = isMobile();
    if (nowMobile !== _prevIsMobile) {
      _prevIsMobile = nowMobile;
      renderTable();
    }
  }, 250));

  renderAll();
});
