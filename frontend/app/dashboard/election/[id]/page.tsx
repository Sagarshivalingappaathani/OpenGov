'use client'
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Contract, ethers } from "ethers";
import { Toaster, toast } from "react-hot-toast";
import { getContract } from "@/lib/votingContract";
import { getSBTContract } from "@/lib/sbtTokenContract";
import Link from "next/link";
import { generateZKProof } from "@/lib/zkUtils";

// Loader Component
const Loader = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
  </div>
);

// Button Component
const Button = ({ onClick, disabled = false, loading = false, className = "", children }: any) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`px-4 py-2 rounded ${disabled ? "bg-gray-300 cursor-not-allowed" : "bg-black text-white hover:bg-gray-800"
      } transition-colors ${className}`}
  >
    {loading ? <Loader /> : children}
  </button>
);

// Types
interface Candidate {
  id: number;
  name: string;
  details: string;
  voteCount: number;
}

interface Application {
  applicant: string;
  name: string;
  details: string;
  processed: boolean;
  approved: boolean;
}

interface ElectionDetails {
  name: string;
  isActive: boolean;
  isCompleted: boolean;
  startTime: number;
  endTime: number;
  candidates: Candidate[];
  applications: Application[];
  voterCount: number;
}

export default function ElectionDetailsPage() {
  // State Management
  const params = useParams();
  const router = useRouter();
  const [electionId, setElectionId] = useState<number | null>(null);
  const [electionDetails, setElectionDetails] = useState<ElectionDetails>({
    name: "",
    isActive: false,
    isCompleted: false,
    startTime: 0,
    endTime: 0,
    candidates: [],
    applications: [],
    voterCount: 0,
  });

  // Form States
  const [applicationName, setApplicationName] = useState("");
  const [applicationDetails, setApplicationDetails] = useState("");

  // User States
  const [isAdmin, setIsAdmin] = useState(false);
  const [userAddress, setUserAddress] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  // Contract States
  const [votingContract, setVotingContract] = useState<Contract | null>(null);
  const [voterSBTContract, setVoterSBTContract] = useState<Contract | null>(null);
  const [nullifierHash, setNullifierHash] = useState<bigint | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [processingApplications, setProcessingApplications] = useState<{ [key: string]: boolean }>({});
  const [isStartingElection, setIsStartingElection] = useState(false);
  const [isStoppingElection, setIsStoppingElection] = useState(false);
  const [votingCandidateId, setVotingCandidateId] = useState<number | null>(null);

  // Initialize Contract and Load Data
  useEffect(() => {
    if (params.id) {
      const id = typeof params.id === 'string' ? Number(params.id) : Number(params.id[0]);
      setElectionId(id);
      initializeContract();
    }
  }, [params.id]);

  // Add this useEffect hook after your other useEffect hooks
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      // Handler for account changes
      const handleAccountsChanged = async (accounts : any) => {
        if (accounts.length === 0) {
          // User disconnected all accounts
          toast.error("Please connect to MetaMask");
          router.push('/'); // Redirect to home or connect page
        } else {
          // User switched accounts
          const newAddress = accounts[0];
          if (newAddress.toLowerCase() !== userAddress.toLowerCase()) {
            setUserAddress(newAddress);
            toast.success("Account changed. Refreshing data...");

            // Re-initialize with new account
            if (votingContract && voterSBTContract && electionId !== null) {
              await loadElectionDetails(votingContract, voterSBTContract, electionId, newAddress);
            }
          }
        }
      };

      // Handler for chain changes
      const handleChainChanged = () => {
        // Reload the page when chain changes
        window.location.reload();
      };

      // Subscribe to events
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      // Clean up event listeners
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [userAddress, votingContract, voterSBTContract, electionId, router]);

  const initializeContract = async () => {
    try {
      setIsLoading(true);
      const contract = await getContract();
      setVotingContract(contract);
      const sbtContract = await getSBTContract();
      setVoterSBTContract(sbtContract);

      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        const userAddr = accounts[0].address;
        setUserAddress(userAddr);
        const id = typeof params.id === 'string' ? Number(params.id) : Number(params.id[0]);
        await loadElectionDetails(contract, sbtContract, id, userAddr);
      }
    } catch (error) {
      console.error("Failed to initialize:", error);
      toast.error("Failed to load election details");
    } finally {
      setIsLoading(false);
    }
  };

  const loadElectionDetails = async (contract: Contract, sbtContract: Contract, id: number, userAddr: string) => {
    try {
      // Load basic election info
      const election = await contract.elections(id);
      setIsAdmin(election.admin.toLowerCase() === userAddr.toLowerCase());

      // Load candidates
      const [ids, addresses, names, details, voteCounts] = await contract.getCandidates(id);
      const candidatesList = ids.map((id: bigint, index: number) => ({
        id: Number(id),
        name: names[index],
        details: details[index],
        voteCount: election.isCompleted ? Number(voteCounts[index]) : 0,
      }));

      // Load applications
      let applications = [];
      if (userAddr.toLowerCase() === election.admin.toLowerCase()) {
        const applicationsCount = await contract.getApplicationsCount(id);
        for (let i = 0; i < Number(applicationsCount); i++) {
          const [applicant, name, details, processed, approved] = await contract.getApplicationDetails(id, i);
          applications.push({ applicant, name, details, processed, approved });
          if (applicant.toLowerCase() === userAddr.toLowerCase()) {
            setHasApplied(true);
          }
        }
      } else {
        const hasApplied = await contract.hasApplied(id, userAddr.toLowerCase());
        console.log(hasApplied);
        setHasApplied(hasApplied);
      }

      // Load voter info
      const voterCount = await contract.getVoterCount(id);
      const [startTime, endTime] = await contract.getElectionTimes(id);

      setElectionDetails({
        name: election.name,
        isActive: election.isActive,
        isCompleted: election.isCompleted,
        startTime: Number(startTime),
        endTime: Number(endTime),
        candidates: candidatesList,
        applications,
        voterCount: Number(voterCount),
      });

      // Check voter status
      const isRegistered = await sbtContract.isRegisteredVoter(userAddr);
      if (isRegistered) {
        const userNullifier = await sbtContract.getNullifierByAddress(userAddr);
        if (userNullifier) {
          setNullifierHash(userNullifier);
          const isVoted = await contract.isVoted(id, userNullifier);
          setHasVoted(isVoted);
        }
      }
    } catch (error) {
      console.error("Error loading election details:", error);
      toast.error("Failed to load election details");
    }
  };

  // Application Handling
  const handleApplyAsCandidate = async () => {
    if (!applicationName.trim() || !applicationDetails.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setIsApplying(true);
      const tx = await votingContract?.applyAsCandidate(
        electionId,
        applicationName,
        applicationDetails
      );
      toast.loading("Submitting application...");
      await tx.wait();
      toast.dismiss();
      toast.success("Application submitted successfully");
      setApplicationName("");
      setApplicationDetails("");
      setHasApplied(true);
      await loadElectionDetails(votingContract as Contract, voterSBTContract as Contract, electionId as number, userAddress);
    } catch (error) {
      console.error("Error applying as candidate:", error);
      toast.error("Failed to submit application");
    } finally {
      setIsApplying(false);
    }
  };

  // Then update the handler function:
  const handleProcessApplication = async (applicant: string, approved: boolean) => {
    try {
      // Create a unique key for this applicant+action combination
      const actionKey = `${applicant}-${approved ? 'approve' : 'reject'}`;

      setProcessingApplications(prev => ({ ...prev, [actionKey]: true }));
      const tx = await votingContract?.processApplication(electionId, applicant, approved);
      toast.loading(`${approved ? 'Approving' : 'Rejecting'} application...`);
      await tx.wait();
      toast.dismiss();
      toast.success(`Application ${approved ? 'approved' : 'rejected'} successfully`);
      await loadElectionDetails(votingContract as Contract, voterSBTContract as Contract, electionId as number, userAddress);
    } catch (error) {
      console.error("Error processing application:", error);
      toast.error("Failed to process application");
    } finally {
      const actionKey = `${applicant}-${approved ? 'approve' : 'reject'}`;
      setProcessingApplications(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // Election Control Functions
  const handleStartElection = async () => {
    try {
      setIsStartingElection(true);
      const tx = await votingContract?.startElection(electionId);
      toast.loading("Starting election...");
      await tx.wait();
      toast.dismiss();
      toast.success("Election started successfully");
      await loadElectionDetails(votingContract as Contract, voterSBTContract as Contract, electionId as number, userAddress);
    } catch (error) {
      console.error("Error starting election:", error);
      toast.error("Failed to start election");
    } finally {
      setIsStartingElection(false);
    }
  };

  const handleStopElection = async () => {
    try {
      setIsStoppingElection(true);
      const tx = await votingContract?.stopElection(electionId);
      toast.loading("Ending election...");
      await tx.wait();
      toast.dismiss();
      toast.success("Election ended successfully");
      await loadElectionDetails(votingContract as Contract, voterSBTContract as Contract, electionId as number, userAddress);
    } catch (error) {
      console.error("Error stopping election:", error);
      toast.error("Failed to end election");
    } finally {
      setIsStoppingElection(false);
    }
  };

  const handleVote = async (candidateId: number) => {
    try {
      setVotingCandidateId(candidateId);
      toast.loading("Preparing your anonymous vote...");

      const tokenId = await voterSBTContract?.getTokenIdByAddress(userAddress);
      const { proof } = await generateZKProof(tokenId, electionId as number);
      const currentNullifierHash = await voterSBTContract?.getNullifierByAddress(userAddress);

      const tx = await votingContract?.zkVote(
        electionId,
        candidateId,
        proof.a,
        proof.b,
        proof.c,
        currentNullifierHash
      );

      toast.loading("Casting your anonymous vote...");
      await tx.wait();
      toast.dismiss();
      toast.success("Vote cast successfully!");

      await loadElectionDetails(votingContract as Contract, voterSBTContract as Contract, electionId as number, userAddress);
      setHasVoted(true);
    } catch (error) {
      console.error("Error casting vote:", error);
      toast.error("Failed to cast vote");
    } finally {
      setVotingCandidateId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Not set";
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
        <p className="ml-2">Loading election details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/dashboard/election" className="inline-flex items-center text-gray-600 hover:text-black transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Elections
        </Link>
      </div>

      {/* Election Header */}
      <div className="bg-white shadow-md rounded-xl p-8 mb-8">
        <h1 className="text-3xl font-bold mb-6 border-b pb-4">{electionDetails.name}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="flex items-center mb-3">
              <span className="text-gray-700 font-medium w-32">Status:</span>
              <span className={`font-semibold px-3 py-1 rounded-full text-sm ${electionDetails.isCompleted ? "bg-gray-200 text-gray-800" :
                electionDetails.isActive ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}>
                {electionDetails.isCompleted ? "Completed" :
                  electionDetails.isActive ? "Active" : "Not Started"}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-700 font-medium w-32">Total Voters:</span>
              <span className="font-semibold">{electionDetails.voterCount}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center mb-3">
              <span className="text-gray-700 font-medium w-32">Start Time:</span>
              <span className="font-semibold">{formatDate(electionDetails.startTime)}</span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-700 font-medium w-32">End Time:</span>
              <span className="font-semibold">{formatDate(electionDetails.endTime)}</span>
            </div>
          </div>
        </div>

        {/* Application Form */}
        {electionDetails && !electionDetails.isActive && !electionDetails.isCompleted && !hasApplied && !isAdmin && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-md">
            <h2 className="text-xl font-bold mb-6">Apply as Candidate</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={applicationName}
                  onChange={(e) => setApplicationName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Details
                </label>
                <textarea
                  value={applicationDetails}
                  onChange={(e) => setApplicationDetails(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  placeholder="Tell us about yourself"
                  rows={4}
                />
              </div>
              <Button
                onClick={handleApplyAsCandidate}
                loading={isApplying}
                disabled={!applicationName.trim() || !applicationDetails.trim()}
                className="w-full py-3 bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-all"
              >
                Submit Application
              </Button>
            </div>
          </div>
        )}

        {/* Admin Application Management */}
        {electionDetails && isAdmin && !electionDetails.isActive && !electionDetails.isCompleted && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-lg">
            <h2 className="text-xl font-bold mb-6">Candidate Applications</h2>
            {electionDetails.applications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No applications submitted yet</p>
              </div>
            ) : (
              <div className="space-y-5">
                {electionDetails.applications.map((application, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-gray-50">
                    <h3 className="font-semibold text-lg mb-1">{application.name}</h3>
                    <p className="text-gray-600 mb-4">{application.details}</p>
                    {!application.processed && (
                      <div className="flex space-x-3">
                        <Button
                          onClick={() => handleProcessApplication(application.applicant, true)}
                          loading={processingApplications[`${application.applicant}-approve`]}
                          className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg px-4 py-2 transition-all"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleProcessApplication(application.applicant, false)}
                          loading={processingApplications[`${application.applicant}-reject`]}
                          className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg px-4 py-2 transition-all"
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {application.processed && (
                      <span className={`inline-block px-3 py-1 rounded-full text-sm ${application.approved ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {application.approved ? "Approved" : "Rejected"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
              <Button
                onClick={handleStartElection}
                loading={isStartingElection}
                disabled={electionDetails.candidates.length === 0}
                className="w-full py-3 bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Start Election
              </Button>
              {electionDetails.candidates.length === 0 && (
                <p className="text-red-600 text-sm mt-2 text-center">
                  Please approve at least one candidate to start the election
                </p>
              )}
            </div>
          </div>
        )}

        {/* Admin Stop Controls */}
        {electionDetails && isAdmin && electionDetails.isActive && !electionDetails.isCompleted && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-lg">
            <h2 className="text-xl font-bold mb-6">Admin Controls</h2>
            <Button
              onClick={handleStopElection}
              loading={isStoppingElection}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all"
            >
              End Election
            </Button>
          </div>
        )}

        {/* Voting Interface */}
        {electionDetails && electionDetails.isActive && !electionDetails.isCompleted && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-6">Cast Your Vote</h2>
            {hasVoted ? (
              <div className="bg-green-50 border border-green-100 p-6 rounded-xl text-center shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-800 font-medium">
                  Thank you for voting! Your vote has been recorded anonymously.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {electionDetails.candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="bg-white border border-gray-200 hover:border-black rounded-xl p-6 hover:shadow-md transition-all"
                  >
                    <h3 className="font-semibold text-lg mb-3">{candidate.name}</h3>
                    <p className="text-gray-600 mb-6">{candidate.details}</p>
                    <Button
                      onClick={() => handleVote(candidate.id)}
                      loading={votingCandidateId === candidate.id}
                      className="w-full py-3 bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-all"
                    >
                      Vote for {candidate.name}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results Display */}
        {electionDetails && electionDetails.isCompleted && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-lg">
            <h2 className="text-xl font-bold mb-6">Election Results</h2>

            {electionDetails.voterCount === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium">No votes were cast in this election.</p>
              </div>
            ) : (
              <>
                <div className="space-y-6 mb-8">
                  {electionDetails.candidates.map((candidate) => {
                    const percentage = electionDetails.voterCount > 0
                      ? ((candidate.voteCount / electionDetails.voterCount) * 100).toFixed(1)
                      : "0";

                    const isWinner = candidate.voteCount === Math.max(...electionDetails.candidates.map(c => c.voteCount)) && candidate.voteCount > 0;

                    return (
                      <div key={candidate.id} className={`p-5 rounded-lg ${isWinner ? 'bg-gray-50 border border-gray-200' : ''}`}>
                        <div className="flex justify-between mb-2">
                          <span className={`font-semibold text-lg ${isWinner ? 'text-black' : 'text-gray-700'}`}>
                            {candidate.name}
                            {isWinner && (
                              <span className="ml-2 text-sm bg-black text-white px-2 py-1 rounded">Winner</span>
                            )}
                          </span>
                          <span className="font-medium">{candidate.voteCount} votes ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full ${isWinner ? 'bg-black' : 'bg-gray-400'}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-center pt-6 border-t border-gray-200">
                  {(() => {
                    const maxVotes = Math.max(...electionDetails.candidates.map(c => c.voteCount));
                    const winners = electionDetails.candidates.filter(c => c.voteCount === maxVotes);

                    if (winners.length > 1) {
                      return (
                        <div>
                          <h3 className="text-xl font-bold mb-2">It's a tie!</h3>
                          <p className="text-gray-700">
                            {winners.map(w => w.name).join(' and ')} have tied with {maxVotes} votes each.
                          </p>
                        </div>
                      );
                    } else if (winners.length === 1) {
                      return (
                        <div>
                          <h3 className="text-xl font-bold mb-2">Winner: {winners[0].name}</h3>
                          <p className="text-gray-700">
                            With {winners[0].voteCount} votes
                            ({((winners[0].voteCount / electionDetails.voterCount) * 100).toFixed(1)}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}