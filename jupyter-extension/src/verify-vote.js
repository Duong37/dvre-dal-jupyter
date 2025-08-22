// Quick vote verification script
// Usage: Open browser console and paste this code

async function verifyVote(sampleId, expectedVoter, expectedLabel) {
    try {
        const projectAddress = "0xD5b7B7c5673a86366f3f8203aD66dcE7FBEfb82A";
        const provider = new ethers.BrowserProvider(window.ethereum);
        
        // Connect to project contract (you'll need the ABI)
        console.log(`Verifying vote for sample: ${sampleId}`);
        console.log(`👤 Expected voter: ${expectedVoter}`);
        console.log(`Expected label: ${expectedLabel}`);
        
        // Check events (requires contract ABI)
        console.log("Vote verification script ready!");
        console.log("Note: Full verification requires contract ABIs");
        
        return {
            status: "ready",
            sampleId,
            expectedVoter,
            expectedLabel,
            instructions: [
                "1. Import contract ABIs",
                "2. Query VoteSubmitted events",
                "3. Check ALProjectStorage for final results"
            ]
        };
        
    } catch (error) {
        console.error(" Verification failed:", error);
        return { error: error.message };
    }
}

// Test with your actual vote
verifyVote(
    "sample_1_1_1753835455533", 
    "0x7387059e7dc85391f0bf04ecc349d0d955636282", 
    "yes"
);
