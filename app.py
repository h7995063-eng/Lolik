from flask import Flask, render_template, jsonify, request
import sqlite3, os, hmac, hashlib, json, time, requests
from werkzeug.utils import secure_filename
from urllib.parse import parse_qsl

app = Flask(__name__)
BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, 'data', 'faceit.db')
BOT_TOKEN = os.environ.get("BOT_TOKEN")

def get_db():
    conn = sqlite3.connect(DB, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn



def add_notification(tg_id, text, notif_type='system'):
    conn = get_db()
    conn.execute("INSERT INTO notifications (tg_id, text, type, created) VALUES (?, ?, ?, ?)", (tg_id, text, notif_type, time.time()))
    conn.commit()
    conn.close()

def is_admin(tg_id):
    conn = get_db()
    r = conn.execute("SELECT role FROM users WHERE tg_id=?", (tg_id,)).fetchone()
    conn.close()
    return r and r['role'] == 'admin'

def check_init_data(init_data):
    if not init_data: return None
    try:
        data = dict(parse_qsl(init_data, keep_blank_values=True))
        hash_ = data.pop('hash', None)
        if not hash_: return None
        check_str = '\n'.join(f"{k}={v}" for k, v in sorted(data.items()))
        secret = hmac.new(b'WebAppData', BOT_TOKEN.encode(), hashlib.sha256).digest()
        calc = hmac.new(secret, check_str.encode(), hashlib.sha256).hexdigest()
        if calc != hash_: return None
        return json.loads(data['user']) if 'user' in data else None
    except Exception:
        return None

def get_me():
    try:
        if request.method == 'POST' and request.is_json:
            init_data = request.json.get('init_data')
        else:
            init_data = request.headers.get('X-Init-Data') or request.args.get('init_data')
    except Exception:
        init_data = None
    return check_init_data(init_data)

@app.route('/')
def index(): return render_template('index.html')







@app.route('/api/auth', methods=['POST'])
def api_auth():
    u = get_me()
    if not u: return jsonify({'ok': False, 'error': 'Нет доступа. Откройте через Telegram.'}), 401
    
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE tg_id=?", (u['id'],)).fetchone()
    
    if not user:
        # Создаем нового юзера, но без ника (ждем регистрации)
        conn.execute("INSERT INTO users (tg_id, created) VALUES (?, ?)", (u['id'], time.time()))
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE tg_id=?", (u['id'],)).fetchone()
    
    if user['banned']:
        return jsonify({'ok': False, 'error': 'Вы забанены.'}), 403
        
    conn.close()
    return jsonify({'ok': True, 'user': dict(user)})







@app.route('/api/profile/setup', methods=['POST'])
def api_profile_setup():
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    body = request.get_json()

    nick = (body.get('nick') or '').strip().replace(' ', '_')
    if len(nick) < 3 or len(nick) > 18:
        return jsonify({'ok': False, 'error': 'Ник от 3 до 18 символов'}), 400

    conn = get_db()
    # Проверка уникальности ника
    exist = conn.execute("SELECT tg_id FROM users WHERE nick = ? COLLATE NOCASE AND tg_id != ?", (nick, u['id'])).fetchone()
    if exist:
        conn.close()
        return jsonify({'ok': False, 'error': 'Этот ник уже занят'}), 400

    cf_id = (body.get('cf_id') or '').strip()
    
    # Получаем текущие данные пользователя
    user_row = conn.execute("SELECT cf_id, cf_id_changed, role FROM users WHERE tg_id=?", (u['id'],)).fetchone()
    is_admin = user_row['role'] == 'admin'
    old_cf_id = user_row['cf_id'] or ''
    cf_id_changed = user_row['cf_id_changed'] or 0
    
    # Проверка на смену ID
    if old_cf_id != cf_id and not is_admin:
        if cf_id_changed == 1:
            conn.close()
            return jsonify({'ok': False, 'error': 'Вы уже меняли ID. Обратитесь к администратору.'}), 400
        else:
            # Первая смена ID — ставим флаг
            conn.execute("UPDATE users SET cf_id_changed=1 WHERE tg_id=?", (u['id'],))
    
    # Обновляем профиль (включая notify)
    conn.execute("""UPDATE users SET nick=?, cf_id=?, bio=?, device=?, notify=? WHERE tg_id=?""",
                 (nick, cf_id, body.get('bio', ''), body.get('device', 'PC'), body.get('notify', 1), u['id']))
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE tg_id=?", (u['id'],)).fetchone()
    conn.close()
    return jsonify({'ok': True, 'user': dict(row)})

@app.route('/api/profile/history')
def api_profile_history():
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    conn = get_db()
    rows = conn.execute("SELECT * FROM match_history WHERE tg_id=? ORDER BY id DESC LIMIT 20", (u['id'],)).fetchall()
    conn.close()
    return jsonify({'ok': True, 'history': [dict(r) for r in rows]})







@app.route('/api/top')
def api_top():
    conn = get_db()
    rows = conn.execute("SELECT tg_id, nick, cf_id, elo, wins, losses, kills, deaths, assists, verified FROM users WHERE nick IS NOT NULL ORDER BY elo DESC LIMIT 100").fetchall()
    conn.close()
    return jsonify({'ok': True, 'players': [dict(r) for r in rows]})


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS users (
        tg_id INTEGER PRIMARY KEY, nick TEXT UNIQUE COLLATE NOCASE, cf_id TEXT,
        bio TEXT DEFAULT '', device TEXT DEFAULT 'PC', elo INTEGER DEFAULT 1000,
        wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0, assists INTEGER DEFAULT 0, streak INTEGER DEFAULT 0,
        role TEXT DEFAULT 'user', banned INTEGER DEFAULT 0, verified INTEGER DEFAULT 0,
        avatar TEXT, cover TEXT, created REAL)""")
    c.execute("""CREATE TABLE IF NOT EXISTS match_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tg_id INTEGER, match_id INTEGER,
        result TEXT, map TEXT, kills INTEGER, deaths INTEGER, assists INTEGER,
        elo_change INTEGER, created REAL)""")
    c.execute("""CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tg_id INTEGER, text TEXT,
        read INTEGER DEFAULT 0, created REAL)""")
    c.execute("""CREATE TABLE IF NOT EXISTS badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, icon TEXT, color TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS user_badges (
        tg_id INTEGER, badge_id INTEGER, UNIQUE(tg_id, badge_id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS ads (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT, subtitle TEXT, title TEXT,
        btn_text TEXT, color TEXT, active INTEGER DEFAULT 1)""")
    c.execute("""CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, text TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, tg_id INTEGER,
        data TEXT, status TEXT DEFAULT 'pending', created REAL)""")
    conn.commit()
    conn.close()








@app.route('/api/lobbies')
def api_lobbies():
    conn = get_db()
    lobbies = conn.execute("SELECT * FROM lobbies WHERE status IN ('waiting', 'confirm', 'veto', 'prep', 'playing') ORDER BY id DESC").fetchall()
    result = []
    for l in lobbies:
        # Получаем игроков для этого лобби
        players = conn.execute("""SELECT u.nick, u.elo, u.tg_id, u.verified, lp.team, lp.is_host, lp.ready 
            FROM lobby_players lp LEFT JOIN users u ON u.tg_id = lp.tg_id 
            WHERE lp.lobby_id = ? ORDER BY lp.id""", (l['id'],)).fetchall()
        result.append({
            'id': l['id'], 'name': l['name'], 'mode': l['mode'], 'capacity': l['capacity'],
            'status': l['status'], 'filled': len(players),
            'players': [dict(p) for p in players]
        })
    conn.close()
    return jsonify({'ok': True, 'lobbies': result})








@app.route('/api/lobbies/create', methods=['POST'])
def api_lobby_create():
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    body = request.get_json()
    mode = body.get('mode', '1x1')
    cap = int(body.get('capacity', 2))
    name = body.get('name', 'Новое лобби')
    conn = get_db()
    cur = conn.execute("INSERT INTO lobbies (name, mode, capacity, status, host_id, created, game_code, veto_state, veto_turn) VALUES (?,?,?,?,?,?,?,?,?)",
                       (name, mode, cap, 'waiting', u['id'], time.time(), None, '[]', 'A'))
    lid = cur.lastrowid
    conn.execute("DELETE FROM lobby_chat WHERE lobby_id=?", (lid,))
    conn.execute("INSERT INTO lobby_players (lobby_id, tg_id, team, is_host, joined) VALUES (?,?,?,?,?)",
                 (lid, u['id'], 'A', 1, time.time()))
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'id': lid})







@app.route('/api/lobbies/join', methods=['POST'])
def api_lobby_join():
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    body = request.get_json()
    lid = int(body.get('lobby_id'))
    
    conn = get_db()
    lobby = conn.execute("SELECT * FROM lobbies WHERE id=?", (lid,)).fetchone()
    if not lobby: conn.close(); return jsonify({'ok': False, 'error': 'Лобби не найдено'}), 404
    
    # Проверяем, есть ли ты уже в этом лобби
    existing = conn.execute("SELECT * FROM lobby_players WHERE lobby_id=? AND tg_id=?", (lid, u['id'])).fetchone()
    if existing:
        # Если был отшедшим (ready=-1), просто возвращаем в строй
        if existing['ready'] == -1:
            conn.execute("UPDATE lobby_players SET ready=0 WHERE id=?", (existing['id'],))
        conn.commit(); conn.close()
        return jsonify({'ok': True, 'team': existing['team']})
    
    # Авто-выход из других лобби
    conn.execute("DELETE FROM lobby_players WHERE tg_id=? AND lobby_id != ?", (u['id'], lid))
    
    # Проверка заполненности
    players = conn.execute("SELECT team FROM lobby_players WHERE lobby_id=?", (lid,)).fetchall()
    if len(players) >= lobby['capacity']:
        conn.close(); return jsonify({'ok': False, 'error': 'Лобби заполнено'}), 400
    
    # Распределение по командам
    team_a = sum(1 for p in players if p['team'] == 'A')
    team_b = sum(1 for p in players if p['team'] == 'B')
    team = 'A' if team_a <= team_b else 'B'
    
    # Назначаем хоста, если его нет
    host_exists = conn.execute("SELECT 1 FROM lobby_players WHERE lobby_id=? AND is_host=1", (lid,)).fetchone()
    is_host = 0 if host_exists else 1
    if is_host:
        conn.execute("UPDATE lobbies SET host_id=? WHERE id=?", (u['id'], lid))
    
    conn.execute("INSERT INTO lobby_players (lobby_id, tg_id, team, is_host, joined) VALUES (?,?,?,?,?)",
                 (lid, u['id'], team, is_host, time.time()))
    
    # Проверяем, заполнилось ли лобби
    total = conn.execute("SELECT COUNT(*) c FROM lobby_players WHERE lobby_id=?", (lid,)).fetchone()['c']
    if total >= lobby['capacity']:
        conn.execute("UPDATE lobbies SET status='confirm', confirm_until=? WHERE id=?", (time.time() + 60, lid))
    
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'team': team})







@app.route('/api/lobbies/leave', methods=['POST'])
def api_lobby_leave():
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    body = request.get_json()
    lid = int(body.get('lobby_id'))
    
    conn = get_db()
    # Вместо удаления, ставим статус "отошел" (ready=-1)
    # При этом, если игроков больше нет - лобби остается пустым
    conn.execute("UPDATE lobby_players SET ready=-1 WHERE lobby_id=? AND tg_id=?", (lid, u['id']))
    
    # Если был хостом - назначаем нового (если есть)
    lobby = conn.execute("SELECT host_id FROM lobbies WHERE id=?", (lid,)).fetchone()
    if lobby and lobby['host_id'] == u['id']:
        next_p = conn.execute("SELECT tg_id FROM lobby_players WHERE lobby_id=? AND ready != -1 ORDER BY joined ASC LIMIT 1", (lid,)).fetchone()
        if next_p:
            conn.execute("UPDATE lobbies SET host_id=? WHERE id=?", (next_p['tg_id'], lid))
            conn.execute("UPDATE lobby_players SET is_host=1 WHERE lobby_id=? AND tg_id=?", (lid, next_p['tg_id']))
        else:
            conn.execute("UPDATE lobbies SET host_id=NULL, status='waiting' WHERE id=?", (lid,))
    
    conn.commit(); conn.close()
    return jsonify({'ok': True})







@app.route('/api/lobby/<int:lid>')
def api_lobby_details(lid):
    u = get_me()
    conn = get_db()
    lobby = conn.execute("SELECT * FROM lobbies WHERE id=?", (lid,)).fetchone()
    if not lobby: conn.close(); return jsonify({'ok': False, 'error': 'Лобби не найдено'}), 404
    
    # Проверяем таймер
    if lobby['status'] == 'confirm' and lobby['confirm_until']:
        if time.time() > lobby['confirm_until']:
            # Время вышло — сбрасываем лобби в waiting
            conn.execute("UPDATE lobbies SET status='waiting', confirm_until=NULL WHERE id=?", (lid,))
            conn.execute("UPDATE lobby_players SET ready=0 WHERE lobby_id=?", (lid,))
            conn.commit()
            lobby = conn.execute("SELECT * FROM lobbies WHERE id=?", (lid,)).fetchone()
    
    players = conn.execute("""SELECT lp.tg_id, lp.team, lp.is_host, lp.ready, u.nick, u.elo, u.device, u.verified 
        FROM lobby_players lp LEFT JOIN users u ON u.tg_id=lp.tg_id WHERE lp.lobby_id=? ORDER BY lp.id""", (lid,)).fetchall()
    chat = conn.execute("SELECT * FROM lobby_chat WHERE lobby_id=? ORDER BY id DESC LIMIT 80", (lid,)).fetchall()
    
    my_team = None
    if u:
        for p in players:
            if p['tg_id'] == u['id']:
                my_team = p['team']
                break
    
    # Вычисляем финальную карту
    final_map = None
    if lobby['status'] in ('prep', 'playing', 'finished'):
        try:
            vetoed = json.loads(lobby['veto_state'] or '[]')
            all_maps = ['mirage', 'inferno', 'vertigo', 'dust2']
            remaining = [m for m in all_maps if m not in vetoed]
            if remaining: final_map = remaining[0]
        except: pass

    lobby_dict = dict(lobby)
    lobby_dict['final_map'] = final_map

    conn.close()
    return jsonify({
        'ok': True,
        'lobby': lobby_dict,
        'players': [dict(p) for p in players],
        'chat': [dict(c) for c in reversed(chat)],
        'my_team': my_team
    })







@app.route('/api/lobby/<int:lid>/chat', methods=['POST'])
def api_lobby_chat(lid):
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    body = request.get_json()
    text = (body.get('text') or '').strip()[:200]
    if not text: return jsonify({'ok': False}), 400
    
    conn = get_db()
    usr = conn.execute("SELECT nick FROM users WHERE tg_id=?", (u['id'],)).fetchone()
    nick = usr['nick'] if usr else f"User{u['id']%1000}"
    conn.execute("INSERT INTO lobby_chat (lobby_id, tg_id, nick, text, created) VALUES (?,?,?,?,?)",
                 (lid, u['id'], nick, text, time.time()))
    conn.commit(); conn.close()
    return jsonify({'ok': True})







@app.route('/api/lobby/<int:lid>/ready', methods=['POST'])
def api_lobby_ready(lid):
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    conn = get_db()
    conn.execute("UPDATE lobby_players SET ready=1 WHERE lobby_id=? AND tg_id=?", (lid, u['id']))
    total = conn.execute("SELECT COUNT(*) c FROM lobby_players WHERE lobby_id=?", (lid,)).fetchone()['c']
    ready = conn.execute("SELECT COUNT(*) c FROM lobby_players WHERE lobby_id=? AND ready=1", (lid,)).fetchone()['c']
    
    if total == lobby['capacity'] and ready == total:
        conn.execute("UPDATE lobbies SET status='confirm', confirm_until=? WHERE id=?", (time.time() + 60, lid))
    
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'ready': ready, 'total': total})







@app.route('/api/lobby/<int:lid>/confirm', methods=['POST'])
def api_lobby_confirm(lid):
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    conn = get_db()
    conn.execute("UPDATE lobby_players SET ready=1 WHERE lobby_id=? AND tg_id=?", (lid, u['id']))
    
    total = conn.execute("SELECT COUNT(*) c FROM lobby_players WHERE lobby_id=?", (lid,)).fetchone()['c']
    ready = conn.execute("SELECT COUNT(*) c FROM lobby_players WHERE lobby_id=? AND ready=1", (lid,)).fetchone()['c']
    
    if total == ready:
        # Все подтвердили — переходим в вето
        conn.execute("UPDATE lobbies SET status='veto', veto_turn='A', veto_state='[]' WHERE id=?", (lid,))
        conn.execute("UPDATE lobby_players SET ready=0 WHERE lobby_id=?", (lid,))
    
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'ready': ready, 'total': total})







@app.route('/api/lobby/<int:lid>/veto', methods=['POST'])
def api_lobby_veto(lid):
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    body = request.get_json()
    map_id = body.get('map')
    
    conn = get_db()
    lobby = conn.execute("SELECT * FROM lobbies WHERE id=?", (lid,)).fetchone()
    if not lobby: conn.close(); return jsonify({'ok': False}), 404
    
    player = conn.execute("SELECT team FROM lobby_players WHERE lobby_id=? AND tg_id=?", (lid, u['id'])).fetchone()
    if not player: conn.close(); return jsonify({'ok': False}), 403
    
    state = json.loads(lobby['veto_state'] or '[]')
    turn = lobby['veto_turn'] or 'A'
    if player['team'] != turn:
        conn.close(); return jsonify({'ok': False, 'error': 'Не твой ход'}), 400
    if map_id in state:
        conn.close(); return jsonify({'ok': False, 'error': 'Карта уже забанена'}), 400
    
    state.append(map_id)
    idx = len(state)
    # Для 4 карт делаем 3 бана (A, B, A) -> остается 1 финальная
    BAN_SEQUENCE = ['A', 'B', 'A']
    next_turn = 'ready' if idx >= len(BAN_SEQUENCE) else BAN_SEQUENCE[idx]
    
    if next_turn == 'ready':
        # Вето закончено — переходим в подготовку (код игры)
        conn.execute("UPDATE lobbies SET veto_state=?, veto_turn=?, status='prep' WHERE id=?", (json.dumps(state), next_turn, lid))
    else:
        conn.execute("UPDATE lobbies SET veto_state=?, veto_turn=? WHERE id=?", (json.dumps(state), next_turn, lid))
    
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'state': state, 'turn': next_turn})







@app.route('/api/lobby/<int:lid>/code/update', methods=['POST'])
def api_lobby_code_update(lid):
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    body = request.get_json()
    code = (body.get('code') or '').strip()[:50]
    
    conn = get_db()
    lobby = conn.execute("SELECT host_id FROM lobbies WHERE id=?", (lid,)).fetchone()
    if not lobby or lobby['host_id'] != u['id']:
        conn.close(); return jsonify({'ok': False, 'error': 'Только хост может менять код'}), 403
    
    conn.execute("UPDATE lobbies SET game_code=? WHERE id=?", (code, lid))
    conn.commit(); conn.close()
    return jsonify({'ok': True})







@app.route('/api/lobby/<int:lid>/match/start', methods=['POST'])
def api_lobby_match_start(lid):
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    conn = get_db()
    lobby = conn.execute("SELECT * FROM lobbies WHERE id=?", (lid,)).fetchone()
    if lobby['host_id'] != u['id']:
        conn.close(); return jsonify({'ok': False, 'error': 'Только хост может начать матч'}), 403
    
    # Проверяем, есть ли код
    if not lobby['game_code']:
        conn.close(); return jsonify({'ok': False, 'error': 'Сначала введите код матча'}), 400
    # (Код уже есть, мы его не чистим, чтобы игроки видели его во время матча)
    
    # Создаем матч
    cur = conn.execute("INSERT INTO matches (lobby_id, map, status, created) VALUES (?,?,?,?)",
                       (lid, lobby['game_code'], 'pending', time.time()))
    mid = cur.lastrowid
    
    # Добавляем игроков в матч
    players = conn.execute("SELECT tg_id, team FROM lobby_players WHERE lobby_id=?", (lid,)).fetchall()
    for p in players:
        conn.execute("INSERT INTO match_players (match_id, tg_id, team) VALUES (?,?,?)", (mid, p['tg_id'], p['team']))
    
    conn.execute("UPDATE lobbies SET status='playing' WHERE id=?", (lid,))
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'match_id': mid})







@app.route('/api/lobby/<int:lid>/screenshot', methods=['POST'])
def api_lobby_screenshot(lid):
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    
    if 'screenshot' not in request.files:
        return jsonify({'ok': False, 'error': 'Файл не найден'}), 400
        
    file = request.files['screenshot']
    if file.filename == '':
        return jsonify({'ok': False, 'error': 'Пустое имя файла'}), 400
        
    if file:
        filename = f"match_{lid}_{u['id']}_{int(time.time())}.jpg"
        filepath = os.path.join(BASE, 'uploads', filename)
        file.save(filepath)
        
        conn = get_db()
        # Сохраняем путь к скрину в БД
        conn.execute("UPDATE match_players SET screenshot=? WHERE match_id=(SELECT id FROM matches WHERE lobby_id=? AND status='pending') AND tg_id=?", (filename, lid, u['id']))
        
        # Получаем инфу о матче для админа
        match = conn.execute("SELECT id FROM matches WHERE lobby_id=? AND status='pending'", (lid,)).fetchone()
        if match:
            mid = match['id']
            players = conn.execute("SELECT mp.tg_id, u.nick FROM match_players mp JOIN users u ON u.tg_id=mp.tg_id WHERE mp.match_id=?", (mid,)).fetchall()
            players_text = "\n".join([f"• {p['nick']}" for p in players])
            
            # Отправляем админу в ТГ
            admins = conn.execute("SELECT tg_id FROM users WHERE role='admin'").fetchall()
            for adm in admins:
                try:
                    text = f"📸 Новый скриншот для матча #{mid} (Лобби #{lid})\n\nИгроки:\n{players_text}\n\nПроверить результат?"
                    markup = {
                        "inline_keyboard": [[
                            {"text": "✅ Засчитать", "callback_data": f"validate_{mid}"},
                            {"text": "❌ Отклонить", "callback_data": f"reject_{mid}"}
                        ]]
                    }
                    send_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
                    with open(filepath, 'rb') as f_photo:
                        requests.post(send_url, data={'chat_id': adm['tg_id'], 'caption': text, 'reply_markup': json.dumps(markup)}, files={'photo': f_photo})
                except Exception as e:
                    print("Error sending to admin:", e)
                    
        conn.commit()
        conn.close()
        return jsonify({'ok': True, 'file': filename})
    return jsonify({'ok': False}), 400










@app.route('/api/stats')
def api_stats():
    conn = get_db()
    online = conn.execute("SELECT COUNT(DISTINCT tg_id) c FROM lobby_players").fetchone()['c']
    lobbies = conn.execute("SELECT COUNT(*) c FROM lobbies WHERE status IN ('waiting','confirm','veto')").fetchone()['c']
    # Считаем матчи за сегодня
    try:
        matches = conn.execute("SELECT COUNT(*) c FROM match_history WHERE date(created, 'unixepoch') = date('now')").fetchone()['c']
    except:
        matches = 0
    conn.close()
    return jsonify({'ok': True, 'online': online, 'lobbies': lobbies, 'matches': matches, 'matches_today': matches})








@app.route('/api/lobbies/exit', methods=['POST'])
def api_lobby_exit():
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    body = request.get_json()
    lid = int(body.get('lobby_id'))
    
    conn = get_db()
    lobby = conn.execute("SELECT status FROM lobbies WHERE id=?", (lid,)).fetchone()
    if not lobby:
        conn.close(); return jsonify({'ok': False, 'error': 'Лобби не найдено'}), 404
    
    if lobby['status'] in ('confirm', 'veto', 'prep', 'playing'):
        conn.close()
        return jsonify({'ok': False, 'error': 'Нельзя выйти во время матча! Вернитесь после игры.'}), 400
    
    # Полностью удаляем игрока из лобби
    conn.execute("DELETE FROM lobby_players WHERE lobby_id=? AND tg_id=?", (lid, u['id']))
    
    # Если был хостом - назначаем нового или сбрасываем
    lobby_host = conn.execute("SELECT host_id FROM lobbies WHERE id=?", (lid,)).fetchone()
    if lobby_host and lobby_host['host_id'] == u['id']:
        next_p = conn.execute("SELECT tg_id FROM lobby_players WHERE lobby_id=? ORDER BY joined ASC LIMIT 1", (lid,)).fetchone()
        if next_p:
            conn.execute("UPDATE lobbies SET host_id=? WHERE id=?", (next_p['tg_id'], lid))
            conn.execute("UPDATE lobby_players SET is_host=1 WHERE lobby_id=? AND tg_id=?", (lid, next_p['tg_id']))
        else:
            conn.execute("UPDATE lobbies SET host_id=NULL, status='waiting' WHERE id=?", (lid,))
    
    # Проверяем, не развалилось ли лобби
    total = conn.execute("SELECT COUNT(*) c FROM lobby_players WHERE lobby_id=?", (lid,)).fetchone()['c']
    if total < 2:
        conn.execute("UPDATE lobbies SET status='waiting' WHERE id=?", (lid,))
    
    conn.commit(); conn.close()
    return jsonify({'ok': True})








@app.route('/api/lobby/<int:lid>/reset', methods=['POST'])
def api_lobby_reset(lid):
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    conn = get_db()
    conn.execute("UPDATE lobbies SET status='waiting', confirm_until=NULL, veto_state='[]', veto_turn='A', game_code=NULL, host_id=(SELECT tg_id FROM lobby_players WHERE lobby_id=? ORDER BY id ASC LIMIT 1) WHERE id=?", (lid, lid))
    conn.execute("UPDATE lobby_players SET ready=0 WHERE lobby_id=?", (lid,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


# --- ADMIN API (ДОПИСАНО) ---














@app.route('/api/admin/stats')
def api_admin_stats():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    conn = get_db()
    
    users = conn.execute("SELECT COUNT(*) c FROM users").fetchone()['c']
    banned = conn.execute("SELECT COUNT(*) c FROM users WHERE banned=1").fetchone()['c']
    admins = conn.execute("SELECT COUNT(*) c FROM users WHERE role='admin'").fetchone()['c']
    lobbies = conn.execute("SELECT COUNT(*) c FROM lobbies WHERE status='waiting'").fetchone()['c']
    pending_matches = conn.execute("SELECT COUNT(*) c FROM matches WHERE status='pending'").fetchone()['c']
    
    # Проверяем наличие таблицы badges (если нет, вернем 0)
    try:
        badges = conn.execute("SELECT COUNT(*) c FROM badges").fetchone()['c']
    except:
        badges = 0
        
    my_elo = conn.execute("SELECT elo FROM users WHERE tg_id=?", (u['id'],)).fetchone()['elo']
    
    conn.close()
    return jsonify({
        'ok': True, 
        'stats': {
            'users': users,
            'banned': banned,
            'admins': admins,
            'lobbies': lobbies,
            'pending_matches': pending_matches,
            'badges': badges,
            'my_elo': my_elo
        }
    })






@app.route('/api/admin/users')
def api_admin_users():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    conn = get_db()
    rows = conn.execute("SELECT tg_id, nick, elo, role, banned FROM users ORDER BY elo DESC").fetchall()
    conn.close()
    return jsonify({'ok': True, 'users': [dict(r) for r in rows]})






@app.route('/api/admin/role', methods=['POST'])
def api_admin_role():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("UPDATE users SET role=? WHERE tg_id=?", (b['role'], b['tg_id']))
    conn.commit(); conn.close()
    return jsonify({'ok': True})






@app.route('/api/admin/matches/pending')
def api_admin_matches_pending():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    conn = get_db()
    rows = conn.execute("SELECT * FROM matches WHERE status='pending'").fetchall()
    conn.close()
    return jsonify({'ok': True, 'matches': [dict(r) for r in rows]})






@app.route('/api/matches/<int:mid>/players')
def api_match_players(mid):
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    conn = get_db()
    rows = conn.execute("""SELECT mp.*, u.nick FROM match_players mp LEFT JOIN users u ON u.tg_id = mp.tg_id WHERE mp.match_id=?""", (mid,)).fetchall()
    conn.close()
    return jsonify({'ok': True, 'players': [dict(r) for r in rows]})






@app.route('/api/matches/<int:mid>/validate', methods=['POST'])
def api_match_validate(mid):
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    score_a = b.get('score_a', 0)
    score_b = b.get('score_b', 0)
    
    # Берем карту из лобби (если есть)
    match = conn.execute("SELECT lobby_id FROM matches WHERE id=?", (mid,)).fetchone()
    final_map = 'mirage' # Дефолт
    if match and match['lobby_id']:
        lobby = conn.execute("SELECT veto_state FROM lobbies WHERE id=?", (match['lobby_id'],)).fetchone()
        if lobby and lobby['veto_state']:
            try:
                vetoed = json.loads(lobby['veto_state'])
                all_maps = ['mirage', 'inferno', 'vertigo', 'dust2']
                remaining = [m for m in all_maps if m not in vetoed]
                if remaining: final_map = remaining[0]
            except: pass
    
    # Принудительно сохраняем счет (если пришел)
    # Если score_a = 0 и score_b = 0, пробуем взять из запроса
    if score_a == 0 and score_b == 0:
        score_a = b.get('score_a', 0)
        score_b = b.get('score_b', 0)
    conn.execute("UPDATE matches SET status='validated', winner=?, score_a=?, score_b=?, map=? WHERE id=?", (b['winner'], score_a, score_b, final_map, mid))
    for p in b['players']:
        kills = p['kills']; deaths = p['deaths']; assists = p['assists']
        base_elo = 15 if p['team'] == b['winner'] else -20
        elo_change = base_elo + kills - deaths + (assists * 2)
        if kills == 0: elo_change = 5 if p['team'] == b['winner'] else -30
        conn.execute("UPDATE users SET elo = elo + ?, wins = wins + ?, losses = losses + ?, kills = kills + ?, deaths = deaths + ?, assists = assists + ? WHERE tg_id=?", (elo_change, 1 if p['team'] == b['winner'] else 0, 0 if p['team'] == b['winner'] else 1, kills, deaths, assists, p['tg_id']))
        conn.execute("UPDATE match_players SET kills=?, deaths=?, assists=?, approved=1 WHERE match_id=? AND tg_id=?", (kills, deaths, assists, mid, p['tg_id']))
        conn.execute("INSERT INTO match_history (tg_id, match_id, result, map, kills, deaths, assists, elo_change, created) VALUES (?,?,?,?,?,?,?,?,?)", (p['tg_id'], mid, 'win' if p['team'] == b['winner'] else 'loss', b.get('map', ''), kills, deaths, assists, elo_change, time.time()))
    conn.execute("UPDATE lobbies SET status='finished' WHERE id=(SELECT lobby_id FROM matches WHERE id=?)", (mid,))
    conn.commit()
    
    # Возвращаем обновленного пользователя (если он был в матче)
    updated_me = None
    if u:
        row = conn.execute("SELECT * FROM users WHERE tg_id=?", (u['id'],)).fetchone()
        if row: updated_me = dict(row)
    
    conn.close()
    return jsonify({'ok': True, 'updated_user': updated_me})









@app.route('/api/admin/lobbies')
def api_admin_lobbies():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    conn = get_db()
    rows = conn.execute("""SELECT l.*, (SELECT COUNT(*) FROM lobby_players WHERE lobby_id=l.id) AS filled 
        FROM lobbies l ORDER BY l.id ASC""").fetchall()
    conn.close()
    return jsonify({'ok': True, 'lobbies': [dict(r) for r in rows]})





@app.route('/api/admin/lobby/close', methods=['POST'])
def api_admin_lobby_close():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("UPDATE lobbies SET status='closed' WHERE id=?", (b['id'],))
    conn.commit(); conn.close()
    return jsonify({'ok': True})





@app.route('/api/admin/lobby/clear', methods=['POST'])
def api_admin_lobby_clear():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("DELETE FROM lobby_players WHERE lobby_id=?", (b['id'],))
    conn.execute("UPDATE lobbies SET status='waiting', host_id=NULL WHERE id=?", (b['id'],))
    conn.commit(); conn.close()
    return jsonify({'ok': True})







@app.route('/api/admin/ads', methods=['GET', 'POST', 'DELETE'])
def api_admin_ads():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    conn = get_db()
    if request.method == 'GET':
        rows = conn.execute("SELECT * FROM ads").fetchall()
        conn.close()
        return jsonify({'ok': True, 'ads': [dict(r) for r in rows]})
    elif request.method == 'POST':
        b = request.get_json()
        conn.execute("INSERT INTO ads (tag, subtitle, title, btn_text, color, active, action, image) VALUES (?,?,?,?,?,1,?,?)",
                     (b.get('tag', 'РЕКЛАМА'), b.get('subtitle', ''), b.get('title', 'Заголовок'), b.get('btn_text', 'Кнопка'), b.get('color', 'linear-gradient(135deg, #7b2cbf, #c77dff)'), b.get('action', 'lobbies'), b.get('image', None)))
        conn.commit(); conn.close()
        return jsonify({'ok': True})
    elif request.method == 'DELETE':
        b = request.get_json()
        conn.execute("DELETE FROM ads WHERE id=?", (b['id'],))
        conn.commit(); conn.close()
        return jsonify({'ok': True})




@app.route('/api/admin/ads/update', methods=['POST'])
def api_admin_ads_update():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("UPDATE ads SET tag=?, subtitle=?, title=?, btn_text=?, color=?, active=?, action=?, image=? WHERE id=?",
                 (b.get('tag'), b.get('subtitle'), b.get('title'), b.get('btn_text'), b.get('color'), b.get('active', 1), b.get('action', 'lobbies'), b.get('image', None), b.get('id')))
    conn.commit(); conn.close()
    return jsonify({'ok': True})





@app.route('/api/ads')
def api_ads():
    conn = get_db()
    rows = conn.execute("SELECT * FROM ads WHERE active=1").fetchall()
    conn.close()
    return jsonify({'ok': True, 'ads': [dict(r) for r in rows]})






@app.route('/api/news')
def api_news():
    conn = get_db()
    rows = conn.execute("SELECT * FROM news ORDER BY id DESC LIMIT 5").fetchall()
    conn.close()
    return jsonify({'ok': True, 'news': [dict(r) for r in rows]})






@app.route('/api/admin/news', methods=['GET', 'POST', 'DELETE'])
def api_admin_news():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    conn = get_db()
    if request.method == 'GET':
        rows = conn.execute("SELECT * FROM news ORDER BY id DESC").fetchall()
        conn.close()
        return jsonify({'ok': True, 'news': [dict(r) for r in rows]})
    elif request.method == 'POST':
        b = request.get_json()
        conn.execute("INSERT INTO news (date, text) VALUES (?,?)", (b['date'], b['text']))
        conn.commit(); conn.close()
        return jsonify({'ok': True})
    elif request.method == 'DELETE':
        b = request.get_json()
        conn.execute("DELETE FROM news WHERE id=?", (b['id'],))
        conn.commit(); conn.close()
        return jsonify({'ok': True})








@app.route('/api/matches/<int:mid>/status', methods=['POST'])
def api_match_status(mid):
    b = request.get_json()
    conn = get_db()
    conn.execute("UPDATE matches SET status=? WHERE id=?", (b['status'], mid))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/api/admin/ban', methods=['POST'])
def api_admin_ban():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("UPDATE users SET banned=? WHERE tg_id=?", (b['banned'], b['tg_id']))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


@app.route('/api/admin/verify', methods=['POST'])
def api_admin_verify():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("UPDATE users SET verified=? WHERE tg_id=?", (b['verified'], b['tg_id']))
    conn.commit(); conn.close()
    
    # Отправляем уведомление игроку
    if b['verified'] == 1:
        add_notification(b['tg_id'], "Вам выдана галочка верификации!", 'verify')
    else:
        add_notification(b['tg_id'], "С вас снята галочка верификации.", 'verify_off')
        
    return jsonify({'ok': True})


@app.route('/api/admin/news/add', methods=['POST'])
def api_admin_news_add():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("INSERT INTO news (date, text) VALUES (?, ?)", (b.get('date', time.strftime('%d.%m.%Y')), b['text']))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

@app.route('/api/admin/news/del', methods=['POST'])
def api_admin_news_del():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("DELETE FROM news WHERE id=?", (b['id'],))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

@app.route('/api/admin/ads/add', methods=['POST'])
def api_admin_ads_add():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("INSERT INTO ads (tag, subtitle, title, btn_text, color, active) VALUES (?,?,?,?,?,1)",
                 (b.get('tag'), b.get('subtitle'), b.get('title'), b.get('btn_text'), b.get('color')))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

@app.route('/api/admin/ads/del', methods=['POST'])
def api_admin_ads_del():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("DELETE FROM ads WHERE id=?", (b['id'],))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


@app.route('/api/admin/ads/save', methods=['POST'])
def api_admin_ads_save():
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    b = request.get_json()
    conn = get_db()
    conn.execute("UPDATE ads SET tag=?, subtitle=?, title=?, btn_text=? WHERE id=?", 
                 (b.get('tag'), b.get('subtitle'), b.get('title'), b.get('btn_text'), b['id']))
    conn.commit(); conn.close()
    return jsonify({'ok': True})


@app.route('/api/admin/match/<int:mid>/players')
def api_admin_match_players(mid):
    u = get_me()
    if not u or not is_admin(u['id']): return jsonify({'ok': False}), 403
    conn = get_db()
    # Получаем инфу о матче
    match = conn.execute("SELECT * FROM matches WHERE id=?", (mid,)).fetchone()
    if not match: conn.close(); return jsonify({'ok': False, 'error': 'Матч не найден'}), 404
    
    # Получаем игроков
    players = conn.execute('''
        SELECT mp.tg_id, mp.team, u.nick, u.elo 
        FROM match_players mp 
        JOIN users u ON u.tg_id = mp.tg_id 
        WHERE mp.match_id = ?
    ''', (mid,)).fetchall()
    
    conn.close()
    return jsonify({
        'ok': True, 
        'match': dict(match),
        'players': [dict(p) for p in players]
    })


@app.route('/api/match/<int:mid>/details')
def api_match_details(mid):
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    conn = get_db()
    match = conn.execute("SELECT * FROM matches WHERE id=?", (mid,)).fetchone()
    if not match: conn.close(); return jsonify({'ok': False, 'error': 'Матч не найден'}), 404
    
    players = conn.execute('''
        SELECT mp.*, u.nick, u.elo 
        FROM match_players mp 
        JOIN users u ON u.tg_id = mp.tg_id 
        WHERE mp.match_id = ?
    ''', (mid,)).fetchall()
    
    conn.close()
    return jsonify({'ok': True, 'match': dict(match), 'players': [dict(p) for p in players]})


@app.route('/api/notifications')
def api_notifications():
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    conn = get_db()
    
    # Берем реальные уведомления из БД
    rows = conn.execute("SELECT * FROM notifications WHERE tg_id=? ORDER BY id DESC LIMIT 20", (u['id'],)).fetchall()
    
    # Форматируем время (простое)
    import datetime
    notifs = []
    for r in rows:
        dt = datetime.datetime.fromtimestamp(r['created'])
        now = datetime.datetime.now()
        diff = (now - dt).total_seconds()
        
        if diff < 60: time_str = "Только что"
        elif diff < 3600: time_str = f"{int(diff//60)} мин назад"
        elif diff < 86400: time_str = f"{int(diff//3600)} ч назад"
        else: time_str = dt.strftime("%d.%m.%Y")
        
        notifs.append({
            'id': r['id'],
            'text': r['text'],
            'time': time_str,
            'read': r['read'],
            'type': r['type'] if 'type' in r.keys() else 'system'
        })
    
    conn.close()
    return jsonify({'ok': True, 'notifications': notifs})


@app.route('/api/notifications/read', methods=['POST'])
def api_notifications_read():
    u = get_me()
    if not u: return jsonify({'ok': False}), 401
    conn = get_db()
    conn.execute("UPDATE notifications SET read=1 WHERE tg_id=?", (u['id'],))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=False)
