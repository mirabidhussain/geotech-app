/* IS GeoTech — laboratory tests (IS 2720), rock (IS 12070, RMR per IS 13365 Part 1), subsurface investigation planning
   (IS 1892) and under-reamed piles (IS 2911 Part 3). Units: m, kN, kPa unless stated. */
(function (C) {
  "use strict";
  var D2R = Math.PI / 180;
  function linreg(x, y) { var n = x.length, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0; for (var i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; syy += y[i] * y[i]; }
    var b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n, r2 = Math.pow(n * sxy - sx * sy, 2) / ((n * sxx - sx * sx) * (n * syy - sy * sy) || 1); return { a: a, b: b, r2: r2 }; }
  C.linreg = linreg;

  /* compaction (IS 2720 Parts 7/8): rows [w %, bulk density g/cc]; OMC/MDD from a parabola through the top points; zero-air-voids line */
  C.compaction = function (rows, G) {
    G = G || 2.65; var pts = rows.filter(function (r) { return r[1] > 0; }).map(function (r) { return { w: +r[0], rd: r[1] / (1 + r[0] / 100) }; }).sort(function (a, b) { return a.w - b.w; });
    if (pts.length < 3) return { err: "Give at least three points" };
    var im = 0; pts.forEach(function (p, i) { if (p.rd > pts[im].rd) im = i; });
    var sel = pts.slice(Math.max(0, im - 1), Math.min(pts.length, im + 2)); if (sel.length < 3) sel = im === 0 ? pts.slice(0, 3) : pts.slice(-3);
    var x = sel.map(function (p) { return p.w; }), y = sel.map(function (p) { return p.rd; });
    /* exact parabola through three points */
    var d = (x[0] - x[1]) * (x[0] - x[2]) * (x[1] - x[2]), A = (x[2] * (y[1] - y[0]) + x[1] * (y[0] - y[2]) + x[0] * (y[2] - y[1])) / d, Bc = (x[2] * x[2] * (y[0] - y[1]) + x[1] * x[1] * (y[2] - y[0]) + x[0] * x[0] * (y[1] - y[2])) / d, Cc = (x[1] * x[2] * (x[1] - x[2]) * y[0] + x[2] * x[0] * (x[2] - x[0]) * y[1] + x[0] * x[1] * (x[0] - x[1]) * y[2]) / d;
    var omc = A < 0 ? -Bc / (2 * A) : pts[im].w, mdd = A < 0 ? Cc - Bc * Bc / (4 * A) : pts[im].rd;
    if (omc < x[0] || omc > x[2]) { omc = pts[im].w; mdd = pts[im].rd; }
    return { pts: pts, omc: omc, mdd: mdd, zav: function (w) { return G / (1 + w / 100 * G); }, G: G };
  };
  /* CBR (IS 2720 Part 16): rows [penetration mm, load kN]; standard loads 1370 kgf at 2.5 mm and 2055 kgf at 5 mm */
  C.cbr = function (rows) {
    var r = rows.filter(function (x) { return x[0] >= 0; }).sort(function (a, b) { return a[0] - b[0]; });
    function at(p) { for (var i = 0; i + 1 < r.length; i++) if (p >= r[i][0] && p <= r[i + 1][0]) return r[i][1] + (p - r[i][0]) / (r[i + 1][0] - r[i][0]) * (r[i + 1][1] - r[i][1]); return null; }
    var s25 = 1370 * 9.80665 / 1000, s50 = 2055 * 9.80665 / 1000, l25 = at(2.5), l50 = at(5);
    if (l25 === null || l50 === null) return { err: "Readings must cover 2.5 mm and 5.0 mm" };
    var c25 = 100 * l25 / s25, c50 = 100 * l50 / s50;
    return { rows: r, l25: l25, l50: l50, c25: c25, c50: c50, cbr: Math.max(c25, c50), note: c50 > c25 ? "The 5.0 mm value is higher: IS 2720 Part 16 asks for the test to be repeated; if the result is similar, the 5.0 mm value is used." : "" };
  };
  /* direct shear (IS 2720 Part 13): rows [normal stress, peak shear] */
  C.directShear = function (rows) { var x = rows.map(function (r) { return +r[0]; }), y = rows.map(function (r) { return +r[1]; }); if (x.length < 2) return { err: "Give at least two tests" }; var L = linreg(x, y); return { c: Math.max(0, L.a), phi: Math.atan(L.b) / D2R, r2: L.r2, rows: rows }; };
  /* triaxial (IS 2720 Parts 11/12): rows [σ3, deviator at failure]; p–q line → c, φ; UU: cu = mean of q */
  C.triaxial = function (rows, kind) {
    var p = rows.map(function (r) { return +r[0] + r[1] / 2; }), q = rows.map(function (r) { return r[1] / 2; });
    if (kind === "UU" || rows.length < 2) { var cu = q.reduce(function (a, b) { return a + b; }, 0) / q.length; return { cu: cu, phi: 0, c: cu, rows: rows, circles: rows.map(function (r) { return { c: +r[0] + r[1] / 2, R: r[1] / 2 }; }) }; }
    var L = linreg(p, q), sphi = Math.min(0.99, Math.max(0, L.b)), phi = Math.asin(sphi) / D2R, c = L.a / Math.cos(phi * D2R);
    return { phi: phi, c: Math.max(0, c), r2: L.r2, rows: rows, circles: rows.map(function (r) { return { c: +r[0] + r[1] / 2, R: r[1] / 2 }; }) };
  };
  /* one-dimensional consolidation (IS 2720 Part 15): rows [pressure kPa, void ratio]; σ′p from the intersection of the
     recompression and virgin lines on the e–log p plot; Cc from the last loading points; cv from t90 */
  C.consol = function (rows, o) {
    o = o || {}; var r = rows.filter(function (x) { return x[0] > 0; }), ld = [], un = [];
    r.forEach(function (x, i) { if (i && x[0] < r[i - 1][0]) un.push(x); else if (!un.length) ld.push(x); });
    if (ld.length < 3) return { err: "Give at least three loading stages" };
    var lp = ld.map(function (x) { return Math.log10(x[0]); }), e = ld.map(function (x) { return +x[1]; }), n = ld.length;
    var v = linreg(lp.slice(-3), e.slice(-3)), Cc = -v.b, rc = linreg(lp.slice(0, 2), e.slice(0, 2)), Cr = un.length >= 2 ? -linreg(un.map(function (x) { return Math.log10(x[0]); }), un.map(function (x) { return +x[1]; })).b : -rc.b;
    var pc = null; if (Cc > Cr + 1e-6) { var lx = (v.a - rc.a) / (rc.b - v.b); pc = Math.pow(10, lx); if (pc < ld[0][0] || pc > ld[n - 1][0]) pc = null; }
    var out = { rows: r, Cc: Cc, Cr: Math.max(0, Cr), pc: pc, e0: o.e0 || ld[0][1], virgin: v, recomp: rc };
    if (o.t90 > 0 && o.H > 0) { var Hdr = (o.drain === "one" ? 1 : 0.5) * o.H / 1000; out.cv = 0.848 * Hdr * Hdr / (o.t90 / (60 * 24 * 365)); } /* t90 in minutes, H in mm → cv in m²/year */
    if (n >= 2) { var a = ld[n - 2], b = ld[n - 1]; out.mv = (a[1] - b[1]) / (1 + a[1]) / ((b[0] - a[0]) / 1000); } /* m²/MN */
    return out;
  };

  /* ---------------- rock ---------------- */
  /* RMR (IS 13365 Part 1, after Bieniawski 1989) */
  C.RMR_OPT = {
    ucs: [[250, 15], [100, 12], [50, 7], [25, 4], [5, 2], [1, 1], [0, 0]],
    rqd: [[90, 20], [75, 17], [50, 13], [25, 8], [0, 3]],
    sp: [[2, 20], [0.6, 15], [0.2, 10], [0.06, 8], [0, 5]],
    cond: [["Very rough, not continuous, no separation, unweathered", 30], ["Slightly rough, separation < 1 mm, slightly weathered", 25], ["Slightly rough, separation < 1 mm, highly weathered", 20], ["Slickensided, or gouge < 5 mm, or separation 1–5 mm, continuous", 10], ["Soft gouge > 5 mm or separation > 5 mm, continuous", 0]],
    gw: [["Completely dry", 15], ["Damp", 10], ["Wet", 7], ["Dripping", 4], ["Flowing", 0]],
    orient: [["Very favourable", 0], ["Favourable", -2], ["Fair", -7], ["Unfavourable", -15], ["Very unfavourable", -25]]
  };
  function band(t, v) { for (var i = 0; i < t.length; i++) if (v >= t[i][0]) return t[i][1]; return t[t.length - 1][1]; }
  C.rmr = function (r) {
    var o = C.RMR_OPT, a = band(o.ucs, +r.ucs), b = band(o.rqd, +r.rqd), c = band(o.sp, +r.sp), d = o.cond[+r.cond || 0][1], e = o.gw[+r.gw || 0][1], f = o.orient[+r.orient || 0][1];
    var basic = a + b + c + d + e, R = basic + f, cls = R > 80 ? ["I", "Very good rock", ">400", ">45"] : R > 60 ? ["II", "Good rock", "300–400", "35–45"] : R > 40 ? ["III", "Fair rock", "200–300", "25–35"] : R > 20 ? ["IV", "Poor rock", "100–200", "15–25"] : ["V", "Very poor rock", "<100", "<15"];
    var Em = R > 50 ? 2 * R - 100 : Math.pow(10, (R - 10) / 40); /* GPa: Bieniawski (RMR > 50), Serafim & Pereira otherwise */
    return { parts: [a, b, c, d, e, f], basic: basic, RMR: R, cls: cls[0], desc: cls[1], c: cls[2], phi: cls[3], Em: Em };
  };
  /* IS 12070 cl. 5.1: net allowable pressure from the intact strength qc reduced for the discontinuities,
     qa = qc·Nj, Nj = (3 + S/B) / (10·√(1 + 300·δ/S)), S spacing, δ aperture, B footing width */
  C.rockBearing = function (r) {
    var qc = +r.ucs * 1000, S = +r.sp, dl = (+r.ap || 0) / 1000, B = +r.B || 1;
    var Nj = (3 + S / B) / (10 * Math.sqrt(1 + 300 * dl / Math.max(S, 1e-6))), qa = qc * Nj;
    var Em = C.rmr(r).Em * 1e6, s = Em > 0 ? qa * B * 0.85 / Em * 1000 : null; /* rigid square, ν ≈ 0.25 — indicative, mm */
    return { Nj: Nj, qa: qa, settle: s, limit: 12, notes: ["Valid where the discontinuity spacing exceeds about 0.3 m, the aperture is under about 10 mm (5 mm if filled) and the footing is wider than about 0.3 m.", "Settlement checked against 12 mm (IS 12070 permissible value for rock)."] };
  };

  /* ---------------- IS 1892 investigation planning ---------------- */
  C.plan1892 = function (o) {
    var L = +o.L || 20, W = +o.W || 15, out = { items: [] }, dep;
    var n = Math.max(3, Math.ceil(L * W / 600) + (L > 60 || W > 60 ? 1 : 0));
    out.items.push("At least " + n + " boreholes for a " + L + " × " + W + " m building (never fewer than 3, and not in one straight line), placed at the corners and the centre; add more where the ground changes.");
    if (o.type === "isolated") dep = +o.Df + 1.5 * (+o.B || 2), out.items.push("Isolated footings: explore to at least 1.5 × footing width below the founding level → " + dep.toFixed(1) + " m below ground.");
    else if (o.type === "raft") dep = +o.Df + 1.5 * (+o.Br || W), out.items.push("Raft: at least 1.5 × the raft width below the founding level → " + dep.toFixed(1) + " m below ground.");
    else { dep = +o.Df + (+o.Lp || 15) + Math.max(5, 1.5 * (+o.Bg || 3)); out.items.push("Piles: at least 1.5 × the pile-group width below the pile tips, and not less than 5 m below them → " + dep.toFixed(1) + " m below ground."); }
    out.items.push("Carry every borehole through any soft or compressible layer into firm strata, even if that is deeper than the depth above; where rock is met, prove at least 3 m of rock to confirm it is not a boulder.");
    out.items.push("Record the water table in each borehole and take SPT every 1.5 m (or at each change of stratum); take undisturbed samples in clay for consolidation and strength tests.");
    out.depth = dep; out.n = n; return out;
  };

  /* ---------------- under-reamed piles (IS 2911 Part 3) ---------------- */
  /* Table 1 safe loads (t) for bored cast-in-situ under-reamed piles in medium sands / medium clays, bulb 2.5D, length 3.5 m (single) */
  C.UR_TABLE = [[20, 8, 12, 4, 6, 1.0, 1.2], [25, 12, 18, 6, 9, 1.5, 1.8], [30, 16, 24, 8, 12, 2.0, 2.4], [37.5, 24, 36, 12, 18, 3.0, 3.6], [40, 28, 42, 14, 21, 3.4, 4.0], [45, 35, 52.5, 17.5, 26.25, 4.0, 4.8], [50, 42, 63, 21, 31.5, 4.5, 5.4]];
  C.urTable = function (Dcm, n) { var t = C.UR_TABLE, i = 0; while (i + 1 < t.length && t[i + 1][0] <= Dcm) i++; var a = t[i], b = t[Math.min(i + 1, t.length - 1)], f = b[0] === a[0] ? 0 : Math.max(0, Math.min(1, (Dcm - a[0]) / (b[0] - a[0]))), k = n >= 2 ? 1 : 0;
    function L(j) { return a[j] + f * (b[j] - a[j]); } return { comp: L(1 + k) * 9.81, up: L(3 + k) * 9.81, lat: L(5 + k) * 9.81 }; };
  C.underReamed = function (P, p) {
    var bh = C.bh(P, p.bh), D = +p.D, Du = +p.Du || 2.5 * D, n = Math.max(1, +p.nb || 1), L = +p.L, z0 = +p.Df, zt = z0 + L, sp = +p.sb || 1.25 * Du;
    var d1 = zt - (n - 1) * sp - 0.5 * Du, steps = [], out = { steps: steps };
    var bulbs = []; for (var k = 0; k < n; k++) bulbs.push(d1 + k * sp);
    var Ap = Math.PI * D * D / 4, Aa = Math.PI * (Du * Du - D * D) / 4, tip = C.params(bh, C.layerAt(bh, zt - 1e-6)), clay = tip.kind === "clay";
    if (bulbs[0] - z0 < 2 * Du - 1e-9) out.warn = "The top bulb is less than 2 × bulb diameter below the cut-off (cl. 5.1.4) — lengthen the pile or use fewer bulbs.";
    if (clay) {
      var cp = tip.cu || 0, ca = 0, cs = 0, nca = 0, ncs = 0;
      bulbs.forEach(function (z) { var q = C.params(bh, C.layerAt(bh, z)); ca += q.cu || 0; nca++; }); ca /= nca;
      for (var z = z0 + 0.25; z < bulbs[0]; z += 0.5) { cs += C.params(bh, C.layerAt(bh, z)).cu || 0; ncs++; } cs = ncs ? cs / ncs : ca;
      var As1 = Math.PI * Du * (bulbs[n - 1] - bulbs[0]), As = Math.PI * D * Math.max(0, bulbs[0] - z0 - Du / 2);
      var t1 = Ap * 9 * cp, t2 = Aa * 9 * ca * n, t3 = n > 1 ? ca * As1 : 0, t4 = 0.5 * cs * As;
      out.Qu = t1 + t2 + t3 + t4; out.Qup = t2 + t3 + t4;
      steps.push("Clay (cl. 5.2.3.1 a): Qu = Ap·Nc·cp + n·Aa·Nc·ca + ca·As′ + α·c̄·As = " + [t1, t2, t3, t4].map(function (v) { return v.toFixed(0); }).join(" + ") + " = " + out.Qu.toFixed(0) + " kN (Nc = 9, α = 0.5)");
    } else {
      var g = function (z) { var q = C.params(bh, C.layerAt(bh, z)); return z > C.gwt(bh) ? (q.gsat || q.gamma) - 9.81 : q.gamma; }, phi = tip.phi || 30, F = C.factors(phi), Nq = +p.Nq > 0 ? +p.Nq : F.Nq, K = 1.75, td = Math.tan(phi * D2R);
      var gam = g(zt), sv = function (z) { return C.sv(bh, z).e; };
      var t1s = Ap * (0.5 * D * gam * F.Ng + sv(zt) * Nq), t2s = bulbs.reduce(function (a, z) { return a + Aa * (0.5 * Du * g(z) * F.Ng + sv(z) * Nq); }, 0);
      var t3s = Math.PI * D * K * td * (0.5 * gam * Math.pow(bulbs[0] - z0, 2) + Math.max(0, zt - bulbs[n - 1] - Du / 2) * sv((zt + bulbs[n - 1]) / 2));
      out.Qu = t1s + t2s + t3s; out.Qup = t2s + t3s;
      steps.push("Sand (cl. 5.2.3.1 b): Qu = Ap(½DγNγ + σ′Nq) + Σ Aa(½DuγNγ + σ′r·Nq) + stem friction with K = 1.75, δ = φ = " + phi.toFixed(1) + "° → " + [t1s, t2s, t3s].map(function (v) { return v.toFixed(0); }).join(" + ") + " = " + out.Qu.toFixed(0) + " kN" + (+p.Nq > 0 ? "" : " (Nq per IS 6403 — enter the Fig. 2 value if different)"));
    }
    out.Qsafe = out.Qu / 2.5; out.QupSafe = out.Qup / 3;
    var tab = C.urTable(D * 100, n); out.table = tab;
    out.Qdesign = Math.min(out.Qsafe, tab.comp); out.govTable = tab.comp < out.Qsafe;
    steps.push("Safe load: formula Qu/2.5 = " + out.Qsafe.toFixed(0) + " kN; Table 1 (medium soils) = " + tab.comp.toFixed(0) + " kN → the lesser, " + out.Qdesign.toFixed(0) + " kN, governs (cl. 5.2.3.4). Uplift: " + Math.min(out.QupSafe, tab.up).toFixed(0) + " kN; lateral (Table 1): " + tab.lat.toFixed(0) + " kN.");
    out.bulbs = bulbs; out.Du = Du; return out;
  };
})(GC);
