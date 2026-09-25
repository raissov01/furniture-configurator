/**
 * Базис скриптінің ДЕНЕСІ (ES5 JavaScript, Базистің ішінде орындалады).
 *
 * Ережелер:
 *  - Тек ES5 (`var`, `function`): Базистің ескі нұсқалары да оқысын.
 *  - Код жолдарында тек ASCII; мәтіндер `MSG`-та (`\uXXXX`), комментарий тек
 *    жеке `//` жолында — ескі Базис CP1251 деп оқыса да, код бұзылмайды.
 *  - Шын Базисте ТЕКСЕРІЛМЕГЕН API бөлшегінің бәрі `adapter*` функцияларында.
 *    Әрқайсысының үстінде дәлелдің деңгейі жазылған (manual / example / types).
 *  - Үнсіз `catch` жоқ: әр қате audit-тың `errors` тізіміне жазылады.
 *
 * Тек `bazis.d.ts`-те бар атаулар (+ `BASIS_API_FROM_EXAMPLES`) қолданылады —
 * мұны `tests/basisScript.test.ts` тексереді.
 */
export const BASIS_SCRIPT_BODY = String.raw`// ===== BODY =====
// Скрипт денесі. Деректер жоғарыда: DATA (жоба), MSG (мәтіндер).

var SETTINGS_FILE = 'furniture-configurator-basis.xml';
// Контур элементін біздің жаққа сәйкестендіру шегі, мм.
var MATCH_TOL = 1.5;
var TOL = DATA.tolerance;

// ============================================================================
// АДАПТЕРЛЕР / АДАПТЕРЫ. Шын Базисте тексерілмеген бәрі осында.
// Непроверенные на живом Базисе детали API — только здесь.
// ============================================================================

// A1. Панель құру. Дәлел: manual (Script.pdf, AddFrontPanel/AddHorizPanel/
// AddVertPanel) + example (Aventos HF, Стеллаж): қалыңдық нормаль осі бойымен
// ОҢ жаққа өседі (оң бүйір = Right - Thickness, крышка = Top - Thickness).
function adapterMakePanel(p) {
  var a = p.min;
  var b = p.max;
  if (p.normal === 'x') {
    return AddVertPanel(a[2], a[1], b[2], b[1], a[0]);
  }
  if (p.normal === 'y') {
    return AddHorizPanel(a[0], a[2], b[0], b[2], a[1]);
  }
  return AddFrontPanel(a[0], a[1], b[0], b[1], a[2]);
}

// A2. Текстура бағыты. Дәлел: example (Aventos HF): бүйір мен арт = Vertical
// (Y бойымен), дно мен полка = Horizontal (X бойымен). Болжам: Horizontal =
// Add*Panel шақыруының БІРІНШІ координатасы (AddVertPanel-де Z).
function adapterTexture(p) {
  if (!p.grain) {
    return TextureOrientation.None;
  }
  var first = p.normal === 'x' ? 'z' : 'x';
  return p.grain === first ? TextureOrientation.Horizontal : TextureOrientation.Vertical;
}

// A3. Жақтың контур элементін табу. Дәлел: types (Contour.Objects, IsLine,
// AsLine, Pos1/Pos2, ToGlobal). Контурдың реті құжатталмаған, сондықтан индекс
// БОЛЖАНБАЙДЫ: элементтің ортасы әлемге аударылып, біздің жақпен салыстырылады.
function adapterButtElem(panel, p, mid) {
  var best = -1;
  var bestD = MATCH_TOL;
  var n = panel.Contour.Count;
  for (var i = 0; i < n; i++) {
    var el = panel.Contour.Objects[i];
    if (!el.IsLine()) {
      continue;
    }
    var ln = el.AsLine();
    var g = panel.ToGlobal(NewVector((ln.Pos1.x + ln.Pos2.x) / 2, (ln.Pos1.y + ln.Pos2.y) / 2, 0));
    var d = planeDistance([g.x, g.y, g.z], mid, p.normal);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// A4. Кромка + ClipPanel. Дәлел: example (AddButt(ScriptButtProperty, index)),
// types (PanelButt.ClipPanel). ClipPanel = true тек шегерілетін кромкада:
// сонда Базистің рез өлшемі біздікімен бірдей.
function adapterAddButt(panel, prop, elem, clip) {
  var butt = panel.AddButt(prop, elem);
  if (butt) {
    butt.ClipPanel = clip;
  }
  return butt;
}

// A5. Крепеж қою. Дәлел: manual + example (Aventos HF: Евровинт.Value.Mount(
// Полка, Бок, x, y, z) — 1-панель бұранда торцына кіретін деталь; Ручка
// Mount1(panel, x, y, z, angle)). Нүкте = буын жазықтығындағы нүкте.
// Mount1-дің бұрышы (angle) нені есептейтіні құжатталмаған — 0 беріледі.
function adapterMount(fur, f, P) {
  var x = f.point[0];
  var y = f.point[1];
  var z = f.point[2];
  if (f.mount === 'pair') {
    return fur.Mount(P[f.panels[0]], P[f.panels[1]], x, y, z);
  }
  return fur.Mount1(P[f.panels[0]], x, y, z, 0);
}

// A6. Таңдау жасалды ма. Дәлел: types (ScriptFurnitureProperty.Value,
// ScriptButtProperty.Thickness). Бос мәннің түрі құжатталмаған.
function adapterFurnitureChosen(prop) {
  return !!prop && !!prop.Value;
}
function adapterButtChosen(prop) {
  return !!prop && prop.Thickness > 0;
}

// A7. Базис есептеген тесіктерді оқу. Дәлел: ТЕК example («Работа с объектом
// для сверления отверстий»: fastenerOperations.NewHoleDrilling, AddBody,
// AddFasteners, DrillHoles, Bodies.FindBodyInfo, Holes.Items[i].Diameter/
// Depth/Fastener). Тесіктің ОРНЫ мысалда жоқ — сондықтан тесіктің барлық
// қасиеті рефлексиямен жазылады (reflect), ал салыстырушы векторларды өзі іздейді.
function adapterReadHoles(P, audit) {
  var out = { available: false, api: 'fastenerOperations.NewHoleDrilling', perPanel: [] };
  if (typeof fastenerOperations === 'undefined' || !fastenerOperations.NewHoleDrilling) {
    out.error = 'fastenerOperations.NewHoleDrilling not available';
    return out;
  }
  var model = (typeof currentFileData !== 'undefined' && currentFileData.model) ? currentFileData.model : Model;
  var hd = fastenerOperations.NewHoleDrilling();
  for (var i = 0; i < P.length; i++) {
    if (P[i]) {
      step(audit, 'holes.AddBody#' + i, function (k) { return function () { hd.AddBody(P[k]); }; }(i));
    }
  }
  step(audit, 'holes.AddFasteners', function () { hd.AddFasteners(model); });
  if (!step(audit, 'holes.DrillHoles', function () { hd.DrillHoles(); })) {
    out.error = 'DrillHoles failed';
    return out;
  }
  out.available = true;
  for (var j = 0; j < P.length; j++) {
    if (!P[j]) {
      continue;
    }
    var entry = { panel: j, holes: [] };
    step(audit, 'holes.FindBodyInfo#' + j, function (k, e) { return function () {
      var info = hd.Bodies.FindBodyInfo(P[k]);
      for (var h = 0; h < info.Holes.Count; h++) {
        var hole = info.Holes.Items[h];
        var fast = hole.Fastener;
        e.holes.push({
          diameter: num(hole.Diameter),
          depth: num(hole.Depth),
          fastenerName: fast ? String(fast.Name) : null,
          fastenerUid: fast ? safeGet(fast, 'UID') : null,
          props: reflect(hole)
        });
      }
    }; }(j, entry));
    out.perPanel.push(entry);
  }
  return out;
}

// A8. Файл жазу. Дәлел: types (system.writeTextFile «устарело, используйте
// fs.writeFileSync») + example (Замена материала.js: require('fs')).
function adapterWriteText(path, text) {
  if (typeof require === 'function') {
    var fs = require('fs');
    if (fs && fs.writeFileSync) {
      fs.writeFileSync(path, text);
      return 'fs.writeFileSync';
    }
  }
  system.writeTextFile(path, text);
  return 'system.writeTextFile';
}

// A9. Файлдың орны. Дәлел: manual (Action.ModelFilename, system.askFileNameSave).
// 1) сақталған модельдің қалтасы; 2) пайдаланушы таңдайды; 3) скрипттің қалтасы
// (салыстырмалы атау — Prop.Save(SETTINGS_FILE) сияқты, example: Aventos HF).
function adapterAuditBase(audit) {
  var name = safeFileName(DATA.project) + '-bazis-audit';
  var model = '';
  step(audit, 'audit.ModelFilename', function () { model = String(Action.ModelFilename || ''); });
  var cut = Math.max(model.lastIndexOf('\\'), model.lastIndexOf('/'));
  if (cut >= 0) {
    return { base: model.slice(0, cut + 1) + name, where: 'model' };
  }
  var chosen = '';
  step(audit, 'audit.askFileNameSave', function () { chosen = String(system.askFileNameSave('json') || ''); });
  if (chosen) {
    return { base: chosen.replace(/\.json$/i, ''), where: 'chosen' };
  }
  return { base: name, where: 'script-folder' };
}

// ============================================================================
// Көмекшілер
// ============================================================================

function num(v) {
  return typeof v === 'number' ? Math.round(v * 1000) / 1000 : null;
}
function vec(v) {
  if (!v || typeof v.x !== 'number') {
    return null;
  }
  return [num(v.x), num(v.y), num(v.z)];
}
function errText(e) {
  return (e && e.message) ? String(e.message) : String(e);
}
function safeGet(obj, key) {
  var v = obj[key];
  return (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') ? v : null;
}
function safeFileName(s) {
  return String(s).replace(/[\\\/:*?"<>|]/g, '_');
}
function planeDistance(g, mid, normal) {
  var ax = ['x', 'y', 'z'];
  var s = 0;
  for (var k = 0; k < 3; k++) {
    if (ax[k] !== normal) {
      s += (g[k] - mid[k]) * (g[k] - mid[k]);
    }
  }
  return Math.sqrt(s);
}
function dominant(v) {
  if (!v) {
    return null;
  }
  var a = [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];
  var m = Math.max(a[0], a[1], a[2]);
  return ['x', 'y', 'z'][a.indexOf(m)];
}
function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]));
}
function count(map, key, n) {
  map[key] = (map[key] || 0) + n;
}
function kindLabel(id) {
  for (var i = 0; i < DATA.kinds.length; i++) {
    if (DATA.kinds[i].id === id) {
      return DATA.kinds[i].label;
    }
  }
  return id;
}

// Бір қадамды орындау: қате бүкіл audit-ты тоқтатпайды, тізімге жазылады.
function step(audit, name, fn) {
  try {
    fn();
    return true;
  } catch (e) {
    audit.errors.push({ step: name, error: errText(e) });
    return false;
  }
}

// Объектінің қарапайым қасиеттері (сан, жол, логикалық, вектор). Шын API-ді
// тестерден білу үшін: атауы белгісіз өрістер де JSON-ға түседі.
function reflect(obj) {
  var out = {};
  var n = 0;
  for (var key in obj) {
    if (n >= 80) {
      break;
    }
    n++;
    try {
      var v = obj[key];
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
        out[key] = v;
      } else if (v && typeof v === 'object' && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number') {
        out[key] = [num(v.x), num(v.y), num(v.z)];
      }
    } catch (e) {
      out[key] = '!error: ' + errText(e);
    }
  }
  return out;
}

// ============================================================================
// Қасиеттер панелі: сәйкестендіру бір рет таңдалып, XML-ге сақталады.
// ============================================================================

var Prop = Action.Properties;
var AlwaysAsk = Prop.NewBool(MSG.alwaysAsk);
var WriteAudit = Prop.NewBool(MSG.writeAudit);
WriteAudit.Value = true;
var FurnGroup = Prop.NewGroup(MSG.fastenersGroup);
var furnProps = {};
for (var ki = 0; ki < DATA.kinds.length; ki++) {
  furnProps[DATA.kinds[ki].id] = FurnGroup.NewFurniture(DATA.kinds[ki].label);
}
var ButtGroup = Prop.NewGroup(MSG.buttsGroup);
var buttProps = {};
for (var bi = 0; bi < DATA.bands.length; bi++) {
  buttProps[DATA.bands[bi].id] = ButtGroup.NewButt(DATA.bands[bi].label);
}
var BuildBtn = Prop.NewButton(MSG.build);
BuildBtn.OnClick = function () {
  runBuild();
};
Prop.Load(SETTINGS_FILE);

var built = false;

function usedKinds() {
  var used = {};
  for (var i = 0; i < DATA.fasteners.length; i++) {
    if (!DATA.fasteners[i].skip) {
      used[DATA.fasteners[i].kind] = true;
    }
  }
  return used;
}

function missingMappings() {
  var out = [];
  var used = usedKinds();
  for (var i = 0; i < DATA.kinds.length; i++) {
    var k = DATA.kinds[i].id;
    if (used[k] && !adapterFurnitureChosen(furnProps[k])) {
      out.push(DATA.kinds[i].label);
    }
  }
  for (var j = 0; j < DATA.bands.length; j++) {
    if (!adapterButtChosen(buttProps[DATA.bands[j].id])) {
      out.push(DATA.bands[j].label);
    }
  }
  return out;
}

Action.OnStart = function () {
  var missing = missingMappings();
  if (!AlwaysAsk.Value && missing.length === 0) {
    runBuild();
    return;
  }
  alert(MSG.firstRun + (missing.length ? '\n\n' + MSG.missing + '\n' + missing.join('\n') : ''));
};
Action.Continue();

function runBuild() {
  if (built) {
    return;
  }
  built = true;
  Prop.Save(SETTINGS_FILE);
  var audit = newAudit();
  var R = build(audit);
  var text = formatReport(R);
  if (WriteAudit.Value) {
    runAudit(audit, R);
    text += '\n\n' + auditSummaryText(audit);
    text += '\n\n' + (audit.saved ? MSG.auditSaved + '\n' + audit.saved.join('\n') : MSG.auditFailed + ': ' + audit.saveError);
  }
  system.log(text);
  alert(text);
  Action.Finish();
}

// ============================================================================
// Құру
// ============================================================================

function build(audit) {
  var R = {
    panels: 0, skippedPanels: [], placed: {}, unmapped: {}, unmappedPanels: {}, failed: [],
    skippedFasteners: [], edgeMissing: {}, edgeUnmatched: [], notes: [],
    P: [], F: [], buttSides: []
  };
  for (var n = 0; n < DATA.nodes.length; n++) {
    step(audit, 'BeginBlock#' + n, function (k) { return function () { BeginBlock(DATA.nodes[k].name); }; }(n));
    for (var i = 0; i < DATA.panels.length; i++) {
      if (DATA.panels[i].node === n) {
        R.P[i] = buildPanel(DATA.panels[i], i, R, audit);
      }
    }
    for (var j = 0; j < DATA.fasteners.length; j++) {
      if (DATA.fasteners[j].node === n) {
        R.F[j] = placeFastener(DATA.fasteners[j], j, R, audit);
      }
    }
    step(audit, 'EndBlock#' + n, function () { EndBlock(); });
  }
  return R;
}

function buildPanel(p, index, R, audit) {
  R.buttSides[index] = {};
  if (p.skip) {
    R.skippedPanels.push(p.name + ': ' + p.skip);
    return null;
  }
  var panel = null;
  var ok = step(audit, 'panel#' + index, function () {
    ActiveMaterial.Make(p.material, p.thickness);
    panel = adapterMakePanel(p);
    panel.Name = p.name;
    panel.TextureOrientation = adapterTexture(p);
  });
  if (!ok || !panel) {
    R.failed.push(p.name + ': panel');
    return null;
  }
  for (var e = 0; e < p.edges.length; e++) {
    var edge = p.edges[e];
    var prop = buttProps[edge.bandId];
    if (!adapterButtChosen(prop)) {
      count(R.edgeMissing, edge.band, 1);
      continue;
    }
    var elem = -1;
    step(audit, 'butt#' + index + '.' + edge.side, function () {
      elem = adapterButtElem(panel, p, edge.mid);
      if (elem >= 0) {
        adapterAddButt(panel, prop, elem, edge.clip);
      }
    });
    if (elem < 0) {
      R.edgeUnmatched.push(p.name + ' ' + edge.side);
    } else {
      R.buttSides[index][elem] = edge.side;
    }
  }
  for (var k = 0; k < p.notes.length; k++) {
    R.notes.push(p.name + ': ' + p.notes[k]);
  }
  step(audit, 'panel.Build#' + index, function () { panel.Build(); });
  R.panels++;
  return panel;
}

function placeFastener(f, index, R, audit) {
  if (f.skip) {
    R.skippedFasteners.push(kindLabel(f.kind) + ': ' + f.skip);
    return null;
  }
  var prop = furnProps[f.kind];
  if (!adapterFurnitureChosen(prop)) {
    count(R.unmapped, f.kind, f.holes.length);
    for (var i = 0; i < f.panels.length; i++) {
      R.unmappedPanels[f.kind + ':' + DATA.panels[f.panels[i]].name] = true;
    }
    return null;
  }
  for (var j = 0; j < f.panels.length; j++) {
    if (!R.P[f.panels[j]]) {
      R.failed.push(kindLabel(f.kind) + ': ' + DATA.panels[f.panels[j]].name + ' not built');
      return null;
    }
  }
  var obj = null;
  var ok = step(audit, 'mount#' + index, function () { obj = adapterMount(prop.Value, f, R.P); });
  if (!ok) {
    R.failed.push(kindLabel(f.kind) + ' @ ' + f.point.join(',') + ': ' + audit.errors[audit.errors.length - 1].error);
    return null;
  }
  if (!obj) {
    R.failed.push(kindLabel(f.kind) + ' @ ' + f.point.join(',') + ': ' + MSG.mountNull);
    return null;
  }
  count(R.placed, f.kind, 1);
  return obj;
}

function formatReport(R) {
  var lines = [MSG.reportTitle + ': ' + DATA.project, ''];
  lines.push(MSG.panelsBuilt + ': ' + R.panels + ' / ' + DATA.panels.length);
  var k;
  var placed = [];
  for (k in R.placed) {
    placed.push(kindLabel(k) + ' = ' + R.placed[k]);
  }
  lines.push(MSG.fastenersPlaced + ': ' + (placed.length ? placed.join('; ') : '0'));
  var un = [];
  for (k in R.unmapped) {
    un.push(kindLabel(k) + ': ' + R.unmapped[k] + ' ' + MSG.holes);
  }
  if (un.length) {
    lines.push('');
    lines.push(MSG.unmapped + ':');
    lines = lines.concat(un);
    var where = [];
    for (k in R.unmappedPanels) {
      where.push(k);
    }
    lines.push('  ' + where.slice(0, 15).join(', ') + (where.length > 15 ? ' ' + MSG.more + ' ' + (where.length - 15) : ''));
  }
  appendList(lines, MSG.panelsSkipped, R.skippedPanels);
  appendList(lines, MSG.fastenersSkipped, R.skippedFasteners);
  appendList(lines, MSG.failed, R.failed);
  var em = [];
  for (k in R.edgeMissing) {
    em.push(k + ': ' + R.edgeMissing[k]);
  }
  appendList(lines, MSG.edgeNotChosen, em);
  appendList(lines, MSG.edgeNotMatched, R.edgeUnmatched);
  appendList(lines, MSG.notes, R.notes);
  return lines.join('\n');
}

function appendList(lines, title, list) {
  if (!list.length) {
    return;
  }
  lines.push('');
  lines.push(title + ' (' + list.length + '):');
  for (var i = 0; i < list.length && i < 20; i++) {
    lines.push('  ' + list[i]);
  }
  if (list.length > 20) {
    lines.push('  ' + MSG.more + ' ' + (list.length - 20));
  }
}

// ============================================================================
// AUDIT: Базис не құрғанын қайта оқып, біз күткенмен салыстыру.
// ============================================================================

function newAudit() {
  return {
    format: 'furniture-configurator.basis-audit',
    version: 1,
    project: DATA.project,
    order: DATA.order,
    runAt: new Date().toISOString(),
    tolerance: TOL,
    environment: {},
    mapping: { kinds: [], bands: [] },
    panels: [],
    fasteners: [],
    holes: null,
    comparison: null,
    errors: [],
    expected: DATA
  };
}

function runAudit(audit, R) {
  step(audit, 'environment', function () { audit.environment = readEnvironment(); });
  step(audit, 'mapping', function () { audit.mapping = readMapping(R); });
  for (var i = 0; i < DATA.panels.length; i++) {
    audit.panels.push(readPanel(i, R, audit));
  }
  for (var j = 0; j < DATA.fasteners.length; j++) {
    audit.fasteners.push(readFastener(j, R, audit));
  }
  step(audit, 'holes', function () { audit.holes = adapterReadHoles(R.P, audit); });
  step(audit, 'compare', function () { audit.comparison = compare(audit); });
  saveAudit(audit);
}

function readEnvironment() {
  var env = { date: new Date().toISOString(), globals: {} };
  env.systemApiVersion = typeof system.apiVersion === 'number' ? system.apiVersion : null;
  env.developerApiVersion = typeof system.developerApiVersion === 'number' ? system.developerApiVersion : null;
  if (typeof apiVersion !== 'undefined' && apiVersion.GetScriptApiVersion) {
    env.scriptApiVersion = apiVersion.GetScriptApiVersion();
  }
  env.globals.AddVertPanel = typeof AddVertPanel;
  env.globals.AddHorizPanel = typeof AddHorizPanel;
  env.globals.AddFrontPanel = typeof AddFrontPanel;
  env.globals.NewForm = typeof NewForm;
  env.globals.Model = typeof Model;
  env.globals.fastenerOperations = typeof fastenerOperations;
  env.globals.currentFileData = typeof currentFileData;
  env.globals.objects3d = typeof objects3d;
  env.globals.require = typeof require;
  env.modelFilename = String(Action.ModelFilename || '');
  return env;
}

function readMapping(R) {
  var m = { kinds: [], bands: [] };
  for (var i = 0; i < DATA.kinds.length; i++) {
    var id = DATA.kinds[i].id;
    var sample = null;
    for (var j = 0; j < DATA.fasteners.length; j++) {
      if (DATA.fasteners[j].kind === id && R.F[j]) {
        sample = String(R.F[j].Name);
        break;
      }
    }
    m.kinds.push({ kind: id, chosen: adapterFurnitureChosen(furnProps[id]), sampleName: sample });
  }
  for (var b = 0; b < DATA.bands.length; b++) {
    var bp = buttProps[DATA.bands[b].id];
    m.bands.push({ bandId: DATA.bands[b].id, chosen: adapterButtChosen(bp), thickness: bp ? num(bp.Thickness) : null, width: bp ? num(bp.Width) : null });
  }
  return m;
}

function readPanel(i, R, audit) {
  var p = DATA.panels[i];
  var out = { index: i, id: p.panelId, name: p.name, created: !!R.P[i], skip: p.skip };
  var panel = R.P[i];
  if (!panel) {
    return out;
  }
  var a = {};
  step(audit, 'read.panel#' + i, function () {
    a.name = String(panel.Name);
    a.uid = safeGet(panel, 'UID');
    a.material = String(panel.MaterialName);
    a.thickness = num(panel.Thickness);
    a.contourWidth = num(panel.ContourWidth);
    a.contourHeight = num(panel.ContourHeight);
    a.gsize = vec(panel.GSize);
    a.gabMin = vec(panel.GabMin);
    a.gabMax = vec(panel.GabMax);
    a.position = vec(panel.Position);
    a.axisZ = vec(panel.NToGlobal(AxisZ));
    a.textureOrientation = num(panel.TextureOrientation);
  });
  a.butts = [];
  step(audit, 'read.butts#' + i, function () {
    for (var b = 0; b < panel.Butts.Count; b++) {
      var butt = panel.Butts.Butts[b];
      a.butts.push({
        elem: num(butt.ElemIndex),
        side: R.buttSides[i][butt.ElemIndex] || null,
        material: String(butt.Material),
        thickness: num(butt.Thickness),
        clip: !!butt.ClipPanel,
        sign: String(butt.Sign)
      });
    }
  });
  step(audit, 'read.expectedLocal#' + i, function () {
    a.expectedLocal = [];
    for (var f = 0; f < DATA.fasteners.length; f++) {
      var holes = DATA.fasteners[f].holes;
      for (var h = 0; h < holes.length; h++) {
        if (holes[h].panel === i) {
          var w = holes[h].point;
          a.expectedLocal.push({ fastener: f, drill: holes[h].drill, local: vec(panel.ToObject(NewVector(w[0], w[1], w[2]))) });
        }
      }
    }
  });
  step(audit, 'read.props#' + i, function () { a.props = reflect(panel); });
  out.actual = a;
  return out;
}

function readFastener(j, R, audit) {
  var f = DATA.fasteners[j];
  var out = { index: j, kind: f.kind, mounted: !!R.F[j], skip: f.skip, chosen: adapterFurnitureChosen(furnProps[f.kind]) };
  var obj = R.F[j];
  if (!obj) {
    return out;
  }
  var a = {};
  step(audit, 'read.fastener#' + j, function () {
    a.name = String(obj.Name);
    a.uid = safeGet(obj, 'UID');
    a.position = vec(obj.Position);
    a.gabMin = vec(obj.GabMin);
    a.gabMax = vec(obj.GabMax);
    a.axisZ = vec(obj.NToGlobal(AxisZ));
  });
  step(audit, 'read.fastened#' + j, function () {
    var list = obj.FindFastenedObjects();
    a.fastened = [];
    for (var k = 0; k < list.length; k++) {
      a.fastened.push(panelIndexOf(list[k], R));
    }
  });
  out.actual = a;
  return out;
}

function panelIndexOf(obj, R) {
  for (var i = 0; i < R.P.length; i++) {
    if (R.P[i] && (R.P[i] === obj || (safeGet(obj, 'UID') !== null && safeGet(R.P[i], 'UID') === safeGet(obj, 'UID')))) {
      return i;
    }
  }
  return -1;
}

// ---- салыстыру ----

function problem(list, kind, where, field, expected, actual) {
  var delta = (typeof expected === 'number' && typeof actual === 'number') ? Math.round((actual - expected) * 1000) / 1000 : null;
  list.push({ status: kind, where: where, field: field, expected: expected, actual: actual, delta: delta });
}

function near(a, b) {
  return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= TOL;
}

function compare(audit) {
  var c = { tolerance: TOL, panels: [], fasteners: [], holes: [], summary: { ok: 0, mismatch: 0, missing: 0, extra: 0, skipped: 0, notSent: 0 } };
  for (var i = 0; i < audit.panels.length; i++) {
    c.panels.push(comparePanel(audit.panels[i], c.summary));
  }
  for (var j = 0; j < audit.fasteners.length; j++) {
    c.fasteners.push(compareFastener(audit.fasteners[j], c.summary));
  }
  compareHoles(audit, c);
  return c;
}

function statusOf(problems, summary) {
  if (!problems.length) {
    summary.ok++;
    return 'OK';
  }
  summary.mismatch++;
  return 'MISMATCH';
}

function comparePanel(r, summary) {
  var p = DATA.panels[r.index];
  var where = 'panel#' + r.index + ' ' + p.name;
  if (p.skip) {
    summary.skipped++;
    return { index: r.index, status: 'SKIPPED', reason: p.skip, problems: [] };
  }
  if (!r.created || !r.actual) {
    summary.missing++;
    return { index: r.index, status: 'MISSING', problems: [] };
  }
  var a = r.actual;
  var pr = [];
  if (!near(a.thickness, p.thickness)) {
    problem(pr, 'MISMATCH', where, 'thickness', p.thickness, a.thickness);
  }
  var eSize = [p.finishedLength, p.finishedWidth].sort(function (x, y) { return x - y; });
  var aSize = [a.contourWidth, a.contourHeight].sort(function (x, y) { return x - y; });
  if (!near(aSize[0], eSize[0]) || !near(aSize[1], eSize[1])) {
    problem(pr, 'MISMATCH', where, 'size', eSize.join('x'), aSize.join('x'));
  }
  var ax = ['x', 'y', 'z'];
  for (var k = 0; k < 3; k++) {
    if (a.gabMin && !near(a.gabMin[k], p.min[k])) {
      problem(pr, 'MISMATCH', where, 'gabMin.' + ax[k], p.min[k], a.gabMin[k]);
    }
    if (a.gabMax && !near(a.gabMax[k], p.max[k])) {
      problem(pr, 'MISMATCH', where, 'gabMax.' + ax[k], p.max[k], a.gabMax[k]);
    }
  }
  if (a.axisZ && dominant(a.axisZ) !== p.normal) {
    problem(pr, 'MISMATCH', where, 'normal', p.normal, dominant(a.axisZ));
  }
  if (a.material !== p.material) {
    problem(pr, 'MISMATCH', where, 'material', p.material, a.material);
  }
  var bySide = {};
  for (var b = 0; b < (a.butts || []).length; b++) {
    if (a.butts[b].side) {
      bySide[a.butts[b].side] = a.butts[b];
    }
  }
  for (var e = 0; e < p.edges.length; e++) {
    var edge = p.edges[e];
    var got = bySide[edge.side];
    if (!got) {
      problem(pr, 'MISSING', where, 'edge.' + edge.side, edge.thickness, null);
    } else {
      if (!near(got.thickness, edge.thickness)) {
        problem(pr, 'MISMATCH', where, 'edge.' + edge.side + '.thickness', edge.thickness, got.thickness);
      }
      if (got.clip !== edge.clip) {
        problem(pr, 'MISMATCH', where, 'edge.' + edge.side + '.clip', edge.clip, got.clip);
      }
    }
  }
  return { index: r.index, status: statusOf(pr, summary), problems: pr };
}

function compareFastener(r, summary) {
  var f = DATA.fasteners[r.index];
  var where = 'fastener#' + r.index + ' ' + f.kind;
  if (f.skip) {
    summary.skipped++;
    return { index: r.index, status: 'SKIPPED', reason: f.skip, problems: [] };
  }
  if (!r.chosen) {
    summary.notSent++;
    return { index: r.index, status: 'NOT_SENT', problems: [] };
  }
  if (!r.mounted || !r.actual) {
    summary.missing++;
    return { index: r.index, status: 'MISSING', problems: [] };
  }
  var a = r.actual;
  var pr = [];
  if (a.gabMin && a.gabMax) {
    for (var k = 0; k < 3; k++) {
      if (f.point[k] < a.gabMin[k] - TOL || f.point[k] > a.gabMax[k] + TOL) {
        problem(pr, 'MISMATCH', where, 'pointInBox.' + ['x', 'y', 'z'][k], f.point[k], [a.gabMin[k], a.gabMax[k]]);
      }
    }
  }
  if (a.fastened) {
    for (var p = 0; p < f.panels.length; p++) {
      if (a.fastened.indexOf(f.panels[p]) < 0) {
        problem(pr, 'MISMATCH', where, 'fastens', f.panels[p], a.fastened);
      }
    }
  }
  return { index: r.index, status: statusOf(pr, summary), problems: pr };
}

// Тесік: диаметр бойынша жұптау, ал тесіктің қасиеттерінде вектор болса —
// орнын әлем (world) және панель-локал (ToObject) кеңістігінде тексеру.
function compareHoles(audit, c) {
  if (!audit.holes || !audit.holes.available) {
    c.holesAvailable = false;
    return;
  }
  c.holesAvailable = true;
  var actualByPanel = {};
  for (var i = 0; i < audit.holes.perPanel.length; i++) {
    actualByPanel[audit.holes.perPanel[i].panel] = audit.holes.perPanel[i].holes;
  }
  for (var pi = 0; pi < DATA.panels.length; pi++) {
    var p = DATA.panels[pi];
    var panelAudit = audit.panels[pi];
    if (p.skip || !panelAudit || !panelAudit.created) {
      continue;
    }
    var locals = {};
    var el = (panelAudit.actual && panelAudit.actual.expectedLocal) || [];
    for (var l = 0; l < el.length; l++) {
      locals[el[l].fastener + ':' + el[l].drill] = el[l].local;
    }
    var actual = actualByPanel[pi] || [];
    var used = [];
    var wanted = [];
    for (var f = 0; f < DATA.fasteners.length; f++) {
      var fast = DATA.fasteners[f];
      for (var h = 0; h < fast.holes.length; h++) {
        if (fast.holes[h].panel !== pi) {
          continue;
        }
        if (fast.skip) {
          c.summary.skipped++;
        } else if (!audit.fasteners[f] || !audit.fasteners[f].chosen) {
          c.summary.notSent++;
          c.holes.push({ panel: pi, drill: fast.holes[h].drill, fastener: f, status: 'NOT_SENT' });
        } else {
          wanted.push({ f: f, eh: fast.holes[h], m: null });
        }
      }
    }
    // Екі өту: алдымен орны сәйкес келгендер, содан кейін диаметр бойынша.
    for (var pass = 0; pass < 2; pass++) {
      for (var w = 0; w < wanted.length; w++) {
        if (wanted[w].m) {
          continue;
        }
        var m = matchHole(wanted[w].eh, locals[wanted[w].f + ':' + wanted[w].eh.drill], actual, used, pass === 0);
        if (m.index >= 0) {
          used[m.index] = true;
          wanted[w].m = m;
        }
      }
    }
    for (var w2 = 0; w2 < wanted.length; w2++) {
      var eh = wanted[w2].eh;
      var fi = wanted[w2].f;
      var where = 'hole panel#' + pi + ' ' + p.name + ' drill#' + eh.drill + ' ' + DATA.fasteners[fi].kind;
      var mm = wanted[w2].m;
      if (!mm) {
        c.summary.missing++;
        c.holes.push({ panel: pi, drill: eh.drill, fastener: fi, status: 'MISSING', where: where, expected: { diameter: eh.diameter, depth: eh.depth, point: eh.point } });
        continue;
      }
      var got = actual[mm.index];
      var pr = [];
      if (!near(got.diameter, eh.diameter)) {
        problem(pr, 'MISMATCH', where, 'diameter', eh.diameter, got.diameter);
      }
      if (!near(got.depth, eh.depth)) {
        problem(pr, 'MISMATCH', where, 'depth', eh.depth, got.depth);
      }
      if (mm.frame === null && mm.hasVectors) {
        problem(pr, 'MISMATCH', where, 'position', eh.point, mm.nearest);
      }
      c.holes.push({ panel: pi, drill: eh.drill, fastener: fi, actual: mm.index, frame: mm.frame, status: pr.length ? 'MISMATCH' : 'OK', problems: pr });
      if (pr.length) {
        c.summary.mismatch++;
      } else {
        c.summary.ok++;
      }
    }
    for (var x = 0; x < actual.length; x++) {
      if (!used[x]) {
        c.summary.extra++;
        c.holes.push({ panel: pi, actual: x, status: 'EXTRA', where: 'hole panel#' + pi + ' ' + p.name, got: { diameter: actual[x].diameter, depth: actual[x].depth, fastenerName: actual[x].fastenerName } });
      }
    }
  }
}

function matchHole(eh, local, actual, used, positionOnly) {
  var best = { index: -1, frame: null, hasVectors: false, nearest: null, score: 1e9 };
  for (var i = 0; i < actual.length; i++) {
    if (used[i]) {
      continue;
    }
    var a = actual[i];
    var frame = null;
    var nearestD = 1e9;
    for (var key in a.props) {
      var v = a.props[key];
      if (v && v.length === 3 && typeof v[0] === 'number') {
        best.hasVectors = true;
        var dw = dist(v, eh.point);
        var dl = local ? dist(v, local) : 1e9;
        if (dw <= TOL) {
          frame = 'world:' + key;
        } else if (dl <= TOL) {
          frame = 'local:' + key;
        }
        if (Math.min(dw, dl) < nearestD) {
          nearestD = Math.min(dw, dl);
        }
      }
    }
    var dd = typeof a.diameter === 'number' ? Math.abs(a.diameter - eh.diameter) : 99;
    if (frame === null && (positionOnly || dd > 3)) {
      continue;
    }
    var score = (frame ? 0 : 1000) + dd * 10 + (typeof a.depth === 'number' ? Math.abs(a.depth - eh.depth) : 50);
    if (score < best.score) {
      best.score = score;
      best.index = i;
      best.frame = frame;
      best.nearest = nearestD < 1e9 ? Math.round(nearestD * 1000) / 1000 : null;
    }
  }
  return best;
}

function auditSummaryText(audit) {
  var c = audit.comparison;
  if (!c) {
    return MSG.auditSummary + ': ' + MSG.auditFailed;
  }
  var s = c.summary;
  var lines = [MSG.auditSummary + ': ' + s.ok + ' ' + MSG.ok + ', ' + s.mismatch + ' ' + MSG.mismatch + ', ' + s.missing + ' ' + MSG.missingItems + ', ' + s.extra + ' ' + MSG.extra];
  var probs = firstProblems(c, 20);
  for (var i = 0; i < probs.length; i++) {
    lines.push('  ' + probs[i]);
  }
  return lines.join('\n');
}

function firstProblems(c, limit) {
  var out = [];
  var groups = [c.panels, c.fasteners, c.holes];
  for (var g = 0; g < groups.length; g++) {
    for (var i = 0; i < groups[g].length && out.length < limit; i++) {
      var r = groups[g][i];
      if (r.status === 'MISSING' || r.status === 'EXTRA') {
        out.push(r.status + ' ' + (r.where || ('#' + r.index)));
      }
      var pr = r.problems || [];
      for (var k = 0; k < pr.length && out.length < limit; k++) {
        out.push(pr[k].status + ' ' + pr[k].where + ' ' + pr[k].field + ': ' + JSON.stringify(pr[k].expected) + ' -> ' + JSON.stringify(pr[k].actual));
      }
    }
  }
  return out;
}

function saveAudit(audit) {
  var loc = adapterAuditBase(audit);
  audit.location = loc.where;
  audit.saved = [];
  var json = JSON.stringify(audit, null, 1);
  var txt = auditSummaryText(audit);
  var okJson = step(audit, 'write.json', function () { audit.writer = adapterWriteText(loc.base + '.json', json); });
  if (okJson) {
    audit.saved.push(loc.base + '.json');
  } else {
    audit.saveError = audit.errors[audit.errors.length - 1].error;
  }
  var okTxt = step(audit, 'write.txt', function () { adapterWriteText(loc.base + '.txt', txt); });
  if (okTxt) {
    audit.saved.push(loc.base + '.txt');
  }
}
`
