// Downloads one freely licensed photo per landmark from Wikimedia Commons
// (the English Wikipedia lead image) into public/landmarks/, and writes
// public/landmarks/credits.json with author and licence for attribution.
// Usage: node scripts/fetch-photos.mjs [id,id,...]
// Then shrink them for the web: sips -Z 768 -s formatOptions 70 public/landmarks/<id>.jpg
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { FREE_LICENSE } from '../src/credits.js';

const UA = 'breaker3d/1.0 (https://breton5797.github.io/breaker-3d/; landmark backgrounds)';
const OUT = new URL('../public/landmarks/', import.meta.url);
const WIDTH = 1024;

// id -> English Wikipedia article whose lead photo shows the landmark, or an
// explicit Commons 'File:...' when the article's lead image is not on Commons.
export const SOURCES = {
  giza: 'Giza pyramid complex',
  fuji: 'Mount Fuji',
  stonehenge: 'Stonehenge',
  moai: 'Moai',
  liberty: 'Statue of Liberty',
  eiffel: 'Eiffel Tower',
  pisa: 'Leaning Tower of Pisa',
  tajMahal: 'Taj Mahal',
  parthenon: 'Parthenon',
  bigBen: 'Big Ben',
  sungnyemun: 'Namdaemun',
  nSeoulTower: 'File:Namsan Tower, Seoul - Namsan2299.jpg',
  operaHouse: 'Sydney Opera House',
  goldenGate: 'Golden Gate Bridge',
  stBasil: "Saint Basil's Cathedral",
  colosseum: 'Colosseum',
  sphinx: 'Great Sphinx of Giza',
  chichenItza: 'File:Chichen-Itza-Castillo-Seen-From-East.JPG',
  angkorWat: 'Angkor Wat',
  forbiddenCity: 'Forbidden City',
  petra: 'Al-Khazneh',
  machuPicchu: 'Machu Picchu',
  greatWall: 'Great Wall of China',
  sagradaFamilia: 'Sagrada Família',
};

const api = async (host, params) => {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${host} ${res.status}`);
  return res.json();
};
const plain = (html = '') => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function leadImage(title) {
  const j = await api('en.wikipedia.org', { action: 'query', prop: 'pageimages', piprop: 'name', redirects: '1', titles: title });
  const page = Object.values(j.query.pages)[0];
  return page.pageimage ?? null;
}

async function commonsInfo(file) {
  const j = await api('commons.wikimedia.org', {
    action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(WIDTH),
  });
  const page = Object.values(j.query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info) return null; // not on Commons (e.g. a non-free local file)
  const m = info.extmetadata ?? {};
  return {
    thumb: info.thumburl,
    page: info.descriptionurl,
    license: plain(m.LicenseShortName?.value),
    licenseUrl: m.LicenseUrl?.value ?? '',
    artist: plain(m.Artist?.value) || 'Unknown',
  };
}

async function main() {
  const only = process.argv[2]?.split(',');
  await mkdir(OUT, { recursive: true });
  let credits = {};
  if (only) credits = JSON.parse(await readFile(new URL('credits.json', OUT), 'utf8').catch(() => '{}'));
  for (const [id, title] of Object.entries(SOURCES)) {
    if (only && !only.includes(id)) continue;
    const file = title.startsWith('File:') ? title.slice(5) : await leadImage(title);
    const info = file && await commonsInfo(file);
    if (!info || !FREE_LICENSE.test(info.license)) {
      console.log(`SKIP ${id}: ${file ?? 'no image'} (${info?.license ?? 'not on Commons'})`);
      continue;
    }
    const res = await fetch(info.thumb, { headers: { 'User-Agent': UA } });
    if (!res.ok || !/^image\/jpeg/.test(res.headers.get('content-type') ?? '')) {
      console.log(`SKIP ${id}: download ${res.status} ${res.headers.get('content-type')}`);
      continue;
    }
    await writeFile(new URL(`${id}.jpg`, OUT), Buffer.from(await res.arrayBuffer()));
    credits[id] = { file, artist: info.artist, license: info.license, licenseUrl: info.licenseUrl, source: info.page };
    console.log(`OK   ${id}: ${file} — ${info.license} — ${info.artist.slice(0, 60)}`);
  }
  await writeFile(new URL('credits.json', OUT), `${JSON.stringify(credits, null, 2)}\n`);
  await writeFile(new URL('../CREDITS.md', import.meta.url), creditsMarkdown(credits));
}

/** CREDITS.md: one line per photo with author, licence and source (attribution for CC BY / BY-SA). */
function creditsMarkdown(credits) {
  const rows = Object.entries(credits).map(([id, c]) =>
    `| ${id} | [${c.file}](${c.source}) | ${c.artist} | ${c.licenseUrl ? `[${c.license}](${c.licenseUrl})` : c.license} |`);
  return [
    '# Photo credits',
    '',
    'Landmark background photos come from Wikimedia Commons under the licences below.',
    'They were resized (768 px), cropped to the play area and tinted for the sunset/night stages.',
    '',
    '| Landmark | Photo | Author | Licence |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
