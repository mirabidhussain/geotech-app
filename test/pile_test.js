/* Pile module checks: hand calculations of IS 2911 Annex B, closed-form lateral solutions, group rules */
global.GC = require('../www/js/gcore.js'); require('../www/js/gpile.js');
const C = global.GC;
let pass = 0, fail = 0;
function ok(n, c, info) { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && info !== undefined ? ' — ' + info : '')); }
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const D2R = Math.PI / 180;

/* clay: uniform cu = 50, bored pile D 0.5, L 12, cut-off at 0 */
let P = C.blank('c'); P.boreholes.push({ id: 'b', name: 'B', gwt: 0, layers: [C.layer({ top: 0, bot: 30, kind: 'clay', gamma: 18, gsat: 18, cu: 50, E: 20000, nu: 0.5 })], spt: [] });
let p = Object.assign(C.pileDefault('b'), { D: 0.5, L: 12, Df: 0, method: 'static', nx: 1, ny: 1 });
let c = C.pileCap(P, p); const Ap = Math.PI * 0.25 / 4, per = Math.PI * 0.5, al = 1 - 0.5 * (50 - 25) / 45;
ok('Adhesion factor (API RP 2A default): cu 50 → α = ' + al.toFixed(3), near(C.alpha(50), al, 1e-12) && C.alpha(20) === 1 && C.alpha(100) === 0.5);
ok('Clay pile: Qu = 9·cu·Ap + α·cu·As (IS 2911 B-2)', near(c.Qu, 9 * 50 * Ap + al * 50 * per * 12, 0.01), c.Qu.toFixed(2));
ok('Safe load = Qu / 2.5', near(c.Qsafe, c.Qu / 2.5, 1e-9));
P.boreholes[0].layers[0].alpha = 0.6; c = C.pileCap(P, p);
ok('User α overrides the default', near(c.Qs, 0.6 * 50 * per * 12, 0.01));
P.boreholes[0].layers[0].alpha = 0;

/* sand: φ 32°, γ 18 dry (water deep), K 1, D 0.6, L 10 — critical depth 16.2D = 9.72 m */
let S = C.blank('s'); S.boreholes.push({ id: 'b', name: 'B', gwt: '', layers: [C.layer({ top: 0, bot: 30, kind: 'sand', gamma: 18, gsat: 20, phi: 32, E: 40000 })], spt: [] });
let q = Object.assign(C.pileDefault('b'), { D: 0.6, L: 10, Df: 0, K: 1, method: 'static', nx: 1, ny: 1 });
c = C.pileCap(S, q);
const zc = 0.6 * (15 + 5 * 0.2), F = C.factors(32), Ap2 = Math.PI * 0.36 / 4, per2 = Math.PI * 0.6;
ok('Critical depth 15D at φ 30° rising to 20D at 40° → 16D at 32°', near(C.critDepth(32, 0.6), zc, 1e-9));
const qbHand = 0.5 * 0.6 * 18 * F.Ng + 18 * zc * F.Nq;
ok('Sand tip: qb = ½·D·γ·Nγ + PD·Nq with PD at the critical depth', near(c.qb, qbHand, 0.01), c.qb.toFixed(1) + ' vs ' + qbHand.toFixed(1));
/* shaft: ∫ K σ′v tanφ per dz with σ′v capped at zc */
const t = Math.tan(32 * D2R), shaftHand = per2 * t * (18 * zc * zc / 2 + 18 * zc * (10 - zc));
ok('Sand shaft: Σ K·σ′v·tan δ·As with σ′v constant below the critical depth', near(c.Qs, shaftHand, shaftHand * 0.002), c.Qs.toFixed(1) + ' vs ' + shaftHand.toFixed(1));
q.Nq = 25; c = C.pileCap(S, q);
ok('Nq entered from IS 2911 Fig. 1 is used', near(c.qb, 0.5 * 0.6 * 18 * F.Ng + 18 * zc * 25, 0.01));
q.Nq = '';
/* SPT method */
S.boreholes[0].spt = [{ z: 8, N: 20 }, { z: 10, N: 24 }, { z: 11, N: 26 }, { z: 4, N: 12 }];
q.method = 'spt'; c = C.pileCap(S, q);
const rows = C.spt(S.boreholes[0]), tipRows = rows.filter(s => s.z >= 9.4 && s.z <= 11.2), Nt = tipRows.reduce((a, s) => a + s.Nc, 0) / tipRows.length;
const shN = rows.filter(s => s.z <= 10).reduce((a, s) => a + s.Nc, 0) / rows.filter(s => s.z <= 10).length;
const eb = Math.min(13 * Nt * 10 / 0.6 * Ap2, 130 * Nt * Ap2), sh = shN * per2 * 10 / 0.5;
ok('SPT (B-4.1): Qu = 13·N·(L/B)·Ap (≤ 130·N·Ap) + N̄s·As/0.50', near(c.Qu, eb + sh, 0.5) && c.spt.capped, c.Qu.toFixed(1) + ' vs ' + (eb + sh).toFixed(1));
q.method = 'lower'; c = C.pileCap(S, q); ok('"Lower of the two" picks the smaller', near(c.Qu, Math.min(c.QuStatic, c.spt.Qu), 1e-9));

