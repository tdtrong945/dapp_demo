import { getSupabaseAdminClient } from "./_supabase";

async function main() {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("app_users")
    .select("id")
    .limit(1);

  if (error) {
    throw new Error(`Ket noi Supabase that bai: ${error.message}`);
  }

  console.log("Ket noi Supabase thanh cong");
  console.log("So dong test tra ve:", data?.length ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
