'use strict';

// Breimachine-instellingen. Bij een andere machine pas je deze twee waarden aan.
const NEEDLES_PER_REV = 46;
const PATTERN_ROWS = 40;
const TOTAL_STITCHES = NEEDLES_PER_REV * PATTERN_ROWS;
const STORAGE_KEY = 'stitchlab-pattern-v1';
const RED = 2;
const WHITE = 1;

// matrix[0] = bovenste rij op het scherm, matrix[39] = onderste rij.
// Het Arduino-patroon leest juist van onder naar boven en van rechts naar links.
let matrix = createExample();
let color = RED;
let gridVisible = true;
let drawing = false;
let changedDuringStroke = false;
let undoStack = [];
let redoStack = [];
let toastTimeout;

const $ = (id) => document.getElementById(id);
const canvas = $('patternCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const CELL = 20; // canvas 920x800 -> precies 46 kolommen bij 40 rijen

function blank() {
  return Array.from({ length: PATTERN_ROWS }, () => Array(NEEDLES_PER_REV).fill(WHITE));
}

function createExample() {
  const arr = blank();
  // Demonstratie: een klein, symmetrisch hart. Verwijderbaar met 'Raster leegmaken'.
  for (let y = 0; y < PATTERN_ROWS; y++) {
    for (let x = 0; x < NEEDLES_PER_REV; x++) {
      const X = (x - 22.5) / 14;
      const Y = (17.5 - y) / 10.5;
      const shape = Math.pow(X * X + Y * Y - 1, 3) - X * X * Math.pow(Y, 3);
      if (shape <= 0) arr[y][x] = RED;
    }
  }
  return arr;
}

function clone(m) { return m.map(row => [...row]); }
function recordUndo() {
  undoStack.push(clone(matrix));
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
}
function restoreSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && isValidMatrix(saved.matrix)) matrix = saved.matrix;
  } catch (_) { /* In private modus kan opslag ontbreken. */ }
}
function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({matrix})); } catch (_) {}
  $('editStatus').textContent = '• lokaal bewaard';
}
function isValidMatrix(m) {
  return Array.isArray(m) && m.length === PATTERN_ROWS &&
    m.every(row => Array.isArray(row) && row.length === NEEDLES_PER_REV && row.every(v => v === WHITE || v === RED));
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d9434c';
  for (let y = 0; y < PATTERN_ROWS; y++) {
    for (let x = 0; x < NEEDLES_PER_REV; x++) {
      if (matrix[y][x] === RED) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  if (gridVisible) {
    // Crisp lijnen; iedere vijfde rij/kolom net iets duidelijker.
    for (let x = 0; x <= NEEDLES_PER_REV; x++) {
      ctx.strokeStyle = x % 5 === 0 ? 'rgba(80,102,125,.34)' : 'rgba(89,104,121,.17)';
      ctx.lineWidth = x % 5 === 0 ? 1.3 : 0.7;
      ctx.beginPath();ctx.moveTo(x * CELL + .5, 0);ctx.lineTo(x * CELL + .5, h);ctx.stroke();
    }
    for (let y = 0; y <= PATTERN_ROWS; y++) {
      ctx.strokeStyle = y % 5 === 0 ? 'rgba(80,102,125,.34)' : 'rgba(89,104,121,.17)';
      ctx.lineWidth = y % 5 === 0 ? 1.3 : 0.7;
      ctx.beginPath();ctx.moveTo(0, y * CELL + .5);ctx.lineTo(w, y * CELL + .5);ctx.stroke();
    }
  }
}

function toPatternRows(m = matrix) {
  // Vereiste codeconventie: onderste beeldrij eerst; elke beeldrij rechts-naar-links.
  return [...m].reverse().map(row => [...row].reverse().join(''));
}
function toArduinoCode() {
  const lines = toPatternRows();
  return [
    '// StitchLab - automatisch gegenereerd breipatroon',
    '// Vereist: NEEDLES_PER_REV = 46 moet eerder in de Arduino-code staan.',
    '#pragma once',
    `const int PATTERN_ROWS = ${PATTERN_ROWS};`,
    'const char PATTERN[PATTERN_ROWS][NEEDLES_PER_REV + 1] PROGMEM = {',
    ...lines.map((row, i) => `  "${row}"${i === lines.length - 1 ? '' : ','}`),
    '};',
    ''
  ].join('\n');
}
function refresh() {
  draw();
  let red = 0;
  for (const row of matrix) for (const v of row) if (v === RED) red++;
  $('redCount').textContent = red.toLocaleString('nl-BE');
  $('whiteCount').textContent = (TOTAL_STITCHES - red).toLocaleString('nl-BE');
  $('ratioRed').style.width = `${red / TOTAL_STITCHES * 100}%`;
  $('totalCount').textContent = `${TOTAL_STITCHES.toLocaleString('nl-BE')} steken in totaal · ${Math.round(red / TOTAL_STITCHES * 100)}% rood`;
  const rows = toPatternRows();
  $('codePreview').textContent =
    `const int PATTERN_ROWS = ${PATTERN_ROWS};\n` +
    `const char PATTERN[PATTERN_ROWS][NEEDLES_PER_REV + 1] PROGMEM = {\n` +
    `  "${rows[0]}",\n  "${rows[1]}",\n  "${rows[2]}",\n  // ... nog 37 rijen\n};`;
  $('undoBtn').disabled = !undoStack.length;
  $('redoBtn').disabled = !redoStack.length;
  saveLocal();
}
function coordinates(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / rect.width * NEEDLES_PER_REV);
  const y = Math.floor((e.clientY - rect.top) / rect.height * PATTERN_ROWS);
  if (x < 0 || y < 0 || x >= NEEDLES_PER_REV || y >= PATTERN_ROWS) return null;
  return {x, y};
}
function paint(e) {
  const p = coordinates(e);
  if (!p) return;
  if (matrix[p.y][p.x] !== color) {
    matrix[p.y][p.x] = color;
    changedDuringStroke = true;
    refresh();
  }
  $('cursorStatus').textContent = `Kolom ${p.x + 1} · Rij ${p.y + 1} (vanaf boven)`;
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  drawing = true;
  changedDuringStroke = false;
  recordUndo();
  canvas.setPointerCapture(e.pointerId);
  paint(e);
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  if (drawing) paint(e);
  else {
    const p = coordinates(e);
    if (p) $('cursorStatus').textContent = `Kolom ${p.x + 1} · Rij ${p.y + 1} (vanaf boven)`;
  }
});
function finishStroke() {
  if (!drawing) return;
  drawing = false;
  if (!changedDuringStroke) undoStack.pop();
  refresh();
}
canvas.addEventListener('pointerup', finishStroke);
canvas.addEventListener('pointercancel', finishStroke);
canvas.addEventListener('pointerleave', () => { if (!drawing) $('cursorStatus').textContent = '46 × 40 steken'; });

