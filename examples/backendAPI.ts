/**
 * Example Express Backend API for Gym dApp
 *
 * This file demonstrates how to integrate the gym backend services
 * with a simple Express server for FE/BE team consumption.
 *
 * To run:
 *   npm install express cors body-parser
 *   npm run build && ts-node examples/backendAPI.ts
 *
 * Or directly:
 *   npx ts-node examples/backendAPI.ts
 */

import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { gymMemberService } from "../services/gymBackendServices";
import { paymentVerificationService } from "../services/gymBackendServices";
import { startEventListener } from "../services/gymBackendServices";

const app = express();
const PORT = process.env.API_PORT || 3001;

// ============= MIDDLEWARE =============

app.use(cors());
app.use(express.json());

// ============= MEMBER ENDPOINTS =============

/**
 * GET /api/members/:walletAddress
 * Get full member profile
 */
app.get("/api/members/:walletAddress", async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const profile = await gymMemberService.getMemberProfile(walletAddress);

    if (!profile) {
      return res.status(404).json({ error: "Member not found" });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/members
 * List all members (paginated)
 */
app.get("/api/members", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, total } = await gymMemberService.getAllMembers(limit, offset);
    res.json({ data, total, limit, offset });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/members/:walletAddress/update
 * Update member profile (display_name, email only)
 */
app.post(
  "/api/members/:walletAddress/update",
  async (req: Request, res: Response) => {
    try {
      const { walletAddress } = req.params;
      const { display_name, email } = req.body;

      const updated = await gymMemberService.updateMemberProfile(
        walletAddress,
        { display_name, email },
      );

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  },
);

/**
 * GET /api/members/:walletAddress/attendance
 * Get member attendance history
 */
app.get(
  "/api/members/:walletAddress/attendance",
  async (req: Request, res: Response) => {
    try {
      const { walletAddress } = req.params;
      const limit = parseInt(req.query.limit as string) || 30;

      const records = await gymMemberService.getMemberAttendance(
        walletAddress,
        limit,
      );
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  },
);

/**
 * GET /api/members/:walletAddress/payments
 * Get member payment history
 */
app.get(
  "/api/members/:walletAddress/payments",
  async (req: Request, res: Response) => {
    try {
      const { walletAddress } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      const payments = await gymMemberService.getMemberPayments(
        walletAddress,
        limit,
      );
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  },
);

/**
 * GET /api/members/:walletAddress/is-expired
 * Check if membership is expired
 */
app.get(
  "/api/members/:walletAddress/is-expired",
  async (req: Request, res: Response) => {
    try {
      const { walletAddress } = req.params;
      const isExpired = await gymMemberService.isMembershipExpired(
        walletAddress,
      );
      res.json({ wallet_address: walletAddress, is_expired: isExpired });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  },
);

// ============= PAYMENT ENDPOINTS =============

/**
 * GET /api/payments/:txHash
 * Get payment details by transaction hash
 */
app.get("/api/payments/:txHash", async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    const payment = await paymentVerificationService.getPaymentByTxHash(txHash);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/payments/user/:userId
 * Get all payments for a user
 */
app.get("/api/payments/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 30;

    const payments = await paymentVerificationService.getUserPayments(
      userId,
      limit,
    );
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/payments/user/:userId/status/:status
 * Get payments by status (pending, confirmed, failed, refunded)
 */
app.get(
  "/api/payments/user/:userId/status/:status",
  async (req: Request, res: Response) => {
    try {
      const { userId, status } = req.params;
      const limit = parseInt(req.query.limit as string) || 30;

      const payments = await paymentVerificationService.getUserPaymentsByStatus(
        userId,
        status as any,
        limit,
      );
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  },
);

/**
 * POST /api/payments/record
 * Record a new payment transaction
 */
app.post("/api/payments/record", async (req: Request, res: Response) => {
  try {
    const payment = req.body;

    const id = await paymentVerificationService.recordPaymentTransaction(
      payment,
    );

    res.json({ id, message: "Payment recorded" });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * PUT /api/payments/:txHash/status
 * Update payment status
 */
app.put("/api/payments/:txHash/status", async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    const { status } = req.body;

    await paymentVerificationService.updatePaymentStatus(txHash, status);

    res.json({ tx_hash: txHash, new_status: status });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/payments/revenue
 * Get total revenue
 */
app.get("/api/payments/revenue", async (req: Request, res: Response) => {
  try {
    const revenue = await paymentVerificationService.getTotalRevenue();
    res.json(revenue);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/payments/revenue/by-type
 * Get revenue breakdown by transaction type
 */
app.get(
  "/api/payments/revenue/by-type",
  async (req: Request, res: Response) => {
    try {
      const breakdown = await paymentVerificationService.getRevenueByType();
      res.json(breakdown);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  },
);

/**
 * POST /api/payments/refund
 * Record a refund
 */
app.post("/api/payments/refund", async (req: Request, res: Response) => {
  try {
    const refund = req.body;

    const id = await paymentVerificationService.recordRefund(refund);

    res.json({ id, message: "Refund recorded" });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============= HEALTH CHECK =============

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============= START SERVER =============

app.listen(PORT, () => {
  console.log(`🚀 Gym Backend API running on http://localhost:${PORT}`);
  console.log(`
📚 API Endpoints:
  Members:
    GET  /api/members                              - List all members
    GET  /api/members/:walletAddress               - Get member profile
    POST /api/members/:walletAddress/update        - Update member profile
    GET  /api/members/:walletAddress/attendance    - Get attendance history
    GET  /api/members/:walletAddress/payments      - Get payment history
    GET  /api/members/:walletAddress/is-expired    - Check membership expiration

  Payments:
    GET  /api/payments/:txHash                     - Get payment by hash
    GET  /api/payments/user/:userId                - Get user payments
    GET  /api/payments/user/:userId/status/:status - Get payments by status
    POST /api/payments/record                      - Record new payment
    PUT  /api/payments/:txHash/status              - Update payment status
    GET  /api/payments/revenue                     - Get total revenue
    GET  /api/payments/revenue/by-type             - Get revenue breakdown
    POST /api/payments/refund                      - Record refund
  `);

  // Optionally start event listener in background
  if (process.env.SYNC_EVENTS === "true") {
    console.log("🔍 Starting event listener...");
    startEventListener().catch(console.error);
  }
});

export default app;
