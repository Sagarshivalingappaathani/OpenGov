// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VoterSBT is ERC721, Ownable {
    uint128 private _tokenIdCounter = 1;

    struct VoterMetadata {
        bytes32 voterHash;
        bool isRegistered;
        uint128 nullifier;
        uint128 tokenId;
    }

    mapping(address => VoterMetadata) public voterData;
    mapping(address => bytes32) public applications;
    address[] public applicants;
    uint128 public applicantCount;

    constructor() ERC721("Voter SoulBound Token", "VSBT") {}

    function applyForSBT(bytes32 _voterHash) external {
        require(!voterData[msg.sender].isRegistered, "Already registered");
        require(applications[msg.sender] == bytes32(0), "Application already submitted");
        applications[msg.sender] = _voterHash;
        applicants.push(msg.sender);
        applicantCount++;
    }

    function approveApplication(address applicant, uint128 _nullifier) external onlyOwner {
        require(applications[applicant] != bytes32(0), "No application found");

        uint128 tokenId = _tokenIdCounter++;
        _safeMint(applicant, tokenId);

        voterData[applicant] = VoterMetadata({
            voterHash: applications[applicant],
            isRegistered: true,
            nullifier: _nullifier,
            tokenId: tokenId
        });

        delete applications[applicant];
    }

    function isRegisteredVoter(address voter) public view returns (bool) {
        return voterData[voter].isRegistered;
    }

    function getAdminAddress() public view returns (address) {
        return owner();
    }

    function getApplicationStatus(address applicant) public view returns (bool hasApplied, bool isRegistered) {
        hasApplied = applications[applicant] != bytes32(0);
        isRegistered = voterData[applicant].isRegistered;
    }

    function getApplicantByIndex(uint128 index) public view onlyOwner returns (address) {
        require(index < applicantCount, "Index out of bounds");
        return applicants[index];
    }

    function getApplicantCount() public view onlyOwner returns (uint128) {
        return applicantCount;
    }

    //get token id by address
    function getTokenIdByAddress(address _address) public view returns (uint256) {
        //check if the address is there in the map
        require(voterData[_address].isRegistered, "Address not registered");
        return voterData[_address].tokenId;
    }

    function getNullifierByAddress(address _address) public view returns (uint128) {
        require(voterData[_address].isRegistered, "Address not registered");
        return voterData[_address].nullifier;
    }

    function getVoterCount() public view returns (uint128) {
        return _tokenIdCounter - 1;
    }
}
