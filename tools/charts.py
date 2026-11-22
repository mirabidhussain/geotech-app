"""Reference charts for the IS GeoTech library, computed from the same formulas as the app (high resolution PNG)."""
import math, os
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
OUT = os.path.join(os.path.dirname(__file__), "..", "www", "img"); os.makedirs(OUT, exist_ok=True)
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 13, "axes.grid": True, "grid.alpha": 0.35, "axes.spines.top": False, "axes.spines.right": False, "figure.dpi": 100})
C = ["#1d4ed8", "#d97706", "#15803d", "#b91c1c", "#7c3aed", "#0891b2"]
def save(fig, name, src):
    fig.text(0.995, 0.005, src, ha="right", va="bottom", fontsize=9, color="#666")
    fig.tight_layout(); fig.savefig(os.path.join(OUT, name + ".png"), dpi=200); plt.close(fig); print(name)
D2R = math.pi / 180
# 1 bearing capacity factors
phi = np.linspace(0, 50, 501); t = np.tan(phi * D2R); Nq = np.exp(np.pi * t) * np.tan((45 + phi / 2) * D2R) ** 2
Nc = np.where(phi > 0, (Nq - 1) / np.where(t > 0, t, 1), 5.14); Ng = 2 * (Nq + 1) * t
fig, ax = plt.subplots(figsize=(12, 7.5)); [ax.semilogy(phi, v, lw=2.4, color=c, label=l) for v, c, l in [(Nc, C[0], "Nc"), (Nq, C[1], "Nq"), (np.maximum(Ng, 1e-2), C[2], "Nγ")]]
ax.set_ylim(0.5, 1000); ax.set_xlabel("Angle of shearing resistance φ (°)"); ax.set_ylabel("Bearing capacity factor"); ax.set_title("Bearing capacity factors — IS 6403 Table 1 (Vesić Nγ)"); ax.legend(); save(fig, "bc_factors", "IS GeoTech · computed: Nq = e^(π tanφ)·tan²(45+φ/2), Nc = (Nq−1)cotφ, Nγ = 2(Nq+1)tanφ")
# 2 pressure bulbs square & strip
def fadum(m, n):
    m2, n2 = m * m, n * n; s = np.sqrt(m2 + n2 + 1)
    return (2 * m * n * s / (m2 + n2 + m2 * n2 + 1) * (m2 + n2 + 2) / (m2 + n2 + 1) + np.arctan2(2 * m * n * s, m2 + n2 + 1 - m2 * n2)) / (4 * np.pi)
def corner(a, b, z): return np.sign(a) * np.sign(b) * fadum(np.abs(a) / z, np.abs(b) / z)
X, Z = np.meshgrid(np.linspace(-2, 2, 401), np.linspace(0.01, 4.5, 451))
sq = corner(0.5 - X, 0.5, Z) - corner(-0.5 - X, 0.5, Z) - corner(0.5 - X, -0.5, Z) + corner(-0.5 - X, -0.5, Z)
b1 = np.arctan((X + 0.5) / Z); b2 = np.arctan((X - 0.5) / Z); st = (b1 - b2 + np.sin(b1) * np.cos(b1) - np.sin(b2) * np.cos(b2)) / np.pi
fig, axs = plt.subplots(1, 2, figsize=(14, 8), sharey=True)
for ax, v, ti in [(axs[0], sq, "Square footing (section through the centre)"), (axs[1], st, "Strip footing")]:
    cs = ax.contour(X, Z, v, levels=[0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], colors=C[0], linewidths=1.8); ax.clabel(cs, fmt=lambda q: f"{q:.2f}q", fontsize=11)
    ax.add_patch(plt.Rectangle((-0.5, -0.08), 1, 0.08, color="#555")); ax.set_xlabel("x / B"); ax.set_title(ti); ax.set_aspect("equal")
axs[0].set_ylim(4.5, -0.15); axs[0].set_ylabel("depth z / B"); save(fig, "pressure_bulbs", "IS GeoTech · Boussinesq: Fadum rectangle and strip solutions")
# 3 Fadum chart
fig, ax = plt.subplots(figsize=(12, 7.5)); n = np.logspace(-1, 1, 300)
for k, m in enumerate([0.1, 0.2, 0.4, 0.6, 1, 2, 4, 10]): ax.semilogx(n, fadum(m, n), lw=2, label=f"m = {m}", color=plt.cm.viridis(k / 8))
ax.set_xlabel("n = L/z"); ax.set_ylabel("influence factor I (corner)"); ax.set_title("Vertical stress under the corner of a uniformly loaded rectangle (Fadum)"); ax.legend(ncol=2); save(fig, "fadum", "IS GeoTech · Δσz = q·I(m = B/z, n = L/z)")
# 4 Steinbrenner
def stein(m, nn):
    m2, n2 = m * m, nn * nn; A = np.sqrt(m2 + n2 + 1)
    F1 = (m * np.log((1 + np.sqrt(m2 + 1)) * np.sqrt(m2 + n2) / (m * (1 + A))) + np.log((m + np.sqrt(m2 + 1)) * np.sqrt(1 + n2) / (m + A))) / np.pi
    F2 = nn / (2 * np.pi) * np.arctan(m / (nn * A)); return F1, F2
