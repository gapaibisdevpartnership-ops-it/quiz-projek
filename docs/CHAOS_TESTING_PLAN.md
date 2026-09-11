# Chaos Testing Plan

**Status:** ✅ Implemented (2026-09-11) — `tests/chaos/` (Layer 1) and
`tests/e2e/chaos/` (Layer 2), `npm run test:chaos` / `npm run test:chaos:e2e`.
See `docs/reports/CHAOS_TESTING_REPORT.md` for what actually happened,
including the gap it reproduced live. Kept below for the original reasoning;
minor deviations from "as planned" are noted in the report, not edited in here.

## Apa itu, dan kenapa

Chaos testing = sengaja menyuntikkan kegagalan (request gagal, lambat,
terpotong, bersamaan/race, respons rusak) ke sistem yang berjalan, lalu
memverifikasi sistem **tetap konsisten** — tidak kehilangan data, tidak
menggandakan efek, tidak membocorkan kunci jawaban, dan pulih dengan baik.
Beda dari test biasa: test biasa membuktikan jalur sukses bekerja; chaos test
membuktikan jalur **gagal** tidak merusak apa pun.

Untuk aplikasi ini, dua hal paling berharga untuk diuji: **konsistensi skor
dan attempt saat request bertabrakan/gagal** (karena scoring RPC ini basis
kepercayaan sistem training), dan **ketahanan quiz player** saat koneksi
peserta tidak stabil (autosave gagal, timer, submit).

## Di mana chaos testing diterapkan — dua lapis

Aplikasi ini di-hosting di infra terkelola (Vercel + Supabase) tanpa akses
untuk "membunuh" proses/instance seperti Chaos Monkey klasik. Jadi chaos
di-suntik di **level test**, pada dua titik nyata di codebase:

### Lapis 1 — Server / database: race & fault pada RPC
**Di mana:** `tests/chaos/` (test baru, pola sama seperti
`tests/integration/*` — Vitest + `@supabase/supabase-js` langsung terhadap
project Supabase, tanpa browser). Ini menembak RPC **bersamaan / berulang /
dengan input rusak** dan mengecek invarian di database sesudahnya.

**Kenapa di sini:** semua penulisan attempt/skor lewat RPC SECURITY DEFINER
(`start_quiz_attempt`, `save_objective_answer`, `save_essay_answer`,
`submit_quiz_attempt`, `finalize_attempt`, `grade_essay_answer`,
`expire_stale_attempts`, `admin_update_user`). Kalau ada race condition, di
sinilah dampaknya nyata (skor ganda, attempt melebihi limit, dsb) — bukan di
UI.

### Lapis 2 — Client: gangguan jaringan pada quiz player
**Di mana:** `tests/e2e/chaos/` (test baru, Playwright — pakai
`page.route()` untuk mencegat panggilan ke Supabase dan menyuntikkan delay,
`abort()`, atau status 5xx pada request tertentu, di tengah alur mengerjakan
kuis yang sungguhan berjalan di browser).

**Kenapa di sini:** ini menguji **apa yang dilihat & dialami peserta** —
apakah autosave retry, apakah timer tetap akurat, apakah jawaban hilang, apakah
UI memberi tahu ada masalah — yang tidak kelihatan dari test level RPC saja.

**Tidak termasuk dalam scope (dan alasannya):**
- Chaos infrastruktur (mematikan pod/instance Supabase atau Vercel) — tidak
  ada aksesnya di plan terkelola ini, dan tidak proporsional untuk aplikasi
  internal skala ini.
- Load/stress testing (ribuan user bersamaan) — beda tujuan (kapasitas, bukan
  ketahanan terhadap kegagalan). Bisa jadi item terpisah kalau diperlukan.

## Skenario yang diusulkan, per lapis

### Lapis 1 — Server (`tests/chaos/`)

