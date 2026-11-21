const $ = (id) => document.getElementById(id);
const tg = window.Telegram?.WebApp;
window.ME = null;
window.CUR_LOBBY = null;
let ROOM_TIMER = null;


// ==========================================
// КРАСИВЫЙ УРОВЕНЬ FACEIT (SVG)
// ==========================================


const Icons = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    lobbies: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    top: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`,
    admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
};

function initData() { return tg?.initData || ''; }

async function api(path, body) {
    let options = { headers: { 'X-Init-Data': initData() } };
    if (body) {
        options.method = 'POST';
        options.headers['Content-Type'] = 'application/json';
        body.init_data = initData();
        options.body = JSON.stringify(body);
    }
    const r = await fetch(path, options);
    return r.json();
}
window.api = api;

function showToast(text, type = 'info') {
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = '';
    if (type === 'success') icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="20" height="20"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    else if (type === 'error') icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    else icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div>${text}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); }, 3000);
}
window.showToast = showToast;

function show(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = $('page-' + name);
    if (target) target.classList.add('active');
    document.querySelectorAll('.tabbar .tab').forEach(t => t.classList.toggle('active', t.dataset.page === name));
    if (name === 'home') renderHome();
    if (name === 'lobbies') renderLobbies();
    if (name === 'top') renderTop();
    if (name === 'profile') renderProfile();
    if (name === 'admin') renderAdmin();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.show = show;

async function boot() {
    try { tg?.ready(); tg?.expand(); tg?.setHeaderColor?.('#06070b'); tg?.setBackgroundColor?.('#06070b'); } catch(e){}
    document.querySelectorAll('.tabbar .tab').forEach(t => {
        const page = t.dataset.page;
        if (Icons[page]) t.innerHTML = Icons[page];
    });

    const r = await api('/api/auth', {});
    if (r.ok) {
        window.ME = r.user;
        if (!window.ME.nick) show('auth');
        else show('home');
        if (window.ME.role === 'admin' && $('tab-admin')) $('tab-admin').style.display = 'block';
        const loader = $('loader-screen');
        if (loader) loader.style.display = 'none';
    } else {
        showToast(r.error || 'Ошибка авторизации', 'error');
        const loader = $('loader-screen');
        if (loader) loader.style.display = 'none';
    }
}
window.boot = boot;

async function registerUser() {
    const nick = $('inp-nick').value.trim();
    const cfid = $('inp-cfid').value.trim();
    const err = $('auth-err');
    if (nick.length < 3) { err.textContent = 'Ник от 3 символов'; err.style.display = 'block'; return; }
    if (!cfid) { err.textContent = 'Введите ID'; err.style.display = 'block'; return; }
    const r = await api('/api/profile/setup', { nick, cf_id: cfid, device: 'PC', bio: '' });
    if (r.ok) { window.ME = r.user; show('home'); const l = $('loader-screen'); if(l) l.style.display='none'; }
    else { showToast(r.error, 'error'); err.textContent = r.error; err.style.display = 'block'; }
}
window.registerUser = registerUser;

async function renderHome() {
    try {
        const s = await api('/api/stats');
        if (s.ok) {
            if ($('stat-online')) $('stat-online').textContent = s.online || 0;
            if ($('stat-lobbies')) $('stat-lobbies').textContent = s.lobbies || 0;
            if ($('stat-matches')) $('stat-matches').textContent = s.matches_today || s.matches || 0;
        }
    } catch(e) {}

    // Реклама
    const adsBox = $('home-ads');
    if (adsBox) {
        try {
            const r = await api('/api/ads');
            if (r.ok && r.ads && r.ads.length > 0) {
                adsBox.innerHTML = r.ads.map(a => `
                    <div style="background: ${a.color || 'linear-gradient(135deg, #7b2cbf, #c77dff)'}; border-radius: 20px; padding: 20px; margin-bottom: 12px; position: relative;">
                        <div style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.4); color: #fff; font-size: 9px; font-weight: bold; padding: 2px 8px; border-radius: 6px;">РЕКЛАМА</div>
                        <div style="font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 4px; text-transform: uppercase;">${a.subtitle || ''}</div>
                        <div style="font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 12px; line-height: 1.2;">${a.title || ''}</div>
                        <button style="background: #fff; color: #000; border: none; padding: 8px 16px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer;">${a.btn_text || 'Кнопка'}</button>
                    </div>
                `).join('');
            } else {
                adsBox.innerHTML = '';
            }
        } catch(e) {}
    }

    // Новости
    const newsBox = $('home-news');
    if (newsBox) {
        try {
            const r = await api('/api/news');
            let html = `<div class="glass-panel" style="padding:20px; margin-bottom:16px;">
                <div class="section-title">ОБНОВЛЕНИЯ</div>
                ${r.ok && r.news && r.news.length > 0 ? r.news.map(n => `
                    <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:12px 0;">
                        <div style="font-size:11px; color:#00ff88; font-weight:bold; margin-bottom:4px;">${n.date}</div>
                        <div style="font-size:14px; color:#fff;">${n.text}</div>
                    </div>
                `).join('') : '<div style="color:#7a7f8a; font-size:13px; text-align:center; padding:20px;">Новостей пока нет</div>'}
            </div>`;
            newsBox.innerHTML = html;
        } catch(e) {}
    }
}

async function renderProfile() {
    if (!window.ME) return;
    const box = $('profile-content');
    if (!box) return;
    const elo = window.ME.elo || 1000;
    const lvl = Math.max(1, Math.min(10, Math.floor(elo / 300) + 1));
    const progress = Math.min(100, ((elo % 300) / 300) * 100);
    const histRes = await api('/api/profile/history');
    const history = histRes.history || [];
    
    box.innerHTML = `
        <!-- ВЕРХНЯЯ ПАНЕЛЬ (КОЛОКОЛЬЧИК И ШЕСТЕРЕНКА) -->
        <div style="display:flex; justify-content:flex-end; gap:12px; margin-bottom:16px;">
            <button onclick="openNotifications()" style="width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.05); border:none; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </button>
            <button onclick="openSettingsModal()" style="width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.05); border:none; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
        </div>
        
        <div class="profile-cover">
            <button class="settings-btn" onclick="openSettings()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
            <div class="profile-avatar-wrap"><div class="profile-avatar">${(window.ME.nick || 'P')[0].toUpperCase()}</div></div>
            <div class="profile-info">
                <div class="profile-name" style="display:flex; align-items:center; gap:6px;">
                    ${window.ME.nick}
                    ${window.ME.verified ? '<img src="/static/img/verified.svg" style="height:0.8em; width:auto; display:inline-block; vertical-align:middle; position:relative; top:-1px;" alt="V">' : ''}
                </div>
                <div class="profile-device">${window.ME.cf_id || ''} · ${window.ME.device || 'PC'} · <span style="color:#00b8ff; font-weight:bold;">${window.ME.elo} ELO</span></div>
            </div>
        </div>
        <div class="profile-elo-card" style="display:flex; align-items:center; gap:20px; padding:20px; background:rgba(255,255,255,0.03); border-radius:16px; margin-bottom:16px;">
            <div style="width:80px; height:80px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                ${getFaceitLevelSvg(elo, (window.ME.wins || 0) + (window.ME.losses || 0), 80)}
            </div>
            <div class="elo-info" style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
                    <div>
                        <div style="font-size:28px; font-weight:900; color:#fff;">${elo}</div>
                        <div style="font-size:12px; color:#7a7f8a;">FACEIT LVL ${lvl}</div>
                    </div>
                    <div style="font-size:11px; color:#7a7f8a;">До уровня ${lvl + 1}: ${((lvl+1)*300) - elo} ELO</div>
                </div>
                <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:${progress}%; background:linear-gradient(90deg, #00ff88, #00b8ff); border-radius:3px;"></div>
                </div>
            </div>
        </div>
        
        <div class="profile-stats-grid">
            <div class="stat-item"><div class="val">${window.ME.wins + window.ME.losses}</div><div class="lbl">Матчи</div></div>
            <div class="stat-item"><div class="val" style="color:#00ff88;">${window.ME.wins}</div><div class="lbl">Победы</div></div>
            <div class="stat-item"><div class="val" style="color:#ff4444;">${window.ME.losses}</div><div class="lbl">Поражения</div></div>
            <div class="stat-item"><div class="val">${(window.ME.kills / (window.ME.deaths || 1)).toFixed(2)}</div><div class="lbl">K/D</div></div>
        </div>
        <div class="profile-history">
            <div class="title">ИСТОРИЯ МАТЧЕЙ</div>
            <div class="section-title">ИСТОРИЯ МАТЧЕЙ</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
            ${history.length ? history.map(h => `
                <div class="history-row" onclick="openMatchHistoryDetails(${h.match_id})">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:800; color:${h.result === 'win' ? '#00ff88' : '#ff4444'};">${h.result === 'win' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</div>
                            <div style="font-size:13px; color:#7a7f8a; margin-top:4px;">Матч #${h.match_id} · K/D: ${h.kills}/${h.deaths}</div>
                        </div>
                        <div style="font-weight:800; color:${h.elo_change > 0 ? '#00ff88' : '#ff4444'}; font-size:16px;">${h.elo_change > 0 ? '+' : ''}${h.elo_change} ELO</div>
                    </div>
                </div>
            `).join('') : '<div class="empty">Пока нет матчей</div>'}
            </div>
        </div>
    `;
}
window.renderProfile = renderProfile;

async function renderTop() {
    const r = await api('/api/top');
    const podium = $('top-podium');
    const list = $('top-list');
    
    if (!r.ok || !r.players || !r.players.length) {
        if (podium) podium.innerHTML = '';
        if (list) list.innerHTML = '<div style="text-align:center; padding:40px; color:#7a7f8a;">Нет игроков</div>';
        return;
    }
    
    const p = r.players;
    
    // Функция рендера карточки на подиуме (1, 2, 3 места)
    const renderPodiumCard = (player, place) => {
        if (!player) return '';
        
        let cardBg = 'linear-gradient(180deg, rgba(0,255,136,0.1) 0%, rgba(0,255,136,0.02) 100%)';
        let cardBorder = 'rgba(0,255,136,0.3)';
        let rankColor = '#00ff88';
        let crownHtml = '';
        let scale = '0.9';
        let marginTop = '20px';
        
        if (place === 1) {
            cardBg = 'linear-gradient(180deg, rgba(0,255,136,0.15) 0%, rgba(0,255,136,0.02) 100%)';
            cardBorder = 'rgba(0,255,136,0.4)';
            crownHtml = '<div style="position:absolute; top:-16px; left:50%; transform:translateX(-50%); color:#ffd700;"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 4L12 4l3.5 5L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg></div>';
            rankColor = '#ffd700';
            scale = '1.0';
            marginTop = '0';
        } else if (place === 2) {
            cardBg = 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 100%)';
            cardBorder = 'rgba(255,255,255,0.2)';
            crownHtml = '<div style="position:absolute; top:-12px; left:50%; transform:translateX(-50%); color:#c0c0c0;"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 4L12 4l3.5 5L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg></div>';
            rankColor = '#c0c0c0';
        } else if (place === 3) {
            cardBg = 'linear-gradient(180deg, rgba(255,100,0,0.1) 0%, rgba(255,100,0,0.01) 100%)';
            cardBorder = 'rgba(255,100,0,0.3)';
            crownHtml = '<div style="position:absolute; top:-12px; left:50%; transform:translateX(-50%); color:#cd7f32;"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 4L12 4l3.5 5L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg></div>';
            rankColor = '#cd7f32';
        }
        
        return `
            <div onclick="openPlayerProfile(${player.tg_id})" style="cursor:pointer; position:relative; background:${cardBg}; border:1px solid ${cardBorder}; border-radius:20px; padding:20px 16px; display:flex; flex-direction:column; align-items:center; transform:scale(${scale}); z-index:${place === 1 ? 2 : 1}; margin-top:${marginTop};">
                ${crownHtml}
                
                <div style="position:relative; margin-bottom:12px;">
                    <div style="width:72px; height:72px; border-radius:50%; background:#1f2229; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:900; color:#fff; border:2px solid rgba(255,255,255,0.1); overflow:hidden;">
                        ${player.avatar ? `<img src="${player.avatar}" style="width:100%; height:100%; object-fit:cover;">` : (player.nick || 'U')[0].toUpperCase()}
                    </div>
                    <div style="position:absolute; bottom:-8px; right:-8px;">
                        ${getFaceitLevelSvg(player.elo, 1, 32)}
                    </div>
                </div>
                
                <div style="font-size:32px; font-weight:900; color:${rankColor}; margin-bottom:8px; text-shadow:0 2px 10px rgba(0,0,0,0.5);">${place}</div>
                
                <div style="font-size:14px; font-weight:900; color:#fff; display:flex; align-items:center; gap:4px; margin-bottom:4px;">
                    ${player.nick}
                    ${player.verified ? '<img src="/static/img/verified.svg" style="height:1em; width:auto;" alt="V">' : ''}
                </div>
                
                <div style="font-size:20px; font-weight:900; color:#fff;">${player.elo} <span style="font-size:10px; color:#7a7f8a; font-weight:700;">ELO</span></div>
            </div>
        `;
    };

    if (podium) {
        podium.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1.1fr 1fr; gap:8px; align-items:end; margin-bottom:24px; padding-top:20px;">
                ${renderPodiumCard(p[1], 2)}
                ${renderPodiumCard(p[0], 1)}
                ${renderPodiumCard(p[2], 3)}
            </div>
        `;
    }

    if (list) {
        list.innerHTML = p.slice(3).map((pl, i) => {
            const place = i + 4;
            return `
                <div onclick="openPlayerProfile(${pl.tg_id})" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:16px; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:20px; font-size:14px; color:#7a7f8a; font-weight:900; text-align:center;">${place}</div>
                        <div style="position:relative;">
                            <div style="width:44px; height:44px; border-radius:50%; background:#1f2229; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:900; color:#fff; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
                                ${pl.avatar ? `<img src="${pl.avatar}" style="width:100%; height:100%; object-fit:cover;">` : (pl.nick || 'U')[0].toUpperCase()}
                            </div>
                            <div style="position:absolute; bottom:-6px; right:-6px;">
                                ${getFaceitLevelSvg(pl.elo, 1, 22)}
                            </div>
                        </div>
                        <div>
                            <div style="font-size:14px; font-weight:800; color:#fff; display:flex; align-items:center; gap:4px;">
                                ${pl.nick}
                                ${pl.verified ? '<img src="/static/img/verified.svg" style="height:0.9em; width:auto;" alt="V">' : ''}
                            </div>
                            <div style="font-size:11px; color:#7a7f8a; margin-top:2px;">${pl.wins || 0}W · ${pl.losses || 0}L</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:18px; font-weight:900; color:#fff;">${pl.elo}</div>
                        <div style="font-size:10px; color:#7a7f8a; font-weight:700;">ELO</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}
// ==========================================
// АДМИНКА (КАК НА СКРИНШОТАХ)
// ==========================================
async function renderAdmin() {
    const box = $('admin-content');
    if (!box) return;
    switchAdminTab('lobbies', document.querySelector('.admin-tab[data-tab="lobbies"]'));
}
window.renderAdmin = renderAdmin;

window.switchAdminTab = async function(tab, btn) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const box = $('admin-content');
    if (!box) return;
    box.innerHTML = '<div style="padding:20px; color:#7a7f8a; text-align:center;">Загрузка...</div>';

    try {
        if (tab === 'matches') {
            const r = await api('/api/admin/matches/pending');
            if (!r.ok) throw new Error(r.error);
            if (!r.matches.length) {
                box.innerHTML = '<div style="padding:40px 20px; color:#7a7f8a; text-align:center;">Нет матчей на проверке</div>';
                return;
            }
            box.innerHTML = `<div style="display:grid; gap:12px;">` + r.matches.map(m => `
                <div style="background:#0f1115; border:1px solid rgba(255,255,255,0.05); padding:16px; border-radius:16px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:800; color:#fff; font-size:16px;">Матч #${m.id}</div>
                        <div style="color:#7a7f8a; font-size:12px;">Карта: ${m.map || 'TBD'} · Статус: ${m.status}</div>
                    </div>
                    <button class="btn-primary" style="padding:8px 16px; font-size:13px;" onclick="openMatchStats(${m.id})">Ввести статистику</button>
                </div>
            `).join('') + `</div>`;
        } 
        else if (tab === 'lobbies') {
            const r = await api('/api/admin/lobbies');
            if (!r.ok) throw new Error(r.error);
            box.innerHTML = `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:16px; padding: 10px 0;">` + r.lobbies.map((l, index) => `
                <div style="background:#0a0c10; border:1px solid #1a1d24; border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div style="font-size:18px; font-weight:800; color:#fff;">${l.name}</div>
                            <div style="background:rgba(0,184,255,0.15); color:#00b8ff; font-size:10px; font-weight:800; padding:4px 8px; border-radius:4px; letter-spacing:0.5px;">${l.status === 'waiting' ? 'ОТКРЫТО' : l.status.toUpperCase()}</div>
                        </div>
                        <div style="color:#7a7f8a; font-size:13px; margin-bottom:12px; line-height:1.4;">
                            ${l.mode || 'Ranked'} · Игроков: <span style="color:#fff; font-weight:700;">${l.filled} / ${l.capacity}</span><br>
                            Фаза: <span style="color:#fff; font-weight:700;">${l.status === 'waiting' ? 'Набор' : l.status}</span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
                        <button onclick="closeAdminLobby(${l.id})" style="background:#12141a; border:1px solid #222; color:#fff; padding:12px; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:0.2s;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Закрыть
                        </button>
                        <button onclick="clearAdminLobby(${l.id})" style="background:#12141a; border:1px solid #222; color:#fff; padding:12px; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:0.2s;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
                            Очистить
                        </button>
                    </div>
                </div>
            `).join('') + `</div>`;
        }
        else if (tab === 'ads') {
            const r = await api('/api/admin/ads');
            if (!r.ok) throw new Error(r.error);
            let html = '<div style="display:flex; justify-content:flex-end; margin-bottom:16px;"><button onclick="addAdInline()" style="background:#00ff88; color:#000; border:none; padding:8px 16px; border-radius:10px; font-weight:800; cursor:pointer;">+ Добавить</button></div>';
            html += `<div style="display:flex; flex-direction:column; gap:16px;">`;
            html += r.ads.map(a => `
                <div style="background:#0f1115; border:1px solid rgba(255,255,255,0.05); border-radius:20px; padding:20px;">
                    <div style="background:${a.color || 'linear-gradient(135deg, #7b2cbf, #c77dff)'}; border-radius:12px; padding:16px; margin-bottom:16px; position:relative;">
                        <div style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.4); color:#fff; font-size:9px; font-weight:bold; padding:2px 8px; border-radius:6px;">РЕКЛАМА</div>
                        <div style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.8); text-transform:uppercase; margin-bottom:4px;">${a.subtitle || 'Подзаголовок'}</div>
                        <div style="font-size:20px; font-weight:900; color:#fff;">${a.title || 'Заголовок'}</div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                        <div><div style="font-size:10px; color:#7a7f8a; margin-bottom:4px;">МЕТКА</div><input id="ad-tag-${a.id}" value="${a.tag}" style="width:100%; background:rgba(255,255,255,0.05); border:none; padding:8px; border-radius:8px; color:#fff; font-size:12px;"></div>
                        <div><div style="font-size:10px; color:#7a7f8a; margin-bottom:4px;">ПОДЗАГОЛОВОК</div><input id="ad-sub-${a.id}" value="${a.subtitle}" style="width:100%; background:rgba(255,255,255,0.05); border:none; padding:8px; border-radius:8px; color:#fff; font-size:12px;"></div>
                        <div><div style="font-size:10px; color:#7a7f8a; margin-bottom:4px;">ЗАГОЛОВОК</div><input id="ad-title-${a.id}" value="${a.title}" style="width:100%; background:rgba(255,255,255,0.05); border:none; padding:8px; border-radius:8px; color:#fff; font-size:12px;"></div>
                        <div><div style="font-size:10px; color:#7a7f8a; margin-bottom:4px;">ТЕКСТ КНОПКИ</div><input id="ad-btn-${a.id}" value="${a.btn_text}" style="width:100%; background:rgba(255,255,255,0.05); border:none; padding:8px; border-radius:8px; color:#fff; font-size:12px;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:12px; color:#7a7f8a;">Показывать на главной</div>
                        <div style="display:flex; gap:8px;">
                            <button onclick="saveAd(${a.id})" style="background:#00ff88; color:#000; border:none; padding:6px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">Сохранить</button>
                            <button onclick="deleteAd(${a.id})" style="background:#ff4444; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">Удалить</button>
                        </div>
                    </div>
                </div>
            `).join('');
            html += `</div>`;
            box.innerHTML = html;
        }
        else if (tab === 'news') {
            const r = await api('/api/admin/news');
            if (!r.ok) throw new Error(r.error);
            let html = `
            <div style="background:#0f1115; border:1px solid rgba(255,255,255,0.05); border-radius:20px; padding:20px; margin-bottom:20px;">
                <div style="font-size:14px; font-weight:800; color:#fff; margin-bottom:12px;">Добавить новость</div>
                <input type="text" id="news-date" placeholder="Дата (например, 21 Ноября)" style="width:100%; background:rgba(255,255,255,0.05); border:none; padding:12px; border-radius:10px; color:#fff; margin-bottom:10px; font-size:13px;">
                <textarea id="news-text" placeholder="Текст новости..." rows="3" style="width:100%; background:rgba(255,255,255,0.05); border:none; padding:12px; border-radius:10px; color:#fff; margin-bottom:12px; font-size:13px; resize:none;"></textarea>
                <button onclick="saveNews()" style="background:#00ff88; color:#000; border:none; padding:10px 20px; border-radius:10px; font-weight:800; cursor:pointer; width:100%;">Сохранить новость</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">`;
            html += r.news.map(n => `
                <div style="background:#0f1115; border:1px solid rgba(255,255,255,0.05); border-radius:16px; padding:16px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:11px; color:#00ff88; font-weight:bold; margin-bottom:4px;">${n.date}</div>
                        <div style="color:#fff; font-size:13px;">${n.text}</div>
                    </div>
                    <button onclick="deleteNews(${n.id})" style="background:#ff4444; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">Удалить</button>
                </div>
            `).join('');
            html += `</div>`;
            box.innerHTML = html;
        }
        else if (tab === 'players') {
            const r = await api('/api/admin/users');
            if (!r.ok) throw new Error(r.error);
            let html = `<div style="background:#0f1115; border:1px solid rgba(255,255,255,0.05); border-radius:20px; overflow:hidden;">`;
            html += `<div style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; padding:16px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:11px; color:#7a7f8a; font-weight:800; text-transform:uppercase;">
                <div>Игрок</div><div>LVL</div><div>ELO</div><div>Статус</div><div style="text-align:right;">Действия</div>
            </div>`;
            html += r.users.map(u => {
                const lvl = Math.max(1, Math.floor((u.elo || 1000) / 300));
                const lvlColor = u.elo >= 2000 ? '#ff4444' : (u.elo >= 1500 ? '#ffd700' : '#00b8ff');
                return `<div style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; padding:16px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.02);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="font-weight:700; color:#fff; display:flex; align-items:center;">${u.nick}
                            ${u.verified ? '<img src="/static/img/verified.svg" style="height:0.9em; width:auto; display:inline-block; vertical-align:middle; margin-left:6px; position:relative; top:-1px;" alt="V">' : ''}
                        </div>
                    </div>
                    <div>${getFaceitLevelSvg(u.elo, 1, 24)}</div>
                    <div style="font-weight:700; color:#fff;">${u.elo}</div>
                    <div><span style="background:${u.role === 'admin' ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.05)'}; color:${u.role === 'admin' ? '#00ff88' : '#7a7f8a'}; font-size:10px; font-weight:800; padding:4px 8px; border-radius:6px; text-transform:uppercase;">${u.role === 'admin' ? 'Админ' : 'Игрок'}</span></div>
                    <div style="display:flex; gap:8px; justify-content:flex-end;">
                        <button onclick="toggleRole(${u.tg_id}, '${u.role === 'admin' ? 'user' : 'admin'}')" style="background:rgba(255,255,255,0.05); border:none; color:#fff; padding:6px 10px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">${u.role === 'admin' ? 'Разжаловать' : 'Админ'}</button>
                        <button onclick="toggleVerify(${u.tg_id}, ${u.verified ? 0 : 1})" style="background:${u.verified ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${u.verified ? '#00ff88' : 'transparent'}; color:${u.verified ? '#00ff88' : '#fff'}; padding:6px 10px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:4px;">
    ${u.verified ? '<img src="/static/img/verified.svg" style="width:12px; height:12px;"> Галочка' : 'Выдать'}
</button>
                        <button onclick="toggleBan(${u.tg_id}, ${u.banned ? 0 : 1})" style="background:#ff4444; border:none; color:#fff; padding:6px 10px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">${u.banned ? 'Разбанить' : 'Бан'}</button>
                    </div>
                </div>`;
            }).join('');
            html += `</div>`;
            box.innerHTML = html;
        }
        else if (tab === 'stats') {
            const r = await api('/api/admin/stats');
            if (!r.ok) throw new Error(r.error);
            const s = r.stats;
            
            box.innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:16px; padding: 10px 0;">
                    
                    <div style="background:#0a0c10; border:1px solid #1a1d24; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00b8ff" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        <div style="font-size:28px; font-weight:900; color:#fff; line-height:1;">${s.users}</div>
                        <div style="font-size:12px; color:#7a7f8a;">Игроков в системе</div>
                    </div>

                    <div style="background:#0a0c10; border:1px solid #1a1d24; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00b8ff" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                        <div style="font-size:28px; font-weight:900; color:#fff; line-height:1;">${s.banned}</div>
                        <div style="font-size:12px; color:#7a7f8a;">Заблокировано</div>
                    </div>

                    <div style="background:#0a0c10; border:1px solid #1a1d24; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00b8ff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <div style="font-size:28px; font-weight:900; color:#fff; line-height:1;">${s.admins}</div>
                        <div style="font-size:12px; color:#7a7f8a;">Администраторов</div>
                    </div>

                    <div style="background:#0a0c10; border:1px solid #1a1d24; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00b8ff" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        <div style="font-size:28px; font-weight:900; color:#fff; line-height:1;">${s.lobbies}</div>
                        <div style="font-size:12px; color:#7a7f8a;">Открытых лобби</div>
                    </div>

                    <div style="background:#0a0c10; border:1px solid #1a1d24; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00b8ff" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <div style="font-size:28px; font-weight:900; color:#fff; line-height:1;">${s.pending_matches}</div>
                        <div style="font-size:12px; color:#7a7f8a;">Матчей на проверке</div>
                    </div>

                    <div style="background:#0a0c10; border:1px solid #1a1d24; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00b8ff" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                        <div style="font-size:28px; font-weight:900; color:#fff; line-height:1;">${s.badges}</div>
                        <div style="font-size:12px; color:#7a7f8a;">Бейджей создано</div>
                    </div>

                    <div style="background:#0a0c10; border:1px solid #1a1d24; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00b8ff" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
                        <div style="font-size:28px; font-weight:900; color:#fff; line-height:1;">${s.my_elo}</div>
                        <div style="font-size:12px; color:#7a7f8a;">Твой ELO</div>
                    </div>

                </div>
            `;
        }
    } catch (e) {
        box.innerHTML = `<div style="padding:20px; color:#ff4444; text-align:center;">${e.message}</div>`;
    }
};

// Новые функции для инлайн-форм
window.saveNews = async function() {
    const date = $('news-date').value.trim();
    const text = $('news-text').value.trim();
    if (!text) return showToast('Введите текст', 'error');
    await api('/api/admin/news/add', { date: date || new Date().toLocaleDateString(), text });
    switchAdminTab('news', document.querySelector('.admin-tab[data-tab="news"]'));
    showToast('Новость добавлена', 'success');
};

window.addAdInline = function() {
    const title = prompt('Заголовок рекламы (например: Турнир сезона):');
    if (!title) return;
    const subtitle = prompt('Подзаголовок (например: Призовой фонд 50 000 ₽):') || '';
    const btn_text = prompt('Текст кнопки (например: Участвовать):') || 'Подробнее';
    const color = prompt('Цвет (например: linear-gradient(135deg, #7b2cbf, #c77dff)):', 'linear-gradient(135deg, #7b2cbf, #c77dff)') || 'linear-gradient(135deg, #7b2cbf, #c77dff)';
    
    api('/api/admin/ads/add', { title, subtitle, btn_text, color }).then(r => {
        if (r.ok) {
            showToast('Реклама добавлена', 'success');
            switchAdminTab('ads', document.querySelector('.admin-tab[data-tab="ads"]'));
        } else {
            showToast('Ошибка', 'error');
        }
    });
};
window.closeAdminLobby = async function(id) {
    await api('/api/admin/lobby/close', { id });
    switchAdminTab('lobbies', document.querySelector('.admin-tab[data-tab="lobbies"]'));
};
window.clearAdminLobby = async function(id) {
    await api('/api/admin/lobby/clear', { id });
    switchAdminTab('lobbies', document.querySelector('.admin-tab[data-tab="lobbies"]'));
};
window.addAd = async function() {
    const title = prompt('Заголовок рекламы:');
    if (!title) return;
    await api('/api/admin/ads', { title, subtitle: 'Подзаголовок', btn_text: 'Кнопка', tag: 'РЕКЛАМА', color: 'linear-gradient(135deg, #7b2cbf, #c77dff)' });
    switchAdminTab('ads', document.querySelector('.admin-tab[data-tab="ads"]'));
};
window.deleteAd = async function(id) {
    await api('/api/admin/ads', { id, method: 'DELETE' });
    switchAdminTab('ads', document.querySelector('.admin-tab[data-tab="ads"]'));
};
window.addNews = async function() {
    const text = prompt('Текст новости:');
    if (!text) return;
    await api('/api/admin/news', { date: new Date().toLocaleDateString(), text });
    switchAdminTab('news', document.querySelector('.admin-tab[data-tab="news"]'));
};
window.deleteNews = async function(id) {
    await api('/api/admin/news', { id, method: 'DELETE' });
    switchAdminTab('news', document.querySelector('.admin-tab[data-tab="news"]'));
};
window.toggleRole = async function(tg_id, role) {
    await api('/api/admin/role', { tg_id, role });
    switchAdminTab('players', document.querySelector('.admin-tab[data-tab="players"]'));
};
window.toggleVerify = async function(tg_id, verified) {
    await api('/api/admin/verify', { tg_id, verified });
    switchAdminTab('players', document.querySelector('.admin-tab[data-tab="players"]'));
};
window.toggleBan = async function(tg_id, banned) {
    await api('/api/admin/ban', { tg_id, banned });
    switchAdminTab('players', document.querySelector('.admin-tab[data-tab="players"]'));
};
window.validateMatch = function(mid) {
    showToast('Форма ввода статистики появится в следующем патче', 'info');
};

// ==========================================
// НЕДОСТАЮЩИЕ ФУНКЦИИ ДЛЯ КНОПОК
// ==========================================
window.goBackToLobbies = function() { show('lobbies'); renderLobbies(); };
window.pressConfirm = async function() {
    if (!window.CUR_LOBBY) return;
    const r = await api('/api/lobby/' + window.CUR_LOBBY + '/confirm', {});
    if (r.ok) { showToast('Матч подтверждён', 'success'); await refreshRoom(window.CUR_LOBBY); }
    else showToast(r.error || 'Ошибка', 'error');
};
window.sendChat = async function() {
    const inp = $('chat-inp');
    if (!inp || !inp.value.trim() || !window.CUR_LOBBY) return;
    const text = inp.value.trim(); inp.value = '';
    await api('/api/lobby/' + window.CUR_LOBBY + '/chat', { text });
    await refreshRoom(window.CUR_LOBBY);
};
window.publishCode = async function() {
    const inp = $('code-inp');
    if (!inp || !inp.value.trim() || !window.CUR_LOBBY) return;
    await api('/api/lobby/' + window.CUR_LOBBY + '/code/update', { code: inp.value.trim() });
    inp.value = ''; await refreshRoom(window.CUR_LOBBY); showToast('Код обновлен', 'success');
};
window.startMatch = async function() {
    if (!window.CUR_LOBBY) return;
    const r = await api('/api/lobby/' + window.CUR_LOBBY + '/match/start', {});
    if (r.ok) showToast('Матч начат!', 'success'); else showToast(r.error || 'Ошибка', 'error');
};
window.openSettings = function() {
    if (window.ME) {
        if ($('set-nick')) $('set-nick').value = window.ME.nick || '';
        if ($('set-device')) $('set-device').value = window.ME.device || 'PC';
        if ($('set-bio')) $('set-bio').value = window.ME.bio || '';
    }
    $('modal-settings')?.classList.add('show');
};
window.saveProfileSettings = async function() {
    const nick = $('set-nick').value.trim();
    const device = $('set-device').value;
    const bio = $('set-bio').value.trim();
    if (!nick) return showToast('Введите ник', 'error');
    const r = await api('/api/profile/setup', { nick, device, bio });
    if (r.ok) { window.ME = r.user; $('modal-settings')?.classList.remove('show'); renderProfile(); showToast('Сохранено', 'success'); }
    else showToast(r.error || 'Ошибка', 'error');
};

document.addEventListener('DOMContentLoaded', () => {
    boot();
    document.querySelectorAll('.tabbar .tab').forEach(t => {
        t.onclick = () => show(t.dataset.page);
    });
});

// Возврат кнопок
window.goBackToLobbies = function() { show('lobbies'); renderLobbies(); };
window.openSettings = function() {
    if (window.ME) {
        if ($('set-nick')) $('set-nick').value = window.ME.nick || '';
        if ($('set-device')) $('set-device').value = window.ME.device || 'PC';
        if ($('set-bio')) $('set-bio').value = window.ME.bio || '';
    }
    $('modal-settings')?.classList.add('show');
};
window.saveProfileSettings = async function() {
    const nick = $('set-nick').value.trim();
    const device = $('set-device').value;
    const bio = $('set-bio').value.trim();
    if (!nick) return showToast('Введите ник', 'error');
    const r = await api('/api/profile/setup', { nick, device, bio });
    if (r.ok) { window.ME = r.user; $('modal-settings')?.classList.remove('show'); renderProfile(); showToast('Сохранено', 'success'); }
    else showToast(r.error || 'Ошибка', 'error');
};

window.saveAd = async function(id) {
    const tag = $('ad-tag-' + id).value;
    const subtitle = $('ad-sub-' + id).value;
    const title = $('ad-title-' + id).value;
    const btn_text = $('ad-btn-' + id).value;
    
    const r = await api('/api/admin/ads/save', { id, tag, subtitle, title, btn_text });
    if (r.ok) {
        showToast('Реклама обновлена', 'success');
        switchAdminTab('ads', document.querySelector('.admin-tab[data-tab="ads"]'));
    } else {
        showToast('Ошибка', 'error');
    }
};

// ==========================================
// ВВОД СТАТИСТИКИ МАТЧА (МОДАЛКА)
// ==========================================
window.openMatchStats = async function(mid) {
    const r = await api('/api/admin/match/' + mid + '/players');
    if (!r.ok) { showToast(r.error || 'Ошибка загрузки', 'error'); return; }

    const match = r.match;
    const players = r.players;
    const mapName = match.map || 'MAP';
    // Безопасное формирование пути к карте
    const safeMapName = mapName.toLowerCase().replace(' ', '').replace('dust2', 'dust2');
    const mapImg = `/static/img/maps/${safeMapName}.jpg`; // Примерное имя файла

    let modal = $('modal-match-stats');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-match-stats';
        modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(5px); z-index:99999; display:flex; align-items:flex-start; justify-content:center; padding:20px; overflow-y:auto;';
        document.body.appendChild(modal);
    }

    let playersHtml = players.map(p => `
        <div style="background:#12141a; border:1px solid #1f2229; padding:16px; border-radius:12px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:${p.team === 'A' ? '#00ff88' : '#00b8ff'}; color:#000; font-weight:900; display:flex; align-items:center; justify-content:center;">${p.team === 'A' ? 'КТ' : 'Т'}</div>
                <div style="flex:1;">
                    <div style="color:#fff; font-weight:700; font-size:15px;">${p.nick}</div>
                    <div style="color:#7a7f8a; font-size:11px;">ELO: ${p.elo}</div>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                <div style="background:#0a0c10; border:1px solid #1f2229; border-radius:8px; padding:8px; text-align:center;">
                    <div style="font-size:10px; color:#7a7f8a; margin-bottom:4px;">Убийства</div>
                    <input type="number" id="k-${p.tg_id}" value="0" style="background:none; border:none; color:#fff; font-weight:800; font-size:16px; text-align:center; width:100%; outline:none;">
                </div>
                <div style="background:#0a0c10; border:1px solid #1f2229; border-radius:8px; padding:8px; text-align:center;">
                    <div style="font-size:10px; color:#7a7f8a; margin-bottom:4px;">Смерти</div>
                    <input type="number" id="d-${p.tg_id}" value="0" style="background:none; border:none; color:#fff; font-weight:800; font-size:16px; text-align:center; width:100%; outline:none;">
                </div>
                <div style="background:#0a0c10; border:1px solid #1f2229; border-radius:8px; padding:8px; text-align:center;">
                    <div style="font-size:10px; color:#7a7f8a; margin-bottom:4px;">Ассисты</div>
                    <input type="number" id="a-${p.tg_id}" value="0" style="background:none; border:none; color:#fff; font-weight:800; font-size:16px; text-align:center; width:100%; outline:none;">
                </div>
            </div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:#0f1115; border:1px solid rgba(255,255,255,0.1); border-radius:24px; width:100%; max-width:500px; margin:auto; overflow:hidden;">
            <!-- Шапка с картой -->
            <div style="position:relative; height:120px; display:flex; align-items:center; justify-content:center;">
                <div style="position:absolute; inset:0; background: url('${mapImg}') center/cover; filter: blur(5px) brightness(0.4); transform: scale(1.1); z-index:0;"></div>
                <div style="position:relative; z-index:1; text-align:center;">
                    <div style="font-size:11px; font-weight:800; color:#00ff88; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">Карта</div>
                    <div style="font-size:24px; font-weight:900; color:#fff; text-transform:uppercase;">${mapName}</div>
                </div>
                <button onclick="document.getElementById('modal-match-stats').style.display='none'" style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.5); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:20px; cursor:pointer; z-index:2;">&times;</button>
            </div>
            
            <div style="padding:20px;">
                <div style="margin-bottom:20px;">
                    <div style="color:#7a7f8a; font-size:11px; margin-bottom:8px; text-transform:uppercase; font-weight:800; letter-spacing:1px;">Кто победил?</div>
                    <div style="display:flex; gap:10px;">
                        <button id="win-A" onclick="selectWinner('A')" style="flex:1; background:rgba(0,255,136,0.1); border:2px solid #00ff88; color:#00ff88; padding:12px; border-radius:12px; font-weight:800; cursor:pointer; font-size:14px;">Команда КТ</button>
                        <button id="win-B" onclick="selectWinner('B')" style="flex:1; background:rgba(255,255,255,0.05); border:2px solid transparent; color:#fff; padding:12px; border-radius:12px; font-weight:800; cursor:pointer; font-size:14px;">Команда Т</button>
                    </div>
                </div>
                
                ${playersHtml}
                
                <button onclick="submitMatchStats(${mid}, [${players.map(p => `'${p.tg_id}'`).join(',')}], '${players.map(p => p.team).join('')}')" style="width:100%; background:#00ff88; color:#000; border:none; padding:16px; border-radius:14px; font-weight:900; font-size:16px; cursor:pointer; margin-top:10px;">Засчитать матч</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    window._selectedWinner = 'A'; // По умолчанию A
};

