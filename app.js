'use strict';

// StitchLab — de visuele matrix wordt van boven naar beneden getekend.
// Arduino-output is juist andersom: onderaan eerst en elke rij rechts -> links.
const NEEDLES = 46;
const MIN_ROWS = 1;
const MAX_ROWS = 200;
const CELL = 20;

let rowCount = 40;
let grid = newGrid(rowCount);
let paintColor = 2;
let pointerDown = false;
let sourceImage = null;
let sourceImageName = '';

const byId = id => document.getElementById(id);
const canvas = byId('patternCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: false });
const rowsInput = byId('rowsInput');

function newGrid(rows) {
  return Array.from({ length: rows }, () => Array(NEEDLES).fill(1));
}

function notify(message, kind = '') {
  const status = byId('statusMessage');
  status.textContent = message;
  status.className = 'status' + (kind ? ' ' + kind : '');
}

function updateLabels() {
  byId('gridDimensions').textContent = `${NEEDLES} × ${rowCount}`;
  byId('canvasLabel').textContent = `${NEEDLES} naalden × ${rowCount} rijen`;
  byId('rowInfo').textContent = rowCount;
  byId('codeRowsLabel').textContent = `${rowCount} rijen`;
  rowsInput.value = rowCount;
}

function renderGrid() {
  canvas.width = NEEDLES * CELL;
  canvas.height = rowCount * CELL;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < rowCount; y++) {
    for (let x = 0; x < NEEDLES; x++) {
      ctx.fillStyle = grid[y][x] === 2 ? '#e8484d' : '#ffffff';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  ctx.beginPath();
  ctx.strokeStyle = '#dce2e9';
  ctx.lineWidth = 0.65;
  for (let x = 0; x <= NEEDLES; x++) {
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, canvas.height);
  }
  for (let y = 0; y <= rowCount; y++) {
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(canvas.width, y * CELL + 0.5);
  }
  ctx.stroke();
}

function getCode() {
  const dataRows = grid.slice().reverse().map(row => `  "${row.slice().reverse().join('')}"`);
  return `const int PATTERN_ROWS = ${rowCount};\n\nconst char PATTERN[PATTERN_ROWS][NEEDLES_PER_REV + 1] PROGMEM =\n{\n${dataRows.join(',\n')}\n};`;
}

function updateCode() {
  byId('codeOutput').textContent = getCode();
}

function refresh() {
  updateLabels();
  renderGrid();
  updateCode();
}

function setRows(n) {
  if (!Number.isInteger(n) || n < MIN_ROWS || n > MAX_ROWS) {
    notify(`Geef een geheel aantal rijen tussen ${MIN_ROWS} en ${MAX_ROWS} op.`, 'error');
    rowsInput.value = rowCount;
    return;
  }
  if (n === rowCount) return;
  if (sourceImage) {
    rowCount = n;
    grid = imageToGrid(sourceImage);
    notify(`Afbeelding opnieuw omgezet naar ${NEEDLES} × ${rowCount} steken.`, 'success');
  } else {
    // Nieuwe lege rijen bovenaan, behoud de bestaande onderste patroonrijen.
    const old = grid;
    const oldCount = rowCount;
    grid = Array.from({ length: n }, (_, y) => {
      const oldY = y - (n - oldCount);
      return oldY >= 0 && oldY < oldCount ? old[oldY].slice() : Array(NEEDLES).fill(1);
    });
    rowCount = n;
    notify(`Aantal rijen: ${rowCount}. Bestaande onderste patroonrijen behouden.`, 'success');
  }
  refresh();
}

function selectColor(n) {
  paintColor = n;
  byId('whiteTool').classList.toggle('selected', n === 1);
  byId('redTool').classList.toggle('selected', n === 2);
  byId('whiteTool').setAttribute('aria-pressed', String(n === 1));
  byId('redTool').setAttribute('aria-pressed', String(n === 2));
}

function atPointer(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / rect.width * NEEDLES);
  const y = Math.floor((e.clientY - rect.top) / rect.height * rowCount);
  if (x < 0 || x >= NEEDLES || y < 0 || y >= rowCount) return null;
  return {x, y};
}

function paintAt(e) {
  const point = atPointer(e);
  if (!point) return;
  const {x, y} = point;
  byId('cursorStatus').textContent = `Naald ${NEEDLES - x} · Rij ${rowCount - y} (Arduino-volgorde)`;
  if (!pointerDown || grid[y][x] === paintColor) return;
  sourceImage = null;
  grid[y][x] = paintColor;
  // Enkel één vakje bijwerken voor vloeiend tekenen.
  ctx.fillStyle = paintColor === 2 ? '#e8484d' : '#ffffff';
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 1, CELL - 1);
  updateCode();
}

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  pointerDown = true;
  canvas.setPointerCapture(e.pointerId);
  paintAt(e);
});
canvas.addEventListener('pointermove', paintAt);
canvas.addEventListener('pointerup', () => { pointerDown = false; });
canvas.addEventListener('pointercancel', () => { pointerDown = false; });
canvas.addEventListener('lostpointercapture', () => { pointerDown = false; });

