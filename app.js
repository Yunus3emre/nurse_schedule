// ─── Constants ────────────────────────────────────────────────────────────────
const SHIFT_STATES = ['empty', 'day', 'night', 'daynight', 'off', 'leave'];
const SHIFT_LABELS = { empty: '', day: 'D', night: 'N', daynight: 'D/N', off: 'B', leave: 'Sİ' };
const SHIFT_HOURS  = { empty: 0,  day: 8,  night: 16,  daynight: 24,  off: 0,  leave: 0 };

const SHIFT_MENU = [
  { state: 'day',      label: 'D',   desc: 'Gündüz'        },
  { state: 'night',    label: 'N',   desc: 'Gece'          },
  { state: 'daynight', label: 'D/N', desc: 'Gündüz / Gece' },
  { state: 'off',      label: 'B',   desc: 'Boş (İstekli)' },
  { state: 'leave',    label: 'Sİ',  desc: 'Senelik İzin'  },
  { state: 'empty',    label: '—',   desc: 'Temizle'       },
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
  2024: [[3,10],[3,11],[3,12],[5,16],[5,17],[5,18],[5,19]],
  2025: [[2,30],[2,31],[3,1],[5,6],[5,7],[5,8],[5,9]],
  2026: [[2,20],[2,21],[2,22],[4,27],[4,28],[4,29],[4,30]],
  2027: [[2,9],[2,10],[2,11],[4,16],[4,17],[4,18],[4,19]],
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

let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed

let mobileViewMode = 'card'; // 'card' | 'table'
let _prevIsMobile  = null;

// ─── Storage helpers ──────────────────────────────────────────────────────────
function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.nurses)      parsed.nurses      = [...DEFAULT_NURSES];
      if (!parsed.schedule)    parsed.schedule    = {};
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
/** Hemsşirenin vardiya tercihini döndürür: 'day' | 'night' | 'any' */
function getPreference(name) {
  return (storage.preferences && storage.preferences[name]) || 'any';
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
 *   - Tercih eşleşiyorsa: -4 (güvenilir öncelik)
 *   - Fark etmez ('any'):    0
 *   - Karşı tercih:        +5 (son seçenek)
 */
function prefScore(name, shiftType) {
  const p = getPreference(name);
  if (p === shiftType) return -4;
  if (p === 'any')     return  0;
  return 5;
}

// ─── Mobile helpers ───────────────────────────────────────────────────────────
function isMobile() { return window.innerWidth < 768; }

function debounce(fn, delay) {
  let timer;
  return function(...args) {
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
}

function renderHeader() {
  const monthName = TR_MONTHS[currentMonth];
  const year      = currentYear;
  document.getElementById('monthName').textContent = monthName;
  document.getElementById('yearName').textContent  = year;
  // Mobil floating bar'a da yansıt
  const mobMonth = document.getElementById('mobMonthName');
  const mobYear  = document.getElementById('mobYearName');
  if (mobMonth) mobMonth.textContent = monthName;
  if (mobYear)  mobYear.textContent  = year;
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
  document.getElementById('mobileView').style.display  = 'none';

  const days     = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  const thead    = document.getElementById('tableThead');
  const tbody    = document.getElementById('tableTbody');

  // ── Header row ──
  const holidays = getHolidayDays(currentYear, currentMonth);

  let headerHTML = `<tr>
    <th class="nurse-col-header">Hemşire</th>`;

  for (let d = 1; d <= 31; d++) {
    if (d <= days) {
      const dow        = getDayOfWeek(currentYear, currentMonth, d);
      const isWeekend  = dow === 0 || dow === 6;
      const isHoliday  = holidays.has(d) && !isWeekend;
      const cls = isHoliday ? ' holiday' : isWeekend ? ' weekend' : '';
      headerHTML += `<th class="day-header${cls}">
        <span class="day-num">${d}</span>
        <span class="day-name">${TR_DAYS_SHORT[dow]}</span>
      </th>`;
    } else {
      headerHTML += `<th class="day-header" style="opacity:0.2"><span class="day-num">-</span></th>`;
    }
  }
  headerHTML += `<th class="nurse-col-header" style="text-align:center;min-width:60px;right:0;position:sticky;border-left:2px solid var(--border-light)">Toplam</th></tr>`;
  thead.innerHTML = headerHTML;

  // ── Body rows ──
  let bodyHTML = '';
  storage.nurses.forEach((name, ni) => {
    const colors   = AVATAR_COLORS[ni % AVATAR_COLORS.length];
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

    let shiftHours = 0;
    for (let d = 1; d <= 31; d++) {
      if (d <= days) {
        const shift = monthSch[name][d] || 'empty';
        if (shift !== 'empty') shiftHours += SHIFT_HOURS[shift];
        const dow       = getDayOfWeek(currentYear, currentMonth, d);
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = holidays.has(d) && !isWeekend;
        const colCls    = isHoliday ? ' holiday-col' : isWeekend ? ' weekend-col' : '';
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

    bodyHTML += `<td class="row-total">
      <div class="total-badge" id="total-${nurseKey}">
        <span class="hours">${shiftHours}s</span>
      </div>
    </td></tr>`;
  });

  tbody.innerHTML = bodyHTML;
}

/** Mobil: her hemşire için haftalık kart satırları */
function renderTableMobile() {
  document.getElementById('desktopView').style.display = 'none';
  document.getElementById('mobileView').style.display  = 'flex';

  const days     = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  let html = '';

  storage.nurses.forEach((name, ni) => {
    const colors   = AVATAR_COLORS[ni % AVATAR_COLORS.length];
    const initials = name.substring(0, 2).toUpperCase();
    const nurseKey = escapeName(name);

    if (!monthSch[name]) monthSch[name] = {};

    // Toplam saat hesapla
    let shiftHours = 0;
    for (let d = 1; d <= days; d++) {
      shiftHours += SHIFT_HOURS[monthSch[name][d] || 'empty'];
    }

    html += `
    <div class="nurse-card">
      <div class="nurse-card-header">
        <div class="nurse-avatar" style="background:linear-gradient(135deg,${colors[0]},${colors[1]});width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;color:white;">${initials}</div>
        <span class="nurse-card-name">${name}</span>
        <div class="nurse-card-total" id="total-${nurseKey}"><span class="hours">${shiftHours}s</span></div>
      </div>
      <div class="nurse-card-body">`;

    // 7'li hafta satırları
    const mobHolidays = getHolidayDays(currentYear, currentMonth);
    for (let weekStart = 1; weekStart <= days; weekStart += 7) {
      const weekEnd = Math.min(weekStart + 6, days);
      html += `<div class="week-row">`;

      for (let d = weekStart; d <= weekEnd; d++) {
        const dow       = getDayOfWeek(currentYear, currentMonth, d);
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = mobHolidays.has(d) && !isWeekend;
        const shift     = monthSch[name][d] || 'empty';
        const cellCls   = isHoliday ? ' holiday-col' : isWeekend ? ' weekend-col' : '';
        const dayCls    = isWeekend ? ' weekend' : isHoliday ? ' holiday' : '';
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
  const days     = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  let total = 0, dayCount = 0, nightCount = 0, dnCount = 0, leaveCount = 0, totalHours = 0;

  storage.nurses.forEach(name => {
    for (let d = 1; d <= days; d++) {
      const s = monthSch[name]?.[d] || 'empty';
      if      (s === 'day')      { total++; dayCount++;   totalHours += 8;  }
      else if (s === 'night')    { total++; nightCount++; totalHours += 16; }
      else if (s === 'daynight') { total++; dnCount++;    totalHours += 24; }
      else if (s === 'leave')    { leaveCount++; }
    }
  });

  document.getElementById('statTotal').textContent  = total;
  document.getElementById('statDay').textContent    = dayCount;
  document.getElementById('statNight').textContent  = nightCount;
  document.getElementById('statDN').textContent     = dnCount;
  document.getElementById('statLeave').textContent  = leaveCount;
  document.getElementById('statHours').textContent  = totalHours + 's';
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
  const name     = decodeName(nurseEncoded);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  const current  = monthSch[name]?.[day] || 'empty';

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
  const MENU_W  = 185;
  const GAP     = 6;
  const rect    = anchor.getBoundingClientRect();
  const vw      = window.innerWidth;
  const vh      = window.innerHeight;

  // Önce boyutu ölç
  menu.style.visibility = 'hidden';
  menu.style.top  = '-9999px';
  menu.style.left = '-9999px';
  const mh = menu.offsetHeight || 210;

  // Yatay: hücrenin ortası, sağa taşarsa sola yasla
  let left = rect.left + rect.width / 2 - MENU_W / 2;
  if (left + MENU_W > vw - 8) left = vw - MENU_W - 8;
  if (left < 8) left = 8;

  // Dikey: önce aşağı dene, sığmazsa yukarı
  let top  = rect.bottom + GAP;
  if (top + mh > vh - 8) top = rect.top - mh - GAP;

  menu.style.left       = left + 'px';
  menu.style.top        = top  + 'px';
  menu.style.width      = MENU_W + 'px';
  menu.style.visibility = '';
}

function applyShift(name, nurseEncoded, day, td, state) {
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  if (!monthSch[name]) monthSch[name] = {};
  monthSch[name][day] = state;
  saveStorage();

  const inner = td.querySelector('.cell-inner');
  inner.className   = `cell-inner ${state}`;
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

function updateRowTotal(name, nurseKey) {
  const days     = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  let hours = 0;
  for (let d = 1; d <= days; d++) {
    hours += SHIFT_HOURS[monthSch[name]?.[d] || 'empty'];
  }
  const el = document.getElementById(`total-${nurseKey}`);
  if (el) {
    el.querySelector('.hours').textContent = hours + 's';
  }
}

// ─── Auto Schedule ────────────────────────────────────────────────────────────

function openAutoModal() {
  document.getElementById('autoMonthLabel').textContent =
    `${TR_MONTHS[currentMonth]} ${currentYear}`;
  updateAutoPreview();

  // Canlı önizleme: input değiştiğinde güncelle
  ['autoMinDay', 'autoMinNight'].forEach(id => {
    const el = document.getElementById(id);
    el.oninput = updateAutoPreview;
  });

  document.getElementById('autoModal').classList.add('open');
}

function closeAutoModal() {
  document.getElementById('autoModal').classList.remove('open');
}

function updateAutoPreview() {
  const minDay   = Math.max(1, parseInt(document.getElementById('autoMinDay').value)   || 2);
  const minNight = Math.max(1, parseInt(document.getElementById('autoMinNight').value) || 2);
  const total    = storage.nurses.length;
  const days     = daysInMonth(currentYear, currentMonth);
  const perDay   = minDay + minNight;
  const needed   = perDay * days;
  const perNurse = total > 0 ? Math.round(needed / total) : 0;
  const perNurseHours = perNurse * 12; // rough avg (8+16)/2

  const preview = document.getElementById('autoPreview');
  if (total < perDay) {
    preview.style.background = 'rgba(239,68,68,0.08)';
    preview.style.borderColor = 'rgba(239,68,68,0.3)';
    preview.innerHTML = `❌ Yeterli hemşire yok! Her gün <strong>${perDay}</strong> hemşire gerekiyor, listede <strong>${total}</strong> hemşire var.`;
    document.getElementById('btn-run-auto').disabled = true;
    document.getElementById('btn-run-auto').style.opacity = '0.4';
  } else {
    preview.style.background = 'rgba(59,130,246,0.08)';
    preview.style.borderColor = 'rgba(59,130,246,0.2)';
    preview.style.color = 'var(--text-secondary)';
    preview.innerHTML =
      `📋 <strong style="color:var(--text-primary)">${days} günlük</strong> çizelge · ` +
      `<strong style="color:var(--shift-day-text)">${minDay} gündüz</strong> + ` +
      `<strong style="color:var(--shift-night-text)">${minNight} gece</strong> her gün<br>` +
      `👩‍⚕️ Hemşire başı tahminen <strong style="color:var(--text-primary)">~${perNurse} vardiya</strong> · ` +
      `<strong style="color:var(--brand-cta)">~${perNurseHours} saat/ay</strong>`;
    document.getElementById('btn-run-auto').disabled = false;
    document.getElementById('btn-run-auto').style.opacity = '';
  }
}

/**
 * Otomatik çizelge algoritması — tercih destekli
 *
 * Gündüz ataması için:
 *   ↓ puan = daha önce seçilir
 *   puan = shiftCount * 2 + prefScore(gece için pozitif) + rand
 *
 * Öncelik sırası:
 *   Gündüz havuzu:  [gündüz-tercihliler] → [fark-etmez] → [gece-tercihliler]
 *   Gece havuzu:    [gece-tercihliler]  → [fark-etmez] → [gündüz-tercihliler]
 */
function runAutoSchedule() {
  const minDay   = Math.max(1, parseInt(document.getElementById('autoMinDay').value)   || 2);
  const minNight = Math.max(1, parseInt(document.getElementById('autoMinNight').value) || 2);
  const perDay   = minDay + minNight;

  const days   = daysInMonth(currentYear, currentMonth);
  const nurses = [...storage.nurses];

  if (nurses.length < perDay) {
    showToast('❌', 'Yeterli hemşire yok!');
    return;
  }

  // Ay verilerini hazırla — sadece İzin günleri koru
  const mk = monthKey(currentYear, currentMonth);
  if (!storage.schedule[mk]) storage.schedule[mk] = {};
  const sch = storage.schedule[mk];

  nurses.forEach(n => {
    if (!sch[n]) sch[n] = {};
    for (let d = 1; d <= days; d++) {
      if (sch[n][d] !== 'leave') sch[n][d] = 'empty';
    }
  });

  // Toplam nöbet sayısı takibi (yük dengesi)
  const shiftCount = {};
  nurses.forEach(n => { shiftCount[n] = 0; });

  let skipped = 0;

  for (let d = 1; d <= days; d++) {
    // O gün müsait olan hemşireler (izinde değil)
    const available = nurses.filter(n => sch[n][d] !== 'leave');

    if (available.length < perDay) {
      skipped++;
      continue;
    }

    /**
     * sortForShift: belirtilen vardiya tipi için hemşireleri sıralar.
     * Bileşenler (düşük = önce seçilir):
     *   a) prefScore(shiftType) → tercih uyumu
     *   b) shiftCount * 2       → fazla çalışana ceza
     *   c) Math.random() * 1.5  → rastgelelik (%~30)
     */
    const sortForShift = (pool, shiftType) =>
      [...pool].sort((a, b) => {
        const sa = prefScore(a, shiftType) + shiftCount[a] * 2 + Math.random() * 1.5;
        const sb = prefScore(b, shiftType) + shiftCount[b] * 2 + Math.random() * 1.5;
        return sa - sb;
      });

    // Gündüz ataması
    const dayPool     = sortForShift(available, 'day');
    const dayAssigned = dayPool.slice(0, minDay);
    dayAssigned.forEach(n => { sch[n][d] = 'day'; shiftCount[n]++; });

    // Atanmamış kalan hemşireler gece havuzuna alınır
    const remaining     = available.filter(n => !dayAssigned.includes(n));
    const nightPool     = sortForShift(remaining, 'night');
    const nightAssigned = nightPool.slice(0, minNight);
    nightAssigned.forEach(n => { sch[n][d] = 'night'; shiftCount[n]++; });
  }

  saveStorage();
  closeAutoModal();
  renderAll();

  const label = `${TR_MONTHS[currentMonth]} ${currentYear}`;
  showToast(
    skipped > 0 ? '⚠️' : '🎲',
    skipped > 0
      ? `Oluşturuldu — ${skipped} gün atlandı (yetersiz hemşire)`
      : `${label} çizelgesi tercihler gözönünde bulundurularak oluşturuldu!`
  );
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
  const year      = currentYear;
  const days      = daysInMonth(currentYear, currentMonth);
  const monthSch  = getMonthSchedule(currentYear, currentMonth);

  let headerCells = `<th class="p-nurse">HEMŞİRE</th>`;
  const printHolidays = getHolidayDays(currentYear, currentMonth);

  for (let d = 1; d <= days; d++) {
    const dow       = getDayOfWeek(currentYear, currentMonth, d);
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = printHolidays.has(d) && !isWeekend;
    const hCls = isHoliday ? 'holiday' : isWeekend ? 'weekend' : '';
    headerCells += `<th class="${hCls}">${d}<br><span class="dn">${TR_DAYS_SHORT[dow]}</span></th>`;
  }
  headerCells += `<th class="p-total">TOPLAM</th>`;

  let bodyRows = '';
  storage.nurses.forEach((name, ni) => {
    let hours = 0;
    let cells = `<td class="p-nurse-name">${name}</td>`;
    for (let d = 1; d <= days; d++) {
      const s = monthSch[name]?.[d] || 'empty';
      if (s !== 'empty') hours += SHIFT_HOURS[s];
      const label     = SHIFT_LABELS[s];
      const dow       = getDayOfWeek(currentYear, currentMonth, d);
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = printHolidays.has(d) && !isWeekend;
      const colCls    = isHoliday ? 'col-holiday' : isWeekend ? 'col-weekend' : '';
      const shiftCls  = s !== 'empty' ? `cell-${s}` : '';
      cells += `<td class="${[colCls, shiftCls].filter(Boolean).join(' ')}">${label}</td>`;
    }
    cells += `<td class="p-total-cell">${hours}s</td>`;
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
  <span>Yazdırma tarihi: ${new Date().toLocaleDateString('tr-TR', {day:'2-digit',month:'long',year:'numeric'})}</span>
  <span>D = 8 saat &nbsp;|&nbsp; N = 16 saat &nbsp;|&nbsp; D/N = 24 saat</span>
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank', 'width=1100,height=750');
  win.addEventListener('unload', () => URL.revokeObjectURL(url), { once: true });
}

// ─── Download as TXT ──────────────────────────────────────────────────────────
function downloadTxt() {
  const monthName = TR_MONTHS[currentMonth].toUpperCase();
  const year      = currentYear;
  const days      = daysInMonth(currentYear, currentMonth);
  const monthSch  = getMonthSchedule(currentYear, currentMonth);

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

  const content  = lines.join('\n');
  const encoded  = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  const a        = document.createElement('a');
  a.href         = encoded;
  a.download     = `${TR_MONTHS[currentMonth]}_${year}.txt`;
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
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
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
  reader.onload = function(e) {
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
    const enc  = escapeName(name);
    const avatarStyle =
      `background:linear-gradient(135deg,${AVATAR_COLORS[i%AVATAR_COLORS.length][0]},${AVATAR_COLORS[i%AVATAR_COLORS.length][1]});` +
      `width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;` +
      `font-size:11px;font-weight:700;flex-shrink:0;color:white;`;
    return `
    <div class="nurse-list-item" draggable="true" data-index="${i}"
         ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dropItem(event)">
      <span class="drag-handle">⠿</span>
      <span class="nurse-avatar" style="${avatarStyle}">${name.substring(0,2).toUpperCase()}</span>
      <span class="nurse-item-name">${name}</span>
      <div class="pref-toggle" title="Vardiya Tercihi">
        <button class="pref-btn${pref==='day'?' pref-active-day':''}"   onclick="setPreference('${enc}','day')"   title="Gündüz tercih et">☀️</button>
        <button class="pref-btn${pref==='any'?' pref-active-any':''}"   onclick="setPreference('${enc}','any')"   title="Fark etmez">⚖️</button>
        <button class="pref-btn${pref==='night'?' pref-active-night':''}" onclick="setPreference('${enc}','night')" title="Gece tercih et">🌙</button>
      </div>
      <div class="nurse-item-actions">
        <button class="icon-btn" onclick="removeNurse(${i})" title="Sil">🗑️</button>
      </div>
    </div>`;
  }).join('');
}


function addNurse() {
  const input = document.getElementById('newNurseName');
  const name  = input.value.trim();
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
  document.getElementById('confirmTitle').textContent   = title;
  document.getElementById('confirmMessage').innerHTML   = message.replace(/\n/g, '<br>');
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
  document.getElementById('toastMsg').textContent  = msg;
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
  document.getElementById('nurseModal').addEventListener('click', function(e) {
    if (e.target === this) closeNurseModal();
  });
  document.getElementById('confirmModal').addEventListener('click', function(e) {
    if (e.target === this) closeConfirm();
  });
  document.getElementById('autoModal').addEventListener('click', function(e) {
    if (e.target === this) closeAutoModal();
  });
  document.getElementById('menuModal').addEventListener('click', function(e) {
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
