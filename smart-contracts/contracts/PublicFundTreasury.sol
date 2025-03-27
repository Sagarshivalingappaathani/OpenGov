// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PublicFundTreasury {
    address public owner;
    uint256 public fundBalance;
    uint256 public proposalCount;
    uint256 public requiredApprovals;  // Number of approvals needed for a proposal to pass

    // Authority management
    mapping(address => bool) public isAuthority;
    address[] public authorities;

    struct Proposal {
        uint256 id;
        string description;
        uint256 amount;
        address payable recipient;
        mapping(address => bool) hasVoted;  // Track which authorities have voted
        uint256 approvalCount;
        bool approved;
        bool executed;
        uint256 createdAt;
        // Stage tracking
        uint8 currentStage;         // 0 = not started, 1 = first stage, 2 = final stage
        uint8 totalStages;          // Default is 2 for two-stage funding
        string stageReport;         // Report submitted by recipient after stage completion
        mapping(address => bool) hasApprovedStage;  // Track which authorities have approved the stage
        uint256 stageApprovalCount; // Number of authorities who approved the current stage
        bool stageLocked;           // Prevents multiple fund releases for the same stage
    }

    mapping(uint256 => Proposal) public proposals;

    event FundsDeposited(address indexed depositor, uint256 amount);
    event ProposalSubmitted(uint256 id, string description, uint256 amount, address recipient);
    event AuthorityAdded(address indexed authority);
    event AuthorityRemoved(address indexed authority);
    event AuthorityVoted(uint256 indexed proposalId, address indexed authority);
    event ProposalApproved(uint256 indexed proposalId);
    event FundsReleased(uint256 indexed proposalId, address indexed recipient, uint256 amount, uint8 stage);
    event StageReportSubmitted(uint256 indexed proposalId, uint8 stage, string report);
    event StageApproved(uint256 indexed proposalId, uint8 stage, address indexed authority);
    event StageCompleted(uint256 indexed proposalId, uint8 stage);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyAuthority() {
        require(isAuthority[msg.sender], "Only authorities can vote on proposals");
        _;
    }

    modifier proposalExists(uint256 _proposalId) {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Proposal does not exist");
        _;
    }

    modifier notFullyExecuted(uint256 _proposalId) {
        require(!proposals[_proposalId].executed, "Proposal already fully executed");
        _;
    }

    modifier onlyRecipient(uint256 _proposalId) {
        require(msg.sender == proposals[_proposalId].recipient, "Only the recipient can submit stage reports");
        _;
    }

    constructor(uint256 _requiredApprovals) {
        owner = msg.sender;
        
        // Add owner as the first authority
        isAuthority[msg.sender] = true;
        authorities.push(msg.sender);
        
        // Set initial required approvals (minimum 1)
        requiredApprovals = _requiredApprovals > 0 ? _requiredApprovals : 1;
    }

    // Add a new authority (only owner can add)
    function addAuthority(address _authority) external onlyOwner {
        require(_authority != address(0), "Invalid authority address");
        require(!isAuthority[_authority], "Address is already an authority");
        
        isAuthority[_authority] = true;
        authorities.push(_authority);
        
        emit AuthorityAdded(_authority);
    }

    // Remove an authority (only owner can remove)
    function removeAuthority(address _authority) external onlyOwner {
        require(isAuthority[_authority], "Address is not an authority");
        require(authorities.length > requiredApprovals, "Cannot have fewer authorities than required approvals");
        require(_authority != owner, "Cannot remove the owner from authorities");
        
        isAuthority[_authority] = false;
        
        // Remove authority from the array
        for (uint256 i = 0; i < authorities.length; i++) {
            if (authorities[i] == _authority) {
                authorities[i] = authorities[authorities.length - 1];
                authorities.pop();
                break;
            }
        }
        
        emit AuthorityRemoved(_authority);
    }

    // Update required approvals threshold
    function updateRequiredApprovals(uint256 _newRequiredApprovals) external onlyOwner {
        require(_newRequiredApprovals > 0, "Must require at least one approval");
        require(_newRequiredApprovals <= authorities.length, "Cannot require more approvals than existing authorities");
        
        requiredApprovals = _newRequiredApprovals;
    }

    // Allow public deposits into the treasury
    function depositFunds() external payable {
        require(msg.value > 0, "Deposit must be greater than zero");
        fundBalance += msg.value;
        
        emit FundsDeposited(msg.sender, msg.value);
    }

    // Submit a new spending proposal (can be done by anyone)
    function submitProposal(string memory _description, uint256 _amount, address payable _recipient) external {
        require(_amount > 0, "Requested amount must be greater than zero");
        require(_recipient != address(0), "Invalid recipient address");
        
        proposalCount++;
        
        // Create new proposal
        Proposal storage newProposal = proposals[proposalCount];
        newProposal.id = proposalCount;
        newProposal.description = _description;
        newProposal.amount = _amount;
        newProposal.recipient = _recipient;
        newProposal.approvalCount = 0;
        newProposal.approved = false;
        newProposal.executed = false;
        newProposal.createdAt = block.timestamp;
        
        // Initialize stage tracking (default to two stages)
        newProposal.currentStage = 0;
        newProposal.totalStages = 2;
        newProposal.stageApprovalCount = 0;
        newProposal.stageLocked = false;
        
        emit ProposalSubmitted(proposalCount, _description, _amount, _recipient);
    }

    // Vote on a proposal (only authorities can vote)
    function voteOnProposal(uint256 _proposalId) external onlyAuthority proposalExists(_proposalId) notFullyExecuted(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        // Ensure we're voting on the initial proposal, not a stage
        require(proposal.currentStage == 0, "Proposal already in progress, use approveStage instead");
        
        // Check if authority has already voted
        require(!proposal.hasVoted[msg.sender], "Authority has already voted on this proposal");
        
        // Record the vote
        proposal.hasVoted[msg.sender] = true;
        proposal.approvalCount++;
        
        emit AuthorityVoted(_proposalId, msg.sender);
        
        // Check if proposal has reached required approvals
        if (proposal.approvalCount >= requiredApprovals) {
            proposal.approved = true;
            emit ProposalApproved(_proposalId);
        }
    }

    // Release first stage funds for an approved proposal
    function releaseInitialFunds(uint256 _proposalId) external proposalExists(_proposalId) notFullyExecuted(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.approved, "Proposal is not approved");
        require(proposal.currentStage == 0, "Initial funds already released");
        require(proposal.amount <= address(this).balance, "Insufficient funds in treasury");
        
        // Move to first stage
        proposal.currentStage = 1;
        proposal.stageLocked = false;
        
        // Calculate first stage amount (50% of total)
        uint256 firstStageAmount = proposal.amount / 2;
        fundBalance -= firstStageAmount;
        
        // Transfer first stage funds to recipient
        proposal.recipient.transfer(firstStageAmount);
        
        emit FundsReleased(_proposalId, proposal.recipient, firstStageAmount, 1);
    }

    // Submit stage completion report (only recipient can submit)
    function submitStageReport(uint256 _proposalId, string memory _report) external proposalExists(_proposalId) notFullyExecuted(_proposalId) onlyRecipient(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.currentStage > 0 && proposal.currentStage < proposal.totalStages, "Cannot submit report at current stage");
        require(!proposal.stageLocked, "Current stage is locked, awaiting next stage release");
        
        // Store the report
        proposal.stageReport = _report;
        proposal.stageLocked = true;
        
        // Reset stage approval counters for authorities
        proposal.stageApprovalCount = 0;
        
        emit StageReportSubmitted(_proposalId, proposal.currentStage, _report);
    }

    // Approve a stage report (only authorities can approve)
    function approveStage(uint256 _proposalId) external onlyAuthority proposalExists(_proposalId) notFullyExecuted(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.currentStage > 0 && proposal.currentStage < proposal.totalStages, "Not at a stage that requires approval");
        require(proposal.stageLocked, "No stage report submitted yet");
        require(!proposal.hasApprovedStage[msg.sender], "Authority has already approved this stage");
        
        // Record the stage approval
        proposal.hasApprovedStage[msg.sender] = true;
        proposal.stageApprovalCount++;
        
        emit StageApproved(_proposalId, proposal.currentStage, msg.sender);
        
        // Check if stage has reached required approvals
        if (proposal.stageApprovalCount >= requiredApprovals) {
            emit StageCompleted(_proposalId, proposal.currentStage);
        }
    }

    // Release funds for next stage after approval
    function releaseNextStageFunds(uint256 _proposalId) external proposalExists(_proposalId) notFullyExecuted(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.currentStage > 0 && proposal.currentStage < proposal.totalStages, "Not at a stage that can advance");
        require(proposal.stageLocked, "Current stage not locked");
        require(proposal.stageApprovalCount >= requiredApprovals, "Stage not approved by enough authorities");
        
        uint8 nextStage = proposal.currentStage + 1;
        uint256 remainingAmount = 0;
        
        // Calculate remaining amount (for final stage)
        if (nextStage == proposal.totalStages) {
            remainingAmount = proposal.amount - (proposal.amount / 2);
            require(remainingAmount <= address(this).balance, "Insufficient funds in treasury");
            
            // Mark as fully executed if this is the final stage
            proposal.executed = true;
        }
        
        // Update stage
        proposal.currentStage = nextStage;
        proposal.stageLocked = false;
        
        // Reset stage approvals for next stage
        proposal.stageApprovalCount = 0;
        for (uint i = 0; i < authorities.length; i++) {
            proposal.hasApprovedStage[authorities[i]] = false;
        }
        
        // Transfer funds for final stage
        if (remainingAmount > 0) {
            fundBalance -= remainingAmount;
            proposal.recipient.transfer(remainingAmount);
            emit FundsReleased(_proposalId, proposal.recipient, remainingAmount, nextStage);
        }
    }

    // Get current treasury balance
    function getTreasuryBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Get the number of authorities
    function getAuthorityCount() external view returns (uint256) {
        return authorities.length;
    }

    // Check if an address has voted on a specific proposal
    function hasVoted(uint256 _proposalId, address _authority) external view proposalExists(_proposalId) returns (bool) {
        return proposals[_proposalId].hasVoted[_authority];
    }

    // Get proposal approval count
    function getApprovalCount(uint256 _proposalId) external view proposalExists(_proposalId) returns (uint256) {
        return proposals[_proposalId].approvalCount;
    }
    
    // Get list of all authorities
    function getAllAuthorities() external view returns (address[] memory) {
        return authorities;
    }

    // Get proposal stage details
    function getProposalStageDetails(uint256 _proposalId) external view proposalExists(_proposalId) returns (
        uint8 currentStage,
        uint8 totalStages,
        string memory stageReport,
        uint256 stageApprovalCount,
        bool stageLocked
    ) {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.currentStage,
            proposal.totalStages,
            proposal.stageReport,
            proposal.stageApprovalCount,
            proposal.stageLocked
        );
    }

    // Check if an authority has approved the current stage
    function hasApprovedStage(uint256 _proposalId, address _authority) external view proposalExists(_proposalId) returns (bool) {
        return proposals[_proposalId].hasApprovedStage[_authority];
    }
}