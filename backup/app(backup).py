from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import pytz
from functools import wraps

app = Flask(__name__)
app.secret_key = 'clv_secretkey'

# Dapatkan direktori aplikasi (tempat app.py berada)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Tentukan path database dan upload folder relatif terhadap direktori aplikasi
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'static/img/uploads')
app.config['DATABASE'] = os.path.join(BASE_DIR, 'database.db')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def format_timestamp_iso(timestamp_str):
    if not timestamp_str:
        return None
    try:
        ts = timestamp_str.replace('Z', '+00:00')
        dt = datetime.fromisoformat(ts)
        
        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)
        
        wib_tz = pytz.timezone('Asia/Jakarta')
        dt_wib = dt.astimezone(wib_tz)
        
        return dt_wib.isoformat()
    except Exception as e:
        print(f"Error formatting timestamp: {e}")
        return timestamp_str

def get_db_connection():
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    return conn

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session:
            flash('Silakan login terlebih dahulu', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def init_db():
    conn = sqlite3.connect(app.config['DATABASE'])
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS admin
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  password TEXT NOT NULL)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS struktur_kelas
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  nama TEXT NOT NULL,
                  role TEXT NOT NULL,
                  parent_id INTEGER,
                  foto TEXT,
                  FOREIGN KEY (parent_id) REFERENCES struktur_kelas (id))''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS jadwal
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  hari TEXT NOT NULL,
                  jam_mulai TEXT NOT NULL,
                  jam_selesai TEXT NOT NULL,
                  mata_pelajaran TEXT NOT NULL,
                  guru TEXT NOT NULL)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS jadwal_piket
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  hari TEXT NOT NULL,
                  nama_siswa TEXT NOT NULL,
                  tugas TEXT)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS siswa
             (id INTEGER PRIMARY KEY AUTOINCREMENT,
              nama TEXT NOT NULL,
              absen INTEGER NOT NULL UNIQUE,
              bio TEXT,
              foto TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS galeri
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  filename TEXT NOT NULL,
                  caption TEXT,
                  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    hashed_password = generate_password_hash('calavera')
    try:
        c.execute("INSERT INTO admin (username, password) VALUES (?, ?)", 
                 ('clv', hashed_password))
    except sqlite3.IntegrityError:
        pass
    
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/struktur')
def struktur():
    conn = get_db_connection()
    struktur_data = conn.execute('''
        SELECT s1.*, s2.nama as parent_nama 
        FROM struktur_kelas s1 
        LEFT JOIN struktur_kelas s2 ON s1.parent_id = s2.id 
        ORDER BY s1.parent_id IS NULL DESC, s1.id
    ''').fetchall()
    conn.close()
    return render_template('struktur.html', struktur_data=struktur_data)

@app.route('/jadwal')
def jadwal():
    conn = get_db_connection()
    
    jadwal_data = conn.execute('''SELECT * FROM jadwal ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END, jam_mulai''').fetchall()
    
    piket_data = conn.execute('''SELECT * FROM jadwal_piket ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END''').fetchall()
    
    conn.close()
    return render_template('jadwal.html', jadwal_data=jadwal_data, piket_data=piket_data)

@app.route('/galeri')
def galeri():
    conn = get_db_connection()
    galeri_data = conn.execute('SELECT * FROM galeri ORDER BY uploaded_at DESC').fetchall()
    
    galeri_data = [dict(foto, uploaded_at=format_timestamp_iso(foto['uploaded_at']))
    for foto in galeri_data]
    
    conn.close()
    return render_template('galeri.html', galeri_data=galeri_data)

@app.route('/siswa')
def siswa():
    conn = get_db_connection()
    siswa_data = conn.execute('SELECT * FROM siswa ORDER BY CAST(absen AS INTEGER)').fetchall()
    conn.close()
    return render_template('siswa.html', siswa_data=siswa_data)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = get_db_connection()
        admin = conn.execute('SELECT * FROM admin WHERE username = ?', (username,)).fetchone()
        conn.close()
        
        if admin and check_password_hash(admin['password'], password):
            session['admin_logged_in'] = True
            session['admin_username'] = username
            flash('Login berhasil!', 'success')
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Username atau password salah!', 'error')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Anda telah logout', 'info')
    return redirect(url_for('index'))

