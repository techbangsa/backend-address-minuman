# Backend Address Minuman

Service ini adalah backend Express untuk menyimpan dan mengatur alamat customer di Shopify via Admin GraphQL API.

## Base URL

- Local: `http://localhost:3000`
- Production: sesuaikan dengan URL deployment (mis. Vercel)

## Endpoint Overview

1. `GET /`
2. `POST /api/address/save`
3. `POST /api/address/set-default`

---

## 1) Health Check

### `GET /`

Cek status service.

### Header

Tidak ada header khusus yang wajib.

### Body

Tidak ada body.

### Success Response (200)

```json
{
  "status": "ok",
  "service": "backend-address-minuman"
}
```

---

## 2) Save Address (Create / Update)

### `POST /api/address/save`

Endpoint utama untuk menyimpan alamat.

### Behavior

- **Create mode (default)**: jika `action` tidak dikirim, endpoint akan membuat alamat baru.
- **Update mode (explicit)**: kirim `action: "update"` + `addressId` untuk update alamat existing.
- Jika customer belum punya default address, alamat baru akan diset menjadi default otomatis.

### Required Headers

- `Content-Type: application/json`

### Optional / Recommended Headers

- `Accept: application/json`
- `Authorization: Bearer <token>` (opsional, saat ini belum divalidasi oleh server)
- `Origin: <your-frontend-domain>` (otomatis saat dipanggil dari browser)

> Catatan CORS: origin yang diizinkan dikontrol di server. Untuk browser client, pastikan request datang dari domain yang sudah di-allow.

### Request Body (minimum)

```json
{
  "email": "customer@example.com",
  "address": {
    "formatted": "Jl. Raya Kuta No.1, Kuta, Kec. Kuta, Kabupaten Badung, Bali 80361, Indonesia"
  }
}
```

### Request Body (best practice / lengkap)

```json
{
  "email": "customer@example.com",
  "address": {
    "formatted": "Jl. Raya Kuta No.1, Kuta, Kec. Kuta, Kabupaten Badung, Bali 80361, Indonesia",
    "district": "Kuta",
    "city": "Badung",
    "province": "Bali",
    "country": "Indonesia",
    "zip": "80361",
    "extra": "Lantai 3, dekat lobby"
  }
}
```

### Update Body (explicit update)

```json
{
  "email": "customer@example.com",
  "action": "update",
  "addressId": "gid://shopify/MailingAddress/123456789",
  "address": {
    "formatted": "Jl. Raya Kuta No.1, Kuta, Kec. Kuta, Kabupaten Badung, Bali 80361, Indonesia",
    "district": "Kuta",
    "city": "Badung",
    "province": "Bali",
    "country": "Indonesia",
    "zip": "80361",
    "extra": "Lantai 3, dekat lobby"
  }
}
```

### Success Response (Create)

```json
{
  "success": true,
  "action": "created",
  "address": {
    "id": "gid://shopify/MailingAddress/123456789",
    "address1": "Jl. Raya Kuta No.1, Kuta, Kec. Kuta, Kabupaten Badung, Bali 80361, Indonesia | Lantai 3, dekat lobby",
    "address2": "Kuta",
    "city": "Badung",
    "province": "Bali",
    "country": "Indonesia",
    "zip": "80361"
  }
}
```

### Success Response (Update)

```json
{
  "success": true,
  "action": "updated",
  "address": {
    "id": "gid://shopify/MailingAddress/123456789",
    "address1": "...",
    "address2": "...",
    "city": "...",
    "province": "...",
    "country": "...",
    "zip": "..."
  }
}
```

### Error Responses

- `400` jika `email` atau `address.formatted` tidak ada
- `404` jika customer Shopify tidak ditemukan
- `500` untuk error internal

---

## 3) Set Default Address

### `POST /api/address/set-default`

Set alamat tertentu sebagai default address customer.

### Required Headers

- `Content-Type: application/json`

### Optional / Recommended Headers

- `Accept: application/json`
- `Authorization: Bearer <token>` (opsional, saat ini belum divalidasi)

### Request Body

```json
{
  "email": "customer@example.com",
  "addressId": "123456789"
}
```

`addressId` bisa berupa:
- numeric ID (`"123456789"`), atau
- GID Shopify (`"gid://shopify/MailingAddress/123456789"`)

### Success Response

```json
{
  "success": true,
  "action": "default_updated",
  "defaultAddress": {
    "id": "gid://shopify/MailingAddress/123456789"
  }
}
```

### Error Responses

- `400` jika `email` / `addressId` tidak ada
- `404` jika customer tidak ditemukan atau address bukan milik customer
- `500` untuk error internal

---

## Best Practice Hit Semua Endpoint

1. **Selalu kirim JSON valid**
   - Header wajib: `Content-Type: application/json`
   - Hindari field kosong untuk field penting (`email`, `address.formatted`, `addressId`)

2. **Gunakan flow aman untuk alamat**
   - Simpan alamat baru via `POST /api/address/save` (mode create)
   - Jika perlu update alamat tertentu, pakai mode explicit update (`action: "update"` + `addressId`)
   - Set default via `POST /api/address/set-default`

3. **Jaga konsistensi data alamat**
   - Disarankan kirim komponen terstruktur: `district`, `city`, `province`, `country`, `zip`
   - `extra` dipakai untuk detail tambahan (lantai/unit/patokan)

4. **Handle error code dengan benar di frontend**
   - `400`: validasi request gagal
   - `404`: resource/customer/address tidak ditemukan
   - `500`: retry terbatas + log untuk investigasi

5. **Jangan kirim data sensitif berlebihan**
   - Cukup field yang dibutuhkan endpoint
   - Hindari menyimpan token di localStorage tanpa proteksi

6. **Tambahkan timeout & retry policy di client**
   - Gunakan timeout request (mis. 10-15 detik)
   - Retry hanya untuk error transient (`500`, network error), bukan untuk `400`

---

## Environment Variables

Pastikan variabel berikut tersedia:

- `SHOPIFY_ACCESS_TOKEN`
- `SHOP` (contoh: `minumancom.myshopify.com`)
- `API_VERSION` (default di kode: `2026-01`)
- `PORT` (opsional, default `3000`)

---

## Run Lokal

```bash
npm install
npm run dev
```

Server akan berjalan di `http://localhost:3000` (atau sesuai `PORT`).
