import "dotenv/config";
import { ethers } from "ethers";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ============= TYPES =============

export interface PaymentTransaction {
  id?: string;
  user_id: string;
  transaction_type: string; // membership_registration, membership_renewal, addon_purchase, payment_received, etc.
  amount_wei: string;
  currency?: string; // ETH, USDC, etc.
  status: "pending" | "confirmed" | "failed" | "refunded";
  tx_hash: string;
  blockchain_timestamp: number;
  block_number?: number;
  chain_id?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentRefund {
  id?: string;
  original_tx_id?: string;
  user_id: string;
  refund_amount_wei: string;
  reason: string;
  status: "pending" | "confirmed" | "failed";
  refund_tx_hash?: string;
  created_at?: string;
}

// ============= ENVIRONMENT =============

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = getEnvOrThrow("SUPABASE_URL");
  const serviceRoleKey = getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getEthersProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.RPC_URL || "http://localhost:8545";
  return new ethers.JsonRpcProvider(rpcUrl);
}

// ============= PAYMENT VERIFICATION SERVICE =============

export class PaymentVerificationService {
  private supabase: SupabaseClient;
  private provider: ethers.JsonRpcProvider;

  constructor(supabase?: SupabaseClient, provider?: ethers.JsonRpcProvider) {
    this.supabase = supabase || getSupabaseAdminClient();
    this.provider = provider || getEthersProvider();
  }

