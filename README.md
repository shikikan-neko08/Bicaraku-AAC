# BicaraKu — Aplikasi AAC Ramah Sensorik

**BicaraKu** adalah aplikasi web **AAC (Augmentative and Alternative Communication)** responsif (optimal untuk ponsel, tablet, dan desktop) yang dirancang khusus untuk membantu anak dan orang dewasa autis Level 3 yang non-verbal atau minim bicara dalam berkomunikasi sehari-hari.

Aplikasi ini dirancang dengan prinsip **ramah sensorik** (tanpa animasi berkedip, tanpa suara mendadak tanpa sentuhan, warna lembut dengan kontras jelas) dan **stabilitas motor planning** (posisi simbol tidak berpindah sendiri tanpa persetujuan orang tua/caregiver).

---

## Fitur Utama

### 1. Mode Pengguna (Komunikasi)
- **Papan Simbol Fleksibel**: Ukuran grid dapat diatur (`2×2`, `3×3`, `4×4`, atau `5×5`) dengan area sentuh besar.
- **Kode Warna Fitzgerald Key**: Memudahkan pengenalan jenis kata berdasarkan warna kategori (Orang, Kata Kerja, Benda, Sifat, Perasaan, Sosial, Kebutuhan, Tempat, Aktivitas, Darurat).
- **Bar Kalimat & Suara (TTS)**: Ketuk simbol untuk merangkai kalimat di bagian atas, lalu tekan tombol **Ucapkan** untuk membacakannya dengan suara Bahasa Indonesia (Web Speech API).
- **Tombol Darurat Permanen**: Tombol **SAKIT**, **TOLONG**, **SELESAI**, **BISING**, **BERHENTI**, dan **MAU PULANG** selalu tersedia di bagian atas untuk respons cepat.
- **Saran Kata Lanjutan**: Memberikan 3 pilihan kata lanjutan otomatis (menggunakan Gemini AI di server jika tersedia, atau saran lokal jika sedang offline).
- **Konteks Lokasi**: Pilihan konteks cepat (`Rumah`, `Sekolah`, `Terapi`, `Lainnya`) untuk pencatatan riwayat.
- **Mode Gelap & Terang**: Mendukung kenyamanan mata di berbagai kondisi pencahayaan.

### 2. Mode Caregiver (Dilindungi PIN)
- **Saklar Otomatis Bicara Saat Ditekan**: Pengaturan instan untuk membuat setiap simbol yang disentuh langsung berbunyi otomatis tanpa perlu menekan tombol *Ucapkan*.
- **Kelola Simbol & Foto Pribadi**: Tambah, ubah, atau hapus simbol, serta unggah foto asli barang/lingkungan pribadi (misalnya cangkir kesayangan, kamar tidur, wajah keluarga).
- **Profil, Suara & Aksesibilitas**: Atur nama pengguna, jenis suara perangkat, kecepatan & nada bicara, delay sentuh (`0.0–1.0 detik`) untuk mencegah salah sentuh, serta mode tampilan kartu (*Gambar + Teks*, *Hanya Gambar*, atau *Hanya Teks*).
- **Keamanan & Ganti PIN**: PIN bawaan (`1234`) dapat diganti kapan saja dengan verifikasi PIN lama dan konfirmasi PIN baru.
- **Saran Layout Adaptif**: Menganalisis kebiasaan waktu dan lokasi penggunaan, lalu menyarankan simbol yang sering dipakai agar dipindahkan ke halaman utama (hanya berubah setelah disetujui caregiver).
- **Dashboard Analitik**: Menampilkan total pemakaian, simbol yang paling sering dipakai, dan simbol yang belum pernah digunakan.
- **Ekspor CSV & Cadangan JSON Terenkripsi**: Unduh log komunikasi dalam format CSV untuk diberikan kepada terapis, atau cadangkan seluruh papan simbol dalam format JSON dengan **PIN Caregiver terenkripsi otomatis (AES-256-GCM)**.