| # | Skenario | RPC / tabel | Invarian yang dicek |
|---|---|---|---|
| 1 | Klik ganda / dua tab: `start_quiz_attempt` dipanggil 10× bersamaan oleh user yang sama | `start_quiz_attempt` | Tidak lebih dari 1 attempt `in_progress` dibuat; `attempt_number` tidak bentrok; tidak melebihi `max_attempts` |
| 2 | `save_objective_answer` ditembak bersamaan dengan `submit_quiz_attempt` (siapa lebih dulu tidak pasti) | `save_objective_answer`, `submit_quiz_attempt` | Setelah submit, tidak ada jawaban yang berubah lagi; attempt final konsisten dengan snapshot skor |
| 3 | `submit_quiz_attempt` dipanggil 20× bersamaan (bukan berurutan seperti test idempotensi yang ada sekarang) | `submit_quiz_attempt` | Tepat satu hasil final; `final_score`/`percentage` tidak berubah antar panggilan |
| 4 | `grade_essay_answer` dari dua trainer berbeda untuk esai yang sama, bersamaan | `grade_essay_answer`, `finalize_attempt` | `finalize_attempt` tidak terpanggil dobel secara merusak; skor akhir konsisten dengan nilai terakhir yang sah |
| 5 | `expire_stale_attempts()` dijalankan bersamaan dengan user yang sedang aktif submit attempt-nya sendiri | `expire_stale_attempts`, `submit_quiz_attempt` | Attempt tidak di-finalize dua kali dengan hasil berbeda; tidak ada dead-lock |
| 6 | Input rusak/adversarial: `target_attempt_id` acak/tidak ada, `selected_option_ids` berisi ID milik soal lain, essay 500 KB, `score` negatif/di luar poin | semua RPC attempt & grading | RPC menolak dengan error kode yang benar (`ATTEMPT_NOT_FOUND`, `OPTION_NOT_IN_QUESTION`, `SCORE_OUT_OF_RANGE`, dst) — bukan crash / bukan diterima diam-diam |
| 7 | `admin_update_user` dipanggil bersamaan oleh dua admin untuk role yang sama (mis. keduanya coba jadi super_admin terakhir yang di-demote) | `admin_update_user` | Invarian "minimal 1 super_admin aktif" tidak pernah dilanggar walau race |

### Lapis 2 — Client (`tests/e2e/chaos/`)

| # | Skenario | Cara suntik | Yang diverifikasi |
|---|---|---|---|
| 8 | `save_objective_answer` gagal (abort) sesekali secara acak saat peserta menjawab banyak soal | `page.route()` gagalkan request ke RPC itu ~30% dari waktu | Status "Save failed" tampil; **tidak ada jawaban yang secara diam-diam hilang** setelah retry/submit |
| 9 | Semua request ke Supabase lambat (delay 3–8 detik) selama pengerjaan | `page.route()` tunda response | Timer tetap akurat (berbasis server, bukan macet); UI tidak submit ganda karena double-klik akibat lag |
| 10 | Koneksi putus total di tengah (semua request abort) lalu pulih setelah beberapa detik | `page.route()` abort lalu lepas | Peserta tidak kehilangan progres; begitu koneksi pulih, state tersinkron lagi |
| 11 | `submit_quiz_attempt` gagal di percobaan pertama (network error), peserta klik submit lagi | Abort request submit sekali, lalu izinkan | Tidak submit dobel/skor dobel (menguji idempotensi dari sisi UI, bukan cuma RPC) |
| 12 | `get_attempt_for_player` mengembalikan **response lambat tapi valid** saat resume setelah refresh | Delay saja, tanpa error | Tidak ada flash "attempt not found" yang salah; resume tetap benar |

## Tooling

Tidak ada dependency baru untuk Lapis 1 dan 2 — keduanya reuse yang sudah ada:
- **Lapis 1:** Vitest + `@supabase/supabase-js` (persis seperti
  `tests/integration/`), tinggal `Promise.all([...])` untuk menembak RPC
  bersamaan.