/* negative skin friction: fill over soft clay over sand */
let N = C.blank('n'); N.boreholes.push({ id: 'b', name: 'B', gwt: 1, layers: [C.layer({ id: 'fill', top: 0, bot: 3, name: 'Fill', kind: 'silt', gamma: 17, gsat: 18, phi: 28, E: 8000 }), C.layer({ id: 'clay', top: 3, bot: 8, name: 'Soft clay', kind: 'clay', gamma: 17, gsat: 17, cu: 20, E: 4000, nu: 0.5 }), C.layer({ id: 'sand', top: 8, bot: 25, kind: 'sand', gamma: 19, gsat: 20, phi: 34, E: 50000 })], spt: [] });
let r = Object.assign(C.pileDefault('b'), { D: 0.5, L: 14, Df: 0, method: 'static', nx: 1, ny: 1 });
const c0 = C.pileCap(N, r); r.nsf = ['fill', 'clay']; const c1 = C.pileCap(N, r);
ok('Negative skin friction: settling layers become drag and are not counted as support', c1.Qneg > 0 && near(c1.Qs + c1.Qneg, c0.Qs, 1e-6) && near(c1.Qsafe, c1.Qu / 2.5 - c1.Qneg, 1e-9));
ok('Uplift = shaft / 3 + pile weight', near(c0.Qup, c0.Qs / 3 + c0.Wp, 1e-9));

/* single-pile settlement (Vesic) by hand */
const st = C.pileSettle(S, Object.assign({}, q, { method: 'static' }), 500);
const cs = C.pileCap(S, Object.assign({}, q, { method: 'static' })), Ep = 5000 * Math.sqrt(25) * 1000, sh_ = cs.Qb / (cs.Qb + cs.Qs), Qwp = 500 * sh_, Qws = 500 - Qwp;
const s1 = (Qwp + 0.5 * Qws) * 10 / (Ap2 * Ep), s2 = Qwp / Ap2 * 0.6 / 40000 * 0.91 * 0.85, s3 = Qws / (per2 * 10) * 0.6 / 40000 * 0.91 * (2 + 0.35 * Math.sqrt(10 / 0.6));
ok('Pile settlement s1 + s2 + s3 (Vesic) by hand', near(st.s, 1000 * (s1 + s2 + s3), 0.01), st.s.toFixed(3) + ' vs ' + (1000 * (s1 + s2 + s3)).toFixed(3));
ok('Axial spring k = Q / s', near(st.kv, 500 / (st.s / 1000), 1e-6));

/* groups */
let g = Object.assign({}, p, { nx: 3, ny: 3, s: 1.5, P: 300 });
let gr = C.pileGroup(P, g);
ok('Converse–Labarre 3 × 3 at 3D: η = 1 − 18.43°·12/810 = 0.727', near(gr.eff, 1 - Math.atan(1 / 3) / D2R * 12 / 810, 1e-9) && near(gr.eff, 0.727, 0.001));
const Bg = 2 * 1.5 + 0.5, blockHand = 9 * 50 * Bg * Bg + 50 * 4 * Bg * 12;
ok('Block failure in clay: 9·cu·Bg² + cu·perimeter·L', near(gr.block, blockHand, 0.5), gr.block.toFixed(0) + ' vs ' + blockHand.toFixed(0));
ok('Group capacity = smaller of the sum and the block (cl. 6.7)', near(gr.Qu, Math.min(9 * c.Qu === 0 ? 0 : 9 * C.pileCap(P, g).Qu, blockHand), 1));
let g2 = Object.assign({}, g, { s: 0.75, nx: 4, ny: 4 }); const gr2 = C.pileGroup(P, g2);
ok('Close spacing in clay → block failure governs and a spacing warning is given', gr2.gov === 'block failure' && gr2.notes.some(n => /below/.test(n)), gr2.gov);
ok('Group settlement by equivalent raft at ⅔L', gr.settle && gr.settle.total > 0 && near(gr.raft.Df, 8, 1e-9));