fig, axs = plt.subplots(1, 2, figsize=(14, 7.5)); nn = np.logspace(-1, 2, 300)
for k, m in enumerate([1, 2, 5, 10]):
    F1, F2 = stein(m, nn); axs[0].semilogx(nn, F1, lw=2, color=C[k], label=f"L/B = {m}"); axs[1].semilogx(nn, F2, lw=2, color=C[k], label=f"L/B = {m}")
axs[0].set_title("Steinbrenner F1"); axs[1].set_title("Steinbrenner F2"); [a.set_xlabel("H / b  (layer thickness ÷ width b of the rectangle at its corner)") for a in axs]; axs[0].legend(); save(fig, "steinbrenner", "IS GeoTech · s(corner) = qB/E·[(1−ν²)F1 + (1−ν−2ν²)F2]")
# 5 consolidation
Tv = np.logspace(-3, 1, 400); Uv = np.where(Tv < 0.2827, np.sqrt(4 * Tv / np.pi), 1 - 8 / np.pi ** 2 * np.exp(-np.pi ** 2 * Tv / 4))
fig, ax = plt.subplots(figsize=(12, 7.5)); ax.semilogx(Tv, Uv * 100, lw=2.5, color=C[0]); ax.invert_yaxis()
for u, tv in [(50, 0.197), (90, 0.848)]: ax.axhline(u, color=C[3], ls="--", lw=1); ax.annotate(f"U = {u} %  Tv = {tv}", (tv, u), (tv * 1.6, u - 8), fontsize=12, color=C[3])
ax.set_xlabel("time factor Tv = cv·t / Hdr²"); ax.set_ylabel("average degree of consolidation U (%)"); ax.set_title("Terzaghi one-dimensional consolidation"); save(fig, "consolidation_U", "IS GeoTech · U(Tv), uniform initial excess pore pressure")
# 6 plasticity chart IS 1498
fig, ax = plt.subplots(figsize=(12, 8)); LL = np.linspace(0, 100, 200)
ax.plot(LL, np.maximum(0, 0.73 * (LL - 20)), color=C[3], lw=2.5, label="A-line  PI = 0.73(LL − 20)"); ax.plot(LL, np.maximum(0, 0.9 * (LL - 8)), color="#999", ls=":", lw=1.5, label="U-line (upper limit)")
for x in (35, 50): ax.axvline(x, color="#444", lw=1.4, ls="--")
ax.fill_between([10, 25.48], [4, 4], [7, 7], color=C[1], alpha=0.25, label="CL-ML hatched zone")
for (x, y, s) in [(25, 12, "CL"), (42, 20, "CI"), (70, 45, "CH"), (28, 3, "ML / OL"), (42, 6, "MI / OI"), (75, 18, "MH / OH")]: ax.text(x, y, s, fontsize=16, weight="bold", color="#333")
ax.set_xlim(0, 100); ax.set_ylim(0, 60); ax.set_xlabel("Liquid limit LL (%)"); ax.set_ylabel("Plasticity index PI (%)"); ax.set_title("Plasticity chart — IS 1498 (L < 35, I 35–50, H > 50)"); ax.legend(loc="upper left"); save(fig, "plasticity_chart", "IS GeoTech · IS 1498:1970 classification of fine-grained soils")
# 7 liquefaction CRR
N = np.linspace(0, 29.5, 300); CRR = 1 / (34 - N) + N / 135 + 50 / (10 * N + 45) ** 2 - 1 / 200
fig, ax = plt.subplots(figsize=(12, 7.5))
for k, FC in enumerate([5, 15, 35]):
    a = 0 if FC <= 5 else (5 if FC >= 35 else math.exp(1.76 - 190 / FC ** 2)); b = 1 if FC <= 5 else (1.2 if FC >= 35 else 0.99 + FC ** 1.5 / 1000)
    N160 = (N - a) / b; ax.plot(N160[N160 >= 0], CRR[N160 >= 0], lw=2.4, color=C[k], label=f"fines ≤ {FC} %" if FC == 5 else f"fines {FC} %" + (" or more" if FC == 35 else ""))