window.selectWinner = function(team) {
    window._selectedWinner = team;
    $('win-A').style.border = team === 'A' ? '2px solid #00ff88' : '2px solid transparent';
    $('win-A').style.background = team === 'A' ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.05)';
    $('win-A').style.color = team === 'A' ? '#00ff88' : '#fff';
    
    $('win-B').style.border = team === 'B' ? '2px solid #00b8ff' : '2px solid transparent';
    $('win-B').style.background = team === 'B' ? 'rgba(0,184,255,0.1)' : 'rgba(255,255,255,0.05)';
    $('win-B').style.color = team === 'B' ? '#00b8ff' : '#fff';
};

window.submitMatchStats = async function(mid, playerIds, teamsStr) {
    if (!window._selectedWinner) { showToast('Выберите победителя', 'error'); return; }
    
    const players = playerIds.map((tg_id, index) => {
        return {
            tg_id: parseInt(tg_id),
            team: teamsStr[index], // Команда берется по индексу
            kills: parseInt($('k-' + tg_id).value) || 0,
            deaths: parseInt($('d-' + tg_id).value) || 0,
            assists: parseInt($('a-' + tg_id).value) || 0
        };
    });

    const r = await api('/api/matches/' + mid + '/validate', { 
        winner: window._selectedWinner, 
        players: players,
        map: 'Unknown' // Можно добавить поле для карты
    });

    if (r.ok) {
        showToast('Матч засчитан! ELO обновлено.', 'success');
        $('modal-match-stats').style.display = 'none';
        switchAdminTab('matches', document.querySelector('.admin-tab[data-tab="matches"]'));
        
        // Автообновление глобального профиля (ME)
        if (r.updated_user) {
            window.ME = r.updated_user;
        } else {
            const meRes = await api('/api/auth');
            if (meRes.ok) window.ME = meRes.user;
        }
        
        // Если мы на странице профиля - перерисовываем
        if (document.querySelector('.page.active').id === 'page-profile') {
            renderProfile();
        }
    } else {
        showToast(r.error || 'Ошибка', 'error');
    }
};

