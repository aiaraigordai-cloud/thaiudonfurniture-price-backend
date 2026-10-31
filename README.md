# CATALOG A — UNIFIED MASTER SPECIFICATION (v1.3)
**Production-Grade Web Application for Multi-tier Product & Price Management**

---

## 📌 บทนำและภาพรวมโปรเจกต์
ระบบ **Catalog A** ถูกพัฒนาขึ้นตามข้อกำหนด Unified Master Specification v1.3 เพื่อเป็นศูนย์กลางการจัดการสินค้าและราคาสินค้า 4 ระดับ (Four Price Tiers) ได้แก่:
1. **ราคาเซลล์ (SALE_PRICE)** — ราคาโปรโมชั่นพิเศษหรือลดราคา
2. **ราคาปลีก (RETAIL_PRICE)** — ราคาจำหน่ายหน้าร้านทั่วไป
3. **ราคา VIP (VIP_PRICE)** — ราคาพิเศษสำหรับลูกค้า VIP / สมาชิกองค์กร
4. **ราคาทั่วไป (GENERAL_PRICE)** — ราคามาตรฐานโครงการ / ตัวแทนจำหน่าย

---

## 👤 บัญชี System Owner สูงสุด (Pre-configured)
ระบบได้รับการตั้งค่าบัญชี System Owner เริ่มต้นเรียบร้อยแล้ว:

- **ชื่อผู้ใช้ (Username):** `davidsuksomboriboon`
- **รหัสผ่าน (Password):** ตั้งค่า `OWNER_PASSWORD` เป็นรหัสผ่านใหม่ที่ยาวอย่างน้อย 16 ตัวอักษรก่อนรัน `npm run seed`
- **อีเมล (Email):** `davidsuksomboriboon@gmail.com`
- **ชื่อพนักงาน:** `ดาวิด สุขสมบริบูรณ์`
- **สิทธิ์:** `SYSTEM_OWNER` (มีสิทธิ์ทุกฟังก์ชัน รวมถึงเมนูจัดการสิทธิ์ `admin/permissions`, จัดการพนักงาน `admin/employees`, และดู Audit Logs)

---

## 🚀 วิธีการรันบน Localhost

### 1. ติดตั้ง Dependencies (ทำเสร็จแล้ว)
```bash
npm install
```

### 2. รัน Database Seed & Initialization
```bash
npm run seed
```

### 3. รัน Unit & Integration Tests
```bash
npm test
```

### 4. รันเซิร์ฟเวอร์ Localhost
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่:
👉 **http://localhost:3000**

---

## 🔗 หน้าแคตตาล็อกลูกค้า (Live Pricing Customer Demo)
ลูกค้าไม่ต้องสมัครสมาชิกหรือล็อกอิน เปิดดูผ่านลิงก์แชร์ที่มีความปลอดภัยสูง:

👉 **http://localhost:3000/s/vip-showcase-2026**

### กฎความปลอดภัยฝั่งลูกค้า (Strict Price Isolation Rule):
- ลูกค้าจะเห็นเพียงคำว่า **"ราคา"** ตามด้วยตัวเลขเงิน เช่น `ราคา 21,900 บาท`
- **ห้าม** แสดงชื่อระดับราคา (ไม่มีคำว่า SALE_PRICE, RETAIL_PRICE, VIP_PRICE, GENERAL_PRICE หรือ ราคาเซลล์, ราคาปลีก, ราคา VIP, ราคาทั่วไป)
- ข้อมูลราคาประเภทอื่นจะไม่ถูกส่งไปยังเบราว์เซอร์ของลูกค้าโดยเด็ดขาด
- **Live Pricing:** หาก Admin มีการแก้ไขราคาในหลังบ้าน เมื่อลูกค้าเปิดหรือรีเฟรชหน้า จะเห็นราคาใหม่ทันทีโดยไม่ต้องสร้างลิงก์ใหม่

---

## 🛡️ ฟังก์ชันหลักของระบบ (Features Implemented)

### 1. ระบบ Authentication & Employee Allowlist
- เข้าสู่ระบบด้วย `Username` และ `Password`
- ป้องกันการสมัครโดยไม่ได้รับอนุญาต: ผู้สมัครต้องมีชื่อและ Authorized Email ใน **Employee Allowlist** เท่านั้น
- ระบบกู้คืนชื่อผู้ใช้ (Forgot Username) และรีเซ็ตรหัสผ่าน (Forgot Password) พร้อมการตอบกลับแบบป้องกัน User Enumeration Attacks

### 2. ระบบจัดการสิทธิ์เฉพาะ System Owner (`/admin/permissions`)
- บัญชี `ADMIN` จะไม่เห็นเมนูนี้ และถูกบล็อกที่ระดับเซิร์ฟเวอร์หากพิมพ์ URL ตรง
- ควบคุม Feature Flags รายบัญชี:
  - `product_manage`
  - `price_edit`
  - `price_bulk_import`
  - `share_link_manage`
  - `reports_view`
- สั่งระงับบัญชี (Suspended) หรือเปิดใช้งานบัญชีพนักงานได้ทันที

### 3. ระบบจัดการสินค้า (`/admin/products`)
- เพิ่ม / แก้ไข / ลบสินค้า
- กำหนดสเปก: กว้าง x สูง x ลึก, สี, รายละเอียด, หมวดหมู่
- กำหนดราคาทั้ง 4 ระดับในหน้าเดียว

### 4. ระบบแก้ไขราคา 4 ระดับ (`/admin/prices`)
- ค้นหาด้วย SKU หรือชื่อสินค้า
- แก้ไขราคาทั้ง 4 ระดับแบบเรียลไทม์ (Inline Edit)
- ตรวจจับความถูกต้องและบันทึกลง `price_change_history` และ `audit_logs`

### 5. ระบบนำเข้าไฟล์ราคาจำนวนมากด้วย AI (`/admin/prices/bulk-update`)
- **บังคับเลือก Price Tier** ก่อนอัปโหลดไฟล์ เพื่อป้องกันการแก้ไขราคาอื่นโดยไม่ตั้งใจ
- รองรับไฟล์ Excel (.xlsx, .xls), PDF, Word (.docx), รูปภาพแคตตาล็อก (JPG/PNG) และ Text/CSV
- **Auto-select Valid Rows (ตามข้อกำหนด Part 8):**
  - รายการ **PASS** (SKU ตรง + ราคาถูกต้อง) -> **ระบบเลือก (Check) ให้อัตโนมัติทันที**
  - รายการ **NEEDS_REVIEW** -> ไม่เลือกอัตโนมัติ ต้องตรวจสอบก่อน
  - รายการ **FAILED** -> ไม่เลือก และบล็อกไม่ให้อัปเดต
- **Single Confirmation:** ปุ่มกดยืนยันเพียงครั้งเดียว `ยืนยันอัปเดตราคา (X รายการ)` บันทึกด้วย Database Transaction

### 6. ระบบ Rollback การนำเข้า (`/admin/prices/import-history`)
- สามารถกดย้อนกลับ (Rollback) เพื่อคืนค่าราคาก่อนหน้าของแต่ละ Batch ได้อย่างปลอดภัย

### 7. โครงสร้าง Database สำหรับ Supabase PostgreSQL
- ไฟล์ Migration ตัวเต็ม: `migrations/001_initial_schema.sql`
- รองรับ Row Level Security (RLS), UUIDs, Unique Constraints, และ Indexes ประสิทธิภาพสูง
