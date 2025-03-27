import React, { useState } from 'react';
import { getContract } from '@/lib/votingContract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';

const CreateElectionForm: React.FC = () => {
  const [electionName, setElectionName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [eligibilityRules, setEligibilityRules] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitStep, setSubmitStep] = useState<'idle' | 'submitting' | 'mining' | 'success'>('idle');

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!electionName.trim()) {
      toast.error("Election name is required");
      return;
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      toast.error("End date must be after start date");
      return;
    }

    try {
      setIsLoading(true);
      setSubmitStep('submitting');
      
      const contract = await getContract();
      toast.loading("Submitting transaction...");
      
      // Only send the election name to the blockchain
      const tx = await contract.createElection(electionName);
      
      setSubmitStep('mining');
      toast.loading("Waiting for confirmation...");
      
      await tx.wait();
      
      setSubmitStep('success');
      toast.success('Election created successfully!');
      
      // Save all additional details to local storage or database
      const electionDetails = {
        name: electionName,
        description: description,
        startDate: startDate,
        endDate: endDate,
        eligibilityRules: eligibilityRules,
        createdAt: new Date().toISOString(),
        txHash: tx.hash
      };
      
      // Here you would typically save the additional details to your backend
      console.log('Election details:', electionDetails);
      
      // Reset form
      setElectionName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setEligibilityRules('');
    } catch (error) {
      console.error('Error creating election:', error);
      toast.error('Failed to create election.');
    } finally {
      setIsLoading(false);
      setSubmitStep('idle');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-md border border-gray-200">
      <CardHeader className="bg-white border-b border-gray-200">
        <CardTitle className="text-xl font-semibold text-black">Create New Election</CardTitle>
      </CardHeader>
      
      <form onSubmit={handleCreateElection}>
        <CardContent className="space-y-4 pt-6 bg-white">
          <div className="space-y-2">
            <Label htmlFor="election-name" className="font-medium text-black">Election Name*</Label>
            <Input
              id="election-name"
              type="text"
              value={electionName}
              onChange={(e) => setElectionName(e.target.value)}
              placeholder="Enter election name"
              disabled={isLoading}
              required
              className="w-full border-gray-300 focus:border-black focus:ring-black"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="election-description" className="font-medium text-black">Description</Label>
            <Textarea
              id="election-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter election description"
              disabled={isLoading}
              className="w-full min-h-24 border-gray-300 focus:border-black focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="font-medium text-black">Start Date & Time</Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isLoading}
                className="w-full border-gray-300 focus:border-black focus:ring-black"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end-date" className="font-medium text-black">End Date & Time</Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isLoading}
                className="w-full border-gray-300 focus:border-black focus:ring-black"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="eligibility-rules" className="font-medium text-black">Eligibility Rules</Label>
            <Textarea
              id="eligibility-rules"
              value={eligibilityRules}
              onChange={(e) => setEligibilityRules(e.target.value)}
              placeholder="Define who can vote in this election"
              disabled={isLoading}
              className="w-full min-h-20 border-gray-300 focus:border-black focus:ring-black"
            />
          </div>
          
          <p className="text-xs text-gray-600 italic">
            *Note: Only the election name will be stored on the blockchain. All other details will be stored off-chain.
          </p>
        </CardContent>
        
        <CardFooter className="border-t border-gray-200 p-4 bg-white">
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full bg-black hover:bg-gray-800 text-white font-medium py-2"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                {submitStep === 'submitting' && 'Preparing Transaction...'}
                {submitStep === 'mining' && 'Confirming Transaction...'}
                {submitStep === 'success' && 'Success!'}
              </div>
            ) : (
              'Create Election'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default CreateElectionForm;