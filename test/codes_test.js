/* Checks for the code modules: IS 1893 liquefaction and site class, earth pressure and walls (IS 1893 Pt 3, IS 14458),
   lab tests (IS 2720), rock (IS 12070 / RMR), IS 1892 planning, under-reamed piles (IS 2911 Pt 3) */
global.GC = require('../www/js/gcore.js'); ['gpile', 'gseis', 'gwall', 'glab'].forEach(m => require('../www/js/' + m + '.js'));
const C = global.GC;
let pass = 0, fail = 0;
function ok(n, c, info) { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && info !== undefined ? ' — ' + info : '')); }
const near = (a, b, t) => Math.abs(a - b) <= t;

/* ---- liquefaction building blocks (Youd et al. 2001 as adopted in IS 1893 Annex F) ---- */
ok('CRR7.5 at (N1)60cs = 15 → 0.160', near(C.CRR75(15), 0.1601, 0.0005), C.CRR75(15));
ok('CRR7.5 = ∞ (non-liquefiable) at (N1)60cs ≥ 30', C.CRR75(30) === Infinity);
ok('MSF = 10^2.24 / Mw^2.56 → 1.00 at Mw 7.5, 1.48 at Mw 6.5', near(C.MSF(7.5), 1.0, 0.005) && near(C.MSF(6.5), 1.437, 0.01), C.MSF(6.5));
ok('rd = 1 − 0.00765z (z ≤ 9.15) and 1.174 − 0.0267z (to 23 m)', near(C.rd(5), 0.96175, 1e-9) && near(C.rd(12), 1.174 - 0.0267 * 12, 1e-9));
ok('Fines correction: FC 15 → α 2.50, β 1.048; FC ≥ 35 → α 5, β 1.2', near(C.fines(15).a, 2.498, 0.002) && near(C.fines(15).b, 1.0481, 0.0005) && C.fines(40).a === 5 && C.fines(40).b === 1.2);
ok('Idriss–Boulanger εv: (N1)60cs 10, FS 0.8 → 3.7 %', near(C.epsV(0.8, 10), 0.0374, 0.0005), C.epsV(0.8, 10));
ok('No volumetric strain for FS ≥ 2', C.epsV(2.1, 10) === 0);
/* a loose saturated sand profile in zone V liquefies; dense sand does not */
let P = C.blank('l'); P.boreholes.push({ id: 'b', name: 'B', gwt: 1.5, layers: [C.layer({ top: 0, bot: 1.5, kind: 'silt', gamma: 17, gsat: 18, phi: 26 }), C.layer({ top: 1.5, bot: 9, name: 'Loose sand', kind: 'sand', gamma: 18, gsat: 19, fc: 10 }), C.layer({ top: 9, bot: 20, name: 'Dense sand', kind: 'sand', gamma: 19, gsat: 20.5, fc: 5 })], spt: [{ z: 3, N: 6 }, { z: 4.5, N: 7 }, { z: 6, N: 8 }, { z: 7.5, N: 9 }, { z: 10.5, N: 38 }, { z: 12, N: 45 }] });
const L = C.liquefaction(P, 'b', { zone: 'V', Mw: 7.5, ER: 60, Db: 100 });
const r6 = L.rows.find(r => r.z === 6), sv = 1.5 * 17 + 4.5 * 19, sve = sv - 4.5 * 9.81, CN = Math.min(1.7, Math.sqrt(101.3 / sve)), N160 = 8 * 0.95 * CN, fa = C.fines(10), N1cs = fa.a + fa.b * N160;
ok('Hand check at 6 m: CSR = 0.65·Z·(σv/σ′v)·rd with amax/g = Z (zone V, 0.36)', near(r6.CSR, 0.65 * 0.36 * sv / sve * C.rd(6), 1e-9), r6.CSR);
ok('Hand check at 6 m: (N1)60cs with CN = √(Pa/σ′v) ≤ 1.7, CR 0.95', near(r6.N1cs, N1cs, 1e-9), r6.N1cs + ' vs ' + N1cs);
ok('Loose sand liquefies (FS < 1) and dense sand does not', L.rows.filter(r => r.z < 9).every(r => r.FS < 1) && L.rows.filter(r => r.z > 9).every(r => r.FS === Infinity || r.FS > 1));
ok('Layer above the water table is excluded', L.rows.length === 6 && L.settle > 50 && L.LPI > 5, JSON.stringify({ settle: L.settle, LPI: L.LPI }));
ok('Site class from average N (6 readings, N̄ ≈ 18.8) → Type II', L.site.type === 'II' && near(L.site.N, 113 / 6, 1e-9), JSON.stringify(L.site));

