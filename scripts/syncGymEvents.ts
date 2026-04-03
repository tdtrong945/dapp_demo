import "dotenv/config";
import { ethers } from "ethers";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ============= TYPES =============

type GymEvent = {
  event: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  data: Record<string, unknown>;
};

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

function getContractAddress(): string {
  try {
    const deployPath = path.join(__dirname, "../deployment.json");
    const deployment = JSON.parse(fs.readFileSync(deployPath, "utf-8"));
    return deployment.gymMembership;
  } catch {
    throw new Error("Cannot read GymMembership address from deployment.json");
  }
}

// ============= GYM CONTRACT ABI (Events only) =============

const GYM_ABI = [
  "event MemberRegistered(address indexed memberAddress, string name, uint8 membershipType, uint256 registrationDate, uint256 expiryDate, uint256 pricePaid)",
  "event MembershipRenewed(address indexed memberAddress, uint8 newMembershipType, uint256 newExpiryDate)",
  "event AttendanceRecorded(address indexed memberAddress, uint256 attendanceDate, uint8 attendanceStatus, bytes32 txHash)",
  "event AdminAdded(address indexed newAdmin)",
  "event AdminRemoved(address indexed removedAdmin)",
  "event PaymentReceived(address indexed payer, uint256 amount, string reason)",
  "event RevenueWithdrawn(address indexed recipient, uint256 amount)",
  "event MembershipPlanUpdated(uint8 planType, uint256 newPrice, uint256 newDurationDays)",
];

// ============= SYNC LOGIC =============

