import { ethers } from "hardhat";
import { upsertCandidates, upsertElection } from "./_supabase";

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error("Thiếu CONTRACT_ADDRESS trong file .env");
  }

  const voting = await ethers.getContractAt("PrivateVoting", contractAddress);

  const now = Math.floor(Date.now() / 1000);

  const title = "Bau ban can su lop";
  const candidates = ["Nguyen Van A", "Tran Thi B", "Le Van C"];
  const startTime = now;
  const endTime = now + 24 * 60 * 60; // 1 ngày
  const isPublic = true;

  console.log("Dang tao election...");
  console.log({
    contractAddress,
    title,
    candidates,
    startTime,
    endTime,
    isPublic,
  });

  const tx = await voting.createElection(
    title,
    candidates,
    startTime,
    endTime,
    isPublic,
  );

  console.log("Da gui transaction:", tx.hash);

  const receipt = await tx.wait();

  console.log("Tao election thanh cong");
  console.log("Block number:", receipt?.blockNumber);

  const count = await voting.getElectionCount();
  const electionId = Number(count) - 1;
  const [signer] = await ethers.getSigners();

  await upsertElection({
    id: electionId,
    title,
    creator_address: signer.address,
    start_time: startTime,
    end_time: endTime,
    is_public: isPublic,
    is_closed: false,
    created_at: now,
    closed_at: null,
    tx_hash: tx.hash,
  });

  await upsertCandidates(
    candidates.map((candidateName, candidateIndex) => ({
      election_id: electionId,
      candidate_index: candidateIndex,
      candidate_name: candidateName,
    })),
  );

  console.log("Da dong bo election vao Supabase");
  console.log("Tong so election hien tai:", count.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
