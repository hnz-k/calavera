<p align="center">
  <img src="/static/img/logos/calavera.jpg" alt="Calavera Logo" width="100%">
</p>

<h1 align="center">🎓 Calavera — Class Web Platform</h1>

<p align="center">
  <b>A modern and elegant web platform for class collaboration, project sharing, and student creativity.</b>
</p>

<p align="center">
  <a href="#-about-the-project">About</a> •
  <a href="#-features">Features</a> •
  <a href="#️-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-developer">Developer</a>
</p>

---

## 🧠 About the Project
**Calavera Class Web** adalah platform berbasis Flask yang dibuat untuk mempermudah interaksi antar siswa, menampilkan profil, proyek, dan berbagai kegiatan kelas secara online.  
Didesain dengan **UI modern**, **responsif**, dan **mudah dikembangkan lebih lanjut.**

💡 Tujuan utama:
- Menjadi website kelas yang keren & profesional  
- Tempat showcase karya siswa  
- Wadah kolaborasi dan pembelajaran teknologi web  

---

## ✨ Features

- 🧑‍🏫 **Student Profiles:** Menampilkan biodata, foto, dan bio setiap siswa  
- 📸 **Photo Gallery:** Dokumentasi kegiatan kelas  
- 💬 **Interactive Chat or Comments:** (opsional) fitur komunikasi antar siswa  
- 🌗 **Dark/Light Mode:** Tampilan adaptif untuk semua pengguna  
- ⚙️ **Dynamic Backend:** Menggunakan Flask + SQLite  
- 📱 **Fully Responsive:** Nyaman diakses di HP maupun PC  
- 🧩 **Easily Customizable:** Struktur kode rapi dan mudah diperluas  

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|---------------|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Backend | Flask (Python) |
| Database | SQLite |
| Design | Figma, TailwindCSS (optional integration) |
| Tools | Git, VSCode |
| Deployment | Render / Vercel / GitHub Pages |

<p align="center">
  <img src="https://skillicons.dev/icons?i=html,css,js,python,flask,sqlite,git,vercel,figma" />
</p>

---

## ⚙️ Installation

### 1️⃣ Clone Repository
```bash
git clone https://github.com/username/calavera-class-web.git
cd calavera-class-web

2️⃣ (Opsional) Buat Virtual Environment

python -m venv venv
source venv/bin/activate  # Mac/Linux
# atau di Windows:
venv\Scripts\activate

3️⃣ Install Dependencies

pip install -r requirements.txt

4️⃣ Jalankan Aplikasi

python app.py

Akses di browser:
👉 http://localhost:5000


---

🚀 Usage

1. Buka website di browser.


2. Jelajahi halaman utama, profil siswa, dan galeri kelas.


3. Administrator dapat menambah data baru (siswa, postingan, dsb) melalui halaman backend atau file JSON.


4. Dapat di-host secara online agar bisa diakses oleh teman sekelas.




---

📂 Project Structure

calavera-class-web/
│
├── static/
│   ├── css/              # File style dan tema
│   ├── js/               # Script interaktif
│   └── img/              # Gambar, logo, dan foto kelas
│
├── templates/
│   ├── index.html        # Halaman utama
│   ├── siswa.html        # Daftar siswa
│   ├── detail.html       # Profil individu
│   └── base.html         # Template utama
│
├── app.py                # Main Flask app
├── data.json             # Data siswa (opsional)
├── requirements.txt
├── .env
└── README.md


---

⚙️ Configuration

Buat file .env di root folder:

FLASK_ENV=development
SECRET_KEY=your_secret_key
DATABASE_URL=sqlite:///data.db


---

🖼️ Preview

Mode	Screenshot

🌞 Light Mode	
🌙 Dark Mode	



---

🧑‍💻 Developer

Name	Role	Contact

Dikzzz	Full Stack Developer	📧 [Email] · 🌐 [Portfolio] · 🐙 GitHub



---

🤝 Contributing

Kontribusi sangat terbuka!
Jika ingin menambah fitur atau memperbaiki bug:

1. Fork repo ini


2. Buat branch baru (git checkout -b feature/awesome-feature)


3. Commit perubahan (git commit -m 'add new feature')


4. Push branch (git push origin feature/awesome-feature)


5. Buka Pull Request




---

🧾 Changelog

v1.0.0 — Initial release

v1.1.0 — Added dark mode + responsive layout

v1.2.0 — Improved UI & documentation



---

📜 License

Licensed under the MIT License
© 2025 Dikzzz. All rights reserved.


---

<p align="center">
  If you like this project, don't forget to give it a ⭐ and share it with your classmates!
</p><p align="center">
  <img src="https://raw.githubusercontent.com/Platane/snk/output/github-contribution-grid-snake-dark.svg" alt="snake animation" />
</p>
---

🙏 Acknowledgements

Special thanks to:

Flask Framework

Skill Icons

Shields.io

Unsplash (for banner images)


---

