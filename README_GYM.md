# 🏋️ GYM MEMBERSHIP SMART CONTRACT

Smart contract quản lý phòng tập gym trên blockchain Ethereum

---

## 📌 Tổng Quan

### 3 Chức Năng Chính

1. **Quản lý Membership** - Đăng ký, gia hạn, vô hiệu hóa
2. **Thanh toán** - Sử dụng Ether (ETH), rút tiền
3. **Tracking Attendance** - Ghi nhận điểm danh, xem lịch sử

### Membership Types

- **STANDARD**: 0.5 ETH / 30 ngày
- **VIP**: 1.0 ETH / 30 ngày

### Quyền hạn

- **Owner**: Người sở hữu (rút tiền, cập nhật giá, quản lý admin)
- **3 Admins**: Ghi nhận điểm danh, gia hạn membership
- **Members**: Thành viên gym

---

## 🚀 Cài Đặt & Deploy

### 1. Cài đặt Dependencies

```bash
npm install
```

### 2. Biên dịch Contract

```bash
npx hardhat compile
```

### 3. Deploy Contract

```bash
npx hardhat run scripts/deployGym.ts
```

**Output:**

```
🚀 Deploying GymMembership Contract...

📍 Owner: 0x...
👨 Admin 1: 0x...
👨 Admin 2: 0x...
👨 Admin 3: 0x...

✅ Contract deployed: 0x...

📋 Membership Plans:
  STANDARD: 0.5 ETH / 30 days
  VIP:      1.0 ETH / 30 days

💾 Deployment info saved to deployment.json
```

---

## 💻 Hướng Dẫn Sử Dụng

### Hardhat Console

```bash
npx hardhat console
```

### Load Contract

```javascript
const gym = await ethers.getContractAt("GymMembership", "0x..."); // Thay địa chỉ
```

---

## 📚 Các Hàm Chính

### **MEMBERSHIP FUNCTIONS**

#### `registerMember(string name, uint8 type)`

Đăng ký membership mới

```javascript
// Đăng ký STANDARD (0.5 ETH)
await gym.registerMember("Nguyễn Văn A", 0, {
  value: ethers.parseEther("0.5"),
});

// Đăng ký VIP (1 ETH)
await gym.registerMember("Trần Thị B", 1, { value: ethers.parseEther("1") });
```

#### `renewMembership(address member, uint8 type)`

Gia hạn membership (chỉ Admin)

```javascript
await gym.renewMembership("0xMemberAddress", 1, {
  value: ethers.parseEther("1"),
});
```

#### `isMembershipValid(address member)`

Kiểm tra membership còn hiệu lực

```javascript
const isValid = await gym.isMembershipValid("0xMemberAddress");
console.log("Valid:", isValid);
```

#### `getMemberInfo(address member)`

Lấy thông tin thành viên

```javascript
const info = await gym.getMemberInfo("0xMemberAddress");
console.log(info);
// {
//   memberAddress: '0x...',
//   name: 'Nguyễn Văn A',
//   membershipType: 0,
//   registrationDate: 1710000000,
//   expiryDate: 1712592000,
//   totalAttendance: 15,
//   isActive: true
// }
```

#### `deactivateMember(address member)`

Vô hiệu hóa thành viên (chỉ Admin)

```javascript
await gym.deactivateMember("0xMemberAddress");
```

---

### **ATTENDANCE FUNCTIONS**

#### `recordAttendance(address member, uint8 status)`

Ghi nhận điểm danh (chỉ Admin)

```javascript
// Status: 0 = ABSENT, 1 = PRESENT

// Ghi có mặt
await gym.recordAttendance("0xMemberAddress", 1);

// Ghi vắng mặt
await gym.recordAttendance("0xMemberAddress", 0);
```

#### `getAttendanceHistory(address member)`

Lấy lịch sử điểm danh

```javascript
const history = await gym.getAttendanceHistory("0xMemberAddress");
console.log(history);
// [
//   { date: 1710000000, status: 1 },
//   { date: 1710086400, status: 1 },
//   { date: 1710172800, status: 0 }
// ]
```