/* ---- earth pressure ---- */
ok('Rankine φ 30°: Ka = 1/3, Kp = 3', near(C.rankine(30, 0).Ka, 1 / 3, 1e-9) && near(C.rankine(30, 0).Kp, 3, 1e-9));
ok('Rankine φ 30°, backfill 20°: Ka = 0.414', near(C.rankine(30, 20).Ka, 0.4142, 0.0005), C.rankine(30, 20).Ka);
ok('Coulomb φ 30°, δ 20°, vertical back, level fill: Ka = 0.297', near(C.coulomb(30, 20, 0, 0).Ka, 0.2973, 0.0005), C.coulomb(30, 20, 0, 0).Ka);
ok('Coulomb reduces to Rankine for δ = 0', near(C.coulomb(32, 0, 0, 0).Ka, C.rankine(32, 0).Ka, 1e-9));
ok('Mononobe–Okabe φ 30°, kh 0.1, kv 0, δ 0: Ca = 0.397', near(C.mo(30, 0, 0, 0.1, 0).Ca, 0.3965, 0.001), C.mo(30, 0, 0, 0.1, 0).Ca);
ok('Mononobe–Okabe with kh = 0 gives the static Ka', near(C.mo(30, 0, 0, 0, 0).Ca, 1 / 3, 1e-9));
ok('No solution when φ − i − λ < 0', C.mo(30, 0, 25, 0.2, 0).unstable === true);

/* ---- wall: rectangular gravity wall H 3, B 1.5, γc 22, backfill φ 30, γ 18 ---- */
const w = { type: 'gravity', H: 3, B: 1.5, bt: 1.5, bf: 0, gc: 22, g: 18, phi: 30, i: 0, q: 0, hw: 0, mu: 0.5, qa: 150 };
const wc = C.wallCheck(w);
ok('Gravity wall: FS overturning = 99·0.75/(27·1) = 2.75', near(wc.FSot, 2.75, 1e-6), wc.FSot);
ok('Gravity wall: FS sliding = 0.5·99/27 = 1.83', near(wc.FSsl, 0.5 * 99 / 27, 1e-6), wc.FSsl);
ok('Resultant outside the middle third → qmax = 2V/(3x̄) = 138 kPa, qmin = 0, fails "no tension"', near(wc.qmax, 2 * 99 / (3 * (74.25 - 27) / 99), 0.01) && wc.qmin === 0 && !wc.ok);
const B2 = C.wallSize(w); ok('Smallest base width that passes every IS 14458 check', B2 > 1.5 && C.wallCheck(Object.assign({}, w, { B: B2 })).ok && !C.wallCheck(Object.assign({}, w, { B: B2 - 0.05 })).ok, B2);
const ws = C.wallCheck(Object.assign({}, w, { B: 2.2, seismic: true, ah: 0.18, av: 0.12 }));
ok('Earthquake case adds the dynamic increment and wall inertia; criteria relax to 1.5 / 1.0', ws.H.length >= 3 && ws.checks[0].need === 1.5 && ws.checks[1].need === 1.0);
const cw = C.wallCheck({ type: 'cantilever', H: 4, B: 2.6, tb: 0.4, Lt: 0.6, sb: 0.35, st: 0.2, gc: 25, g: 18, phi: 30, i: 0, q: 10, hw: 0, mu: 0.5, qa: 200 });
ok('Cantilever wall: soil over the heel counted, all checks computed', cw.V.some(v => /heel/.test(v.n)) && cw.checks.length === 4 && cw.FSot > 1);
const ww = C.wallCheck(Object.assign({}, w, { B: 2.4, hw: 2 }));
ok('Water behind the wall adds pressure and uplift; floatation checked', ww.U > 0 && ww.checks.some(k => k.n === 'Floatation'));

