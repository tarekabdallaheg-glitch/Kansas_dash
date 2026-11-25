/* KANSAS PREMIUM — قنوات البيع (Sales Channels)
   وحدة مستقلة تُحمَّل عند فتح التبويب أو عند عرض قسم القنوات داخل خريطة الأداء العام.
   - البيانات في مفتاح تخزين منفصل: kansas_channels_v1 (لا يغيّر أي مفتاح موجود).
   - لا تكتب في S ولا تغيّر أي حساب في البرنامج الأساسي.
   - لا توجد بيانات افتراضية: كل الأرقام تُدخل يدويًا من المستخدم.
   - المقارنة على الأيام المتطابقة فقط، والفترات غير المكتملة تُوضَّح صراحةً. */
(function () {
  'use strict';

  var KEY = 'kansas_channels_v1';
  var CH = [
    { k: 'saloon', n: 'صالة' },
    { k: 'takeaway', n: 'تيك أوي' },
    { k: 'delivery', n: 'دليفري' },
    { k: 'pickup', n: 'بيكب' },
    { k: 'drive', n: 'درايف ثرو' }
  ];
  var MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var ROOT = null, BROKEN = false;
  var UI = { month: null, refYear: null, refMonth: null, dayDate: null, manageOpen: false, mgmt: 'day', reviewOpen: false };

  function $$(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function num0(n) { return (n === null || n === undefined || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function pct(n) { return (n === null || n === undefined || !isFinite(n)) ? '—' : (n > 0 ? '+' : '') + Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
  function monthLabel(m) { var p = m.split('-'); return (MONTHS_AR[Number(p[1]) - 1] || p[1]) + ' ' + p[0]; }
  function ltr(s) { return '<bdi dir="ltr">' + s + '</bdi>'; }
  function notify(msg, type) { if (typeof toast === 'function') toast(msg, type || 'success'); }
  function changed() { try { window.dispatchEvent(new CustomEvent('kansas-channels-changed')); } catch (e) {} }

  /* ---------- التخزين ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { v: 1, years: {}, log: [] };
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') throw new Error('bad');
      o.years = o.years || {};
      o.log = o.log || [];
      BROKEN = false;
      return o;
    } catch (e) {
      BROKEN = true;
      return { v: 1, years: {}, log: [] };
    }
  }
  function store(o) {
    if (BROKEN) { notify('بيانات قنوات البيع في المتصفح غير صالحة، لن يتم الحفظ حتى لا تُمسح البيانات.', 'error'); return false; }
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; }
    catch (e) { notify('تعذر الحفظ: مساحة التخزين في المتصفح ممتلئة.', 'error'); return false; }
  }
  function logAction(o, action, year, detail, reason) {
    o.log.push({ at: new Date().toISOString(), action: action, year: String(year), detail: detail || '', reason: reason || '' });
    if (o.log.length > 300) o.log = o.log.slice(-300);
  }
  function yearObj(o, y) {
    var k = String(y);
    if (!o.years[k]) o.years[k] = { status: 'draft', approvedAt: null, days: {} };
    if (!o.years[k].days) o.years[k].days = {};
    return o.years[k];
  }
  function statusOfYear(o, y) { var yo = o.years[String(y)]; return yo ? yo.status : 'none'; }
  function dayRec(o, date) { var yo = o.years[date.slice(0, 4)]; return (yo && yo.days && yo.days[date]) || null; }
  function hasChannelValue(rec) {
    if (!rec) return false;
    return CH.some(function (c) { var v = rec[c.k]; return v && (v.rev !== null && v.rev !== undefined || v.ord !== null && v.ord !== undefined); });
  }
  function cleanNum(x) {
    if (x === '' || x === null || x === undefined) return null;
    var n = Number(x);
    return (isFinite(n) && n >= 0) ? n : null;
  }
  function cleanRec(vals) {
    var out = {};
    CH.forEach(function (c) {
      var v = vals && vals[c.k];
      if (!v) return;
      var rev = cleanNum(v.rev), ord = cleanNum(v.ord);
      if (rev !== null || ord !== null) out[c.k] = { rev: rev, ord: ord };
    });
    return Object.keys(out).length ? out : null;
  }

  /* ---------- المقارنة (قراءة فقط) ---------- */
  function compare(month) {
    var o = load();
    var cy = Number(month.slice(0, 4)), ry = cy - 1, mm = month.slice(5, 7);
    var n = daysIn(month);
    var today = todayStr();
    var rows = [];
    var tot = {};
    CH.forEach(function (c) { tot[c.k] = { rRev: 0, cRev: 0, rOrd: 0, cOrd: 0, days: 0 }; });
    var curRecorded = 0, refRecorded = 0, elapsed = 0, matchedDays = 0, invalidRef = 0;
    for (var d = 1; d <= n; d++) {
      var cur = cy + '-' + mm + '-' + pad2(d);
      var ref = ry + '-' + mm + '-' + pad2(d);
      var refValid = /^\d{4}-\d{2}-\d{2}$/.test(ref) && Number(ref.slice(8)) === d && new Date(Date.UTC(ry, Number(mm) - 1, d)).getUTCDate() === d;
      var curRec = dayRec(o, cur), refRec = refValid ? dayRec(o, ref) : null;
      if (cur <= today) elapsed++;
      if (hasChannelValue(curRec)) curRecorded++;
      if (refValid && hasChannelValue(refRec)) refRecorded++;
      if (!refValid) invalidRef++;
      var dayDiff = 0, dayCounted = false, rowMatched = false;
      CH.forEach(function (c) {
        var a = curRec && curRec[c.k], b = refRec && refRec[c.k];
        if (a && b && a.rev !== null && a.ord !== null && b.rev !== null && b.ord !== null) {
          tot[c.k].cRev += a.rev; tot[c.k].cOrd += a.ord; tot[c.k].rRev += b.rev; tot[c.k].rOrd += b.ord; tot[c.k].days++;
          dayDiff += a.rev - b.rev; dayCounted = true; rowMatched = true;
        }
      });
      if (rowMatched) matchedDays++;
      rows.push({ d: d, cur: cur, ref: ref, refValid: refValid, curRec: curRec, refRec: refRec, matched: rowMatched, diff: dayCounted ? dayDiff : null,
        cRev: sumRev(curRec), rRev: refValid ? sumRev(refRec) : null });
    }
    var channels = CH.map(function (c) {
      var t = tot[c.k];
      return {
        k: c.k, n: c.n, days: t.days,
        rRev: t.days ? t.rRev : null, cRev: t.days ? t.cRev : null,
        rOrd: t.days ? t.rOrd : null, cOrd: t.days ? t.cOrd : null,
        rTick: t.rOrd > 0 ? t.rRev / t.rOrd : null, cTick: t.cOrd > 0 ? t.cRev / t.cOrd : null
      };
    });
    var T = { k: 'total', n: 'الإجمالي', days: matchedDays, rRev: 0, cRev: 0, rOrd: 0, cOrd: 0 };
    channels.forEach(function (c) { if (c.days) { T.rRev += c.rRev; T.cRev += c.cRev; T.rOrd += c.rOrd; T.cOrd += c.cOrd; } });
    T.rRev = matchedDays ? T.rRev : null; T.cRev = matchedDays ? T.cRev : null;
    T.rOrd = matchedDays ? T.rOrd : null; T.cOrd = matchedDays ? T.cOrd : null;
    T.rTick = T.rOrd > 0 ? T.rRev / T.rOrd : null;
    T.cTick = T.cOrd > 0 ? T.cRev / T.cOrd : null;
    channels.forEach(function (c) { c.revPct = (c.rRev > 0) ? (c.cRev - c.rRev) / c.rRev * 100 : null; c.tickPct = (c.rTick > 0 && c.cTick !== null) ? (c.cTick - c.rTick) / c.rTick * 100 : null; });
    T.revPct = (T.rRev > 0) ? (T.cRev - T.rRev) / T.rRev * 100 : null;
    T.tickPct = (T.rTick > 0 && T.cTick !== null) ? (T.cTick - T.rTick) / T.rTick * 100 : null;
    return {
      month: month, curYear: cy, refYear: ry, refStatus: statusOfYear(o, ry), curStatus: statusOfYear(o, cy),
      n: n, elapsed: elapsed, curRecorded: curRecorded, refRecorded: refRecorded, invalidRef: invalidRef,
      matchedDays: matchedDays, channels: channels, total: T, daily: rows,
      fullMonthRef: refRecorded === n - invalidRef && refRecorded > 0,
      broken: BROKEN
    };
  }
  function sumRev(rec) {
    if (!rec) return null;
    var s = 0, any = false;
    CH.forEach(function (c) { var v = rec[c.k]; if (v && v.rev !== null && v.rev !== undefined) { s += v.rev; any = true; } });
    return any ? s : null;
  }

  /* ---------- قراءة لملخص السنة المرجعية (للاستخدام في خريطة الأداء) ---------- */
  function summary(month) { return compare(month); }

  /* ---------- الكتابة (من واجهة القنوات فقط) ---------- */
  function saveDay(date, vals) {
    var o = load(); if (BROKEN) return store(o);
    var y = date.slice(0, 4);
    var yo = yearObj(o, y);
    if (yo.status === 'approved') { notify('السنة مقفولة. افتح القفل بسبب موثّق أولًا.', 'error'); return false; }
    var rec = cleanRec(vals);
    if (rec) yo.days[date] = rec; else delete yo.days[date];
    logAction(o, 'day', y, date + (rec ? '' : ' (مسح)'));
    if (!store(o)) return false;
    changed(); return true;
  }
  function saveMonthRef(year, month, rowsVals) {
    var o = load(); if (BROKEN) return store(o);
    var yo = yearObj(o, year);
    if (yo.status === 'approved') { notify('السنة المرجعية مقفولة. افتح القفل بسبب موثّق أولًا.', 'error'); return false; }
    var n = daysIn(year + '-' + pad2(month)), saved = 0;
    for (var d = 1; d <= n; d++) {
      var date = year + '-' + pad2(month) + '-' + pad2(d);
      var rec = cleanRec(rowsVals[d]);
      if (rec) { yo.days[date] = rec; saved++; } else { delete yo.days[date]; }
    }
    logAction(o, 'month', year, pad2(month) + ' (' + saved + ' يوم)');
    if (!store(o)) return false;
    changed(); return saved;
  }
  function reviewYear(year) {
    var o = load();
    var yo = o.years[String(year)] || { days: {} };
    var months = [];
    for (var m = 1; m <= 12; m++) {
      var n = daysIn(year + '-' + pad2(m)), rec = 0, partial = 0, rev = {}, ord = {};
      CH.forEach(function (c) { rev[c.k] = 0; ord[c.k] = 0; });
      for (var d = 1; d <= n; d++) {
        var r = yo.days[year + '-' + pad2(m) + '-' + pad2(d)];
        if (!r) continue;
        rec++;
        CH.forEach(function (c) {
          var v = r[c.k];
          if (!v) return;
          if (v.rev !== null) rev[c.k] += v.rev;
          if (v.ord !== null) ord[c.k] += v.ord;
          if ((v.rev === null) !== (v.ord === null)) partial++;
        });
      }
      months.push({ m: m, n: n, rec: rec, partial: partial, rev: rev, ord: ord });
    }
    return months;
  }
  function approveYear(year) {
    var o = load(); if (BROKEN) return store(o);
    var yo = yearObj(o, year);
    var recs = Object.keys(yo.days).length;
    if (!recs) { notify('لا توجد أيام مسجلة في هذه السنة بعد.', 'error'); return false; }
    yo.status = 'approved'; yo.approvedAt = new Date().toISOString();
    logAction(o, 'approve', year, recs + ' يوم');
    if (!store(o)) return false;
    changed(); notify('تم اعتماد السنة وقفلها.'); return true;
  }
  function unlockYear(year, reason) {
    var o = load(); if (BROKEN) return store(o);
    var yo = yearObj(o, year);
    var why = String(reason || '').trim();
    if (why.length < 5) { notify('اكتب سبب القفل بوضوح (5 أحرف على الأقل).', 'error'); return false; }
    yo.status = 'draft';
    logAction(o, 'unlock', year, '', why);
    if (!store(o)) return false;
    changed(); notify('تم فك القفل. السبب مسجّل في السجل.'); return true;
  }

  /* ---------- الواجهة ---------- */
  function refYearDefault() { return Number(activeMonth.slice(0, 4)) - 1; }
  function curYearOf() { return Number(activeMonth.slice(0, 4)); }

  function renderTable(R) {
    var head = '<thead><tr><th>القناة</th><th>الإيراد المرجعي</th><th>الإيراد الحالي</th><th>الفرق (ج.م)</th><th>الفرق %</th>' +
      '<th>العمليات المرجعية</th><th>العمليات الحالية</th><th>فرق العمليات</th><th>متوسط الفاتورة المرجعي</th><th>متوسط الفاتورة الحالي</th><th>تغيّر متوسط الفاتورة</th></tr></thead>';
    var body = R.channels.concat([R.total]).map(function (c) {
      var isT = c.k === 'total';
      var diff = (c.rRev !== null && c.cRev !== null) ? c.cRev - c.rRev : null;
      var dOrd = (c.rOrd !== null && c.cOrd !== null) ? c.cOrd - c.rOrd : null;
      var cls = function (x) { return x === null || x === undefined ? '' : (x >= 0 ? 'sc-pos' : 'sc-neg'); };
      return '<tr class="' + (isT ? 'sc-total' : '') + '">' +
        '<th>' + esc(c.n) + (c.days ? '' : ' <em class="sc-muted">(لا أيام متطابقة)</em>') + '</th>' +
        '<td>' + ltr(num0(c.rRev)) + '</td><td>' + ltr(num0(c.cRev)) + '</td>' +
        '<td class="' + cls(diff) + '">' + ltr(diff === null ? '—' : (diff > 0 ? '+' : '') + num0(diff)) + '</td>' +
        '<td class="' + cls(c.revPct) + '">' + ltr(pct(c.revPct)) + '</td>' +
        '<td>' + ltr(num0(c.rOrd)) + '</td><td>' + ltr(num0(c.cOrd)) + '</td>' +
        '<td class="' + cls(dOrd) + '">' + ltr(dOrd === null ? '—' : (dOrd > 0 ? '+' : '') + num0(dOrd)) + '</td>' +
        '<td>' + ltr(c.rTick === null || c.rTick === undefined ? '—' : num0(c.rTick)) + '</td>' +
        '<td>' + ltr(c.cTick === null || c.cTick === undefined ? '—' : num0(c.cTick)) + '</td>' +
        '<td class="' + cls(c.tickPct) + '">' + ltr(pct(c.tickPct)) + '</td></tr>';
    }).join('');
    return '<table class="sc-tbl">' + head + '<tbody>' + body + '</tbody></table>';
  }

  function noteOf(R) {
    var parts = [];
    if (R.broken) parts.push('بيانات القنوات في المتصفح غير صالحة، المعروض فارغ.');
    if (!R.matchedDays) parts.push('لا توجد أيام متطابقة بعد: سجّل بيانات اليوم والسنة المرجعية للشهر.');
    else parts.push('المقارنة على ' + R.matchedDays + ' يوم متطابق فقط.');
    if (R.curRecorded < R.elapsed) parts.push('الفترة الحالية غير مكتملة: ' + R.curRecorded + ' يوم مسجّل من ' + R.elapsed + ' يوم حتى التاريخ.');
    if (R.refRecorded < R.n - R.invalidRef) parts.push('الشهر المرجعي غير مكتمل: ' + R.refRecorded + ' يوم مسجّل من ' + (R.n - R.invalidRef) + '.');
    if (R.refStatus !== 'approved') parts.push('السنة المرجعية غير مقفولة بعد، والأرقام قابلة للتعديل.');
    return parts.join(' ');
  }

  function badges(R) {
    var txt = R.refStatus === 'approved' ? 'مقفولة ومعتمدة' : (R.refStatus === 'none' ? 'لا توجد بيانات' : 'مسودة (غير مقفولة)');
    var cls = R.refStatus === 'approved' ? 'sc-good' : (R.refStatus === 'none' ? 'sc-nd' : 'sc-watch');
    return '<div class="sc-badges"><span class="sc-chip ' + cls + '">السنة المرجعية ' + R.refYear + ': ' + txt + '</span></div>';
  }

  function renderMain() {
    var R = compare(activeMonth);
    $$('sc-month').textContent = monthLabel(activeMonth);
    $$('sc-badges').innerHTML = badges(R);
    $$('sc-note').textContent = noteOf(R);
    $$('sc-table-wrap').innerHTML = renderTable(R);
  }

  function renderDayForm() {
    var date = UI.dayDate || (activeMonth + '-01');
    if (date.slice(0, 4) !== String(curYearOf())) date = activeMonth + '-01';
    UI.dayDate = date;
    var o = load(); var rec = dayRec(o, date) || {};
    $$('sc-day-date').value = date;
    $$('sc-day-date').min = curYearOf() + '-01-01'; $$('sc-day-date').max = curYearOf() + '-12-31';
    $$('sc-day-grid').innerHTML = CH.map(function (c) {
      var v = rec[c.k] || {};
      return '<div class="sc-chrow"><span>' + c.n + '</span>' +
        '<label>إيراد <input type="number" min="0" step="any" inputmode="decimal" data-ch="' + c.k + '" data-f="rev" value="' + (v.rev === null || v.rev === undefined ? '' : v.rev) + '"></label>' +
        '<label>عمليات <input type="number" min="0" step="1" inputmode="numeric" data-ch="' + c.k + '" data-f="ord" value="' + (v.ord === null || v.ord === undefined ? '' : v.ord) + '"></label></div>';
    }).join('');
  }

  function readVals(root) {
    var vals = {};
    root.querySelectorAll('input[data-ch]').forEach(function (inp) {
      var k = inp.getAttribute('data-ch'), f = inp.getAttribute('data-f');
      vals[k] = vals[k] || {};
      vals[k][f] = inp.value === '' ? null : inp.value;
    });
    return vals;
  }

  function renderRefForm() {
    var sel = $$('sc-ref-year');
    var opts = [];
    var cy = curYearOf();
    for (var y = cy - 1; y >= cy - 3; y--) opts.push('<option value="' + y + '">' + y + '</option>');
    sel.innerHTML = opts.join('');
    if (!UI.refYear) UI.refYear = cy - 1;
    sel.value = String(UI.refYear);
    var ms = $$('sc-ref-month');
    ms.innerHTML = MONTHS_AR.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + '</option>'; }).join('');
    if (!UI.refMonth) UI.refMonth = Number(activeMonth.slice(5, 7));
    ms.value = String(UI.refMonth);
    var o = load(); var yo = o.years[String(UI.refYear)] || { days: {}, status: 'none' };
    var locked = yo.status === 'approved';
    $$('sc-ref-lock-note').textContent = locked ? 'السنة مقفولة. لتعديلها افتح القفل بسبب موثّق.' : 'السنة مسودة. أدخل الأيام، ثم راجع واعتمد الوحدة.';
    $$('sc-ref-unlock-box').style.display = locked ? '' : 'none';
    $$('sc-ref-approve').disabled = locked;
    $$('sc-ref-save').disabled = locked;
    var n = daysIn(UI.refYear + '-' + pad2(UI.refMonth));
    var rows = [];
    for (var d = 1; d <= n; d++) {
      var date = UI.refYear + '-' + pad2(UI.refMonth) + '-' + pad2(d);
      var rec = yo.days[date] || {};
      var cells = CH.map(function (c) {
        var v = rec[c.k] || {};
        return '<td><input type="number" min="0" step="any" data-day="' + d + '" data-ch="' + c.k + '" data-f="rev" value="' + (v.rev === null || v.rev === undefined ? '' : v.rev) + '"' + (locked ? ' disabled' : '') + '></td>' +
          '<td><input type="number" min="0" step="1" data-day="' + d + '" data-ch="' + c.k + '" data-f="ord" value="' + (v.ord === null || v.ord === undefined ? '' : v.ord) + '"' + (locked ? ' disabled' : '') + '></td>';
      }).join('');
      rows.push('<tr><th>' + d + '</th>' + cells + '</tr>');
    }
    var headCells = CH.map(function (c) { return '<th colspan="2">' + c.n + '</th>'; }).join('');
    var subCells = CH.map(function () { return '<th>إيراد</th><th>عمليات</th>'; }).join('');
    $$('sc-ref-grid').innerHTML = '<table class="sc-entry"><thead><tr><th rowspan="2">اليوم</th>' + headCells + '</tr><tr>' + subCells + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  }

  function renderReview() {
    var box = $$('sc-review');
    if (!UI.reviewOpen) { box.style.display = 'none'; return; }
    box.style.display = '';
    var months = reviewYear(UI.refYear);
    var head = '<thead><tr><th>الشهر</th><th>أيام مسجلة</th><th>أيام بقيم ناقصة</th>' + CH.map(function (c) { return '<th>' + c.n + ' (إيراد)</th>'; }).join('') + '<th>إجمالي الإيراد</th></tr></thead>';
    var body = months.map(function (m) {
      var tot = 0; CH.forEach(function (c) { tot += m.rev[c.k]; });
      return '<tr><th>' + MONTHS_AR[m.m - 1] + '</th><td>' + ltr(m.rec + ' / ' + m.n) + '</td><td class="' + (m.partial ? 'sc-neg' : '') + '">' + ltr(m.partial) + '</td>' +
        CH.map(function (c) { return '<td>' + ltr(num0(m.rec ? m.rev[c.k] : null)) + '</td>'; }).join('') +
        '<td>' + ltr(num0(m.rec ? tot : null)) + '</td></tr>';
    }).join('');
    var warn = months.some(function (m) { return m.partial; }) ? '<p class="sc-note">يوجد أيام فيها إيراد بدون عمليات أو العكس. راجعها قبل الاعتماد.</p>' : '';
    box.innerHTML = '<div class="sc-ct"><h4>مراجعة السنة ' + UI.refYear + ' قبل الاعتماد</h4></div>' +
      '<div class="tbl-wrap"><table class="sc-tbl">' + head + '<tbody>' + body + '</tbody></table></div>' + warn;
  }

  function renderManage() {
    var box = $$('sc-manage');
    box.style.display = UI.manageOpen ? '' : 'none';
    $$('sc-m-day').style.display = UI.mgmt === 'day' ? '' : 'none';
    $$('sc-m-ref').style.display = UI.mgmt === 'ref' ? '' : 'none';
    box.querySelectorAll('[data-mgmt]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mgmt') === UI.mgmt); });
    if (UI.manageOpen && UI.mgmt === 'day') renderDayForm();
    if (UI.manageOpen && UI.mgmt === 'ref') { renderRefForm(); renderReview(); }
  }

  function renderAll() {
    if (!ROOT) return;
    renderMain();
    renderManage();
  }

  function buildSkeleton(container) {
    ROOT = document.createElement('div');
    ROOT.className = 'sc-root';
    ROOT.innerHTML =
      '<header class="sc-head"><div><div class="sc-kicker">SALES CHANNELS</div><h2>قنوات البيع</h2>' +
      '<p class="sc-sub">مقارنة الشهر <b id="sc-month"></b> بنفس الشهر من السنة السابقة، يومًا بيوم</p></div><div id="sc-badges"></div></header>' +
      '<div class="sc-card"><div class="sc-ct"><h4>جدول المقارنة</h4></div>' +
      '<p class="sc-note" id="sc-note"></p><div class="tbl-wrap" id="sc-table-wrap"></div></div>' +
      '<div class="sc-toggle"><button class="btn" data-act="toggle-manage" id="sc-toggle">إدارة البيانات</button></div>' +
      '<div class="sc-card" id="sc-manage" style="display:none">' +
        '<div class="sc-mtabs"><button class="btn" data-mgmt="day" data-act="mgmt">بيانات اليوم (السنة الحالية)</button><button class="btn" data-mgmt="ref" data-act="mgmt">السنة المرجعية</button></div>' +
        '<div id="sc-m-day">' +
          '<div class="sc-row"><label>التاريخ <input type="date" id="sc-day-date" class="inp sm" data-act="day-date"></label></div>' +
          '<div id="sc-day-grid" class="sc-daygrid"></div>' +
          '<div class="sc-row"><button class="btn" data-act="save-day">حفظ اليوم</button><button class="btn btn-slate" data-act="clear-day">مسح اليوم</button></div>' +
        '</div>' +
        '<div id="sc-m-ref" style="display:none">' +
          '<div class="sc-row"><label>السنة <select id="sc-ref-year" class="inp sm" data-act="ref-pick"></select></label>' +
          '<label>الشهر <select id="sc-ref-month" class="inp sm" data-act="ref-pick"></select></label></div>' +
          '<p class="sc-note" id="sc-ref-lock-note"></p>' +
          '<div class="sc-row"><button class="btn" id="sc-ref-save" data-act="save-ref">حفظ الشهر</button><button class="btn btn-slate" id="sc-ref-review" data-act="review">مراجعة السنة</button>' +
          '<button class="btn" id="sc-ref-approve" data-act="approve">اعتماد وقفل السنة</button></div>' +
          '<div id="sc-review" style="display:none"></div>' +
          '<div id="sc-ref-unlock-box" class="sc-unlock" style="display:none"><label>سبب فك القفل (إلزامي)<input type="text" id="sc-unlock-reason" class="inp" maxlength="160"></label>' +
          '<button class="btn btn-slate" data-act="unlock">فك القفل</button></div>' +
          '<div id="sc-ref-grid" class="tbl-wrap sc-refgrid"></div>' +
        '</div>' +
      '</div>';
    container.appendChild(ROOT);
    bind();
  }

  function bind() {
    ROOT.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || b.disabled) return;
      var act = b.getAttribute('data-act');
      if (act === 'toggle-manage') { UI.manageOpen = !UI.manageOpen; renderManage(); }
      else if (act === 'mgmt') { UI.mgmt = b.getAttribute('data-mgmt'); UI.manageOpen = true; renderManage(); }
      else if (act === 'save-day') {
        var date = $$('sc-day-date').value;
        if (!date || date.slice(0, 4) !== String(curYearOf())) { notify('اختار تاريخًا من السنة الحالية.', 'error'); return; }
        UI.dayDate = date;
        if (saveDay(date, readVals($$('sc-day-grid')))) notify('تم حفظ يوم ' + date);
        renderAll();
      }
      else if (act === 'clear-day') {
        var d2 = $$('sc-day-date').value;
        if (d2 && saveDay(d2, {})) notify('تم مسح يوم ' + d2);
        renderAll();
      }
      else if (act === 'save-ref') {
        var r = saveMonthRef(UI.refYear, UI.refMonth, readRefVals());
        if (r !== false) notify('تم حفظ ' + r + ' يوم من ' + MONTHS_AR[UI.refMonth - 1] + ' ' + UI.refYear);
        renderAll();
      }
      else if (act === 'review') { UI.reviewOpen = !UI.reviewOpen; renderAll(); }
      else if (act === 'approve') {
        if (window.askOk) { askOk('اعتماد وقفل سنة ' + UI.refYear + '؟\nبعد القفل لن تُعدّل الأرقام إلا بفك القفل بسبب موثّق.').then(function (ok) { if (ok && approveYear(UI.refYear)) renderAll(); }); }
        else if (approveYear(UI.refYear)) renderAll();
      }
      else if (act === 'unlock') {
        var reason = $$('sc-unlock-reason').value.trim();
        if (reason.length < 5) { notify('اكتب سبب القفل بوضوح (5 أحرف على الأقل) قبل فك القفل.', 'error'); return; }
        if (window.askOk) { askOk('فك قفل سنة ' + UI.refYear + '؟\nالسبب: ' + reason).then(function (ok) { if (ok && unlockYear(UI.refYear, reason)) { $$('sc-unlock-reason').value = ''; renderAll(); } }); }
        else if (unlockYear(UI.refYear, reason)) renderAll();
      }
    });
    ROOT.addEventListener('change', function (e) {
      var t = e.target;
      var act = t.getAttribute && t.getAttribute('data-act');
      if (act === 'day-date') { UI.dayDate = t.value; renderDayForm(); }
      if (act === 'ref-pick') {
        UI.refYear = Number($$('sc-ref-year').value); UI.refMonth = Number($$('sc-ref-month').value);
        UI.reviewOpen = false; renderRefForm(); renderReview();
      }
    });
  }

  function readRefVals() {
    var rows = {};
    ROOT.querySelectorAll('#sc-ref-grid input[data-day]').forEach(function (inp) {
      var d = Number(inp.getAttribute('data-day')), k = inp.getAttribute('data-ch'), f = inp.getAttribute('data-f');
      rows[d] = rows[d] || {};
      rows[d][k] = rows[d][k] || {};
      rows[d][k][f] = inp.value === '' ? null : inp.value;
    });
    return rows;
  }

  function mount(container) {
    if (ROOT) return;
    buildSkeleton(container);
    UI.month = activeMonth;
    var mi = $$('month-input');
    if (mi) mi.addEventListener('change', function () { if (ROOT) { UI.month = activeMonth; renderAll(); } });
    window.addEventListener('kansas-channels-changed', function () { if (ROOT) renderAll(); });
    renderAll();
  }


  /* ---------- عرض ملخص قنوات البيع (يُستدعى من خريطة الأداء العام) ---------- */
  function tipAttr(t) { return ' data-tip="' + esc(t) + '"'; }
  function svgEl(w, h, inner, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" preserveAspectRatio="xMidYMid meet">' + inner + '</svg>';
  }
  function summaryHTML(R) {
    var T = R.total;
    var kpis = [
      { k: 'إيراد القنوات الحالي (أيام متطابقة)', v: T.cRev === null ? '—' : num0(T.cRev) + ' ج.م', t: 'مجموع إيراد القنوات الخمس للأيام المتطابقة فقط' },
      { k: 'إيراد نفس الأيام السنة السابقة', v: T.rRev === null ? '—' : num0(T.rRev) + ' ج.م', t: 'نفس الأيام المتطابقة من السنة المرجعية' },
      { k: 'تغيّر الإيراد', v: pct(T.revPct), t: '(الحالي − المرجعي) ÷ المرجعي على الأيام المتطابقة' },
      { k: 'تغيّر العمليات', v: T.cOrd === null ? '—' : pct(T.rOrd > 0 ? (T.cOrd - T.rOrd) / T.rOrd * 100 : null), t: 'فرق عدد العمليات على الأيام المتطابقة' },
      { k: 'تغيّر متوسط الفاتورة', v: pct(T.tickPct), t: 'متوسط الفاتورة = الإيراد ÷ عدد العمليات' }
    ];
    var kpiHTML = '<div class="pm-kpis pm-kpis-ch">' + kpis.map(function (k) {
      return '<div class="pm-kpi"' + tipAttr(k.t) + '><span>' + k.k + '</span><b>' + esc(k.v) + '</b></div>';
    }).join('') + '</div>';

    var notes = [];
    notes.push(R.matchedDays ? 'المقارنة على ' + R.matchedDays + ' يوم متطابق فقط.' : 'لا توجد أيام متطابقة بعد. سجّل بيانات اليوم والسنة المرجعية من تبويب قنوات البيع.');
    if (R.curRecorded < R.elapsed) notes.push('الفترة الحالية غير مكتملة: ' + R.curRecorded + ' يوم مسجّل من ' + R.elapsed + ' يوم حتى التاريخ.');
    if (R.refRecorded < R.n - R.invalidRef) notes.push('الشهر المرجعي غير مكتمل: ' + R.refRecorded + ' يوم مسجّل.');
    if (R.refStatus !== 'approved') notes.push('السنة المرجعية غير مقفولة بعد.');
    var noteHTML = '<div class="pm-sline">' + esc(notes.join(' ')) + '</div>';

    var chans = R.channels.filter(function (c) { return c.revPct !== null; });
    var maxAbs = chans.reduce(function (m, c) { return Math.max(m, Math.abs(c.revPct)); }, 0) || 1;
    var bars = chans.length ? chans.map(function (c) {
      var w = Math.min(Math.abs(c.revPct) / maxAbs * 50, 50), neg = c.revPct < 0;
      var tip = c.n + ' · الحالي ' + num0(c.cRev) + ' ج.م · المرجعي ' + num0(c.rRev) + ' ج.م · ' + pct(c.revPct);
      return '<div class="pm-vrow"' + tipAttr(tip) + '><span class="pm-vname">' + esc(c.n) + '</span>' +
        '<div class="pm-vtrack"><div class="pm-vmid"></div><div class="pm-vfill ' + (neg ? 'pm-neg' : 'pm-pos') + '" style="' + (neg ? 'right:50%;width:' : 'left:50%;width:') + w.toFixed(1) + '%"></div></div>' +
        '<b class="' + (neg ? 'neg' : 'pos') + '">' + ltr(pct(c.revPct)) + '</b></div>';
    }).join('') : '<p class="pm-muted">لا توجد قناة بأيام متطابقة لحساب النسبة.</p>';

    var daily = R.daily.filter(function (x) { return x.diff !== null; });
    var dailyHTML;
    if (!daily.length) {
      dailyHTML = '<p class="pm-muted">لا يوجد فرق يومي لعرضه بعد.</p>';
    } else {
      var W = 720, H = 180, padL = 40, padR = 12, padT = 12, padB = 24, mid = (H - padT - padB) / 2 + padT;
      var n = R.n, mx = daily.reduce(function (m, x) { return Math.max(m, Math.abs(x.diff)); }, 0) || 1;
      var bw = (W - padL - padR) / n * 0.6;
      var g = '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + mid + '" y2="' + mid + '" class="pm-grid"/>';
      R.daily.forEach(function (x) {
        if (x.diff === null) return;
        var cx = padL + (x.d - 0.5) * (W - padL - padR) / n;
        var h = Math.abs(x.diff) / mx * ((H - padT - padB) / 2 - 4);
        var y = x.diff >= 0 ? mid - h : mid;
        var tip = x.cur + ' · الحالي ' + num0(x.cRev) + ' · المرجعي ' + num0(x.rRev) + ' · الفرق ' + (x.diff > 0 ? '+' : '') + num0(x.diff);
        g += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(h, 1).toFixed(1) + '" class="pm-dbar ' + (x.diff >= 0 ? 'pos' : 'neg') + ' pm-hit"' + tipAttr(tip) + '/>';
      });
      for (var d = 1; d <= n; d += 5) {
        var tx = padL + (d - 0.5) * (W - padL - padR) / n;
        g += '<text x="' + tx.toFixed(1) + '" y="' + (H - 6) + '" class="pm-ax" text-anchor="middle">' + d + '</text>';
      }
      dailyHTML = svgEl(W, H, g, 'pm-chart');
    }

    return '<div class="pm-ct"><h4>قنوات البيع: الحالي مقابل نفس الشهر من السنة السابقة</h4></div>' + kpiHTML + noteHTML +
      '<div class="pm-grid2" style="margin-top:12px"><div><div class="pm-ct"><h4>تغيّر الإيراد لكل قناة</h4></div><div class="pm-vbars">' + bars + '</div></div>' +
      '<div><div class="pm-ct"><h4>الفرق اليومي في الإيراد (ج.م)</h4></div>' + dailyHTML + '</div></div>';
  }

  /* يُستدعى من خريطة الأداء العام ويكتب داخل العنصر الذي تمرّره فقط */
  function renderSummary(el, month) {
    if (!el) return;
    try { el.innerHTML = summaryHTML(compare(month)); }
    catch (err) { el.innerHTML = '<p class="pm-muted">تعذر عرض قنوات البيع: ' + esc(err && err.message ? err.message : err) + '</p>'; }
  }

  function open(container) {
    if (!ROOT) { mount(container); return; }
    renderAll();
  }

  window.KansasSalesChannels = {
    CHANNELS: CH,
    summary: summary,
    compare: compare,
    renderSummary: renderSummary,
    mount: mount,
    open: open,
    _saveDay: saveDay,
    _saveMonthRef: saveMonthRef,
    _approveYear: approveYear,
    _unlockYear: unlockYear,
    _load: load
  };
})();
