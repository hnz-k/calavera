import sqlite3
from werkzeug.security import generate_password_hash

conn = sqlite3.connect('database.db')
c = conn.cursor()

# Cek dulu ada berapa admin di database
c.execute('SELECT * FROM admin')
admins = c.fetchall()
print(f"Admin yang ada di database: {admins}")

# Hapus semua admin lama
c.execute('DELETE FROM admin')

# Insert admin baru
new_username = 'clv'
new_password = 'calavera'
hashed_password = generate_password_hash(new_password)

c.execute('INSERT INTO admin (username, password) VALUES (?, ?)',
         (new_username, hashed_password))

conn.commit()
conn.close()

print("✓ Username dan password berhasil diperbarui!")
print(f"Username baru: {new_username}")
print(f"Password baru: {new_password}")