---

## Panduan Penggunaan & Konfigurasi untuk Orang Awam (Orang Tua / Wali / Terapis)

Bagian ini menjelaskan cara memakai dan mengatur BicaraKu tanpa perlu memahami istilah teknis pemrograman.

### A. Pertama Kali Membuka Aplikasi
1. Saat aplikasi dibuka pertama kali, akan muncul layar **Persetujuan Wali & Privasi**.
2. Aplikasi ini menyimpan seluruh data (foto, simbol, catatan komunikasi) **langsung di HP/tablet Anda sendiri**, bukan dikirim ke pihak ketiga.
3. Tekan tombol hijau **Saya Setuju & Mulai Gunakan** untuk masuk ke layar komunikasi utama.

---

### B. Cara Menggunakan Mode Pengguna (Sehari-hari)
1. **Memilih Lokasi Saat Ini**: Di bagian paling atas, pilih lokasi anak/pengguna saat ini (**Rumah**, **Sekolah**, **Terapi**, atau **Lainnya**). Ini membantu pencatatan riwayat untuk terapis.
2. **Merangkai Kalimat**:
   - Ketuk simbol-simbol pada kotak di layar (misalnya ketuk **Saya** → **Mau** → **Minum**).
   - Kata-kata tersebut akan muncul di **Bar Kalimat** bagian atas.
   - Tekan tombol biru **Ucapkan** agar HP/tablet membacakan kalimat tersebut dengan suara keras.
   - Jika salah tekan, ketuk kata yang ingin dihapus di bar kalimat, tekan tombol hapus satu kata (ikon panah silang), atau tekan ikon tempat sampah untuk menghapus semua.
3. **Menggunakan Tombol Darurat**: Jika anak sedang tidak nyaman atau butuh bantuan segera, ketuk salah satu tombol merah di baris **Darurat** (**SAKIT**, **TOLONG**, **BISING**, dll.)—tombol ini akan langsung bersuara saat itu juga.

---

### C. Cara Membuka Mode Caregiver (Pengaturan)
Mode Caregiver digunakan oleh orang tua, guru, atau terapis untuk mengatur aplikasi agar tidak terubah secara tidak sengaja oleh pengguna.

1. **Di Ponsel (HP) atau Tablet**:
   - Ketuk tombol ikon **garis tiga (`≡`)** di pojok kanan atas layar (sejajar dengan tulisan **BicaraKu**).
   - Pilih **Mode Caregiver**. *(Di menu ini juga tersedia tombol cepat untuk mengganti **Mode Gelap / Mode Terang**).*
2. **Di Komputer / Laptop (Desktop)**:
   - Klik langsung tombol **Mode Caregiver** di pojok kanan atas layar.
3. **Masukkan PIN 4 Digit**:
   - Untuk penggunaan awal, masukkan PIN bawaan: **`1234`**.

---

### D. Cara Mengatur Konfigurasi di Mode Caregiver

Setelah masuk ke **Panel Caregiver**, Anda akan melihat 5 menu utama dan 1 saklar cepat:

#### 1. Saklar Cepat: "Otomatis Bicara Saat Ditekan"
Di bagian kanan atas bilah menu Caregiver (dan juga di dalam tab **Profil & Suara**), terdapat saklar **Otomatis Bicara Saat Ditekan**:
- **Geser ke Kanan (Aktif / Hijau)**: Cocok untuk pemula atau anak yang belajar hubungan sebab-akibat. Begitu simbol disentuh, perangkat **langsung mengucapkan** kata tersebut secara otomatis.
- **Geser ke Kiri (Nonaktif / Abu-abu)**: Cocok untuk pengguna yang sudah mulai merangkai kalimat 2–4 kata sebelum dibacakan sekaligus dengan tombol **Ucapkan**.

