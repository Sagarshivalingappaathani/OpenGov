// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IVoterSBT {
    function registerVoter(address voter, bytes32 voterHash, uint256 nullifier) external;
    function isRegisteredVoter(address voter) external view returns (bool);
}

contract SBTApplication is Ownable {
    struct Application {
        address applicant;
        bytes32 voterHash;
        uint256 nullifier;
        bool isApproved;
        bool isProcessed;
    }

    IVoterSBT public voterSBT;
    mapping(address => Application) public applications;
    address[] public applicants;

    event ApplicationSubmitted(address indexed applicant, bytes32 voterHash);
    event ApplicationApproved(address indexed applicant);
    event ApplicationRejected(address indexed applicant);

    constructor(address _voterSBTAddress) {
        require(_voterSBTAddress != address(0), "Invalid SBT contract address");
        voterSBT = IVoterSBT(_voterSBTAddress);
    }

    function applyForSBT(bytes32 _voterHash, uint256 _nullifier) external {
        require(!voterSBT.isRegisteredVoter(msg.sender), "Already a registered voter");
        require(!applications[msg.sender].isProcessed, "Application already processed");

        applications[msg.sender] = Application({
            applicant: msg.sender,
            voterHash: _voterHash,
            nullifier: _nullifier,
            isApproved: false,
            isProcessed: false
        });

        applicants.push(msg.sender);
        emit ApplicationSubmitted(msg.sender, _voterHash);
    }

    function approveApplication(address _applicant) external onlyOwner {
        Application storage application = applications[_applicant];
        require(!application.isProcessed, "Application already processed");

        application.isApproved = true;
        application.isProcessed = true;

        voterSBT.registerVoter(_applicant, application.voterHash, application.nullifier);
        emit ApplicationApproved(_applicant);
    }

    function rejectApplication(address _applicant) external onlyOwner {
        Application storage application = applications[_applicant];
        require(!application.isProcessed, "Application already processed");

        application.isApproved = false;
        application.isProcessed = true;
        emit ApplicationRejected(_applicant);
    }

    function getApplicants() external view returns (address[] memory) {
        return applicants;
    }

    function getApplication(address _applicant) external view returns (Application memory) {
        return applications[_applicant];
    }
}
