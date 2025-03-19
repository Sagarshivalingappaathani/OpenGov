"use client"
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getContract } from '@/lib/votingContract';
import { getSBTContract } from '@/lib/sbtTokenContract';
import { Contract, ethers } from 'ethers';
import { Home, Loader2, Users, CheckCircle, Send, Wallet, ExternalLink, UserCheck, Shield, CircleDollarSign, FileCheck } from 'lucide-react';

import { toast } from 'react-hot-toast';

// Define contract interfaces
interface Candidate {
  id: number;
  name: string;
  voteCount: number;
}

interface Election {
  id: number;
  name: string;
  admin: string;
  isActive: boolean;
  isCompleted: boolean;
  candidateCount: number;
  startTime: number;
  endTime: number;
  voterCount: number;
  candidates?: Candidate[];
}

interface SBTApplication {
  hasApplied: boolean;
  isRegistered: boolean;
}

interface TransactionState {
  [key: string]: boolean;
}

const VotingPage: React.FC = () => {
  const [isMainLoading, setIsMainLoading] = useState<boolean>(true);
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [account, setAccount] = useState<string>('');
  const [admin, setAdmin] = useState<string>('');
  const [contract, setContract] = useState<Contract | null>(null);
  const [sbtContract, setSbtContract] = useState<Contract | null>(null);
  const [newElectionName, setNewElectionName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [applications, setApplications] = useState<string[]>([]);
  const [txLoading, setTxLoading] = useState<TransactionState>({});
  const [activeTab, setActiveTab] = useState('overview');

  // SBT Application states
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [userApplication, setUserApplication] = useState<SBTApplication | null>(null);
  const [sbtLoading, setSbtLoading] = useState<boolean>(false);
  const [refreshingElections, setRefreshingElections] = useState<boolean>(false);

  const [noOfElections, setNoOfElections] = useState<number>(0);
  const [noOfActiveElections, setNoOfActiveElections] = useState<number>(0);
  const [noOfCompletedElections, setNoOfCompletedElections] = useState<number>(0);
  const [noOfVoters, setNoOfVoters] = useState<string>('');

  // Clear messages after some time
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Function to set transaction loading state
  const setTransactionLoading = (key: string, isLoading: boolean) => {
    setTxLoading(prev => ({
      ...prev,
      [key]: isLoading
    }));
  };

  // Connect to wallet and get contracts
  const connectWallet = async () => {
    setError('');
    setIsMainLoading(true);
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);

        const zkVotingContract = await getContract();
        setContract(zkVotingContract);

        const sbtTokenContract: Contract = await getSBTContract();
        setSbtContract(sbtTokenContract);
        const contractAdmin = await sbtTokenContract.getAdminAddress();
        setAdmin(contractAdmin);
        const voterCount = await sbtTokenContract.getVoterCount();
        setNoOfVoters(voterCount.toString());
        console.log(voterCount);
        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);

        setIsMainLoading(false);
      } else {
        setError('Please install MetaMask to use this application');
        toast.error('Please install MetaMask to use this application');
        setIsMainLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      toast.error(err.message || 'Failed to connect wallet');
      setIsMainLoading(false);
    }
  };

  // Handle account changes
  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setAccount('');
      setContract(null);
      setSbtContract(null);
    } else {
      setAccount(accounts[0]);
      try {
        setLoading(true);
        const zkVotingContract = await getContract();
        setContract(zkVotingContract);

        const sbtTokenContract: Contract = await getSBTContract();
        setSbtContract(sbtTokenContract);

        const contractAdmin = await sbtTokenContract.getAdminAddress();
        setAdmin(contractAdmin);
        setUserApplication(null);
        setApplications([]);
        setTxLoading({});

        await Promise.all([
          fetchElections(),
          checkSBTStatus(),
          contractAdmin.toLowerCase() === accounts[0].toLowerCase() ? getAllPendingApplications() : Promise.resolve()
        ]);

        setLoading(false);
      } catch (err: any) {
        setError('Account changed, but there was an error refreshing data');
        toast.error('Account changed, but there was an error refreshing data');
        setLoading(false);
      }
    }
  };

  // Create new election
  const createElection = async () => {
    setError('');
    setSuccess('');

    if (!newElectionName.trim()) {
      setError('Please enter an election name');
      toast.error('Please enter an election name');
      return;
    }

    if (!contract) {
      setError('Please connect your wallet first');
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setTransactionLoading('createElection', true);
      const tx = await contract.createElection(newElectionName);
      await tx.wait();
      setSuccess(`Election "${newElectionName}" created successfully!`);
      setNewElectionName('');
      fetchElections();
      toast.success('Election created successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to create election');
      toast.error(err.message || 'Failed to create election');
    } finally {
      setTransactionLoading('createElection', false);
    }
  };

  // Fetch all elections
  const fetchElections = async () => {
    if (!contract) return;

    try {
      setRefreshingElections(true);
      const electionCount = await contract.electionCount();
      const electionsList: Election[] = [];
      let noOfActiveElections = 0;
      let noOfCompletedElections = 0;
      let noOfElections = 0;
      for (let i = 1; i <= electionCount; i++) {
        const election = await contract.elections(i);
        console.log(election);
        if (election.isActive) {
          noOfActiveElections++;
          console.log('active elections');
        } else if (election.isCompleted) {
          noOfCompletedElections++;
          console.log('completed elections');
        }
        noOfElections++;
        const [ids, names, voteCounts] = await contract.getCandidates(i);
        const candidates: Candidate[] = ids.map((id: any, index: number) => ({
          id: Number(id),
          name: names[index],
          voteCount: Number(voteCounts[index])
        }));

        electionsList.push({
          id: i,
          name: election.name,
          admin: election.admin,
          isActive: election.isActive,
          isCompleted: election.isCompleted,
          candidateCount: Number(election.candidateCount),
          startTime: Number(election.startTime),
          endTime: Number(election.endTime),
          voterCount: Number(election.voterCount),
          candidates
        });
      }
      setNoOfElections(noOfElections);
      setNoOfActiveElections(noOfActiveElections);
      setNoOfCompletedElections(noOfCompletedElections);
      setElections(electionsList);
    } catch (err: any) {
      setError('Failed to load elections');
      toast.error('Failed to load elections');
    } finally {
      setRefreshingElections(false);
      setLoading(false);
    }
  };

  // Check SBT application status
  const checkSBTStatus = async () => {
    if (!sbtContract || !account) return;

    try {
      setSbtLoading(true);
      const [hasApplied, isRegistered] = await sbtContract.getApplicationStatus(account);
      setUserApplication({
        hasApplied,
        isRegistered
      });
    } catch (err) {
      setError('Error checking SBT status');
      toast.error('Error checking SBT status');
      setUserApplication(null);
    } finally {
      setSbtLoading(false);
    }
  };

  // Generate and apply for SBT token
  const applySBT = async () => {
    setError('');
    setSuccess('');

    if (!sbtContract) {
      setError('Please connect your wallet first');
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setTransactionLoading('applySBT', true);
      const dataToHash = ethers.solidityPacked(
        ['string', 'string', 'address'],
        [fullName, email, account]
      );
      const voterHash = ethers.keccak256(dataToHash);
      const tx = await sbtContract.applyForSBT(voterHash);
      await tx.wait();
      toast.success('SBT application submitted successfully');
      setSuccess('Your SBT application has been submitted successfully!');
      setFullName('');
      setEmail('');
      checkSBTStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to submit SBT application');
      toast.error('Failed to submit SBT application');
    } finally {
      setTransactionLoading('applySBT', false);
    }
  };

  const getAllPendingApplications = async () => {
    if (!sbtContract || admin.toLowerCase() !== account.toLowerCase()) return;

    try {
      setTransactionLoading('getPendingApps', true);
      const applicantCount = await sbtContract.getApplicantCount();
      console.log(applicantCount);
      const pendingApplications = [];
      for (let i = 0; i < applicantCount; i++) {
        const applicant = await sbtContract.getApplicantByIndex(i);
        console.log(i, applicant);
        const [hasApplied, isRegistered] = await sbtContract.getApplicationStatus(applicant);
        if (hasApplied && !isRegistered) {
          pendingApplications.push(applicant);
          console.log(pendingApplications);
        }
      }
      setApplications(pendingApplications);
    } catch (err: any) {
      setError('Failed to fetch pending applications');
      console.log(err)
    } finally {
      setTransactionLoading('getPendingApps', false);
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Not set';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getElectionStatus = (election: Election) => {
    if (election.isCompleted) return "Completed";
    if (election.isActive) return "Active";
    return "Pending";
  };

  const generateRandomNullifier = (): number => {
    return Math.floor(Math.random() * 1000000);
  };

  const approveApplication = async (application: string) => {
    const txKey = `approve_${application}`;
    try {
      setTransactionLoading(txKey, true);
      if (!sbtContract) {
        setError('Please connect your wallet first');
        return;
      }
      const nullifier = generateRandomNullifier();
      const tx = await sbtContract.approveApplication(application, nullifier);
      await tx.wait();
      setSuccess('Application approved successfully!');
      getAllPendingApplications();
      toast.success('Application approved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to approve application');
      toast.error('Failed to approve application');
    } finally {
      setTransactionLoading(txKey, false);
    }
  };

  useEffect(() => {
    connectWallet().then(() => {
      setLoading(false);
      setIsMainLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
      setIsMainLoading(false);
    });

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  useEffect(() => {
    if (contract) {
      fetchElections();
    }
  }, [contract]);

  useEffect(() => {
    if (sbtContract && account) {
      checkSBTStatus();
      if (admin.toLowerCase() === account.toLowerCase()) {
        getAllPendingApplications();
      }
      setIsMainLoading(false);
    }
  }, [sbtContract, account, admin]);

  if (isMainLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-lg">Loading ZK voting system...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">

        <div className="bg-white rounded-lg shadow-sm p-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              ZK Voting System
            </h1>
            <p className="text-gray-500 mt-2">Decentralized Voting System</p>
          </div>
          <div className="text-right">
            <div className="px-4 py-2 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">Connected Account</p>
              <p className="font-mono text-sm">{account.slice(0, 6)}...{account.slice(-4)}</p>
            </div>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6 flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <Tabs defaultValue="home" className="w-full">
          <TabsList className="flex w-full rounded-full bg-white shadow-sm border border-gray-100 p-0 mb-16">
            <TabsTrigger
              value="home"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-gray-500 hover:text-gray-800 transition-colors data-[state=active]:text-black data-[state=active]:bg-gray-50 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none rounded-l-full"
            >
              <Home className="w-4 h-4" />
              <span className="font-medium">Home</span>
            </TabsTrigger>

            <TabsTrigger
              value="elections"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-gray-500 hover:text-gray-800 transition-colors data-[state=active]:text-black data-[state=active]:bg-gray-50 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none"
            >
              <Send className="w-4 h-4" />
              <span className="font-medium">Elections</span>
            </TabsTrigger>

            <TabsTrigger
              value="create"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-gray-500 hover:text-gray-800 transition-colors data-[state=active]:text-black data-[state=active]:bg-gray-50 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none"
            >
              <Wallet className="w-4 h-4" />
              <span className="font-medium">Create Election</span>
            </TabsTrigger>

            <TabsTrigger
              value="sbt"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-gray-500 hover:text-gray-800 transition-colors data-[state=active]:text-black data-[state=active]:bg-gray-50 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none rounded-r-full"
            >
              <Users className="w-4 h-4" />
              <span className="font-medium">SBT</span>
            </TabsTrigger>
            {admin?.toLowerCase() === account?.toLowerCase() && (
              <TabsTrigger
                value="admin"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-gray-500 hover:text-gray-800 transition-colors data-[state=active]:text-black data-[state=active]:bg-gray-50 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none rounded-r-full"
              >
                <Users className="w-4 h-4" />
                <span className="font-medium">Admin</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="home">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Welcome to Zero Knowledge Proof Voting System
                  </CardTitle>
                  <CardDescription>
                    A decentralized system for transparent voting
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    The Zero Knowledge Proof Voting System is a decentralized application that enables transparent and secure voting through a zero knowledge proof system and SBT token.
                  </p>
                  <div className="space-y-4 mt-6">
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <Shield className="w-6 h-6 text-green-600 mt-1" />
                      <div>
                        <h3 className="font-semibold">Zero-Knowledge Voting & SBT Verification</h3>
                        <p className="text-sm text-gray-600">Anonymous voting through nullifier hashes and ZK proofs, with required Soul Bound Tokens for participation, ensuring verified users can vote securely.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <Users className="w-6 h-6 text-blue-600 mt-1" />
                      <div>
                        <h3 className="font-semibold">Candidate Application System</h3>
                        <p className="text-sm text-gray-600">Allows eligible SBT holders to apply as candidates with dedicated admin approval process, creating a fair and transparent nomination workflow.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <FileCheck className="w-6 h-6 text-purple-600 mt-1" />
                      <div>
                        <h3 className="font-semibold">Comprehensive Election Management</h3>
                        <p className="text-sm text-gray-600">Full election lifecycle from creation to results, with transparent candidate registration, configurable voting periods, and auditable outcomes.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-green-600" />
                    Current Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-600">Total Elections</p>
                      <p className="text-2xl font-bold text-yellow-700">{noOfElections.toString()}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Total Active Elections</p>
                      <p className="text-2xl font-bold text-blue-700">{noOfActiveElections.toString()}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Total Completed Elections</p>
                      <p className="text-2xl font-bold text-green-700">{noOfCompletedElections.toString()}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-600">Total Voters</p>
                      <p className="text-2xl font-bold text-red-700">{noOfVoters.toString()}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Your Role</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {admin?.toLowerCase() === account?.toLowerCase() && (
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <Shield className="w-4 h-4" />
                          <span>Contract Owner</span>
                        </div>

                      )}
                      {userApplication?.isRegistered && (
                        <div className="p-4 bg-orange-50 rounded-lg">
                          <UserCheck className="w-4 h-4" />
                          <span>Authority Member</span>
                        </div>
                      )}
                      {!userApplication?.isRegistered && (
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <Users className="w-4 h-4" />
                          <span>Regular User</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="elections">
            <Card>
              <CardHeader>
                <CardTitle>All Elections</CardTitle>
                <CardDescription>
                  View all available elections and their details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 flex flex-col items-center">
                    <Loader2 className="h-6 w-6 animate-spin mb-2" />
                    <p>Loading elections...</p>
                  </div>
                ) : elections.length === 0 ? (
                  <div className="text-center py-8 border rounded-md p-4 bg-gray-50">
                    <p>No elections found. Create one!</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Candidates</TableHead>
                          <TableHead>Votes</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {elections.map((election) => (
                          <TableRow key={election.id}>
                            <TableCell>{election.id}</TableCell>
                            <TableCell>{election.name}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 text-xs rounded-full ${election.isCompleted
                                ? 'bg-gray-100 text-gray-700'
                                : election.isActive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {getElectionStatus(election)}
                              </span>
                            </TableCell>
                            <TableCell>{election.candidateCount}</TableCell>
                            <TableCell>{election.voterCount}</TableCell>
                            <TableCell>{formatTime(election.startTime)}</TableCell>
                            <TableCell>{formatTime(election.endTime)}</TableCell>
                            <TableCell className="text-right">
                              <a
                                href={`/dashboard/election/${election.id}`}
                                className="inline-flex items-center text-blue-500 hover:text-blue-700"
                                onClick={(e) => {
                                  if (!election.id) {
                                    e.preventDefault();
                                    toast.error('Invalid election ID');
                                  }
                                }}
                              >
                                View <ExternalLink className="ml-2 h-4 w-4" />
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={fetchElections}
                  variant="outline"
                  className="w-full"
                  disabled={refreshingElections || !account}
                >
                  {refreshingElections ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing...</>
                  ) : (
                    "Refresh Elections"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create New Election</CardTitle>
                <CardDescription>
                  Set up a new election with a unique name
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="election-name">Election Name</Label>
                    <Input
                      id="election-name"
                      placeholder="Enter election name"
                      value={newElectionName}
                      onChange={(e) => setNewElectionName(e.target.value)}
                      disabled={txLoading['createElection'] || !account}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={createElection}
                  className="w-full"
                  disabled={txLoading['createElection'] || !account || !newElectionName.trim()}
                >
                  {txLoading['createElection'] ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                  ) : (
                    "Create Election"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="sbt">
            <Card>
              <CardHeader>
                <CardTitle>SBT Token Application</CardTitle>
                <CardDescription>
                  Apply for a Soul Bound Token (SBT) to participate in voting
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!account ? (
                  <div className="text-center py-4 border rounded-md p-4 bg-gray-50">
                    Please connect your wallet to apply for an SBT token.
                  </div>
                ) : sbtLoading ? (
                  <div className="text-center py-4 flex flex-col items-center">
                    <Loader2 className="h-6 w-6 animate-spin mb-2" />
                    <p>Loading your SBT status...</p>
                  </div>
                ) : userApplication?.isRegistered ? (
                  <div className="p-4 rounded text-center bg-green-50 border border-green-200 text-green-700">
                    <p className="font-medium">Your application has been approved! You can now participate in voting.</p>
                  </div>
                ) : userApplication?.hasApplied ? (
                  <div className="p-4 rounded text-center bg-yellow-50 border border-yellow-200 text-yellow-700">
                    <p className="font-medium">Your application is being reviewed. Please check back later.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Full Name</Label>
                      <Input
                        id="full-name"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={txLoading['applySBT']}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={txLoading['applySBT']}
                      />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded">
                      <p className="text-sm">
                        <strong>Note:</strong> This information is used only to generate a unique voter hash.
                        Your email is not stored on the blockchain.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
              {!userApplication?.hasApplied && account && (
                <CardFooter>
                  <Button
                    onClick={applySBT}
                    className="w-full"
                    disabled={txLoading['applySBT'] || !account || !fullName.trim() || !email.trim()}
                  >
                    {txLoading['applySBT'] ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                    ) : (
                      "Apply for SBT Token"
                    )}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
          {admin?.toLowerCase() === account?.toLowerCase() && (
            <TabsContent value="admin">
              <Card className="shadow-sm">
                <CardHeader className="border-b">
                  <CardTitle>Admin Dashboard</CardTitle>
                  <CardDescription>
                    Manage pending applications and elections
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <Label htmlFor="pending-applications">Pending Applications</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={getAllPendingApplications}
                          disabled={txLoading['getPendingApps']}
                        >
                          {txLoading['getPendingApps'] ? (
                            <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Refreshing...</>
                          ) : (
                            "Refresh"
                          )}
                        </Button>
                      </div>
                      <ScrollArea className="h-48 rounded-md border">
                        {applications.length > 0 ? (
                          <div className="p-2 space-y-2">
                            {applications.map((application) => (
                              <div key={application} className="p-3 rounded bg-gray-50 border flex justify-between items-center">
                                <p className="text-sm font-medium truncate">{application}</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => approveApplication(application)}
                                  disabled={txLoading[`approve_${application}`]}
                                >
                                  {txLoading[`approve_${application}`] ? (
                                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Approving...</>
                                  ) : (
                                    "Approve"
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">No pending applications found.</div>
                        )}
                      </ScrollArea>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default VotingPage;