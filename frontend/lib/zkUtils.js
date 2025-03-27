import { groth16 } from 'snarkjs';

export async function generateZKProof(tokenId, electionId) {
  try {
    // Convert inputs to proper format
    const input = {
      tokenId: tokenId.toString(),
      electionId: electionId.toString()
    };

    const { proof, publicSignals } = await groth16.fullProve(
      input,
      "/circuit/vote_circuit.wasm",  
      "/circuit/circuit_final.zkey"  
    );
    console.log("Proof generated successfully");
    // Format the proof for the smart contract
    const solProof = {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
      ],
      c: [proof.pi_c[0], proof.pi_c[1]]
    };

    // The nullifier hash is the last element in publicSignals
    const nullifierHash = publicSignals[0];

    return {
      proof: solProof,
      nullifierHash
    };
  } catch (error) {
    console.error("Error generating ZK proof:", error);
    throw error;
  }
}