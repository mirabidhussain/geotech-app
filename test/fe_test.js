/* 2D FE checks: Prandtl collapse of a strip footing, Griffiths & Lane (1999) slope example, Bishop cross-check, elastic patch */
global.GC = require('../www/js/gcore.js'); require('../www/js/gfe.js');
const C = global.GC;
let pass = 0, fail = 0;
function ok(n, c, info) { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && info !== undefined ? ' — ' + info : '')); }
const near = (a, b, t) => Math.abs(a - b) <= t;
let t0 = Date.now();
/* elastic check: uniform load on a column of soil, 1D compression: settlement = q H / M, M = E(1−ν)/((1+ν)(1−2ν)) */
{ const f = { B: 100, q0: 0, layers: [{ bot: 1e9, c: 1e6, phi: 0, psi: 0, gamma: 0, gsat: 0, E: 10000, nu: 0.3 }], water: null };
  const r = C.footingFE(f, { width: 10, depth: 5, dq: 50, steps: 1, nIn: 4, nOut: 4, ny: 6, grade: 1 });
  const Mmod = 10000 * 0.7 / (1.3 * 0.4), s = 50 * 5 / Mmod * 1000;
  ok('Elastic: loaded strip wider than the mesh behaves as 1D compression (s = qH/M)', near(r.curve[1].s, s, 0.01 * s), r.curve[1].s + ' vs ' + s); }
/* Prandtl: smooth flexible strip on weightless undrained clay → qu = (2 + π) cu */
{ const cu = 50, f = { B: 2, q0: 0, layers: [{ bot: 1e9, c: cu, phi: 0, psi: 0, gamma: 0, gsat: 0, E: 1e5, nu: 0.49 }], water: null };
  const r = C.footingFE(f, { dq: 25, dqMin: 1, limit: 1000 });
  ok('Strip footing on undrained clay collapses at about (2 + π)·cu = 257 kPa (Prandtl), within 6 %', r.qu / cu > 5.14 * 0.94 && r.qu / cu < 5.14 * 1.06, (r.qu / cu).toFixed(3) + ' × cu');
  ok('Load–settlement curve recorded to collapse', r.curve.length > 8 && r.curve[r.curve.length - 1].s > r.curve[1].s * 5, r.curve.length);
  ok('Plastic zone under the footing edge', r.gp.filter(v => v > 0).length > 10); }
console.log('  (footing runs ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)'); t0 = Date.now();
/* Griffiths & Lane (1999) example 1: 2:1 slope, H = 10, c′ = 0.05γH, φ′ = 20°, no foundation layer → FoS ≈ 1.4 (Bishop–Morgenstern 1.38) */
const s = { H: 10, beta: Math.atan(0.5) * 180 / Math.PI, toe: 10, crest: 15, depth: 0, water: null, q: 0, layers: [{ bot: -1e9, c: 10, phi: 20, psi: 0, gamma: 20, gsat: 20, E: 1e5, nu: 0.3 }] };
const fe = C.slopeSSR(s, { prec: 0.02 });
ok('Griffiths & Lane example 1: SSR factor of safety 1.4 (±5 %)', fe.fos > 1.33 && fe.fos < 1.47, fe.fos && fe.fos.toFixed(3));
const bi = C.bishop(s);
ok('Bishop simplified on the same slope ≈ 1.38 (±4 %)', bi && bi.F > 1.32 && bi.F < 1.44, bi && bi.F.toFixed(3));
ok('FE and Bishop agree within 6 %', bi && Math.abs(fe.fos - bi.F) / bi.F < 0.06);
ok('Failure mechanism: plastic strain concentrated in a band', fe.gp.filter(v => v > 0).length > 5);
console.log('  (slope runs ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s, ' + fe.trials.length + ' trials)'); t0 = Date.now();
/* undrained slope with a foundation layer: FE vs Bishop */
const u = { H: 10, beta: 45, toe: 12, crest: 15, depth: 5, water: null, q: 0, layers: [{ bot: -1e9, c: 40, phi: 0, psi: 0, gamma: 18, gsat: 18, E: 1e5, nu: 0.45 }] };
const fu = C.slopeSSR(u, { prec: 0.02 }), bu = C.bishop(u);
ok('Undrained 45° slope with a foundation layer: FE and Bishop within 8 %', fu.fos && bu && Math.abs(fu.fos - bu.F) / bu.F < 0.08, fu.fos + ' / ' + (bu && bu.F));
/* vertical cut in undrained clay: Taylor stability number 0.261 → F = c/(0.261·γ·H) */
const vc = { H: 5, beta: 90, toe: 8, crest: 12, depth: 5, water: null, q: 0, layers: [{ bot: -1e9, c: 40, phi: 0, psi: 0, gamma: 18, gsat: 18, E: 1e5, nu: 0.45 }] };
const fv = C.slopeSSR(vc, { prec: 0.02 }), Ft = 40 / (0.261 * 18 * 5);
ok('Vertical cut, undrained: FE within 8 % of Taylor (F = ' + Ft.toFixed(2) + ')', fv.fos && Math.abs(fv.fos - Ft) / Ft < 0.08, fv.fos);
/* a crest surcharge lowers the factor of safety */
const sq = C.bishop(Object.assign({}, s, { q: 20 })); ok('Crest surcharge lowers Bishop\'s FoS', sq.F < bi.F - 0.02, sq.F);
/* fully submerged cohesionless slope: infinite-slope value tan φ′ / tan β with buoyant weight */
const sub = { H: 6, beta: 30, toe: 8, crest: 10, depth: 3, q: 0, water: 9, layers: [{ bot: -1e9, c: 0.01, phi: 35, psi: 0, gamma: 20, gsat: 20, E: 2e4, nu: 0.3 }] };
const Finf = Math.tan(35 * Math.PI / 180) / Math.tan(30 * Math.PI / 180), bs = C.bishop(sub), fs2 = C.slopeSSR(sub, { prec: 0.02 });
ok('Submerged sand slope: Bishop and FE within 5 % of tan φ′/tan β = ' + Finf.toFixed(3), Math.abs(bs.F - Finf) / Finf < 0.05 && Math.abs(fs2.fos - Finf) / Finf < 0.05, bs.F.toFixed(3) + ' / ' + fs2.fos);
/* a water table inside a cohesive-frictional slope (toe dry) lowers the factor of safety */
const w = Object.assign({}, s, { water: 4 }), bw = C.bishop(w);
ok('Water inside the slope lowers Bishop\'s FoS', bw.F < bi.F, bw.F + ' vs ' + bi.F);
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
