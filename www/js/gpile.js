/* IS GeoTech — piles: axial capacity (IS 2911 Part 1/Sec 2 Annex B), negative skin friction, uplift, single-pile
   settlement (Vesic), groups (IS 2911 cl. 6.7, block failure, equivalent raft settlement), lateral load on a
   Winkler beam with IS 2911 Annex C subgrade values, springs for frame models. Units: m, kN, kPa, mm. */
(function (C) {
  "use strict";
  var D2R = Math.PI / 180, r = C.r;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(x, x0, x1, y0, y1) { return y0 + (y1 - y0) * clamp((x - x0) / (x1 - x0), 0, 1); }

  C.pileDefault = function (bh) {
    return { id: C.uid(), name: "P1", bh: bh, D: 0.5, L: 15, Df: 1.5, fck: 25, P: 600, H: 30, M: 0, e: 0, head: "fixed", K: 1.0, Nq: "", method: "lower", nsf: [],
      nx: 2, ny: 2, s: 1.5, cap: true };
  };
  /* adhesion factor — default after API RP 2A (1984): 1.0 for cu ≤ 25 kPa, 0.5 for cu ≥ 70 kPa, linear between.
     IS 2911 Fig. 2 governs; the user can override α per layer. */
  C.alpha = function (cu) { return lerp(cu, 25, 70, 1, 0.5); };
  C.critDepth = function (phi, D) { return D * lerp(phi, 30, 40, 15, 20); };
  C.pileE = function (fck) { return 5000 * Math.sqrt(fck) * 1000; }; /* IS 456 cl. 6.2.3.1, kPa */

  /* axial capacity — static formula, plus the SPT correlation for cohesionless soil (B-4.1 / B-4.2) */
  C.pileCap = function (P, p) {
    var bh = C.bh(P, p.bh), D = +p.D, L = +p.L, z0 = +p.Df, zt = z0 + L, Ap = Math.PI * D * D / 4, per = Math.PI * D, out = { rows: [], steps: [], notes: [] };
    if (zt > C.depth(bh) + 1e-6) return { err: "The pile tip (" + r(zt) + " m) is below the borehole log (" + r(C.depth(bh)) + " m)" };
    var tipL = C.layerAt(bh, zt - 1e-6), tp = C.params(bh, tipL), nsf = {}; (p.nsf || []).forEach(function (id) { nsf[id] = 1; });
    var Qs = 0, Qneg = 0;
    bh.layers.forEach(function (L0) {
      var a = Math.max(L0.top, z0), b = Math.min(L0.bot, zt); if (b <= a + 1e-9) return;
      var q = C.params(bh, L0), n = Math.max(1, Math.ceil((b - a) / 0.25)), h = (b - a) / n, f = 0, row = { id: L0.id, name: L0.name || C.KINDS[L0.kind], kind: L0.kind, top: a, bot: b };
      for (var i = 0; i < n; i++) {
        var zm = a + (i + 0.5) * h, sv = C.sv(bh, zm).e;
        if (L0.kind === "clay") { var al = +L0.alpha > 0 ? +L0.alpha : C.alpha(q.cu || 0); f += al * (q.cu || 0) * per * h; row.alpha = al; row.cu = q.cu; }
        else { var zc = z0 + C.critDepth(q.phi || 30, D), svc = Math.min(sv, C.sv(bh, Math.min(zm, zc)).e); f += (+p.K || 1) * svc * Math.tan((q.phi || 30) * D2R) * per * h; row.phi = q.phi; row.K = +p.K || 1; }
      }
      row.fs = f / (per * (b - a)); row.Q = f; row.neg = !!nsf[L0.id];
      if (row.neg) Qneg += f; else Qs += f;
      out.rows.push(row);
    });
    var PD, qb, Qb;
    if (tipL.kind === "clay") { qb = 9 * (tp.cu || 0); Qb = qb * Ap; out.steps.push("Tip in clay: qb = Nc·cp = 9 × " + r(tp.cu, 1) + " = " + r(qb, 0) + " kPa (B-2)"); }
    else {
      var phi = tp.phi || 30, zc2 = z0 + C.critDepth(phi, D); PD = C.sv(bh, Math.min(zt, zc2)).e;
      var F = C.factors(phi), Nq = +p.Nq > 0 ? +p.Nq : F.Nq, g = (zt > C.gwt(bh) ? (tp.gsat || tp.gamma) - 9.81 : tp.gamma);
      qb = 0.5 * D * g * F.Ng + PD * Nq; Qb = qb * Ap;
      out.steps.push("Tip in " + C.KINDS[tipL.kind].toLowerCase() + ", φ = " + r(phi, 1) + "°: PD = σ′v at " + (zt > zc2 ? "the critical depth " + r(zc2, 2) + " m (" + r(C.critDepth(phi, D) / D, 1) + "D below cut-off, B-1 Note 5)" : "the tip") + " = " + r(PD, 1) + " kPa");
      out.steps.push("qb = ½·D·γ′·Nγ + PD·Nq = 0.5 × " + D + " × " + r(g, 2) + " × " + r(F.Ng, 2) + " + " + r(PD, 1) + " × " + r(Nq, 2) + " = " + r(qb, 0) + " kPa" + (+p.Nq > 0 ? " (Nq entered from IS 2911 Fig. 1)" : " (Nq per IS 6403 — read IS 2911 Fig. 1 for bored piles and enter it if different)"));
      out.PD = PD; out.Nq = Nq;
    }
    out.steps.push("Shaft: clay layers α·cu·As (B-2, α " + (bh.layers.some(function (l) { return +l.alpha > 0; }) ? "as entered" : "after API RP 2A — check IS 2911 Fig. 2") + "); granular layers K·σ′v·tan δ·As with K = " + (+p.K || 1) + ", δ = φ, σ′v held constant below the critical depth (B-1 Notes 3–5)");
    out.Qs = Qs; out.Qb = Qb; out.Qneg = Qneg; out.Ap = Ap; out.per = per; out.tip = tipL; out.qb = qb;
    out.QuStatic = Qs + Qb;
    out.steps.push("Qu (static) = Qb + Qs = " + r(Qb, 0) + " + " + r(Qs, 0) + " = " + r(out.QuStatic, 0) + " kN" + (Qneg ? " (shaft in the settling layers excluded: " + r(Qneg, 0) + " kN acts downwards as drag)" : ""));
    /* SPT correlation (cohesionless tip) */
    if (tipL.kind !== "clay") {
      var spt = C.spt(bh), tipN = spt.filter(function (s) { return s.z >= zt - D && s.z <= zt + 2 * D; }), shN = spt.filter(function (s) { var l = C.layerAt(bh, s.z); return s.z >= z0 && s.z <= zt && l && l.kind !== "clay"; });
      if (!tipN.length) { var nb = spt.filter(function (s) { return s.z >= z0; }).sort(function (a, b) { return Math.abs(a.z - zt) - Math.abs(b.z - zt); }); if (nb.length) tipN = [nb[0]]; }
      if (tipN.length) {
        var Nt = tipN.reduce(function (a, s) { return a + s.Nc; }, 0) / tipN.length, Ns = shN.length ? shN.reduce(function (a, s) { return a + s.Nc; }, 0) / shN.length : 0;
        var Lb = zt - Math.max(tipL.top, z0), silt = tipL.kind === "silt", c1 = silt ? 10 : 13, c2 = silt ? 0.60 : 0.50;
        var Asg = out.rows.filter(function (x) { return x.kind !== "clay" && !x.neg; }).reduce(function (a, x) { return a + per * (x.bot - x.top); }, 0);
        var eb = Math.min(c1 * Nt * Lb / D * Ap, 130 * Nt * Ap), sh = Ns * Asg / c2, clayQ = out.rows.filter(function (x) { return x.kind === "clay" && !x.neg; }).reduce(function (a, x) { return a + x.Q; }, 0);
        out.spt = { N: Nt, Ns: Ns, Lb: Lb, Qb: eb, Qs: sh + clayQ, Qu: eb + sh + clayQ, silt: silt, capped: c1 * Nt * Lb / D * Ap > 130 * Nt * Ap };
        out.steps.push("SPT (B-4." + (silt ? "2" : "1") + "): Qu = " + c1 + "·N·(L/B)·Ap + N̄s·As/" + c2.toFixed(2) + " with N = " + r(Nt, 1) + ", L = " + r(Lb, 2) + " m in the bearing layer, N̄s = " + r(Ns, 1) + " → end " + r(eb, 0) + " kN" + (out.spt.capped ? " (limited to 130·N·Ap)" : "") + ", shaft " + r(sh, 0) + " kN" + (clayQ ? " + clay shaft " + r(clayQ, 0) + " kN" : "") + " = " + r(out.spt.Qu, 0) + " kN");
      }
    }
    var m = p.method || "lower";
    out.Qu = m === "spt" && out.spt ? out.spt.Qu : m === "lower" && out.spt ? Math.min(out.QuStatic, out.spt.Qu) : out.QuStatic;
    out.used = m === "spt" && out.spt ? "SPT" : m === "lower" && out.spt && out.spt.Qu < out.QuStatic ? "SPT (lower)" : "static formula";
    var FS = 2.5; out.FS = FS;
    out.Qsafe = out.Qu / FS - Qneg;
    out.steps.push("Safe load = Qu/2.5 − drag = " + r(out.Qu, 0) + "/2.5" + (Qneg ? " − " + r(Qneg, 0) : "") + " = " + r(out.Qsafe, 0) + " kN (cl. 6.8.2" + (Qneg ? ", 6.4" : "") + ")");
    var Wp = Ap * L * (24 - (zt > C.gwt(bh) ? 9.81 * Math.min(1, (zt - C.gwt(bh)) / L) : 0));
    out.Wp = Wp; out.Qup = (Qs + Qneg) / 3 + Wp;
    out.steps.push("Uplift: shaft friction / 3 + pile weight = " + r(Qs + Qneg, 0) + "/3 + " + r(Wp, 0) + " = " + r(out.Qup, 0) + " kN (FS 3 without pull-out tests, cl. 6.3.2)");
    return out;
  };

  /* single-pile settlement at working load Q — Vesic (1977): s = s1 (pile shortening) + s2 (tip) + s3 (shaft) */
  C.pileSettle = function (P, p, Q, cap) {
    cap = cap || C.pileCap(P, p); if (cap.err) return cap;
    var bh = C.bh(P, p.bh), D = +p.D, L = +p.L, zt = +p.Df + L, Ep = C.pileE(+p.fck || 25), share = cap.Qb / (cap.Qb + cap.Qs || 1);
    var Qwp = Q * share, Qws = Q - Qwp, s1 = (Qwp + 0.5 * Qws) * L / (cap.Ap * Ep);
    var tp = C.params(bh, cap.tip), Es = tp.E || 30000, nu = tp.nu || 0.3, s2 = (Qwp / cap.Ap) * D / Es * (1 - nu * nu) * 0.85;
    var Esh = 0, w = 0; cap.rows.forEach(function (x) { var L0 = bh.layers.filter(function (l) { return l.id === x.id; })[0], q = C.params(bh, L0); if (q.E > 0) { Esh += q.E * (x.bot - x.top); w += x.bot - x.top; } });
    Esh = w ? Esh / w : Es;
    var Iws = 2 + 0.35 * Math.sqrt(L / D), s3 = (Qws / (cap.per * L)) * D / Esh * (1 - nu * nu) * Iws;
    var s = 1000 * (s1 + s2 + s3);
    return { s: s, s1: 1000 * s1, s2: 1000 * s2, s3: 1000 * s3, kv: Q / Math.max(s / 1000, 1e-9), Ep: Ep, share: share };
  };

  /* group: n = nx × ny piles at spacing s; capacity per IS 2911 cl. 6.7, block failure, equivalent-raft settlement */
  C.pileGroup = function (P, p, cap) {
    cap = cap || C.pileCap(P, p); if (cap.err) return cap;
    var bh = C.bh(P, p.bh), nx = Math.max(1, +p.nx || 1), ny = Math.max(1, +p.ny || 1), n = nx * ny, s = +p.s, D = +p.D, L = +p.L, z0 = +p.Df, zt = z0 + L;
    var out = { n: n, notes: [] }, th = Math.atan(D / s) / D2R;
    out.eff = n === 1 ? 1 : 1 - th * ((ny - 1) * nx + (nx - 1) * ny) / (90 * nx * ny);
    out.sum = n * cap.Qu;
    var Bg = (nx - 1) * s + D, Lg = (ny - 1) * s + D; out.Bg = Math.min(Bg, Lg); out.Lg = Math.max(Bg, Lg);
    /* block: base bearing + perimeter friction (cl. 6.7.3); clay perimeter with α = 1 (soil-to-soil), granular K σ′ tan φ */
    var perim = 2 * (Bg + Lg), fr = 0;
    cap.rows.forEach(function (x) { if (x.neg) return; var L0 = bh.layers.filter(function (l) { return l.id === x.id; })[0], q = C.params(bh, L0), h = x.bot - x.top;
      fr += (x.kind === "clay" ? (q.cu || 0) : x.fs) * perim * h; });
    var tip = C.params(bh, cap.tip), base;
    if (cap.tip.kind === "clay") base = 9 * (tip.cu || 0) * Bg * Lg;
    else base = cap.qb * Bg * Lg;
    out.block = n > 1 ? base + fr : Infinity; out.blockBase = base; out.blockFr = fr;
    out.Qu = Math.min(out.sum, out.block);
    out.gov = n === 1 ? "single pile" : out.Qu === out.sum ? "sum of single piles" : "block failure";
    out.Qsafe = out.Qu / cap.FS - n * cap.Qneg;
    if (s < (cap.tip.kind === "clay" || cap.rows.some(function (x) { return x.kind === "clay"; }) ? 3 : 2.5) * D - 1e-9) out.notes.push("Spacing " + s + " m is below " + (cap.rows.some(function (x) { return x.kind === "clay"; }) ? "3D for friction piles" : "2.5D") + " (cl. 6.6).");
    if (n > 1) out.notes.push("Converse–Labarre efficiency " + r(out.eff, 3) + " for information; IS 2911 cl. 6.7 takes the group as the smaller of the sum of single piles and the block.");
    /* settlement: equivalent raft at 2/3 L (friction) or at the tip (end bearing on a firm layer) */
    var endB = cap.Qb > cap.Qs, zr = endB ? zt : z0 + 2 * L / 3, spread = endB ? 0 : (zt - zr) / 2;
    var Q = (+p.P || 0) * n, f = { bh: p.bh, shape: "rect", B: out.Bg + 2 * spread, L: out.Lg + 2 * spread, Df: zr, P: Q, H: 0, x: 0, y: 0 };
    if (Math.abs(f.B - f.L) < 1e-9) f.shape = "square";
    if (n > 1 && Q > 0) { out.raft = f; out.settle = C.settle(P, f, Q / (f.B * f.L)); out.notes.push("Group settlement: equivalent raft " + r(f.B, 2) + " × " + r(f.L, 2) + " m at " + r(zr, 2) + " m (" + (endB ? "pile tips — end bearing" : "⅔ of the length, spread 1:4 to the tips — Tomlinson") + ")."); }
    return out;
  };

  /* lateral subgrade values, IS 2911 Annex C Tables 3 and 4 (kN/m³), interpolated within each band */
  C.etaH = function (N, sub) {
    var t = sub ? [[0, 0], [4, 200], [10, 1400], [35, 5000], [50, 12000]] : [[0, 0], [4, 400], [10, 2500], [35, 7500], [50, 20000]];
    for (var i = 0; i + 1 < t.length; i++) if (N <= t[i + 1][0]) return lerp(N, t[i][0], t[i + 1][0], t[i][1], t[i + 1][1]);
    return t[t.length - 1][1];
  };
  C.k1 = function (qu) { var t = [[25, 4500], [50, 9000], [100, 18000], [200, 36000], [400, 72000]]; if (qu < 25) return 0; for (var i = 0; i + 1 < t.length; i++) if (qu <= t[i + 1][0]) return lerp(qu, t[i][0], t[i + 1][0], t[i][1], t[i + 1][1]); return 72000; };
  /* spring stiffness per metre of pile (kN/m per m) at depth z below ground */
  C.kLat = function (P, p, z) {
    var bh = C.bh(P, p.bh), L0 = C.layerAt(bh, z); if (!L0 || z <= 0) return { k: 0 };
    var q = C.params(bh, L0), zz = z - +p.Df;
    if (L0.kind === "clay") { var k1 = C.k1(2 * (q.cu || 0)); return { k: k1 * 0.3 / 1.5, src: "clay k1 = " + r(k1 / 1000, 1) + "×10³ (qu = " + r(2 * (q.cu || 0), 0) + " kPa), K·B = 0.2·k1" }; }
    var N = q.N !== null && q.N !== undefined ? q.N : (q.phi ? (q.phi - 27.1) / 0.3 : 10), eta = C.etaH(N, z > C.gwt(bh));
    return { k: eta * Math.max(zz, 0), eta: eta, src: "ηh = " + r(eta / 1000, 2) + "×10³ (N ≈ " + r(N, 0) + (z > C.gwt(bh) ? ", submerged" : ", dry") + ")" };
  };
  /* Winkler beam: pile from its head (e above ground level at the cut-off) to the tip, Euler–Bernoulli elements */
  C.pileLateral = function (P, p, opt) {
    opt = opt || {}; var D = +p.D, L = +p.L, e = Math.max(0, +p.e || 0), EI = C.pileE(+p.fck || 25) * Math.PI * Math.pow(D, 4) / 64, H = +p.H || 0, M0 = +p.M || 0;
    var Ltot = e + L, ne = opt.ne || Math.min(240, Math.max(60, Math.round(Ltot / 0.1))), h = Ltot / ne, nd = 2 * (ne + 1), K = [], F = new Float64Array(nd), kfun = opt.k || function (z) { return C.kLat(P, p, z).k; };
    for (var i = 0; i < nd; i++) K.push(new Float64Array(nd));
    var c = EI / (h * h * h), ke = [[12, 6 * h, -12, 6 * h], [6 * h, 4 * h * h, -6 * h, 2 * h * h], [-12, -6 * h, 12, -6 * h], [6 * h, 2 * h * h, -6 * h, 4 * h * h]];
    for (var el = 0; el < ne; el++) {
      var dof = [2 * el, 2 * el + 1, 2 * el + 2, 2 * el + 3];
      for (var a = 0; a < 4; a++) for (var b = 0; b < 4; b++) K[dof[a]][dof[b]] += c * ke[a][b];
      var zm = +p.Df + (el + 0.5) * h - e; if (zm > +p.Df) { /* consistent soil stiffness (beam on elastic foundation) */
        var ks = kfun(zm), m = ks * h / 420, kk = [[156, 22 * h, 54, -13 * h], [22 * h, 4 * h * h, 13 * h, -3 * h * h], [54, 13 * h, 156, -22 * h], [-13 * h, -3 * h * h, -22 * h, 4 * h * h]];
        for (a = 0; a < 4; a++) for (b = 0; b < 4; b++) K[dof[a]][dof[b]] += m * kk[a][b]; }
    }
    F[0] = H; F[1] = M0;
    if (p.head === "fixed") { for (i = 0; i < nd; i++) { K[1][i] = 0; K[i][1] = 0; } K[1][1] = 1; F[1] = 0; }
    /* Gaussian elimination (banded in practice) */
    var n = nd, bw = 4;
    for (var k = 0; k < n; k++) { var piv = K[k][k]; if (Math.abs(piv) < 1e-12) piv = 1e-12;
      for (i = k + 1; i < Math.min(n, k + bw + 1); i++) { var f = K[i][k] / piv; if (!f) continue; for (var j = k; j < Math.min(n, k + bw + 1); j++) K[i][j] -= f * K[k][j]; F[i] -= f * F[k]; } }
    var u = new Float64Array(n); for (i = n - 1; i >= 0; i--) { var s = F[i]; for (j = i + 1; j < Math.min(n, i + bw + 1); j++) s -= K[i][j] * u[j]; u[i] = s / (Math.abs(K[i][i]) < 1e-12 ? 1e-12 : K[i][i]); }
    /* moments from curvature at nodes (element end values averaged) */
    var pts = [], Mx = 0, zMx = 0, z0 = null;
    for (i = 0; i <= ne; i++) {
      var Mi = 0, cnt = 0;
      [i - 1, i].forEach(function (eI) { if (eI < 0 || eI >= ne) return; var w1 = u[2 * eI], t1 = u[2 * eI + 1], w2 = u[2 * eI + 2], t2 = u[2 * eI + 3], xi = eI === i ? 0 : h;
        var curv = (-6 / (h * h) + 12 * xi / (h * h * h)) * w1 + (-4 / h + 6 * xi / (h * h)) * t1 + (6 / (h * h) - 12 * xi / (h * h * h)) * w2 + (-2 / h + 6 * xi / (h * h)) * t2; Mi += -EI * curv; cnt++; });
      Mi /= cnt; var zz = i * h - e;
      pts.push({ z: zz, y: u[2 * i], M: Mi });
      if (Math.abs(Mi) > Math.abs(Mx)) { Mx = Mi; zMx = zz; }
      if (z0 === null && i > 0 && u[2 * i] * u[0] <= 0) z0 = zz;
    }
    var y0 = u[0], out = { EI: EI, y0: y0 * 1000, pts: pts, Mmax: Mx, zMmax: zMx, zZero: z0, Mhead: pts[0].M, h: h };
    if (H > 0) { out.zf = Math.cbrt((p.head === "fixed" ? 12 : 3) * EI * y0 / H) - e; out.H5 = H * 5 / Math.max(out.y0, 1e-9); out.H12 = H * 12 / Math.max(out.y0, 1e-9) * 0.5; out.Hallow = Math.min(out.H5, out.H12); }
    /* stiffness factor and pile behaviour (Table 5) using the soil at about 1 m below cut-off */
    var kz = C.kLat(P, p, +p.Df + 1), bh = C.bh(P, p.bh), Lc = C.layerAt(bh, +p.Df + 1);
    if (Lc && Lc.kind !== "clay" && kz.eta) { out.T = Math.pow(EI / kz.eta, 0.2); out.rel = L / out.T; out.type = L >= 4 * out.T ? "long (elastic)" : L <= 2 * out.T ? "short (rigid)" : "intermediate"; out.factor = "T"; }
    else if (kz.k) { out.R = Math.pow(EI / kz.k, 0.25); out.rel = L / out.R; out.type = L >= 3.5 * out.R ? "long (elastic)" : L <= 2 * out.R ? "short (rigid)" : "intermediate"; out.factor = "R"; }
    return out;
  };
  /* springs for a frame model: one lateral spring per node interval and the axial spring at the head */
  C.pileSprings = function (P, p, step) {
    step = step || 0.5; var rows = [], L = +p.L, z0 = +p.Df;
    for (var a = 0; a < L - 1e-9; a += step) { var b = Math.min(L, a + step), zm = z0 + (a + b) / 2, k = C.kLat(P, p, zm); rows.push({ z: z0 + (a + b) / 2, kx: k.k * (b - a), src: k.src }); }
    var cap = C.pileCap(P, p), st = cap.err ? null : C.pileSettle(P, p, +p.P || cap.Qsafe, cap);
    return { rows: rows, kv: st ? st.kv : null, step: step };
  };
  /* modulus of subgrade reaction for a footing or raft: net pressure / settlement */
  C.subgrade = function (P, f, q) { var s = C.settle(P, f, q); return s.total > 0 ? q / (s.total / 1000) : null; };
})(GC);
