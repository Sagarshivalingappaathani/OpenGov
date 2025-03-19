import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const useMetaMask = () => {
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);

  const getCurrentAddress = async () => {
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Please install MetaMask!');
      }
      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      setCurrentAddress(accounts[0]);
      return accounts[0];
    } catch (error) {
      console.error('Error getting address:', error);
      toast.error('Failed to connect to MetaMask. Please make sure it\'s installed and connected.');
      return null;
    }
  };

  return { currentAddress, getCurrentAddress };
};

const useElectionData = (getContract: Function, electionId: number, currentAddress: string) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [election, setElection] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [voters, setVoters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadElectionData = async () => {
    setLoading(true);
    setError('');

    try {
      const contract = await getContract();
      const electionData = await contract.elections(electionId);
      setElection(electionData);
      console.log(electionData.admin);
      console.log(currentAddress);
      if (electionData.admin === currentAddress) {
        setIsAdmin(true);
      }
      const [ids, names, voteCounts] = await contract.getCandidates(electionId);
      setCandidates(ids.map((id: any, index: number) => ({
        id: Number(id),
        name: names[index],
        votes: Number(voteCounts[index])
      })));

      const votersList = await contract.getVoters(electionId);
      setVoters(votersList);
    } catch (error) {
      console.error('Error loading election data:', error);
      setError('Failed to load election data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadElectionData();
  }, [electionId]);

  return {isAdmin, election, candidates, voters, loading, error, loadElectionData };
};

const useElectionActions = (getContract: Function, electionId: number, loadElectionData: Function) => {
  const addCandidate = async (name: string) => {
    if (!name.trim()) return toast.error('Candidate name cannot be empty.');

    try {
      const contract = await getContract();
      const tx = await contract.addCandidate(electionId, name);
      await tx.wait();
      toast.success(`Candidate "${name}" added successfully!`);
      loadElectionData();
    } catch (error) {
      console.error('Error adding candidate:', error);
      toast.error('Failed to add candidate. Make sure youre the admin.');
    }
  };

  const startElection = async (electionId: number) => {
    try {
      const contract = await getContract();
      const tx = await contract.startElection(electionId);
      await tx.wait();
      toast.success('Election started successfully!');
      loadElectionData();
    } catch (error) {
      console.error('Failed to start election:', error);
      toast.error('Failed to start election.');
    }
  };

  const stopElection = async (electionId: number) => {
    try {
      const contract = await getContract();
      const tx = await contract.stopElection(electionId);
      await tx.wait();
      toast.success('Election stopped successfully!');
      loadElectionData();
    } catch (error) {
      console.error('Failed to stop election:', error);
      toast.error('Failed to stop election.');
    }
  };

  const voteForCandidate = async (candidateId: number) => {
    try {
      const contract = await getContract();
      const tx = await contract.vote(electionId, candidateId);
      await tx.wait();
      toast.success('Vote cast successfully!');
      loadElectionData();
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to cast vote. Make sure the election is active and you havent already voted.');
    }
  };

  return { addCandidate, startElection, stopElection, voteForCandidate };
};

export { useMetaMask, useElectionData, useElectionActions };
