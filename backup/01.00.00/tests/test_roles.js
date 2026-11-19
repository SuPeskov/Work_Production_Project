const fs = require('fs');
const store = { session: {}, local: {} };
global.sessionStorage = { getItem: k => store.session[k] ?? null, setItem: (k,v) => store.session[k]=String(v), removeItem: k => delete store.session[k] };
global.localStorage   = { getItem: k => store.local[k] ?? null,  setItem: (k,v) => store.local[k]=String(v),  removeItem: k => delete store.local[k] };
global.window   = { location: { pathname: '/index.html' } };
global.document = { addEventListener(){}, getElementById(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; }, createElement(){ return {}; } };

const vm = require('vm');
let ctxSrc = '';
['users.js','kb.js'].forEach(f => {
    const src = fs.readFileSync(__dirname + '/../js/' + f, 'utf8');
    ctxSrc += src.replace(/^const /gm, 'var ') + '\n';
});
ctxSrc += `\nObject.assign(globalThis, { USERS_DB, KB_SECTIONS, KB_OPERATIONS, ROLE_ADMIN, ROLE_WORKER, ROLE_GUEST, KB_DB_KEY, KB_READ_KEY, kbGetCurrentUser, kbUserCanConfirmRead, kbUserCanViewSection, kbUserCanViewOperation, kbAddUser, kbGetUsers, kbFindUser, kbAddRead, kbHasRead, kbGetReads });`;
vm.runInThisContext(ctxSrc);


let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + msg); if (!cond) fails++; };

store.session['modular_house_session'] = JSON.stringify({ username:'builder', name:'Иванов Сергей', role:'Гость', access:['panels'] });
let u = kbGetCurrentUser();
ok(u.role === 'Сотрудник производства', 'залипшая роль восстановлена из кода: ' + u.role);
ok(kbUserCanConfirmRead(u), 'builder может подтверждать Ознакомлен');

store.session['modular_house_session'] = JSON.stringify({ username:'admin', name:'Админ', role:'Администратор', access:[] });
ok(kbUserCanConfirmRead(kbGetCurrentUser()) === false, 'админ НЕ может подтверждать');

kbAddUser({ username:'visitor1', password:'p', name:'Гость Иванов', role:'Гость', access:['panels'] });
store.session['modular_house_session'] = JSON.stringify({ username:'visitor1', name:'Гость Иванов', role:'Гость', access:['panels'] });
const g = kbGetCurrentUser();
ok(g !== null && kbUserCanConfirmRead(g) === false, 'созданный гость не может подтверждать');
ok(kbUserCanViewSection(g,'panels') === true && kbUserCanViewSection(g,'module') === false, 'гость видит только раздел panels');

store.session['modular_house_session'] = JSON.stringify({ username:'guest_demo', role:'Гость', access:[] });
ok(kbGetCurrentUser() === null, 'устаревшая анонимная гостевая сессия отклонена');

kbAddUser({ username:'worker2', password:'p', name:'Сидоров П.', role:'Сотрудник производства', access:['installation'] });
store.session['modular_house_session'] = JSON.stringify({ username:'worker2', name:'Сидоров П.', role:'Сотрудник производства', access:['installation'] });
const w = kbGetCurrentUser();
ok(kbUserCanConfirmRead(w) === true, 'созданный сотрудник может подтверждать');
ok(kbUserCanViewSection(w,'installation') === true && kbUserCanViewSection(w,'panels') === false, 'права по разделам у созданного сотрудника');

kbAddRead('worker2','2.1.1',1);
ok(kbHasRead('worker2','2.1.1',1) === true && kbHasRead('worker2','2.1.1',2) === false, 'отметка привязана к версии операции');

console.log(fails ? 'ERRORS: ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
