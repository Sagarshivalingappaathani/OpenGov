"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Coins, Wallet, Vote } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  const checkIfWalletIsConnected = async () => {
    try {
      if (!window.ethereum) return;

      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setIsConnected(true);
        setAccount(accounts[0]);
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged);
    } catch (error) {
      console.error("Error checking wallet connection:", error);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setIsConnected(false);
      setAccount(null);
    } else {
      setIsConnected(true);
      setAccount(accounts[0]);
    }
  };

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setIsConnected(true);
      setAccount(accounts[0]);
    } catch (error) {
      console.error("Error connecting wallet:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col md:flex-row md:items-center md:gap-12">
          {/* Left side content */}
          <div className="flex-1 space-y-6 mb-8 md:mb-0">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mb-2">
              <CheckCircle className="w-4 h-4 mr-2" />
              Blockchain Powered Governance
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
              Open Government: <span className="text-blue-600">Transparency & Trust</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 max-w-xl">
              A decentralized platform that revolutionizes public governance through transparent voting and accountable fund management on the blockchain.
            </p>
            
            {isConnected ? (
              <div className="space-y-4 pt-2">
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm font-medium">
                    Connected: {account!.slice(0, 6)}...{account!.slice(-4)}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/dashboard/fund-mangement">
                    <Button size="lg" className="gap-2 w-full sm:w-auto">
                      <Coins className="w-4 h-4" />
                      Fund Management
                    </Button>
                  </Link>
                  <Link href="/dashboard/home">
                    <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                      <ArrowRight className="w-4 h-4" />
                      Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Button
                size="lg"
                className="gap-2 mt-2"
                onClick={connectWallet}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    Connect Wallet
                  </>
                )}
              </Button>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-6">
              <div className="flex flex-col items-center p-3 bg-white/80 rounded-lg shadow-sm">
                <span className="font-bold text-2xl text-blue-600">100%</span>
                <span className="text-sm text-gray-500">Transparency</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-white/80 rounded-lg shadow-sm">
                <span className="font-bold text-2xl text-blue-600">0%</span>
                <span className="text-sm text-gray-500">Middlemen</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-white/80 rounded-lg shadow-sm">
                <span className="font-bold text-2xl text-blue-600">24/7</span>
                <span className="text-sm text-gray-500">Accessibility</span>
              </div>
            </div>
          </div>
          
          {/* Right side illustration */}
          <div className="flex-1 relative">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Public Treasury</h3>
                <div className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm">Live</div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Funds</span>
                  <span className="font-bold">125.45 ETH</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Vote className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Active Votes</span>
                    </div>
                    <span className="text-xl font-bold">12</span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Coins className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Proposals</span>
                    </div>
                    <span className="text-xl font-bold">24</span>
                  </div>
                </div>
                
                <div className="pt-2">
                  <div className="flex items-center justify-between py-2 border-t border-gray-100">
                    <span className="text-sm">Road Construction</span>
                    <span className="text-sm font-medium">15.5 ETH</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-gray-100">
                    <span className="text-sm">Community Garden</span>
                    <span className="text-sm font-medium">5.2 ETH</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-gray-100">
                    <span className="text-sm">Public WiFi</span>
                    <span className="text-sm font-medium">8.7 ETH</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -z-10 -top-6 -right-6 w-24 h-24 bg-blue-200 rounded-full opacity-60"></div>
            <div className="absolute -z-10 -bottom-4 -left-4 w-16 h-16 bg-indigo-200 rounded-full opacity-60"></div>
          </div>
        </div>
        
        {/* Features section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/90 p-5 rounded-lg shadow-sm">
            <div className="inline-flex items-center justify-center p-2 bg-blue-100 rounded-lg mb-4">
              <Vote className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold mb-2">Decentralized Voting</h3>
            <p className="text-gray-600">Secure, transparent voting with immutable records that can't be manipulated.</p>
          </div>
          
          <div className="bg-white/90 p-5 rounded-lg shadow-sm">
            <div className="inline-flex items-center justify-center p-2 bg-blue-100 rounded-lg mb-4">
              <Coins className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold mb-2">Public Fund Management</h3>
            <p className="text-gray-600">Track every transaction and fund allocation with complete transparency.</p>
          </div>
          
          <div className="bg-white/90 p-5 rounded-lg shadow-sm">
            <div className="inline-flex items-center justify-center p-2 bg-blue-100 rounded-lg mb-4">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold mb-2">Community Governance</h3>
            <p className="text-gray-600">Participate in proposal creation and decision-making processes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}