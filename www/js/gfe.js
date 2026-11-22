/* IS GeoTech — 2D plane-strain finite elements (8-node quadrilaterals, reduced integration) with an elastic–perfectly
   plastic Mohr–Coulomb soil solved by the viscoplastic method (Smith & Griffiths), strength-reduction factor of safety
   for slopes (Griffiths & Lane 1999), load–settlement of a strip footing to collapse, and Bishop's simplified method
   as an independent limit-equilibrium check. Units: m, kN, kPa. Tension positive inside the solver. */
(function (C) {
  "use strict";
  var GW = 9.81, D2R = Math.PI / 180;

  /* ---------------- Q8 element ---------------- */
  var NI = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  function shape(xi, et) {
    var N = [], dx = [], de = [];
    for (var k = 0; k < 8; k++) {
      var a = NI[k][0], b = NI[k][1];
      if (a && b) { N.push(0.25 * (1 + xi * a) * (1 + et * b) * (xi * a + et * b - 1)); dx.push(0.25 * a * (1 + et * b) * (2 * xi * a + et * b)); de.push(0.25 * b * (1 + xi * a) * (xi * a + 2 * et * b)); }
      else if (!a) { N.push(0.5 * (1 - xi * xi) * (1 + et * b)); dx.push(-xi * (1 + et * b)); de.push(0.5 * (1 - xi * xi) * b); }
      else { N.push(0.5 * (1 + xi * a) * (1 - et * et)); dx.push(0.5 * a * (1 - et * et)); de.push(-et * (1 + xi * a)); }
    }
    return { N: N, dx: dx, de: de };
  }
  var G2 = 1 / Math.sqrt(3), GP = [[-G2, -G2], [G2, -G2], [G2, G2], [-G2, G2]];
  var SH = GP.map(function (g) { return shape(g[0], g[1]); });
  function Dmat(E, nu) { var f = E / ((1 + nu) * (1 - 2 * nu)); return [[f * (1 - nu), f * nu, 0, f * nu], [f * nu, f * (1 - nu), 0, f * nu], [0, 0, f * (1 - 2 * nu) / 2, 0], [f * nu, f * nu, 0, f * (1 - nu)]]; }

  /* ---------------- mesh: columns of elements between a bottom line and a ground profile ---------------- */
  /* xs: column boundaries; top(x) ground level; ybot; ny: elements per column; grade: >1 makes elements finer near the top */
  C.feMesh = function (xs, top, ybot, ny, grade) {
    var nxe = xs.length - 1, ni = 2 * nxe + 1, nj = 2 * ny + 1, id = [], X = [], Y = [], g = grade || 1;
    function xAt(i) { var k = Math.floor(i / 2); return i % 2 ? (xs[k] + xs[k + 1]) / 2 : xs[k]; }
    function frac(j) { var t = j / (nj - 1); return g === 1 ? t : (Math.pow(g, t) - 1) / (g - 1); }
    for (var i = 0; i < ni; i++) { id.push([]); var x = xAt(i), yt = top(x);
      for (var j = 0; j < nj; j++) { if (i % 2 && j % 2) { id[i].push(-1); continue; } id[i].push(X.length); X.push(x); Y.push(ybot + (yt - ybot) * frac(j)); } }
    var els = [];
    for (var e = 0; e < nxe; e++) for (var k = 0; k < ny; k++) {
      var i0 = 2 * e, j0 = 2 * k;
      els.push([id[i0][j0], id[i0 + 1][j0], id[i0 + 2][j0], id[i0 + 2][j0 + 1], id[i0 + 2][j0 + 2], id[i0 + 1][j0 + 2], id[i0][j0 + 2], id[i0][j0 + 1]]);
    }
    return { X: X, Y: Y, els: els, nn: X.length, id: id, ni: ni, nj: nj };
  };

  /* ---------------- banded symmetric solver (LDLᵀ) ---------------- */
  function Band(n, hb) { this.n = n; this.hb = hb; this.a = new Float64Array(n * (hb + 1)); }
  Band.prototype.add = function (i, j, v) { if (j < i) { var t = i; i = j; j = t; } this.a[i * (this.hb + 1) + (j - i)] += v; };
  Band.prototype.fix = function (i) { var w = this.hb + 1, n = this.n; for (var k = 0; k <= this.hb; k++) { this.a[i * w + k] = 0; if (i - k >= 0) this.a[(i - k) * w + k] = 0; } this.a[i * w] = 1; };
  Band.prototype.factor = function () {
    var n = this.n, hb = this.hb, w = hb + 1, a = this.a;
    for (var i = 0; i < n; i++) {
      var d = a[i * w]; if (Math.abs(d) < 1e-30) { d = 1e-30; a[i * w] = d; }
      var lim = Math.min(hb, n - 1 - i);
      for (var k = 1; k <= lim; k++) { var l = a[i * w + k] / d; if (!l) continue; var row = (i + k) * w;
        for (var m = k; m <= lim; m++) a[row + (m - k)] -= l * a[i * w + m]; }
    }
  };
  Band.prototype.solve = function (b) {
    var n = this.n, hb = this.hb, w = hb + 1, a = this.a, x = new Float64Array(n); x.set(b);
    for (var i = 0; i < n; i++) { var lim = Math.min(hb, n - 1 - i), xi = x[i] / a[i * w]; for (var k = 1; k <= lim; k++) x[i + k] -= a[i * w + k] * xi; }
    for (i = n - 1; i >= 0; i--) { var s = x[i] / a[i * w], lim2 = Math.min(hb, n - 1 - i); for (k = 1; k <= lim2; k++) s -= a[i * w + k] / a[i * w] * x[i + k]; x[i] = s; }
    return x;
  };

  /* ---------------- Mohr–Coulomb (tension positive, plane strain) ---------------- */
  function principal(s) {
    var c0 = (s[0] + s[1]) / 2, d = (s[0] - s[1]) / 2, R = Math.sqrt(d * d + s[2] * s[2]), th = 0.5 * Math.atan2(s[2], d);
    var cs = Math.cos(th), sn = Math.sin(th);
    var p = [{ v: c0 + R, n: [cs, sn, 0] }, { v: c0 - R, n: [-sn, cs, 0] }, { v: s[3], n: [0, 0, 1] }];
    p.sort(function (a, b) { return b.v - a.v; }); return p;
  }
  /* f = (σ1 − σ3)/2 + (σ1 + σ3)/2·sin φ − c·cos φ; flow by g with dilation ψ; returns [f, dg/dσ as engineering strain-rate vector] */
  function mc(s, c, sphi, cphi, spsi) {
    var p = principal(s), s1 = p[0], s3 = p[2], f = (s1.v - s3.v) / 2 + (s1.v + s3.v) / 2 * sphi - c * cphi;
    if (f <= 0) return [f, null];
    var a1 = 0.5 * (1 + spsi), a3 = 0.5 * (-1 + spsi), g = [0, 0, 0, 0];
    [[a1, s1.n], [a3, s3.n]].forEach(function (q) { var a = q[0], n = q[1]; g[0] += a * n[0] * n[0]; g[1] += a * n[1] * n[1]; g[2] += 2 * a * n[0] * n[1]; g[3] += a * n[2] * n[2]; });
    return [f, g];
  }

  /* ---------------- model assembly ---------------- */
  /* mats: [{c, phi, psi, gamma, gsat, E, nu}], matOf(xc, yc) → index; water: y of the phreatic level or null */
  function build(mesh, mats, matOf, fixX, fixY) {
    var nd = 2 * mesh.nn, E = [], hb = 0;
    mesh.els.forEach(function (el) {
      var xc = 0, yc = 0; el.forEach(function (n) { xc += mesh.X[n] / 8; yc += mesh.Y[n] / 8; });
      var m = mats[matOf(xc, yc)], gp = [];
      var mn = Math.min.apply(null, el), mx = Math.max.apply(null, el); hb = Math.max(hb, 2 * (mx - mn) + 1);
      for (var g = 0; g < 4; g++) {
        var sh = SH[g], J = [0, 0, 0, 0], x = 0, y = 0;
        for (var k = 0; k < 8; k++) { var X = mesh.X[el[k]], Y = mesh.Y[el[k]]; J[0] += sh.dx[k] * X; J[1] += sh.dx[k] * Y; J[2] += sh.de[k] * X; J[3] += sh.de[k] * Y; x += sh.N[k] * X; y += sh.N[k] * Y; }
        var det = J[0] * J[3] - J[1] * J[2], dNx = [], dNy = [];
        for (k = 0; k < 8; k++) { dNx.push((J[3] * sh.dx[k] - J[1] * sh.de[k]) / det); dNy.push((-J[2] * sh.dx[k] + J[0] * sh.de[k]) / det); }
        gp.push({ x: x, y: y, det: det, dNx: dNx, dNy: dNy, N: sh.N, evp: [0, 0, 0, 0], s0: [0, 0, 0, 0], pp: 0, f: -1, ep: 0 });
      }
      E.push({ n: el, m: m, mi: matOf(xc, yc), D: Dmat(m.E, m.nu), gp: gp, xc: xc, yc: yc });
    });
    var K = new Band(nd, hb);
    E.forEach(function (e) {
      var ke = []; for (var i = 0; i < 16; i++) ke.push(new Float64Array(16));
      e.gp.forEach(function (g) { var D = e.D, w = g.det;
        for (var a = 0; a < 8; a++) { var bxa = g.dNx[a], bya = g.dNy[a];
          /* columns of Bᵀ D for node a: u_a → [bxa, 0, bya, 0], v_a → [0, bya, bxa, 0] */
          var du = [D[0][0] * bxa + D[0][2] * bya, D[1][0] * bxa + D[1][2] * bya, D[2][0] * bxa + D[2][2] * bya],
              dv = [D[0][1] * bya + D[0][2] * bxa, D[1][1] * bya + D[1][2] * bxa, D[2][1] * bya + D[2][2] * bxa];
          for (var b = 0; b < 8; b++) { var bxb = g.dNx[b], byb = g.dNy[b];
            ke[2 * b][2 * a] += (bxb * du[0] + byb * du[2]) * w; ke[2 * b + 1][2 * a] += (byb * du[1] + bxb * du[2]) * w;
            ke[2 * b][2 * a + 1] += (bxb * dv[0] + byb * dv[2]) * w; ke[2 * b + 1][2 * a + 1] += (byb * dv[1] + bxb * dv[2]) * w; } } });
      var dof = []; e.n.forEach(function (n) { dof.push(2 * n, 2 * n + 1); });
      for (i = 0; i < 16; i++) for (var j = i; j < 16; j++) if (dof[j] >= dof[i]) K.add(dof[i], dof[j], ke[i][j]); else if (j !== i) K.add(dof[j], dof[i], ke[j][i]);
    });
    var fixed = new Uint8Array(nd);
    for (var n = 0; n < mesh.nn; n++) { if (fixX(mesh.X[n], mesh.Y[n])) fixed[2 * n] = 1; if (fixY(mesh.X[n], mesh.Y[n])) fixed[2 * n + 1] = 1; }
    for (var q = 0; q < nd; q++) if (fixed[q]) K.fix(q);
    K.factor();
    return { mesh: mesh, E: E, K: K, nd: nd, fixed: fixed, mats: mats };
  }
  function strain(e, g, u) { var s = [0, 0, 0, 0]; for (var a = 0; a < 8; a++) { var ux = u[2 * e.n[a]], uy = u[2 * e.n[a] + 1]; s[0] += g.dNx[a] * ux; s[1] += g.dNy[a] * uy; s[2] += g.dNy[a] * ux + g.dNx[a] * uy; } return s; }
  function mv(D, v) { return [D[0][0] * v[0] + D[0][1] * v[1] + D[0][2] * v[2] + D[0][3] * v[3], D[1][0] * v[0] + D[1][1] * v[1] + D[1][2] * v[2] + D[1][3] * v[3], D[2][0] * v[0] + D[2][1] * v[1] + D[2][2] * v[2] + D[2][3] * v[3], D[3][0] * v[0] + D[3][1] * v[1] + D[3][2] * v[2] + D[3][3] * v[3]]; }
  function gravity(M, water) {
    var F = new Float64Array(M.nd);
    M.E.forEach(function (e) { e.gp.forEach(function (g) { var gm = water !== null && water !== undefined && g.y < water ? (e.m.gsat || e.m.gamma) : e.m.gamma; for (var a = 0; a < 8; a++) F[2 * e.n[a] + 1] -= g.N[a] * gm * g.det; }); });
    return F;
  }
  function porePressures(M, water) { M.E.forEach(function (e) { e.gp.forEach(function (g) { g.pp = water !== null && water !== undefined && g.y < water ? GW * (water - g.y) : 0; }); }); }

  /* viscoplastic iterations under fixed external loads F with strengths divided by srf; returns {conv, iters, u} */
  /* static element data packed into typed arrays once per model (geometry, D, dofs) */
  function pack(M) {
    if (M.pk) return M.pk;
    var ne = M.E.length, pk = { ne: ne, dof: new Int32Array(16 * ne), D: new Float64Array(16 * ne), mi: new Int32Array(ne), dNx: new Float64Array(32 * ne), dNy: new Float64Array(32 * ne), det: new Float64Array(4 * ne),
      evp: new Float64Array(16 * ne), s0: new Float64Array(16 * ne), pp: new Float64Array(4 * ne), ep: new Float64Array(4 * ne), f: new Float64Array(4 * ne), rhs: new Float64Array(M.nd) };
    M.E.forEach(function (e, i) {
      for (var a = 0; a < 8; a++) { pk.dof[16 * i + 2 * a] = 2 * e.n[a]; pk.dof[16 * i + 2 * a + 1] = 2 * e.n[a] + 1; }
      for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) pk.D[16 * i + 4 * r + c] = e.D[r][c];
      pk.mi[i] = e.mi;
      e.gp.forEach(function (g, k) { var q = 4 * i + k; pk.det[q] = g.det; for (var a = 0; a < 8; a++) { pk.dNx[8 * q + a] = g.dNx[a]; pk.dNy[8 * q + a] = g.dNy[a]; } });
    });
    M.pk = pk; return pk;
  }
  function loadState(M, pk) { M.E.forEach(function (e, i) { e.gp.forEach(function (g, k) { var q = 4 * i + k; for (var j = 0; j < 4; j++) { pk.evp[4 * q + j] = g.evp[j]; pk.s0[4 * q + j] = g.s0[j]; } pk.pp[q] = g.pp; pk.ep[q] = g.ep; }); }); }
  function saveState(M, pk) { M.E.forEach(function (e, i) { e.gp.forEach(function (g, k) { var q = 4 * i + k; g.evp = [pk.evp[4 * q], pk.evp[4 * q + 1], pk.evp[4 * q + 2], pk.evp[4 * q + 3]]; g.ep = pk.ep[q]; g.f = pk.f[q]; }); }); }
  /* viscoplastic iterations (allocation-free inner loop) */
  function solveVP(M, F, srf, opt) {
    opt = opt || {}; var lim = opt.limit || 500, tol = opt.tol || 1e-4, nd = M.nd, bdy = opt.bdy || new Float64Array(nd), uold = new Float64Array(nd), u = null;
    var pk = pack(M); loadState(M, pk);
    var nm = M.mats.length, mc_c = new Float64Array(nm), mc_sp = new Float64Array(nm), mc_cp = new Float64Array(nm), mc_ss = new Float64Array(nm), dt = Infinity;
    for (var m = 0; m < nm; m++) { var mt = M.mats[m], ph = Math.atan(Math.tan(mt.phi * D2R) / srf), ps = Math.atan(Math.tan((mt.psi || 0) * D2R) / srf), sp = Math.sin(ph);
      mc_c[m] = mt.c / srf; mc_sp[m] = sp; mc_cp[m] = Math.cos(ph); mc_ss[m] = Math.sin(ps); dt = Math.min(dt, 4 * (1 + mt.nu) * (1 - 2 * mt.nu) / (mt.E * (1 - 2 * mt.nu + sp * sp))); }
    var ne = pk.ne, dof = pk.dof, Dm = pk.D, dNx = pk.dNx, dNy = pk.dNy, det = pk.det, evp = pk.evp, s0 = pk.s0, pp = pk.pp, ep = pk.ep, fv = pk.f, mi = pk.mi, rhs = pk.rhs, fixed = M.fixed, conv = false, it;
    for (it = 1; it <= lim; it++) {
      for (var i = 0; i < nd; i++) rhs[i] = fixed[i] ? 0 : F[i] + bdy[i];
      u = M.K.solve(rhs);
      var big = 0, dif = 0; for (i = 0; i < nd; i++) { var ui = u[i], au = ui < 0 ? -ui : ui, d = ui - uold[i]; if (au > big) big = au; if (d < 0) d = -d; if (d > dif) dif = d; }
      uold = u; conv = it > 1 && dif <= tol * (big > 1e-12 ? big : 1e-12);
      var yielded = 0;
      for (var e = 0; e < ne; e++) {
        var mm = mi[e], cc = mc_c[mm], sphi = mc_sp[mm], cphi = mc_cp[mm], spsi = mc_ss[mm], o16 = 16 * e;
        var D00 = Dm[o16], D01 = Dm[o16 + 1], D03 = Dm[o16 + 3], D10 = Dm[o16 + 4], D11 = Dm[o16 + 5], D13 = Dm[o16 + 7], D22 = Dm[o16 + 10], D30 = Dm[o16 + 12], D31 = Dm[o16 + 13], D33 = Dm[o16 + 15];
        for (var k = 0; k < 4; k++) {
          var q = 4 * e + k, o8 = 8 * q, o4 = 4 * q, ex = 0, ey = 0, gxy = 0;
          for (var a = 0; a < 8; a++) { var ux = u[dof[o16 + 2 * a]], uy = u[dof[o16 + 2 * a + 1]], bx = dNx[o8 + a], by = dNy[o8 + a]; ex += bx * ux; ey += by * uy; gxy += by * ux + bx * uy; }
          var e0 = ex - evp[o4], e1 = ey - evp[o4 + 1], e2 = gxy - evp[o4 + 2], e3 = -evp[o4 + 3];
          var sx = D00 * e0 + D01 * e1 + D03 * e3 + s0[o4], sy = D10 * e0 + D11 * e1 + D13 * e3 + s0[o4 + 1], txy = D22 * e2 + s0[o4 + 2], sz = D30 * e0 + D31 * e1 + D33 * e3 + s0[o4 + 3];
          var p_ = pp[q], ax = sx + p_, ay = sy + p_, az = sz + p_;
          /* principal stresses (plane strain): in-plane pair and σz */
          var c0 = 0.5 * (ax + ay), dd = 0.5 * (ax - ay), R = Math.sqrt(dd * dd + txy * txy), sA = c0 + R, sB = c0 - R;
          var s1, s3, n1x, n1y, n1z, n3x, n3y, n3z, th = 0.5 * Math.atan2(txy, dd), cs = Math.cos(th), sn = Math.sin(th);
          /* sort sA (dir cs,sn), sB (dir −sn,cs), az (z) */
          if (az >= sA) { s1 = az; n1x = 0; n1y = 0; n1z = 1; s3 = sB; n3x = -sn; n3y = cs; n3z = 0; }
          else if (az <= sB) { s1 = sA; n1x = cs; n1y = sn; n1z = 0; s3 = az; n3x = 0; n3y = 0; n3z = 1; }
          else { s1 = sA; n1x = cs; n1y = sn; n1z = 0; s3 = sB; n3x = -sn; n3y = cs; n3z = 0; }
          var f = 0.5 * (s1 - s3) + 0.5 * (s1 + s3) * sphi - cc * cphi; fv[q] = f;
          if (f <= 0 || conv) continue; yielded++;
          var a1 = 0.5 * (1 + spsi) * f * dt, a3 = 0.5 * (-1 + spsi) * f * dt;
          var v0 = a1 * n1x * n1x + a3 * n3x * n3x, v1 = a1 * n1y * n1y + a3 * n3y * n3y, v2 = 2 * (a1 * n1x * n1y + a3 * n3x * n3y), v3 = a1 * n1z * n1z + a3 * n3z * n3z;
          evp[o4] += v0; evp[o4 + 1] += v1; evp[o4 + 2] += v2; evp[o4 + 3] += v3; ep[q] += Math.sqrt(v0 * v0 + v1 * v1 + 0.5 * v2 * v2 + v3 * v3);
          var d0 = D00 * v0 + D01 * v1 + D03 * v3, d1 = D10 * v0 + D11 * v1 + D13 * v3, d2 = D22 * v2, w = det[q];
          for (a = 0; a < 8; a++) { var bxa = dNx[o8 + a], bya = dNy[o8 + a]; bdy[dof[o16 + 2 * a]] += (bxa * d0 + bya * d2) * w; bdy[dof[o16 + 2 * a + 1]] += (bya * d1 + bxa * d2) * w; }
        }
      }
      if (conv || (it > 1 && !yielded)) { conv = true; break; }
    }
    saveState(M, pk);
    return { conv: conv, iters: Math.min(it, lim), u: u, bdy: bdy };
  }
  function resetPlastic(M) { M.E.forEach(function (e) { e.gp.forEach(function (g) { g.evp = [0, 0, 0, 0]; g.ep = 0; g.f = -1; }); }); }

  /* ---------------- slope geometry ---------------- */
  /* s = {H, beta (deg), toe (m flat ahead of the toe), crest (m flat behind the crest), depth (m of foundation below the toe),
          layers: [{bot: elevation, c, phi, psi, gamma, gsat, E, nu, name}] from the top down, water: elevation or null, q: surcharge on the crest (kPa)} */
  C.slopeProfile = function (s) {
    var run = s.H / Math.tan(s.beta * D2R), x1 = s.toe, x2 = s.toe + run, x3 = x2 + s.crest;
    return { x1: x1, x2: x2, x3: x3, top: function (x) { return x <= x1 ? 0 : x >= x2 ? s.H : (x - x1) / run * s.H; }, ybot: -s.depth };
  };
  function layerIndex(s, y) { for (var i = 0; i < s.layers.length; i++) if (y >= s.layers[i].bot - 1e-9) return i; return s.layers.length - 1; }
  /* mapped blocks merged at shared nodes: a foundation block below the toe level and a block above it whose
     "columns" fan from the base (x1 … x3) to the crest (x2 … x3), so steep and vertical faces keep well-shaped elements */
  function blockMesher() {
    var X = [], Y = [], key = {}, els = [], surf = [];
    function node(x, y) { var k = Math.round(x * 1e5) + "," + Math.round(y * 1e5); if (key[k] === undefined) { key[k] = X.length; X.push(x); Y.push(y); } return key[k]; }
    function block(nu, nv, map, topIsSurface) {
      for (var i = 0; i < nu; i++) for (var j = 0; j < nv; j++) {
        var q = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]].map(function (o) { var pt = map(i + o[0] / 2, j + o[1] / 2); return node(pt[0], pt[1]); });
        els.push(q); if (topIsSurface && j === nv - 1) surf.push([q[6], q[5], q[4]]);
      }
    }
    return { block: block, node: node, done: function () { return { X: X, Y: Y, els: els, nn: X.length, surf: surf }; } };
  }
  function rcm(mesh) {
    var n = mesh.nn, adj = []; for (var i = 0; i < n; i++) adj.push([]);
    mesh.els.forEach(function (e) { for (var a = 0; a < 8; a++) for (var b = 0; b < 8; b++) if (a !== b && adj[e[a]].indexOf(e[b]) < 0) adj[e[a]].push(e[b]); });
    var seen = new Uint8Array(n), order = [];
    function bfs(start) { var q = [start]; seen[start] = 1; while (q.length) { var v = q.shift(); order.push(v); adj[v].slice().sort(function (x, y) { return adj[x].length - adj[y].length; }).forEach(function (w) { if (!seen[w]) { seen[w] = 1; q.push(w); } }); } }
    /* start from a pseudo-peripheral node: lowest degree at the left edge */
    var start = 0; for (i = 1; i < n; i++) if (mesh.X[i] < mesh.X[start] - 1e-9 || (Math.abs(mesh.X[i] - mesh.X[start]) < 1e-9 && adj[i].length < adj[start].length)) start = i;
    bfs(start); for (i = 0; i < n; i++) if (!seen[i]) bfs(i);
    return order.reverse();
  }
  C.slopeMesh = function (s, fine) {
    var g = C.slopeProfile(s), k = fine || 1, hx = Math.max(s.H, 1) / (10 * k), xs = [], bm = blockMesher();
    function seg(a, b, n) { for (var i = 0; i < n; i++) xs.push(a + (b - a) * i / n); }
    var n1 = g.x1 > 1e-9 ? Math.max(2, Math.round(g.x1 / (hx * 1.5))) : 0, n2 = Math.max(6, Math.round((g.x3 - g.x1) / hx));
    if (n1) seg(0, g.x1, n1); seg(g.x1, g.x3, n2); xs.push(g.x3);
    function xAt(u) { var i = Math.floor(u), f = u - i; return i >= xs.length - 1 ? xs[xs.length - 1] : xs[i] + (xs[i + 1] - xs[i]) * f; }
    var D = s.depth > 0 ? +s.depth : 0, nyl = D ? Math.max(2, Math.round(D / (hx * 1.2))) : 0, nyu = Math.max(4, Math.round(s.H / hx));
    if (D) bm.block(xs.length - 1, nyl, function (u, v) { return [xAt(u), -D + D * v / nyl]; }, false);
    if (D && n1) { /* the toe surface edges belong to the foundation block's top row */ }
    bm.block(n2, nyu, function (u, v) { var xb = xAt(n1 + u), t = v / nyu, xt = g.x2 + (xb - g.x1) / (g.x3 - g.x1) * (g.x3 - g.x2); return [xb + (xt - xb) * t, s.H * t]; }, true);
    var mesh = bm.done();
    if (D && n1) for (var i = 0; i < n1; i++) { /* toe ground surface */ var a = mesh.X.findIndex(function (x, q) { return Math.abs(x - xs[i]) < 1e-6 && Math.abs(mesh.Y[q]) < 1e-6; }), b = mesh.X.findIndex(function (x, q) { return Math.abs(x - (xs[i] + xs[i + 1]) / 2) < 1e-6 && Math.abs(mesh.Y[q]) < 1e-6; }), c = mesh.X.findIndex(function (x, q) { return Math.abs(x - xs[i + 1]) < 1e-6 && Math.abs(mesh.Y[q]) < 1e-6; }); if (a >= 0 && b >= 0 && c >= 0) mesh.surf.unshift([a, b, c]); }
    /* renumber nodes by reverse Cuthill–McKee for a narrow band (fewer operations per solve) */
    var order = rcm(mesh), nw = []; order.forEach(function (o, i) { nw[o] = i; });
    var X = [], Y = []; order.forEach(function (o) { X.push(mesh.X[o]); Y.push(mesh.Y[o]); });
    mesh.els = mesh.els.map(function (e) { return e.map(function (n) { return nw[n]; }); }); mesh.surf = mesh.surf.map(function (e) { return e.map(function (n) { return nw[n]; }); }); mesh.X = X; mesh.Y = Y;
    return { mesh: mesh, prof: g };
  };
  /* factor of safety by strength reduction; progress(srf, conv) is called after each trial */
  C.slopeModel = function (s, opt) {
    opt = opt || {}; if (!(+s.depth > 0)) s = Object.assign({}, s, { toe: 0 }); /* no foundation layer: the model starts at the toe */
    var mm = C.slopeMesh(s, opt.fine), mesh = mm.mesh, prof = mm.prof, mats = s.layers;
    var M = build(mesh, mats, function (x, y) { return layerIndex(s, y); }, function (x, y) { return x < 1e-9 || x > prof.x3 - 1e-9 || y < prof.ybot + 1e-9; }, function (x, y) { return y < prof.ybot + 1e-9; }); /* rough fixed base, rollers on the sides */
    var water = s.water === "" || s.water === null || s.water === undefined ? null : +s.water;
    /* the water level is horizontal inside and outside the slope (hydrostatic, no seepage): this is exactly the same as
       buoyant unit weight below the water level with no pore pressure — which also accounts for water standing on the toe */
    var F = new Float64Array(M.nd);
    var kh = +s.kh || 0; /* pseudo-static earthquake: horizontal inertia kh·(total weight) towards the toe (−x) */
    M.E.forEach(function (e) { e.gp.forEach(function (g) { g.pp = 0; var wet = water !== null && g.y < water, gm = wet ? (e.m.gsat || e.m.gamma) - GW : e.m.gamma, gt = wet ? (e.m.gsat || e.m.gamma) : e.m.gamma;
      for (var a = 0; a < 8; a++) { F[2 * e.n[a] + 1] -= g.N[a] * gm * g.det; if (kh) F[2 * e.n[a]] -= kh * g.N[a] * gt * g.det; } }); });
    if (+s.q > 0) mesh.surf.forEach(function (t) { var a = t[0], b = t[1], c = t[2]; if (Math.min(mesh.X[a], mesh.X[c]) < prof.x2 - 1e-9 || Math.abs(mesh.Y[a] - s.H) > 1e-6) return; var L = Math.abs(mesh.X[c] - mesh.X[a]); F[2 * a + 1] -= s.q * L / 6; F[2 * b + 1] -= s.q * L * 2 / 3; F[2 * c + 1] -= s.q * L / 6; }); /* surcharge on the crest */
    return { s: s, M: M, F: F, prof: prof, mesh: mesh, limit: opt.limit || 500, tol: opt.tol || 1e-4 };
  };
  C.ssrTrial = function (md, srf) { resetPlastic(md.M); var r = solveVP(md.M, md.F, srf, { limit: md.limit, tol: md.tol }); r.srf = srf; return r; };
  C.plasticByElement = function (M) { return M.E.map(function (e) { var ep = 0; e.gp.forEach(function (g) { ep = Math.max(ep, g.ep); }); return ep; }); };
  function snap(M, bdy) { var pk = pack(M); loadState(M, pk); return { evp: Float64Array.from(pk.evp), ep: Float64Array.from(pk.ep), bdy: Float64Array.from(bdy) }; }
  function restore(M, st) { var pk = pack(M); M.E.forEach(function (e, i) { e.gp.forEach(function (g, k) { var q = 4 * i + k; g.evp = [st.evp[4 * q], st.evp[4 * q + 1], st.evp[4 * q + 2], st.evp[4 * q + 3]]; g.ep = st.ep[q]; }); }); return Float64Array.from(st.bdy); }
  /* factor of safety by strength reduction. Strength is reduced step by step from a converged state (continuation, as in
     incremental φ–c reduction), starting near the Bishop value when one is given, then bisected to the requested precision. */
  C.slopeSSR = function (s, opt) {
    opt = opt || {}; var md = C.slopeModel(s, opt), M = md.M, trials = [], prec = opt.prec || 0.01, F0 = opt.start || 1.2, lim = md.limit;
    function run(srf, st) { var bdy = st ? restore(M, st) : (resetPlastic(M), new Float64Array(M.nd)); var r = solveVP(M, md.F, srf, { limit: lim, tol: md.tol, bdy: bdy }); r.srf = srf; trials.push({ srf: srf, conv: r.conv, iters: r.iters }); if (opt.progress) opt.progress(srf, r.conv, trials.length); return r; }
    var base = { trials: trials, M: M, prof: md.prof, mesh: md.mesh, md: md };
    var lo = Math.max(0.2, 0.8 * F0), r = run(lo, null);
    while (!r.conv && lo > 0.25) { lo = Math.max(0.2, lo * 0.7); r = run(lo, null); }
    if (!r.conv) return Object.assign(base, { fos: null, note: "Fails even with strengths divided by " + lo.toFixed(2), u: r.u, gp: C.plasticByElement(M) });
    var stLo = snap(M, r.bdy), hi = null, rHi = null, step = opt.start ? 0.08 * F0 : 0.25;
    while (hi === null) { var t = lo + step; if (t > (opt.max || 5)) return Object.assign(base, { fos: opt.max || 5, note: "Stable with strengths divided by " + (opt.max || 5) + " — factor of safety at least that", u: r.u, gp: C.plasticByElement(M) });
      var rr = run(t, stLo); if (rr.conv) { lo = t; stLo = snap(M, rr.bdy); r = rr; step *= 1.5; } else { hi = t; rHi = rr; } }
    while (hi - lo > prec) { var mid = (lo + hi) / 2, rm = run(mid, stLo); if (rm.conv) { lo = mid; stLo = snap(M, rm.bdy); } else { hi = mid; rHi = rm; } }
    return Object.assign(base, { fos: (lo + hi) / 2, u: rHi.u, gp: C.plasticByElement(M) });
  };

  /* minimum factors of safety: IS 7894:1975 Appendix A (earth dams) and IS 14458 (Part 2) for hill slopes */
  C.SLOPE_CASES = [
    { k: "gen", n: "Permanent slope or cutting — long-term", fs: 1.5 },
    { k: "eq", n: "Slope with earthquake (pseudo-static)", fs: 1.0 },
    { k: "d1", n: "IS 7894 Case I — construction (u/s and d/s)", fs: 1.0 },
    { k: "d2", n: "IS 7894 Case II — reservoir partial pool (u/s)", fs: 1.3 },
    { k: "d3", n: "IS 7894 Case III — sudden drawdown (u/s)", fs: 1.3 },
    { k: "d4", n: "IS 7894 Case IV — steady seepage, reservoir full (d/s)", fs: 1.5 },
    { k: "d5", n: "IS 7894 Case V — steady seepage with sustained rainfall (d/s)", fs: 1.3 },
    { k: "d6", n: "IS 7894 Case VI — earthquake with seepage / full reservoir", fs: 1.0 },
    { k: "h1", n: "IS 14458 hill slope behind a wall — static", fs: 1.5 },
    { k: "h2", n: "IS 14458 hill slope behind a wall — earthquake", fs: 1.0 }];

  /* ---------------- Bishop's simplified method with a circle search ---------------- */
  C.bishop = function (s, opt) {
    opt = opt || {}; var g = C.slopeProfile(s), H = s.H, water = s.water === "" || s.water === null || s.water === undefined ? null : +s.water, ns = opt.slices || 40;
    function mat(y) { return s.layers[layerIndex(s, y)]; }
    function colW(x, yb, total) { /* weight of a unit-width column from the surface down to yb: buoyant below the (hydrostatic) water level, or total for inertia */ var yt = g.top(x), w = 0; s.layers.forEach(function (L, i) { var top = i === 0 ? Infinity : s.layers[i - 1].bot, a = Math.max(L.bot, yb), b = Math.min(top, yt); if (b <= a) return; var wet = water === null ? 0 : Math.max(0, Math.min(b, water) - a); w += (b - a - wet) * L.gamma + wet * ((L.gsat || L.gamma) - (total ? 0 : GW)); }); return w; } /* buoyant weight below the (hydrostatic) water level */
    function F(xc, yc, R) {
      /* entry and exit where the circle meets the ground */
      var xs = [], N = 400, prev = null;
      for (var i = 0; i <= N; i++) { var x = g.x3 * i / N, d = R * R - (x - xc) * (x - xc), inside = d > 0 && yc - Math.sqrt(d) < g.top(x); if (prev !== null && inside !== prev) xs.push(x); prev = inside; }
      var in0 = R * R - xc * xc > 0 && yc - Math.sqrt(R * R - xc * xc) < g.top(0), in3 = R * R - (g.x3 - xc) * (g.x3 - xc) > 0 && yc - Math.sqrt(R * R - (g.x3 - xc) * (g.x3 - xc)) < g.top(g.x3);
      if (in0 || in3 || xs.length < 2) return null; var xa = xs[0], xb = xs[xs.length - 1]; if (xb - xa < 0.05 * H) return null;
      var sl = [], b = (xb - xa) / ns;
      for (i = 0; i < ns; i++) { var xm = xa + (i + 0.5) * b, d2 = R * R - (xm - xc) * (xm - xc); if (d2 <= 0) return null; var yb = yc - Math.sqrt(d2); if (yb < g.ybot - 1e-6) return null; if (yb >= g.top(xm)) continue;
        var al = Math.asin((xm - xc) / R), W = colW(xm, yb) * b + (+s.q > 0 && xm >= g.x2 ? s.q * b : 0), m = mat(yb), u = 0, Wt = colW(xm, yb, true) * b, ym = (g.top(xm) + yb) / 2;
        sl.push({ W: W, al: al, c: m.c, t: Math.tan(m.phi * D2R), u: u, b: b, Wt: Wt, arm: (yc - ym) / R }); }
      if (sl.length < 4) return null;
      var den = 0, kh = +s.kh || 0; sl.forEach(function (q) { den += q.W * Math.sin(q.al); }); if (Math.abs(den) < 1e-9) return null;
      var sign = den > 0 ? 1 : -1, Fs = 1.2; if (kh) sl.forEach(function (q) { den += sign * kh * q.Wt * q.arm; });
      for (var it = 0; it < 60; it++) { var num = 0; sl.forEach(function (q) { var ma = Math.cos(q.al) + sign * Math.sin(q.al) * q.t / Fs; if (ma < 0.2) ma = 0.2; num += (q.c * q.b + (q.W - q.u * q.b) * q.t) / ma; }); var Fn = num / Math.abs(den); if (Math.abs(Fn - Fs) < 1e-5) { Fs = Fn; break; } Fs = Fn; }
      return Fs > 0 ? { F: Fs, xa: xa, xb: xb } : null;
    }
    var best = null, X0 = g.x1 - H, X1 = g.x2 + H, Y0 = H * 1.05, Y1 = H * 3, n = opt.grid || 16;
    function tryC(xc, yc) {
      var ymin = g.ybot, levels = [];
      for (var k = 0; k <= 8; k++) levels.push(ymin + (0 - ymin) * k / 8);
      levels.push(0.25 * H, 0.5 * H);
      levels.forEach(function (yt) { var R = yc - yt; if (R <= 0) return; var r = F(xc, yc, R); if (r && (!best || r.F < best.F)) best = { F: r.F, xc: xc, yc: yc, R: R, xa: r.xa, xb: r.xb }; });
      var Rt = Math.hypot(xc - g.x1, yc); var rt = F(xc, yc, Rt); if (rt && (!best || rt.F < best.F)) best = { F: rt.F, xc: xc, yc: yc, R: Rt, xa: rt.xa, xb: rt.xb };
    }
    for (var i = 0; i <= n; i++) for (var j = 0; j <= n; j++) tryC(X0 + (X1 - X0) * i / n, Y0 + (Y1 - Y0) * j / n);
    if (!best) return null;
    /* local refinement around the best centre and radius */
    var step = (X1 - X0) / n;
    for (var pass = 0; pass < 4; pass++) { var b0 = best; for (i = -3; i <= 3; i++) for (j = -3; j <= 3; j++) for (var k = -3; k <= 3; k++) { var xc = b0.xc + i * step / 3, yc = b0.yc + j * step / 3, R = b0.R + k * step / 3; if (R <= 0) continue; var r = F(xc, yc, R); if (r && r.F < best.F) best = { F: r.F, xc: xc, yc: yc, R: R, xa: r.xa, xb: r.xb }; } step /= 3; }
    return best;
  };

  /* ---------------- strip footing to collapse ---------------- */
  /* f = {B, q0 (surcharge beside the footing, kPa), layers [{bot (depth below base, positive), c, phi, psi, gamma, gsat, E, nu}], water (depth below base or null), K0} */
  C.footingStart = function (f, opt) {
    opt = opt || {}; var B = f.B, hw = B / 2, W = opt.width || 5 * B, Dp = opt.depth || 3 * B, xs = [];
    /* graded columns: fine under and near the footing edge */
    var nIn = opt.nIn || 6, nOut = opt.nOut || 14; for (var i = 0; i < nIn; i++) xs.push(hw * i / nIn);
    for (i = 0; i < nOut; i++) { var t = i / nOut; xs.push(hw + (W - hw) * (Math.pow(1.25, t * nOut) - 1) / (Math.pow(1.25, nOut) - 1)); } xs.push(W);
    var ny = opt.ny || 14, mesh = C.feMesh(xs, function () { return 0; }, -Dp, ny, opt.grade || 4);
    function li(y) { var d = -y; for (var k = 0; k < f.layers.length; k++) if (d <= f.layers[k].bot + 1e-9) return k; return f.layers.length - 1; }
    var M = build(mesh, f.layers, function (x, y) { return li(y); }, function (x, y) { return x < 1e-9 || x > W - 1e-9 || y < -Dp + 1e-9; }, function (x, y) { return y < -Dp + 1e-9; });
    var water = f.water === null || f.water === undefined || f.water === "" ? null : -(+f.water);
    porePressures(M, water);
    /* geostatic initial stresses (K0) including the surcharge */
    M.E.forEach(function (e) { e.gp.forEach(function (g) {
      var d = -g.y, sv = +f.q0 || 0, z = 0; f.layers.forEach(function (L, k) { var top = k ? f.layers[k - 1].bot : 0, a = top, b = Math.min(L.bot, d); if (b <= a) return; var wet = water === null ? 0 : Math.max(0, b - Math.max(a, -water)); sv += (b - a - wet) * L.gamma + wet * (L.gsat || L.gamma); });
      if (d > f.layers[f.layers.length - 1].bot) { var Ll = f.layers[f.layers.length - 1]; sv += (d - Ll.bot) * (water !== null ? (Ll.gsat || Ll.gamma) : Ll.gamma); }
      var ev = sv - g.pp, K0 = f.K0 || 1 - Math.sin(e.m.phi * D2R) || 1; if (e.m.phi === 0) K0 = f.K0 || 1;
      g.s0 = [-(K0 * ev + g.pp), -(ev + g.pp), 0, -(K0 * ev + g.pp)]; }); });
    /* consistent nodal loads for a unit pressure on the footing (surface edges with x < B/2) */
    var Fu = new Float64Array(M.nd), top = mesh.nj - 1, cen = mesh.id[0][top];
    for (i = 0; i + 2 < mesh.ni; i += 2) { var a = mesh.id[i][top], bn = mesh.id[i + 1][top], c = mesh.id[i + 2][top]; if (mesh.X[c] > hw + 1e-9) break; var L = mesh.X[c] - mesh.X[a]; Fu[2 * a + 1] -= L / 6; Fu[2 * bn + 1] -= L * 2 / 3; Fu[2 * c + 1] -= L / 6; }
    var st = { f: f, opt: opt, M: M, mesh: mesh, Fu: Fu, cen: cen, curve: [{ q: 0, s: 0 }], q: 0, dq: opt.dq || 20, bdy: new Float64Array(M.nd), u: null, n: 0, B: B, W: W, Dp: Dp, done: false };
    return st;
  };
  /* one load increment; halves the increment after a failed one; done when the increment is below dqMin or settlement exceeds sMax */
  C.footingStep = function (st) {
    var M = st.M, opt = st.opt, lim = opt.limit || 800;
    if (st.done) return st;
    var save = M.E.map(function (e) { return e.gp.map(function (g) { return [g.evp.slice(), g.ep]; }); }), bsave = Float64Array.from(st.bdy), qt = st.q + st.dq, F = new Float64Array(M.nd);
    for (var k = 0; k < M.nd; k++) F[k] = st.Fu[k] * qt;
    var r = solveVP(M, F, 1, { limit: lim, tol: opt.tol || 1e-4, bdy: st.bdy }), sc = r.u ? -r.u[2 * st.cen + 1] * 1000 : null;
    if (r.conv && sc < (opt.sMax || 0.25 * st.B * 1000)) { st.q = qt; st.curve.push({ q: qt, s: sc }); st.u = r.u; }
    else { M.E.forEach(function (e, ei) { e.gp.forEach(function (g, gi) { g.evp = save[ei][gi][0]; g.ep = save[ei][gi][1]; }); }); st.bdy = bsave; st.dq /= 2; }
    st.n++; if (st.dq <= (opt.dqMin || 0.5) || st.n >= (opt.steps || 200)) { st.done = true; st.qu = st.q; st.gp = C.plasticByElement(M); }
    return st;
  };
  C.footingFE = function (f, opt) { var st = C.footingStart(f, opt || {}); while (!st.done) C.footingStep(st); st.qu = st.q; return st; };

  /* slope input from a borehole: layers by depth below the crest, drained (c′, φ′) or undrained (cu, φ = 0) */
  C.slopeFromBorehole = function (P, bh, s, mode) {
    var b = C.bh(P, bh), out = [];
    b.layers.forEach(function (L) { var p = C.params(b, L), und = mode === "undrained" && L.kind === "clay"; var E = p.E || 20000;
      out.push({ name: L.name || C.KINDS[L.kind], bot: s.H - L.bot, c: und ? (p.cu || 0) : (+L.c || 0) + (L.kind === "clay" && !(+L.phi > 0) && !und ? 0 : 0), phi: und ? 0 : (L.kind === "clay" ? (+L.phi || 0) : (p.phi || 30)), psi: 0, gamma: L.gamma, gsat: L.gsat || L.gamma, E: E, nu: und ? 0.49 : Math.min(p.nu || 0.3, 0.45) }); });
    out[out.length - 1].bot = -Infinity;
    return out;
  };
})(GC);