@app.route('/admin')
@login_required
def admin_dashboard():
    active_tab = request.args.get('tab', 'struktur')
    
    conn = get_db_connection()
    
    struktur_data = conn.execute('''
        SELECT s1.*, s2.nama as parent_nama 
        FROM struktur_kelas s1 
        LEFT JOIN struktur_kelas s2 ON s1.parent_id = s2.id 
        ORDER BY s1.parent_id IS NULL DESC, s1.id
    ''').fetchall()
    
    jadwal_data = conn.execute('''SELECT * FROM jadwal ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END, jam_mulai''').fetchall()
    
    piket_data = conn.execute('''SELECT * FROM jadwal_piket ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END''').fetchall()
    
    galeri_data = conn.execute('SELECT * FROM galeri ORDER BY uploaded_at DESC').fetchall()
    galeri_data = [dict(foto, uploaded_at=format_timestamp_iso(foto['uploaded_at']))
    for foto in galeri_data]
    
    siswa_data = conn.execute('SELECT * FROM siswa ORDER BY CAST(absen AS INTEGER)').fetchall()
    
    conn.close()
    
    return render_template('admin_dashboard.html', 
                         active_tab=active_tab,
                         struktur_data=struktur_data, 
                         jadwal_data=jadwal_data,
                         piket_data=piket_data,
                         galeri_data=galeri_data,
                         siswa_data=siswa_data)

@app.route('/admin/struktur', methods=['GET', 'POST'])
@login_required
def admin_struktur():
    conn = get_db_connection()
    
    if request.method == 'POST':
        nama = request.form['nama']
        role = request.form['role']
        if role == 'Custom':
            role = request.form.get('role_custom', 'Custom').strip()
            if not role or role == '':
                role = 'Anggota Kelas'
        parent_id = request.form['parent_id'] if request.form['parent_id'] else None
        
        foto = None
        if 'foto' in request.files:
            file = request.files['foto']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                foto = filename
        
        conn.execute('INSERT INTO struktur_kelas (nama, role, parent_id, foto) VALUES (?, ?, ?, ?)',
                    (nama, role, parent_id, foto))
        conn.commit()
        conn.close()
        flash('Data struktur kelas berhasil ditambahkan', 'success')
        return redirect(url_for('admin_struktur') + '?tab=struktur')
    
    struktur_data = conn.execute('''
        SELECT s1.*, s2.nama as parent_nama 
        FROM struktur_kelas s1 
        LEFT JOIN struktur_kelas s2 ON s1.parent_id = s2.id 
        ORDER BY s1.parent_id IS NULL DESC, s1.id
    ''').fetchall()
    
    jadwal_data = conn.execute('''SELECT * FROM jadwal ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END, jam_mulai''').fetchall()
    
    piket_data = conn.execute('''SELECT * FROM jadwal_piket ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END''').fetchall()
    
    galeri_data = conn.execute('SELECT * FROM galeri ORDER BY uploaded_at DESC').fetchall()
    siswa_data = conn.execute('SELECT * FROM siswa ORDER BY CAST(absen AS INTEGER)').fetchall()
    conn.close()
    
    return render_template('admin_dashboard.html', 
                         active_tab='struktur',
                         struktur_data=struktur_data, 
                         jadwal_data=jadwal_data,
                         piket_data=piket_data,
                         galeri_data=galeri_data,
                         siswa_data=siswa_data)

@app.route('/admin/struktur/delete/<int:id>')
@login_required
def delete_struktur(id):
    conn = get_db_connection()
    
    struktur = conn.execute('SELECT foto FROM struktur_kelas WHERE id = ?', (id,)).fetchone()
    
    conn.execute('DELETE FROM struktur_kelas WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    
    if struktur and struktur['foto']:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], struktur['foto']))
        except:
            pass
    
    flash('Data struktur kelas berhasil dihapus', 'success')
    return redirect(url_for('admin_struktur') + '?tab=struktur')