#### `getAttendanceCount(address member, uint256 startDate, uint256 endDate)`

Đếm số lần tập trong khoảng thời gian

```javascript
const now = Math.floor(Date.now() / 1000);
const startOfMonth = now - 30 * 24 * 60 * 60;

const count = await gym.getAttendanceCount(
  "0xMemberAddress",
  startOfMonth,
  now,
);
console.log("Attendance count:", count);
```

#### `getTotalAttendance(address member)`

Lấy tổng số lần tập

```javascript
const total = await gym.getTotalAttendance("0xMemberAddress");
console.log("Total attendance:", total);
```

---

### **MEMBERSHIP PLAN FUNCTIONS**

#### `updateMembershipPlan(uint8 type, uint256 price, uint256 durationDays)`

Cập nhật gói membership (chỉ Owner)

```javascript
// Cập nhật STANDARD: 0.6 ETH / 30 ngày
await gym.updateMembershipPlan(0, ethers.parseEther("0.6"), 30);

// Cập nhật VIP: 1.2 ETH / 30 ngày
await gym.updateMembershipPlan(1, ethers.parseEther("1.2"), 30);
```

#### `getMembershipPlan(uint8 type)`

Lấy thông tin gói membership

```javascript
const plan = await gym.getMembershipPlan(0); // 0=STANDARD, 1=VIP
console.log("Price:", ethers.formatEther(plan.price), "ETH");
console.log("Duration:", plan.durationDays, "days");
```

---

### **ADMIN FUNCTIONS**

#### `isAdmin(address addr)`

Kiểm tra admin

```javascript
const isAdmin = await gym.isAdmin("0xAdminAddress");
```

#### `getAdmins()`

Lấy danh sách admin

```javascript
const admins = await gym.getAdmins();
console.log("Admins:", admins);
```

#### `addAdmin(address newAdmin)`

Thêm admin (chỉ Owner)

```javascript
await gym.addAdmin("0xNewAdminAddress");
```

#### `removeAdmin(address admin)`

Xóa admin (chỉ Owner)

```javascript
await gym.removeAdmin("0xAdminAddress");
```

---

### **FINANCIAL FUNCTIONS**

#### `withdraw(uint256 amount)`

Rút tiền (chỉ Owner)

```javascript
// Rút 1 ETH
await gym.withdraw(ethers.parseEther("1"));
```

#### `withdrawAll()`

Rút tất cả tiền (chỉ Owner)

```javascript
await gym.withdrawAll();
```

#### `getBalance()`

Lấy số dư contract

```javascript
const balance = await gym.getBalance();
console.log("Balance:", ethers.formatEther(balance), "ETH");
```

---

## 📋 Ví Dụ Sử Dụng

### Ví dụ 1: Đăng ký Thành Viên

```javascript
const [owner, admin1, member1] = await ethers.getSigners();
const gym = await ethers.getContractAt("GymMembership", "0x...");

// Member đăng ký STANDARD membership
await gym
  .connect(member1)
  .registerMember("Nguyễn Văn A", 0, { value: ethers.parseEther("0.5") });

// Xem thông tin
const info = await gym.getMemberInfo(member1.address);
console.log("Name:", info.name);
console.log("Type:", info.membershipType === 0 ? "STANDARD" : "VIP");
console.log("Expiry:", new Date(Number(info.expiryDate) * 1000));
```

### Ví dụ 2: Admin Ghi Nhận Điểm Danh

```javascript
const [owner, admin1, admin2, member1] = await ethers.getSigners();
const gym = await ethers.getContractAt("GymMembership", "0x...");

// Member đăng ký
await gym
  .connect(member1)
  .registerMember("Member1", 0, { value: ethers.parseEther("0.5") });

// Admin ghi coù mặt
await gym.connect(admin1).recordAttendance(member1.address, 1);

// Admin ghi vắng mặt
await gym.connect(admin1).recordAttendance(member1.address, 0);

// Xem lịch sử
const history = await gym.getAttendanceHistory(member1.address);
console.log("History:", history);

// Xem tổng
const total = await gym.getTotalAttendance(member1.address);
console.log("Total attendance:", total);
```

