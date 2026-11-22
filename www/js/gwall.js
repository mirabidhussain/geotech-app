/* IS GeoTech — earth pressure and retaining walls: Rankine and Coulomb coefficients, Mononobe–Okabe dynamic pressure as in
   IS 1893 (Part 3), stability of gravity and cantilever walls with the IS 14458 (Part 2) criteria. Units: m, kN, kPa. */
(function (C) {
  "use strict";
  var D2R = Math.PI / 180, GW = 9.81;
  C.K0 = function (phi, ocr) { var s = Math.sin(phi * D2R); return (1 - s) * Math.pow(ocr || 1, s); };
  /* Rankine, sloping backfill i (pressure parallel to the slope); i = 0 gives tan²(45 ∓ φ/2) */
  C.rankine = function (phi, i) {
    var ci = Math.cos((i || 0) * D2R), cp = Math.cos(phi * D2R), r = Math.sqrt(Math.max(0, ci * ci - cp * cp));
    return { Ka: ci * (ci - r) / (ci + r), Kp: ci * (ci + r) / (ci - r) };
  };
  /* Coulomb active/passive: wall back at θ from vertical (positive when the back leans away from the backfill), wall friction δ, backfill slope i */
  C.coulomb = function (phi, delta, theta, i) {
    var f = phi * D2R, d = (delta || 0) * D2R, t = (theta || 0) * D2R, b = (i || 0) * D2R;
    var a1 = Math.sin(f + d) * Math.sin(f - b), a2 = Math.cos(d + t) * Math.cos(t - b);
    var Ka = Math.pow(Math.cos(f - t), 2) / (Math.pow(Math.cos(t), 2) * Math.cos(d + t) * Math.pow(1 + Math.sqrt(Math.max(0, a1 / a2)), 2));
    var p1 = Math.sin(f + d) * Math.sin(f + b), p2 = Math.cos(d - t) * Math.cos(b - t);
    var Kp = Math.pow(Math.cos(f + t), 2) / (Math.pow(Math.cos(t), 2) * Math.cos(d - t) * Math.pow(1 - Math.sqrt(Math.max(0, p1 / p2)), 2));
    return { Ka: Ka, Kp: Kp };
  };
  /* dynamic active coefficient Ca (Mononobe–Okabe, the form used in IS 1893 Part 3), vertical back, wall friction δ, backfill i.
     Both signs of the vertical coefficient are tried and the larger is returned. */
  C.mo = function (phi, delta, i, ah, av) {
    var f = phi * D2R, d = (delta || 0) * D2R, b = (i || 0) * D2R, best = null;
    [1, -1].forEach(function (sg) {
      var v = 1 + sg * (av || 0), lam = Math.atan(ah / v), x = f - b - lam;
      if (x < 0) { if (!best || best.Ca < Infinity) best = { Ca: Infinity, lam: lam, v: v, unstable: true }; return; }
      var root = Math.sqrt(Math.sin(f + d) * Math.sin(x) / (Math.cos(d + lam) * Math.cos(b))), Ca = v * Math.pow(Math.cos(f - lam), 2) / (Math.cos(lam) * Math.cos(d + lam) * Math.pow(1 + root, 2));
      if (!best || Ca > best.Ca) best = { Ca: Ca, lam: lam, v: v };
    });
    return best;
  };
  C.WALL_FS = { ot: 2.0, sl: 1.5, otE: 1.5, slE: 1.0, fl: 1.25 }; /* IS 14458 (Part 2) cl. 5.2 */

  /* wall geometry as polygons (x from the toe, y up from the underside of the base) and the soil above the heel */
  C.wallShape = function (w) {
    var H = +w.H, B = +w.B, parts = [], soil = [];
    if (w.type === "cantilever") {
      var tb = +w.tb, Lt = +w.Lt, sb = +w.sb, st = +w.st, xs = Lt, heel = B - Lt - sb;
      parts.push({ n: "Base slab", poly: [[0, 0], [B, 0], [B, tb], [0, tb]], g: +w.gc || 25 });
      parts.push({ n: "Stem", poly: [[xs, tb], [xs + sb, tb], [xs + st, H], [xs, H]], g: +w.gc || 25 });
      /* soil over the heel and against the back of the stem, up to the backfill surface */
      var i = (+w.i || 0) * D2R, xTop = xs + st, yAt = function (x) { return H + Math.max(0, x - xTop) * Math.tan(i); };
      soil.push({ n: "Backfill over the heel", poly: [[xs + sb, tb], [B, tb], [B, yAt(B)], [xTop, H]], g: +w.g || 18 });
      return { parts: parts, soil: soil, Hv: yAt(B), back: B, heel: heel };
    }
    var bf = +w.bf || 0, bt = +w.bt, xb = bf * H + bt; /* gravity: front face batter bf (horizontal per vertical) */
    parts.push({ n: "Wall", poly: [[0, 0], [B, 0], [xb, H], [bf * H, H]], g: +w.gc || 22 });
    var i2 = (+w.i || 0) * D2R, y2 = function (x) { return H + Math.max(0, x - xb) * Math.tan(i2); };
    if (B > xb + 1e-9) soil.push({ n: "Soil over the back face", poly: [[B, 0], [B, y2(B)], [xb, H]], g: +w.g || 18 });
    return { parts: parts, soil: soil, Hv: y2(B), back: B };
  };
  function polyProps(p) { var A = 0, cx = 0, cy = 0; for (var k = 0; k < p.length; k++) { var a = p[k], b = p[(k + 1) % p.length], cr = a[0] * b[1] - b[0] * a[1]; A += cr; cx += (a[0] + b[0]) * cr; cy += (a[1] + b[1]) * cr; } A /= 2; return { A: Math.abs(A), x: cx / (6 * A), y: cy / (6 * A) }; }
  C.polyProps = polyProps;

  /* stability. w = {type, H, B, ..., g (backfill γ), phi, c, i, q (surcharge), hw (water behind, m above base), mu (base friction),
     D (embedment of toe), passive (bool), qa (allowable gross bearing, kPa), ah, av, seismic (bool)} */
  C.wallCheck = function (w) {
    var sh = C.wallShape(w), H = sh.Hv, B = +w.B, g = +w.g || 18, phi = +w.phi || 30, i = +w.i || 0, q = +w.q || 0, hw = Math.min(+w.hw || 0, H), out = { V: [], H: [], notes: [] };
    var R = C.rankine(phi, i), Ka = R.Ka, ci = Math.cos(i * D2R), si = Math.sin(i * D2R);
    /* weights */
    sh.parts.concat(sh.soil).forEach(function (p) { var pp = polyProps(p.poly), gw = p.g, W = pp.A * gw; out.V.push({ n: p.n, F: W, x: pp.x }); });
    /* active thrust on the vertical virtual back through the heel (Rankine, parallel to the backfill slope); water behind lowers γ */
    var gs = (+w.gsat || g + 1), ge = gs - GW, h1 = H - hw, Pa1 = 0.5 * Ka * g * h1 * h1, Pa2 = Ka * g * h1 * hw + 0.5 * Ka * ge * hw * hw, Pq = Ka * q * H;
    var y1 = hw + h1 / 3, y2 = hw > 0 ? (Ka * g * h1 * hw * hw / 2 + 0.5 * Ka * ge * hw * hw * hw / 3) / Math.max(Pa2, 1e-9) : 0;
    var Pa = Pa1 + Pa2, yPa = Pa > 0 ? (Pa1 * y1 + Pa2 * y2) / Pa : 0;
    /* cohesion reduces pressure (tension crack ignored: no negative pressure taken) */
    if (+w.c > 0) { var red = 2 * +w.c * Math.sqrt(Ka) * H, zc = 2 * +w.c / (g * Math.sqrt(Ka)); out.notes.push("Cohesion c′ = " + w.c + " kPa ignored in the thrust (a tension crack may open to " + zc.toFixed(2) + " m and fill with water) — conservative."); }
    out.H.push({ n: "Active earth pressure (Ka = " + Ka.toFixed(3) + ")", F: Pa * ci, y: yPa }); out.V.push({ n: "Vertical part of the earth thrust", F: Pa * si, x: B });
    if (q > 0) { out.H.push({ n: "Surcharge " + q + " kPa", F: Pq * ci, y: H / 2 }); out.notes.push("Surcharge counted only as a horizontal push (its weight over the heel is ignored for sliding and overturning)."); }
    if (hw > 0) { out.H.push({ n: "Water behind the wall (" + hw + " m)", F: 0.5 * GW * hw * hw, y: hw / 3 }); }
    /* uplift: hw at the heel falling to zero at the toe (drainage at the front assumed) */
    var U = hw > 0 ? 0.5 * GW * hw * B : 0;
    /* seismic */
    var E = !!w.seismic, ah = +w.ah || 0, av = +w.av || 0;
    if (E && ah > 0) {
      var mo = C.mo(phi, i, i, ah, av);
      if (mo.unstable) { out.unstable = true; out.notes.push("φ − i − λ < 0: the backfill itself is unstable at this seismic coefficient (Mononobe–Okabe has no solution)."); }
      else { var Pae = 0.5 * g * H * H * mo.Ca, dP = Math.max(0, Pae - 0.5 * g * H * H * Ka); out.Ca = mo.Ca; out.H.push({ n: "Dynamic increment of earth pressure (Ca = " + mo.Ca.toFixed(3) + ", at mid-height)", F: dP * ci, y: H / 2 }); }
      sh.parts.concat(sh.soil).forEach(function (p) { var pp = polyProps(p.poly); out.H.push({ n: "Inertia of " + p.n.toLowerCase() + " (αh = " + ah + ")", F: ah * pp.A * p.g, y: pp.y }); });
    }
    /* passive resistance at the toe (optional, half mobilised) */
    var Pp = 0; if (w.passive && +w.D > 0) { var Kp = C.rankine(phi, 0).Kp; Pp = 0.5 * 0.5 * Kp * g * w.D * w.D; out.notes.push("Passive resistance in front of the toe taken as half of Rankine (" + Pp.toFixed(1) + " kN/m)."); }
    var sV = 0, sH = 0, Mr = 0, Mo = 0;
    out.V.forEach(function (v) { sV += v.F; Mr += v.F * v.x; });
    out.H.forEach(function (h) { sH += h.F; Mo += h.F * h.y; });
    sV -= U; Mo += U * (2 * B / 3);
    out.sV = sV; out.sH = sH; out.Mr = Mr; out.Mo = Mo; out.U = U;
    var mu = +w.mu || 0.5;
    out.FSot = Mo > 0 ? Mr / Mo : Infinity; out.FSsl = sH > 0 ? (mu * sV + Pp + (+w.ca || 0) * B) / sH : Infinity; out.FSfl = U > 0 ? (sV + U) / U : Infinity;
    var xr = (Mr - Mo) / sV, e = B / 2 - xr; out.xr = xr; out.e = e;
    if (xr <= 0) { out.qmax = Infinity; out.qmin = 0; }
    else if (Math.abs(e) <= B / 6) { out.qmax = sV / B * (1 + 6 * Math.abs(e) / B); out.qmin = sV / B * (1 - 6 * Math.abs(e) / B); }
    else { out.qmax = 2 * sV / (3 * Math.min(xr, B - xr)); out.qmin = 0; out.notes.push("The resultant falls outside the middle third — part of the base lifts off."); }
    var F = C.WALL_FS, qa = +w.qa || 0;
    out.checks = [
      { n: "Overturning", v: out.FSot, need: E ? F.otE : F.ot },
      { n: "Sliding", v: out.FSsl, need: E ? F.slE : F.sl },
      { n: "Maximum base pressure", v: out.qmax, need: qa > 0 ? qa * (E ? 1.33 : 1) : null, le: true },
      { n: "Resultant in the middle third, |e| ≤ B/6 (no tension under the base)", v: Math.abs(e), need: B / 6, le: true }];
    if (U > 0) out.checks.push({ n: "Floatation", v: out.FSfl, need: F.fl });
    out.checks.forEach(function (k) { k.ok = k.need === null ? null : k.le ? k.v <= k.need + 1e-9 : k.v >= k.need - 1e-9; });
    out.ok = !out.unstable && out.checks.every(function (k) { return k.ok !== false; });
    out.shape = sh; out.Ka = Ka;
    return out;
  };
  /* smallest base width that satisfies all checks (other dimensions kept; for a cantilever the extra goes to the heel) */
  C.wallSize = function (w) { for (var B = Math.max(0.5, 0.3 * +w.H); B <= 2 * +w.H + 1e-9; B += 0.05) { var t = Object.assign({}, w, { B: +B.toFixed(2) }); if (C.wallCheck(t).ok) return +B.toFixed(2); } return null; };
})(GC);