  /**
   * Record a payment transaction
   */
  async recordPaymentTransaction(payment: PaymentTransaction): Promise<string> {
    // Verify tx_hash exists on blockchain (optional, can be deferred for pending txs)
    if (payment.status === "confirmed") {
      try {
        const receipt = await this.provider.getTransactionReceipt(
          payment.tx_hash,
        );
        if (!receipt) {
          throw new Error(`Transaction not found: ${payment.tx_hash}`);
        }
        if (receipt.status === 0) {
          throw new Error(`Transaction failed: ${payment.tx_hash}`);
        }
        payment.block_number = receipt.blockNumber;
      } catch (error) {
        console.error(`Failed to verify tx ${payment.tx_hash}:`, error);
        // Mark as failed if verification fails
        payment.status = "failed";
      }
    }

    const { data, error } = await this.supabase
      .from("gym_payment_transactions")
      .insert({
        user_id: payment.user_id,
        transaction_type: payment.transaction_type,
        amount_wei: payment.amount_wei,
        currency: payment.currency || "ETH",
        status: payment.status,
        tx_hash: payment.tx_hash,
        blockchain_timestamp: payment.blockchain_timestamp,
        block_number: payment.block_number,
        chain_id: payment.chain_id,
        metadata: payment.metadata || {},
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    console.log(
      `✓ Payment recorded: ${payment.transaction_type} - ${data.id} (${payment.tx_hash})`,
    );
    return data.id;
  }

  /**
   * Get payment transaction by tx_hash
   */
  async getPaymentByTxHash(txHash: string): Promise<PaymentTransaction | null> {
    const { data, error } = await this.supabase
      .from("gym_payment_transactions")
      .select(
        "id, user_id, transaction_type, amount_wei, currency, status, tx_hash, blockchain_timestamp, block_number, chain_id, metadata, created_at, updated_at",
      )
      .eq("tx_hash", txHash)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data as PaymentTransaction;
  }

  /**
   * Get all payments for a user
   */
  async getUserPayments(
    userId: string,
    limit: number = 30,
  ): Promise<PaymentTransaction[]> {
    const { data, error } = await this.supabase
      .from("gym_payment_transactions")
      .select(
        "id, user_id, transaction_type, amount_wei, currency, status, tx_hash, blockchain_timestamp, block_number, chain_id, metadata, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as PaymentTransaction[];
  }

  /**
   * Get user payments by status
   */
  async getUserPaymentsByStatus(
    userId: string,
    status: "pending" | "confirmed" | "failed" | "refunded",
    limit: number = 30,
  ): Promise<PaymentTransaction[]> {
    const { data, error } = await this.supabase
      .from("gym_payment_transactions")
      .select(
        "id, user_id, transaction_type, amount_wei, currency, status, tx_hash, blockchain_timestamp, block_number, chain_id, metadata, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as PaymentTransaction[];
  }

  /**
   * Update payment status (e.g., pending → confirmed)
   */
  async updatePaymentStatus(
    txHash: string,
    newStatus: "pending" | "confirmed" | "failed" | "refunded",
  ): Promise<void> {
    const { error } = await this.supabase
      .from("gym_payment_transactions")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("tx_hash", txHash);

    if (error) throw error;
    console.log(`✓ Payment status updated: ${txHash} → ${newStatus}`);
  }

  /**
   * Record a refund
   */
  async recordRefund(refund: PaymentRefund): Promise<string> {
    const { data, error } = await this.supabase
      .from("gym_refunds")
      .insert({
        user_id: refund.user_id,
        refund_amount_wei: refund.refund_amount_wei,
        reason: refund.reason,
        status: refund.status,
        refund_tx_hash: refund.refund_tx_hash,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Mark original payment as refunded if provided
    if (refund.original_tx_id) {
      await this.updatePaymentStatus(refund.original_tx_id, "refunded");
    }

    console.log(
      `✓ Refund recorded: ${refund.user_id} - ${refund.refund_amount_wei} Wei (${data.id})`,
    );
    return data.id;
  }

  /**
   * Get refunds for a user
   */
  async getUserRefunds(userId: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("gym_refunds")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Calculate total revenue (confirmed payments)
   */
  async getTotalRevenue(): Promise<{
    total_wei: string;
    confirmed_count: number;
  }> {
    const { data, error } = await this.supabase.rpc("calculate_total_revenue"); // Requires SQL function

    if (error) {
      console.warn("RPC calculate_total_revenue not found, fallback to query");
      const result = await this.supabase
        .from("gym_payment_transactions")
        .select("amount_wei")
        .eq("status", "confirmed");

      if (result.error) throw result.error;

      let total = BigInt(0);
      (result.data || []).forEach((row: any) => {
        total += BigInt(row.amount_wei || "0");
      });

      return {
        total_wei: total.toString(),
        confirmed_count: result.data?.length || 0,
      };
    }

    return data as { total_wei: string; confirmed_count: number };
  }

  /**
   * Calculate revenue by transaction type
   */
  async getRevenueByType(): Promise<
    Array<{ transaction_type: string; total_wei: string; count: number }>
  > {
    const { data, error } = await this.supabase
      .from("gym_payment_transactions")
      .select("transaction_type, amount_wei")
      .eq("status", "confirmed");

    if (error) throw error;

    const grouped: Record<string, { total: bigint; count: number }> = {};
    (data || []).forEach((row: any) => {
      const type = row.transaction_type;
      if (!grouped[type]) {
        grouped[type] = { total: BigInt(0), count: 0 };
      }
      grouped[type].total += BigInt(row.amount_wei || "0");
      grouped[type].count++;
    });

    return Object.entries(grouped).map(([type, info]) => ({
      transaction_type: type,
      total_wei: info.total.toString(),
      count: info.count,
    }));
  }

  /**
   * Verify pending transactions on-chain and update status
   */
  async verififyPendingTransactions(): Promise<void> {
    const pending = await this.supabase
      .from("gym_payment_transactions")
      .select("tx_hash")
      .eq("status", "pending");

    if (pending.error) throw pending.error;

    for (const row of pending.data || []) {
      try {
        const receipt = await this.provider.getTransactionReceipt(row.tx_hash);
        if (receipt) {
          const status = receipt.status === 1 ? "confirmed" : "failed";
          await this.updatePaymentStatus(row.tx_hash, status);
        }
      } catch (error) {
        console.error(`Error verifying ${row.tx_hash}:`, error);
      }
    }

    console.log("✓ Pending transactions verified");
  }
}

// ============= EXPORT SINGLETON =============

export const paymentVerificationService = new PaymentVerificationService();

// ============= CLI =============

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    const service = new PaymentVerificationService();

    if (command === "get" && args[1]) {
      const payment = await service.getPaymentByTxHash(args[1]);
      console.log(payment);
    } else if (command === "user-payments" && args[1]) {
      const payments = await service.getUserPayments(args[1]);
      console.log(payments);
    } else if (command === "revenue") {
      const revenue = await service.getTotalRevenue();
      console.log(
        `Total Revenue: ${revenue.total_wei} Wei (${revenue.confirmed_count} txs)`,
      );
    } else if (command === "revenue-by-type") {
      const breakdown = await service.getRevenueByType();
      console.table(breakdown);
    } else if (command === "verify-pending") {
      await service.verififyPendingTransactions();
    } else {
      console.log(`
Usage:
  npx ts-node scripts/paymentVerificationService.ts get <tx_hash>
  npx ts-node scripts/paymentVerificationService.ts user-payments <user_id>
  npx ts-node scripts/paymentVerificationService.ts revenue
  npx ts-node scripts/paymentVerificationService.ts revenue-by-type
  npx ts-node scripts/paymentVerificationService.ts verify-pending
      `);
    }
  })().catch(console.error);
}
