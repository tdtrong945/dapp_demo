# Gym Backend Services Guide

This guide covers the backend services for the Gym Web3 dApp. These services handle gym member management, event synchronization, and payment verification.

## Overview

The backend consists of 3 main services:

1. **Event Sync Service** (`syncGymEvents.ts`) - Listens to contract events and syncs to database
2. **Member Service** (`gymMemberService.ts`) - CRUD operations for gym members
3. **Payment Service** (`paymentVerificationService.ts`) - Payment tracking and verification

## Setup

### Environment Variables

Create a `.env` file in the project root:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Blockchain
RPC_URL=http://localhost:8545              # Or Sapphire testnet RPC
PRIVATE_KEY=your_private_key_here          # For transactions (if needed)
CONTRACT_ADDRESS=0x...                     # GymMembership contract address

# API Server (optional)
API_PORT=3001
SYNC_EVENTS=true                           # Auto-start event listener
```

### Installation

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run database migrations (if needed)
npm run db:init
```

## Service 1: Event Sync Service

### Purpose

Listens to `GymMembership` contract events and automatically syncs them to Supabase. This keeps the database synchronized with on-chain state.

### Supported Events

| Event                | Action                   | Database Update                                   |
| -------------------- | ------------------------ | ------------------------------------------------- |
| `MemberRegistered`   | New member signs up      | Insert into `gym_member_profiles`, record payment |
| `MembershipRenewed`  | Member renews membership | Update `gym_member_profiles`, update expiry date  |
| `AttendanceRecorded` | Admin records attendance | Insert into `gym_attendance_records`              |
| `AdminAdded`         | New admin assigned       | Assign `admin` role to user                       |
| `PaymentReceived`    | Payment processed        | Record in `gym_payment_transactions`              |
| `RevenueWithdrawn`   | Owner withdraws funds    | Log withdrawal event                              |

### Starting the Event Listener

```bash
# Terminal 1: Start the listener (continuously monitors events)
npm run sync:gym-events

# Output:
# 🔍 Listening to GymMembership events at 0x...
# ✅ Event listeners registered. Waiting for events...
```

The listener will stay active and sync events in real-time as they occur on the blockchain.

### Event Sync Example

When a user calls `registerMember(name, type)` on the contract:

```
Contract Event → syncGymEvents → Database
MemberRegistered(address, name, type, date) →
  1. Create/update app_users record
  2. Insert gym_member_profiles (membership_type, expiry_date)
  3. Record gym_payment_transactions
```

## Service 2: Member Service

### Purpose

Provides CRUD operations for managing gym members off-chain (name, email, soft-delete). On-chain data (membership type, expiry) is controlled by the smart contract.

### Key Methods

#### Get Member Profile

```bash
npm run member:get <wallet_address>
```

Returns full member profile including membership status and statistics.

```typescript
// Programmatic usage
import { gymMemberService } from "../services/gymBackendServices";

const profile = await gymMemberService.getMemberProfile("0x123...");
// Returns: {
//   wallet_address, display_name, email, membership_type,
//   registration_date, expiry_date, total_attendance, is_active,
//   status, updated_at
// }
```

#### List All Members

```bash
npm run member:list
```

#### Get Member Attendance

```bash
npm run member:attendance <wallet_address>
```

Returns attendance records (date, status, tx_hash).

#### Get Member Payments

```bash
npm run member:payments <wallet_address>
```

Returns payment history for the member.

#### Update Member Profile

```typescript
await gymMemberService.updateMemberProfile("0x123...", {
  display_name: "John Doe",
  email: "john@example.com",
});

// WARNING: This only updates off-chain data (name, email)
// On-chain data (membership type, expiry) can only be updated via contract
```

#### Check Membership Expiration

```typescript
const isExpired = await gymMemberService.isMembershipExpired("0x123...");
// Returns: boolean
```

#### Soft-Delete Member

```typescript
await gymMemberService.softDeleteMember("0x123...");
// Marks member as inactive but does NOT delete data
```

#### Ban Member

```typescript
await gymMemberService.banMember("0x123...", "Unpaid fees");
// Changes status to 'banned'
```

## Service 3: Payment Verification Service

### Purpose

Tracks and verifies payment transactions. Records payments from contract, handles refunds, and generates revenue reports.

### Key Methods

#### Record Payment

```bash
# Programmatic only (used by event sync)
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

#### Get Payment by Hash

```bash
npm run payment:verify <tx_hash>
```

#### Get Total Revenue

```bash
npm run payment:revenue
# Output:
# Total Revenue: 12500000000000000000 Wei (25 txs)
```

#### Get Revenue Breakdown

```bash
npm run payment:by-type
# Output: Table showing revenue per transaction type
```

#### Record Refund

```typescript
const refundId = await paymentVerificationService.recordRefund({
  user_id: "uuid-of-user",
  refund_amount_wei: "500000000000000000",
  reason: "Member requested cancellation",
  status: "confirmed",
  refund_tx_hash: "0xdef...", // Optional, hash of refund transaction
});
```

#### Get Refunds for User

```typescript
const refunds = await paymentVerificationService.getUserRefunds("uuid-of-user");
```

#### Verify Pending Transactions

```bash
npm run payment:verify
# Checks all pending transactions and updates status if confirmed/failed on-chain
```

### Payment Status Flow

```
pending → confirmed (when tx is mined and successful)
       → failed     (when tx is reverted)
       → refunded   (when refund is recorded)
