import { ethers } from "hardhat";

async function main() {
  try {
    const [deployer] = await ethers.getSigners();
    const LockContract = await ethers.getContractFactory("Lock");
    const utils = await LockContract.deploy(deployer.address);
    await utils.waitForDeployment();
    console.log("Lock deployed to:", await utils.getAddress());
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

main();
