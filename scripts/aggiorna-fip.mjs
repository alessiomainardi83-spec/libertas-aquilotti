// Legge risultati, date e orari degli Aquilotti Big (Girone H) da fip.it e aggiorna l'array G in index.html.
// Tocca solo punteggi, data e ora delle gare già presenti; non aggiunge dati personali.
import fs from 'node:fs';

const BASE = 'https://fip.it/risultati/?group=campionati-regionali&regione_codice=TO&comitato_codice=RTO&sesso=M&codice_campionato=TAQB&codice_fase=1&codice_girone=86422';
const MESI = {gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};
const txt = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();

async function giornata(ar, n) {
  const r = await fetch(`${BASE}&codice_ar=${ar}&giornata=${n}`, {headers: {'User-Agent': 'Mozilla/5.0 (aggiornamento app genitori)'}});
  if (!r.ok) throw new Error(`fip.it ${r.status}`);
  const html = await r.text();
  const out = [];
  for (const blk of html.split('class="results-matches__match"').slice(1)) {
    const names = [...blk.matchAll(/class="team__name">([\s\S]*?)<\/div>/g)].map(m => txt(m[1]));
    const pts = [...blk.matchAll(/class="team__points">([\s\S]*?)<\/div>/g)].map(m => txt(m[1]));
    const date = (blk.match(/class="date">([\s\S]*?)<\/div>/) || [])[1];
    const time = (blk.match(/class="time">([\s\S]*?)<\/div>/) || [])[1];
    const gara = (blk.match(/class="ref"[^>]*>\s*(\d{6})/) || [])[1];
    if (!gara || names.length < 2) continue;
    let data = null;
    const d = date && txt(date).match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (d && MESI[d[2].toLowerCase()]) data = `${d[3]}-${String(MESI[d[2].toLowerCase()]).padStart(2, '0')}-${d[1].padStart(2, '0')}`;
    const ora = time ? (txt(time).match(/\d{1,2}:\d{2}/) || [null])[0] : null;
    const num = pts.map(p => (/^\d+$/.test(p) ? Number(p) : null));
    out.push({gara, data, ora, pc: num.length === 2 ? num[0] : null, po: num.length === 2 ? num[1] : null});
  }
  return out;
}

const file = process.argv[2] || 'index.html';
let html = fs.readFileSync(file, 'utf8');
const fip = new Map();
for (const ar of [1, 0]) for (let n = 1; n <= 7; n++) for (const g of await giornata(ar, n)) fip.set(g.gara, g);
if (fip.size < 20) throw new Error(`troppe poche gare lette da fip.it (${fip.size}): non aggiorno`);

let cambi = 0;
html = html.replace(/\["(\d{6})","(\d{4}-\d{2}-\d{2})","(\d{2}:\d{2})","([A-Z]{3})","([A-Z]{3})","([A-Z]{3})","([^"]+)",(null|\d+),(null|\d+)\]/g,
  (row, gara, data, ora, c, o, pal, gio, pc, po) => {
    const f = fip.get(gara); if (!f) return row;
    const nd = f.data || data, no = f.ora || ora;
    const npc = f.pc != null ? f.pc : (pc === 'null' ? null : Number(pc));
    const npo = f.po != null ? f.po : (po === 'null' ? null : Number(po));
    const nuovo = `["${gara}","${nd}","${no}","${c}","${o}","${pal}","${gio}",${npc},${npo}]`;
    if (nuovo !== row) { cambi++; console.log(`${gara}: ${row} -> ${nuovo}`); }
    return nuovo;
  });
// riordina per data e ora non serve: la pagina ordina da sola
const oggi = new Date().toLocaleDateString('sv-SE', {timeZone: 'Europe/Rome'});
html = html.replace(/const AGGIORNATO = "\d{4}-\d{2}-\d{2}";/, `const AGGIORNATO = "${oggi}";`);
if (/giulio/i.test(html)) throw new Error('la pagina contiene un nome che non deve esserci: non pubblico');
fs.writeFileSync(file, html);
console.log(`gare lette: ${fip.size}, righe cambiate: ${cambi}`);
