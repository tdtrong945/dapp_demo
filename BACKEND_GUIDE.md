# Hướng Dẫn Dịch Vụ Backend Gym

Hướng dẫn này bao gồm các dịch vụ backend cho ứng dụng Web3 Gym. Những dịch vụ này xử lý quản lý hội viên, đồng bộ hóa sự kiện, và xác minh thanh toán.

## Tổng Quan

Backend bao gồm 3 dịch vụ chính:

1. **Dịch Vụ Đồng Bộ Sự Kiện** (`syncGymEvents.ts`) - Lắng nghe sự kiện của hợp đồng và đồng bộ vào cơ sở dữ liệu
2. **Dịch Vụ Thành Viên** (`gymMemberService.ts`) - Các hoạt động CRUD cho hội viên gym
3. **Dịch Vụ Thanh Toán** (`paymentVerificationService.ts`) - Theo dõi và xác minh thanh toán

## Cài Đặt

### Biến Môi Trường

Tạo file `.env` trong thư mục gốc dự án:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Blockchain
RPC_URL=http://localhost:8545              # Hoặc RPC của Sapphire testnet
PRIVATE_KEY=your_private_key_here          # Cho các giao dịch (nếu cần)
CONTRACT_ADDRESS=0x...                     # Địa chỉ hợp đồng GymMembership

# API Server (tùy chọn)
API_PORT=3001
SYNC_EVENTS=true                           # Tự động khởi động event listener
```

### Cài Đặt Phụ Thuộc

```bash
# Cài đặt các phụ thuộc
npm install

# Tạo file .env
cp .env.example .env

# Chạy migrations cơ sở dữ liệu (nếu cần)
npm run db:init
```

## Dịch Vụ 1: Dịch Vụ Đồng Bộ Sự Kiện

### Mục Đích

Lắng nghe các sự kiện hợp đồng `GymMembership` và tự động đồng bộ chúng vào Supabase. Điều này giữ cho cơ sở dữ liệu được đồng bộ với trạng thái on-chain.

### Các Sự Kiện Được Hỗ Trợ

| Sự Kiện              | Hành Động                   | Cập Nhật Cơ Sở Dữ Liệu                                      |
| -------------------- | --------------------------- | ----------------------------------------------------------- |
| `MemberRegistered`   | Hội viên mới đăng ký        | Chèn vào `gym_member_profiles`, ghi lại thanh toán          |
| `MembershipRenewed`  | Hội viên gia hạn thành viên | Cập nhật `gym_member_profiles`, cập nhật ngày hết hạn      |
| `AttendanceRecorded` | Admin ghi lại điểm danh     | Chèn vào `gym_attendance_records`                           |
| `AdminAdded`         | Gán admin mới               | Gán vai trò `admin` cho người dùng                          |
| `PaymentReceived`    | Thanh toán được xử lý       | Ghi lại trong `gym_payment_transactions`                    |
| `RevenueWithdrawn`   | Chủ sở hữu rút tiền         | Ghi sự kiện rút tiền                                        |

### Khởi Động Event Listener

```bash
# Terminal 1: Khởi động listener (liên tục giám sát sự kiện)
npm run sync:gym-events

# Đầu ra:
# 🔍 Listening to GymMembership events at 0x...
# ✅ Event listeners registered. Waiting for events...
```

Listener sẽ giữ hoạt động và đồng bộ sự kiện theo thời gian thực khi chúng xảy ra trên blockchain.

### Ví Dụ Đồng Bộ Sự Kiện

Khi người dùng gọi `registerMember(name, type)` trên hợp đồng:

```
Contract Event → syncGymEvents → Database
MemberRegistered(address, name, type, date) →
  1. Tạo/cập nhật bản ghi app_users
  2. Chèn gym_member_profiles (membership_type, expiry_date)
  3. Ghi lại gym_payment_transactions
```

## Dịch Vụ 2: Dịch Vụ Thành Viên

### Mục Đích

Cung cấp các hoạt động CRUD để quản lý hội viên gym ngoài chuỗi (tên, email, xóa mềm). Dữ liệu on-chain (loại thành viên, ngày hết hạn) được kiểm soát bởi hợp đồng thông minh.

### Các Phương Thức Chính

#### Lấy Hồ Sơ Hội Viên

```bash
npm run member:get <wallet_address>
```

Trả lại hồ sơ hội viên đầy đủ bao gồm trạng thái thành viên và thống kê.

```typescript
// Sử dụng lập trình
import { gymMemberService } from "../services/gymBackendServices";