### Ví dụ 3: Gia Hạn Membership

```javascript
const [owner, admin1, member1] = await ethers.getSigners();
const gym = await ethers.getContractAt("GymMembership", "0x...");

// Member đăng ký STANDARD
await gym
  .connect(member1)
  .registerMember("Member1", 0, { value: ethers.parseEther("0.5") });

// Admin gia hạn sang VIP
await gym
  .connect(admin1)
  .renewMembership(member1.address, 1, { value: ethers.parseEther("1") });

// Kiểm tra
const info = await gym.getMemberInfo(member1.address);
console.log("Type:", info.membershipType === 1 ? "VIP" : "STANDARD");
console.log("Valid:", await gym.isMembershipValid(member1.address));
```

### Ví dụ 4: Thống Kê Attendance

```javascript
const gym = await ethers.getContractAt("GymMembership", "0x...");

// Đếm 7 ngày gần nhất
const now = Math.floor(Date.now() / 1000);
const sevenDaysAgo = now - 7 * 24 * 60 * 60;

const count = await gym.getAttendanceCount(
  "0xMemberAddress",
  sevenDaysAgo,
  now,
);
console.log("Attendance (last 7 days):", count);
```

### Ví dụ 5: Rút Tiền

```javascript
const [owner] = await ethers.getSigners();
const gym = await ethers.getContractAt("GymMembership", "0x...");

// Xem số dư
const balance = await gym.getBalance();
console.log("Balance:", ethers.formatEther(balance), "ETH");

// Rút 1 ETH
await gym.withdraw(ethers.parseEther("1"));

// Rút tất cả
await gym.withdrawAll();
```

---

## 🔐 Events

| Event                   | Mô tả                   |
| ----------------------- | ----------------------- |
| `MemberRegistered`      | Thành viên đăng ký      |
| `PaymentReceived`       | Nhận thanh toán         |
| `AttendanceRecorded`    | Ghi nhận điểm danh      |
| `MembershipRenewed`     | Gia hạn membership      |
| `AdminAdded`            | Thêm admin              |
| `AdminRemoved`          | Xóa admin               |
| `MembershipPlanUpdated` | Cập nhật gói membership |
| `MemberDeactivated`     | Vô hiệu hóa thành viên  |

---

## 📊 Dữ Liệu Lưu Trữ

### Membership

- Một thành viên có một membership duy nhất
- Membership có ngày hết hạn
- Có thể là STANDARD (0) hoặc VIP (1)

### Attendance

- Mỗi lần ghi nhận tạo một bản ghi mới
- Lưu timestamp và trạng thái (PRESENT/ABSENT)
- Tính lũy tích totalAttendance (chỉ PRESENT)

### Admin

- Được khởi tạo với 3 admin
- Owner có thể thêm/xóa admin
- Tối thiểu 1 admin

---

## ⚠️ Lưu Ý

1. **Membership phải còn hiệu lực** để ghi nhận attendance
2. **Chỉ Admin** mới có thể ghi nhận điểm danh
3. **Giá membership** theo wei (1 ETH = 10^18 wei)
4. **timestamp** = số giây kể từ 1/1/1970
5. **Rút tiền** chỉ Owner có quyền

---

## 🧪 Testing

```bash
npx hardhat test
```

---

## 📁 Cấu Trúc Folder

```
contracts/
  └── GymMembership.sol

scripts/
  └── deployGym.ts

test/
  └── (test files)

deployment.json (tạo sau deploy)
README_GYM.md (hướng dẫn này)
```

---

**Phiên bản**: 1.0  
**Solidity**: 0.8.0+  
**Network**: Ethereum (Hardhat, Sepolia, Mainnet, v.v.)
