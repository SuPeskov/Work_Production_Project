#!/usr/bin/env node
/**
 * scripts/kb-audit.js — проверка целостности базы знаний.
 *
 * Сверяет четыре источника правды, которые в этом проекте приходится
 * править вручную и которые легко рассинхронизировать:
 *   1. реестр операций   — public/js/kb.js (KB_SECTIONS, KB_OPERATIONS)
 *   2. страницы операций — public/pages/operations/X.Y.Z.html
 *   3. списки в разделах — public/pages/<section>.html
 *   4. поисковый индекс  — public/js/search-index.json
 *
 * Запуск:  npm run audit        (или node scripts/kb-audit.js)
 *
 * Ошибки (код возврата 1) — то, что видит пользователь: готовая операция без
 * страницы, расхождение data-op-id/data-op-version, операция без ссылки в
 * списке раздела, ссылка на отсутствующую техкарту PDF, устаревший индекс.
 *
 * Предупреждения — то, что сайт молча скрывает: черновики без страниц
 * (у администратора дают 404), не найденные фото шагов (их скрывает
 * hiding-empty-blocks.js), фотографии, скопированные из другой операции,
 * PDF-файлы, не привязанные ни к одной операции.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const KB_JS_PATH = path.join(PUBLIC_DIR, 'js', 'kb.js');
const OPS_DIR = path.join(PUBLIC_DIR, 'pages', 'operations');
const DOCS_DIR = path.join(PUBLIC_DIR, 'assets', 'docs');
const INDEX_PATH = path.join(PUBLIC_DIR, 'js', 'search-index.json');

const errors = [];
const warnings = [];
const notices = [];

const rel = p => path.relative(PUBLIC_DIR, p).replace(/\\/g, '/');
const err = m => errors.push(m);
const warn = m => warnings.push(m);

/** Компактный список: первые n элементов + «и ещё k». */
function sample(items, n = 6) {
  const head = items.slice(0, n).join(', ');
  return items.length > n ? `${head} и ещё ${items.length - n}` : head;
}

