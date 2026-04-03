import { ethers } from "hardhat";
import { upsertVote } from "./_supabase";

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error("Thiếu CONTRACT_ADDRESS trong file .env");
  }

  const voting = await ethers.getContractAt("PrivateVoting", contractAddress);

  const electionId = 0;
  const candidateIndex = 1;

  console.log("Dang vote...");
  const tx = await voting.vote(electionId, candidateIndex);

  console.log("Tx hash:", tx.hash);
  await tx.wait();

  const [signer] = await ethers.getSigners();
  await upsertVote({
    election_id: electionId,
    voter_address: signer.address,
    candidate_index: candidateIndex,
    voted_at: Math.floor(Date.now() / 1000),
    tx_hash: tx.hash,
  });

  console.log("Vote thanh cong");
  console.log("Da dong bo vote vao Supabase");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
