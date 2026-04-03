import "dotenv/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============= TYPES =============

export interface MemberProfile {
  user_id: string;
  wallet_address: string;
  display_name: string;
  email: string | null;
  membership_type: "STANDARD" | "VIP";
  registration_date: number;
  expiry_date: number;
  total_attendance: number;
  is_active: boolean;
  status: "active" | "inactive" | "banned";
  updated_at: string;
}

export interface MemberUpdateData {
  display_name?: string;
  email?: string;
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

// ============= MEMBER CRUD SERVICE =============

export class GymMemberService {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabaseAdminClient();
  }

  /**
   * Get full member profile (user + membership data)
   */
  async getMemberProfile(walletAddress: string): Promise<MemberProfile | null> {
    const { data, error } = await this.supabase
      .from("app_users")
      .select(
        `
        id,
        wallet_address,
        display_name,
        email,
        status,
        updated_at,
        gym_member_profiles (
          membership_type,
          registration_date,
          expiry_date,
          total_attendance,
          is_active
        )
      `,
      )
      .eq("wallet_address", walletAddress)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw error;
    }

    if (!data || !data.gym_member_profiles) {
      return null;
    }

    const profile = data.gym_member_profiles[0] || {};
    return {
      user_id: data.id,
      wallet_address: data.wallet_address,
      display_name: data.display_name || "N/A",
      email: data.email,
      membership_type: profile.membership_type || "STANDARD",
      registration_date: profile.registration_date || 0,
      expiry_date: profile.expiry_date || 0,
      total_attendance: profile.total_attendance || 0,
      is_active: profile.is_active ?? true,
      status: data.status,
      updated_at: data.updated_at,
    };
  }

  /**
   * Get all members (paginated)
   */
  async getAllMembers(
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ data: MemberProfile[]; total: number }> {
    const { data, error, count } = await this.supabase
      .from("app_users")
      .select(
        `
        id,
        wallet_address,
        display_name,
        email,
        status,
        updated_at,
        gym_member_profiles (
          membership_type,
          registration_date,
          expiry_date,
          total_attendance,
          is_active
        )
      `,
        { count: "exact" },
      )
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const members = (data || []).map((row: any) => {
      const profile = row.gym_member_profiles?.[0] || {};
      return {
        user_id: row.id,
        wallet_address: row.wallet_address,
        display_name: row.display_name || "N/A",
        email: row.email,
        membership_type: profile.membership_type || "STANDARD",
        registration_date: profile.registration_date || 0,
        expiry_date: profile.expiry_date || 0,
        total_attendance: profile.total_attendance || 0,
        is_active: profile.is_active ?? true,
        status: row.status,
        updated_at: row.updated_at,
      };
    });

    return { data: members, total: count || 0 };
  }

  /**
   * Update member profile (off-chain data only: name, email)
   * WARNING: On-chain data (membership_type, expiry_date) can only be updated via contract
   */
  async updateMemberProfile(
    walletAddress: string,
    updates: MemberUpdateData,
  ): Promise<MemberProfile> {
    // 1. Get user ID
    const { data: user, error: userError } = await this.supabase
      .from("app_users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (userError) {
      throw new Error(`Member not found: ${walletAddress}`);
    }

    // 2. Update user record
    const { data: updated, error: updateError } = await this.supabase
      .from("app_users")
      .update({
        display_name: updates.display_name,
        email: updates.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Return full profile
    const profile = await this.getMemberProfile(walletAddress);
    if (!profile) throw new Error("Failed to retrieve updated profile");
    return profile;
  }

  /**
   * Soft-delete member (mark as inactive)
   * WARNING: Does NOT delete on-chain data
   */
  async softDeleteMember(walletAddress: string): Promise<void> {
    const { data: user, error: userError } = await this.supabase
      .from("app_users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (userError) {
      throw new Error(`Member not found: ${walletAddress}`);
    }

    // Mark as inactive in user status
    const { error: updateError } = await this.supabase
      .from("app_users")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    // Mark as inactive in membership profile
    const { error: profileError } = await this.supabase
      .from("gym_member_profiles")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (profileError) throw profileError;

    console.log(`✓ Member soft-deleted: ${walletAddress}`);
  }

  /**
   * Check if membership is expired
   */
  async isMembershipExpired(walletAddress: string): Promise<boolean> {
    const profile = await this.getMemberProfile(walletAddress);
    if (!profile) return true;

    const now = Math.floor(Date.now() / 1000);
    return profile.expiry_date < now;
  }

  /**
   * Get member attendance history
   */
  async getMemberAttendance(
    walletAddress: string,
    limit: number = 30,
  ): Promise<
    Array<{
      attendance_date: number;
      attendance_status: string;
      tx_hash: string;
    }>
  > {
    const { data: user, error: userError } = await this.supabase
      .from("app_users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (userError) {
      throw new Error(`Member not found: ${walletAddress}`);
    }

    const { data, error } = await this.supabase
      .from("gym_attendance_records")
      .select("attendance_date, attendance_status, tx_hash")
      .eq("user_id", user.id)
      .order("attendance_date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get member payment history
   */
  async getMemberPayments(
    walletAddress: string,
    limit: number = 20,
  ): Promise<
    Array<{
      id: string;
      transaction_type: string;
      amount_wei: string;
      status: string;
      tx_hash: string;
      created_at: string;
    }>
  > {
    const { data: user, error: userError } = await this.supabase
      .from("app_users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (userError) {
      throw new Error(`Member not found: ${walletAddress}`);
    }

    const { data, error } = await this.supabase
      .from("gym_payment_transactions")
      .select("id, transaction_type, amount_wei, status, tx_hash, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Ban member (mark status as 'banned')
   */
  async banMember(walletAddress: string, reason: string = ""): Promise<void> {
    const { data: user, error: userError } = await this.supabase
      .from("app_users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (userError) {
      throw new Error(`Member not found: ${walletAddress}`);
    }

    const { error: updateError } = await this.supabase
      .from("app_users")
      .update({
        status: "banned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    // Log admin action
    await this.supabase.from("admin_actions").insert({
      admin_user_id: user.id,
      action_type: "ban_member",
      target_user_id: user.id,
      metadata: { reason },
    });

    console.log(`✓ Member banned: ${walletAddress}`);
  }
}

// ============= EXPORT SINGLETON =============

export const gymMemberService = new GymMemberService();

// ============= CLI =============

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    const service = new GymMemberService();

    if (command === "get" && args[1]) {
      const profile = await service.getMemberProfile(args[1]);
      console.log(profile);
    } else if (command === "list") {
      const { data, total } = await service.getAllMembers(10, 0);
      console.log(`Total members: ${total}`);
      console.log(data);
    } else if (command === "attendance" && args[1]) {
      const records = await service.getMemberAttendance(args[1]);
      console.log(records);
    } else if (command === "payments" && args[1]) {
      const payments = await service.getMemberPayments(args[1]);
      console.log(payments);
    } else {
      console.log(`
Usage:
  npx ts-node scripts/gymMemberService.ts get <wallet_address>
  npx ts-node scripts/gymMemberService.ts list
  npx ts-node scripts/gymMemberService.ts attendance <wallet_address>
  npx ts-node scripts/gymMemberService.ts payments <wallet_address>
      `);
    }
  })().catch(console.error);
}
