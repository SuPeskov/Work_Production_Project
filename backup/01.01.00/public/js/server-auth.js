/**
 * server-auth.js — Мост между клиентом и серверным API (sh-ppr.ru)
 *
 * Подключается ДО auth.js на всех страницах. Если запросы к /api
 * недоступны (например, локальный запуск через LiveServer без бэкенда),
 * страницы продолжают работать по прежней localStorage-логике.
 *
 * Публичный API:
 *   kbApiAvailable()      — true, если backend отвечает на /api/me
 *   kbServerLogin(u, p)   — серверный вход (httpOnly-cookie), возвращает user
 *   kbServerLogout()      — завершение сеанса на сервере
 *   kbServerMe()          — { username, name, role, roleLabel, sections } | null
 *   kbServerRead(opId, version)     — отметка «Ознакомлен» (журнал пишет сервер)
 *   kbServerReads()       — журнал ознакомлений
 *   kbAdmin*              — CRUD пользователей через сервер
 */

(function () {
    'use strict';

    const API = '/api';
    let available = null;           // null = ещё не проверяли
    let meCache = undefined;        // undefined = не запрошивали; null = не авторизован

    async function req(path, opts = {}) {
        const res = await fetch(API + path, {
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            ...opts,
        });
        let data = null;
        try { data = await res.json(); } catch (_) { /* пустой ответ */ }
        if (!res.ok && res.status !== 401 && res.status !== 403) {
            throw Object.assign(new Error((data && data.error) || 'Ошибка сервера'), { status: res.status });
        }
        return { ok: res.ok, status: res.status, data };
    }

    // === Определение доступности бэкенда ===
    async function checkAvailable() {
        if (available !== null) return available;
        try {
            const r = await req('/me');
            available = r.status < 500 && r.data !== null;
        } catch (_) {
            available = false;
        }
        return available;
    }
    window.kbApiAvailable = () => available === true;

    // === Сессия ===
    async function kbServerMe(force = false) {
        if (!(await checkAvailable())) return null;
        if (meCache !== undefined && !force) return meCache;
        const r = await req('/me');
        meCache = (r.ok && r.data && r.data.user) ? r.data.user : null;
        if (meCache && r.data.sections && r.data.sections !== '*') meCache.sections = r.data.sections;
        return meCache;
    }
    window.kbServerMe = kbServerMe;

    async function kbServerLogin(username, password) {
        if (!(await checkAvailable())) throw new Error('Сервер авторизации недоступен');
        const r = await req('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        if (!r.ok) throw new Error((r.data && r.data.error) || 'Неверный логин или пароль');
        meCache = r.data.user;
        return r.data.user;
    }
    window.kbServerLogin = kbServerLogin;

    async function kbServerLogout() {
        meCache = null;
        if (!(await checkAvailable())) return;
        try { await req('/logout', { method: 'POST' }); } catch (_) { /* идемпотентно */ }
    }
    window.kbServerLogout = kbServerLogout;

    // === Журнал ознакомлений ===
    async function kbServerRead(opId, version) {
        const r = await req('/read/' + encodeURIComponent(opId), {
            method: 'POST', body: JSON.stringify({ version: version || 'v1' }),
        });
        if (r.status === 401) throw Object.assign(new Error('Требуется вход'), { status: 401 });
        if (!r.ok) throw new Error((r.data && r.data.error) || 'Не удалось сохранить отметку');
        return r.data; // { ok, already }
    }
    window.kbServerRead = kbServerRead;

    async function kbServerReads() {
        const r = await req('/reads');
        if (r.status === 401) return null;
        return r.ok ? r.data : null;
    }
    window.kbServerReads = kbServerReads;

    // === Админ API ===
    window.kbAdminUsers = async () => { const r = await req('/admin/users'); return r.ok ? r.data : null; };
    window.kbAdminCreateUser = async (u) => {
        const r = await req('/admin/users', { method: 'POST', body: JSON.stringify(u) });
        if (!r.ok) throw new Error((r.data && r.data.error) || 'Ошибка создания пользователя');
        return r.data;
    };
    window.kbAdminSetPassword = async (id, password) => {
        const r = await req('/admin/users/' + id + '/password', { method: 'POST', body: JSON.stringify({ password }) });
        if (!r.ok) throw new Error((r.data && r.data.error) || 'Ошибка смены пароля');
        return r.data;
    };
    window.kbAdminSetAccess = async (id, sections) => {
        const r = await req('/admin/users/' + id + '/access', { method: 'POST', body: JSON.stringify({ sections }) });
        if (!r.ok) throw new Error((r.data && r.data.error) || 'Ошибка назначения доступа');
        return r.data;
    };
    window.kbAdminDeleteUser = async (id) => {
        const r = await req('/admin/users/' + id, { method: 'DELETE' });
        if (!r.ok) throw new Error((r.data && r.data.error) || 'Ошибка удаления пользователя');
        return r.data;
    };

    // === Интеграция с существующей клиентской сессией (auth.js/kb.js) ===
    // Совместимость ролей: серверные коды -> русские метки, принятые в kb.js
    const ROLE_MAP = { admin: 'Администратор', worker: 'Сотрудник производства', guest: 'Гость' };

    // Администратор — без ограничений (все разделы), независимо от того, что
    // вернул сервер; сотрудник/гость — строго назначенный список.
    const ALL_SECTIONS = ['preparation', 'panels', 'module', 'options', 'installation', 'service'];

    function buildServerSession(u, sections) {
        return {
            username: u.username,
            name: u.name,
            role: ROLE_MAP[u.role] || u.role,
            access: u.role === 'admin' ? ALL_SECTIONS.slice()
                : (Array.isArray(sections) ? sections : []),
            loginTime: new Date().toISOString(),
            server: true,
        };
    }

    async function syncSessionFromServer() {
        const u = await kbServerMe();
        if (!u) return;
        let sections = null;
        try {
            const r = await req('/me');
            if (r.ok && r.data && Array.isArray(r.data.sections)) sections = r.data.sections;
        } catch (_) { /* сервер не отдаёт список — роль решит ниже */ }
        sessionStorage.setItem('modular_house_session', JSON.stringify(buildServerSession(u, sections)));
    }
    window.kbSyncSession = syncSessionFromServer;

    // Публичная точка синхронизации с сервером для kb.js (см. kbSyncWithServer).
    // Возвращает true, если бэкенд доступен и состояние клиента приведено к серверному.
    window.kbSyncWithServer = async function () {
        if (!(await checkAvailable())) return false;
        const u = await kbServerMe(true);
        if (!u) {
            // Серверного сеанса нет: чистим только серверную локальную сессию,
            // localStorage-режим (LiveServer без бэкенда) не трогаем.
            const local = JSON.parse(sessionStorage.getItem('modular_house_session') || 'null');
            if (local && local.server) sessionStorage.removeItem('modular_house_session');
            return true; // бэкенд доступен — просто не авторизованы
        }
        let sections = [];
        try {
            const r = await req('/me');
            if (r.ok && r.data && Array.isArray(r.data.sections)) sections = r.data.sections;
        } catch (_) { /* ignore */ }
        const sess = buildServerSession(u, sections);
        sessionStorage.setItem('modular_house_session', JSON.stringify(sess));
        // Синхронизируем локальную копию профиля: страницы операций подключают
        // только kb.js (без auth.js), и самовосстановление роли в kbGetCurrentUser
        // не должно «залипнуть» на устаревших правах из прошлых версий.
        try {
            if (!window.USERS_DB) window.USERS_DB = [];
            const i = window.USERS_DB.findIndex(x => x.username === sess.username);
            const rec = { username: sess.username, name: sess.name, role: sess.role, access: sess.access, password: '' };
            if (i >= 0) window.USERS_DB[i] = rec; else window.USERS_DB.push(rec);
            if (typeof kbSaveDbUser === 'function') kbSaveDbUser(rec);
        } catch (_) { /* не критично */ }
        return true;
    };

    // При загрузке любой страницы: если есть серверный сеанс — обновляем клиентский;
    // если клиентская сессия есть, а серверного сеанса нет — гость устарел, чистим.
    document.addEventListener('DOMContentLoaded', async function () {
        if (!(await checkAvailable())) return;   // бэкенда нет -> живём на localStorage
        const local = JSON.parse(sessionStorage.getItem('modular_house_session') || 'null');
        const serverUser = await kbServerMe();
        if (serverUser) {
            await syncSessionFromServer();
        } else if (local && local.server) {
            sessionStorage.removeItem('modular_house_session'); // серверный сеанс истёк
        }
    });
})();
