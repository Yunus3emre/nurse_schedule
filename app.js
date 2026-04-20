// ─── Constants ────────────────────────────────────────────────────────────────
const SHIFT_STATES = ['empty', 'day', 'night', 'daynight', 'leave'];
const SHIFT_LABELS = { empty: '', day: 'D', night: 'N', daynight: 'D/N', leave: 'İ' };
const SHIFT_HOURS  = { empty: 0,  day: 8,  night: 16,  daynight: 24,  leave: 0 };

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

// ─── Default nurses ───────────────────────────────────────────────────────────
const DEFAULT_NURSES = [
  'ElifEce', 'Sümeyye', 'Rabia', 'Beyza', 'Ayşu',
  'Damla', 'Berivan', 'Ayşe'
];

// ─── State ────────────────────────────────────────────────────────────────────
// storage shape:
// {
//   nurses: [...],
//   schedule: {
//     "2026-04": { "NurseName": { 1: "day", 2: "night", ... }, ... },
//     "2026-05": { ... },
//     ...
//   }
// }
let storage = loadStorage();

let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed

// ─── Storage helpers ──────────────────────────────────────────────────────────
function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure all fields exist
      if (!parsed.nurses)   parsed.nurses   = [...DEFAULT_NURSES];
      if (!parsed.schedule) parsed.schedule = {};
      return parsed;
    }
  } catch (e) { /* ignore */ }
  return { nurses: [...DEFAULT_NURSES], schedule: {} };
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
  // Ensure every nurse has an entry in this month
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

// ─── Render ──────────────────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderTable();
  renderStats();
}

function renderHeader() {
  document.getElementById('monthName').textContent = TR_MONTHS[currentMonth];
  document.getElementById('yearName').textContent  = currentYear;
}