@app.route('/admin/jadwal', methods=['GET', 'POST'])
@login_required
def admin_jadwal():
    conn = get_db_connection()
    
    if request.method == 'POST':
        hari = request.form['hari']
        jam_mulai = request.form['jam_mulai']
        jam_selesai = request.form['jam_selesai']
        mata_pelajaran = request.form['mata_pelajaran']
        guru = request.form['guru']
        
        conn.execute('''INSERT INTO jadwal (hari, jam_mulai, jam_selesai, mata_pelajaran, guru) 
                       VALUES (?, ?, ?, ?, ?)''',
                    (hari, jam_mulai, jam_selesai, mata_pelajaran, guru))
        conn.commit()
        conn.close()
        flash('Jadwal berhasil ditambahkan', 'success')
        return redirect(url_for('admin_jadwal') + '?tab=jadwal')
    
    struktur_data = conn.execute('''
        SELECT s1.*, s2.nama as parent_nama 
        FROM struktur_kelas s1 
        LEFT JOIN struktur_kelas s2 ON s1.parent_id = s2.id 
        ORDER BY s1.parent_id IS NULL DESC, s1.id
    ''').fetchall()
    
    jadwal_data = conn.execute('''SELECT * FROM jadwal ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END, jam_mulai''').fetchall()
    
    piket_data = conn.execute('''SELECT * FROM jadwal_piket ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END''').fetchall()
    
    galeri_data = conn.execute('SELECT * FROM galeri ORDER BY uploaded_at DESC').fetchall()
    siswa_data = conn.execute('SELECT * FROM siswa ORDER BY CAST(absen AS INTEGER)').fetchall()
    conn.close()
    
    return render_template('admin_dashboard.html', 
                         active_tab='jadwal',
                         struktur_data=struktur_data, 
                         jadwal_data=jadwal_data,
                         piket_data=piket_data,
                         galeri_data=galeri_data,
                         siswa_data=siswa_data)