function setColor(v) {
  color = v;
  $('whiteTool').classList.toggle('active', v === WHITE);
  $('redTool').classList.toggle('active', v === RED);
  $('whiteTool').setAttribute('aria-pressed', String(v === WHITE));
  $('redTool').setAttribute('aria-pressed', String(v === RED));
}
$('whiteTool').onclick = () => setColor(WHITE);
$('redTool').onclick = () => setColor(RED);
$('showGrid').onchange = (e) => {gridVisible = e.target.checked;draw();};

function replaceMatrix(m, message) {recordUndo();matrix = m;refresh();notify(message);}
$('clearBtn').onclick = () => replaceMatrix(blank(), 'Raster leeggemaakt');
$('mirrorBtn').onclick = () => replaceMatrix(matrix.map(row => [...row].reverse()), 'Patroon horizontaal gespiegeld');
$('exampleBtn').onclick = () => replaceMatrix(createExample(), 'Voorbeeldpatroon geladen');
$('undoBtn').onclick = () => {
  if (!undoStack.length) return;
  redoStack.push(clone(matrix));
  matrix = undoStack.pop();refresh();
};
$('redoBtn').onclick = () => {
  if (!redoStack.length) return;
  undoStack.push(clone(matrix));
  matrix = redoStack.pop();refresh();
};

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    (e.shiftKey ? $('redoBtn') : $('undoBtn')).click();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();$('redoBtn').click();
  } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key === '1') setColor(WHITE);
  else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key === '2') setColor(RED);
});

function download(filename, text, type) {
  const file = new Blob([text], {type});
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;anchor.download = filename;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('downloadBtn').onclick = () => {
  download('pattern.h', toArduinoCode(), 'text/plain;charset=utf-8');
  notify('Arduino-code als pattern.h gedownload');
};
$('saveBtn').onclick = () => {
  download('stitchlab-project.json', JSON.stringify({format:'stitchlab-v1', needles: NEEDLES_PER_REV, rows: PATTERN_ROWS, matrix}, null, 2), 'application/json');
  notify('Projectbestand opgeslagen');
};
$('copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(toArduinoCode()); notify('PATTERN gekopieerd naar klembord'); }
  catch (_) { notify('Kopiëren niet mogelijk; download pattern.h'); }
};
$('imageBtn').onclick = () => $('imageInput').click();
$('jsonBtn').onclick = () => $('jsonInput').click();
$('jsonInput').onchange = async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    if (obj.format !== 'stitchlab-v1' || !isValidMatrix(obj.matrix)) throw new Error('Verkeerd bestandsformaat');
    replaceMatrix(obj.matrix, 'Projectbestand geladen');
  } catch(err) {notify(`Ongeldig projectbestand: ${err.message}`);}
  e.target.value = '';
};
$('imageInput').onchange = async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  try {
    const bmp = await createImageBitmap(file);
    // Gebruik de gemiddelde kleur per steekcel. Behoud de beeldverhouding met witte marges.
    const SCALE = 8;
    const offscreen = document.createElement('canvas');
    offscreen.width = NEEDLES_PER_REV * SCALE;
    offscreen.height = PATTERN_ROWS * SCALE;
    const g = offscreen.getContext('2d', {willReadFrequently: true});
    g.fillStyle = '#fff';g.fillRect(0,0,offscreen.width,offscreen.height);
    const scale = Math.min(offscreen.width / bmp.width, offscreen.height / bmp.height);
    const width = bmp.width * scale, height = bmp.height * scale;
    g.drawImage(bmp, (offscreen.width - width)/2, (offscreen.height - height)/2, width, height);
    const pixels = g.getImageData(0,0,offscreen.width,offscreen.height).data;
    const m = blank();
    for (let y=0;y<PATTERN_ROWS;y++) for (let x=0;x<NEEDLES_PER_REV;x++) {
      let sum = 0;
      for(let dy=0;dy<SCALE;dy++) for(let dx=0;dx<SCALE;dx++) {
        const i=((y*SCALE+dy)*offscreen.width+x*SCALE+dx)*4;
        sum += .2126*pixels[i] + .7152*pixels[i+1] + .0722*pixels[i+2];
      }
      // Pixels met gemiddelde helderheid < 205 worden rood.
      m[y][x] = sum/(SCALE*SCALE)<205 ? RED : WHITE;
    }
    bmp.close();
    replaceMatrix(m, 'Afbeelding omgezet naar 46 × 40 steken');
  } catch (err) { notify('Afbeelding kon niet worden geopend'); }
  e.target.value = '';
};
function notify(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
}
restoreSaved();
refresh();
