/* IS GeoTech — earthquake ground conditions: site class (IS 1893 Part 1:2016 Table 4), liquefaction by the simplified
   SPT procedure of IS 1893 Part 1:2016 Annex F (Youd et al. 2001 / NCEER), settlement after liquefaction (Idriss &
   Boulanger 2008 volumetric strains) and the liquefaction potential index (Iwasaki). Units: m, kPa. */
(function (C) {
  "use strict";
  var PA = 101.3;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  C.ZONES = { II: 0.10, III: 0.16, IV: 0.24, V: 0.36 };
  /* site class from the average field N over the top 30 m (IS 1893 Part 1 Table 4, with the soil description) */
  C.siteClass = function (bh) {
    var rows = (bh.spt || []).filter(function (s) { return s.z <= 30; });
    if (!rows.length) return { type: null, note: "No SPT readings in the top 30 m" };
    var N = rows.reduce(function (a, s) { return a + Math.min(s.N, 100); }, 0) / rows.length, t, d;
    var sp = bh.layers.some(function (L) { return L.top < 30 && (L.cls === "SP" || /poorly graded sand/i.test(L.name)); });
    if (N > 30) { t = "I"; d = "Rock or hard soil — gravels, sands and clayey sands with N above 30"; }
    else if (N >= 10) { t = "II"; d = "Medium or stiff soil — soils with N between 10 and 30"; }
    else { t = "III"; d = "Soft soil — soils other than SP with N below 10"; }
    if (sp && N > 15 && t === "III") { t = "II"; d += " (poorly graded sand with N above 15 is Type II)"; }
    return { type: t, N: N, n: rows.length, desc: d };
  };
  /* SPT correction factors (IS 1893 Annex F / NCEER) */
  C.CR = function (rod) { return rod < 3 ? 0.75 : rod < 4 ? 0.8 : rod < 6 ? 0.85 : rod < 10 ? 0.95 : 1.0; };
  C.CB = function (mm) { return mm <= 115 ? 1.0 : mm <= 150 ? 1.05 : 1.15; };
  C.fines = function (FC) {
    var a = FC <= 5 ? 0 : FC >= 35 ? 5 : Math.exp(1.76 - 190 / (FC * FC)), b = FC <= 5 ? 1 : FC >= 35 ? 1.2 : 0.99 + Math.pow(FC, 1.5) / 1000;
    return { a: a, b: b };
  };
  C.CRR75 = function (N) { if (N >= 30) return Infinity; return 1 / (34 - N) + N / 135 + 50 / Math.pow(10 * N + 45, 2) - 1 / 200; };
  C.MSF = function (Mw) { return Math.pow(10, 2.24) / Math.pow(Mw, 2.56); };
  C.rd = function (z) { return z <= 9.15 ? 1 - 0.00765 * z : z <= 23 ? 1.174 - 0.0267 * z : Math.max(0.5, 1.174 - 0.0267 * 23); };
  C.Ksig = function (sv, N160) {
    var Dr = clamp(Math.sqrt(N160 / 46), 0.2, 1) * 100, f = Dr <= 40 ? 0.8 : Dr <= 60 ? 0.8 - 0.1 * (Dr - 40) / 20 : Dr <= 80 ? 0.7 - 0.1 * (Dr - 60) / 20 : 0.6;
    return sv <= PA ? 1 : Math.pow(sv / PA, f - 1);
  };
  /* post-liquefaction volumetric strain, Idriss & Boulanger (2008) */
  C.epsV = function (FS, N1cs) {
    if (!isFinite(FS) || FS >= 2) return 0;
    var n = Math.max(N1cs, 0), Fa = 0.032 + 0.69 * Math.sqrt(n) - 0.13 * n, glim = Math.max(0, 1.859 * Math.pow(1.1 - Math.sqrt(n / 46), 3)), g;
    if (FS >= 2) g = 0; else if (FS > Fa) g = Math.min(glim, 0.035 * (1 - Fa) * (2 - FS) / (FS - Fa)); else g = glim;
    return 1.5 * Math.exp(-0.369 * Math.sqrt(n)) * Math.min(0.08, g);
  };
  /* liquefaction at each SPT reading. o = {Z or amax (g), Mw, ER (%), Db (mm), CS, depthMax} */
  C.liquefaction = function (P, bhId, o) {
    var bh = C.bh(P, bhId), amax = +o.amax > 0 ? +o.amax : (C.ZONES[o.zone] || 0.24), Mw = +o.Mw || 7.5, CE = (+o.ER || 60) / 60, CB = C.CB(+o.Db || 150), CS = +o.CS || 1;
    var gw = C.gwt(bh), MSF = C.MSF(Mw), rows = [], spt = (bh.spt || []).slice().sort(function (a, b) { return a.z - b.z; });
    spt.forEach(function (s, i) {
      var L = C.layerAt(bh, s.z), sv = C.sv(bh, s.z), row = { z: s.z, N: s.N, layer: L ? (L.name || C.KINDS[L.kind]) : "", kind: L ? L.kind : "" };
      var top = i ? (spt[i - 1].z + s.z) / 2 : Math.max(0, s.z - 0.75), bot = i < spt.length - 1 ? (s.z + spt[i + 1].z) / 2 : s.z + 0.75; row.dz = bot - top;
      row.sv = sv.t; row.sve = sv.e;
      var CN = Math.min(1.7, Math.sqrt(PA / Math.max(sv.e, 1))), CR = C.CR(s.z + 1.5);
      row.CN = CN; row.CR = CR; row.N60 = s.N * CE * CB * CR * CS; row.N160 = row.N60 * CN;
      var FC = L && L.fc !== undefined && L.fc !== "" && L.fc !== null ? +L.fc : (L && L.kind === "silt" ? 50 : L && L.kind === "gravel" ? 3 : 10), fa = C.fines(FC);
      row.FC = FC; row.N1cs = fa.a + fa.b * row.N160;
      row.rd = C.rd(s.z); row.CSR = 0.65 * amax * (sv.t / Math.max(sv.e, 1)) * row.rd;
      var why = null;
      if (!L) why = "below the log";
      else if (L.kind === "clay") why = "clay — not assessed by this method";
      else if (L.kind === "rock") why = "rock";
      else if (L.kind === "silt" && +L.PI > 7) why = "plastic silt (PI > 7)";
      else if (s.z <= gw) why = "above the water table";
      else if (s.z > (o.depthMax || 20)) why = "deeper than " + (o.depthMax || 20) + " m";
      if (why) { row.na = why; row.FS = null; rows.push(row); return; }
      row.CRR75 = C.CRR75(row.N1cs); row.Ks = C.Ksig(sv.e, row.N160);
      row.CRR = row.CRR75 * MSF * row.Ks;
      row.FS = isFinite(row.CRR) ? row.CRR / row.CSR : Infinity;
      row.ev = C.epsV(row.FS, row.N1cs); row.settle = row.ev * row.dz * 1000;
      rows.push(row);
    });
    var LPI = 0, settle = 0, liq = 0;
    rows.forEach(function (r) { if (r.FS === null) return; if (r.FS < 1 && r.z <= 20) { LPI += (1 - r.FS) * (10 - 0.5 * r.z) * r.dz; liq++; } settle += r.settle || 0; });
    var cls = LPI === 0 ? "very low" : LPI <= 5 ? "low" : LPI <= 15 ? "high" : "very high";
    return { rows: rows, amax: amax, Mw: Mw, MSF: MSF, CE: CE, CB: CB, LPI: LPI, LPIclass: cls, settle: settle, liquefied: liq, site: C.siteClass(bh) };
  };
})(GC);
