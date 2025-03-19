# Open Government Platform

A decentralized application for transparent and secure governance using blockchain technology and zero-knowledge proofs.

## Overview

This platform enables transparent elections, voter registration, and public fund management through smart contracts on the blockchain. The system consists of three main components:

1. **ZKVotingSystem** - A secure voting system that preserves voter privacy using zero-knowledge proofs
2. **VoterSBT** - A Soul-Bound Token (SBT) system for voter registration and identity verification 
3. **PublicFundTreasury** - A transparent treasury management system for public funds

## Features

### Secure Voting System

- **Privacy-Preserving Votes**: Uses zero-knowledge proofs to verify eligible voters without revealing voter identity
- **Election Management**: Create, start, and stop elections with transparent results
- **Candidate Applications**: Allow users to apply as candidates and administrators to approve applications
- **Real-time Results**: View election results in real-time with full transparency

### Voter Registration System

- **Soul-Bound Tokens**: Non-transferable tokens that represent verified voter identities
- **Application Process**: Users can apply for voter registration
- **Admin Approval**: Administrators verify and approve voter applications
- **Voter Tracking**: Track registered voters and their status

### Public Fund Treasury

- **Transparent Fund Management**: Track all deposits and withdrawals from the treasury
- **Multi-Authority Approval**: Require multiple approvals for fund allocation
- **Staged Funding**: Release funds in stages with milestone approvals
- **Progress Reporting**: Document and verify project progress before releasing additional funds

## Technical Architecture

The platform is built with:

- **Frontend**: Next.js with Tailwind CSS
- **Smart Contracts**: Solidity on Ethereum
- **Zero-Knowledge Proofs**: For private and secure voting

## Smart Contracts

### ZKVotingSystem

The main contract for election management and voting:

```solidity
function createElection(string memory _name) public
function applyAsCandidate(uint _electionId, string memory _name, string memory _details) public
function processApplication(uint _electionId, address _applicant, bool _approved) public
function startElection(uint _electionId) public
function zkVote(uint _electionId, uint _candidateId, uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint256 _nullifierHash) public
function stopElection(uint _electionId) public
function getResults(uint _electionId) public view returns (...)
```

### VoterSBT

The contract for voter registration and identity verification:

```solidity
function applyForSBT(bytes32 _voterHash) external
function approveApplication(address applicant, uint128 _nullifier) external onlyOwner
function isRegisteredVoter(address voter) public view returns (bool)
```

### PublicFundTreasury

The contract for public fund management:

```solidity
function depositFunds() external payable
function submitProposal(string memory _description, uint256 _amount, address payable _recipient) external
function voteOnProposal(uint256 _proposalId) external
function releaseInitialFunds(uint256 _proposalId) external
function submitStageReport(uint256 _proposalId, string memory _report) external
function approveStage(uint256 _proposalId) external
```

## Usage

### For Voters

1. Connect your Ethereum wallet
2. Apply for a Voter SBT by submitting your information
3. Once approved, you can vote in active elections
4. All votes are private and secured using zero-knowledge proofs

### For Administrators

1. Create new elections
2. Process candidate applications
3. Start and stop elections
4. Manage the public fund treasury
5. Approve fund proposals and release funding in stages

### For Fund Recipients

1. Submit proposals for public funding
2. Provide progress reports for funded projects
3. Receive funding in stages as milestones are completed and approved

## Security Features

- Zero-knowledge proofs ensure vote privacy while maintaining verifiability
- Multi-signature approval for treasury fund releases
- Soul-bound tokens prevent identity fraud and double-voting
- Staged funding minimizes risk of fund misuse