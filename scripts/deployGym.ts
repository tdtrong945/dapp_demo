import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying GymMembership Contract...\n");

  const signers = await ethers.getSigners();
  const owner = signers[0];

  if (!owner) {
    throw new Error("No deployer account found. Check PRIVATE_KEY in .env");
  }

  const envAdmins = (process.env.INITIAL_ADMINS || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const signerAdmins = signers.slice(1, 4).map((s) => s.address);
  const initialAdmins = envAdmins.length > 0
    ? envAdmins
    : signerAdmins.length > 0
      ? signerAdmins
      : [owner.address];

  console.log(" Owner:", owner.address);
  initialAdmins.forEach((admin, idx) => {
    console.log(` Admin ${idx + 1}:`, admin);
  });

  // Trien khai contract
  const GymMembership = await ethers.getContractFactory("GymMembership");
  const gym = await GymMembership.deploy(initialAdmins);

  await gym.waitForDeployment();

  const contractAddress = await gym.getAddress();
  console.log("\nContract deployed:", contractAddress);

  // Lay thong tin goi membership
  console.log("\n Membership Plans:");
  const standardPlan = await gym.getMembershipPlan(0);
  const vipPlan = await gym.getMembershipPlan(1);

  console.log(
    "  STANDARD:",
    ethers.formatEther(standardPlan.price),
    "ETH /",
    standardPlan.durationDays.toString(),
    "days",
  );
  console.log(
    "  VIP:     ",
    ethers.formatEther(vipPlan.price),
    "ETH /",
    vipPlan.durationDays.toString(),
    "days",
  );

  // Luu thong tin deploy
  const fs = require("fs");
  const deploymentInfo = {
    contractAddress,
    owner: owner.address,
    admins: initialAdmins,
    membershipPlans: {
      STANDARD: {
        price: ethers.formatEther(standardPlan.price) + " ETH",
        durationDays: standardPlan.durationDays.toString(),
      },
      VIP: {
        price: ethers.formatEther(vipPlan.price) + " ETH",
        durationDays: vipPlan.durationDays.toString(),
      },
    },
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
