/* IS GeoTech browser test (Playwright): every tab renders, edits flow through, numbers agree with the engine */
const { chromium } = require('playwright');
const path = require('path');
global.GC = require('../www/js/gcore.js'); ['gpile', 'gfe', 'gseis', 'gwall', 'glab'].forEach(m => require('../www/js/' + m + '.js')); const GC = global.GC;
let pass = 0, fail = 0;
function ok(n, c, info) { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && info !== undefined ? ' — ' + info : '')); }
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, acceptDownloads: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(__dirname, '../dist/index.html')); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  ok('Opens with the sample site: 4 layers, 7 SPT readings', await pg.evaluate(() => ISG.P.boreholes[0].layers.length === 4 && document.querySelectorAll('#sptTab tr').length === 8));
  ok('Layers estimated from SPT are marked', (await pg.textContent('#layers')).includes('SPT estimates'));
  /* open a layer and edit it */
  await pg.click('.lay:nth-child(3) .h'); await pg.fill('.lay.open input[data-k=cu]', '45'); await pg.press('.lay.open input[data-k=cu]', 'Tab'); await pg.waitForTimeout(100);
  ok('Edit a layer: cu of the clay saved', await pg.evaluate(() => ISG.P.boreholes[0].layers[2].cu === 45));
  await pg.click('#bUndo'); ok('Undo restores cu = 30', await pg.evaluate(() => ISG.P.boreholes[0].layers[2].cu === 30));
  /* footing */
  await pg.click('[data-t=footing]'); await pg.waitForTimeout(150);
  const res = await pg.textContent('#fRes'), P = await pg.evaluate(() => ISG.P), a = GC.allowable(P, P.footings[0]);
  ok('Footing tab shows the engine\'s allowable pressure', res.includes(String(Math.round(a.qa))), res.slice(0, 200));
  ok('Sample footing is reported as not satisfactory (settlement)', /Settlement too large/.test(res));
  ok('A working width is suggested', /Smallest width that works at this depth: [\d.]+ m/.test(res), res);
  const failTxt = await pg.textContent('#fFail');
  ok('Which part can fail names the soft clay and its settlement share', /soft silty clay/i.test(failTxt) && /% of the settlement/.test(failTxt));
  ok('Bearing capacity steps listed with IS 6403 clauses', (await pg.$$eval('#fSteps li', l => l.length)) >= 7);
  await pg.fill('#fP', '400'); await pg.press('#fP', 'Tab'); await pg.waitForTimeout(150);
  ok('Lower load → satisfactory', /Satisfactory/.test(await pg.textContent('#fRes')));
  /* pressure bulb */
  await pg.click('[data-t=bulb]'); await pg.waitForTimeout(250);
  const px = await pg.evaluate(() => { const c = document.getElementById('bulbCv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  ok('Pressure bulb drawn', px > 20000, px);
  await pg.$eval('#bW', el => { el.value = '3'; el.dispatchEvent(new Event('input')); }); await pg.waitForTimeout(150);
  ok('Width slider tries B = 3 m without saving', (await pg.textContent('#bWl')).includes('3.00 m') && await pg.evaluate(() => ISG.P.footings[0].B === 2));
  await pg.click('#bUse'); ok('"Use this width" saves B = 3 m', await pg.evaluate(() => ISG.P.footings[0].B === 3));
  ok('Stress table by layer', (await pg.$$eval('#bTab tr', t => t.length)) >= 3);
  /* lab */
  await pg.click('[data-t=tests]'); await pg.waitForTimeout(100);
  ok('Lab sample classified SM (silty sand)', /SM/.test(await pg.textContent('#tOut')));
  await pg.fill('#tLL', '30'); await pg.press('#tLL', 'Tab'); await pg.fill('#tPL', '18'); await pg.press('#tPL', 'Tab'); await pg.waitForTimeout(100);
  ok('Adding LL 30, PL 18 (PI 12 above A-line) → SC', /SC/.test(await pg.textContent('#tOut')), await pg.textContent('#tOut'));
  /* piles */
  await pg.click('[data-t=piles]'); await pg.waitForTimeout(200);
  { const Pp = await pg.evaluate(() => ISG.P), c = GC.pileCap(Pp, Pp.piles[0]), t = await pg.textContent('#kRes');
    ok('Piles tab shows the engine\'s safe load', t.includes(String(Math.round(c.Qsafe))), t.slice(0, 160));
    ok('Pile shaft table lists the soft clay with α', /Grey soft silty clay/.test(t) && /α/.test(t));
    ok('Group of 4 piles reported', /4 piles/.test(await pg.textContent('#kGrp')));
    ok('Lateral analysis gives the depth of fixity', /depth of fixity/i.test(await pg.textContent('#kLat')));
    await pg.click('#kNsf label:nth-child(1)'); await pg.waitForTimeout(150);
    ok('Ticking a layer for negative skin friction shows drag', /drag/.test(await pg.textContent('#kRes')) && await pg.evaluate(() => ISG.P.piles[0].nsf.length === 1));
    const [dls] = await Promise.all([pg.waitForEvent('download'), pg.click('#kCsv')]);
    ok('Springs saved as .csv', /_springs\.csv$/.test(dls.suggestedFilename()));
    await pg.click('[data-t=footing]'); await pg.waitForTimeout(150);
    ok('Footing shows the modulus of subgrade reaction', /Modulus of subgrade reaction/.test(await pg.textContent('#fRes'))); }
  /* 2D FE: slope and footing */
  await pg.click('[data-t=fe]'); await pg.waitForTimeout(150);
  await pg.click('#slRun'); await pg.waitForFunction(() => /Factor of safety — finite elements/.test(document.getElementById('slRes').textContent), null, { timeout: 240000 });
  { const t = await pg.textContent('#slRes'), m = t.match(/strength reduction\)([\d.]+)/), b = t.match(/critical circle\)([\d.]+)/);
    ok('Slope: FE and Bishop factors of safety shown and within 10 %', m && b && Math.abs(+m[1] - +b[1]) / +b[1] < 0.1, t.slice(0, 200));
    const px = await pg.evaluate(() => { const c = document.getElementById('slCv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 60 && d[i + 1] < 140 && d[i + 2] < 60) n++; return n; });
    ok('Slip band drawn in orange', px > 200, px); }
  await pg.click('#feMode [data-m=foot]'); await pg.selectOption('#ffMode', 'undrained'); await pg.click('#ffRun');
  await pg.waitForFunction(() => /Collapse pressure/.test(document.getElementById('ffRes').textContent), null, { timeout: 240000 });
  ok('Footing loaded to collapse: FE and IS 6403 values shown', /IS 6403 net ultimate/.test(await pg.textContent('#ffRes')));
  /* background worker available from file:// */
  ok('Analyses run on a background worker', await pg.evaluate(() => new Promise(res => { try { const w = new Worker(URL.createObjectURL(new Blob([GT_ENGINE_SRC], { type: 'text/javascript' }))); w.onmessage = e => res(e.data.type === 'done'); w.onerror = () => res(false); w.postMessage({ id: 1, cmd: 'ping' }); } catch (e) { res(false); } })));
  /* lab tests: other modes */
  await pg.click('[data-t=tests]'); await pg.click('#tMode [data-m=consol]'); await pg.waitForTimeout(150);
  ok('Consolidation test gives Cc and σ′p', /Compression index Cc/.test(await pg.textContent('#ltOut')) && /kPa/.test(await pg.textContent('#ltOut')));
  await pg.selectOption('#ltApply', { index: 3 }); await pg.waitForTimeout(100);
  ok('Consolidation result copied to the clay layer', await pg.evaluate(() => ISG.P.boreholes[0].layers[2].Cc > 0.25 && ISG.P.boreholes[0].layers[2].pc > 0), await pg.evaluate(() => JSON.stringify(ISG.P.boreholes[0].layers[2])));
  for (const m of ['compaction', 'cbr', 'shear', 'triax']) { await pg.click('#tMode [data-m=' + m + ']'); await pg.waitForTimeout(80); ok('Lab test "' + m + '" computes a result', (await pg.$$eval('#ltOut .stat > div', d => d.length)) >= 2); }
  /* earthquake */
  await pg.click('[data-t=seis]'); await pg.waitForTimeout(150);
  ok('Earthquake tab: site class and liquefaction table', /Type I/.test(await pg.textContent('#eqRes')) && (await pg.$$eval('#eqTab tr', t => t.length)) >= 7);
  /* walls */
  await pg.click('[data-t=walls]'); await pg.waitForTimeout(150);
  ok('Wall stability table with IS 14458 checks', (await pg.$$eval('#wlRes table tr', t => t.length)) >= 5);
  await pg.click('#wlSize'); await pg.waitForTimeout(150);
  ok('"Find the smallest base width" makes the wall pass', /Satisfies the IS 14458/.test(await pg.textContent('#wlRes')));
  /* rock */
  await pg.click('[data-t=rock]'); await pg.waitForTimeout(100);
  ok('Rock: RMR and IS 12070 allowable pressure', /Rock mass rating/.test(await pg.textContent('#rkRes')) && /MPa/.test(await pg.textContent('#rkRes')));
  /* library */
  await pg.click('[data-t=lib]'); await pg.click('#libNav [data-k=charts]'); await pg.waitForTimeout(300);
  ok('Library shows 14 reference charts', (await pg.$$eval('#libBody img', i => i.filter(x => x.naturalWidth >= 2000).length)) === 14);
  await pg.click('#libNav [data-k=examples]'); pg.once('dialog', d => d.accept()); await pg.click('[data-ex=liq]'); await pg.waitForTimeout(200);
  ok('Worked example opens (liquefiable sand)', await pg.evaluate(() => /liquefiable/.test(ISG.P.name)));
  await pg.click('[data-t=seis]'); await pg.waitForTimeout(150);
  ok('Example: loose sand liquefies in zone V', /Liquefaction is likely/.test(await pg.textContent('#eqRes')));
  await pg.click('#bUndo'); await pg.waitForTimeout(100);
  /* under-reamed pile */
  await pg.click('[data-t=piles]'); await pg.selectOption('#kType', 'ur'); await pg.waitForTimeout(150);
  ok('Under-reamed pile: formula and Table 1 safe loads', /Table 1/.test(await pg.textContent('#kRes')));
  await pg.selectOption('#kType', 'bored'); await pg.waitForTimeout(100);
  /* plate */
  await pg.click('[data-t=plate]'); await pg.waitForTimeout(100);
  const pt = await pg.textContent('#ptOut'), po = GC.plate(P.plates[0], P);
  ok('Plate test result matches the engine', pt.includes(String(Math.round(po.qa))), pt.slice(0, 160));
  /* report */
  await pg.click('[data-t=report]'); await pg.waitForTimeout(200);
  const rp = await pg.textContent('#rBody');
  ok('Report has the profile, classification, footing and plate test', /soil profile/.test(rp) && /IS 1498/.test(rp) && /Allowable net bearing pressure/.test(rp) && /plate load test/.test(rp) && /bored pile/.test(rp) && /IS 14458/.test(rp) && /Laboratory tests/.test(rp));
  ok('Report carries print-resolution figures', (await pg.$$eval('#rBody img', i => i.filter(x => x.naturalWidth >= 2000).length)) >= 4);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#rSave')]);
  ok('Report saved as .html', /_report\.html$/.test(dl.suggestedFilename()));
  /* project file */
  await pg.click('#bMenu'); const [dl2] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-m=save]')]);
  ok('Project saved as .isg.json', /\.isg\.json$/.test(dl2.suggestedFilename()));
  await pg.reload(); ok('Model kept after reload', await pg.evaluate(() => ISG.P.footings[0].B === 3));
  /* new site from scratch */
  pg.once('dialog', d => d.accept()); await pg.click('#bMenu'); await pg.click('[data-m=new]'); await pg.waitForTimeout(150);
  await pg.click('#lAdd'); await pg.click('#sAdd');
  ok('New site: layer and SPT reading added', await pg.evaluate(() => ISG.P.boreholes[0].layers.length === 2 && ISG.P.boreholes[0].spt.length === 1));
  await pg.click('[data-t=footing]'); await pg.waitForTimeout(150);
  ok('New site footing gives a result', /kPa/.test(await pg.textContent('#fRes')));
  await pg.evaluate(() => { document.documentElement.dataset.th = 'dark'; ISG.refresh(); });
  ok('No JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