```

## Backend API Example

There's an example Express.js API in `examples/backendAPI.ts` that wraps these services with REST endpoints.

### Running the API Server

```bash
npm install express cors body-parser
npm run build
npx ts-node examples/backendAPI.ts

# Output:
# 🚀 Gym Backend API running on http://localhost:3001
```

### Available API Endpoints

**Members:**

- `GET /api/members` - List members
- `GET /api/members/:walletAddress` - Get member
- `POST /api/members/:walletAddress/update` - Update member
- `GET /api/members/:walletAddress/attendance` - Get attendance
- `GET /api/members/:walletAddress/payments` - Get payments
- `GET /api/members/:walletAddress/is-expired` - Check expiration

**Payments:**

- `GET /api/payments/:txHash` - Get payment
- `GET /api/payments/user/:userId` - List user payments
- `GET /api/payments/revenue` - Total revenue
- `GET /api/payments/revenue/by-type` - Revenue breakdown
- `POST /api/payments/record` - Record payment
- `PUT /api/payments/:txHash/status` - Update status
- `POST /api/payments/refund` - Record refund

### Example API Calls

```bash
# Get member profile
curl http://localhost:3001/api/members/0x123...

# Get member attendance
curl http://localhost:3001/api/members/0x123.../attendance

# Get total revenue
curl http://localhost:3001/api/payments/revenue

# Update member
curl -X POST http://localhost:3001/api/members/0x123.../update \
  -H 'Content-Type: application/json' \
  -d '{"display_name":"John","email":"john@gym.com"}'
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (MetaMask + React)                            │
└────────────────────────────────────────────────────────┬┘
                                                          │
                                                          │
                    ┌─────────────────────────────────────┘
                    │ Sign & Call Contract
                    ▼
        ┌─────────────────────────────┐
        │  GymMembership Contract     │
        │  (Solidity)                 │
        ├─────────────────────────────┤
        │ registerMember()            │
        │ renewMembership()           │
        │ recordAttendance()          │
        │ withdrawRevenue()           │
        └─────────────┬───────────────┘
                      │
                      │ Emit Events
                      │
        ┌─────────────▼───────────────┐
        │  Event Listener             │
        │  (syncGymEvents.ts)         │
        └─────────────┬───────────────┘
                      │
                      │ Parse & Sync
                      │
        ┌─────────────▼────────────────────────────┐
        │  Supabase PostgreSQL                     │
        ├──────────────────────────────────────────┤
        │ app_users                                │
        │ gym_member_profiles                      │
        │ gym_attendance_records                   │
        │ gym_payment_transactions                 │
        │ gym_refunds (for future)                 │
        └─────────────┬────────────────────────────┘
                      │
                      │ Query
                      │
        ┌─────────────▼──────────────────┐
        │  Backend Services              │
        ├────────────────────────────────┤
        │ gymMemberService               │
        │ paymentVerificationService     │
        └─────────────┬──────────────────┘
                      │
                      │ REST API
                      │
        ┌─────────────▼──────────────────┐
        │  FE/BE Team (REST/GraphQL)     │
        │  Display & Manage              │
        └────────────────────────────────┘
```

## Integration Checklist

- [x] Event listener syncs contract to database
- [x] Member CRUD (read, update, delete)
- [x] Payment tracking and refunds
- [x] Revenue reports
- [ ] Express API example (for FE/BE team)
- [ ] GraphQL option (if needed)
- [ ] Authentication middleware (JWT/signature verification)
- [ ] Rate limiting
- [ ] Error handling & logging

## Troubleshooting

### Event Listener Not Working

1. Check `.env` has correct `RPC_URL`
2. Ensure contract address is correct in `deployment.json`
3. Verify contract has correct event ABI in `syncGymEvents.ts`

### Database Errors

1. Verify Supabase credentials in `.env`
2. Ensure SQL schema is applied: `npm run db:init`
3. Check RLS policies don't block service role key

### Payment Not Recording

1. Ensure `gym_payment_transactions` table exists
2. Check transaction was actually mined on blockchain
3. Verify user exists in `app_users` table

## Next Steps

1. **Integrate with FE:** Use the example API to build React components
2. **Add Auth:** Implement signature verification for secure endpoints
3. **Add Caching:** Redis for frequently accessed data
4. **Monitoring:** Set up logs and alerts for failed syncs
5. **Testing:** Load test the API with multiple concurrent users

## References

- [Supabase Documentation](https://supabase.com/docs)
- [ethers.js Documentation](https://docs.ethers.org)
- [Express.js Documentation](https://expressjs.com)
- [GymMembership Contract](../contracts/GymMembership.sol)
- [Database Schema](../sql/supabase_schema.sql)
