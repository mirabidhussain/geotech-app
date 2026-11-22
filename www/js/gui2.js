/* IS GeoTech — interface for lab tests (IS 2720), investigation planning (IS 1892), earthquake (IS 1893),
   retaining walls (IS 14458 / IS 1893 Pt 3) and rock (IS 12070 / IS 13365) */
(function () {
  "use strict";
  var U = window.ISGU, $ = function (id) { return document.getElementById(id); }, f1 = U.f1, esc = U.esc, css = U.css, r = GC.r;
  function P() { return U.P; }
  var S = U.S; S.tMode = S.tMode || "cls";
  function list(name) { var p = P(); return p[name] || (p[name] = []); }

  /* ---------------- lab tests ---------------- */
  var TESTS = {
    compaction: { t: "Compaction — IS 2720 (Part 7 light / Part 8 heavy)", cols: ["Water content (%)", "Bulk density (g/cc)"], blank: [[8, 1.9], [10, 2.0], [12, 2.08], [14, 2.1], [16, 2.06]] },
    cbr: { t: "California bearing ratio — IS 2720 (Part 16)", cols: ["Penetration (mm)", "Load (kN)"], blank: [[0, 0], [0.5, 0.3], [1, 0.6], [1.5, 0.9], [2, 1.1], [2.5, 1.3], [3, 1.45], [4, 1.7], [5, 1.9], [7.5, 2.3]] },
    shear: { t: "Direct shear — IS 2720 (Part 13)", cols: ["Normal stress (kPa)", "Peak shear stress (kPa)"], blank: [[50, 35], [100, 62], [150, 90]] },
    triax: { t: "Triaxial — IS 2720 (Parts 11 and 12)", cols: ["Cell pressure σ3 (kPa)", "Deviator at failure (kPa)"], blank: [[50, 150], [100, 250], [200, 450]] },
    consol: { t: "Consolidation — IS 2720 (Part 15)", cols: ["Pressure (kPa)", "Void ratio e"], blank: [[12.5, 0.9], [25, 0.89], [50, 0.87], [100, 0.83], [200, 0.76], [400, 0.68], [800, 0.6]] }
  };
  $("tMode").onclick = function (e) { var b = e.target.closest("button"); if (!b) return; S.tMode = b.dataset.m; U.refresh(); };
  function curTest() { var l = list("tests").filter(function (t) { return t.kind === S.tMode; }); return U.cur(l, S["t_" + S.tMode]); }
  U.after.tests = function () {
    [].forEach.call($("tMode").children, function (b) { b.classList.toggle("on", b.dataset.m === S.tMode); });
    $("tCls").style.display = S.tMode === "cls" ? "" : "none"; $("tOther").style.display = S.tMode === "cls" ? "none" : "";
    if (S.tMode === "cls") return;
    var def = TESTS[S.tMode], all = list("tests").filter(function (t) { return t.kind === S.tMode; }), t = curTest();
    $("ltTitle").textContent = def.t;
    U.chips("ltChips", all, t && t.id, function (id) { S["t_" + S.tMode] = id; });
    if (!t) { $("ltTab").innerHTML = ""; $("ltOpts").innerHTML = ""; $("ltOut").innerHTML = '<div class="note">No test yet — press New test.</div>'; var c0 = U.cv("ltCv", 0.2, 40); return; }
    S["t_" + S.tMode] = t.id; U.bind("ltName", t, "name");
    var opts = "";
    if (t.kind === "compaction") opts = '<label class="f"><span>Specific gravity G (zero air voids)</span><input id="ltG" type="number" step="0.01"></label>';
    if (t.kind === "triax") opts = '<label class="f"><span>Test type</span><select id="ltType"><option value="UU">UU — undrained (cu)</option><option value="CU">CU — consolidated undrained (effective stresses entered)</option><option value="CD">CD — drained</option></select></label>';
    if (t.kind === "consol") opts = '<div class="row3"><label class="f"><span>Initial void ratio e0</span><input id="ltE0" type="number" step="0.01"></label><label class="f"><span>t90 at the field stress (min)</span><input id="ltT90" type="number"></label><label class="f"><span>Specimen height (mm), drainage</span><span style="display:flex;gap:6px"><input id="ltH" type="number"><select id="ltDr"><option value="two">Both faces</option><option value="one">One face</option></select></span></label></div>';
    $("ltOpts").innerHTML = opts;
    if ($("ltG")) U.bind("ltG", t, "G", true); if ($("ltType")) U.bind("ltType", t, "type"); if ($("ltE0")) { U.bind("ltE0", t, "e0", true); U.bind("ltT90", t, "t90", true); U.bind("ltH", t, "H", true); U.bind("ltDr", t, "drain"); }
    $("ltTab").innerHTML = '<tr><th>' + def.cols[0] + '</th><th>' + def.cols[1] + '</th><th></th></tr>' + t.rows.map(function (q, i) { return '<tr><td><input type="number" step="any" data-i="' + i + '" data-j="0" value="' + q[0] + '"></td><td><input type="number" step="any" data-i="' + i + '" data-j="1" value="' + q[1] + '"></td><td><button class="btn dan" data-x="' + i + '" style="padding:4px 8px">×</button></td></tr>'; }).join("");
    var res = run(t), h = "";
    if (res.err) h = '<div class="note">' + esc(res.err) + '</div>';
    else if (t.kind === "compaction") h = stat([["Optimum moisture content", f1(res.omc, 1) + " %"], ["Maximum dry density", f1(res.mdd, 3) + " g/cc"]]) + '<div class="note">Dry density ρd = ρ/(1 + w). Peak from a parabola through the three highest points; the zero-air-voids line uses G = ' + res.G + '. Field compaction is normally specified as a percentage of this MDD (for example 95–98 %).</div>';
    else if (t.kind === "cbr") h = stat([["CBR at 2.5 mm", f1(res.c25, 1) + " %"], ["CBR at 5.0 mm", f1(res.c50, 1) + " %"], ["CBR", f1(res.cbr, 1) + " %"], ["Subgrade", res.cbr < 3 ? "very poor" : res.cbr < 5 ? "poor" : res.cbr < 10 ? "fair" : res.cbr < 20 ? "good" : "very good"]]) + '<div class="note">Standard loads 1370 kgf (13.44 kN) at 2.5 mm and 2055 kgf (20.15 kN) at 5.0 mm. ' + esc(res.note) + ' Where the curve starts concave upward, correct the zero point first.</div>';
    else if (t.kind === "shear") h = stat([["Cohesion c", f1(res.c, 1) + " kPa"], ["Friction angle φ", f1(res.phi, 1) + "°"], ["Fit R²", f1(res.r2, 3)]]);
    else if (t.kind === "triax") h = res.phi ? stat([["Cohesion c", f1(res.c, 1) + " kPa"], ["Friction angle φ", f1(res.phi, 1) + "°"], ["Fit R² (p–q)", f1(res.r2, 3)]]) : stat([["Undrained strength cu", f1(res.cu, 1) + " kPa"], ["φu", "0°"]]);
    else if (t.kind === "consol") h = stat([["Compression index Cc", f1(res.Cc, 3)], ["Recompression index Cr", f1(res.Cr, 3)], ["Preconsolidation σ′p", res.pc ? f1(res.pc, 0) + " kPa" : "not found"], ["cv", res.cv ? f1(res.cv, 2) + " m²/yr" : "—"], ["mv (last stage)", res.mv ? f1(res.mv, 3) + " m²/MN" : "—"], ["e0", f1(res.e0, 3)]]) + '<div class="note">σ′p from where the recompression and virgin lines meet on the e–log p plot (check against Casagrande\'s construction). cv = 0.848·Hdr²/t90.</div>';
    $("ltOut").innerHTML = h;
    var ap = layerTargets(t.kind);
    $("ltApply").innerHTML = '<option value="">Copy the result to a soil layer…</option>' + ap; $("ltApply").style.display = ap ? "" : "none";
    drawTest(t, res);
  };
  function stat(a) { return '<div class="stat">' + a.map(function (q) { return '<div><small>' + q[0] + '</small><b class="big">' + q[1] + '</b></div>'; }).join("") + '</div>'; }
  function run(t) {
    if (t.kind === "compaction") return GC.compaction(t.rows, +t.G || 2.65);
    if (t.kind === "cbr") return GC.cbr(t.rows);
    if (t.kind === "shear") return GC.directShear(t.rows);
    if (t.kind === "triax") return GC.triaxial(t.rows, t.type || "UU");
    if (t.kind === "consol") return GC.consol(t.rows, { e0: +t.e0, t90: +t.t90, H: +t.H, drain: t.drain });
    return {};
  }
  function layerTargets(kind) {
    if (["shear", "triax", "consol"].indexOf(kind) < 0) return "";
    var o = ""; P().boreholes.forEach(function (b) { b.layers.forEach(function (L) { o += '<option value="' + b.id + '|' + L.id + '">' + esc(b.name + " — " + (L.name || GC.KINDS[L.kind]) + " (" + L.top + "–" + L.bot + " m)") + '</option>'; }); }); return o;
  }
  $("ltApply").onchange = function () {
    var v = this.value; if (!v) return; var t = curTest(), res = run(t), a = v.split("|"), b = GC.bh(P(), a[0]), L = b.layers.filter(function (x) { return x.id === a[1]; })[0]; if (!L) return;
    U.commit();
    if (t.kind === "shear" || (t.kind === "triax" && res.phi)) { L.c = r(res.c, 1); if (L.kind === "clay") L.phi = r(res.phi, 1); else L.phi = r(res.phi, 1); }
    else if (t.kind === "triax") L.cu = r(res.cu, 1);
    else if (t.kind === "consol") { L.Cc = r(res.Cc, 3); L.Cr = r(res.Cr, 3); L.e0 = r(res.e0, 3); if (res.pc) L.pc = r(res.pc, 0); if (res.cv) L.cv = r(res.cv, 2); }
    U.changed(); U.toast("Copied to " + (L.name || "the layer"));
  };
  $("ltTab").onchange = function (e) { var el = e.target; if (el.dataset.i === undefined) return; U.commit(); curTest().rows[+el.dataset.i][+el.dataset.j] = +el.value; U.changed(); };
  $("ltTab").onclick = function (e) { var d = e.target.closest("[data-x]"); if (!d) return; U.commit(); curTest().rows.splice(+d.dataset.x, 1); U.changed(); };
  $("ltRow").onclick = function () { var t = curTest(); if (!t) return; U.commit(); var l = t.rows[t.rows.length - 1] || [0, 0]; t.rows.push([l[0] * (t.kind === "consol" ? 2 : 1) + (t.kind === "consol" ? 0 : 1), l[1]]); U.changed(); };
  $("ltNew").onclick = function () { U.commit(); var d = TESTS[S.tMode], t = { id: GC.uid(), kind: S.tMode, name: d.t.split(" —")[0] + " " + (list("tests").filter(function (x) { return x.kind === S.tMode; }).length + 1), rows: JSON.parse(JSON.stringify(d.blank)) };
    if (t.kind === "compaction") t.G = 2.65; if (t.kind === "triax") t.type = "CD"; if (t.kind === "consol") { t.e0 = 0.9; t.t90 = 10; t.H = 20; t.drain = "two"; } list("tests").push(t); S["t_" + S.tMode] = t.id; U.changed(); };
  $("ltDel").onclick = function () { var t = curTest(); if (!t) return; U.commit(); P().tests = list("tests").filter(function (x) { return x !== t; }); S["t_" + S.tMode] = null; U.changed(); };
  function axes(x, L, R, T, B, xl, yl) { x.strokeStyle = css("--line"); x.strokeRect(L, T, R - L, B - T); x.fillStyle = css("--mut"); x.font = "11px Inter, system-ui"; x.textAlign = "center"; x.fillText(xl, (L + R) / 2, B + 24); x.save(); x.translate(L - 30, (T + B) / 2); x.rotate(-Math.PI / 2); x.fillText(yl, 0, 0); x.restore(); }
  function ticks(x, L, R, T, B, x0, x1, y0, y1, logx) {
    x.font = "11px Inter, system-ui"; x.fillStyle = css("--mut"); x.strokeStyle = css("--line");
    function nice(a, b) { var span = b - a, st = Math.pow(10, Math.floor(Math.log10(span / 5))), m = span / st; st *= m > 25 ? 5 : m > 10 ? 2 : 1; return st; }
    if (logx) { for (var k = Math.ceil(Math.log10(x0)); k <= Math.floor(Math.log10(x1)); k++) { var v = Math.pow(10, k), X = L + (k - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) * (R - L); x.beginPath(); x.moveTo(X, T); x.lineTo(X, B); x.stroke(); x.textAlign = "center"; x.fillText(v, X, B + 13); } }
    else { var sx = nice(x0, x1); for (var a = Math.ceil(x0 / sx) * sx; a <= x1 + 1e-9; a += sx) { var Xa = L + (a - x0) / (x1 - x0) * (R - L); x.beginPath(); x.moveTo(Xa, T); x.lineTo(Xa, B); x.stroke(); x.textAlign = "center"; x.fillText(+a.toFixed(6), Xa, B + 13); } }
    var sy = nice(y0, y1); for (var b = Math.ceil(y0 / sy) * sy; b <= y1 + 1e-9; b += sy) { var Yb = B - (b - y0) / (y1 - y0) * (B - T); x.beginPath(); x.moveTo(L, Yb); x.lineTo(R, Yb); x.stroke(); x.textAlign = "right"; x.fillText(+b.toFixed(6), L - 4, Yb + 4); }
  }
  function drawTest(t, res) {
    var c = U.cv("ltCv", 0.62, 230), x = c.x, w = c.w, h = c.h, L = 54, R = w - 14, T = 14, B = h - 34;
    if (res.err) return;
    var pts, x0, x1, y0, y1, logx = false, xl = TESTS[t.kind].cols[0], yl = TESTS[t.kind].cols[1];
    if (t.kind === "compaction") { pts = res.pts.map(function (p) { return [p.w, p.rd]; }); yl = "Dry density (g/cc)"; }
    else if (t.kind === "consol") { pts = res.rows.map(function (p) { return [p[0], p[1]]; }); logx = true; }
    else if (t.kind === "triax") { pts = []; }
    else pts = t.rows.map(function (p) { return [+p[0], +p[1]]; });
    if (t.kind === "triax") {
      var mx = 0; res.circles.forEach(function (q) { mx = Math.max(mx, q.c + q.R); }); x0 = 0; x1 = mx * 1.05; y0 = 0; y1 = Math.max.apply(null, res.circles.map(function (q) { return q.R; })) * 1.3; xl = "Normal stress σ (kPa)"; yl = "Shear stress τ (kPa)";
      var k = Math.min((R - L) / (x1 - x0), (B - T) / (y1 - y0)); R = L + k * (x1 - x0); B = T + k * (y1 - y0);
    } else {
      x0 = Math.min.apply(null, pts.map(function (p) { return p[0]; })); x1 = Math.max.apply(null, pts.map(function (p) { return p[0]; })); y0 = Math.min.apply(null, pts.map(function (p) { return p[1]; })); y1 = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
      if (t.kind === "shear") { x0 = 0; y0 = 0; } if (t.kind === "cbr") { x0 = 0; y0 = 0; }
      var py = (y1 - y0) * 0.12 || 0.1; y0 -= py; y1 += py; if (!logx) { var px = (x1 - x0) * 0.06 || 1; x0 = Math.max(t.kind === "shear" || t.kind === "cbr" ? 0 : -Infinity, x0 - px); x1 += px; } else { x0 = x0 / 1.5; x1 = x1 * 1.5; }
    }
    function X(v) { return logx ? L + (Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) * (R - L) : L + (v - x0) / (x1 - x0) * (R - L); } function Y(v) { return B - (v - y0) / (y1 - y0) * (B - T); }
    ticks(x, L, R, T, B, x0, x1, y0, y1, logx); axes(x, L, R, T, B, xl, yl);
    x.save(); x.beginPath(); x.rect(L, T, R - L, B - T); x.clip();
    var blue = css("--blue"), acc = css("--acc"), err = css("--err");
    if (t.kind === "triax") {
      res.circles.forEach(function (q) { x.strokeStyle = blue; x.lineWidth = 1.6; x.beginPath(); x.arc(X(q.c), Y(0), q.R * (R - L) / (x1 - x0), Math.PI, 2 * Math.PI); x.stroke(); });
      x.strokeStyle = err; x.lineWidth = 2; x.beginPath(); if (res.phi) { var tp = Math.tan(res.phi * Math.PI / 180); x.moveTo(X(0), Y(res.c)); x.lineTo(X(x1), Y(res.c + tp * x1)); } else { x.moveTo(X(0), Y(res.cu)); x.lineTo(X(x1), Y(res.cu)); } x.stroke();
    } else {
      x.strokeStyle = blue; x.fillStyle = blue; x.lineWidth = 2; x.beginPath(); pts.forEach(function (p, i) { if (i) x.lineTo(X(p[0]), Y(p[1])); else x.moveTo(X(p[0]), Y(p[1])); }); if (t.kind !== "shear") x.stroke();
      pts.forEach(function (p) { x.beginPath(); x.arc(X(p[0]), Y(p[1]), 3.5, 0, 7); x.fill(); });
      x.lineWidth = 1.5;
      if (t.kind === "shear") { x.strokeStyle = err; x.beginPath(); x.moveTo(X(0), Y(res.c)); x.lineTo(X(x1), Y(res.c + Math.tan(res.phi * Math.PI / 180) * x1)); x.stroke(); }
      if (t.kind === "compaction") { x.strokeStyle = acc; x.setLineDash([5, 4]); x.beginPath(); for (var wv = x0; wv <= x1; wv += (x1 - x0) / 40) { if (wv === x0) x.moveTo(X(wv), Y(res.zav(wv))); else x.lineTo(X(wv), Y(res.zav(wv))); } x.stroke(); x.setLineDash([]); x.strokeStyle = err; x.beginPath(); x.moveTo(X(res.omc), Y(y0)); x.lineTo(X(res.omc), Y(res.mdd)); x.lineTo(X(x0), Y(res.mdd)); x.stroke(); }
      if (t.kind === "cbr") { [[2.5, 13.435], [5, 20.153]].forEach(function (q) { x.strokeStyle = err; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(X(q[0]), Y(y0)); x.lineTo(X(q[0]), Y(y1)); x.stroke(); x.setLineDash([]); }); }
      if (t.kind === "consol") { [res.virgin, res.recomp].forEach(function (ln) { x.strokeStyle = err; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(X(x0), Y(ln.a + ln.b * Math.log10(x0))); x.lineTo(X(x1), Y(ln.a + ln.b * Math.log10(x1))); x.stroke(); x.setLineDash([]); }); if (res.pc) { x.strokeStyle = acc; x.beginPath(); x.moveTo(X(res.pc), Y(y0)); x.lineTo(X(res.pc), Y(y1)); x.stroke(); } }
    }
    x.restore();
  }

  /* ---------------- IS 1892 planning (site tab) ---------------- */
  U.after.site = function () {
    var pl = P().plan || (P().plan = { L: 30, W: 20, type: "isolated", Df: 1.5, B: 2, Lp: 15 });
    ["plL:L", "plW:W", "plDf:Df", "plB:B", "plLp:Lp"].forEach(function (q) { var a = q.split(":"); U.bind(a[0], pl, a[1], true); }); U.bind("plT", pl, "type");
    $("plBl").textContent = pl.type === "isolated" ? "Footing width (m)" : pl.type === "raft" ? "Raft width (m)" : "Pile-group width (m)"; $("plLpw").style.display = pl.type === "piles" ? "" : "none";
    var o = GC.plan1892({ L: pl.L, W: pl.W, type: pl.type, Df: pl.Df, B: pl.B, Br: pl.B, Bg: pl.B, Lp: pl.Lp });
    var b = GC.bh(P(), (P().boreholes[0] || {}).id), have = b ? GC.depth(b) : 0;
    $("plOut").innerHTML = o.items.map(function (t) { return '<div class="it"><span class="sev info">ℹ</span><span>' + esc(t) + '</span></div>'; }).join("") +
      (b ? '<div class="it"><span class="sev ' + (have >= o.depth ? "ok" : "warn") + '">' + (have >= o.depth ? "✔" : "⚠") + '</span><span>' + esc(b.name) + ' is logged to ' + f1(have, 1) + ' m — ' + (have >= o.depth ? "deep enough." : "deepen it to at least " + f1(o.depth, 1) + " m.") + ' Also compare with the depth where the pressure bulb falls to 0.1q (Pressure bulb tab).</span></div>' : '');
  };

  /* ---------------- earthquake ---------------- */
  U.tabs.seis = function () {
    var e = P().seis || (P().seis = { bh: "", zone: "V", amax: "", Mw: 7.5, ER: 60, Db: 150 });
    $("eqBh").innerHTML = P().boreholes.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join(""); if (!e.bh && P().boreholes[0]) e.bh = P().boreholes[0].id;
    U.bind("eqBh", e, "bh"); U.bind("eqZ", e, "zone"); ["eqA:amax", "eqM:Mw", "eqER:ER", "eqDb:Db"].forEach(function (q) { var a = q.split(":"); U.bind(a[0], e, a[1], true); });
    var b = GC.bh(P(), e.bh); if (!b) { $("eqRes").innerHTML = '<div class="note">Add a borehole first.</div>'; return; }
    var L = GC.liquefaction(P(), e.bh, e), sc = L.site;
    $("eqRes").innerHTML = '<div class="stat"><div><small>Site class (IS 1893 Table 4)</small><b class="big">' + (sc.type ? "Type " + sc.type : "—") + '</b><div class="note">' + esc(sc.desc || sc.note || "") + (sc.N ? " (N̄ = " + f1(sc.N, 1) + " from " + sc.n + " readings)" : "") + '</div></div>' +
      '<div><small>Readings that liquefy (FS < 1)</small><b class="big">' + L.liquefied + '</b></div><div><small>Liquefaction potential index (Iwasaki)</small><b class="big">' + f1(L.LPI, 1) + '</b> <span class="note">' + L.LPIclass + '</span></div><div><small>Settlement after liquefaction (Idriss–Boulanger)</small><b class="big">' + f1(L.settle, 0) + '</b> mm</div></div>' +
      '<div class="verdict ' + (L.liquefied ? "err" : "ok") + '">' + (L.liquefied ? "Liquefaction is likely at " + L.rows.filter(function (q) { return q.FS !== null && q.FS < 1; }).map(function (q) { return f1(q.z, 1) + " m"; }).join(", ") + ". Shallow footings on these layers can lose support; consider ground improvement (stone columns, densification) or piles founded below them, and add the drag of the liquefied layers to the piles." : "No reading liquefies at amax/g = " + L.amax + ", Mw " + L.Mw + ".") + '</div>' +
      '<div class="note">CSR = 0.65·(amax/g)·(σv/σ′v)·rd with amax/g = ' + L.amax + (+e.amax > 0 ? "" : " (zone factor Z, used when no PGA is available)") + '; CRR from (N1)60cs with the fines correction, MSF = ' + f1(L.MSF, 3) + ', Kσ for σ′v above 1 atm. N corrected for energy (CE = ' + f1(L.CE, 2) + '), borehole (CB = ' + L.CB + '), rod length and overburden (CN ≤ 1.7). A factor of safety between 1.0 and 1.2 is marginal.</div>';
    $("eqTab").innerHTML = '<table class="mini" style="margin-top:8px"><tr><th>Depth</th><th>Layer</th><th class="n">N</th><th class="n">(N1)60cs</th><th class="n">CSR</th><th class="n">CRR</th><th class="n">FS</th><th class="n">εv %</th></tr>' + L.rows.map(function (q) { return '<tr' + (q.FS !== null && q.FS < 1 ? ' style="color:var(--err)"' : '') + '><td>' + f1(q.z, 1) + '</td><td>' + esc(q.layer) + (q.na ? '<div class="note" style="margin:0">' + esc(q.na) + '</div>' : '') + '</td><td class="n">' + q.N + '</td><td class="n">' + (q.na ? "—" : f1(q.N1cs, 1)) + '</td><td class="n">' + f1(q.CSR, 3) + '</td><td class="n">' + (q.na ? "—" : isFinite(q.CRR) ? f1(q.CRR, 3) : "∞") + '</td><td class="n">' + (q.na ? "—" : isFinite(q.FS) ? f1(q.FS, 2) : "∞") + '</td><td class="n">' + (q.ev ? f1(q.ev * 100, 1) : "—") + '</td></tr>'; }).join("") + '</table>';
    drawEq(L);
  };
  function drawEq(L) {
    var c = U.cv("eqCv", 0.7, 260), x = c.x, w = c.w, h = c.h, Lx = 46, R = w - 14, T = 24, B = h - 14, zm = Math.max(10, Math.max.apply(null, L.rows.map(function (q) { return q.z; })) + 1), fm = 3;
    function X(v) { return Lx + Math.min(v, fm) / fm * (R - Lx); } function Y(z) { return T + z / zm * (B - T); }
    x.strokeStyle = css("--line"); x.strokeRect(Lx, T, R - Lx, B - T); x.font = "11px Inter, system-ui"; x.fillStyle = css("--mut"); x.textAlign = "center";
    for (var f = 0; f <= fm; f += 0.5) { x.beginPath(); x.moveTo(X(f), T); x.lineTo(X(f), B); x.stroke(); x.fillText(f, X(f), T - 6); }
    x.textAlign = "right"; for (var z = 0; z <= zm; z += 2) x.fillText(z + " m", Lx - 4, Y(z) + 4);
    x.fillStyle = "rgba(220,38,38,.10)"; x.fillRect(Lx, T, X(1) - Lx, B - T); x.fillStyle = "rgba(217,119,6,.10)"; x.fillRect(X(1), T, X(1.2) - X(1), B - T);
    x.strokeStyle = css("--err"); x.lineWidth = 1.5; x.beginPath(); x.moveTo(X(1), T); x.lineTo(X(1), B); x.stroke();
    L.rows.forEach(function (q) { if (q.FS === null) { x.fillStyle = css("--mut"); x.beginPath(); x.arc(Lx + 6, Y(q.z), 2.5, 0, 7); x.fill(); return; } x.fillStyle = q.FS < 1 ? css("--err") : q.FS < 1.2 ? css("--warn") : css("--ok"); x.beginPath(); x.arc(X(isFinite(q.FS) ? q.FS : fm), Y(q.z), 5, 0, 7); x.fill(); });
    x.fillStyle = css("--mut"); x.textAlign = "center"; x.fillText("factor of safety against liquefaction →", (Lx + R) / 2, T - 14 < 10 ? 10 : T - 14);
  }

  /* ---------------- walls ---------------- */
  function curWall() { return U.cur(list("walls"), S.wl); }
  U.tabs.walls = function () {
    var w = curWall(); U.chips("wlChips", list("walls"), w && w.id, function (id) { S.wl = id; });
    if (!w) { $("wlRes").innerHTML = '<div class="note">No wall yet — add one.</div>'; return; }
    S.wl = w.id; U.bind("wlName", w, "name"); U.bind("wlType", w, "type");
    ["wlH:H", "wlB:B", "wlGc:gc", "wlBt:bt", "wlBf:bf", "wlTb:tb", "wlLt:Lt", "wlSb:sb", "wlSt:st", "wlG:g", "wlPhi:phi", "wlI:i", "wlQ:q", "wlHw:hw", "wlMu:mu", "wlQa:qa", "wlD:D", "wlAh:ah", "wlAv:av"].forEach(function (q) { var a = q.split(":"); U.bind(a[0], w, a[1], true); });
    U.bind("wlPass", w, "passive"); U.bind("wlEq", w, "seismic");
    $("wlGrav").style.display = w.type === "gravity" ? "" : "none"; $("wlCant").style.display = w.type === "cantilever" ? "" : "none";
    $("wlQaFrom").innerHTML = '<option value="">Allowable bearing from a borehole…</option>' + P().boreholes.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + ' (IS 6403 strip B × D)</option>'; }).join("");
    var k = GC.wallCheck(w);
    $("wlRes").innerHTML = '<div class="verdict ' + (k.ok ? "ok" : "err") + '">' + (k.ok ? "Satisfies the IS 14458 (Part 2) checks" + (w.seismic ? " with earthquake forces." : ".") : "Does not satisfy every check — see the table; use \"Find the smallest base width\" or change the section.") + '</div>' +
      '<table class="mini"><tr><th>Check</th><th class="n">Value</th><th class="n">Required</th><th></th></tr>' + k.checks.map(function (c) { return '<tr><td>' + esc(c.n) + '</td><td class="n">' + (isFinite(c.v) ? f1(c.v, 2) : "∞") + '</td><td class="n">' + (c.need === null ? "enter qa" : (c.le ? "≤ " : "≥ ") + f1(c.need, 2)) + '</td><td>' + (c.ok === null ? "" : c.ok ? '<span class="sev ok">✔</span>' : '<span class="sev err">✘</span>') + '</td></tr>'; }).join("") + '</table>' +
      '<div class="note">Base pressures: ' + f1(k.qmax, 0) + ' / ' + f1(k.qmin, 0) + ' kPa (eccentricity ' + f1(k.e, 3) + ' m, B/6 = ' + f1(w.B / 6, 3) + ' m). Earth pressure on a vertical plane through the heel, Rankine Ka = ' + f1(k.Ka, 3) + (k.Ca ? ', dynamic Ca = ' + f1(k.Ca, 3) : '') + '. Also check the overall slip of the slope through and below the wall (2D FE tab: "IS 14458 hill slope").</div>' + k.notes.map(function (n) { return '<div class="note">' + esc(n) + '</div>'; }).join("");
    $("wlTab").innerHTML = '<details><summary>Forces (per metre run)</summary><table class="mini"><tr><th>Vertical</th><th class="n">kN</th><th class="n">arm from toe (m)</th></tr>' + k.V.map(function (v) { return '<tr><td>' + esc(v.n) + '</td><td class="n">' + f1(v.F, 1) + '</td><td class="n">' + f1(v.x, 2) + '</td></tr>'; }).join("") + (k.U ? '<tr><td>Uplift</td><td class="n">−' + f1(k.U, 1) + '</td><td class="n">' + f1(2 * w.B / 3, 2) + '</td></tr>' : '') + '<tr><th>Horizontal</th><th class="n">kN</th><th class="n">height (m)</th></tr>' + k.H.map(function (v) { return '<tr><td>' + esc(v.n) + '</td><td class="n">' + f1(v.F, 1) + '</td><td class="n">' + f1(v.y, 2) + '</td></tr>'; }).join("") + '</table></details>';
    drawWall(w, k);
  };
  function drawWall(w, k) {
    var c = U.cv("wlCv", 0.75, 260), x = c.x, sh = k.shape, H = sh.Hv, B = +w.B, ext = B + Math.max(2, H * 0.8), sc = Math.min((c.w - 40) / (ext + 1), (c.h - 40) / (H + 1.2)), ox = 30, oy = c.h - 25;
    function X(v) { return ox + (v + 0.6) * sc; } function Y(v) { return oy - v * sc; }
    /* ground in front and backfill */
    var i = (+w.i || 0) * Math.PI / 180, xTop = sh.parts[sh.parts.length - 1].poly[2][0];
    x.fillStyle = "rgba(226,196,122,.45)"; x.beginPath(); x.moveTo(X(xTop), Y(+w.H)); x.lineTo(X(ext), Y(+w.H + (ext - xTop) * Math.tan(i))); x.lineTo(X(ext), Y(0)); x.lineTo(X(B), Y(0)); x.closePath(); x.fill();
    x.fillStyle = "rgba(201,184,153,.5)"; x.fillRect(X(-0.6), Y(+w.D || 0), (0.6) * sc, (+w.D || 0) * sc);
    sh.soil.forEach(function (p) { x.fillStyle = "rgba(226,196,122,.75)"; poly(p.poly); x.fill(); });
    sh.parts.forEach(function (p) { x.fillStyle = w.type === "cantilever" ? "#9ca3af" : "#a8a29e"; poly(p.poly); x.fill(); x.strokeStyle = css("--ink"); x.stroke(); });
    function poly(pp) { x.beginPath(); pp.forEach(function (q, j) { if (j) x.lineTo(X(q[0]), Y(q[1])); else x.moveTo(X(q[0]), Y(q[1])); }); x.closePath(); }
    if (+w.hw > 0) { x.strokeStyle = css("--blue"); x.setLineDash([5, 4]); x.beginPath(); x.moveTo(X(B), Y(+w.hw)); x.lineTo(X(ext), Y(+w.hw)); x.stroke(); x.setLineDash([]); }
    /* virtual back and thrust arrow */
    x.strokeStyle = css("--err"); x.setLineDash([3, 3]); x.beginPath(); x.moveTo(X(B), Y(0)); x.lineTo(X(B), Y(H)); x.stroke(); x.setLineDash([]);
    var hs = k.H.reduce(function (a, q) { return a + q.F; }, 0), yb = k.H.reduce(function (a, q) { return a + q.F * q.y; }, 0) / (hs || 1);
    arrow(X(B + 1.2), Y(yb), X(B + 0.05), Y(yb), css("--err"), "ΣH " + f1(hs, 0) + " kN");
    /* resultant on the base */
    if (isFinite(k.xr)) { x.fillStyle = Math.abs(k.e) <= B / 6 ? css("--ok") : css("--err"); x.beginPath(); x.arc(X(k.xr), Y(0), 5, 0, 7); x.fill(); x.strokeStyle = css("--mut"); x.setLineDash([2, 3]); x.beginPath(); x.moveTo(X(B / 3), Y(-0.15)); x.lineTo(X(2 * B / 3), Y(-0.15)); x.stroke(); x.setLineDash([]); }
    function arrow(x1, y1, x2, y2, col, t) { x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); x.beginPath(); x.moveTo(x2, y2); x.lineTo(x2 + 8, y2 - 4); x.lineTo(x2 + 8, y2 + 4); x.fill(); x.lineWidth = 1; x.font = "11px Inter, system-ui"; x.textAlign = "left"; x.fillText(t, x1 + 4, y1 - 6); }
  }
  $("wlSize").onclick = function () { var w = curWall(); if (!w) return; var B = GC.wallSize(w); if (!B) return U.toast("No base width up to 2H works — change the section or the backfill"); U.commit(); w.B = B; U.changed(); U.toast("Base width " + B + " m satisfies every check"); };
  $("wlNew").onclick = function () { U.commit(); var w = { id: GC.uid(), name: "Wall " + (list("walls").length + 1), type: "cantilever", H: 4, B: 2.6, bt: 0.5, bf: 0, gc: 25, tb: 0.4, Lt: 0.6, sb: 0.35, st: 0.2, g: 18, phi: 30, i: 0, q: 10, hw: 0, mu: 0.5, qa: 200, D: 0.6, passive: false, seismic: false, ah: 0.18, av: 0.12 }; list("walls").push(w); S.wl = w.id; U.changed(); };
  $("wlDel").onclick = function () { var w = curWall(); if (!w) return; U.commit(); P().walls = list("walls").filter(function (x) { return x !== w; }); S.wl = null; U.changed(); };
  $("wlQaFrom").onchange = function () { var v = this.value; if (!v) return; var w = curWall(), f = { bh: v, shape: "strip", B: +w.B, L: +w.B, Df: Math.max(+w.D || 0, 0.3), P: 0, H: 0 }, bc = GC.bearing(P(), f); if (bc.err) return U.toast(bc.err); U.commit(); w.qa = r(bc.qsg, 0); U.changed(); U.toast("Safe gross bearing " + w.qa + " kPa from IS 6403 (strip " + w.B + " m at " + f.Df + " m)"); };

  /* ---------------- rock ---------------- */
  function curRock() { return U.cur(list("rocks"), S.rk); }
  U.tabs.rock = function () {
    var k = curRock(); U.chips("rkChips", list("rocks"), k && k.id, function (id) { S.rk = id; });
    if (!k) { $("rkRes").innerHTML = '<div class="note">No rock yet — add one.</div>'; return; }
    S.rk = k.id; var O = GC.RMR_OPT;
    $("rkCond").innerHTML = O.cond.map(function (q, i) { return '<option value="' + i + '">' + esc(q[0]) + ' (' + q[1] + ')</option>'; }).join("");
    $("rkGw").innerHTML = O.gw.map(function (q, i) { return '<option value="' + i + '">' + esc(q[0]) + ' (' + q[1] + ')</option>'; }).join("");
    $("rkOr").innerHTML = O.orient.map(function (q, i) { return '<option value="' + i + '">' + esc(q[0]) + ' (' + q[1] + ')</option>'; }).join("");
    U.bind("rkName", k, "name"); ["rkUcs:ucs", "rkRqd:rqd", "rkSp:sp", "rkAp:ap", "rkB:B"].forEach(function (q) { var a = q.split(":"); U.bind(a[0], k, a[1], true); });
    U.bind("rkCond", k, "cond", true); U.bind("rkGw", k, "gw", true); U.bind("rkOr", k, "orient", true);
    var m = GC.rmr(k), b = GC.rockBearing(k);
    $("rkRes").innerHTML = '<div class="stat"><div><small>Rock mass rating</small><b class="big">' + m.RMR + '</b> <span class="note">class ' + m.cls + ' — ' + m.desc + '</span></div><div><small>Ratings: strength, RQD, spacing, joints, water, orientation</small><b class="big" style="font-size:17px">' + m.parts.join(" + ").replace("+ -", "− ") + '</b></div>' +
      '<div><small>Rock-mass c and φ (class ' + m.cls + ')</small><b class="big" style="font-size:17px">' + m.c + ' kPa, ' + m.phi + '°</b></div><div><small>Deformation modulus Em</small><b class="big">' + f1(m.Em, 1) + '</b> GPa</div>' +
      '<div><small>Net allowable pressure, IS 12070 (Nj = ' + f1(b.Nj, 3) + ')</small><b class="big">' + f1(b.qa / 1000, 2) + '</b> MPa</div><div><small>Settlement at that pressure (indicative)</small><b class="big">' + f1(b.settle, 1) + '</b> mm <span class="note">limit 12 mm</span></div></div>' +
      b.notes.map(function (n) { return '<div class="note">' + esc(n) + '</div>'; }).join("") + '<div class="note">Where the rock is weathered, closely jointed or fragmented, IS 12070 asks for plate load tests instead; and the allowable pressure should not exceed the crushing strength of the foundation concrete.</div>';
  };
  $("rkNew").onclick = function () { U.commit(); var k = { id: GC.uid(), name: "Rock " + (list("rocks").length + 1), ucs: 40, rqd: 70, sp: 0.5, cond: 1, gw: 1, orient: 1, ap: 2, B: 2 }; list("rocks").push(k); S.rk = k.id; U.changed(); };
  $("rkDel").onclick = function () { var k = curRock(); if (!k) return; U.commit(); P().rocks = list("rocks").filter(function (x) { return x !== k; }); S.rk = null; U.changed(); };


  /* ---------------- report sections for these modules ---------------- */
  function shot(id) { try { return '<img style="width:100%;max-width:640px;border:1px solid #ddd;border-radius:8px;margin:6px 0" src="' + $(id).toDataURL("image/png") + '">'; } catch (e) { return ""; } }
  U.after.report = function () {
    var p = P(), h = "", keepW = S.wl, keepR = S.rk;
    S.hi = 4;
    try {
      var e = p.seis; if (e && GC.bh(p, e.bh) && (GC.bh(p, e.bh).spt || []).length) { U.tabs.seis(); var L = GC.liquefaction(p, e.bh, e);
        h += '<h2>Earthquake — site class and liquefaction (IS 1893 Part 1:2016)</h2><table class="mini"><tr><td>Site class</td><td class="n">' + (L.site.type ? "Type " + L.site.type + " (N̄ " + f1(L.site.N, 1) + ")" : "—") + '</td></tr><tr><td>amax/g, Mw</td><td class="n">' + L.amax + ', ' + L.Mw + '</td></tr><tr><td>Readings liquefying (FS < 1)</td><td class="n">' + L.liquefied + '</td></tr><tr><td>Liquefaction potential index</td><td class="n">' + f1(L.LPI, 1) + ' (' + L.LPIclass + ')</td></tr><tr><td>Settlement after liquefaction</td><td class="n">' + f1(L.settle, 0) + ' mm</td></tr></table>' + shot("eqCv") + $("eqTab").innerHTML; }
      list("walls").forEach(function (w) { S.wl = w.id; U.tabs.walls(); var k = GC.wallCheck(w);
        h += '<h2>' + esc(w.name) + ' — ' + (w.type === "cantilever" ? "RCC cantilever" : "gravity") + ' wall, H ' + w.H + ' m, B ' + w.B + ' m (IS 14458 Part 2' + (w.seismic ? ", with earthquake" : "") + ')</h2><table class="mini"><tr><th>Check</th><th class="n">Value</th><th class="n">Required</th></tr>' + k.checks.map(function (c) { return '<tr><td>' + esc(c.n) + '</td><td class="n">' + (isFinite(c.v) ? f1(c.v, 2) : "∞") + '</td><td class="n">' + (c.need === null ? "—" : (c.le ? "≤ " : "≥ ") + f1(c.need, 2)) + ' ' + (c.ok === false ? '<b style="color:#b42318">NOT OK</b>' : c.ok ? "OK" : "") + '</td></tr>'; }).join("") + '</table>' + shot("wlCv"); });
      list("rocks").forEach(function (k) { var m = GC.rmr(k), b = GC.rockBearing(k);
        h += '<h2>' + esc(k.name) + ' — rock (IS 13365, IS 12070)</h2><table class="mini"><tr><td>RMR (class)</td><td class="n">' + m.RMR + ' (' + m.cls + ', ' + m.desc + ')</td></tr><tr><td>Net allowable pressure (Nj ' + f1(b.Nj, 3) + ')</td><td class="n">' + f1(b.qa / 1000, 2) + ' MPa</td></tr><tr><td>Rock-mass c, φ; Em</td><td class="n">' + m.c + ' kPa, ' + m.phi + '°; ' + f1(m.Em, 1) + ' GPa</td></tr></table>'; });
      var tests = list("tests"); if (tests.length) { h += '<h2>Laboratory tests (IS 2720)</h2><table class="mini"><tr><th>Test</th><th>Sample</th><th>Result</th></tr>' + tests.map(function (t) { var r_ = run(t), v = r_.err ? r_.err : t.kind === "compaction" ? "OMC " + f1(r_.omc, 1) + " %, MDD " + f1(r_.mdd, 3) + " g/cc" : t.kind === "cbr" ? "CBR " + f1(r_.cbr, 1) + " %" : t.kind === "shear" ? "c " + f1(r_.c, 1) + " kPa, φ " + f1(r_.phi, 1) + "°" : t.kind === "triax" ? (r_.phi ? "c " + f1(r_.c, 1) + " kPa, φ " + f1(r_.phi, 1) + "°" : "cu " + f1(r_.cu, 1) + " kPa") : "Cc " + f1(r_.Cc, 3) + ", Cr " + f1(r_.Cr, 3) + (r_.pc ? ", σ′p " + f1(r_.pc, 0) + " kPa" : "") + (r_.cv ? ", cv " + f1(r_.cv, 2) + " m²/yr" : ""); return '<tr><td>' + esc(TESTS[t.kind].t.split(" —")[0]) + '</td><td>' + esc(t.name) + '</td><td>' + esc(v) + '</td></tr>'; }).join("") + '</table>'; }
      Object.keys(S.slRes || {}).forEach(function (id) { var sObj = list("slopes").filter(function (x) { return x.id === id; })[0], res = S.slRes[id]; if (!sObj || !res) return;
        h += '<h2>' + esc(sObj.name) + ' — slope stability</h2><table class="mini"><tr><td>Factor of safety, finite elements (strength reduction)</td><td class="n">' + (res.fos ? f1(res.fos, 2) : "—") + '</td></tr><tr><td>Factor of safety, Bishop simplified</td><td class="n">' + (res.bi ? f1(res.bi.F, 2) : "—") + '</td></tr></table>' + shot("slCv"); });
    } finally { S.hi = false; S.wl = keepW; S.rk = keepR; }
    if (h) { var div = document.createElement("div"); div.innerHTML = h; var last = $("rBody").lastElementChild; $("rBody").insertBefore(div, last); }
  };

  U.refresh();
})();
