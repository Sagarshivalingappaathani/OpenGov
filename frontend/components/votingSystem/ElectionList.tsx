import React, { useState, useEffect } from 'react';
import { getContract } from '@/lib/votingContract'; // Update this path

// Add interface for Election type
interface Election {
  id: number;
  name: string;
  admin: string;
  isActive: boolean;
  isCompleted: boolean;
  candidateCount: number;
}

const ElectionsList = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch just one election at a time
  const fetchOneElection = async (id: number): Promise<Election> => {
    try {
      const contract = await getContract();
      const election = await contract.elections(id);
      console.log(election);
      return {
        id,
        name: election.name,
        admin: election.admin,
        isActive: election.isActive,
        isCompleted: election.isCompleted,
        candidateCount: parseInt(election.candidateCount.toString())
      };
    } catch (err: any) {
      console.error(`Error fetching election ${id}:`, err);
      throw err;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchElection = async () => {
      try {
        setLoading(true);

        // Fetch just the current election by ID
        const election = await fetchOneElection(currentPage);
        if(election.name === '') {
          setHasMore(false);
        }

        if (isMounted && hasMore) {
          setElections((prev: Election[]) => [...prev, election]);
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error("Error fetching election:", err);
        if (isMounted) {
          // If we get an error for an ID that doesn't exist, we've reached the end
          if (err instanceof Error && (
            err.message.includes("invalid array access") ||
            err.message.includes("out of bounds") ||
            err.message.includes("revert"))) {
            setHasMore(false);
          } else {
            setError(`Failed to load election #${currentPage}. ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
          setLoading(false);
        }
      }
    };

    // Only fetch if there might be more elections
    if (hasMore) {
      fetchElection();
    }

    return () => {
      isMounted = false;
    };
  }, [currentPage]);

  const loadNext = () => {
    if (!loading && hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // Try the same election ID again
    const timeoutId = setTimeout(() => {
      setLoading((prevLoading: boolean) => {
        if (prevLoading) {
          return prevLoading;
        }
        return true;
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Election List</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && elections.length === 0 && !hasMore && (
        <p className="text-gray-600">No elections found.</p>
      )}

      {elections.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border-b text-left">ID</th>
                <th className="py-2 px-4 border-b text-left">Name</th>
                <th className="py-2 px-4 border-b text-left">Admin</th>
                <th className="py-2 px-4 border-b text-center">Status</th>
                <th className="py-2 px-4 border-b text-center">Candidates</th>
                <th className="py-2 px-4 border-b text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {elections.map((election) => (
                <tr key={election.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{election.id}</td>
                  <td className="py-2 px-4 border-b font-medium">{election.name}</td>
                  <td className="py-2 px-4 border-b text-sm">
                    {election.admin.substring(0, 6)}...{election.admin.substring(38)}
                  </td>
                  <td className="py-2 px-4 border-b text-center">
                    {election.isCompleted ? (
                      <span className="bg-gray-200 text-gray-800 py-1 px-2 rounded-full text-xs">Completed</span>
                    ) : election.isActive ? (
                      <span className="bg-green-200 text-green-800 py-1 px-2 rounded-full text-xs">Active</span>
                    ) : (
                      <span className="bg-yellow-200 text-yellow-800 py-1 px-2 rounded-full text-xs">Pending</span>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b text-center">{election.candidateCount}</td>
                  <td className="py-2 px-4 border-b text-center">
                    <button
                      className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm mr-2"
                      onClick={() => window.location.href = `/dashboard/election/${election.id}`}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-center">
            {loading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse mr-2"></div>
                <p>Loading...</p>
              </div>
            ) : hasMore ? (
              <button
                onClick={loadNext}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
              >
                Load More
              </button>
            ) : (
              <p className="text-gray-600">All elections loaded</p>
            )}
          </div>
        </div>
      )}

      {/* Show load first election button if no elections loaded yet */}
      {!loading && elections.length === 0 && !error && (
        <button
          onClick={loadNext}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Load First Election
        </button>
      )}
    </div>
  );
};

export default ElectionsList;