#### 2. Menambah Foto Pribadi & Mengubah Simbol (Tab: *Kelola Simbol*)
Memakai foto barang nyata milik anak sering kali jauh lebih mudah dipahami daripada ikon umum:
1. Buka tab **Kelola Simbol**.
2. Untuk mengubah simbol yang sudah ada, cari simbolnya lalu tekan **Ubah**. Untuk membuat baru, tekan **Tambah Simbol**.
3. Isi **Label Tampilan** (teks di kartu, misal: *Botol Biru*) dan **Teks Suara** (kalimat yang diucapkan, misal: *Saya mau botol biru*).
4. Pilih **Kategori Fitzgerald** (misal: *Benda*, *Makanan/Kebutuhan*, *Orang*).
5. Pada bagian **Foto Pribadi**, tekan pilih file lalu unggah foto dari galeri HP/tablet Anda.
6. Tekan **Simpan Simbol**.

#### 3. Mengatur Suara, Ukuran Kotak & Anti Salah Sentuh (Tab: *Profil & Suara*)
1. **Nama Pengguna AAC**: Isi dengan nama anak/pengguna.
2. **Pilihan Suara**: Pilih suara Bahasa Indonesia yang paling jernih dan nyaman didengar (tergantung suara yang tersedia di perangkat Anda).
3. **Kecepatan & Nada**: Geser ke kiri agar suara lebih pelan dan jelas, atau ke kanan agar lebih cepat.
4. **Delay Sentuh (0.0 – 1.0 detik)**: Jika jari pengguna sering tidak sengaja menyentuh layar saat menggeser tangan, naikkan nilainya menjadi **`0.3` sampai `0.6` detik**. Pengguna harus menahan jarinya sebentar pada simbol sebelum tombol bereaksi.
5. **Ukuran Grid Utama**:
   - Pilih **2 × 2** jika pengguna membutuhkan kotak ekstra besar.
   - Pilih **3 × 3** atau **4 × 4** untuk keseimbangan standar.
   - Pilih **5 × 5** jika kosakata pengguna sudah banyak.
6. **Mode Tampilan Kartu Simbol**: Pilih **Gambar + Teks**, **Hanya Gambar** (jika belum bisa membaca), atau **Hanya Teks**.
7. Setelah selesai mengubah pengaturan profil di atas, jangan lupa tekan tombol hijau **Simpan Perubahan Profil**.

#### 4. Mengganti PIN Keamanan Caregiver (Tab: *Profil & Suara*)
Agar pengguna tidak mudah masuk ke pengaturan dan mengubah tata letak simbol, segera ganti PIN bawaan `1234`:
1. Buka tab **Profil & Suara**, lalu gulir ke bawah ke bagian **Ganti PIN Mode Caregiver**.
2. Masukkan **PIN Saat Ini** (awalnya `1234`).
3. Masukkan **PIN Baru (4 Digit)** yang mudah Anda ingat.
4. Ketik ulang pada kolom **Konfirmasi PIN Baru**.
5. *(Opsional)* Tekan tombol **Tampilkan** jika ingin mengecek angka yang diketik.
6. Tekan **Perbarui PIN Caregiver**. Mulai saat itu, masuk ke Mode Caregiver akan menggunakan PIN baru Anda.

#### 5. Melihat Perkembangan & Saran Tata Letak (Tab: *Saran Adaptif* & *Analitik*)
- **Tab Analitik**: Lihat total kata yang diucapkan, simbol mana yang paling sering digunakan, dan simbol mana yang belum pernah disentuh.
- **Tab Saran Adaptif**: Setelah aplikasi digunakan beberapa kali, sistem akan merekomendasikan simbol yang paling sering dipakai agar ditaruh di posisi paling depan. Posisi tidak akan berubah otomatis—tekan **Setujui & Pindahkan** hanya jika Anda merasa tata letak tersebut membantu.