function renderTable() {
  const days     = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  const thead    = document.getElementById('tableThead');
  const tbody    = document.getElementById('tableTbody');

  // ── Header row ──
  let headerHTML = `<tr>
    <th class="nurse-col-header">Hemşire</th>`;

  for (let d = 1; d <= 31; d++) {
    if (d <= days) {
      const dow        = getDayOfWeek(currentYear, currentMonth, d);
      const isWeekend  = dow === 0 || dow === 6;
      headerHTML += `<th class="day-header${isWeekend ? ' weekend' : ''}">
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

    let shiftCount = 0;
    let shiftHours = 0;
    for (let d = 1; d <= 31; d++) {
      if (d <= days) {
        const shift = monthSch[name][d] || 'empty';
        if (shift !== 'empty') { shiftCount++; shiftHours += SHIFT_HOURS[shift]; }
        bodyHTML += `<td class="shift-cell"
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
    </td>`;
    bodyHTML += `</tr>`;
  });

  tbody.innerHTML = bodyHTML;
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
function cycleShift(nurseEncoded, day, td) {
  const name     = decodeName(nurseEncoded);
  const monthSch = getMonthSchedule(currentYear, currentMonth);

  if (!monthSch[name]) monthSch[name] = {};
  const current = monthSch[name][day] || 'empty';
  const idx     = SHIFT_STATES.indexOf(current);
  const next    = SHIFT_STATES[(idx + 1) % SHIFT_STATES.length];
  monthSch[name][day] = next;

  // Persist immediately
  saveStorage();

  // Update cell DOM
  const inner = td.querySelector('.cell-inner');
  inner.className   = `cell-inner ${next}`;
  inner.textContent = SHIFT_LABELS[next];

  // Update row total
  updateRowTotal(name, nurseEncoded);
  renderStats();
}

function updateRowTotal(name, nurseKey) {
  const days     = daysInMonth(currentYear, currentMonth);
  const monthSch = getMonthSchedule(currentYear, currentMonth);
  let count = 0, hours = 0;
  for (let d = 1; d <= days; d++) {
    const s = monthSch[name]?.[d] || 'empty';
    if (s !== 'empty') { count++; hours += SHIFT_HOURS[s]; }
  }
  const el = document.getElementById(`total-${nurseKey}`);
  if (el) {
    el.querySelector('.hours').textContent = hours + 's';
  }
}

// ─── Month navigation ──────────────────────────────────────────────────────────
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
    `<strong>${label}</strong> ayına ait tüm nöbet verileri kalıcı olarak silinecek.\nDevam etmek istiyor musunuz?`,
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

  // Build table rows
  let headerCells = `<th class="p-nurse">HEMŞİRE</th>`;
  for (let d = 1; d <= days; d++) {
    const dow       = getDayOfWeek(currentYear, currentMonth, d);
    const isWeekend = dow === 0 || dow === 6;
    headerCells += `<th class="${isWeekend ? 'weekend' : ''}">${d}<br><span class="dn">${TR_DAYS_SHORT[dow]}</span></th>`;
  }
  headerCells += `<th class="p-total">TOPLAM</th>`;

  let bodyRows = '';
  storage.nurses.forEach((name, ni) => {
    let hours = 0;
    let cells = `<td class="p-nurse-name">${name}</td>`;
    for (let d = 1; d <= days; d++) {
      const s = monthSch[name]?.[d] || 'empty';
      if (s !== 'empty') hours += SHIFT_HOURS[s];
      const label = SHIFT_LABELS[s];
      const cls   = s !== 'empty' ? `cell-${s}` : '';
      cells += `<td class="${cls}">${label}</td>`;
    }
    cells += `<td class="p-total-cell">${hours}s</td>`;
    const rowCls = ni % 2 === 1 ? 'alt' : '';
    bodyRows += `<tr class="${rowCls}">${cells}</tr>`;
  });

  // Legend data
  const legendHTML = `
    <div class="legend">
      <span class="lchip day-chip">D</span> Gündüz 08:00–16:00 &nbsp;&nbsp;
      <span class="lchip night-chip">N</span> Gece 16:00–08:00 &nbsp;&nbsp;
      <span class="lchip dn-chip">D/N</span> 24 Saat 08:00–08:00
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
  thead th.weekend  { background: #2d3a8c; color: #bfdbfe; }
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

  const win = window.open('', '_blank', 'width=1100,height=750');
  win.document.write(html);
  win.document.close();
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
  // Use data URI instead of Blob URL — works with file:// protocol
  const encoded  = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  const a        = document.createElement('a');
  a.href         = encoded;
  a.download     = `${TR_MONTHS[currentMonth]}_${year}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast('✅', `${TR_MONTHS[currentMonth]} ${year} dosyası indirildi`);
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
  list.innerHTML = storage.nurses.map((name, i) => `
    <div class="nurse-list-item" draggable="true" data-index="${i}"
         ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dropItem(event)">
      <span class="drag-handle">⠿</span>
      <span class="nurse-avatar" style="
        background:linear-gradient(135deg,${AVATAR_COLORS[i % AVATAR_COLORS.length][0]},${AVATAR_COLORS[i % AVATAR_COLORS.length][1]});
        width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;flex-shrink:0;color:white;">
        ${name.substring(0, 2).toUpperCase()}
      </span>
      <span class="nurse-item-name">${name}</span>
      <div class="nurse-item-actions">
        <button class="icon-btn" onclick="removeNurse(${i})" title="Sil">🗑️</button>
      </div>
    </div>
  `).join('');
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
      // Remove from all months
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
  closeConfirm();
  if (confirmCallback) confirmCallback();
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

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Enter key on nurse input
  document.getElementById('newNurseName').addEventListener('keydown', e => {
    if (e.key === 'Enter') addNurse();
  });

  // Close nurse modal on backdrop click
  document.getElementById('nurseModal').addEventListener('click', function(e) {
    if (e.target === this) closeNurseModal();
  });

  // Close confirm modal on backdrop click
  document.getElementById('confirmModal').addEventListener('click', function(e) {
    if (e.target === this) closeConfirm();
  });

  renderAll();
});
