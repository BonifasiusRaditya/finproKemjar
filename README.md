# Vulnerable Web Application

⚠️ **PERINGATAN: Aplikasi ini sengaja dibuat dengan kerentanan untuk tujuan pembelajaran keamanan siber!**

## Deskripsi

Aplikasi web ini dibuat untuk mempelajari dan memahami dua jenis kerentanan keamanan umum:

1. **Insecure JWT (JSON Web Token)**
2. **Command Injection**

## Struktur Proyek

```
finpro/
├── backend/          # Node.js Express server
├── frontend/         # React Vite application
└── README.md
```

## Cara Menjalankan

### Backend (Port 3001)

```bash
cd backend
npm install
npm start
```

### Frontend (Port 3000)

```bash
cd frontend
npm install
npm run dev
```

Buka browser dan akses: `http://localhost:3000`

## Akun Login

- **Admin**: username: `admin`, password: `admin123`
- **User**: username: `user`, password: `user123`

## Kerentanan yang Diimplementasi

### 1. Insecure JWT

**Lokasi**: `backend/server.js`

**Masalah**:
- JWT Secret menggunakan string lemah: `"secret"`
- Tidak ada expiration time pada token
- Algorithm verification lemah (menerima 'none' algorithm)
- Error handling yang buruk mengekspos informasi sensitif

**Eksploitasi**:
- Token dapat di-decode dengan mudah
- Secret dapat di-brute force
- Token tidak pernah expired
- Dapat membuat token palsu dengan algoritma 'none'

**Contoh Eksploitasi**:
```bash
# Decode JWT token
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." | base64 -d

# Membuat token dengan algoritma 'none'
# Header: {"alg":"none","typ":"JWT"}
# Payload: {"id":1,"username":"admin","role":"admin"}
```

### 2. Command Injection

**Lokasi**: `backend/server.js` - endpoints `/api/ping` dan `/api/system-info`

**Masalah**:
- Input pengguna langsung dimasukkan ke dalam command shell
- Tidak ada sanitasi atau validasi input
- Menggunakan `exec()` tanpa pembatasan

**Eksploitasi**:
```bash
# Pada form ping:
google.com; ls -la           # List directory
google.com && whoami         # Show current user  
google.com | cat /etc/passwd # Read system files (Linux)
google.com & dir C:\         # List C: drive (Windows)

# Pada form system command:
whoami & echo "Injected!"    # Execute multiple commands
dir & type important.txt     # Read files
```

## Endpoint API Backend

- `POST /api/login` - Login dengan JWT lemah
- `GET /api/profile` - Ambil profil user (perlu token)
- `GET /api/admin/users` - Ambil semua user (admin only)
- `POST /api/ping` - Execute ping command (vulnerable)
- `POST /api/system-info` - Execute system command (vulnerable)

## Fitur Frontend

### 1. Login Page
- Form login dengan kredensial preset
- Menampilkan JWT token yang diterima

### 2. Dashboard
- Tampilkan profil user
- Tampilkan JWT token mentah
- Admin dapat melihat semua user

### 3. Command Execution
- Interface untuk testing ping command
- Interface untuk testing system command  
- Contoh payload untuk command injection

## Cara Memperbaiki Kerentanan

### Untuk JWT:
1. Gunakan secret yang kuat dan kompleks
2. Set expiration time pada token
3. Gunakan algoritma yang aman (RS256)
4. Implementasi token blacklist
5. Validasi algorithm secara ketat

### Untuk Command Injection:
1. Gunakan parameterized queries/commands
2. Implementasi input validation dan sanitization
3. Gunakan whitelist untuk command yang diizinkan
4. Hindari penggunaan `exec()` dengan user input
5. Jalankan dengan privilege minimal

## Tujuan Pembelajaran

Aplikasi ini bertujuan untuk:
- Memahami cara kerja kerentanan JWT dan Command Injection
- Belajar mengidentifikasi kerentanan dalam code
- Memahami dampak dari kerentanan tersebut
- Mempelajari cara memperbaiki kerentanan

## Disclaimer

⚠️ **HANYA UNTUK TUJUAN EDUKASI**

Aplikasi ini tidak boleh digunakan di production atau environment yang terhubung dengan internet. Hanya gunakan di lingkungan test yang terisolasi untuk pembelajaran keamanan.

## Dependencies

### Backend
- express
- jsonwebtoken  
- cors
- bcrypt
- child_process

### Frontend
- react
- react-router-dom
- axios
- vite