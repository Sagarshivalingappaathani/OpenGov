const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy VoterSBT contract
  console.log("Deploying VoterSBT...");
  const VoterSBT = await ethers.getContractFactory("VoterSBT");
  const voterSBT = await VoterSBT.deploy();
  await voterSBT.waitForDeployment();
  const voterSBTAddress = await voterSBT.getAddress();
  console.log("VoterSBT deployed to:", voterSBTAddress);

  // Deploy Verifier contract
  console.log("Deploying Verifier...");
  const Verifier = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("Verifier deployed to:", verifierAddress);

  // Deploy ZKVotingSystem contract
  console.log("Deploying ZKVotingSystem...");
  const ZKVotingSystem = await ethers.getContractFactory("ZKVotingSystem");
  const zkVotingSystem = await ZKVotingSystem.deploy(voterSBTAddress, verifierAddress);
  await zkVotingSystem.waitForDeployment();
  const zkVotingSystemAddress = await zkVotingSystem.getAddress();
  console.log("ZKVotingSystem deployed to:", zkVotingSystemAddress);

  // Deploy PublicKeyRegistry contract
  console.log("Deploying PublicKeyRegistry...");
  const PublicKeyRegistry = await ethers.getContractFactory("PublicFundTreasury");
  const publicKeyRegistry = await PublicKeyRegistry.deploy(2);
  await publicKeyRegistry.waitForDeployment();
  const publicKeyRegistryAddress = await publicKeyRegistry.getAddress();
  console.log("PublicKeyRegistry deployed to:", publicKeyRegistryAddress);

  // Update .env file
  const envContent = `NEXT_PUBLIC_SBT_TOKEN_ADDRESS=${voterSBTAddress}\n` +
                     `NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS=${verifierAddress}\n` +
                     `NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS=${zkVotingSystemAddress}\n` +
                     `NEXT_PUBLIC_PUBLIC_FUND_TREASURY_ADDRESS=${publicKeyRegistryAddress}\n`;

  fs.writeFileSync("/home/sagar0418/0418/OpenGov/frontend/.env", envContent);

  console.log(".env file updated successfully!");

  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("VoterSBT:         ", voterSBTAddress);
  console.log("Verifier:         ", verifierAddress);
  console.log("ZKVotingSystem:   ", zkVotingSystemAddress);
  console.log("PublicKeyRegistry:", publicKeyRegistryAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
