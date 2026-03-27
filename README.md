# DappSmartCont

Du an smart contract su dung Hardhat + TypeScript.

## Gioi thieu nhung gi da lam cho du an quan ly gym

Du an da hoan thien cac phan chinh cho bai toan quan ly phong gym tren blockchain:

- Xay dung contract GymMembership de quan ly thanh vien, goi tap, diem danh, admin va doanh thu.
- Bo sung event day du de theo doi cac hanh dong quan trong (dang ky, gia han, diem danh, rut tien, quan ly admin).
- Them co che bao mat co ban trong contract nhu reentrancy guard va kiem soat quyen owner/admin.
- Viet bo test tong hop cho GymMembership, bao phu deployment, registration, renewal, validation, attendance, admin, financial va edge cases.
- Ho tro deploy local va deploy Sapphire testnet bang script deployGym.ts va bien moi truong .env.

## Cai dat

```bash
npm install
```

## Chay test

Chay toan bo test:

```bash
npx hardhat test
```

Chay file test GymMembership:

```bash
npx hardhat test test/GymMembership.test.ts
```

Chay test theo nhom (grep):

```bash
npx hardhat test test/GymMembership.test.ts --grep "Quan ly admin"
```

## Deploy

Deploy local:

```bash
npx hardhat run scripts/deployGym.ts
```

Deploy Sapphire testnet:

1. Tao file `.env` trong thu muc goc.
2. Them private key theo dung format:

```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

3. Chay deploy:

```bash
npx hardhat run scripts/deployGym.ts --network sapphire
```
