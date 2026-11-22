# IS GeoTech

A companion app to [IS StructDesign](https://github.com/mirabidhussain/structural-analysis-and-design-app) for soil and shallow foundations.

**Web app:** https://mirabidhussain.github.io/geotech-app/ (works offline once opened) · **Android:** download the APK from [Releases](https://github.com/mirabidhussain/geotech-app/releases). Version 2.0 adds earthquake ground checks, retaining walls, under-reamed piles, rock, laboratory tests, investigation planning, an offline library and faster finite elements. Earlier versions: 1.2 (2D finite elements), 1.1 (bored piles), 1.0 (shallow foundations).

## What it does

- **Site**:
  - boreholes with soil layers and the water table;
  - SPT readings with overburden and dilatancy corrections (IS 2131 practice);
  - a borehole log drawing.
  - Missing φ, cu, Dr or E can be estimated from SPT N. Estimated values are marked:
    - φ from the Peck–Hanson–Thornburn curve (IS 6403 Fig. 1);
    - Dr after Meyerhof;
    - cu after Stroud;
    - E after Bowles.
- **Lab tests**: sieve analysis and Atterberg limits give the IS 1498 soil symbol and a grading curve.
- **Footing** (square, rectangle, circle or strip):
  - Net safe bearing capacity to IS 6403:
    - shape factors;
    - depth factors, used only when the backfill is compacted;
    - inclination factors;
    - water table factor W′;
    - eccentricity, using B − 2e;
    - local, general or interpolated shear, depending on relative density;
    - undrained capacity for clay.
  - Settlement to IS 8009 Part 1:
    - immediate settlement by the Steinbrenner layered method, × 0.8 for a rigid footing;
    - consolidation from Cc, Cr, e0 and σ′p (or mv) in 0.5 m sublayers;
    - time to 50 % and 90 % from cv.
  - **Allowable bearing pressure**: the smaller of the shear value (qnu/FS) and the pressure that gives the IS 1904:2021 Table 1 settlement limit.
  - When the footing fails, the smallest width that works.
  - **Which part can fail**:
    - how deep the shear wedge reaches;
    - water table effects;
    - weak layers checked by 2:1 load spread (punching through);
    - clay layers loaded past σ′p;
    - each layer's share of the settlement.
- **Pressure bulb**:
  - Boussinesq contours over the soil layers, with a width slider and the option to include all footings;
  - stress-with-depth plot (σ′v0, Δσz, their sum, σ′p).
- **Piles** (IS 2911 Part 1/Sec 2, bored cast-in-situ):
  - axial capacity by the static formula (Annex B-1/B-2) and the SPT correlation (B-4), with the lower value adopted by default;
  - critical depth 15D–20D; K, Nq (IS 2911 Fig. 1) and α (Fig. 2) can be entered — the defaults are Nq per IS 6403 and α after API RP 2A, flagged in the steps;
  - negative skin friction from layers you mark as settling; uplift (FS 3);
  - single-pile settlement (Vesic) and the axial spring;
  - groups: the smaller of the sum of single piles and block failure (cl. 6.7.3), spacing checks (cl. 6.6), settlement on an equivalent raft at ⅔L;
  - lateral load on a Winkler beam with IS 2911 Annex C subgrade values (Tables 3 and 4), free or fixed head, deflection and moment profiles, equivalent depth of fixity for frame models, lateral load for 5 mm / ½ of 12 mm;
  - spring table for IS StructDesign (.csv).
- **Footings** also report the modulus of subgrade reaction ks = q/s for raft models.
- **2D finite elements** (plane strain, 8-node elements, elastic–perfectly plastic Mohr–Coulomb, viscoplastic solution after Smith & Griffiths):
  - **Slope stability:** factor of safety by strength reduction (Griffiths & Lane 1999) with the plastic slip band drawn, and Bishop's simplified method with a circle search as an independent check; layers, crest surcharge, a horizontal water level (buoyant weight; no seepage), layers can be filled from a borehole (drained or undrained);
  - **Strip footing to collapse:** the footing's width and depth on its borehole, drained or undrained, load–settlement curve to failure and the plastic zone, compared with IS 6403 — this shows failures that reach a weaker layer below the zone the formula uses.
- **Earthquake** (IS 1893 Part 1:2016): site class from N, liquefaction by the Annex F SPT procedure (CSR, CRR, MSF, Kσ, fines correction), settlement after liquefaction (Idriss & Boulanger 2008) and the liquefaction potential index.
- **Retaining walls** (IS 14458 Part 2, IS 1893 Part 3): gravity and RCC cantilever walls, Rankine / Coulomb / Mononobe–Okabe pressures, water and uplift, overturning, sliding, middle third, base pressure and floatation checks, smallest base width.
- **Under-reamed piles** (IS 2911 Part 3): clay and sand formulas with Table 1 safe loads.
- **Rock** (IS 13365 Part 1, IS 12070): rock mass rating, class, modulus, allowable pressure with the joint-spacing factor.
- **Laboratory tests** (IS 2720): compaction, CBR, direct shear, triaxial (UU/CU/CD), consolidation (Cc, Cr, σ′p, cv) — results copy to soil layers.
- **Investigation planning** (IS 1892): number and depth of boreholes.
- **Slopes:** pseudo-static earthquake coefficient and IS 7894 / IS 14458 required factors of safety.
- **Library:** codes covered, method notes, 14 print-resolution reference charts, worked examples, verification record, symbols and typical values.
- **Speed:** the finite-element analyses run on a background thread with an allocation-free solver, band-reducing node order and strength reduction continued from the last stable state (about 3–4× faster than v1.2).
- **Plate load test** (IS 1888):
  - log–log break for the ultimate pressure;
  - scaling to the footing size (Terzaghi and Peck for sand, B ratio for clay);
  - safe bearing pressure.
- **Report**: print or save as PDF or HTML. Project files are `.isg.json`.

## Tests

```
node test/core_test.js   # IS 6403 Table 1, Fadum/Boussinesq, Steinbrenner, consolidation, IS 1498, plate test
node test/pile_test.js   # IS 2911 Annex B hand calculations, Hetényi and Reese–Matlock lateral solutions, groups
node test/fe_test.js     # Prandtl, Griffiths & Lane example 1, Taylor vertical cut, submerged infinite slope, Bishop cross-checks
node test/codes_test.js  # IS 1893 liquefaction, earth pressure and walls, IS 2720 tests, RMR / IS 12070, IS 1892, under-reamed piles
python3 build.py && node test/ui_test.js
```

The Android app is in `android/` (package `com.mirabid.isgeotech`). Each version is kept as its own release, tagged `v<version>`, with the APK and the offline HTML. The web app is on GitHub Pages.

## Fonts and charts

The app bundles Inter (SIL Open Font License 1.1) and DejaVu Sans Mono; see `www/fonts/LICENSES.txt`. Reference charts in `www/img` are generated by `tools/charts.py` from the app's own formulas.