@app.route('/admin/jadwal/delete/<int:id>')
@login_required
def delete_jadwal(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM jadwal WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    
    flash('Jadwal berhasil dihapus', 'success')
    return redirect(url_for('admin_jadwal') + '?tab=jadwal')

@app.route('/admin/piket', methods=['GET', 'POST'])
@login_required
def admin_piket():
    conn = get_db_connection()
    
    if request.method == 'POST':
        hari = request.form['hari']
        nama_siswa = request.form['nama_siswa']
        tugas = request.form.get('tugas', '')
        
        conn.execute('''INSERT INTO jadwal_piket (hari, nama_siswa, tugas) 
                       VALUES (?, ?, ?)''',
                    (hari, nama_siswa, tugas))
        conn.commit()
        conn.close()
        flash('Jadwal piket berhasil ditambahkan', 'success')
        return redirect(url_for('admin_piket') + '?tab=piket')
    
    struktur_data = conn.execute('''
        SELECT s1.*, s2.nama as parent_nama 
        FROM struktur_kelas s1 
        LEFT JOIN struktur_kelas s2 ON s1.parent_id = s2.id 
        ORDER BY s1.parent_id IS NULL DESC, s1.id
    ''').fetchall()
    
    jadwal_data = conn.execute('''SELECT * FROM jadwal ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END, jam_mulai''').fetchall()
    
    piket_data = conn.execute('''SELECT * FROM jadwal_piket ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END''').fetchall()
    
    galeri_data = conn.execute('SELECT * FROM galeri ORDER BY uploaded_at DESC').fetchall()
    siswa_data = conn.execute('SELECT * FROM siswa ORDER BY CAST(absen AS INTEGER)').fetchall()
    conn.close()
    
    return render_template('admin_dashboard.html', 
                         active_tab='piket',
                         struktur_data=struktur_data, 
                         jadwal_data=jadwal_data,
                         piket_data=piket_data,
                         galeri_data=galeri_data,
                         siswa_data=siswa_data)

@app.route('/admin/piket/delete/<int:id>')
@login_required
def delete_piket(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM jadwal_piket WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    
    flash('Jadwal piket berhasil dihapus', 'success')
    return redirect(url_for('admin_piket') + '?tab=piket')

@app.route('/admin/galeri', methods=['GET', 'POST'])
@login_required
def admin_galeri():
    conn = get_db_connection()
    
    if request.method == 'POST':
        caption = request.form['caption']
        
        if 'foto' not in request.files:
            flash('Tidak ada file yang dipilih', 'error')
            conn.close()
            return redirect(url_for('admin_galeri') + '?tab=galeri')
        
        file = request.files['foto']
        if file.filename == '':
            flash('Tidak ada file yang dipilih', 'error')
            conn.close()
            return redirect(url_for('admin_galeri') + '?tab=galeri')
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            
            conn.execute('INSERT INTO galeri (filename, caption) VALUES (?, ?)',
                        (filename, caption))
            conn.commit()
            conn.close()
            flash('Foto berhasil diupload', 'success')
            return redirect(url_for('admin_galeri') + '?tab=galeri')
        else:
            flash('Format file tidak didukung', 'error')
            conn.close()
            return redirect(url_for('admin_galeri') + '?tab=galeri')
    
    struktur_data = conn.execute('''
        SELECT s1.*, s2.nama as parent_nama 
        FROM struktur_kelas s1 
        LEFT JOIN struktur_kelas s2 ON s1.parent_id = s2.id 
        ORDER BY s1.parent_id IS NULL DESC, s1.id
    ''').fetchall()
    
    jadwal_data = conn.execute('''SELECT * FROM jadwal ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END, jam_mulai''').fetchall()
    
    piket_data = conn.execute('''SELECT * FROM jadwal_piket ORDER BY 
        CASE hari 
            WHEN "Senin" THEN 1 
            WHEN "Selasa" THEN 2 
            WHEN "Rabu" THEN 3 
            WHEN "Kamis" THEN 4 
            WHEN "Jumat" THEN 5 
            WHEN "Sabtu" THEN 6 
            ELSE 7 
        END''').fetchall()
    
    galeri_data = conn.execute('SELECT * FROM galeri ORDER BY uploaded_at DESC').fetchall()
    galeri_data = [dict(foto, uploaded_at=format_timestamp_iso(foto['uploaded_at']))
    for foto in galeri_data]
    
    siswa_data = conn.execute('SELECT * FROM siswa ORDER BY CAST(absen AS INTEGER)').fetchall()
    conn.close()
    
    return render_template('admin_dashboard.html', 
                         active_tab='galeri',
                         struktur_data=struktur_data, 
                         jadwal_data=jadwal_data,
                         piket_data=piket_data,
                         galeri_data=galeri_data,
                         siswa_data=siswa_data)

# Edit Galeri - khusus edit caption
@app.route('/admin/galeri/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_galeri(id):
    conn = get_db_connection()
    
    if request.method == 'POST':
        caption = request.form['caption']
        
        conn.execute('UPDATE galeri SET caption = ? WHERE id = ?', 
                    (caption, id))
        conn.commit()
        conn.close()
        
        flash('Caption foto berhasil diupdate', 'success')
        return redirect(url_for('admin_galeri') + '?tab=galeri')
    
    # GET method - show edit form
    galeri_item = conn.execute('SELECT * FROM galeri WHERE id = ?', (id,)).fetchone()
    conn.close()
    
    if not galeri_item:
        flash('Data tidak ditemukan', 'error')
        return redirect(url_for('admin_galeri') + '?tab=galeri')
    
    return render_template('edit_galeri.html', item=galeri_item)

@app.route('/admin/galeri/delete/<int:id>')
@login_required
def delete_galeri(id):
    conn = get_db_connection()
    
    galeri = conn.execute('SELECT filename FROM galeri WHERE id = ?', (id,)).fetchone()
  
    conn.execute('DELETE FROM galeri WHERE id = ?', (id,))
    conn.commit()
    conn.close()
  
    if galeri and galeri['filename']:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], galeri['filename']))
        except:
            pass
    
    flash('Foto berhasil dihapus', 'success')
    return redirect(url_for('admin_galeri') + '?tab=galeri')