export async function syncMemberRegistered(
  supabase: SupabaseClient,
  event: GymEvent,
): Promise<void> {
  const data = event.data as {
    memberAddress: string;
    name: string;
    membershipType: number;
    expiryDate: number;
    pricePaid: string;
  };

  // 1. Ensure user exists
  const { data: existingUser, error: userCheckError } = await supabase
    .from("app_users")
    .select("id")
    .eq("wallet_address", data.memberAddress)
    .single();

  let userId: string;
  if (userCheckError) {
    const { data: newUser, error: insertError } = await supabase
      .from("app_users")
      .insert({
        wallet_address: data.memberAddress,
        display_name: data.name || "Member",
        status: "active",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting user:", insertError);
      throw insertError;
    }
    userId = newUser!.id;
  } else {
    userId = existingUser.id;
  }

  // 2. Create/update membership profile
  const membershipType = data.membershipType === 0 ? "STANDARD" : "VIP";
  const { error: profileError } = await supabase
    .from("gym_member_profiles")
    .upsert(
      {
        user_id: userId,
        membership_type: membershipType,
        registration_date: Math.floor(Date.now() / 1000),
        expiry_date: data.expiryDate,
        total_attendance: 0,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (profileError) {
    console.error("Error upserting membership profile:", profileError);
    throw profileError;
  }

  // 3. Record payment transaction
  const { error: paymentError } = await supabase
    .from("gym_payment_transactions")
    .insert({
      user_id: userId,
      transaction_type: "membership_registration",
      amount_wei: data.pricePaid,
      status: "confirmed",
      tx_hash: event.txHash,
      blockchain_timestamp: event.timestamp,
      metadata: {
        name: data.name,
        membership_type: membershipType,
        expiry_date: data.expiryDate,
      },
    });

  if (paymentError) {
    console.error("Error recording payment:", paymentError);
    throw paymentError;
  }

  console.log(
    `✓ Member registered: ${data.memberAddress} (${membershipType}) - ${event.txHash}`,
  );
}

export async function syncMembershipRenewed(
  supabase: SupabaseClient,
  event: GymEvent,
): Promise<void> {
  const data = event.data as {
    memberAddress: string;
    newMembershipType: number;
    newExpiryDate: number;
  };

  // 1. Get user by wallet
  const { data: user, error: userError } = await supabase
    .from("app_users")
    .select("id")
    .eq("wallet_address", data.memberAddress)
    .single();

  if (userError) {
    console.error("User not found for renewal:", data.memberAddress);
    return;
  }

  // 2. Update membership profile
  const membershipType = data.newMembershipType === 0 ? "STANDARD" : "VIP";
  const { error: updateError } = await supabase
    .from("gym_member_profiles")
    .update({
      membership_type: membershipType,
      expiry_date: data.newExpiryDate,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Error updating membership:", updateError);
    throw updateError;
  }

  console.log(
    `✓ Membership renewed: ${data.memberAddress} (${membershipType}) - ${event.txHash}`,
  );
}

export async function syncAttendanceRecorded(
  supabase: SupabaseClient,
  event: GymEvent,
): Promise<void> {
  const data = event.data as {
    memberAddress: string;
    attendanceDate: number;
    attendanceStatus: number;
  };

  // 1. Get user by wallet
  const { data: user, error: userError } = await supabase
    .from("app_users")
    .select("id")
    .eq("wallet_address", data.memberAddress)
    .single();

  if (userError) {
    console.error("User not found for attendance:", data.memberAddress);
    return;
  }

  // 2. Insert attendance record
  const status = data.attendanceStatus === 0 ? "ABSENT" : "PRESENT";
  const { error: insertError } = await supabase
    .from("gym_attendance_records")
    .insert({
      user_id: user.id,
      attendance_date: data.attendanceDate,
      attendance_status: status,
      tx_hash: event.txHash,
    });

  if (insertError) {
    console.error("Error inserting attendance:", insertError);
    throw insertError;
  }

  // 3. Increment total attendance if PRESENT
  if (status === "PRESENT") {
    await supabase.rpc("increment_attendance", {
      p_user_id: user.id,
    });
  }

  console.log(
    `✓ Attendance recorded: ${data.memberAddress} (${status}) - ${event.txHash}`,
  );
}

export async function syncAdminAdded(
  supabase: SupabaseClient,
  event: GymEvent,
): Promise<void> {
  const data = event.data as {
    newAdmin: string;
  };

  // 1. Ensure user exists
  const { data: existingUser, error: userCheckError } = await supabase
    .from("app_users")
    .select("id")
    .eq("wallet_address", data.newAdmin)
    .single();

  let userId: string;
  if (userCheckError) {
    const { data: newUser, error: insertError } = await supabase
      .from("app_users")
      .insert({
        wallet_address: data.newAdmin,
        status: "active",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    userId = newUser!.id;
  } else {
    userId = existingUser.id;
  }

  // 2. Assign admin role
  const { data: adminRole, error: roleError } = await supabase
    .from("app_roles")
    .select("id")
    .eq("role_name", "admin")
    .single();

  if (roleError) throw roleError;

  const { error: assignError } = await supabase
    .from("app_user_roles")
    .insert({
      user_id: userId,
      role_id: adminRole.id,
      assigned_at: new Date().toISOString(),
    })
    .select();

  if (assignError && !assignError.message.includes("duplicate")) {
    throw assignError;
  }

  console.log(`✓ Admin added: ${data.newAdmin} - ${event.txHash}`);
}

export async function syncPaymentReceived(
  supabase: SupabaseClient,
  event: GymEvent,
): Promise<void> {
  const data = event.data as {
    payer: string;
    amount: string;
    reason: string;
  };

  // 1. Get user by wallet
  const { data: user, error: userError } = await supabase
    .from("app_users")
    .select("id")
    .eq("wallet_address", data.payer)
    .single();

  if (userError) {
    console.error("User not found for payment:", data.payer);
    return;
  }

  // 2. Record payment
  const { error: paymentError } = await supabase
    .from("gym_payment_transactions")
    .insert({
      user_id: user.id,
      transaction_type: "payment_received",
      amount_wei: data.amount,
      status: "confirmed",
      tx_hash: event.txHash,
      blockchain_timestamp: event.timestamp,
      metadata: { reason: data.reason },
    });

  if (paymentError) {
    console.error("Error recording payment:", paymentError);
    throw paymentError;
  }

  console.log(
    `✓ Payment received: ${data.payer} (${data.amount} Wei) - ${event.txHash}`,
  );
}

// ============= MAIN LISTENER =============

export async function startEventListener(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const provider = getEthersProvider();
  const contractAddress = getContractAddress();
  const contract = new ethers.Contract(contractAddress, GYM_ABI, provider);

  console.log(`🔍 Listening to GymMembership events at ${contractAddress}...`);

  // MemberRegistered
  contract.on("MemberRegistered", async (...args) => {
    const event: GymEvent = {
      event: "MemberRegistered",
      txHash: args[args.length - 1].transactionHash,
      blockNumber: args[args.length - 1].blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        memberAddress: args[0],
        name: args[1],
        membershipType: args[2],
        registrationDate: args[3],
        expiryDate: args[4],
        pricePaid: args[5].toString(),
      },
    };
    try {
      await syncMemberRegistered(supabase, event);
    } catch (error) {
      console.error("Error syncing MemberRegistered:", error);
    }
  });

  // MembershipRenewed
  contract.on("MembershipRenewed", async (...args) => {
    const event: GymEvent = {
      event: "MembershipRenewed",
      txHash: args[args.length - 1].transactionHash,
      blockNumber: args[args.length - 1].blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        memberAddress: args[0],
        newMembershipType: args[1],
        newExpiryDate: args[2],
      },
    };
    try {
      await syncMembershipRenewed(supabase, event);
    } catch (error) {
      console.error("Error syncing MembershipRenewed:", error);
    }
  });

  // AttendanceRecorded
  contract.on("AttendanceRecorded", async (...args) => {
    const event: GymEvent = {
      event: "AttendanceRecorded",
      txHash: args[args.length - 1].transactionHash,
      blockNumber: args[args.length - 1].blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        memberAddress: args[0],
        attendanceDate: args[1],
        attendanceStatus: args[2],
      },
    };
    try {
      await syncAttendanceRecorded(supabase, event);
    } catch (error) {
      console.error("Error syncing AttendanceRecorded:", error);
    }
  });

  // AdminAdded
  contract.on("AdminAdded", async (...args) => {
    const event: GymEvent = {
      event: "AdminAdded",
      txHash: args[args.length - 1].transactionHash,
      blockNumber: args[args.length - 1].blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        newAdmin: args[0],
      },
    };
    try {
      await syncAdminAdded(supabase, event);
    } catch (error) {
      console.error("Error syncing AdminAdded:", error);
    }
  });

  // PaymentReceived
  contract.on("PaymentReceived", async (...args) => {
    const event: GymEvent = {
      event: "PaymentReceived",
      txHash: args[args.length - 1].transactionHash,
      blockNumber: args[args.length - 1].blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        payer: args[0],
        amount: args[1].toString(),
        reason: args[2],
      },
    };
    try {
      await syncPaymentReceived(supabase, event);
    } catch (error) {
      console.error("Error syncing PaymentReceived:", error);
    }
  });

  console.log("✅ Event listeners registered. Waiting for events...");
}

// ============= RUN =============

if (require.main === module) {
  startEventListener().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
