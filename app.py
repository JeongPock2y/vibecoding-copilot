from flask import Flask, g, render_template, request, jsonify, abort
import sqlite3
import os
import calendar
from datetime import datetime, date

DB_FILENAME = 'todos.db'

app = Flask(__name__, static_folder='static', template_folder='templates')


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(os.path.join(app.root_path, DB_FILENAME))
        db.row_factory = sqlite3.Row
    return db


def init_db():
    db = sqlite3.connect(os.path.join(app.root_path, DB_FILENAME))
    cur = db.cursor()
    cur.execute('''
    CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    ''')
    db.commit()
    db.close()


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


with app.app_context():
    # Flask 3 removed `before_first_request`; initialize DB at import/runtime startup
    init_db()


def month_todos_map(year, month):
    db = get_db()
    start = date(year, month, 1)
    _, last = calendar.monthrange(year, month)
    end = date(year, month, last)
    cur = db.execute('SELECT date, COUNT(*) as c FROM todos WHERE date BETWEEN ? AND ? GROUP BY date',
                     (start.isoformat(), end.isoformat()))
    rows = cur.fetchall()
    return {r['date']: r['c'] for r in rows}


@app.route('/')
def index():
    qy = request.args.get('year')
    qm = request.args.get('month')
    today = datetime.utcnow().date()
    year = int(qy) if qy and qy.isdigit() else today.year
    month = int(qm) if qm and qm.isdigit() else today.month

    cal = calendar.Calendar(firstweekday=6)  # start Sunday
    month_days = list(cal.monthdatescalendar(year, month))

    todos_map = month_todos_map(year, month)

    return render_template('index.html', year=year, month=month, month_days=month_days, todos_map=todos_map)


@app.route('/api/todos', methods=['GET', 'POST'])
def api_todos():
    db = get_db()
    if request.method == 'GET':
        qdate = request.args.get('date')
        if not qdate:
            abort(400)
        cur = db.execute('SELECT id, date, text, created_at FROM todos WHERE date = ? ORDER BY id', (qdate,))
        rows = [dict(r) for r in cur.fetchall()]
        return jsonify(rows)

    data = request.get_json() or {}
    t = data.get('text')
    d = data.get('date')
    if not t or not d:
        abort(400)
    cur = db.execute('INSERT INTO todos (date, text, created_at) VALUES (?, ?, ?)', (d, t, datetime.utcnow().isoformat()))
    db.commit()
    new_id = cur.lastrowid
    cur = db.execute('SELECT id, date, text, created_at FROM todos WHERE id = ?', (new_id,))
    row = dict(cur.fetchone())
    return jsonify(row), 201


@app.route('/api/todos/<int:tid>', methods=['DELETE'])
def api_delete(tid):
    db = get_db()
    db.execute('DELETE FROM todos WHERE id = ?', (tid,))
    db.commit()
    return ('', 204)


if __name__ == '__main__':
    # Allow configuring port via environment variable; default to 5000
    port = int(os.environ.get('PORT', 5000))
    # In development turn off the reloader to avoid duplicate processes
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