// ==========================================
// СТИЛИ ДЛЯ ЗАГОЛОВКОВ И ТЕКСТА
// ==========================================
(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .page-h1 {
            position: relative;
            padding-left: 16px;
            margin-bottom: 8px;
        }
        .page-h1::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 4px;
            height: 28px;
            background: #00ff88;
            border-radius: 4px;
        }
        .page-p {
            font-size: 15px;
            color: #9ba1ab;
            line-height: 1.5;
            margin-bottom: 24px;
            max-width: 90%;
        }
    `;
    document.head.appendChild(style);
})();

(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .page-h1 { position: relative; padding-left: 16px; margin-bottom: 8px; font-size: 24px; }
        .page-h1::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 4px; height: 24px; background: #00ff88; border-radius: 4px; }
        .page-p { font-size: 15px; color: #9ba1ab; line-height: 1.5; margin-bottom: 24px; max-width: 95%; }
        .section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #7a7f8a; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; margin: 24px 0 12px 0; }
        .section-title::before { content: ''; width: 4px; height: 14px; background: #00ff88; border-radius: 2px; }
        .history-row { background: #0f1115; border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: 0.2s; }
        .history-row:active { background: #1a1d24; }
    `;
    document.head.appendChild(style);
})();

window.openMatchHistoryDetails = async function(mid) {
    const r = await api('/api/match/' + mid + '/details');
    if (!r.ok) return showToast('Ошибка загрузки', 'error');
    
    const match = r.match;
    const players = r.players;
    
    // Берем карту из матча (если есть), иначе 'mirage'
    // Берем карту из match.map, если она там есть и это не код
    let mapName = 'mirage'; // дефолт
    const rawMap = (match.map || '').toLowerCase();
    if (['mirage', 'inferno', 'vertigo', 'dust2', 'ancient', 'nuke'].includes(rawMap)) {
        mapName = rawMap;
    }
    const mapImg = `/static/img/maps/${mapName}.jpg`;
    
    let modal = $('modal-match-history');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-match-history';
        modal.style.cssText = 'position:fixed; inset:0; background:rgba(5,6,8,0.95); z-index:99999; display:flex; align-items:flex-start; justify-content:center; padding:20px; overflow-y:auto;';
        document.body.appendChild(modal);
    }
    
    const winner = match.winner;
    const scoreA = match.score_a || 0;
    const scoreB = match.score_b || 0;
    
    const renderTeam = (teamName, teamPlayers, teamColor, isWinner) => {
        if (teamPlayers.length === 0) return '';
        
        let rows = teamPlayers.map(p => {
            const kd = (p.kills / (p.deaths || 1)).toFixed(2);
            const kdColor = kd >= 1 ? '#00ff88' : '#ff4444';
            const verifiedBadge = p.verified ? '<img src="/static/img/verified.svg" style="height:0.9em; width:auto; display:inline-block; vertical-align:middle; margin-left:4px;" alt="V">' : '';
            
            return `
                <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.02); align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:32px; height:32px; border-radius:50%; background:#1f2229; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; flex-shrink:0;">${(p.nick || 'U')[0].toUpperCase()}</div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div style="font-weight:700; color:#fff; font-size:13px; display:flex; align-items:center;">
                                ${p.nick} ${verifiedBadge}
                            </div>
                        </div>
                    </div>
                    <div style="font-weight:800; color:#fff; text-align:center;">${p.kills}</div>
                    <div style="font-weight:800; color:${kdColor}; text-align:center;">${kd}</div>
                </div>
            `;
        }).join('');

        return `
            <div style="background:#0f1115; border:1px solid rgba(255,255,255,0.05); border-radius:16px; margin-bottom:16px; overflow:hidden;">
                <div style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:16px; font-weight:900; color:${isWinner ? teamColor : '#fff'};">${teamName}</div>
                    ${isWinner ? '<div style="font-size:11px; color:#00ff88; font-weight:800; background:rgba(0,255,136,0.1); padding:4px 8px; border-radius:4px;">ПОБЕДА</div>' : ''}
                </div>
                <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="font-size:11px; color:#7a7f8a; font-weight:800;">ИГРОК</div>
                    <div style="font-size:11px; color:#7a7f8a; font-weight:800; text-align:center;">УБИЙСТВА</div>
                    <div style="font-size:11px; color:#7a7f8a; font-weight:800; text-align:center;">К/Д</div>
                </div>
                ${rows}
            </div>
        `;
    };

    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');

    // Получаем название команды из игроков (первый в команде)
    const nameA = teamA.length > 0 ? 'КОМАНДА КТ' : 'КОМАНДА КТ';
    const nameB = teamB.length > 0 ? 'КОМАНДА Т' : 'КОМАНДА Т';

    modal.innerHTML = `
        <div style="width:100%; max-width:600px; margin:0 auto; padding-bottom:40px;">
            <button onclick="document.getElementById('modal-match-history').style.display='none'" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:10px 16px; border-radius:12px; font-weight:700; font-size:14px; cursor:pointer; margin-bottom:20px; display:flex; align-items:center; gap:6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Назад
            </button>
            
            <div style="position:relative; border-radius:20px; overflow:hidden; margin-bottom:20px; height:160px; display:flex; align-items:center; justify-content:space-between; padding:0 20px;">
                <div style="position:absolute; inset:0; background: url('${mapImg}') center/cover; filter: blur(2px) brightness(0.5); z-index:0;"></div>
                
                <div style="position:relative; z-index:1; font-size:18px; font-weight:900; color:#00ff88; text-shadow:0 2px 10px rgba(0,0,0,0.8);">КТ</div>
                
                <div style="position:relative; z-index:1; background:rgba(0,0,0,0.7); backdrop-filter:blur(5px); padding:10px 20px; border-radius:12px; font-size:28px; font-weight:900; color:#fff;">
                    ${scoreA} : ${scoreB}
                </div>
                
                <div style="position:relative; z-index:1; font-size:18px; font-weight:900; color:#00b8ff; text-shadow:0 2px 10px rgba(0,0,0,0.8);">Т</div>
            </div>
            
            ${renderTeam('КОМАНДА КТ', teamA, '#00ff88', winner === 'A')}
            ${renderTeam('КОМАНДА Т', teamB, '#00b8ff', winner === 'B')}
        </div>
    `;
    modal.style.display = 'flex';
};

