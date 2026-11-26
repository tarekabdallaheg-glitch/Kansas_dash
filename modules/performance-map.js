/* KANSAS PREMIUM — خريطة الأداء العام (Overall Performance Map)
   وحدة مستقلة تُحمَّل عند فتح التبويب فقط.
   تقرأ البيانات من نفس الدوال والحسابات الموجودة في البرنامج، ولا تكتب في S ولا تغيّر أي حساب.
   بدون أي مكتبة خارجية: الرسومات SVG مرسومة هنا. */
(function () {
  'use strict';

  var ROOT = null, TIP = null, PLAYED = false, LAST = null;
  var NS = 'http://www.w3.org/2000/svg';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: d === undefined ? 0 : d });
  }
  function pc(n, d) { return (n === null || n === undefined || !isFinite(n)) ? '—' : num(n, d === undefined ? 1 : d) + '%'; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ltr(s) { return '<bdi dir="ltr">' + s + '</bdi>'; }
  var MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  function monthLabel(m) { var p = m.split('-'); return (MONTHS_AR[Number(p[1]) - 1] || p[1]) + ' ' + p[0]; }
  function $$(id) { return document.getElementById(id); }

  /* ---------- قراءة البيانات (قراءة فقط) ---------- */
  function monthStartOf(m) { return m + '-01'; }
  function monthEndOf(m) { return m + '-' + pad(daysIn(m)); }
  function listDays(from, to) { var out = []; eachDay(from, to, function (d) { out.push(d); }); return out; }

  function readData() {
    var month = activeMonth;
    var today = todayStr();
    var start = monthStartOf(month), end = monthEndOf(month);
    var cutoff = today < end ? today : end;
    var sales = S.sales || {};
    var hist = forecastHistory();
    var days = listDays(start, end).map(function (d) {
      var r = sales[d];
      var rev = r ? (Number(r.revenue) || 0) : 0;
      var ord = r ? (Number(r.orders) || 0) : 0;
      var f = planForecast(d);
      return {
        day: d, rev: rev, ord: ord,
        recorded: !!r && (rev > 0 || ord > 0),
        elapsed: d <= cutoff,
        pred: f.predicted || 0, base: f.base || 0, missingGrowth: !!f.missingGrowth,
        wd: weekdayOf(d)
      };
    });
    var elapsed = days.filter(function (x) { return x.elapsed; });
    var recDays = elapsed.filter(function (x) { return x.recorded; });
    var actual = recDays.reduce(function (s, x) { return s + x.rev; }, 0);
    var predRec = recDays.reduce(function (s, x) { return s + x.pred; }, 0);
    var future = days.filter(function (x) { return !x.elapsed; });

    var prev = shiftMonth(month, -1);
    var prevTot = salesIn(monthStartOf(prev), monthEndOf(prev));
    var curTot = salesIn(start, cutoff >= start ? cutoff : start);

    var wdAvg = [];
    for (var w = 0; w < 7; w++) {
      var same = hist.filter(function (x) { return x.weekday === w; });
      wdAvg.push({ wd: w, name: DAYS_AR[w], avg: same.length ? same.reduce(function (s, x) { return s + x.revenue; }, 0) / same.length : null, n: same.length });
    }

    var inv = null;
    var recs = (S.analyses || []).filter(function (a) { return monthOf(a.to) === month; })
      .sort(function (a, b) { return a.to < b.to ? 1 : -1; });
    if (recs.length) {
      try { inv = analysisFigures(recs[0]); inv.rec = recs[0]; } catch (e) { inv = null; }
    }

    var prodNoPrice = (S.products || []).filter(function (p) { return p.price === null || p.price === undefined; }).length;
    var growthMissing = future.filter(function (x) { return x.missingGrowth; }).length;

    return {
      month: month, today: today, start: start, end: end, cutoff: cutoff,
      days: days, elapsed: elapsed, recDays: recDays, future: future,
      actual: actual, predRec: predRec,
      achievement: predRec > 0 ? actual / predRec * 100 : null,
      futurePred: future.reduce(function (s, x) { return s + x.pred; }, 0),
      cur: curTot, prevTot: prevTot, prevMonth: prev,
      curAvg: curTot.days ? curTot.rev / curTot.days : null,
      prevAvg: prevTot.days ? prevTot.rev / prevTot.days : null,
      wdAvg: wdAvg, histCount: hist.length,
      inv: inv, prodNoPrice: prodNoPrice, growthMissing: growthMissing,
      productCount: (S.products || []).length
    };
  }

  /* ---------- مؤشرات مشتقة من البيانات ---------- */
  function derive(D) {
    var coverage = D.elapsed.length ? D.recDays.length / D.elapsed.length * 100 : null;
    var matched = null, wasteRate = null, totalSold = 0, totalWaste = 0, growthRatio = null;
    if (D.inv && D.inv.per.length) {
      var counted = D.inv.per.filter(function (r) { return r.vr !== null && r.theo !== null; });
      if (counted.length) {
        matched = counted.filter(function (r) { return Math.abs(r.vr) === 0 || (r.theo > 0 && Math.abs(r.vr) / r.theo <= 0.01); }).length / counted.length * 100;
      }
      D.inv.per.forEach(function (r) { totalSold += Number(r.x.sold) || 0; totalWaste += Number(r.x.waste) || 0; });
      if (totalSold > 0) wasteRate = totalWaste / totalSold * 100;
    }
    if (D.prevAvg && D.curAvg) growthRatio = D.curAvg / D.prevAvg * 100;
    var allowed = (typeof WASTE_ALLOW_RATE === 'number') ? WASTE_ALLOW_RATE * 100 : null;
    return { coverage: coverage, matched: matched, wasteRate: wasteRate, allowed: allowed, growthRatio: growthRatio };
  }

  /* ---------- عناصر SVG ---------- */
  function svg(w, h, inner, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" preserveAspectRatio="xMidYMid meet">' + inner + '</svg>';
  }
  function tipAttr(t) { return ' data-tip="' + esc(t) + '"'; }

  function lineChart(D) {
    var W = 720, H = 260, padL = 48, padR = 16, padT = 16, padB = 30;
    var n = D.days.length;
    var max = 0;
    D.days.forEach(function (x) { max = Math.max(max, x.rev, x.pred); });
    max = max > 0 ? max * 1.1 : 1;
    var X = function (i) { return padL + (n > 1 ? i / (n - 1) : 0) * (W - padL - padR); };
    var Y = function (v) { return padT + (1 - v / max) * (H - padT - padB); };
    var g = '';
    for (var k = 0; k <= 4; k++) {
      var gv = max * k / 4, gy = Y(gv);
      g += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy + '" y2="' + gy + '" class="pm-grid"/>';
      g += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" class="pm-ax" text-anchor="end">' + num(gv / 1000, 0) + 'k</text>';
    }
    var fc = D.days.map(function (x, i) { return X(i) + ',' + Y(x.pred); }).join(' ');
    var act = D.days.filter(function (x) { return x.elapsed && x.recorded; });
    var actPts = act.map(function (x) { return X(D.days.indexOf(x)) + ',' + Y(x.rev); }).join(' ');
    var areaPts = act.length ? (X(D.days.indexOf(act[0])) + ',' + (H - padB) + ' ' + actPts + ' ' + X(D.days.indexOf(act[act.length - 1])) + ',' + (H - padB)) : '';
    g += '<polyline points="' + fc + '" class="pm-fc-line"/>';
    if (areaPts) g += '<polygon points="' + areaPts + '" class="pm-area"/>';
    if (actPts) g += '<polyline points="' + actPts + '" class="pm-act-line"/>';
    D.days.forEach(function (x, i) {
      if (n > 14 && (i + 1) % 5 !== 0 && i !== 0) { return; }
      g += '<text x="' + X(i) + '" y="' + (H - 8) + '" class="pm-ax" text-anchor="middle">' + (i + 1) + '</text>';
    });
    D.days.forEach(function (x, i) {
      if (!(x.elapsed && x.recorded) && x.pred <= 0) return;
      var tip = x.day + ' · الإيراد ' + num(x.rev) + ' ج.م · التوقع ' + num(x.pred) + ' ج.م';
      g += '<circle cx="' + X(i) + '" cy="' + Y(x.elapsed && x.recorded ? x.rev : x.pred) + '" r="' + (x.elapsed && x.recorded ? 4.5 : 3) + '" class="' + (x.elapsed && x.recorded ? 'pm-dot' : 'pm-dot-fc') + ' pm-hit" data-day="' + x.day + '"' + tipAttr(tip) + '/>';
      g += '<rect x="' + (X(i) - 10) + '" y="' + padT + '" width="20" height="' + (H - padT - padB) + '" class="pm-hitcol" data-day="' + x.day + '"' + tipAttr(tip) + '/>';
    });
    return svg(W, H, g, 'pm-chart');
  }

  function trendChart(D) {
    var W = 720, H = 220, padL = 48, padR = 16, padT = 14, padB = 26;
    var rows = D.days;
    var ma = function (arr, i) { var s = 0, c = 0; for (var j = Math.max(0, i - 6); j <= i; j++) { if (arr[j] !== null && arr[j] !== undefined) { s += arr[j]; c++; } } return c ? s / c : null; };
    var actArr = rows.map(function (x) { return x.elapsed && x.recorded ? x.rev : null; });
    var fcArr = rows.map(function (x) { return x.pred; });
    var A = actArr.map(function (_, i) { return ma(actArr, i); });
    var F = fcArr.map(function (_, i) { return ma(fcArr, i); });
    var max = 0; A.concat(F).forEach(function (v) { if (v) max = Math.max(max, v); });
    max = max > 0 ? max * 1.1 : 1;
    var n = rows.length;
    var X = function (i) { return padL + (n > 1 ? i / (n - 1) : 0) * (W - padL - padR); };
    var Y = function (v) { return padT + (1 - v / max) * (H - padT - padB); };
    var g = '';
    for (var k = 0; k <= 3; k++) {
      var gv = max * k / 3, gy = Y(gv);
      g += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy + '" y2="' + gy + '" class="pm-grid"/>';
      g += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" class="pm-ax" text-anchor="end">' + num(gv / 1000, 0) + 'k</text>';
    }
    var line = function (arr) { var pts = []; arr.forEach(function (v, i) { if (v !== null) pts.push(X(i) + ',' + Y(v)); }); return pts.join(' '); };
    g += '<polyline points="' + line(F) + '" class="pm-fc-line"/>';
    g += '<polyline points="' + line(A) + '" class="pm-act-line"/>';
    rows.forEach(function (x, i) {
      if (i % 5 !== 0 && i !== n - 1) return;
      g += '<text x="' + X(i) + '" y="' + (H - 6) + '" class="pm-ax" text-anchor="middle">' + (i + 1) + '</text>';
    });
    rows.forEach(function (x, i) {
      var tip = x.day + ' · متوسط 7 أيام: الفعلي ' + num(A[i]) + ' · التوقع ' + num(F[i]);
      g += '<rect x="' + (X(i) - 10) + '" y="' + padT + '" width="20" height="' + (H - padT - padB) + '" class="pm-hitcol"' + tipAttr(tip) + '/>';
    });
    return svg(W, H, g, 'pm-chart');
  }

  function weekdayBars(D) {
    var rows = D.wdAvg.filter(function (x) { return x.avg !== null; });
    if (!rows.length) return '<p class="pm-muted">لا يوجد تاريخ مبيعات كافٍ لحساب متوسط أيام الأسبوع.</p>';
    var max = Math.max.apply(null, rows.map(function (x) { return x.avg; })) || 1;
    return '<div class="pm-hbars">' + D.wdAvg.map(function (x) {
      if (x.avg === null) return '<div class="pm-hrow"><span>' + x.name + '</span><em class="pm-muted">لا توجد بيانات</em></div>';
      var w = x.avg / max * 100;
      return '<div class="pm-hrow" data-wd="' + x.wd + '"' + tipAttr(x.name + ' · متوسط ' + num(x.avg) + ' ج.م · من ' + x.n + ' يوم') + '>' +
        '<span>' + x.name + '</span><div class="pm-htrack"><div class="pm-hfill" style="width:' + w.toFixed(1) + '%"></div></div><b>' + num(x.avg) + '</b></div>';
    }).join('') + '</div>';
  }

  function heatmap(D) {
    var start = D.start;
    var offset = weekdayOf(start);
    var n = D.days.length;
    var weeks = Math.ceil((offset + n) / 7);
    var head = DAYS_AR.map(function (d) { return '<th>' + d + '</th>'; }).join('');
    var html = '<table class="pm-heat"><thead><tr><th></th>' + head + '</tr></thead><tbody>';
    for (var wk = 0; wk < weeks; wk++) {
      html += '<tr><th>أسبوع ' + (wk + 1) + '</th>';
      for (var c = 0; c < 7; c++) {
        var idx = wk * 7 + c - offset;
        if (idx < 0 || idx >= n) { html += '<td class="pm-cell pm-empty"></td>'; continue; }
        var x = D.days[idx];
        var dayNo = idx + 1;
        if (!(x.elapsed && x.recorded && x.pred > 0)) {
          html += '<td class="pm-cell pm-empty"' + tipAttr(x.day + ' · ' + (x.elapsed ? 'لا يوجد تسجيل' : 'لم يحن بعد')) + '><span>' + dayNo + '</span></td>';
          continue;
        }
        var r = x.rev / x.pred * 100;
        var cls = r >= 100 ? 'pm-hi' : (r >= 90 ? 'pm-mid' : 'pm-lo');
        var a = clamp(Math.abs(r - 100) / 40 + 0.35, 0.35, 1).toFixed(2);
        html += '<td class="pm-cell ' + cls + '" style="--a:' + a + '" data-day="' + x.day + '"' +
          tipAttr(x.day + ' · الفعلي ' + num(x.rev) + ' · التوقع ' + num(x.pred) + ' · ' + pc(r)) + '><span>' + dayNo + '</span><small>' + pc(r, 0) + '</small></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  function radar(D, K) {
    var axes = [
      { k: 'التوقع', v: D.achievement, raw: pc(D.achievement), norm: D.achievement === null ? null : clamp(D.achievement / 150, 0, 1), tip: 'الفعلي ÷ التوقع للأيام المسجلة (السقف 150%)' },
      { k: 'تسجيل الأيام', v: K.coverage, raw: pc(K.coverage), norm: K.coverage === null ? null : clamp(K.coverage / 100, 0, 1), tip: 'الأيام المسجلة ÷ أيام الشهر حتى التاريخ' },
      { k: 'مطابقة الجرد', v: K.matched, raw: pc(K.matched), norm: K.matched === null ? null : clamp(K.matched / 100, 0, 1), tip: 'نسبة الأصناف التي فرقها صفر أو أقل من 1% من النظري' },
      { k: 'الهالك', v: K.wasteRate, raw: pc(K.wasteRate, 2), norm: (K.wasteRate === null || !K.allowed) ? null : clamp(K.allowed / Math.max(K.wasteRate, 0.0001), 0, 1), tip: 'كلما اقترب الهالك من نسبة المسموح، زادت النقطة (100% = ضمن المسموح)' },
      { k: 'النمو', v: K.growthRatio, raw: pc(K.growthRatio), norm: K.growthRatio === null ? null : clamp(K.growthRatio / 150, 0, 1), tip: 'متوسط اليوم هذا الشهر ÷ متوسط الشهر السابق (السقف 150%)' }
    ];
    var cx = 170, cy = 150, R = 110, n = axes.length;
    var pt = function (i, f) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
    var g = '';
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      g += '<polygon class="pm-rgrid" points="' + axes.map(function (_, i) { return pt(i, f).join(','); }).join(' ') + '"/>';
    });
    axes.forEach(function (a, i) {
      var p = pt(i, 1);
      g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" class="pm-rgrid"/>';
      var lp = pt(i, 1.22);
      g += '<text x="' + lp[0] + '" y="' + lp[1] + '" class="pm-rlabel" text-anchor="middle" dominant-baseline="middle">' + a.k + '</text>';
    });
    var pts = axes.map(function (a, i) { return pt(i, a.norm === null ? 0 : a.norm).join(','); }).join(' ');
    g += '<polygon class="pm-rshape" points="' + pts + '"/>';
    axes.forEach(function (a, i) {
      var p = pt(i, a.norm === null ? 0 : a.norm);
      var tip = a.k + ' · ' + (a.v === null ? 'لا توجد بيانات كافية' : a.raw) + ' · ' + a.tip;
      g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (a.norm === null ? 3 : 5) + '" class="' + (a.norm === null ? 'pm-rdot-empty' : 'pm-rdot') + ' pm-hit"' + tipAttr(tip) + '/>';
    });
    return svg(340, 300, g, 'pm-radar');
  }

  function donut(D) {
    var inv = D.inv;
    if (!inv) return '<p class="pm-muted">لا يوجد تحليل مخزون محفوظ لهذا الشهر. احفظ تحليل المخزون من تبويب المخزون ليظهر هنا.</p>';
    var parts = [
      { k: 'عجز', v: inv.T.short, c: 'var(--bad)' },
      { k: 'زيادة', v: inv.T.over, c: 'var(--ok)' },
      { k: 'هالك', v: inv.T.waste, c: 'var(--gold)' }
    ];
    var total = parts.reduce(function (s, p) { return s + p.v; }, 0);
    if (!total) return '<p class="pm-muted">لا توجد فروقات بقيمة مسجلة في تحليل هذا الشهر (قد تكون أسعار الأصناف غير مسجلة).</p>';
    var R = 70, C = 2 * Math.PI * R, off = 0, g = '';
    parts.forEach(function (p) {
      var len = p.v / total * C;
      g += '<circle r="' + R + '" cx="110" cy="110" fill="none" style="stroke:' + p.c + '" stroke-width="26" class="pm-seg pm-hit" stroke-dasharray="' + len.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"' + tipAttr(p.k + ' · ' + num(p.v) + ' ج.م · ' + pc(p.v / total * 100)) + '/>';
      off += len;
    });
    g += '<text x="110" y="106" text-anchor="middle" class="pm-dn-big">' + num(total) + '</text><text x="110" y="128" text-anchor="middle" class="pm-ax">ج.م إجمالي الفروقات</text>';
    var legend = parts.map(function (p) { return '<div class="pm-leg"><i style="background:' + p.c + '"></i>' + p.k + ' <b>' + num(p.v) + '</b> <em>' + pc(p.v / total * 100, 0) + '</em></div>'; }).join('');
    return '<div class="pm-donut">' + svg(220, 220, g, 'pm-dn') + '<div class="pm-legend">' + legend + '</div></div>';
  }

  function varBars(D) {
    var inv = D.inv;
    if (!inv) return '<p class="pm-muted">لا يوجد تحليل مخزون محفوظ لهذا الشهر.</p>';
    var rows = inv.per.filter(function (r) { return r.vr !== null; });
    if (!rows.length) return '<p class="pm-muted">التحليل المحفوظ لا يحتوي على جرد فعلي لأي صنف بعد.</p>';
    var val = function (r) { return r.price !== null ? r.vr * r.price : r.vr; };
    rows.sort(function (a, b) { return Math.abs(val(b)) - Math.abs(val(a)); });
    var top = rows.slice(0, 8);
    var max = Math.max.apply(null, top.map(function (r) { return Math.abs(val(r)); })) || 1;
    var unit = top.some(function (r) { return r.price === null; }) ? ' (وحدات للأصناف بدون سعر)' : ' ج.م';
    return '<div class="pm-vbars">' + top.map(function (r) {
      var v = val(r), w = Math.abs(v) / max * 50, neg = v < 0;
      var tip = r.p.name + ' · ' + num(r.vr) + ' وحدة · ' + (r.price !== null ? num(v) + ' ج.م' : 'بدون سعر');
      return '<div class="pm-vrow"' + tipAttr(tip) + '><span class="pm-vname">' + esc(r.p.name) + '</span>' +
        '<div class="pm-vtrack"><div class="pm-vmid"></div><div class="pm-vfill ' + (neg ? 'pm-neg' : 'pm-pos') + '" style="' + (neg ? 'right:50%;width:' : 'left:50%;width:') + w.toFixed(1) + '%"></div></div>' +
        '<b class="' + (neg ? 'neg' : 'pos') + '">' + ltr(num(v)) + '</b></div>';
    }).join('') + '<p class="pm-note">الأشرطة: عجز (يسار) وزيادة (يمين)، بقيمة الفرق' + unit + '.</p></div>';
  }

  function gauge(label, value, max, display, tip, cls) {
    var r = 46, C = Math.PI * r;
    var frac = (value === null || value === undefined) ? 0 : clamp(value / max, 0, 1);
    var arc = 'M 10 60 A 46 46 0 0 1 102 60';
    var off = (C * (1 - frac)).toFixed(2);
    var g = '<path d="' + arc + '" class="pm-gbg"/><path d="' + arc + '" class="pm-gfg ' + (cls || '') + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + off + '" style="--from:' + C.toFixed(2) + ';--to:' + off + '"/>';
    return '<div class="pm-gauge pm-hit"' + tipAttr(label + ' · ' + tip) + '>' + svg(112, 66, g, 'pm-gsvg') +
      '<div class="pm-gval">' + (value === null || value === undefined ? '—' : display) + '</div><div class="pm-glabel">' + label + '</div></div>';
  }

  /* ---------- الأقسام ---------- */
  function statusOf(D) {
    if (D.achievement === null) return { cls: 'nd', txt: 'لا توجد بيانات كافية للمقارنة', note: 'سجّل الإيراد اليومي ليظهر تقييم الأداء.' };
    if (D.achievement >= 100) return { cls: 'good', txt: 'فوق التوقع', note: 'الإيراد الفعلي للأيام المسجلة أعلى من التوقع.' };
    if (D.achievement >= 90) return { cls: 'watch', txt: 'قريب من التوقع', note: 'الإيراد قريب من التوقع، ويستحق المتابعة.' };
    return { cls: 'low', txt: 'أقل من التوقع', note: 'الإيراد الفعلي أقل من التوقع للأيام المسجلة.' };
  }

  function renderExec(D, K) {
    var st = statusOf(D);
    var kpis = [
      { k: 'إيراد الشهر حتى التاريخ', v: num(D.cur.rev) + ' ج.م', t: 'إجمالي إيراد الأيام المسجلة من بداية الشهر حتى ' + D.cutoff },
      { k: 'عدد العمليات', v: num(D.cur.ord), t: 'مجموع عدد العمليات المسجلة للشهر حتى التاريخ' },
      { k: 'متوسط اليوم المسجل', v: D.curAvg === null ? '—' : num(D.curAvg) + ' ج.م', t: 'الإيراد ÷ عدد الأيام المسجلة' },
      { k: 'التوقع للأيام المتبقية', v: num(D.futurePred) + ' ج.م', t: 'مجموع توقع المبيعات لأيام الشهر التي لم تأتِ بعد' },
      { k: 'تنفيذ التوقع', v: pc(D.achievement), t: 'الفعلي ÷ التوقع للأيام المسجلة فقط' },
      { k: 'تغطية التسجيل', v: pc(K.coverage, 0), t: 'الأيام المسجلة ÷ أيام الشهر حتى التاريخ' }
    ];
    $$('pm-kpis').innerHTML = kpis.map(function (k) {
      return '<div class="pm-kpi"' + tipAttr(k.t) + '><span>' + k.k + '</span><b>' + k.v + '</b></div>';
    }).join('');
    $$('pm-status').innerHTML = '<span class="pm-chip pm-' + st.cls + '">' + st.txt + '</span>';
    var strong = D.wdAvg.filter(function (x) { return x.avg !== null; }).sort(function (a, b) { return b.avg - a.avg; });
    var lines = [];
    lines.push('<div class="pm-sline">' + st.note + '</div>');
    if (strong.length) lines.push('<div class="pm-sline"><b>أقوى يوم في الأسبوع:</b> ' + strong[0].name + ' (متوسط ' + num(strong[0].avg) + ' ج.م)</div>');
    if (strong.length > 1) lines.push('<div class="pm-sline"><b>أضعف يوم في الأسبوع:</b> ' + strong[strong.length - 1].name + ' (متوسط ' + num(strong[strong.length - 1].avg) + ' ج.م)</div>');
    var above = D.recDays.filter(function (x) { return x.rev >= x.pred && x.pred > 0; }).length;
    if (D.recDays.length) lines.push('<div class="pm-sline"><b>أيام فوق التوقع:</b> ' + above + ' من ' + D.recDays.length + '</div>');
    $$('pm-sumtext').innerHTML = lines.join('');

    var alerts = [];
    var missing = D.elapsed.length - D.recDays.length;
    if (missing > 0) alerts.push({ c: 'watch', t: 'فيه ' + missing + ' يوم بدون تسجيل إيراد حتى تاريخه' });
    if (D.achievement !== null && D.achievement < 90) alerts.push({ c: 'low', t: 'تنفيذ التوقع ' + pc(D.achievement, 0) + ' أقل من 90%' });
    if (D.growthMissing > 0) alerts.push({ c: 'watch', t: 'لا توجد نسبة نمو مسجلة لـ ' + D.growthMissing + ' يوم قادم، والتوقع يعتمد على القاعدة فقط' });
    if (D.prodNoPrice > 0) alerts.push({ c: 'watch', t: D.prodNoPrice + ' صنف بدون سعر، لا تُحسب لها قيمة الفروقات' });
    if (!D.inv) alerts.push({ c: 'watch', t: 'لا يوجد تحليل مخزون محفوظ لهذا الشهر' });
    if (D.histCount < 14) alerts.push({ c: 'watch', t: 'تاريخ المبيعات ' + D.histCount + ' يوم فقط، والتوقع أدق مع مزيد من البيانات' });
    $$('pm-alerts').innerHTML = alerts.length
      ? alerts.map(function (a) { return '<div class="pm-alert pm-' + a.c + '">' + a.t + '</div>'; }).join('')
      : '<div class="pm-alert pm-good">لا توجد تنبيهات حاليًا</div>';
  }

  function renderSales(D) {
    var cmp = D.prevAvg && D.curAvg ? (D.curAvg / D.prevAvg * 100 - 100) : null;
    var up = cmp !== null && cmp >= 0;
    $$('pm-compare').innerHTML =
      '<div class="pm-cmp"><span>متوسط اليوم هذا الشهر</span><b>' + (D.curAvg === null ? '—' : num(D.curAvg) + ' ج.م') + '</b></div>' +
      '<div class="pm-cmp"><span>متوسط اليوم الشهر السابق (' + D.prevMonth + ')</span><b>' + (D.prevAvg === null ? '—' : num(D.prevAvg) + ' ج.م') + '</b></div>' +
      '<div class="pm-cmp"><span>تغيّر المتوسط</span><b class="' + (cmp === null ? '' : (up ? 'pos' : 'neg')) + '">' + (cmp === null ? '—' : ltr((up ? '+' : '') + num(cmp, 1) + '%')) + '</b></div>' +
      '<div class="pm-cmp"><span>إيراد الشهر السابق كاملًا</span><b>' + num(D.prevTot.rev) + ' ج.م</b></div>';
    $$('pm-line').innerHTML = '<div class="pm-ct"><h4>الإيراد اليومي: فعلي مقابل توقع</h4><div class="pm-legend-row"><span><i class="pm-k-act"></i>فعلي</span><span><i class="pm-k-fc"></i>توقع</span></div></div>' + lineChart(D);
    $$('pm-weekday').innerHTML = '<div class="pm-ct"><h4>متوسط الإيراد حسب يوم الأسبوع</h4></div>' + weekdayBars(D);
  }

  function renderInv(D) {
    $$('pm-donut').innerHTML = '<div class="pm-ct"><h4>توزيع قيمة الفروقات</h4></div>' + donut(D);
    $$('pm-varbars').innerHTML = '<div class="pm-ct"><h4>أكبر الفروقات حسب الصنف</h4></div>' + varBars(D);
  }

  function renderForecast(D, K) {
    $$('pm-radar').innerHTML = '<div class="pm-ct"><h4>صورة الأداء على 5 محاور</h4></div>' + radar(D, K) +
      '<p class="pm-note">المحاور بدون بيانات تظهر في المركز بنقطة منقطة، ولا تُحسب بقيمة وهمية.</p>';
    $$('pm-heat').innerHTML = '<div class="pm-ct"><h4>خريطة التنفيذ اليومية (الفعلي ÷ التوقع)</h4><div class="pm-legend-row"><span><i class="pm-k-lo"></i>أقل من 90%</span><span><i class="pm-k-mid"></i>90% – 100%</span><span><i class="pm-k-hi"></i>100% فأكثر</span></div></div>' + heatmap(D);
    $$('pm-trend').innerHTML = '<div class="pm-ct"><h4>الاتجاه: متوسط آخر 7 أيام</h4><div class="pm-legend-row"><span><i class="pm-k-act"></i>فعلي</span><span><i class="pm-k-fc"></i>توقع</span></div></div>' + trendChart(D);
  }

  function renderOps(D, K) {
    var g = '';
    g += gauge('تغطية التسجيل', K.coverage, 100, pc(K.coverage, 0), 'الأيام المسجلة ÷ أيام الشهر حتى التاريخ', 'g-cov');
    g += gauge('تنفيذ التوقع', D.achievement, 150, pc(D.achievement, 0), 'الفعلي ÷ التوقع للأيام المسجلة (السقف 150%)', 'g-ach');
    g += gauge('مطابقة الجرد', K.matched, 100, pc(K.matched, 0), 'نسبة الأصناف المطابقة للنظري', 'g-mat');
    $$('pm-gauges').innerHTML = g;
    var rows = [
      ['أيام الشهر المسجلة', D.recDays.length + ' من ' + D.elapsed.length + ' يوم حتى التاريخ'],
      ['أيام قادمة بدون نسبة نمو', String(D.growthMissing)],
      ['أصناف بدون سعر', String(D.prodNoPrice) + ' من ' + D.productCount],
      ['تحليل مخزون محفوظ للشهر', D.inv ? 'نعم' : 'لا'],
      ['نسبة الهالك من المباع', pc(K.wasteRate, 2) + (K.allowed !== null ? ' (المسموح ' + pc(K.allowed, 2) + ')' : '')],
      ['أيام تاريخ المبيعات المستخدمة للتوقع', String(D.histCount)]
    ];
    $$('pm-ops-list').innerHTML = '<div class="pm-ct"><h4>مؤشرات التشغيل والبيانات</h4></div>' + rows.map(function (r) {
      return '<div class="pm-oprow"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join('');
  }


  /* ---------- قنوات البيع: العرض كله داخل وحدة sales-channels.js ----------
     خريطة الأداء تستقبل الشاشة الجاهزة من الوحدة وتعرضها في قسمها فقط. */
  function renderChannelsSection() {
    var el = $$('pm-channels');
    if (!el) return;
    var go = function () {
      var C = window.KansasSalesChannels;
      if (!C || !C.renderSummary) { el.innerHTML = '<p class="pm-muted">وحدة قنوات البيع غير متاحة.</p>'; return; }
      C.renderSummary(el);
    };
    if (window.KansasSalesChannels) { go(); return; }
    if (window.ensureSalesChannels) { el.innerHTML = '<p class="pm-muted">جاري تحميل قنوات البيع…</p>'; window.ensureSalesChannels(go); }
    else { el.innerHTML = '<p class="pm-muted">وحدة قنوات البيع غير متاحة.</p>'; }
  }

  /* ---------- التفاعل (مرّة واحدة عند التهيئة) ---------- */
  function showTip(el, x, y) {
    var t = el.getAttribute('data-tip');
    if (!t) return;
    TIP.textContent = t;
    TIP.style.display = 'block';
    var rr = ROOT.getBoundingClientRect();
    var left = clamp(x - rr.left + 12, 6, rr.width - 260);
    TIP.style.left = left + 'px';
    TIP.style.top = (y - rr.top - 42) + 'px';
  }
  function hideTip() { if (TIP) TIP.style.display = 'none'; }

  function showDetail(day) {
    if (!LAST) return;
    var x = LAST.D.days.filter(function (d) { return d.day === day; })[0];
    if (!x) return;
    var ach = x.recorded && x.pred > 0 ? pc(x.rev / x.pred * 100) : '—';
    $$('pm-detail').innerHTML = '<div class="pm-dtitle">' + x.day + ' · يوم ' + DAYS_AR[x.wd] + '</div>' +
      '<div class="pm-dgrid">' +
      '<div><span>الإيراد</span><b>' + (x.recorded ? num(x.rev) + ' ج.م' : 'لا يوجد تسجيل') + '</b></div>' +
      '<div><span>عدد العمليات</span><b>' + (x.recorded ? num(x.ord) : '—') + '</b></div>' +
      '<div><span>التوقع</span><b>' + num(x.pred) + ' ج.م</b></div>' +
      '<div><span>التنفيذ</span><b>' + ach + '</b></div></div>' +
      (x.missingGrowth ? '<p class="pm-note">لا توجد نسبة نمو مسجلة لهذا اليوم؛ التوقع من القاعدة فقط.</p>' : '');
    $$('pm-detail').style.display = 'block';
  }

  function mount(container) {
    if (ROOT) return;
    ROOT = document.createElement('div');
    ROOT.className = 'pm-root';
    ROOT.innerHTML =
      '<header class="pm-head"><div><div class="pm-kicker">BUSINESS INTELLIGENCE</div><h2>خريطة الأداء العام</h2>' +
      '<p class="pm-sub">الشهر المعروض: <b id="pm-month"></b> · البيانات من تسجيلات البرنامج الفعلية</p></div>' +
      '<div id="pm-status"></div></header>' +
      '<nav class="pm-jump"><a href="#pm-exec">نظرة عامة</a><a href="#pm-sales">المبيعات</a><a href="#pm-ch">القنوات</a><a href="#pm-inv">المخزون</a><a href="#pm-fc">التوقع والاتجاه</a><a href="#pm-ops">التشغيل</a></nav>' +
      '<section id="pm-exec" class="pm-sec"><h3><span>Executive Overview</span>نظرة عامة على الفرع</h3>' +
      '<div id="pm-kpis" class="pm-kpis"></div>' +
      '<div class="pm-grid2"><div class="pm-card"><div id="pm-sumtext"></div></div><div class="pm-card" id="pm-alerts"></div></div></section>' +
      '<section id="pm-sales" class="pm-sec"><h3><span>Sales Performance</span>أداء المبيعات</h3>' +
      '<div class="pm-grid3"><div class="pm-card pm-wide" id="pm-line"></div><div class="pm-card" id="pm-compare"></div></div>' +
      '<div class="pm-grid2"><div class="pm-card" id="pm-weekday"></div><div class="pm-card pm-detailbox"><div id="pm-detail" class="pm-detail" style="display:none"></div><div class="pm-muted pm-hint">اضغط على أي نقطة أو يوم في الرسم لتفاصيله هنا.</div></div></div></section>' +
      '<section id="pm-inv" class="pm-sec"><h3><span>Inventory Performance</span>أداء المخزون</h3>' +
      '<div class="pm-grid2"><div class="pm-card" id="pm-donut"></div><div class="pm-card" id="pm-varbars"></div></div></section>' +
      '<section id="pm-fc" class="pm-sec"><h3><span>Forecast &amp; Trend</span>التوقع والاتجاه</h3>' +
      '<div class="pm-grid2"><div class="pm-card" id="pm-radar"></div><div class="pm-card" id="pm-heat"></div></div>' +
      '<div class="pm-card pm-wide" id="pm-trend"></div></section>' +
      '<section id="pm-ch" class="pm-sec"><h3><span>Sales Channels</span>قنوات البيع</h3>' +
      '<div class="pm-card pm-wide" id="pm-channels"></div></section>' +
      '<section id="pm-ops" class="pm-sec"><h3><span>Operational Indicators</span>مؤشرات التشغيل</h3>' +
      '<div class="pm-card"><div id="pm-gauges" class="pm-gauges"></div></div>' +
      '<div class="pm-card" id="pm-ops-list"></div></section>';
    TIP = document.createElement('div');
    TIP.className = 'pm-tip';
    TIP.setAttribute('role', 'tooltip');
    ROOT.appendChild(TIP);
    container.appendChild(ROOT);

    ROOT.addEventListener('mousemove', function (e) {
      var el = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (el) showTip(el, e.clientX, e.clientY); else hideTip();
    });
    ROOT.addEventListener('mouseleave', hideTip);
    ROOT.addEventListener('pointerdown', function (e) {
      var el = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (el) showTip(el, e.clientX, e.clientY); else hideTip();
    });
    ROOT.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-day]') : null;
      if (el) showDetail(el.getAttribute('data-day'));
    });
    var mi = $$('month-input');
    if (mi) mi.addEventListener('change', function () { refresh(); });
    window.addEventListener('kansas-channels-changed', function () { if (ROOT) renderChannelsSection(); });

    refresh();
    setTimeout(function () { PLAYED = true; ROOT.classList.add('pm-played'); }, 1100);
  }

  function refresh() {
    if (!ROOT) return;
    try {
      var D = readData();
      var K = derive(D);
      LAST = { D: D, K: K };
      $$('pm-month').textContent = monthLabel(D.month);
      renderExec(D, K);
      renderSales(D);
      renderInv(D);
      renderForecast(D, K);
      renderOps(D, K);
      renderChannelsSection();
      if (!PLAYED) ROOT.classList.remove('pm-played');
      ROOT.classList.remove('pm-error');
    } catch (err) {
      ROOT.classList.add('pm-error');
      ROOT.insertAdjacentHTML('afterbegin', '<div class="pm-alert pm-low">تعذر عرض بعض المؤشرات: ' + esc(err && err.message ? err.message : err) + '</div>');
    }
  }

  window.KansasPerfMap = { mount: mount, refresh: refresh };
})();
