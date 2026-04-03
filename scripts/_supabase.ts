import "dotenv/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type ElectionRow = {
  id: number;
  title: string;
  creator_address: string;
  start_time: number;
  end_time: number;
  is_public: boolean;
  is_closed: boolean;
  created_at: number;
  closed_at: number | null;
  tx_hash: string;
};

type CandidateRow = {
  election_id: number;
  candidate_index: number;
  candidate_name: string;
};

type VoteRow = {
  election_id: number;
  voter_address: string;
  candidate_index: number;
  voted_at: number;
  tx_hash: string;
};

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Thieu bien moi truong ${name}. Vui long cap nhat file .env`,
    );
  }

  return value;
}

export function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = getEnvOrThrow("SUPABASE_URL");
  const serviceRoleKey = getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function upsertElection(row: ElectionRow): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("elections").upsert(row, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(`Loi upsert elections: ${error.message}`);
  }
}

export async function upsertCandidates(rows: CandidateRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("election_candidates").upsert(rows, {
    onConflict: "election_id,candidate_index",
  });

  if (error) {
    throw new Error(`Loi upsert election_candidates: ${error.message}`);
  }
}

export async function upsertVote(row: VoteRow): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("election_votes").upsert(row, {
    onConflict: "election_id,voter_address",
  });

  if (error) {
    throw new Error(`Loi upsert election_votes: ${error.message}`);
  }
}

export async function closeElectionInSupabase(
  electionId: number,
  txHash: string,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const now = Math.floor(Date.now() / 1000);

  const { error } = await supabase
    .from("elections")
    .update({ is_closed: true, closed_at: now, tx_hash: txHash })
    .eq("id", electionId);

  if (error) {
    throw new Error(`Loi update elections(close): ${error.message}`);
  }
}
