import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying GymMembership Contract...\n");

  const [owner, admin1, admin2, admin3] = await ethers.getSigners();

  console.log(" Owner:", owner.address);
  console.log(" Admin 1:", admin1.address);
  console.log(" Admin 2:", admin2.address);
  console.log(" Admin 3:", admin3.address);

  // Deploy contract
  const GymMembership = await ethers.getContractFactory("GymMembership");
  const gym = await GymMembership.deploy([
    admin1.address,
    admin2.address,
    admin3.address,
  ]);

  await gym.waitForDeployment();

  const contractAddress = await gym.getAddress();
  console.log("\nContract deployed:", contractAddress);

  // Lấy thông tin membership plan
  console.log("\n Membership Plans:");
  const standardPlan = await gym.getMembershipPlan(0);
  const vipPlan = await gym.getMembershipPlan(1);

  console.log(
    "  STANDARD:",
    ethers.formatEther(standardPlan.price),
    "ETH /",
    standardPlan.durationDays,
    "days",
  );
  console.log(
    "  VIP:     ",
    ethers.formatEther(vipPlan.price),
    "ETH /",
    vipPlan.durationDays,
    "days",
  );

  // Lưu deployment info
  const fs = require("fs");
  const deploymentInfo = {
    contractAddress,
    owner: owner.address,
    admins: [admin1.address, admin2.address, admin3.address],
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