/* lateral: long pile, constant spring k (Hetényi): y0 = 2Hβ/k, Mmax = 0.3224 H/β */
const pk = { D: 0.6, L: 30, Df: 0, e: 0, fck: 25, H: 100, M: 0, head: 'free', bh: 'b' }, EI = C.pileE(25) * Math.PI * Math.pow(0.6, 4) / 64, k = 5000;
let lat = C.pileLateral(S, pk, { k: () => k, ne: 300 }); const beta = Math.pow(k / (4 * EI), 0.25);
ok('Winkler, constant k, free head: y0 = 2Hβ/k (Hetényi)', near(lat.y0, 2 * 100 * beta / k * 1000, 0.01 * 2 * 100 * beta / k * 1000), lat.y0.toFixed(3) + ' vs ' + (2 * 100 * beta / k * 1000).toFixed(3));
ok('Winkler, constant k, free head: Mmax = 0.3224·H/β at z = π/(4β)', near(Math.abs(lat.Mmax), 0.3224 * 100 / beta, 0.01 * 0.3224 * 100 / beta) && near(lat.zMmax, Math.PI / (4 * beta), 0.15), lat.Mmax.toFixed(1) + ' @ ' + lat.zMmax.toFixed(2));
lat = C.pileLateral(S, Object.assign({}, pk, { head: 'fixed' }), { k: () => k, ne: 300 });
ok('Winkler, constant k, fixed head: y0 = Hβ/k, head moment H/(2β)', near(lat.y0, 100 * beta / k * 1000, 0.01 * 100 * beta / k * 1000) && near(Math.abs(lat.Mhead), 100 / (2 * beta), 0.02 * 100 / (2 * beta)), lat.y0.toFixed(3) + ' / ' + lat.Mhead.toFixed(1));
/* Reese–Matlock: k = ηh·z, long pile: free head y0 = 2.435 H T³/EI; fixed head 0.93 H T³/EI */
const eta = 5000, T = Math.pow(EI / eta, 0.2);
lat = C.pileLateral(S, pk, { k: z => eta * z, ne: 300 });
ok('Winkler, k = ηh·z, free head: y0 = 2.435·H·T³/EI (Reese–Matlock)', near(lat.y0, 2.435 * 100 * T ** 3 / EI * 1000, 0.015 * 2.435 * 100 * T ** 3 / EI * 1000), lat.y0.toFixed(3) + ' vs ' + (2.435 * 100 * T ** 3 / EI * 1000).toFixed(3));
ok('Reese–Matlock free head: Mmax ≈ 0.772·H·T', near(Math.abs(lat.Mmax), 0.772 * 100 * T, 0.02 * 0.772 * 100 * T), lat.Mmax.toFixed(1) + ' vs ' + (0.772 * 100 * T).toFixed(1));
lat = C.pileLateral(S, Object.assign({}, pk, { head: 'fixed' }), { k: z => eta * z, ne: 300 });
ok('Reese–Matlock fixed head: y0 = 0.93·H·T³/EI, head moment 0.93·H·T', near(lat.y0, 0.93 * 100 * T ** 3 / EI * 1000, 0.02 * 0.93 * 100 * T ** 3 / EI * 1000) && near(Math.abs(lat.Mhead), 0.93 * 100 * T, 0.03 * 0.93 * 100 * T), lat.y0.toFixed(3) + ' / ' + lat.Mhead.toFixed(1));
ok('Equivalent depth of fixity reproduces the head deflection of a cantilever', near(100 * Math.pow(lat.zf, 3) / (12 * EI) * 1000, lat.y0, 1e-6));
/* IS 2911 Table 3/4 lookups */
ok('ηh table: medium dense dry N 10 → 2.5×10³, submerged N 35 → 5.0×10³ kN/m³', C.etaH(10, false) === 2500 && C.etaH(35, true) === 5000);
ok('k1 table: qu 100 → 18×10³, below 25 kPa → 0', C.k1(100) === 18000 && C.k1(20) === 0);
const sp = C.pileSprings(S, Object.assign({}, q, { method: 'static', P: 500 }));
ok('Spring table every 0.5 m with the axial spring', sp.rows.length === 20 && sp.kv > 0);
/* subgrade modulus */
const Pf = C.sample(); ok('Subgrade modulus ks = q / s for a footing', C.subgrade(Pf, Pf.footings[0], 100) > 0);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