function imageToGrid(img) {
  const tmp = document.createElement('canvas');
  tmp.width = NEEDLES;
  tmp.height = rowCount;
  const c = tmp.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, NEEDLES, rowCount);
  // Proporties behouden en extra ruimte wit laten, dus geen vervormde foto.
  const scale = Math.min(NEEDLES / img.naturalWidth, rowCount / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  c.drawImage(img, (NEEDLES - w) / 2, (rowCount - h) / 2, w, h);
  const pixels = c.getImageData(0, 0, NEEDLES, rowCount).data;
  const out = newGrid(rowCount);
  for (let y = 0; y < rowCount; y++) {
    for (let x = 0; x < NEEDLES; x++) {
      const i = (y * NEEDLES + x) * 4;
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
      const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // Alle donkere/gekleurde pixels worden kleur 2; lichte pixels kleur 1.
      out[y][x] = brightness < 195 ? 2 : 1;
    }
  }
  return out;
}

async function uploadImage(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    notify('Selecteer een afbeelding zoals PNG of JPG.', 'error');
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Kan afbeelding niet openen.'));
      img.src = url;
    });
    sourceImage = img;
    sourceImageName = file.name;
    grid = imageToGrid(img);
    refresh();
    notify(`Afbeelding “${sourceImageName}” omgezet naar ${NEEDLES} × ${rowCount} steken.`, 'success');
  } catch(err) { notify(err.message, 'error'); }
  finally { URL.revokeObjectURL(url); }
}

function importPattern(text, filename) {
  const match = text.match(/(?:const\s+)?(?:int|uint16_t)\s+PATTERN_ROWS\s*=\s*(\d+)\s*;/);
  const block = text.match(/\bPATTERN\s*\[[^\]]+\]\s*\[[^\]]+\]\s*PROGMEM\s*=\s*\{([\s\S]*?)\}\s*;/);
  if (!match || !block) throw new Error('Geen geldig Arduino PATTERN-blok gevonden.');
  const n = Number(match[1]);
  const exportedRows = [...block[1].matchAll(/"([12]+)"/g)].map(m => m[1]);
  if (n < MIN_ROWS || n > MAX_ROWS || exportedRows.length !== n || exportedRows.some(r => r.length !== NEEDLES)) {
    throw new Error(`In dit bestand moeten exact PATTERN_ROWS rijen met elk ${NEEDLES} tekens (1 of 2) staan.`);
  }
  sourceImage = null;
  rowCount = n;
  grid = exportedRows.reverse().map(row => row.split('').reverse().map(Number));
  refresh();
  notify(`“${filename}” geïmporteerd: ${NEEDLES} naalden × ${rowCount} rijen.`, 'success');
}

function downloadFile(name, text) {
  const blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

byId('whiteTool').addEventListener('click', () => selectColor(1));
byId('redTool').addEventListener('click', () => selectColor(2));
byId('minusRow').addEventListener('click', () => setRows(rowCount - 1));
byId('plusRow').addEventListener('click', () => setRows(rowCount + 1));
rowsInput.addEventListener('change', () => setRows(Number(rowsInput.value)));
rowsInput.addEventListener('keydown', e => { if (e.key === 'Enter') rowsInput.blur(); });
byId('clearButton').addEventListener('click', () => {
  if (!confirm('Wil je de volledige tekening wissen?')) return;
  sourceImage = null;
  grid = newGrid(rowCount);
  refresh();
  notify('Tekening gewist.', 'success');
});
byId('uploadImageButton').addEventListener('click', () => byId('imageInput').click());
byId('uploadPatternButton').addEventListener('click', () => byId('patternInput').click());
byId('imageInput').addEventListener('change', async e => {
  await uploadImage(e.target.files[0]);
  e.target.value = '';
});
byId('patternInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try { importPattern(await file.text(), file.name); }
  catch(err) { notify(err.message, 'error'); }
  e.target.value = '';
});
byId('copyCodeButton').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(getCode());
    notify('Arduino-code gekopieerd. Plak over je bestaande PATTERN_ROWS + PATTERN-blok.', 'success');
  } catch(err) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(byId('codeOutput'));
    selection.removeAllRanges(); selection.addRange(range);
    notify('Selecteer de gemarkeerde code en kopieer met Ctrl+C.', 'error');
  }
});
byId('downloadButton').addEventListener('click', () => {
  downloadFile(`StitchLab_${NEEDLES}x${rowCount}.h`, `// StitchLab patroon: ${NEEDLES} naalden x ${rowCount} rijen\n// Vereist const int NEEDLES_PER_REV = ${NEEDLES}; en #include <avr/pgmspace.h>\n#pragma once\n\n${getCode()}\n`);
  notify(`.h-bestand geëxporteerd voor ${rowCount} rijen.`, 'success');
});

refresh();