- **Lapis 2:** Playwright `page.route()` (built-in, sudah dipakai project ini)
  untuk mencegat & memanipulasi network.

Kalau nanti mau chaos yang lebih realistis di level HTTP proxy (mis. Toxiproxy
di antara app dan Supabase) — itu di luar effort plan ini; dicatat sebagai
opsi masa depan, bukan bagian dari rencana ini.

## Cara menjalankan

- Script baru: `npm run test:chaos` (Lapis 1) dan masuk ke
  `npm run test:e2e -- tests/e2e/chaos` atau script terpisah untuk Lapis 2.
- **Tidak** masuk gate `predeploy` / CI default — chaos test lebih lambat dan
  sebagian sengaja menembak race condition (bisa flaky secara desain). Jalankan
  manual atau di job CI terpisah (mirip `RUN_E2E`), bukan syarat setiap PR.
- Test yang menembak race condition memakai retry/jumlah-ulangan (mis. jalankan
  race 20× dan pastikan invarian selalu bertahan, bukan cuma sekali) supaya
  hasil tidak kebetulan hijau.

## Kriteria lulus

Per skenario, "lulus" = sistem gagal dengan **cara yang aman**: menolak
dengan error yang jelas, atau berhasil tepat sekali (bukan nol, bukan dua
kali). "Gagal" = data korup, skor salah, attempt melebihi batas, atau kunci
jawaban bocor saat error.

## Kesenjangan yang KEMUNGKINAN akan langsung ketahuan (jujur di depan)

Beberapa hal ini sudah tercatat di `docs/IMPROVEMENT_BACKLOG.md` sebagai belum
diperbaiki — chaos test skenario #1 dan #2 kemungkinan besar **akan gagal
sampai itu diperbaiki**, dan itu memang tujuannya (mendokumentasikan gap
dengan bukti test, bukan cuma tulisan):

- **P1 #6** — `start_quiz_attempt` belum ada lock (advisory lock / unique index
  partial) → skenario #1 kemungkinan gagal sekarang.
- **P2 #11** — `save_objective_answer`/`save_essay_answer` belum `FOR UPDATE`
  attempt-nya → skenario #2 kemungkinan gagal sekarang.
- **P2 #27** — belum ada retry otomatis untuk autosave yang gagal → skenario
  #8 kemungkinan gagal sekarang (ini justru alasan bagus untuk akhirnya
  mengerjakan P2 #27).

Rencana: jalankan chaos test dulu, dokumentasikan yang merah, baru putuskan
mana yang diperbaiki sebelum lulus vs mana yang diterima sebagai batas V1.

## Urutan pengerjaan yang diusulkan (setelah plan ini disetujui)

1. Lapis 1, skenario #3 dan #6 dulu (paling murah, tidak menyentuh gap yang
   belum diperbaiki — baseline hijau).
2. Lapis 1, skenario #1 dan #2 (mengungkap P1 #6 / P2 #11 — merah, sebagai
   dokumentasi).
3. Lapis 1, skenario #4, #5, #7.
4. Lapis 2 (butuh dev server + Playwright, lebih lambat) — skenario #9, #10,
   #12 dulu (tidak bergantung gap yang diketahui), lalu #8 dan #11.
5. Tambahkan `npm run test:chaos` + dokumentasi cara pakai ke
   `docs/TESTING.md`.
6. Laporan hasil ke `docs/reports/`.

## Estimasi ukuran

- Lapis 1: ~4–5 file test baru, ±300–400 baris. Kecil–sedang.
- Lapis 2: ~2–3 file test baru, ±200–300 baris, lebih lambat dijalankan.
- Tanpa migration, tanpa dependency baru, tanpa perubahan kode aplikasi di
  langkah ini — kecuali kalau kamu juga mau langsung memperbaiki gap yang
  ketahuan (P1 #6 / P2 #11 / P2 #27), yang berarti pekerjaan tambahan di luar
  scope "menambahkan chaos testing" itu sendiri.