// ==========================================
// ПРАВИЛЬНАЯ ФУНКЦИЯ УРОВНЕЙ FACEIT
// ==========================================
function getFaceitLevelSvg(elo, matchesPlayed, size = 24) {
    // Если size не передан, используем 24
    if (!size || size < 10) size = 24;
    
    let lvl = 11;
    if (matchesPlayed > 0 || elo >= 1000) {
        lvl = Math.max(1, Math.min(10, Math.floor(elo / 300) + 1));
        if (elo < 100) lvl = 1;
    }
    
    const fileName = lvl === 11 ? 'faceit_level_11_calibration.svg' : `faceit_level_${lvl}.svg`;
    
    return `<img src="/static/img/levels/${fileName}" style="width:${size}px; height:${size}px; object-fit:contain; vertical-align:middle; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));" alt="LVL ${lvl}">`;
}




// ==========================================
// ОКНО НАСТРОЕК (ШЕСТЕРЕНКА)
// ==========================================
window.openSettingsModal = function() {
    let modal = document.getElementById('modal-settings-full');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-settings-full';
        modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px;';
        document.body.appendChild(modal);
    }
    
    const isAdmin = window.ME.role === 'admin';
    const cfChanged = window.ME.cf_id_changed === 1;
    const canChangeId = isAdmin || !cfChanged;
    
    modal.innerHTML = `
        <div style="background:#0f1115; border:1px solid rgba(255,255,255,0.1); border-radius:20px; width:100%; max-width:400px; padding:24px; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <div style="font-size:20px; font-weight:900; color:#fff;">Настройки</div>
                <button onclick="document.getElementById('modal-settings-full').style.display='none'" style="background:none; border:none; color:#7a7f8a; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            
            <div style="margin-bottom:16px;">
                <div style="font-size:11px; color:#7a7f8a; margin-bottom:6px; text-transform:uppercase; font-weight:800;">Никнейм</div>
                <input type="text" id="set-nick-modal" value="${window.ME.nick || ''}" maxlength="18" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:12px; border-radius:10px; color:#fff; font-size:14px;">
            </div>
            
            <div style="margin-bottom:16px;">
                <div style="font-size:11px; color:#7a7f8a; margin-bottom:6px; text-transform:uppercase; font-weight:800;">Игровой ID (CounterFlame)</div>
                <input type="text" id="set-cfid-modal" value="${window.ME.cf_id || ''}" maxlength="32" ${canChangeId ? '' : 'disabled'} style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:12px; border-radius:10px; color:${canChangeId ? '#fff' : '#7a7f8a'}; font-size:14px;">
                ${canChangeId ? '' : '<div style="font-size:11px; color:#ff4444; margin-top:6px;">⚠️ Вы можете изменить ID только 1 раз. Вы уже использовали эту возможность.</div>'}
            </div>
            
            <div style="margin-bottom:20px;">
                <div style="font-size:11px; color:#7a7f8a; margin-bottom:6px; text-transform:uppercase; font-weight:800;">Уведомления</div>
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:12px; border-radius:10px;">
                    <div style="color:#fff; font-size:13px;">Включить уведомления</div>
                    <input type="checkbox" id="set-notify-modal" style="width:20px; height:20px; accent-color:#00ff88;" ${window.ME.notify !== 0 ? 'checked' : ''}>
                </div>
            </div>
            
            <button onclick="saveSettingsModal()" style="width:100%; background:#00ff88; color:#000; border:none; padding:14px; border-radius:12px; font-weight:900; font-size:15px; cursor:pointer;">Сохранить</button>
        </div>
    `;
    modal.style.display = 'flex';
};