// --- разбор массива-литерала из kb.js -------------------------------------
function extractLiteral(src, name) {
  const start = src.indexOf(`const ${name} = [`);
  if (start === -1) throw new Error(`В kb.js не найден массив ${name}`);
  const from = src.indexOf('[', start);
  let depth = 0, end = -1;
  for (let i = from; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error(`Не закрыт массив ${name}`);
  return Function(`"use strict"; return (${src.slice(from, end + 1)});`)();
}

const kbSrc = fs.readFileSync(KB_JS_PATH, 'utf8');
const sections = extractLiteral(kbSrc, 'KB_SECTIONS');
const operations = extractLiteral(kbSrc, 'KB_OPERATIONS');

const opById = new Map(operations.map(o => [o.id, o]));
const sectionIds = new Set(sections.map(s => s.id));

// --- 1. консистентность реестра -------------------------------------------
for (const op of operations) {
  if (!/^\d+\.\d+\.\d+$/.test(op.id)) err(`реестр: некорректный id «${op.id}»`);
  if (!sectionIds.has(op.section)) err(`${op.id}: раздел «${op.section}» отсутствует в KB_SECTIONS`);
  if (!['ready', 'draft'].includes(op.status)) err(`${op.id}: неизвестный статус «${op.status}»`);
  if (!Number.isInteger(op.version) || op.version < 1) err(`${op.id}: version должна быть целым ≥ 1`);
  if (op.url !== `pages/operations/${op.id}.html`) err(`${op.id}: url «${op.url}» не совпадает с id`);
  if (!op.title || !op.title.trim()) err(`${op.id}: пустой title`);
}

const dupIds = [...new Set(operations.map(o => o.id).filter((id, i, a) => a.indexOf(id) !== i))];
if (dupIds.length) err(`реестр: дубли id — ${dupIds.join(', ')}`);

// --- 2. страницы операций -------------------------------------------------
const pageFiles = fs.readdirSync(OPS_DIR).filter(f => f.endsWith('.html'));
const pageIds = new Set(pageFiles.map(f => f.replace(/\.html$/, '')));
const usedPdfs = new Set();
const imagesMissing = [];
const imagesForeign = [];

for (const op of operations) {
  const file = path.join(OPS_DIR, `${op.id}.html`);
  const exists = fs.existsSync(file);

  if (op.status === 'ready' && !exists) err(`${op.id}: статус ready, но нет pages/operations/${op.id}.html`);
  if (!exists) continue;

  const html = fs.readFileSync(file, 'utf8');
  // Закомментированные блоки (заготовки под будущее наполнение) не считаем:
  // их содержимое пользователю не показывается.
  const live = html.replace(/<!--[\s\S]*?-->/g, '');

  // кнопка «Ознакомлен» должна ссылаться на этот же id и ту же версию
  const idMatch = live.match(/data-op-id\s*=\s*"([^"]*)"/);
  const verMatch = live.match(/data-op-version\s*=\s*"([^"]*)"/);
  if (!idMatch) err(`${op.id}: в странице нет data-op-id`);
  else if (idMatch[1] !== op.id) err(`${op.id}: data-op-id="${idMatch[1]}" ≠ id реестра`);
  if (!verMatch) err(`${op.id}: в странице нет data-op-version`);
  else if (Number(verMatch[1]) !== op.version) {
    err(`${op.id}: data-op-version="${verMatch[1]}" ≠ version=${op.version} в реестре`);
  }

  // техкарты
  for (const m of live.matchAll(/assets\/docs\/([^"'()]+\.pdf)/g)) {
    const name = decodeURI(m[1]);
    usedPdfs.add(name);
    if (!fs.existsSync(path.join(DOCS_DIR, name))) err(`${op.id}: ссылка на отсутствующий PDF «${name}»`);
  }

  // фото шагов
  for (const m of live.matchAll(/src\s*=\s*"([^"]*assets\/images\/operations\/[^"]+)"/g)) {
    const src = m[1];
    const owner = (src.match(/operations\/([\d.]+)\//) || [])[1];
    const abs = path.resolve(OPS_DIR, src);
    const existsImg = fs.existsSync(abs);
    if (owner && owner !== op.id) imagesForeign.push(`${op.id} → ${owner}`);
    else if (!existsImg) imagesMissing.push(rel(abs));
  }
}

for (const id of pageIds) {
  if (!opById.has(id) && id !== 'template') warn(`pages/operations/${id}.html есть, но операции нет в реестре`);
}

// --- 3. списки операций на страницах разделов ----------------------------
const unregisteredIds = [];
const draftsWithoutPage = [];

for (const sec of sections) {
  const pagePath = path.join(PUBLIC_DIR, sec.page);
  if (!fs.existsSync(pagePath)) { err(`раздел ${sec.id}: нет файла ${sec.page}`); continue; }

  const pageName = path.basename(sec.page);
  const html = fs.readFileSync(pagePath, 'utf8');
  const linked = new Set([...html.matchAll(/operations\/(\d+\.\d+\.\d+)\.html/g)].map(m => m[1]));

  for (const id of linked) {
    if (!opById.has(id)) { unregisteredIds.push(id); continue; }
    const op = opById.get(id);
    if (op.section !== sec.id) warn(`${id}: в списке ${pageName}, но в реестре раздел «${op.section}»`);
    if (op.status === 'draft' && !pageIds.has(id)) draftsWithoutPage.push(id);
  }

  for (const op of operations.filter(o => o.section === sec.id)) {
    if (!linked.has(op.id)) err(`${op.id}: нет ссылки в списке ${pageName}`);
  }
}

// Черновики в списках без страниц: остальным ролям аккордеон их скрывает,
// администратору показывает ссылку, ведущую в 404.
if (draftsWithoutPage.length) {
  warn(`Черновиков в списках без страниц (у администратора 404): ${draftsWithoutPage.length} — ${sample(draftsWithoutPage)}`);
}

// Ссылки на операции, которых нет в реестре. Раздел 01 «Заготовка» — заранее
// размеченный скелет (страниц ещё нет), остальное считаем ошибкой.
const planned = [...new Set(unregisteredIds)].filter(id => id.startsWith('1.'));
const broken = [...new Set(unregisteredIds)].filter(id => !id.startsWith('1.'));
if (planned.length) notices.push(`Раздел 01: размечено ${planned.length} операций без записи в реестре и без страниц (скелет)`);
for (const id of broken) err(`ссылка на операцию ${id}, которой нет в реестре`);

// --- 4. поисковый индекс --------------------------------------------------
if (!fs.existsSync(INDEX_PATH)) {
  err('нет public/js/search-index.json — выполните npm run build-index');
} else {
  const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const docs = idx.documents || [];
  const idxOpIds = new Set(docs.filter(d => d.type === 'operation').map(d => d.id));
  const idxSectionIds = new Set(docs.filter(d => d.type === 'section').map(d => d.id));
  const readyIds = new Set(operations.filter(o => o.status === 'ready').map(o => o.id));

  const missing = [...readyIds].filter(id => !idxOpIds.has(id));
  const extra = [...idxOpIds].filter(id => !readyIds.has(id));
  const missingSec = [...sectionIds].filter(id => !idxSectionIds.has(id));

  if (missing.length) err(`индекс устарел: нет готовых операций — ${sample(missing)}`);
  if (extra.length) err(`индекс устарел: содержит неактуальные записи — ${sample(extra)}`);
  if (missingSec.length) err(`индекс: нет разделов — ${missingSec.join(', ')}`);

  notices.push(`Индекс: ${docs.length} документов (${idxOpIds.size} операций + ${idxSectionIds.size} разделов), собран ${idx.generatedAt || 'без метки'}`);
}

// --- 5. PDF и фото --------------------------------------------------------
const pdfFiles = fs.existsSync(DOCS_DIR)
  ? fs.readdirSync(DOCS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'))
  : [];
const unusedPdfs = pdfFiles.filter(f => !usedPdfs.has(f));
if (unusedPdfs.length) warn(`PDF не привязаны ни к одной операции: ${unusedPdfs.length}`);

// Фото без файла сайт молча скрывает (hiding-empty-blocks.js) — битым не считается,
// но шаг остаётся без иллюстрации.
if (imagesMissing.length) {
  warn(`Не найдены фото шагов (блок будет скрыт): ${imagesMissing.length} — ${sample(imagesMissing, 5)}`);
}
// Ссылка на папку другой операции — почти всегда след копирования шаблона.
if (imagesForeign.length) {
  const uniq = [...new Set(imagesForeign)];
  warn(`Фото взяты из папки другой операции: ${uniq.length} — ${sample(uniq, 6)}`);
}

// --- отчёт ----------------------------------------------------------------
const ready = operations.filter(o => o.status === 'ready').length;

console.log('📚 Аудит базы знаний\n');
console.log(`   Операций в реестре: ${operations.length}  (ready: ${ready}, draft: ${operations.length - ready})`);
console.log(`   Разделов: ${sections.length}`);
console.log(`   Страниц операций: ${pageIds.size - 1} (+ template)`);
console.log(`   Техкарт PDF: ${pdfFiles.length}, привязано: ${usedPdfs.size}\n`);

for (const line of notices) console.log(`ℹ️  ${line}`);

if (warnings.length) {
  console.log(`\n⚠️  Предупреждения (${warnings.length}):`);
  for (const w of warnings) console.log(`   • ${w}`);
}

if (errors.length) {
  console.log(`\n❌ Ошибки (${errors.length}):`);
  for (const e of errors) console.log(`   • ${e}`);
  console.log('\nАудит не пройден.');
  process.exit(1);
}

console.log('\n✅ Критичных расхождений нет.');
