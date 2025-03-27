// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface IVoterSBT {
    function isRegisteredVoter(address voter) external view returns (bool);
}

interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) external view returns (bool);
}

contract ZKVotingSystem {
    IVoterSBT public voterSBT;
    IVerifier public verifier;

    struct CandidateApplication {
        address applicant;
        string name;
        string details;
        bool processed;
        bool approved;
    }

    struct Candidate {
        uint id;
        address candidateAddress;
        string name;
        string details;
        uint voteCount;
    }

    struct Election {
        string name;
        address admin;
        bool isActive;
        bool isCompleted;
        uint candidateCount;
        uint256 startTime;
        uint256 endTime;
        mapping(uint => Candidate) candidates;
        mapping(uint256 => bool) nullifierHashes;
        uint256 voterCount;
        mapping(address => CandidateApplication) candidateApplications;
        address[] applicantList;
    }

    uint public electionCount;
    mapping(uint => Election) public elections;

    event VoteCast(uint indexed electionId, uint256 nullifierHash);
    event DebugLog(string message);
    event CandidateApplicationSubmitted(uint indexed electionId, address applicant, string name);
    event CandidateApplicationProcessed(uint indexed electionId, address applicant, bool approved);

    modifier onlyAdmin(uint _electionId) {
        require(
            msg.sender == elections[_electionId].admin,
            "Only admin can perform this action"
        );
        _;
    }

    modifier electionExists(uint _electionId) {
        require(
            bytes(elections[_electionId].name).length > 0,
            "Election does not exist"
        );
        _;
    }

    modifier hasSBT() {
        require(
            voterSBT.isRegisteredVoter(msg.sender),
            "Must have a valid SBT token"
        );
        _;
    }

    constructor(address _sbtAddress, address _verifierAddress) {
        voterSBT = IVoterSBT(_sbtAddress);
        verifier = IVerifier(_verifierAddress);
    }

    function createElection(string memory _name) public {
        electionCount++;
        Election storage newElection = elections[electionCount];
        newElection.name = _name;
        newElection.admin = msg.sender;
        newElection.isActive = false;
        newElection.isCompleted = false;
        newElection.startTime = 0;
        newElection.endTime = 0;
    }

    function applyAsCandidate(
        uint _electionId,
        string memory _name,
        string memory _details
    ) public electionExists(_electionId) hasSBT {
        Election storage election = elections[_electionId];
        require(!election.isActive, "Cannot apply after election has started");
        require(!election.isCompleted, "Election has already been completed");
        
        // Check if applicant has already applied
        require(
            bytes(election.candidateApplications[msg.sender].name).length == 0,
            "You have already applied for this election"
        );
        
        // Store the application
        election.candidateApplications[msg.sender] = CandidateApplication({
            applicant: msg.sender,
            name: _name,
            details: _details,
            processed: false,
            approved: false
        });

        election.applicantList.push(msg.sender);
        
        emit CandidateApplicationSubmitted(_electionId, msg.sender, _name);
    }
    
    function getApplicationsCount(uint _electionId) 
        public 
        view 
        electionExists(_electionId) 
        returns (uint) 
    {
        return elections[_electionId].applicantList.length;
    }
    
    function getApplicationDetails(uint _electionId, uint _index) 
        public 
        view 
        electionExists(_electionId) 
        onlyAdmin(_electionId)
        returns (address, string memory, string memory, bool, bool) 
    {
        Election storage election = elections[_electionId];
        require(_index < election.applicantList.length, "Invalid application index");
        
        address applicant = election.applicantList[_index];
        CandidateApplication storage application = election.candidateApplications[applicant];
        
        return (
            application.applicant,
            application.name,
            application.details,
            application.processed,
            application.approved
        );
    }
    
    function processApplication(
        uint _electionId,
        address _applicant,
        bool _approved
    ) public electionExists(_electionId) onlyAdmin(_electionId) {
        Election storage election = elections[_electionId];
        require(!election.isActive, "Cannot process applications after election has started");
        
        CandidateApplication storage application = election.candidateApplications[_applicant];
        require(bytes(application.name).length > 0, "Application does not exist");
        require(!application.processed, "Application already processed");
        
        application.processed = true;
        application.approved = _approved;
        
        if (_approved) {
            // Add as a candidate
            election.candidateCount++;
            election.candidates[election.candidateCount] = Candidate({
                id: election.candidateCount,
                candidateAddress: _applicant,
                name: application.name,
                details: application.details,
                voteCount: 0
            });
        }
        
        emit CandidateApplicationProcessed(_electionId, _applicant, _approved);
    }

    function addCandidate(
        uint _electionId,
        address _candidateAddress,
        string memory _name,
        string memory _details
    ) public electionExists(_electionId) onlyAdmin(_electionId) {
        Election storage election = elections[_electionId];
        require(
            !election.isActive,
            "Cannot add candidates after election has started"
        );
        
        // Check if candidate has a valid SBT
        require(
            voterSBT.isRegisteredVoter(_candidateAddress),
            "Candidate must have a valid SBT token"
        );

        election.candidateCount++;
        election.candidates[election.candidateCount] = Candidate(
            election.candidateCount,
            _candidateAddress,
            _name,
            _details,
            0
        );
    }

    function startElection(
        uint _electionId
    ) public electionExists(_electionId) onlyAdmin(_electionId) {
        Election storage election = elections[_electionId];
        require(!election.isActive, "Election is already active");
        require(!election.isCompleted, "Election has already been completed");
        require(election.candidateCount > 0, "No candidates registered for the election");

        election.isActive = true;
        election.startTime = block.timestamp;
    }

    function zkVote(
        uint _electionId,
        uint _candidateId,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint256 _nullifierHash
    ) public electionExists(_electionId) {
        console.log("Casting vote:");
        console.log("Election ID:", _electionId);
        console.log("Candidate ID:", _candidateId);
        console.log("Nullifier Hash:", _nullifierHash);
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");
        require(!election.isCompleted, "Election has already been completed");
        require(_candidateId > 0 && _candidateId <= election.candidateCount, "Invalid candidate ID");
        
        // Verify the nullifier hasn't been used before
        require(!election.nullifierHashes[_nullifierHash], "Vote already cast with this nullifier");
        
        // Prepare inputs for the verifier
        // The public inputs are the election ID and the nullifier hash
        //uint[2] memory input = [uint(_electionId), _nullifierHash];
        
        // Verify the zero-knowledge proof
        //require(verifier.verifyProof(a, b, c, input), "Invalid zero-knowledge proof");
        
        // Mark this nullifier as used
        election.nullifierHashes[_nullifierHash] = true;
        
        // Increment vote count for the candidate
        election.candidates[_candidateId].voteCount++;
        
        // Increment the voter count
        election.voterCount++;
        
        emit VoteCast(_electionId, _nullifierHash);
        emit DebugLog("Vote cast successfully");
    }

    function stopElection(
        uint _electionId
    ) public onlyAdmin(_electionId) electionExists(_electionId) {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");

        election.isActive = false;
        election.isCompleted = true;
        election.endTime = block.timestamp;
    }

    function getCandidates(
        uint _electionId
    )
        public
        view
        electionExists(_electionId)
        returns (uint[] memory, address[] memory, string[] memory, string[] memory, uint[] memory)
    {
        Election storage election = elections[_electionId];
        uint candidateCount = election.candidateCount;

        uint[] memory ids = new uint[](candidateCount);
        address[] memory addresses = new address[](candidateCount);
        string[] memory names = new string[](candidateCount);
        string[] memory details = new string[](candidateCount);
        uint[] memory voteCounts = new uint[](candidateCount);

        for (uint i = 1; i <= candidateCount; i++) {
            Candidate storage candidate = election.candidates[i];
            ids[i - 1] = candidate.id;
            addresses[i - 1] = candidate.candidateAddress;
            names[i - 1] = candidate.name;
            details[i - 1] = candidate.details;
            voteCounts[i - 1] = candidate.voteCount;
        }

        return (ids, addresses, names, details, voteCounts);
    }

    function getVoterCount(
        uint _electionId
    ) public view electionExists(_electionId) returns (uint256) {
        return elections[_electionId].voterCount;
    }

    function getElectionTimes(
        uint _electionId
    )
        public
        view
        electionExists(_electionId)
        returns (uint256 startTime, uint256 endTime)
    {
        Election storage election = elections[_electionId];
        return (election.startTime, election.endTime);
    }

    function getResults(
        uint _electionId
    )
        public
        view
        electionExists(_electionId)
        returns (
            string memory,
            uint[] memory,
            address[] memory,
            string[] memory,
            string[] memory,
            uint[] memory,
            uint256,
            uint256
        )
    {
        Election storage election = elections[_electionId];
        require(election.isCompleted, "Election is not completed yet");

        uint candidateCount = election.candidateCount;
        uint[] memory ids = new uint[](candidateCount);
        address[] memory addresses = new address[](candidateCount);
        string[] memory names = new string[](candidateCount);
        string[] memory details = new string[](candidateCount);
        uint[] memory voteCounts = new uint[](candidateCount);

        for (uint i = 1; i <= candidateCount; i++) {
            Candidate storage candidate = election.candidates[i];
            ids[i - 1] = candidate.id;
            addresses[i - 1] = candidate.candidateAddress;
            names[i - 1] = candidate.name;
            details[i - 1] = candidate.details;
            voteCounts[i - 1] = candidate.voteCount;
        }

        return (
            election.name,
            ids,
            addresses,
            names,
            details,
            voteCounts,
            election.startTime,
            election.endTime
        );
    }

    function isVoted(uint _electionId, uint256 _nullifierHash) public view electionExists(_electionId) returns (bool) {
        console.log("Checking if voted:");
        console.log("Election ID:", _electionId);
        console.log("Nullifier Hash:", _nullifierHash);
        console.log("Nullifier Hash Exists:", elections[_electionId].nullifierHashes[_nullifierHash]);
        return elections[_electionId].nullifierHashes[_nullifierHash];
    }

    function hasApplied(uint _electionId, address _applicant) public view electionExists(_electionId) returns (bool) {
        //check if the applicant is in the applicant list
        for (uint i = 0; i < elections[_electionId].applicantList.length; i++) {
            console.log("Applicant:", elections[_electionId].applicantList[i]);
            console.log("Applicant:", _applicant);
            if (elections[_electionId].applicantList[i] == _applicant) {
                return true;
            }
        }
        return false;
    }
}