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

  /* ---------- قراءة لملخص السنة المرجعية (للاستخدام في خريطة الأداء) ---------- */

  /* ---------- الكتابة (من واجهة القنوات فقط) ---------- */
  function isNum(x) { return x !== null && x !== undefined && isFinite(x); }
  function todayParts() { var t = todayStr(); return { ym: t.slice(0, 7), day: Number(t.slice(8, 10)) }; }
  function periodDefault() {
    var m = activeMonth, tp = todayParts(), n = daysIn(m);
    return { month: m, endDay: Math.max(1, Math.min(tp.ym === m ? tp.day : n, n)) };
  }
  function getPeriod(o) {
    var p = o && o.period;
    if (!p || !/^\d{4}-\d{2}$/.test(String(p.month))) return periodDefault();
    var n = daysIn(p.month);
    return { month: p.month, endDay: Math.max(1, Math.min(Number(p.endDay) || n, n)) };
  }
  /* آخر يوم مسموح بالمقارنة: لا يتجاوز تاريخ النهاية المحدد، ولا يتجاوز اليوم الحالي */
  function periodInfo(p) {
    var tp = todayParts(), n = daysIn(p.month), e = Math.min(p.endDay, n);
    if (tp.ym === p.month) e = Math.min(e, tp.day);
    if (tp.ym < p.month) e = 0;
    var cy = Number(p.month.slice(0, 4)), ry = cy - 1, mm = p.month.slice(5, 7);
    return { month: p.month, cy: cy, ry: ry, requested: p.endDay, end: e,
      curStart: cy + '-' + mm + '-01', curEnd: e ? cy + '-' + mm + '-' + pad2(e) : null,
      refStart: ry + '-' + mm + '-01', refEnd: e ? ry + '-' + mm + '-' + pad2(e) : null };
  }

  /* المقارنة: الأيام المتطابقة فقط، حتى تاريخ النهاية المعتمد، مع نسب المساهمة */
  function compare() {
    var o = load();
    var p = getPeriod(o), I = periodInfo(p), mm = p.month.slice(5, 7);
    var rows = [], tot = {}, matchedDays = 0, lastDay = null, curRecorded = 0, refRecorded = 0, invalidRef = 0;
    CH.forEach(function (c) { tot[c.k] = { rRev: 0, cRev: 0, rOrd: 0, cOrd: 0, days: 0 }; });
    for (var d = 1; d <= I.end; d++) {
      var cur = I.cy + '-' + mm + '-' + pad2(d), ref = I.ry + '-' + mm + '-' + pad2(d);
      var refValid = new Date(Date.UTC(I.ry, Number(mm) - 1, d)).getUTCDate() === d;
      var curRec = dayRec(o, cur), refRec = refValid ? dayRec(o, ref) : null;
      if (hasChannelValue(curRec)) curRecorded++;
      if (refValid && hasChannelValue(refRec)) refRecorded++;
      if (!refValid) invalidRef++;
      var dayDiff = 0, counted = false, rowMatched = false;
      CH.forEach(function (c) {
        var a = curRec && curRec[c.k], b = refRec && refRec[c.k];
        if (a && b && isNum(a.rev) && isNum(a.ord) && isNum(b.rev) && isNum(b.ord)) {
          tot[c.k].cRev += a.rev; tot[c.k].cOrd += a.ord; tot[c.k].rRev += b.rev; tot[c.k].rOrd += b.ord; tot[c.k].days++;
          dayDiff += a.rev - b.rev; counted = true; rowMatched = true;
        }
      });
      if (rowMatched) { matchedDays++; lastDay = cur; }
      rows.push({ d: d, cur: cur, ref: ref, matched: rowMatched, diff: counted ? dayDiff : null, cRev: sumRev(curRec), rRev: refValid ? sumRev(refRec) : null });
    }
    var channels = CH.map(function (c) {
      var t = tot[c.k];
      return { k: c.k, n: c.n, days: t.days,
        rRev: t.days ? t.rRev : null, cRev: t.days ? t.cRev : null,
        rOrd: t.days ? t.rOrd : null, cOrd: t.days ? t.cOrd : null,
        rTick: t.rOrd > 0 ? t.rRev / t.rOrd : null, cTick: t.cOrd > 0 ? t.cRev / t.cOrd : null };
    });
    var sumR = channels.reduce(function (s, c) { return s + (c.rRev || 0); }, 0);
    var sumC = channels.reduce(function (s, c) { return s + (c.cRev || 0); }, 0);
    channels.forEach(function (c) {
      c.shareR = (isNum(c.rRev) && sumR > 0) ? c.rRev / sumR * 100 : null;
      c.shareC = (isNum(c.cRev) && sumC > 0) ? c.cRev / sumC * 100 : null;
      c.shareD = (isNum(c.shareR) && isNum(c.shareC)) ? c.shareC - c.shareR : null;
      c.revDiff = (isNum(c.rRev) && isNum(c.cRev)) ? c.cRev - c.rRev : null;
      c.revPct = (isNum(c.rRev) && c.rRev > 0) ? c.revDiff / c.rRev * 100 : null;
      c.ordDiff = (isNum(c.rOrd) && isNum(c.cOrd)) ? c.cOrd - c.rOrd : null;
      c.tickDiff = (isNum(c.rTick) && isNum(c.cTick)) ? c.cTick - c.rTick : null;
      c.tickPct = (isNum(c.tickDiff) && c.rTick > 0) ? c.tickDiff / c.rTick * 100 : null;
    });
    var T = { k: 'total', n: 'إجمالي القنوات الخمس', days: matchedDays,
      rRev: matchedDays ? sumR : null, cRev: matchedDays ? sumC : null,
      rOrd: matchedDays ? channels.reduce(function (s, c) { return s + (c.rOrd || 0); }, 0) : null,
      cOrd: matchedDays ? channels.reduce(function (s, c) { return s + (c.cOrd || 0); }, 0) : null };
    T.rTick = T.rOrd > 0 ? T.rRev / T.rOrd : null;
    T.cTick = T.cOrd > 0 ? T.cRev / T.cOrd : null;
    T.shareR = matchedDays && sumR > 0 ? 100 : null; T.shareC = matchedDays && sumC > 0 ? 100 : null; T.shareD = null;
    T.revDiff = (isNum(T.rRev) && isNum(T.cRev)) ? T.cRev - T.rRev : null;
    T.revPct = (isNum(T.rRev) && T.rRev > 0) ? T.revDiff / T.rRev * 100 : null;
    T.ordDiff = (isNum(T.rOrd) && isNum(T.cOrd)) ? T.cOrd - T.rOrd : null;
    T.tickDiff = (isNum(T.rTick) && isNum(T.cTick)) ? T.cTick - T.rTick : null;
    T.tickPct = (isNum(T.tickDiff) && T.rTick > 0) ? T.tickDiff / T.rTick * 100 : null;
    return {
      period: I, month: p.month, requestedEnd: p.endDay, refYear: I.ry, curYear: I.cy,
      refStatus: statusOfYear(o, I.ry), curStatus: statusOfYear(o, I.cy),
      n: daysIn(p.month), end: I.end, elapsed: I.end, curRecorded: curRecorded, refRecorded: refRecorded, invalidRef: invalidRef,
      matchedDays: matchedDays, lastDay: lastDay, channels: channels, total: T, daily: rows, broken: BROKEN
    };
  }
  function sumRev(rec) {
    if (!rec) return null;
    var s = 0, any = false;
    CH.forEach(function (c) { var v = rec[c.k]; if (v && isNum(v.rev)) { s += v.rev; any = true; } });
    return any ? s : null;
  }

  /* الفترة المعتمدة: تُحفظ في التخزين الخاص بالوحدة فقط، ولا تغيّر أي بيانات محفوظة */
  function setPeriod(month, endDay) {
    var o = load(); if (BROKEN) return store(o);
    var e = Number(endDay);
    if (!/^\d{4}-\d{2}$/.test(String(month)) || !(e >= 1)) { notify('اختر شهرًا ويوم نهاية صحيحين.', 'error'); return false; }
    var n = daysIn(month);
    o.period = { month: month, endDay: Math.min(e, n) };
    logAction(o, 'period', month.slice(0, 4), month + ' حتى ' + Math.min(e, n));
    if (!store(o)) return false;
    changed(); return true;
  }

  /* حالة اليوم: مسودة، أو محفوظ ومقفل، أو مفتوح للتعديل */
  function dayState(o, date) {
    var yo = o.years[date.slice(0, 4)];
    var saved = !!(yo && yo.days && yo.days[date]);
    if (!saved) return 'draft';
    if (yo.status === 'approved') return 'locked';
    return (yo.open && yo.open[date]) ? 'open' : 'locked';
  }
  function openDay(date) {
    var o = load(); if (BROKEN) return store(o);
    var yo = o.years[date.slice(0, 4)];
    if (!yo || !yo.days || !yo.days[date]) return true;
    if (yo.status === 'approved') { notify('السنة مقفولة. افتح قفل السنة أولًا بسبب موثّق.', 'error'); return false; }
    yo.open = yo.open || {}; yo.open[date] = true;
    logAction(o, 'open-day', date.slice(0, 4), date);
    if (!store(o)) return false;
    changed(); return true;
  }
  /* الحفظ الفعلي: لا يُستدعى إلا بعد المعاينة واعتماد الحفظ */
  function saveDays(year, list) {
    var o = load(); if (BROKEN) return store(o);
    var yo = yearObj(o, year);
    if (yo.status === 'approved') { notify('السنة مقفولة. افتح قفل السنة أولًا بسبب موثّق.', 'error'); return false; }
    list.forEach(function (it) {
      var rec = cleanRec(it.vals);
      if (rec) yo.days[it.date] = rec; else delete yo.days[it.date];
      if (yo.open) delete yo.open[it.date];
    });
    logAction(o, 'save', year, list.length + ' يوم');
    if (!store(o)) return false;
    changed(); return list.length;
  }
  function saveDay(date, vals) { return saveDays(Number(date.slice(0, 4)), [{ date: date, vals: vals }]) !== false; }
  function saveMonthRef(year, month, rowsVals) {
    var n = daysIn(year + '-' + pad2(month)), list = [];
    for (var d = 1; d <= n; d++) list.push({ date: year + '-' + pad2(month) + '-' + pad2(d), vals: rowsVals[d] || {} });
    return saveDays(year, list);
  }
  /* ---------- عناصر مساعدة للعرض ---------- */
  function ppTxt(x) { return x === null || x === undefined ? '—' : (x > 0 ? '▲ +' : (x < 0 ? '▼ −' : '● ')) + Math.abs(x).toFixed(1) + ' نقطة'; }
  function dec1(n) { return (n === null || n === undefined || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function signed(x, d) { if (!isNum(x)) return '—'; return (x > 0 ? '+' : (x < 0 ? '−' : '')) + Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: d === undefined ? 0 : d }); }
  function cellCls(x) { return !isNum(x) ? '' : (x > 0 ? 'sc-pos' : (x < 0 ? 'sc-neg' : '')); }
  function dateAr(s) { if (!s) return '—'; var p = s.split('-'); return Number(p[2]) + ' ' + (MONTHS_AR[Number(p[1]) - 1] || p[1]) + ' ' + p[0]; }
  function monthOptions(year, selected) {
    return MONTHS_AR.map(function (m, i) { var v = year + '-' + pad2(i + 1); return '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + m + ' ' + year + '</option>'; }).join('');
  }

  /* ---------- نافذة المعاينة قبل الحفظ النهائي ---------- */
  var PENDING = null;
  function closePreview() { var ov = $$('sc-ov'); if (ov) ov.parentNode.removeChild(ov); PENDING = null; }
  function openPreview(title, bodyHTML, onConfirm) {
    closePreview();
    var ov = document.createElement('div');
    ov.id = 'sc-ov'; ov.className = 'sc-overlay';
    ov.innerHTML = '<div class="sc-modal" role="dialog" aria-modal="true"><h3>' + esc(title) + '</h3><div class="sc-mbody">' + bodyHTML + '</div>' +
      '<div class="sc-mfoot"><button class="btn" data-pv="back">تعديل البيانات</button><button class="btn btn-gold" data-pv="ok">اعتماد وحفظ</button></div></div>';
    document.body.appendChild(ov);
    PENDING = onConfirm;
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { closePreview(); return; }
      var b = e.target.closest ? e.target.closest('[data-pv]') : null;
      if (!b) return;
      if (b.getAttribute('data-pv') === 'back') { closePreview(); return; }
      var fn = PENDING; closePreview();
      if (fn) fn();
    });
  }
  function dayPreviewHTML(date, vals) {
    var rec = cleanRec(vals), tRev = 0, tOrd = 0, anyRev = false, anyOrd = false, partial = false;
    var rows = CH.map(function (c) {
      var v = rec && rec[c.k];
      var rev = v && isNum(v.rev) ? v.rev : null, ord = v && isNum(v.ord) ? v.ord : null;
      if (rev !== null) { tRev += rev; anyRev = true; }
      if (ord !== null) { tOrd += ord; anyOrd = true; }
      if ((rev === null) !== (ord === null)) partial = true;
      var tick = (rev !== null && ord > 0) ? rev / ord : null;
      return '<tr><th>' + c.n + (rev === null && ord === null ? ' <em class="sc-muted">(لا بيانات)</em>' : ((rev === null) !== (ord === null) ? ' <em class="sc-warn">ناقص</em>' : '')) + '</th>' +
        '<td>' + ltr(num0(rev)) + '</td><td>' + ltr(num0(ord)) + '</td><td>' + ltr(num0(tick)) + '</td></tr>';
    }).join('');
    var tTick = (anyRev && anyOrd && tOrd > 0) ? tRev / tOrd : null;
    return '<p class="sc-note">التاريخ التشغيلي: <b>' + dateAr(date) + '</b> <bdi dir="ltr">(' + esc(date) + ')</bdi></p>' +
      '<div class="tbl-wrap"><table class="sc-tbl"><thead><tr><th>القناة</th><th>الإيراد</th><th>العمليات</th><th>متوسط الفاتورة</th></tr></thead><tbody>' + rows +
      '<tr class="sc-total"><th>الإجمالي</th><td>' + ltr(num0(anyRev ? tRev : null)) + '</td><td>' + ltr(num0(anyOrd ? tOrd : null)) + '</td><td>' + ltr(num0(tTick)) + '</td></tr></tbody></table></div>' +
      (partial ? '<p class="sc-warn">يوجد قناة بإيراد بدون عمليات أو العكس. راجعها قبل الاعتماد.</p>' : '') +
      (!rec ? '<p class="sc-warn">لا توجد بيانات في هذا اليوم: الاعتماد سيمسح بيانات اليوم المحفوظة إن وجدت.</p>' : '') +
      '<p class="sc-note">لن يتم الحفظ إلا بعد "اعتماد وحفظ"، وبعده يُقفل اليوم.</p>';
  }
  function refChanges() {
    var o = load(), yo = o.years[String(UI.refYear)] || { days: {}, open: {} };
    var n = daysIn(UI.refYear + '-' + pad2(UI.refMonth)), list = [];
    var vals = readRefVals();
    for (var d = 1; d <= n; d++) {
      var date = UI.refYear + '-' + pad2(UI.refMonth) + '-' + pad2(d);
      var st = dayState(o, date);
      if (st === 'locked') continue;
      var v = vals[d] || {};
      var hasAny = CH.some(function (c) { return v[c.k] && (v[c.k].rev !== '' && v[c.k].rev !== null || v[c.k].ord !== '' && v[c.k].ord !== null); });
      var wasSaved = !!(yo.days && yo.days[date]);
      if (hasAny || wasSaved) list.push({ date: date, vals: v });
    }
    return list;
  }
  function refPreviewHTML(list) {
    if (!list.length) return '<p class="sc-warn">لا توجد تغييرات لاعتمادها.</p>';
    var rows = list.map(function (it) {
      var rec = cleanRec(it.vals), rev = 0, ord = 0, any = false, partial = false;
      if (rec) CH.forEach(function (c) { var v = rec[c.k]; if (!v) return; if (isNum(v.rev)) { rev += v.rev; any = true; } if (isNum(v.ord)) ord += v.ord; if ((v.rev === null) !== (v.ord === null)) partial = true; });
      return '<tr><th>' + dateAr(it.date) + '</th><td>' + ltr(num0(rec ? (any ? rev : null) : null)) + '</td><td>' + ltr(num0(rec ? ord : null)) + '</td>' +
        '<td>' + (rec ? (partial ? '<span class="sc-warn">ناقص</span>' : 'مكتمل') : '<span class="sc-muted">سيُمسح</span>') + '</td></tr>';
    }).join('');
    return '<p class="sc-note">أيام سيتم حفظها وقفلها: <b>' + list.length + '</b></p>' +
      '<div class="tbl-wrap"><table class="sc-tbl"><thead><tr><th>اليوم</th><th>الإيراد</th><th>العمليات</th><th>الحالة</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
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




  function noteOf(R) {
    var parts = [];
    if (R.broken) parts.push('بيانات القنوات في المتصفح غير صالحة، المعروض فارغ.');
    if (!R.matchedDays) parts.push('لا توجد أيام متطابقة حتى تاريخ النهاية المحدد.');
    else parts.push('المقارنة على ' + R.matchedDays + ' يوم متطابق فقط.');
    if (R.curRecorded < R.end) parts.push('الفترة الحالية غير مكتملة: ' + R.curRecorded + ' يوم مسجّل من ' + R.end + ' يوم حتى تاريخ النهاية.');
    if (R.refRecorded < R.end) parts.push('الفترة المرجعية غير مكتملة: ' + R.refRecorded + ' يوم مسجّل من ' + R.end + '.');
    if (R.requestedEnd > R.end) parts.push('تم تقليص تاريخ النهاية إلى ' + R.end + ' لأن الأيام بعده لم تأتِ بعد.');
    if (R.refStatus !== 'approved') parts.push('السنة المرجعية غير مقفولة بعد.');
    return parts.join(' ');
  }
  function badges(R) {
    var txt = R.refStatus === 'approved' ? 'مقفولة ومعتمدة' : (R.refStatus === 'none' ? 'لا توجد بيانات' : 'مسودة (غير مقفولة)');
    var cls = R.refStatus === 'approved' ? 'sc-good' : (R.refStatus === 'none' ? 'sc-nd' : 'sc-watch');
    return '<div class="sc-badges"><span class="sc-chip ' + cls + '">السنة المرجعية ' + R.refYear + ': ' + txt + '</span></div>';
  }
  function periodBarHTML(R) {
    var I = R.period;
    return '<div class="sc-pbox">' +
      '<div><span>الفترة المرجعية</span><b>' + ltr(esc(dateAr(I.refStart))) + ' إلى ' + ltr(esc(dateAr(I.refEnd))) + '</b></div>' +
      '<div><span>الفترة الحالية</span><b>' + ltr(esc(dateAr(I.curStart))) + ' إلى ' + ltr(esc(dateAr(I.curEnd))) + '</b></div>' +
      '<div><span>آخر يوم تشغيلي مشمول</span><b>' + ltr(esc(dateAr(R.lastDay))) + '</b></div></div>';
  }
  function renderTable(R) {
    var head = '<thead><tr><th>البيان</th><th>السنة المرجعية (' + R.refYear + ')</th><th>السنة الحالية (' + R.curYear + ')</th><th>الفرق</th></tr></thead>';
    function block(c, isTotal) {
      var head = '<tr class="sc-chhead"><th colspan="4">' + esc(c.n) + (c.days ? '' : ' <em class="sc-muted">(لا أيام متطابقة)</em>') + '</th></tr>';
      var revRow = '<tr><th>الإيراد</th><td>' + ltr(num0(c.rRev)) + '</td><td>' + ltr(num0(c.cRev)) + '</td><td class="' + cellCls(c.revDiff) + '">' + ltr(signed(c.revDiff)) + (isNum(c.revPct) ? ' <em>(' + ltr(pct(c.revPct)) + ')</em>' : '') + '</td></tr>';
      var ordRow = '<tr><th>العمليات</th><td>' + ltr(num0(c.rOrd)) + '</td><td>' + ltr(num0(c.cOrd)) + '</td><td class="' + cellCls(c.ordDiff) + '">' + ltr(signed(c.ordDiff)) + '</td></tr>';
      var tickRow = '<tr><th>متوسط الفاتورة</th><td>' + ltr(dec1(c.rTick)) + '</td><td>' + ltr(dec1(c.cTick)) + '</td><td class="' + cellCls(c.tickDiff) + '">' + ltr(signed(c.tickDiff, 1)) + (isNum(c.tickPct) ? ' <em>(' + ltr(pct(c.tickPct)) + ')</em>' : '') + '</td></tr>';
      var shareRow = '<tr><th>نسبة مساهمة القناة</th><td>' + ltr(isNum(c.shareR) ? c.shareR.toFixed(1) + '%' : '—') + '</td><td>' + ltr(isNum(c.shareC) ? c.shareC.toFixed(1) + '%' : '—') + '</td><td class="' + cellCls(c.shareD) + '">' + ltr(ppTxt(c.shareD)) + '</td></tr>';
      return head + revRow + ordRow + tickRow + shareRow;
    }
    var body = R.channels.map(function (c) { return block(c, false); }).join('');
    var tot = R.total;
    var totHead = '<tr class="sc-chhead sc-total"><th colspan="4">' + esc(tot.n) + '</th></tr>';
    var totRows = '<tr class="sc-total"><th>الإيراد</th><td>' + ltr(num0(tot.rRev)) + '</td><td>' + ltr(num0(tot.cRev)) + '</td><td class="' + cellCls(tot.revDiff) + '">' + ltr(signed(tot.revDiff)) + (isNum(tot.revPct) ? ' <em>(' + ltr(pct(tot.revPct)) + ')</em>' : '') + '</td></tr>' +
      '<tr class="sc-total"><th>العمليات</th><td>' + ltr(num0(tot.rOrd)) + '</td><td>' + ltr(num0(tot.cOrd)) + '</td><td class="' + cellCls(tot.ordDiff) + '">' + ltr(signed(tot.ordDiff)) + '</td></tr>' +
      '<tr class="sc-total"><th>متوسط الفاتورة</th><td>' + ltr(dec1(tot.rTick)) + '</td><td>' + ltr(dec1(tot.cTick)) + '</td><td class="' + cellCls(tot.tickDiff) + '">' + ltr(signed(tot.tickDiff, 1)) + (isNum(tot.tickPct) ? ' <em>(' + ltr(pct(tot.tickPct)) + ')</em>' : '') + '</td></tr>';
    return '<table class="sc-tbl">' + head + '<tbody>' + body + totHead + totRows + '</tbody></table>';
  }
  function renderPeriod(R) {
    var mi = $$('sc-p-month'), ei = $$('sc-p-end');
    if (!mi || !ei) return;
    var I = R.period;
    if (document.activeElement !== mi) mi.innerHTML = monthOptions(I.cy, I.month);
    if (document.activeElement !== ei) { ei.value = String(I.end || R.requestedEnd || 1); }
    ei.max = String(daysIn(I.month));
    $$('sc-p-info').innerHTML = periodBarHTML(R) + '<p class="sc-note">' + esc('الفترة المعتمدة هنا هي نفسها المستخدمة في خريطة الأداء العام.') + '</p>';
  }
  function renderMain() {
    var R = compare();
    $$('sc-month').textContent = monthLabel(R.month);
    $$('sc-badges').innerHTML = badges(R);
    renderPeriod(R);
    $$('sc-note').textContent = noteOf(R);
    $$('sc-table-wrap').innerHTML = renderTable(R);
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

  function renderDayForm() {
    var date = UI.dayDate || (activeMonth + '-01');
    if (date.slice(0, 4) !== String(curYearOf())) date = activeMonth + '-01';
    UI.dayDate = date;
    $$('sc-day-date').value = date;
    $$('sc-day-date').min = curYearOf() + '-01-01'; $$('sc-day-date').max = curYearOf() + '-12-31';
    var o = load(), yo = o.years[date.slice(0, 4)] || { status: 'draft' };
    var rec = dayRec(o, date) || {};
    var st = dayState(o, date), approved = yo.status === 'approved';
    var editable = !approved && (st === 'draft' || st === 'open');
    var label = approved ? 'السنة مقفولة' : (st === 'locked' ? 'محفوظ ومقفل' : (st === 'open' ? 'مفتوح للتعديل: يلزم المعاينة قبل الحفظ' : 'مسودة: لم يتم الحفظ بعد'));
    var cls = (approved || st === 'locked') ? 'sc-good' : (st === 'open' ? 'sc-watch' : 'sc-nd');
    $$('sc-day-status').innerHTML = '<span class="sc-chip ' + cls + '">' + label + '</span>';
    $$('sc-day-grid').innerHTML = CH.map(function (c) {
      var v = rec[c.k] || {};
      var dis = editable ? '' : ' disabled';
      return '<div class="sc-chrow"><span>' + c.n + '</span>' +
        '<label>إيراد <input type="number" min="0" step="any" inputmode="decimal" data-ch="' + c.k + '" data-f="rev" value="' + (isNum(v.rev) ? v.rev : '') + '"' + dis + '></label>' +
        '<label>عمليات <input type="number" min="0" step="1" inputmode="numeric" data-ch="' + c.k + '" data-f="ord" value="' + (isNum(v.ord) ? v.ord : '') + '"' + dis + '></label></div>';
    }).join('');
    $$('sc-day-open').style.display = (st === 'locked' && !approved) ? '' : 'none';
    $$('sc-day-preview').disabled = !editable;
  }

  function renderRefForm() {
    var sel = $$('sc-ref-year'), cy = curYearOf(), opts = [];
    for (var y = cy - 1; y >= cy - 3; y--) opts.push('<option value="' + y + '">' + y + '</option>');
    sel.innerHTML = opts.join('');
    if (!UI.refYear) UI.refYear = cy - 1;
    sel.value = String(UI.refYear);
    var ms = $$('sc-ref-month');
    ms.innerHTML = MONTHS_AR.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + '</option>'; }).join('');
    if (!UI.refMonth) UI.refMonth = Number(activeMonth.slice(5, 7));
    ms.value = String(UI.refMonth);
    var o = load(), yo = o.years[String(UI.refYear)] || { days: {}, status: 'none' };
    var approved = yo.status === 'approved';
    $$('sc-ref-lock-note').textContent = approved
      ? 'السنة مقفولة. لتعديل أي يوم افتح قفل السنة بسبب موثّق.'
      : 'كل يوم يُحفظ يُقفل تلقائيًا. لتعديل يوم محفوظ استخدم "فتح" بجانبه، ثم معاينة واعتماد.';
    $$('sc-ref-unlock-box').style.display = approved ? '' : 'none';
    $$('sc-ref-approve').disabled = approved;
    $$('sc-ref-preview').disabled = approved;
    var n = daysIn(UI.refYear + '-' + pad2(UI.refMonth)), rows = [];
    for (var d = 1; d <= n; d++) {
      var date = UI.refYear + '-' + pad2(UI.refMonth) + '-' + pad2(d);
      var rec = (yo.days && yo.days[date]) || {};
      var st = dayState(o, date);
      var dis = (approved || st === 'locked') ? ' disabled' : '';
      var cells = CH.map(function (c) {
        var v = rec[c.k] || {};
        return '<td><input type="number" min="0" step="any" data-day="' + d + '" data-ch="' + c.k + '" data-f="rev" value="' + (isNum(v.rev) ? v.rev : '') + '"' + dis + '></td>' +
          '<td><input type="number" min="0" step="1" data-day="' + d + '" data-ch="' + c.k + '" data-f="ord" value="' + (isNum(v.ord) ? v.ord : '') + '"' + dis + '></td>';
      }).join('');
      var action = (st === 'locked' && !approved)
        ? '<button class="btn btn-slate" data-act="open-ref-day" data-day="' + d + '">فتح</button>'
        : '<span class="sc-muted">' + (st === 'open' ? 'مفتوح' : (st === 'locked' ? 'مقفل' : '')) + '</span>';
      rows.push('<tr><th>' + d + '</th>' + cells + '<td>' + action + '</td></tr>');
    }
    var headCells = CH.map(function (c) { return '<th colspan="2">' + c.n + '</th>'; }).join('');
    var subCells = CH.map(function () { return '<th>إيراد</th><th>عمليات</th>'; }).join('');
    $$('sc-ref-grid').innerHTML = '<table class="sc-entry"><thead><tr><th rowspan="2">اليوم</th>' + headCells + '<th rowspan="2">الحالة</th></tr><tr>' + subCells + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
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



  /* ---------- عرض ملخص قنوات البيع (يُستدعى من خريطة الأداء العام) ---------- */
  function tipAttr(t) { return ' data-tip="' + esc(t) + '"'; }
  function svgEl(w, h, inner, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" preserveAspectRatio="xMidYMid meet">' + inner + '</svg>';
  }

  /* يُستدعى من خريطة الأداء العام ويكتب داخل العنصر الذي تمرّره فقط */
  function buildSkeleton(container) {
    ROOT = document.createElement('div');
    ROOT.className = 'sc-root';
    ROOT.innerHTML =
      '<header class="sc-head"><div><div class="sc-kicker">SALES CHANNELS</div><h2>قنوات البيع</h2>' +
      '<p class="sc-sub">مقارنة الشهر <b id="sc-month"></b> بنفس الشهر من السنة السابقة، يومًا بيوم</p></div><div id="sc-badges"></div></header>' +
      '<div class="sc-card sc-period"><div class="sc-ct"><h4>فترة المقارنة</h4><span class="sc-muted">المصدر الوحيد لجدول القنوات وخريطة الأداء</span></div>' +
        '<div class="sc-row"><label>الشهر التشغيلي <select id="sc-p-month" class="inp sm" data-act="period-month"></select></label>' +
        '<label>حتى يوم <input type="number" id="sc-p-end" min="1" max="31" class="inp sm"></label>' +
        '<button class="btn" data-act="apply-period">تطبيق الفترة</button></div>' +
        '<div id="sc-p-info"></div></div>' +
      '<div class="sc-card"><div class="sc-ct"><h4>جدول المقارنة</h4></div>' +
      '<p class="sc-note" id="sc-note"></p><div class="tbl-wrap" id="sc-table-wrap"></div></div>' +
      '<div class="sc-toggle"><button class="btn" data-act="toggle-manage" id="sc-toggle">إدارة البيانات</button></div>' +
      '<div class="sc-card" id="sc-manage" style="display:none">' +
        '<div class="sc-mtabs"><button class="btn" data-mgmt="day" data-act="mgmt">بيانات اليوم (السنة الحالية)</button><button class="btn" data-mgmt="ref" data-act="mgmt">السنة المرجعية</button></div>' +
        '<div id="sc-m-day">' +
          '<div class="sc-row"><label>التاريخ <input type="date" id="sc-day-date" class="inp sm" data-act="day-date"></label><span id="sc-day-status"></span></div>' +
          '<div id="sc-day-grid" class="sc-daygrid"></div>' +
          '<div class="sc-row"><button class="btn" id="sc-day-preview" data-act="preview-day">معاينة قبل الحفظ</button>' +
          '<button class="btn btn-slate" id="sc-day-open" data-act="open-day" style="display:none">فتح تعديل اليوم</button></div>' +
        '</div>' +
        '<div id="sc-m-ref" style="display:none">' +
          '<div class="sc-row"><label>السنة <select id="sc-ref-year" class="inp sm" data-act="ref-pick"></select></label>' +
          '<label>الشهر <select id="sc-ref-month" class="inp sm" data-act="ref-pick"></select></label></div>' +
          '<p class="sc-note" id="sc-ref-lock-note"></p>' +
          '<div class="sc-row"><button class="btn" id="sc-ref-preview" data-act="preview-ref">معاينة الأيام المعدّلة</button>' +
          '<button class="btn btn-slate" id="sc-ref-review" data-act="review">مراجعة السنة</button>' +
          '<button class="btn" id="sc-ref-approve" data-act="approve">اعتماد وقفل السنة</button></div>' +
          '<div id="sc-review" style="display:none"></div>' +
          '<div id="sc-ref-unlock-box" class="sc-unlock" style="display:none"><label>سبب فك قفل السنة (إلزامي)<input type="text" id="sc-unlock-reason" class="inp" maxlength="160"></label>' +
          '<button class="btn btn-slate" data-act="unlock">فك قفل السنة</button></div>' +
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
      else if (act === 'apply-period') {
        var ok = setPeriod($$('sc-p-month').value, $$('sc-p-end').value);
        if (ok) notify('تم تطبيق فترة المقارنة');
        renderAll();
      }
      else if (act === 'preview-day') {
        var date = $$('sc-day-date').value;
        if (!date || date.slice(0, 4) !== String(curYearOf())) { notify('اختر تاريخًا من السنة الحالية.', 'error'); return; }
        var vals = readVals($$('sc-day-grid'));
        UI.dayDate = date;
        openPreview('معاينة يوم ' + dateAr(date), dayPreviewHTML(date, vals), function () {
          if (saveDay(date, vals)) notify('تم حفظ يوم ' + dateAr(date) + ' وقفله');
          renderAll();
        });
      }
      else if (act === 'open-day') {
        var d2 = $$('sc-day-date').value;
        if (window.askOk) askOk('فتح تعديل يوم محفوظ ومقفل: ' + dateAr(d2) + '؟\nلن يُحفظ التعديل إلا بعد المعاينة والاعتماد.').then(function (ok2) { if (ok2 && openDay(d2)) renderAll(); });
        else if (openDay(d2)) renderAll();
      }
      else if (act === 'open-ref-day') {
        var rd = UI.refYear + '-' + pad2(UI.refMonth) + '-' + pad2(Number(b.getAttribute('data-day')));
        if (window.askOk) askOk('فتح تعديل يوم محفوظ ومقفل: ' + dateAr(rd) + '؟').then(function (ok3) { if (ok3 && openDay(rd)) renderAll(); });
        else if (openDay(rd)) renderAll();
      }
      else if (act === 'preview-ref') {
        var list = refChanges();
        if (!list.length) { notify('لا توجد تغييرات لمعاينتها.', 'error'); return; }
        openPreview('معاينة السنة ' + UI.refYear + ' قبل الحفظ', refPreviewHTML(list), function () {
          var r = saveDays(UI.refYear, list);
          if (r !== false) notify('تم حفظ وقفل ' + r + ' يوم');
          renderAll();
        });
      }
      else if (act === 'review') { UI.reviewOpen = !UI.reviewOpen; renderAll(); }
      else if (act === 'approve') {
        if (window.askOk) askOk('اعتماد وقفل سنة ' + UI.refYear + '؟\nبعد القفل لن تُعدّل الأيام إلا بفك القفل بسبب موثّق.').then(function (ok4) { if (ok4 && approveYear(UI.refYear)) renderAll(); });
        else if (approveYear(UI.refYear)) renderAll();
      }
      else if (act === 'unlock') {
        var reason = $$('sc-unlock-reason').value.trim();
        if (reason.length < 5) { notify('اكتب سبب فك القفل بوضوح (5 أحرف على الأقل).', 'error'); return; }
        if (window.askOk) askOk('فك قفل سنة ' + UI.refYear + '؟\nالسبب: ' + reason).then(function (ok5) { if (ok5 && unlockYear(UI.refYear, reason)) { $$('sc-unlock-reason').value = ''; renderAll(); } });
        else if (unlockYear(UI.refYear, reason)) renderAll();
      }
    });
    ROOT.addEventListener('change', function (e) {
      var t = e.target, act = t.getAttribute && t.getAttribute('data-act');
      if (act === 'day-date') { UI.dayDate = t.value; renderDayForm(); }
      if (act === 'ref-pick') { UI.refYear = Number($$('sc-ref-year').value); UI.refMonth = Number($$('sc-ref-month').value); UI.reviewOpen = false; renderRefForm(); renderReview(); }
      if (act === 'period-month') { $$('sc-p-end').max = String(daysIn(t.value)); }
    });
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


  /* ---------- عرض قنوات البيع داخل خريطة الأداء العام (نفس الفترة المعتمدة) ---------- */
  function donutSVG(parts, center) {
    var total = parts.reduce(function (s, p) { return s + (isNum(p.v) ? p.v : 0); }, 0);
    if (!total) return '<p class="pm-muted">لا توجد أيام متطابقة لهذه الفترة.</p>';
    var R = 56, C = 2 * Math.PI * R, off = 0, g = '';
    parts.forEach(function (p) {
      if (!isNum(p.v) || p.v <= 0) return;
      var len = p.v / total * C;
      g += '<circle r="' + R + '" cx="80" cy="80" fill="none" class="sc-seg sc-c-' + p.k + '" stroke-width="18" stroke-dasharray="' + len.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"' + tipAttr(p.n + ': ' + p.v.toFixed(1) + '%') + '/>';
      off += len;
    });
    g += '<text x="80" y="86" text-anchor="middle" class="pm-dn-big">' + esc(center) + '</text>';
    return svgEl(160, 160, g, 'sc-donut');
  }
  function shareListHTML(R) {
    return '<div class="sc-share">' + R.channels.map(function (c) {
      if (!isNum(c.shareD)) return '<div class="sc-srow"><span class="sc-sdot sc-c-' + c.k + '"></span><span>' + esc(c.n) + '</span><em class="pm-muted">لا توجد أيام متطابقة</em></div>';
      var cls = c.shareD > 0 ? 'pos' : (c.shareD < 0 ? 'neg' : '');
      var tip = c.n + ': من ' + c.shareR.toFixed(1) + '% إلى ' + c.shareC.toFixed(1) + '% (' + ppTxt(c.shareD) + ')';
      return '<div class="sc-srow"' + tipAttr(tip) + '><span class="sc-sdot sc-c-' + c.k + '"></span><span>' + esc(c.n) + '</span>' +
        '<b>' + ltr('من ' + c.shareR.toFixed(1) + '% إلى ' + c.shareC.toFixed(1) + '%') + '</b><b class="' + cls + '">' + ltr(ppTxt(c.shareD)) + '</b></div>';
    }).join('') + '</div>';
  }
  function summaryHTML(R) {
    var T = R.total;
    var kpis = [
      { k: 'إيراد القنوات الحالي (أيام متطابقة)', v: T.cRev === null ? '—' : num0(T.cRev) + ' ج.م', t: 'مجموع إيراد القنوات الخمس للأيام المتطابقة حتى تاريخ النهاية' },
      { k: 'إيراد نفس الأيام من السنة المرجعية', v: T.rRev === null ? '—' : num0(T.rRev) + ' ج.م', t: 'نفس الأيام المتطابقة من السنة المرجعية' },
      { k: 'تغيّر الإيراد', v: pct(T.revPct), t: '(الحالي − المرجعي) ÷ المرجعي' },
      { k: 'تغيّر العمليات', v: T.cOrd === null ? '—' : pct(T.rOrd > 0 ? (T.cOrd - T.rOrd) / T.rOrd * 100 : null), t: 'فرق عدد العمليات على الأيام المتطابقة' },
      { k: 'تغيّر متوسط الفاتورة', v: pct(T.tickPct), t: 'متوسط الفاتورة = الإيراد ÷ عدد العمليات' }
    ];
    var kpiHTML = '<div class="pm-kpis pm-kpis-ch">' + kpis.map(function (k) {
      return '<div class="pm-kpi"' + tipAttr(k.t) + '><span>' + k.k + '</span><b>' + esc(k.v) + '</b></div>';
    }).join('') + '</div>';

    var notes = [];
    notes.push(R.matchedDays ? 'المقارنة على ' + R.matchedDays + ' يوم متطابق فقط.' : 'لا توجد أيام متطابقة بعد حتى تاريخ النهاية المحدد.');
    if (R.curRecorded < R.end) notes.push('الفترة الحالية غير مكتملة: ' + R.curRecorded + ' يوم مسجّل من ' + R.end + '.');
    if (R.refRecorded < R.end) notes.push('الفترة المرجعية غير مكتملة: ' + R.refRecorded + ' يوم مسجّل من ' + R.end + '.');
    if (R.refStatus !== 'approved') notes.push('السنة المرجعية غير مقفولة بعد.');
    var noteHTML = '<div class="pm-sline">' + esc(notes.join(' ')) + '</div>';

    var mix = '<div class="sc-dgrid">' +
      '<div><div class="pm-ct"><h4>مزيج القنوات: السنة المرجعية</h4></div>' + donutSVG(R.channels.map(function (c) { return { k: c.k, n: c.n, v: c.shareR }; }), 'مرجعي') + '</div>' +
      '<div><div class="pm-ct"><h4>مزيج القنوات: السنة الحالية</h4></div>' + donutSVG(R.channels.map(function (c) { return { k: c.k, n: c.n, v: c.shareC }; }), 'حالي') + '</div>' +
      '<div><div class="pm-ct"><h4>من ارتفع ومن انخفض في الحصة</h4></div>' + shareListHTML(R) + '</div></div>';

    var chans = R.channels.filter(function (c) { return isNum(c.revPct); });
    var maxAbs = chans.reduce(function (m, c) { return Math.max(m, Math.abs(c.revPct)); }, 0) || 1;
    var bars = chans.length ? chans.map(function (c) {
      var w = Math.min(Math.abs(c.revPct) / maxAbs * 50, 50), neg = c.revPct < 0;
      var tip = c.n + ' · الحالي ' + num0(c.cRev) + ' ج.م · المرجعي ' + num0(c.rRev) + ' ج.م · ' + pct(c.revPct);
      return '<div class="pm-vrow"' + tipAttr(tip) + '><span class="pm-vname">' + esc(c.n) + '</span>' +
        '<div class="pm-vtrack"><div class="pm-vmid"></div><div class="pm-vfill ' + (neg ? 'pm-neg' : 'pm-pos') + '" style="' + (neg ? 'right:50%;width:' : 'left:50%;width:') + w.toFixed(1) + '%"></div></div>' +
        '<b class="' + (neg ? 'neg' : 'pos') + '">' + ltr(pct(c.revPct)) + '</b></div>';
    }).join('') : '<p class="pm-muted">لا توجد قناة بأيام متطابقة لحساب النسبة.</p>';

    var daily = R.daily.filter(function (x) { return isNum(x.diff); });
    var dailyHTML;
    if (!daily.length) {
      dailyHTML = '<p class="pm-muted">لا يوجد فرق يومي لعرضه بعد.</p>';
    } else {
      var W = 720, H = 180, padL = 40, padR = 12, padT = 12, padB = 24, mid = (H - padT - padB) / 2 + padT;
      var n = R.n, mx = daily.reduce(function (m, x) { return Math.max(m, Math.abs(x.diff)); }, 0) || 1;
      var bw = (W - padL - padR) / n * 0.6;
      var g = '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + mid + '" y2="' + mid + '" class="pm-grid"/>';
      R.daily.forEach(function (x) {
        if (!isNum(x.diff)) return;
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

    var I = R.period;
    var periodBox = '<div class="sc-pbox">' +
      '<div><span>الفترة المرجعية</span><b>' + ltr(esc(dateAr(I.refStart))) + ' إلى ' + ltr(esc(dateAr(I.refEnd))) + '</b></div>' +
      '<div><span>الفترة الحالية</span><b>' + ltr(esc(dateAr(I.curStart))) + ' إلى ' + ltr(esc(dateAr(I.curEnd))) + '</b></div>' +
      '<div><span>آخر يوم تشغيلي مشمول</span><b>' + ltr(esc(dateAr(R.lastDay))) + '</b></div></div>';

    return '<div class="pm-ct"><h4>قنوات البيع: الحالي مقابل نفس الفترة من السنة السابقة</h4></div>' +
      periodBox + kpiHTML + noteHTML + mix +
      '<div class="pm-grid2" style="margin-top:12px"><div><div class="pm-ct"><h4>تغيّر الإيراد لكل قناة</h4></div><div class="pm-vbars">' + bars + '</div></div>' +
      '<div><div class="pm-ct"><h4>الفرق اليومي في الإيراد (ج.م)</h4></div>' + dailyHTML + '</div></div>';
  }

  /* تُستدعى من خريطة الأداء العام بدون تمرير فترة: الفترة تُقرأ من مصدرها الوحيد */
  function renderSummary(el) {
    if (!el) return;
    try { el.innerHTML = summaryHTML(compare()); }
    catch (err) { el.innerHTML = '<p class="pm-muted">تعذر عرض قنوات البيع: ' + esc(err && err.message ? err.message : err) + '</p>'; }
  }

  function open(container) {
    if (!ROOT) { mount(container); return; }
    renderAll();
  }

  window.KansasSalesChannels = {
    CHANNELS: CH,
    compare: compare,
    renderSummary: renderSummary,
    period: function () { return getPeriod(load()); },
    setPeriod: setPeriod,
    mount: mount,
    open: open,
    _saveDay: saveDay,
    _saveMonthRef: saveMonthRef,
    _approveYear: approveYear,
    _unlockYear: unlockYear,
    _load: load
  };
})();
