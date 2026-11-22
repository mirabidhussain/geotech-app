/* IS GeoTech worker: runs the long finite-element analyses off the interface thread. Bundled with the engine into
   GT_ENGINE_SRC by build.py; the interface starts it from a Blob so it also works from file:// (Android). */
function feMeshOut(M) { return { X: Array.from(M.mesh.X), Y: Array.from(M.mesh.Y), els: M.E.map(function (e) { return e.n; }), mi: M.E.map(function (e) { return e.mi; }) }; }
self.onmessage = function (ev) {
  var d = ev.data, t0 = Date.now();
  try {
    if (d.cmd === "slope") {
      var bi = GC.bishop(d.s);
      self.postMessage({ id: d.id, type: "progress", text: "Bishop: " + (bi ? bi.F.toFixed(3) : "—") + " — building the mesh…" });
      var r = GC.slopeSSR(d.s, { start: bi ? bi.F : 1.2, fine: d.fine || 1, prec: 0.01, progress: function (srf, conv, n) { self.postMessage({ id: d.id, type: "progress", text: "Trial " + n + ": strengths ÷ " + srf.toFixed(3) + (conv ? " — stands" : " — fails") }); } });
      self.postMessage({ id: d.id, type: "done", res: { fos: r.fos, note: r.note || "", bi: bi, trials: r.trials.length, mesh: feMeshOut(r.M), gp: r.gp, ne: r.M.E.length, time: (Date.now() - t0) / 1000 } });
    } else if (d.cmd === "footing") {
      var st = GC.footingStart(d.f, d.opt);
      while (!st.done) { GC.footingStep(st); self.postMessage({ id: d.id, type: "progress", text: "Pressure " + st.q.toFixed(0) + " kPa, settlement " + st.curve[st.curve.length - 1].s.toFixed(1) + " mm…" }); }
      self.postMessage({ id: d.id, type: "done", res: { qu: st.q, curve: st.curve, mesh: feMeshOut(st.M), gp: st.gp, steps: st.n, time: (Date.now() - t0) / 1000 } });
    } else if (d.cmd === "ping") self.postMessage({ id: d.id, type: "done", res: { ok: true } });
  } catch (er) { self.postMessage({ id: d.id, type: "error", text: String(er && er.message || er) }); }
};