const profile = await gymMemberService.getMemberProfile("0x123...");
// Trả lại: {
//   wallet_address, display_name, email, membership_type,
//   registration_date, expiry_date, total_attendance, is_active,
//   status, updated_at
// }
```

#### Liệt Kê Tất Cả Hội Viên

```bash
npm run member:list
```

#### Lấy Lịch Sử Điểm Danh

```bash
npm run member:attendance <wallet_address>
```

Trả lại bản ghi điểm danh (ngày, trạng thái, tx_hash).

#### Lấy Lịch Sử Thanh Toán

```bash
npm run member:payments <wallet_address>
```

Trả lại lịch sử thanh toán của hội viên.

#### Cập Nhật Hồ Sơ Hội Viên

```typescript
await gymMemberService.updateMemberProfile("0x123...", {
  display_name: "John Doe",
  email: "john@example.com",
});

// CẢNH BÁO: Chỉ cập nhật dữ liệu ngoài chuỗi (tên, email)
// Dữ liệu on-chain (loại thành viên, ngày hết hạn) chỉ có thể được cập nhật qua hợp đồng
```

#### Kiểm Tra Ngày Hết Hạn Thành Viên

```typescript
const isExpired = await gymMemberService.isMembershipExpired("0x123...");
// Trả lại: boolean
```

#### Xóa Mềm Hội Viên

```typescript
await gymMemberService.softDeleteMember("0x123...");
// Đánh dấu hội viên là không hoạt động nhưng KHÔNG xóa dữ liệu
```

#### Cấm Hội Viên

```typescript
await gymMemberService.banMember("0x123...", "Chưa thanh toán phí");
// Thay đổi trạng thái thành 'banned'
```

## Dịch Vụ 3: Dịch Vụ Xác Minh Thanh Toán

### Mục Đích

Theo dõi và xác minh giao dịch thanh toán. Ghi lại thanh toán từ hợp đồng, xử lý hoàn lại tiền, và tạo báo cáo doanh thu.

### Các Phương Thức Chính

#### Ghi Lại Thanh Toán

```bash
# Chỉ lập trình (được sử dụng bởi event sync)
```

```typescript
import { paymentVerificationService } from "../services/gymBackendServices";

const paymentId = await paymentVerificationService.recordPaymentTransaction({
  user_id: "uuid-of-user",
  transaction_type: "membership_registration",
  amount_wei: "500000000000000000", // 0.5 ETH
  status: "confirmed",
  tx_hash: "0xabc...",
  blockchain_timestamp: Math.floor(Date.now() / 1000),
  metadata: { membership_type: "STANDARD" },
});
```

#### Lấy Thanh Toán Theo Hash

```bash
npm run payment:verify <tx_hash>
```

#### Lấy Tổng Doanh Thu

```bash
npm run payment:revenue
# Đầu ra:
# Total Revenue: 12500000000000000000 Wei (25 txs)
```

#### Lấy Phân Tích Doanh Thu

```bash
npm run payment:by-type
# Đầu ra: Bảng hiển thị doanh thu theo từng loại giao dịch
```

#### Ghi Lại Hoàn Lại Tiền

```typescript
const refundId = await paymentVerificationService.recordRefund({
  user_id: "uuid-of-user",
  refund_amount_wei: "500000000000000000",
  reason: "Hội viên yêu cầu hủy",
  status: "confirmed",
  refund_tx_hash: "0xdef...", // Tùy chọn, hash của giao dịch hoàn lại
});
```

#### Lấy Hoàn Lại Tiền Cho Người Dùng

```typescript
const refunds = await paymentVerificationService.getUserRefunds("uuid-of-user");
```

#### Xác Minh Giao Dịch Chưa Hoàn Tất

```bash
npm run payment:verify
# Kiểm tra tất cả giao dịch chưa hoàn tất và cập nhật trạng thái nếu đã xác nhận/thất bại trên chuỗi
```

### Quy Trình Trạng Thái Thanh Toán

```
pending → confirmed (khi tx được khai thác và thành công)
       → failed     (khi tx bị hoàn nguyên)
       → refunded   (khi hoàn lại được ghi lại)
```

## Ví Dụ API Backend

Có một ví dụ API Express.js trong `examples/backendAPI.ts` bao bọc những dịch vụ này bằng các endpoint REST.

### Chạy Máy Chủ API

```bash
npm install express cors body-parser
npm run build
npx ts-node examples/backendAPI.ts

# Đầu ra:
# 🚀 Gym Backend API running on http://localhost:3001
```

### Các Endpoint API Có Sẵn

**Hội Viên:**

- `GET /api/members` - Liệt kê hội viên
- `GET /api/members/:walletAddress` - Lấy hội viên
- `POST /api/members/:walletAddress/update` - Cập nhật hội viên
- `GET /api/members/:walletAddress/attendance` - Lấy điểm danh
- `GET /api/members/:walletAddress/payments` - Lấy thanh toán
- `GET /api/members/:walletAddress/is-expired` - Kiểm tra ngày hết hạn

**Thanh Toán:**

- `GET /api/payments/:txHash` - Lấy thanh toán
- `GET /api/payments/user/:userId` - Liệt kê thanh toán của người dùng
- `GET /api/payments/revenue` - Tổng doanh thu
- `GET /api/payments/revenue/by-type` - Phân tích doanh thu
- `POST /api/payments/record` - Ghi lại thanh toán
- `PUT /api/payments/:txHash/status` - Cập nhật trạng thái
- `POST /api/payments/refund` - Ghi lại hoàn lại tiền

### Ví Dụ Các Cuộc Gọi API

```bash
# Lấy hồ sơ hội viên
curl http://localhost:3001/api/members/0x123...