ax.set_xlim(0, 30); ax.set_ylim(0, 0.6); ax.set_xlabel("(N1)60"); ax.set_ylabel("CRR for Mw 7.5 (cyclic resistance ratio)"); ax.set_title("Liquefaction resistance from SPT — IS 1893 (Part 1):2016 Annex F"); ax.legend(); save(fig, "liquefaction_CRR", "IS GeoTech · CRR7.5 = 1/(34−N) + N/135 + 50/(10N+45)² − 1/200, N = (N1)60cs")
# 8 MSF and rd
fig, axs = plt.subplots(1, 2, figsize=(14, 7)); Mw = np.linspace(5, 8.5, 100); axs[0].plot(Mw, 10 ** 2.24 / Mw ** 2.56, lw=2.5, color=C[0]); axs[0].set_xlabel("Magnitude Mw"); axs[0].set_ylabel("MSF"); axs[0].set_title("Magnitude scaling factor")
z = np.linspace(0, 23, 200); rd = np.where(z <= 9.15, 1 - 0.00765 * z, 1.174 - 0.0267 * z); axs[1].plot(rd, z, lw=2.5, color=C[1]); axs[1].invert_yaxis(); axs[1].set_xlabel("rd"); axs[1].set_ylabel("depth (m)"); axs[1].set_title("Stress reduction factor"); save(fig, "liquefaction_MSF_rd", "IS GeoTech · IS 1893 Annex F (NCEER) relations")
# 9 IB2008 volumetric strain
fig, ax = plt.subplots(figsize=(12, 7.5)); FS = np.linspace(0.4, 2, 300)
for k, n1 in enumerate([5, 10, 15, 20, 25, 30]):
    Fa = 0.032 + 0.69 * math.sqrt(n1) - 0.13 * n1; gl = max(0, 1.859 * (1.1 - math.sqrt(n1 / 46)) ** 3)
    g = np.where(FS >= 2, 0, np.where(FS > Fa, np.minimum(gl, 0.035 * (1 - Fa) * (2 - FS) / np.maximum(FS - Fa, 1e-9)), gl)); ev = 1.5 * math.exp(-0.369 * math.sqrt(n1)) * np.minimum(0.08, g)
    ax.plot(ev * 100, FS, lw=2.2, color=plt.cm.plasma(k / 6), label=f"(N1)60cs = {n1}")
ax.set_xlabel("volumetric strain εv (%)"); ax.set_ylabel("factor of safety against liquefaction"); ax.set_title("Settlement after liquefaction (Idriss & Boulanger 2008)"); ax.legend(); save(fig, "liquefaction_settlement", "IS GeoTech · εv = 1.5·exp(−0.369√N1cs)·min(0.08, γmax)")
# 10 earth pressure
fig, axs = plt.subplots(1, 2, figsize=(14, 7.5)); ph = np.linspace(20, 45, 200)
for k, i in enumerate([0, 10, 20]):
    ci = math.cos(i * D2R); cp = np.cos(ph * D2R); rr = np.sqrt(np.maximum(0, ci ** 2 - cp ** 2)); axs[0].plot(ph, ci * (ci - rr) / (ci + rr), lw=2.3, color=C[k], label=f"Ka, backfill {i}°")
axs[0].plot(ph, np.tan((45 + ph / 2) * D2R) ** 2 / 10, lw=2, ls="--", color=C[3], label="Kp ÷ 10 (level)"); axs[0].set_xlabel("φ′ (°)"); axs[0].set_title("Rankine coefficients"); axs[0].legend()
kh = np.linspace(0, 0.4, 200)
for k, f in enumerate([30, 35, 40]):
    vals = []
    for a in kh:
        lam = math.atan(a); x = f * D2R - lam
        vals.append(np.nan if x < 0 else math.cos(f * D2R - lam) ** 2 / (math.cos(lam) * math.cos(lam) * (1 + math.sqrt(math.sin(f * D2R) * math.sin(x) / math.cos(lam))) ** 2))
    axs[1].plot(kh, vals, lw=2.3, color=C[k], label=f"φ = {f}°")