@app.route('/admin/siswa', methods=['GET', 'POST'])
@login_required
def admin_siswa():
    conn = get_db_connection()
    
    if request.method == 'POST':
        nama = request.form['nama']
        absen = request.form['absen']
        bio = request.form.get('bio', '')
        
        foto = None
        if 'foto' in request.files:
            file = request.files['foto']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                filename = f"siswa_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
                os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'siswa'), exist_ok=True)
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], 'siswa', filename))
                foto = filename
        
        try:
            conn.execute('INSERT INTO siswa (nama, absen, bio, foto) VALUES (?, ?, ?, ?)',
                        (nama, absen, bio, foto))
            conn.commit()
            flash('Siswa berhasil ditambahkan', 'success')
        except sqlite3.IntegrityError:
            flash('Nomor absen sudah ada', 'error')
        
        conn.close()
        return redirect(url_for('admin_siswa') + '?tab=siswa')
    
    siswa_data = conn.execute('SELECT * FROM siswa ORDER BY CAST(absen AS INTEGER)').fetchall()
    struktur_data = conn.execute('SELECT * FROM struktur_kelas').fetchall()
    jadwal_data = conn.execute('SELECT * FROM jadwal').fetchall()
    piket_data = conn.execute('SELECT * FROM jadwal_piket').fetchall()
    galeri_data = conn.execute('SELECT * FROM galeri').fetchall()
    
    conn.close()
    
    return render_template('admin_dashboard.html', 
                         active_tab='siswa',
                         siswa_data=siswa_data,
                         struktur_data=struktur_data,
                         jadwal_data=jadwal_data,
                         piket_data=piket_data,
                         galeri_data=galeri_data)

@app.route('/admin/siswa/delete/<int:id>')
@login_required
def delete_siswa(id):
    conn = get_db_connection()
    
    siswa = conn.execute('SELECT foto FROM siswa WHERE id = ?', (id,)).fetchone()
    
    conn.execute('DELETE FROM siswa WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    
    if siswa and siswa['foto']:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], 'siswa', siswa['foto']))
        except:
            pass
    
    flash('Siswa berhasil dihapus', 'success')
    return redirect(url_for('admin_siswa') + '?tab=siswa')

