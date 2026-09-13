# UAT Prompt — Playwright MCP

Paste this into a fresh Claude Code session (with the Playwright MCP server
installed) opened at the project root. It drives a real browser through the
role-based flows and writes a UAT report. It does **not** write spec files.

---

```
Kamu bertugas menjalankan UAT (User Acceptance Testing) manual pada aplikasi Quiz Sales System
menggunakan Playwright MCP (kendalikan browser sungguhan: navigate, click, fill, snapshot,
screenshot). JANGAN menulis file spec — jalankan alurnya langsung lewat browser, verifikasi tiap
kriteria, dan catat hasilnya.

## Lingkungan
- URL: https://quiz-projek.vercel.app  (atau jalankan `npm run dev` dan pakai http://localhost:3000)
- Password semua akun: QuizQA!2026
- Akun (lihat docs/TEST_ACCOUNTS.md):
  - Super Admin : superadmin.qa@example.com  (role super_admin)
  - Trainer     : trainer.qa@example.com     (role admin)
  - Sales 01    : sales.qa01@example.com     (role sales)
  - Sales 02    : sales.qa02@example.com     (role sales)  -> untuk uji isolasi antar user
- Referensi acceptance: docs/PRD.md, docs/DOMAIN_RULES.md, docs/API_CONTRACTS.md,
  docs/ROUTES.md, docs/RELEASE_CHECKLIST.md

## Aturan
- Beri prefix "UAT <timestamp>" pada semua data yang kamu buat (kategori, soal, quiz) supaya mudah
  dikenali. Tidak ada hard-delete lewat UI (docs/DOMAIN_RULES.md), jadi data uji akan tertinggal —
  cukup catat apa saja yang dibuat di akhir.
- Jangan mengubah akun/user selain menyalakan-mematikan status akun QA, dan kembalikan ke semula.
- Ambil screenshot di tiap langkah penting dan pada SETIAP kegagalan.
- Untuk tiap langkah tulis: skenario, langkah, hasil diharapkan, hasil aktual, status (PASS/FAIL),
  bukti (nama screenshot / kutipan).

## Skenario UAT (jalankan berurutan — saling bergantung)

### 1. Autentikasi & route guard
1.1  Buka /dashboard tanpa login  -> diarahkan ke /login.
1.2  Login dengan kredensial salah -> muncul pesan error, tetap di /login.
1.3  Login Sales 01 -> mendarat di /dashboard sales; nav berisi Dashboard, Quizzes, History,
     Leaderboard, Profile (TIDAK ada Question Bank / Users / dst).
1.4  Sebagai Sales 01, buka manual tiap route: /admin/quizzes, /admin/questions, /admin/users,
     /admin/teams, /admin/results, /admin/grading, /admin/analytics -> semua redirect ke /dashboard.
1.5  Sign out -> kembali ke /login.

### 2. Super Admin
2.1  Login Super Admin -> /dashboard trainer, nav lengkap.
2.2  /admin/users -> daftar semua akun tampil. Buka detail satu user.
2.3  Nonaktifkan Sales 02, lalu di jendela/verifikasi terpisah coba login Sales 02 ->
     ditolak / diarahkan ke /inactive. Aktifkan lagi Sales 02 (WAJIB dikembalikan).
2.4  /admin/teams -> buat tim "UAT Team <ts>", tambahkan Sales 01 sebagai anggota.

### 3. Trainer — bangun konten
3.1  Login Trainer. /admin/questions -> New: buat 1 soal single_choice (mis. "2+2=?" jawaban benar
     "4"), 1 soal multiple_choice, 1 soal true_false, 1 soal essay (isi sample_answer + grading_notes
     + keywords, mis. "awareness, interest, decision").
3.2  (opsional) Upload gambar pada 1 soal dan 1 opsi jawaban -> tersimpan & preview tampil.
3.3  /admin/quizzes/new -> buat quiz "UAT Quiz <ts>": passing_score 50, max_attempts 2,
     duration_minutes 10, show_result ON. Simpan -> status draft.
3.4  /admin/quizzes/:id/questions -> attach keempat soal, atur urutan, set poin. Preview ->
     pastikan TIDAK ada attempt yang terbuat (cek /admin/results sebelum & sesudah preview).
3.5  Publish quiz -> status published.
3.6  Assign quiz ke Sales 01 (individual).

### 4. Sales — kerjakan quiz
4.1  Login Sales 01. /quizzes -> "UAT Quiz <ts>" muncul. Buka detailnya.
4.2  Start -> masuk player. Cek: timer berjalan, semua soal tampil, opsi jawaban ada.
4.3  Jawab soal pilihan (pilih jawaban benar untuk yang objektif), isi essay.
4.4  Buka DevTools/network via MCP jika bisa, atau ambil snapshot payload: pastikan respons ke
     sales TIDAK memuat "is_correct", "sample_answer", "grading_notes", "keywords".
4.5  Reload halaman player -> jawaban & sisa waktu tetap (resume attempt yang sama, bukan baru).
4.6  Submit. Submit kedua kali -> no-op (tidak menggandakan/ mengubah).
4.7  Karena ada essay -> status attempt = pending_review. Buka /quizzes/:id/result/:attemptId ->
     tampil status pending (skor objektif boleh tampil sesuai desain).
4.8  /history -> attempt tercatat. /leaderboard -> halaman terbuka untuk sales.

### 5. Isolasi antar user
5.1  Login Sales 02. /quizzes -> "UAT Quiz <ts>" TIDAK muncul (tidak di-assign).
5.2  Coba akses URL result/attempt milik Sales 01 secara langsung -> ditolak / tidak tampil.

### 6. Trainer — penilaian & hasil
6.1  Login Trainer. /admin/grading -> attempt Sales 01 ada di antrian pending_review.
6.2  Untuk essay dengan keywords: cek badge saran ("Likely Correct"/"Partial match"/"Likely
     Incorrect") muncul dan jumlah match masuk akal; coba tombol "Mark Correct"/"Mark Wrong" pada
     satu essay (skor terisi otomatis + tersimpan). Beri skor tiap essay (0..poin) + feedback.
     Setelah semua essay dinilai -> attempt otomatis finalize: status jadi submitted, ada
     percentage & passed.
6.3  /admin/results -> attempt tampil dengan skor akhir; buka /admin/results/:id -> rincian benar.
6.4  /admin/analytics -> KPI, tabel per-quiz, performa sales. Angka rekonsiliasi dengan /admin/results.
6.5  Login Sales 01 lagi -> /quizzes/:id/result/:attemptId sekarang tampil skor + feedback trainer.

### 7. Responsif (cek cepat)
7.1  Set viewport 375x812. Kunjungi /login, /dashboard, /quizzes, /history, /leaderboard, /profile
     (sebagai sales) dan seluruh /admin/* (sebagai trainer). Pastikan tidak ada scroll horizontal
     dan layout tidak rusak. Screenshot tiap halaman.

## Keluaran
Tulis laporan Markdown ke docs/reports/UAT_REPORT_<YYYY-MM-DD>.md berisi:
- Ringkasan: jumlah PASS / FAIL, tanggal, environment (URL), commit git aktif.
- Tabel per skenario (ID, deskripsi, status, bukti).
- Daftar semua bug/anomali dengan langkah reproduksi + screenshot.
- Daftar data uji yang tertinggal (nama quiz/soal/tim, id attempt).
- Rekomendasi go / no-go rilis merujuk "Release gate" di docs/RELEASE_CHECKLIST.md.
Simpan semua screenshot di folder docs/reports/uat-<YYYY-MM-DD>/.
```
