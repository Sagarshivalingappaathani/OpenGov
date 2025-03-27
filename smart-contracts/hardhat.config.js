require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-circom");

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable viaIR
    },
  },
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
    },
  },
  circom: {
    inputBasePath: "./circuits",
    outputBasePath: "./build/circuits",
    ptau: "path/to/your/ptau/file",
    circuits: [
      {
        name: "verifier",
        protocol: "groth16"
      }
    ]
  }
};