#### 6. Berbagi Laporan ke Terapis & Backup Data (Tab: *Cadangan & Ekspor*)
- **Unduh CSV (Untuk Terapis)**: Mengunduh catatan waktu, simbol yang ditekan, dan lokasi (`Rumah`/`Sekolah`/`Terapi`) dalam format tabel yang bisa dibuka di Excel/Google Sheets untuk bahan evaluasi terapi wicara/okupasi.
- **Unduh JSON (Cadangan Penuh)**: Menyimpan seluruh simbol, foto pribadi, profil, dan riwayat ke dalam satu file cadangan. **PIN Caregiver Anda otomatis dienkripsi (AES-256-GCM)** di dalam file JSON sehingga tetap aman dan tidak bisa dibaca secara langsung dari file teks.
- **Unggah JSON (Pulihkan)**: Jika berganti tablet atau HP baru, cukup buka tab ini dan unggah file cadangan `.json` Anda untuk memulihkan seluruh papan komunikasi beserta PIN Caregiver-nya.

---

## Informasi Teknis (Untuk Pengembang)

### Teknologi yang Digunakan
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Backend (Opsional untuk Saran AI)**: Express (`server.ts`) dengan `@google/genai` melalui endpoint `POST /api/ai-suggestions`
- **Penyimpanan Offline**: `localStorage` di browser
- **Suara (TTS)**: Web Speech API (`window.speechSynthesis`) dengan dukungan audio rekaman custom
- **Keamanan Backup**: Web Crypto API (`AES-256-GCM` + `PBKDF2` SHA-256) di `src/services/crypto.ts`

### Struktur Proyek
```text
├── server.ts                      # Server Express + endpoint /api/ai-suggestions & middleware Vite
├── index.html                     # Entry HTML & font Plus Jakarta Sans
├── src/
│   ├── App.tsx                    # State utama, logika kalimat, sinkronisasi tema gelap/terang
│   ├── types.ts                   # Definisi tipe data TypeScript (SymbolItem, AACProfile, UsageLog, dll.)
│   ├── data/
│   │   └── defaultSymbols.ts      # 70+ simbol bawaan & palet warna Fitzgerald Key
│   ├── services/
│   │   ├── storage.ts             # Penyimpanan lokal simbol, profil, log, dan saran adaptif
│   │   ├── tts.ts                 # Layanan Text-to-Speech Web Speech API
│   │   ├── gemini.ts              # Klien endpoint saran kata AI dengan fallback offline
│   │   └── crypto.ts              # Enkripsi & dekripsi AES-256-GCM untuk PIN pada backup JSON
│   └── components/
│       ├── Header.tsx             # Header responsif (menu hamburger untuk mobile & tablet)
│       ├── EmergencyBar.tsx       # Bar tombol darurat permanen
│       ├── SentenceBar.tsx        # Bar perangkai kalimat, tombol Ucapkan, dan saran kata
│       ├── UserMode.tsx           # Filter kategori, pencarian, dan grid simbol stabil
│       ├── SymbolCard.tsx         # Kartu simbol toleran salah sentuh (touch delay & debounce)
│       ├── CaregiverMode.tsx      # Panel pengatur caregiver lengkap
│       ├── PinModal.tsx           # Layar kunci PIN 4 digit
│       └── ConsentModal.tsx       # Persetujuan privasi lokal untuk wali
```

### Menjalankan Secara Lokal
1. Salin file `.env.example` menjadi `.env` (opsional, hanya diperlukan jika ingin mengaktifkan saran kata AI dari Gemini):
   ```bash
   cp .env.example .env
   ```
   Jika `GEMINI_API_KEY` tidak diisi, aplikasi tetap berjalan normal menggunakan saran kata lokal secara offline.
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Jalankan server pengembangan di port `3000`:
   ```bash
   npm run dev
   ```
4. Untuk membangun versi produksi dan menjalankannya:
   ```bash
   npm run build
   npm run start
   ```

---

## Lisensi

Aplikasi ini dilisensikan di bawah **GNU General Public License v3.0 (GPLv3)**. Silakan lihat file [LICENSE](LICENSE) untuk detail lengkap.

