const express = require("express");
const router = express.Router();

// Define valid API keys (in a real app, you should load these from a database or .env file)
const VALID_API_KEYS = {
    "secret-api-key-1": "Admin User",
    "secret-api-key-2": "Regular User"
};

// Target Hardhat node URL (assuming it's running locally on the AWS server)
const HARDHAT_NODE_URL = "http://127.0.0.1:8545";

// Authentication middleware
const authenticate = (req, res, next) => {
    // Check API key from URL parameter (e.g. /rpc/your-api-key)
    const apiKey = req.params.apiKey;
    
    if (!apiKey || !VALID_API_KEYS[apiKey]) {
        console.warn(`[AUTH FAILED] Unauthorized connection attempt.`);
        return res.status(401).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Unauthorized: Invalid or missing API Key" },
            id: req.body && req.body.id ? req.body.id : null
        });
    }
    
    console.log(`[AUTH SUCCESS] User '${VALID_API_KEYS[apiKey]}' authenticated.`);
    next();
};

// Proxy route to forward JSON-RPC requests to the Hardhat node
router.post("/:apiKey", authenticate, async (req, res) => {
    try {
        // Forward the request to the local Hardhat node
        const response = await fetch(HARDHAT_NODE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("[PROXY ERROR] Error proxying to Hardhat node:", error.message);
        res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal error: Could not connect to Hardhat node" },
            id: req.body && req.body.id ? req.body.id : null
        });
    }
});

module.exports = router;