axs[1].set_xlabel("horizontal seismic coefficient αh (αv = 0)"); axs[1].set_ylabel("Ca"); axs[1].set_title("Mononobe–Okabe dynamic active coefficient (δ = 0, level fill)"); axs[1].legend(); save(fig, "earth_pressure", "IS GeoTech · Rankine; Mononobe–Okabe as in IS 1893 (Part 3)")
# 11 pile: alpha and subgrade
fig, axs = plt.subplots(1, 2, figsize=(14, 7)); cu = np.linspace(0, 150, 300); axs[0].plot(cu, np.clip(1 - 0.5 * (cu - 25) / 45, 0.5, 1), lw=2.5, color=C[0]); axs[0].set_xlabel("undrained strength cu (kPa)"); axs[0].set_ylabel("adhesion factor α"); axs[0].set_title("Default α (API RP 2A) — check IS 2911 Fig. 2")
Nn = np.linspace(0, 50, 300)
def eta(Nv, tab): return np.interp(Nv, [r[0] for r in tab], [r[1] for r in tab])
axs[1].plot(Nn, eta(Nn, [(0, 0), (4, 400), (10, 2500), (35, 7500), (50, 20000)]) / 1000, lw=2.4, color=C[1], label="dry"); axs[1].plot(Nn, eta(Nn, [(0, 0), (4, 200), (10, 1400), (35, 5000), (50, 12000)]) / 1000, lw=2.4, color=C[2], label="submerged")
axs[1].set_xlabel("SPT N"); axs[1].set_ylabel("ηh (×10³ kN/m³)"); axs[1].set_title("IS 2911 Table 3 — modulus of subgrade reaction, sands"); axs[1].legend(); save(fig, "pile_alpha_eta", "IS GeoTech · values interpolated within the table bands")
# 12 RMR classes and Em
fig, ax = plt.subplots(figsize=(12, 7)); R = np.linspace(10, 100, 300); Em = np.where(R > 50, 2 * R - 100, 10 ** ((R - 10) / 40))
ax.semilogy(R, Em, lw=2.5, color=C[0]); [ax.axvspan(a, b, color=c, alpha=0.12) for a, b, c in [(0, 20, "#b91c1c"), (20, 40, "#d97706"), (40, 60, "#ca8a04"), (60, 80, "#65a30d"), (80, 100, "#15803d")]]
for x, s in [(10, "V"), (30, "IV"), (50, "III"), (70, "II"), (90, "I")]: ax.text(x, 0.6, "class " + s, ha="center", fontsize=13)
ax.set_xlim(0, 100); ax.set_xlabel("rock mass rating RMR"); ax.set_ylabel("deformation modulus Em (GPa)"); ax.set_title("RMR classes (IS 13365 Part 1) and rock-mass modulus"); save(fig, "rmr_em", "IS GeoTech · Bieniawski (RMR > 50), Serafim & Pereira")
# 13 under-reamed safe loads
T = [(20, 8, 12, 4, 6, 1.0, 1.2), (25, 12, 18, 6, 9, 1.5, 1.8), (30, 16, 24, 8, 12, 2.0, 2.4), (37.5, 24, 36, 12, 18, 3.0, 3.6), (40, 28, 42, 14, 21, 3.4, 4.0), (45, 35, 52.5, 17.5, 26.25, 4.0, 4.8), (50, 42, 63, 21, 31.5, 4.5, 5.4)]
fig, ax = plt.subplots(figsize=(12, 7.5)); D = [r[0] for r in T]
for j, l, c, ls in [(1, "compression, single bulb", C[0], "-"), (2, "compression, double bulb", C[0], "--"), (3, "uplift, single", C[1], "-"), (4, "uplift, double", C[1], "--"), (5, "lateral, single", C[2], "-"), (6, "lateral, double", C[2], "--")]: ax.plot(D, [r[j] * 9.81 for r in T], ls, lw=2.3, color=c, marker="o", label=l)
ax.set_xlabel("stem diameter (cm), bulb = 2.5 × stem"); ax.set_ylabel("safe load (kN)"); ax.set_title("Under-reamed piles — IS 2911 (Part 3) Table 1, medium soils"); ax.legend(); save(fig, "under_reamed", "IS GeoTech · check the 40 cm row against the printed table")
# 14 typical soil property ranges (textbook ranges)
fig, ax = plt.subplots(figsize=(12, 7.5)); rows = [("Soft clay", 15, 30, 2, 15), ("Stiff clay", 50, 150, 10, 50), ("Loose sand", 0, 0, 10, 25), ("Medium sand", 0, 0, 25, 50), ("Dense sand", 0, 0, 50, 100), ("Dense gravel", 0, 0, 80, 200)]
for k, (n_, c0, c1, e0, e1) in enumerate(rows): ax.barh(k, e1 - e0, left=e0, color=C[k % 6], alpha=0.75); ax.text(e1 + 3, k, f"{e0}–{e1} MPa", va="center", fontsize=12)
ax.set_yticks(range(len(rows))); ax.set_yticklabels([r[0] for r in rows]); ax.set_xlabel("drained Young's modulus E (MPa), typical range"); ax.set_title("Typical soil stiffness — use only before test values are available"); save(fig, "typical_E", "IS GeoTech · general textbook ranges, indicative only")