window.saveSettingsModal = async function() {
    const nick = document.getElementById('set-nick-modal').value.trim();
    const cf_id = document.getElementById('set-cfid-modal').value.trim();
    const notify = document.getElementById('set-notify-modal').checked ? 1 : 0;
    
    if (!nick) return showToast('Введите ник', 'error');
    
    const r = await api('/api/profile/setup', { nick, cf_id, device: window.ME.device, bio: window.ME.bio, notify });
    if (r.ok) {
        window.ME = r.user;
        document.getElementById('modal-settings-full').style.display = 'none';
        renderProfile();
        showToast('Настройки сохранены', 'success');
    } else {
        showToast(r.error || 'Ошибка', 'error');
    }
};

// ==========================================
// ОКНО УВЕДОМЛЕНИЙ (КОЛОКОЛЬЧИК)
// ==========================================
window.openNotifications = async function() {
    let modal = document.getElementById('modal-notifications');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-notifications';
        modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(5px); z-index:99999; display:flex; align-items:flex-start; justify-content:center; padding:20px; padding-top:40px; overflow-y:auto;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        document.body.appendChild(modal);
    }
    
    const r = await api('/api/notifications');
    const notifs = r.ok ? r.notifications : [];
    
    // Помечаем все уведомления как прочитанные (чтобы бейджик исчез)
    await api('/api/notifications/read', {});
    
    // Обновляем бейджик на колокольчике
    if (window.updateNotifBadge) window.updateNotifBadge(0);
    
    let notifsHtml = '';
    if (notifs.length === 0) {
        notifsHtml = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center;">
                <div style="width:64px; height:64px; border-radius:50%; background:rgba(255,255,255,0.03); display:flex; align-items:center; justify-content:center; margin-bottom:16px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7a7f8a" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                </div>
                <div style="color:#fff; font-weight:700; font-size:16px;">Нет уведомлений</div>
                <div style="color:#7a7f8a; font-size:13px; margin-top:4px;">Здесь будут появляться важные события</div>
            </div>
        `;
    } else {
        notifsHtml = notifs.map(n => `
            <div style="display:flex; gap:14px; padding:16px 20px; background:${n.read ? 'transparent' : 'rgba(0,255,136,0.03)'}; border-bottom:1px solid rgba(255,255,255,0.03); position:relative;">
                ${!n.read ? '<div style="position:absolute; left:8px; top:50%; transform:translateY(-50%); width:6px; height:6px; border-radius:50%; background:#00ff88;"></div>' : ''}
                <div style="width:40px; height:40px; border-radius:12px; background:${n.read ? 'rgba(255,255,255,0.03)' : 'rgba(0,255,136,0.1)'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${(() => {
                        const color = n.read ? '#7a7f8a' : '#00ff88';
                        if (n.type === 'verify') return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
                        if (n.type === 'verify_off') return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
                        if (n.type === 'match') return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`;
                        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
                    })()}
                </div>
                <div style="flex:1;">
                    <div style="font-size:14px; color:${n.read ? '#9ba1ab' : '#fff'}; font-weight:${n.read ? '500' : '700'}; line-height:1.4;">${n.text}</div>
                    <div style="font-size:11px; color:#7a7f8a; margin-top:6px; display:flex; align-items:center; gap:4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${n.time}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    modal.innerHTML = `
        <div style="background:#0f1115; border:1px solid rgba(255,255,255,0.08); border-radius:24px; width:100%; max-width:420px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:20px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:4px; height:20px; background:#00ff88; border-radius:2px;"></div>
                    <div style="font-size:18px; font-weight:900; color:#fff;">Уведомления</div>
                </div>
                <button onclick="document.getElementById('modal-notifications').style.display='none'" style="width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.05); border:none; color:#7a7f8a; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
            </div>
            <div style="overflow-y:auto; max-height:60vh;">
                ${notifsHtml}
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

// ==========================================
// ВОССТАНОВЛЕНИЕ ЛОББИ (ПОСЛЕ СЛОМАННОГО РЕЙТИНГА)
// ==========================================
async function renderLobbies() {
    const box = $('lobbies-list');
    if (!box) return;
    const r = await api('/api/lobbies');
    if (!r.ok || !r.lobbies.length) {
        box.innerHTML = '<div style="color:#7a7f8a; text-align:center; grid-column: 1/-1; padding:20px;">Нет лобби. Подождите...</div>';
        return;
    }
    box.innerHTML = r.lobbies.map((l, index) => {
        let playersHtml = '';
        l.players.forEach((p, i) => {
            const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#00b8ff'];
            const color = colors[i % colors.length];
            playersHtml += `<div style="display:flex; align-items:center; gap:8px; background:#12141a; padding:8px; border-radius:8px; margin-bottom:4px;"><div style="width:24px; height:24px; border-radius:6px; background:${color}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold;">${(p.nick || 'U')[0].toUpperCase()}</div><span style="font-size:13px;">${p.nick || 'User'}</span></div>`;
        });
        if (l.filled === 0) playersHtml = '<div style="color:#7a7f8a; font-size:12px; padding:8px;">Ожидание игроков...</div>';
        
        return `<div class="lobby-card" style="background:var(--glass-bg); border:1px solid var(--glass-border); backdrop-filter: blur(16px); border-radius:20px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="font-size:20px; font-weight:800;">Лобби #${index + 1}</div>
                    <div style="color:#00ff88; font-size:12px; font-weight:bold;">${l.filled}/${l.capacity}</div>
                </div>
                <div style="color:#7a7f8a; font-size:11px; margin-bottom:12px;">${l.mode || ''}</div>
                <div style="display:flex; gap:4px; margin-bottom:16px;">
                    ${Array.from({length: l.capacity}).map((_, i) => `<div style="flex:1; height:4px; background:${i < l.filled ? '#00ff88' : '#222'}; border-radius:2px;"></div>`).join('')}
                </div>
                <div style="margin-bottom:16px; min-height: 40px;">${playersHtml}</div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="color:#7a7f8a; font-size:11px;">Нажми «Войти»</div>
                <button class="btn-primary" style="padding:8px 16px; font-size:13px;" onclick="joinLobby(${l.id})">Войти</button>
            </div>
        </div>`;
    }).join('');
}

async function joinLobby(id) {
    const r = await api('/api/lobbies/join', { lobby_id: id });
    if (r.ok) { openRoom(id); showToast('Вы вошли в лобби', 'success'); }
    else showToast(r.error || 'Ошибка входа', 'error');
}

async function leaveLobby() {
    const lid = window.CUR_LOBBY;
    if (!lid) return;
    const r = await api('/api/lobbies/exit', { lobby_id: lid });
    if (r.ok) { stopRoom(); window.CUR_LOBBY = null; show('lobbies'); showToast('Вы вышли', 'info'); }
    else { showToast(r.error || 'Нельзя выйти сейчас', 'error'); show('lobbies'); }
}

function stopRoom() { if (window.ROOM_TIMER) { clearInterval(window.ROOM_TIMER); window.ROOM_TIMER = null; } }

async function openRoom(id) {
    window.CUR_LOBBY = id;
    show('room');
    await refreshRoom(id);
    stopRoom();
    window.ROOM_TIMER = setInterval(() => refreshRoom(id), 1500);
}

async function refreshRoom(id) {
    const r = await api('/api/lobby/' + id);
    if (!r.ok) { stopRoom(); show('lobbies'); return; }
    const L = r.lobby, P = r.players;

    const roomPage = $('page-room');
    let mapHeader = $('room-map-header');
    
    if (L.final_map && ['prep', 'playing', 'finished'].includes(L.status)) {
        const mapNames = { 'mirage': 'MIRAGE', 'inferno': 'INFERNO', 'vertigo': 'VERTIGO', 'dust2': 'DUST 2' };
        const mapName = mapNames[L.final_map] || L.final_map.toUpperCase();
        
        if (!mapHeader) {
            mapHeader = document.createElement('div');
            mapHeader.id = 'room-map-header';
            mapHeader.style.cssText = "position: relative; margin: 10px 0 20px 0; border-radius: 16px; overflow: hidden; min-height: 120px; display: flex; flex-direction: column; justify-content: center; padding: 20px; border: 1px solid rgba(255,255,255,0.1);";
            const roomName = $('room-name');
            if (roomName) roomName.parentNode.insertBefore(mapHeader, roomName);
            else roomPage.prepend(mapHeader);
        }
        
        $('room-name').style.display = 'none';
        $('room-mode').style.display = 'none';
        $('room-score').style.display = 'none';
        
        mapHeader.innerHTML = `
            <div style="position:absolute; inset:0; background: url('/static/img/maps/${L.final_map}.jpg') center/cover; filter: blur(5px) brightness(0.4); transform: scale(1.1); z-index:0;"></div>
            <div style="position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <div style="font-size: 24px; font-weight: 900; color: #fff;">${L.name || 'Лобби'}</div>
                    <div style="font-size: 13px; color: #7a7f8a; margin-top: 4px;">${L.mode || ''} · ${L.status === 'playing' ? 'Матч идёт' : 'Подготовка'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size: 11px; font-weight: 800; color: #00ff88; letter-spacing: 1px; text-transform: uppercase;">Карта</div>
                    <div style="font-size: 20px; font-weight: 900; color: #fff; text-transform: uppercase;">${mapName}</div>
                    <div style="font-size: 16px; font-weight: 900; color: #00b8ff; margin-top: 4px;">${P.length} / ${L.capacity}</div>
                </div>
            </div>
        `;
    } else {
        if (mapHeader) mapHeader.remove();
        $('room-name').style.display = 'block';
        $('room-mode').style.display = 'block';
        $('room-score').style.display = 'block';
        $('room-name').textContent = `Лобби #${L.id}`;
        $('room-mode').textContent = L.mode || '';
        $('room-score').textContent = `${P.length} / ${L.capacity}`;
    }

    const badge = $('room-status-badge');
    if (badge) {
        if (L.status === 'waiting') badge.textContent = 'Набор';
        else if (L.status === 'confirm') badge.textContent = 'Подтверждение';
        else if (L.status === 'veto') badge.textContent = 'Вето карт';
        else if (L.status === 'prep') badge.textContent = 'Подготовка';
        else if (L.status === 'playing') badge.textContent = 'Матч идёт';
    }

    const renderTeam = (team) => {
        const filtered = P.filter(p => p.team === team);
        let html = filtered.map(p => {
            const lvl = Math.max(1, Math.min(10, Math.floor((p.elo || 1000) / 300) + 1));
            const verifiedBadge = p.verified ? '<img src="/static/img/verified.svg" style="height:0.9em; width:auto; display:inline-block; vertical-align:middle; margin-left:4px;" alt="V">' : '';
            return `
            <div class="player-slot ${p.tg_id === window.ME?.tg_id ? 'me' : ''}" onclick="openPlayerProfile(${p.tg_id})" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:36px; height:36px; border-radius:50%; background:#8b5cf6; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:14px;">
                        ${(p.nick || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight:700; color:#fff; font-size:14px; display:flex; align-items:center;">
                            ${p.nick || 'User'} ${verifiedBadge}
                        </div>
                        <div style="font-size:11px; color:#7a7f8a;">${p.device || 'PC'}</div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                    <div style="font-size:12px; font-weight:900; color:#00b8ff;">${p.elo} ELO</div>
                    <div class="player-lvl" style="background:transparent; padding:0;">${getFaceitLevelSvg(p.elo, 1, 24)}</div>
                </div>
            </div>`;
        }).join('');
        for (let i = filtered.length; i < L.capacity / 2; i++) html += `<div class="player-slot empty" style="background:transparent; border:1px dashed rgba(255,255,255,0.1); color:#7a7f8a; font-size:12px; display:flex; align-items:center; justify-content:center; padding:12px; border-radius:12px; margin-bottom:8px;">Свободно</div>`;
        return html;
    };
    $('team-a').innerHTML = renderTeam('A');
    $('team-b').innerHTML = renderTeam('B');

    const blocks = ['waiting-phase', 'confirm-phase', 'match-phase'];
    blocks.forEach(id => { if($(id)) $(id).style.display = 'none'; });

    if (L.status === 'waiting') { if($('waiting-phase')) $('waiting-phase').style.display = 'block'; }
    else if (L.status === 'confirm') { if($('confirm-phase')) $('confirm-phase').style.display = 'block'; }
    else if (['prep', 'playing'].includes(L.status)) {
        if($('match-phase')) {
            $('match-phase').style.display = 'block';
            $('match-code').textContent = L.game_code || '—';
            const isHost = L.host_id === window.ME?.tg_id;
            $('code-edit').style.display = isHost ? 'flex' : 'none';
            $('btn-start-match').style.display = isHost ? 'block' : 'none';
        }
    }

    const chatBox = $('room-chat');
    if (chatBox) {
        if (!r.chat.length) chatBox.innerHTML = 'Напиши первым';
        else {
            chatBox.innerHTML = r.chat.map(m => `<div class="chat-msg ${m.tg_id === window.ME?.tg_id ? 'me' : ''}"><div class="chat-author">${m.nick || 'Игрок'}</div><div class="chat-text">${m.text}</div></div>`).join('');
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    if (L.status === 'veto') {
        show('veto');
        renderVetoPage(L, r.my_team);
    } else if (L.status === 'prep' || L.status === 'playing') {
        if (document.querySelector('.page.active').id === 'page-veto') show('room');
    }
}

window.openPlayerProfile = async function(tgId) {
    console.log('Открываем профиль для', tgId);
    let modal = document.getElementById('modal-player-profile');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-player-profile';
        modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div style="background:#0f1115; border-radius:20px; width:100%; max-width:340px; padding:24px; text-align:center;">
            <div style="font-size:20px; font-weight:900; color:#fff;">Игрок #${tgId}</div>
            <div style="color:#7a7f8a; margin-top:8px;">Загрузка...</div>
        </div>
    `;
    modal.style.display = 'flex';
    
    // Пытаемся получить данные из /api/top
    try {
        const r = await api('/api/top');
        if (r.ok) {
            const player = r.players.find(p => p.tg_id === tgId);
            if (player) {
                modal.innerHTML = `
                    <div style="background:#0f1115; border-radius:20px; width:100%; max-width:340px; padding:24px; text-align:center;">
                        <div style="width:80px; height:80px; border-radius:50%; background:#00b8ff; color:#fff; display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:900; margin:0 auto 16px;">${(player.nick||'U')[0].toUpperCase()}</div>
                        <div style="font-size:20px; font-weight:900; color:#fff;">${player.nick}</div>
                        <div style="color:#00b8ff; font-weight:800; font-size:18px; margin-top:8px;">${player.elo} ELO</div>
                    </div>
                `;
            }
        }
    } catch(e) {}
};