# Lấy lịch sử điểm danh
curl http://localhost:3001/api/members/0x123.../attendance

# Lấy tổng doanh thu
curl http://localhost:3001/api/payments/revenue

# Cập nhật hội viên
curl -X POST http://localhost:3001/api/members/0x123.../update \
  -H 'Content-Type: application/json' \
  -d '{"display_name":"John","email":"john@gym.com"}'
```

## Sơ Đồ Luồng Dữ Liệu

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (MetaMask + React)                            │
└────────────────────────────────────────────────────────┬┘
                                                          │
                                                          │
                    ┌─────────────────────────────────────┘
                    │ Ký & Gọi Hợp Đồng
                    ▼
        ┌─────────────────────────────┐
        │  Hợp Đồng GymMembership     │
        │  (Solidity)                 │
        ├─────────────────────────────┤
        │ registerMember()            │
        │ renewMembership()           │
        │ recordAttendance()          │
        │ withdrawRevenue()           │
        └─────────────┬───────────────┘
                      │
                      │ Phát Hành Sự Kiện
                      │
        ┌─────────────▼───────────────┐
        │  Event Listener             │
        │  (syncGymEvents.ts)         │
        └─────────────┬───────────────┘
                      │
                      │ Phân Tích & Đồng Bộ
                      │
        ┌─────────────▼────────────────────────────┐
        │  Supabase PostgreSQL                     │
        ├──────────────────────────────────────────┤
        │ app_users                                │
        │ gym_member_profiles                      │
        │ gym_attendance_records                   │
        │ gym_payment_transactions                 │
        │ gym_refunds (cho tương lai)              │
        └─────────────┬────────────────────────────┘
                      │
                      │ Truy Vấn
                      │
        ┌─────────────▼──────────────────┐
        │  Dịch Vụ Backend               │
        ├────────────────────────────────┤
        │ gymMemberService               │
        │ paymentVerificationService     │
        └─────────────┬──────────────────┘
                      │
                      │ REST API
                      │
        ┌─────────────▼──────────────────┐
        │  FE/BE Team (REST/GraphQL)     │
        │  Hiển Thị & Quản Lý            │
        └────────────────────────────────┘
```

## Danh Sách Kiểm Tra Tích Hợp

- [x] Event listener đồng bộ hợp đồng vào cơ sở dữ liệu
- [x] CRUD thành viên (đọc, cập nhật, xóa)
- [x] Theo dõi thanh toán và hoàn lại tiền
- [x] Báo cáo doanh thu
- [ ] Ví dụ Express API (cho FE/BE team)
- [ ] Tùy chọn GraphQL (nếu cần)
- [ ] Middleware xác thực (JWT/xác minh chữ ký)
- [ ] Giới hạn tốc độ
- [ ] Xử lý lỗi & ghi nhật ký

## Khắc Phục Sự Cố

### Event Listener Không Hoạt Động

1. Kiểm tra `.env` có `RPC_URL` chính xác
2. Đảm bảo địa chỉ hợp đồng chính xác trong `deployment.json`
3. Xác minh hợp đồng có ABI sự kiện chính xác trong `syncGymEvents.ts`

### Lỗi Cơ Sở Dữ Liệu

1. Xác minh thông tin xác thực Supabase trong `.env`
2. Đảm bảo schema SQL được áp dụng: `npm run db:init`
3. Kiểm tra các chính sách RLS không chặn khóa dịch vụ

### Thanh Toán Không Được Ghi Lại

1. Đảm bảo bảng `gym_payment_transactions` tồn tại
2. Kiểm tra giao dịch có thực sự được khai thác trên blockchain
3. Xác minh người dùng tồn tại trong bảng `app_users`

## Các Bước Tiếp Theo

1. **Tích Hợp với FE:** Sử dụng ví dụ API để xây dựng các thành phần React
2. **Thêm Xác Thực:** Triển khai xác minh chữ ký cho các endpoint bảo mật
3. **Thêm Bộ Nhớ Đệm:** Redis cho dữ liệu được truy cập thường xuyên
4. **Giám Sát:** Thiết lập nhật ký và cảnh báo cho các đồng bộ thất bại
5. **Kiểm Thử:** Kiểm thử tải API với nhiều người dùng đồng thời

## Tham Khảo

- [Tài Liệu Supabase](https://supabase.com/docs)
- [Tài Liệu ethers.js](https://docs.ethers.org)
- [Tài Liệu Express.js](https://expressjs.com)
- [Hợp Đồng GymMembership](../contracts/GymMembership.sol)
- [Schema Cơ Sở Dữ Liệu](../sql/supabase_schema.sql)