/* ---- lab tests ---- */
const comp = C.compaction([[10, 1.98], [12, 2.09], [14, 2.17], [16, 2.18], [18, 2.13]].map(r => [r[0], r[1]]));
ok('Compaction: OMC and MDD from the parabola through the top three points', comp.omc > 14 && comp.omc < 16 && comp.mdd > 1.88 && comp.mdd < 1.92, comp.omc + ' / ' + comp.mdd);
const cb = C.cbr([[0, 0], [0.5, 1.2], [1, 2.4], [1.5, 3.4], [2, 4.4], [2.5, 5.2], [3, 5.9], [4, 7.0], [5, 8.0], [7.5, 9.5]]);
ok('CBR at 2.5 mm = 5.2 / 13.44 = 38.7 %, at 5 mm = 8.0 / 20.15 = 39.7 %', near(cb.c25, 100 * 5.2 / 13.4351, 0.01) && near(cb.c50, 100 * 8 / 20.1527, 0.01) && near(cb.cbr, cb.c50, 1e-9));
const ds = C.directShear([[50, 10 + 50 * Math.tan(0.5)], [100, 10 + 100 * Math.tan(0.5)], [200, 10 + 200 * Math.tan(0.5)]]);
ok('Direct shear: c = 10 kPa, φ = 28.65° recovered', near(ds.c, 10, 1e-6) && near(ds.phi, 28.6479, 1e-3));
const tx = C.triaxial([50, 100, 200].map(s3 => [s3, s3 * 3 + 2 * 10 * Math.sqrt(3) - s3]), 'CD');
ok('Triaxial p–q line: c = 10 kPa, φ = 30° recovered', near(tx.c, 10, 1e-6) && near(tx.phi, 30, 1e-6), tx.c + ' ' + tx.phi);
const cons = C.consol([[25, 1.0 - 0.05 * Math.log10(25 / 25)], [50, 1.0 - 0.05 * Math.log10(2)], [100, 1.0 - 0.05 * Math.log10(4)], [200, 1.0 - 0.05 * Math.log10(4) - 0.4 * Math.log10(2)], [400, 1.0 - 0.05 * Math.log10(4) - 0.4 * Math.log10(4)], [800, 1.0 - 0.05 * Math.log10(4) - 0.4 * Math.log10(8)]], { t90: 12, H: 20, drain: 'two' });
ok('Consolidation: Cc = 0.40, Cr = 0.05, σ′p = 100 kPa', near(cons.Cc, 0.4, 1e-6) && near(cons.Cr, 0.05, 1e-6) && near(cons.pc, 100, 0.01), JSON.stringify([cons.Cc, cons.Cr, cons.pc]));
ok('cv = 0.848·(H/2)²/t90 in m²/year', near(cons.cv, 0.848 * 0.01 * 0.01 / (12 / 525600), 1e-9));

/* ---- rock ---- */
const rm = C.rmr({ ucs: 100, rqd: 80, sp: 0.5, cond: 1, gw: 0, orient: 0 });
ok('RMR: 12 + 17 + 10 + 25 + 15 = 79 → class II good rock', rm.RMR === 79 && rm.cls === 'II');
const rb = C.rockBearing({ ucs: 40, sp: 0.6, ap: 1, B: 2, rqd: 80, cond: 1, gw: 0, orient: 0 });
ok('IS 12070: Nj = (3 + S/B)/(10√(1 + 300δ/S)) = 0.269 → qa = 10.8 MPa', near(rb.Nj, 3.3 / (10 * Math.sqrt(1.5)), 1e-9) && near(rb.qa, 40000 * rb.Nj, 1e-6));

/* ---- IS 1892 ---- */
const pl = C.plan1892({ L: 30, W: 20, type: 'isolated', Df: 1.5, B: 2 });
ok('IS 1892: isolated footing B 2 at 1.5 m → explore to 4.5 m, at least 3 boreholes', near(pl.depth, 4.5, 1e-9) && pl.n >= 3);

/* ---- under-reamed pile in clay (cu 60 everywhere), D 0.3, Du 0.75, two bulbs, L 4.5 ---- */
let Q = C.blank('u'); Q.boreholes.push({ id: 'b', name: 'B', gwt: '', layers: [C.layer({ top: 0, bot: 20, kind: 'clay', gamma: 18, cu: 60, E: 20000 })], spt: [] });
const up = { bh: 'b', D: 0.3, Du: 0.75, nb: 2, L: 4.5, Df: 0, sb: 0.9375 }, ur = C.underReamed(Q, up);
const Ap = Math.PI * 0.09 / 4, Aa = Math.PI * (0.5625 - 0.09) / 4, b1 = 4.5 - 0.9375 - 0.375, As1 = Math.PI * 0.75 * 0.9375, As = Math.PI * 0.3 * (b1 - 0.375);
ok('Under-reamed pile in clay: Ap·9·cp + 2·Aa·9·ca + ca·As′ + 0.5·c̄·As', near(ur.Qu, Ap * 9 * 60 + 2 * Aa * 9 * 60 + 60 * As1 + 0.5 * 60 * As, 0.01), ur.Qu);
ok('Design load is the lesser of Qu/2.5 and IS 2911 Pt 3 Table 1 (30 cm double: 24 t)', near(ur.table.comp, 24 * 9.81, 1e-9) && near(ur.Qdesign, Math.min(ur.Qu / 2.5, 24 * 9.81), 1e-9));

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