@app.route('/admin/edit/<string:type>/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_data(type, id):
    conn = get_db_connection()
    
    valid_types = ['struktur', 'jadwal', 'piket', 'siswa']
    if type not in valid_types:
        flash('Tipe data tidak valid', 'error')
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'GET':
        if type == 'struktur':
            item = conn.execute('''
                SELECT s1.*, s2.nama as parent_nama 
                FROM struktur_kelas s1 
                LEFT JOIN struktur_kelas s2 ON s1.parent_id = s2.id 
                WHERE s1.id = ?
            ''', (id,)).fetchone()
            all_struktur = conn.execute('SELECT * FROM struktur_kelas WHERE id != ?', (id,)).fetchall()
            conn.close()
            
            if not item:
                flash('Data tidak ditemukan', 'error')
                return redirect(url_for('admin_struktur') + '?tab=struktur')
            
            return render_template('edit.html', type=type, item=item, all_struktur=all_struktur)
        else:
            table_map = {'jadwal': 'jadwal', 'piket': 'jadwal_piket', 'siswa': 'siswa'}
            
            item = conn.execute(f'SELECT * FROM {table_map[type]} WHERE id = ?', (id,)).fetchone()
            conn.close()
            
            if not item:
                flash('Data tidak ditemukan', 'error')
                return redirect(url_for(f'admin_{type}') + f'?tab={type}')
            
            return render_template('edit.html', type=type, item=item)
    
    if request.method == 'POST':
        try:
            if type == 'struktur':
                nama = request.form['nama']
                role = request.form['role']
                if role == 'Custom':
                    role = request.form.get('role_custom', 'Custom').strip()
                    if not role or role == '':
                        role = 'Anggota Kelas'
                parent_id = request.form['parent_id'] if request.form['parent_id'] else None
                
                foto = None
                if 'foto' in request.files:
                    file = request.files['foto']
                    if file and allowed_file(file.filename):
                        filename = secure_filename(file.filename)
                        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
                        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                        foto = filename
                        
                        old_data = conn.execute('SELECT foto FROM struktur_kelas WHERE id = ?', (id,)).fetchone()
                        if old_data and old_data['foto']:
                            try:
                                os.remove(os.path.join(app.config['UPLOAD_FOLDER'], old_data['foto']))
                            except:
                                pass
                
                if foto:
                    conn.execute('''UPDATE struktur_kelas SET nama=?, role=?, parent_id=?, foto=?
                                 WHERE id=?''', (nama, role, parent_id, foto, id))
                else:
                    conn.execute('''UPDATE struktur_kelas SET nama=?, role=?, parent_id=?
                                 WHERE id=?''', (nama, role, parent_id, id))
                
                conn.commit()
                conn.close()
                flash('Data struktur kelas berhasil diupdate', 'success')
                return redirect(url_for('admin_struktur') + '?tab=struktur')
            
            elif type == 'jadwal':
                hari = request.form['hari']
                jam_mulai = request.form['jam_mulai']
                jam_selesai = request.form['jam_selesai']
                mata_pelajaran = request.form['mata_pelajaran']
                guru = request.form['guru']
                
                conn.execute('''UPDATE jadwal SET hari=?, jam_mulai=?, jam_selesai=?, mata_pelajaran=?, guru=?
                             WHERE id=?''', 
                            (hari, jam_mulai, jam_selesai, mata_pelajaran, guru, id))
                conn.commit()
                conn.close()
                flash('Jadwal berhasil diupdate', 'success')
                return redirect(url_for('admin_jadwal') + '?tab=jadwal')
            
            elif type == 'piket':
                hari = request.form['hari']
                nama_siswa = request.form['nama_siswa']
                tugas = request.form.get('tugas', '')
                
                conn.execute('''UPDATE jadwal_piket SET hari=?, nama_siswa=?, tugas=?
                             WHERE id=?''', 
                            (hari, nama_siswa, tugas, id))
                conn.commit()
                conn.close()
                flash('Jadwal piket berhasil diupdate', 'success')
                return redirect(url_for('admin_piket') + '?tab=piket')
            
            elif type == 'siswa':
                nama = request.form['nama']
                absen = request.form['absen']
                bio = request.form.get('bio', '')
                
                foto = None
                if 'foto' in request.files:
                    file = request.files['foto']
                    if file and allowed_file(file.filename):
                        filename = secure_filename(file.filename)
                        filename = f"siswa_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
                        os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'siswa'), exist_ok=True)
                        file.save(os.path.join(app.config['UPLOAD_FOLDER'], 'siswa', filename))
                        foto = filename
                        
                        old_data = conn.execute('SELECT foto FROM siswa WHERE id = ?', (id,)).fetchone()
                        if old_data and old_data['foto']:
                            try:
                                os.remove(os.path.join(app.config['UPLOAD_FOLDER'], 'siswa', old_data['foto']))
                            except:
                                pass
                
                if foto:
                    conn.execute('''UPDATE siswa SET nama=?, absen=?, bio=?, foto=?
                                 WHERE id=?''', (nama, absen, bio, foto, id))
                else:
                    conn.execute('''UPDATE siswa SET nama=?, absen=?, bio=?
                                 WHERE id=?''', (nama, absen, bio, id))
                
                conn.commit()
                conn.close()
                flash('Data siswa berhasil diupdate', 'success')
                return redirect(url_for('admin_siswa') + '?tab=siswa')
                
        except Exception as e:
            conn.close()
            flash(f'Error: {str(e)}', 'error')
            return redirect(url_for(f'admin_{type}') + f'?tab={type}')

if __name__ == '__main__':
    print(f"[INFO] Database path: {app.config['DATABASE']}")
    print(f"[INFO] Upload folder: {app.config['UPLOAD_FOLDER']}")
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)