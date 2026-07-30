const connectBtn      = document.getElementById("connectBtn");
const walletAddress   = document.getElementById("walletAddress");
const balance         = document.getElementById("balance");
const sendBtn         = document.getElementById("sendBtn");
const transactionList = document.getElementById("transactionList");
const copyBtn         = document.getElementById("copyBtn");
const totalSupplyEl   = document.getElementById("totalSupply");
const tokenNameEl     = document.getElementById("tokenName");
const tokenSymbolEl   = document.getElementById("tokenSymbol");
const networkBadge    = document.getElementById("networkBadge");
const btnHardhat      = document.getElementById("networkHardhat");
const btnSepolia      = document.getElementById("networkSepolia");

let provider;
let signer;
let contract;

// ─── Active Network State ─────────────────────────────────────────────────────
// "hardhat" | "sepolia"  — driven by the toggle buttons in the header
let activeNetwork = "hardhat";

const transactionPoolApi = `http://${window.location.hostname}:3001`;

/** Returns chain config for the currently selected network. */
function getNetworkConfig() {
    if (activeNetwork === "sepolia") {
        return {
            chainId:         SEPOLIA_CHAIN_ID,
            chainName:       "Sepolia Testnet",
            rpcUrl:          SEPOLIA_RPC_URL,
            contractAddress: SEPOLIA_CONTRACT_ADDRESS,
            explorerUrl:     "https://sepolia.etherscan.io",
            nativeCurrency:  { name: "Ether", symbol: "ETH", decimals: 18 },
        };
    }
    return {
        chainId:         HARDHAT_CHAIN_ID,
        chainName:       "Hardhat Local",
        rpcUrl:          HARDHAT_RPC_URL,
        contractAddress: HARDHAT_CONTRACT_ADDRESS,
        explorerUrl:     "",
        nativeCurrency:  { name: "Ether", symbol: "ETH", decimals: 18 },
    };
}

/** Updates the header badge and button active states. */
function syncNetworkUI() {
    if (activeNetwork === "sepolia") {
        networkBadge.textContent = "● Sepolia";
        networkBadge.className   = "network-badge network-badge--sepolia";
        btnSepolia.className  = "net-btn net-btn--sepolia-active";
        btnHardhat.className  = "net-btn";
    } else {
        networkBadge.textContent = "● Hardhat";
        networkBadge.className   = "network-badge network-badge--hardhat";
        btnHardhat.className  = "net-btn net-btn--active";
        btnSepolia.className  = "net-btn";
    }
}

// ─── Network Toggle Buttons ───────────────────────────────────────────────────
btnHardhat.addEventListener("click", async () => {
    if (activeNetwork === "hardhat") return;
    activeNetwork = "hardhat";
    syncNetworkUI();
    resetWalletState();
    await loadTokenDetails();
});

btnSepolia.addEventListener("click", async () => {
    if (activeNetwork === "sepolia") return;
    if (!SEPOLIA_CONTRACT_ADDRESS) {
        alert("Sepolia contract not deployed yet.\n\nRun:\n  npx hardhat run scripts/deploy.js --network sepolia\n\nThen paste the address into frontend/config.js → SEPOLIA_CONTRACT_ADDRESS");
        return;
    }
    activeNetwork = "sepolia";
    syncNetworkUI();
    resetWalletState();
    await loadTokenDetails();
});

function resetWalletState() {
    provider = null;
    signer   = null;
    contract = null;
    walletAddress.innerText = "Not Connected";
    connectBtn.innerText    = "Connect Wallet";
    balance.innerText       = "0 TTZ";
}

// Event Listeners
connectBtn.addEventListener("click", connectWallet);
sendBtn.addEventListener("click", sendToken);

if (copyBtn) {
    copyBtn.addEventListener("click", () => {
        const addr = walletAddress.innerText.trim();
        if (addr && addr !== "Not Connected") {
            navigator.clipboard.writeText(addr);
            alert("Wallet address copied to clipboard!");
        } else {
            alert("No wallet connected to copy.");
        }
    });
}

if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
            connectWallet();
        } else {
            walletAddress.innerText = "Not Connected";
            connectBtn.innerText = "Connect Wallet";
            balance.innerText = "0 TTZ";
        }
    });
}

function getMetaMaskProvider() {
    const providers = window.ethereum && window.ethereum.providers;
    if (Array.isArray(providers)) {
        return providers.find((walletProvider) => walletProvider.isMetaMask) || null;
    }

    return window.ethereum && window.ethereum.isMetaMask ? window.ethereum : null;
}

/**
 * Asks MetaMask to switch to the currently selected network.
 * If the chain isn't added yet (error 4902) it adds it automatically.
 */
async function switchToActiveNetwork(metaMaskProvider) {
    const cfg = getNetworkConfig();
    try {
        await metaMaskProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: cfg.chainId }]
        });
    } catch (error) {
        if (error.code !== 4902) throw error;
        // Chain not yet in MetaMask — add it
        await metaMaskProvider.request({
            method: "wallet_addEthereumChain",
            params: [{
                chainId:         cfg.chainId,
                chainName:       cfg.chainName,
                rpcUrls:         [cfg.rpcUrl],
                nativeCurrency:  cfg.nativeCurrency,
                blockExplorerUrls: cfg.explorerUrl ? [cfg.explorerUrl] : []
            }]
        });
    }
}

async function loadTokenDetails() {
    const cfg = getNetworkConfig();
    if (!cfg.contractAddress) {
        if (totalSupplyEl) totalSupplyEl.innerText = "Deploy contract first";
        return;
    }
    try {
        const readProvider  = new ethers.providers.JsonRpcProvider(cfg.rpcUrl);
        const readContract  = new ethers.Contract(cfg.contractAddress, tokenABI, readProvider);

        const [name, symbol, decimals, supply] = await Promise.all([
            readContract.name().catch(() => "TechTamizha"),
            readContract.symbol().catch(() => "TTZ"),
            readContract.decimals().catch(() => 18),
            readContract.totalSupply().catch(() => null)
        ]);

        if (tokenNameEl)  tokenNameEl.innerText  = name;
        if (tokenSymbolEl) tokenSymbolEl.innerText = symbol;

        if (totalSupplyEl) {
            if (supply !== null) {
                const formattedSupply = ethers.utils.formatUnits(supply, decimals);
                totalSupplyEl.innerText = `${Number(formattedSupply).toLocaleString()} ${symbol}`;
            } else {
                totalSupplyEl.innerText = "Unavailable";
            }
        }
    } catch (err) {
        console.error("Error loading token details:", err);
        if (totalSupplyEl) totalSupplyEl.innerText = "Unavailable";
    }
}

async function updateBalance(address) {
    try {
        if (!contract) return;
        const decimals  = await contract.decimals().catch(() => 18);
        const ttzBalance = await contract.balanceOf(address);
        const formatted = ethers.utils.formatUnits(ttzBalance, decimals);
        balance.innerText = `${formatted} TTZ`;
    } catch (error) {
        console.error("Error fetching TTZ balance:", error);
        balance.innerText = "Error loading TTZ balance";
    }
}

async function connectWallet() {
    console.log("Connect button clicked");

    const metaMaskProvider = getMetaMaskProvider();
    if (!metaMaskProvider) {
        alert("Please install MetaMask");
        return;
    }

    const cfg = getNetworkConfig();

    // Validate Sepolia contract address before trying to connect
    if (activeNetwork === "sepolia" && !SEPOLIA_CONTRACT_ADDRESS) {
        alert("Sepolia contract not deployed yet.\n\nRun:\n  npx hardhat run scripts/deploy.js --network sepolia\n\nThen paste the address into frontend/config.js → SEPOLIA_CONTRACT_ADDRESS");
        return;
    }

    try {
        await switchToActiveNetwork(metaMaskProvider);

        // MetaMask popup
        const accounts = await metaMaskProvider.request({
            method: "eth_requestAccounts"
        });

        const address = accounts[0];
        console.log("Connected:", address);

        // Ethers provider & signer
        provider = new ethers.providers.Web3Provider(metaMaskProvider);
        signer   = provider.getSigner();

        const network = await provider.getNetwork();
        const expectedChainId = activeNetwork === "sepolia" ? 11155111 : 31337;
        if (network.chainId !== expectedChainId) {
            throw new Error(`Wrong chain. Expected ${expectedChainId}, got ${network.chainId}`);
        }
        console.log("Chain ID:", network.chainId, "| Network:", activeNetwork);

        const code = await provider.getCode(cfg.contractAddress);
        if (code === "0x") {
            throw new Error(`TTZ contract not found at ${cfg.contractAddress} on ${cfg.chainName}`);
        }

        contract = new ethers.Contract(cfg.contractAddress, tokenABI, signer);
        console.log("Contract connected:", contract.address);

        walletAddress.innerText = address;
        connectBtn.innerText    = `Connected ✅ (${activeNetwork === "sepolia" ? "Sepolia" : "Hardhat"})`;

        await updateBalance(address);
        await loadTokenDetails();

        alert(`Wallet Connected on ${cfg.chainName}!`);
        await loadPendingTransactions();
    } catch (error) {
        console.error("Connection error:", error);
        alert("Connection Failed: " + (error.message || error));
    }
}

async function sendToken() {
    const receiver = document.getElementById("receiver").value.trim();
    const amount = document.getElementById("amount").value.trim();

    if (!receiver || !amount) {
        alert("Enter receiver and amount");
        return;
    }

    if (!contract) {
        alert("Connect wallet first");
        return;
    }

    if (!ethers.utils.isAddress(receiver)) {
        alert("Invalid receiver address");
        return;
    }

    if (Number(amount) <= 0) {
        alert("Amount must be greater than 0");
        return;
    }

    try {
        const sender = await signer.getAddress();

        // 🔥 MetaMask popup
        const tx = await contract.transfer(
            receiver,
            ethers.utils.parseUnits(amount, 18)
        );

        alert("Please confirm the transaction in MetaMask...");

        // Wait until transaction is mined
        await tx.wait();

        // Add transaction to backend pool
        const response = await fetch(`${transactionPoolApi}/transaction`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sender,
                receiver,
                amount: Number(amount),
                txHash: tx.hash
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Failed to add transaction to pool");
        }

        alert(`Transaction Successful!\n\nTx Hash:\n${tx.hash}`);

        // Clear inputs
        document.getElementById("receiver").value = "";
        document.getElementById("amount").value = "";

        // Refresh UI
        await updateBalance(sender);
        await updateBalance(receiver);
        await loadPendingTransactions();

    } catch (err) {
        console.error("Transaction Error:", err);
        alert(err.reason || err.message || "Transaction Failed");
    }
}

async function loadPendingTransactions() {
    try {
        const response = await fetch(`${transactionPoolApi}/transactions`);
        const transactions = await response.json();

        if (!response.ok) {
            throw new Error("Unable to load pending transactions");
        }

        renderPendingTransactions(transactions);
    } catch (error) {
        console.log(error);
        transactionList.innerHTML = '<p class="empty-state">Transaction Pool API unavailable</p>';
    }
}

// Exposed only for the mining module to refresh the unchanged pool UI after a block commits.
window.loadPendingTransactions = loadPendingTransactions;

function renderPendingTransactions(transactions) {
    if (!transactions.length) {
        transactionList.innerHTML = '<p class="empty-state">No Pending Transactions</p>';
        return;
    }

    transactionList.innerHTML = transactions.map((transaction) => `
        <div class="transaction-item">
            <div class="transaction-details">
                <strong>${escapeHtml(transaction.amount)} TTZ</strong>
                <small><span>Sender:</span> ${escapeHtml(transaction.sender)}</small>
                <small><span>Receiver:</span> ${escapeHtml(transaction.receiver)}</small>
                <small><span>Status:</span> ${escapeHtml(transaction.status)}</small>
                <small><span>Created Time:</span> ${escapeHtml(formatCreatedTime(transaction.createdAt))}</small>
            </div>
            <button class="remove-transaction" data-id="${escapeHtml(transaction.id)}" title="Remove transaction">Remove</button>
        </div>
    `).join("");

    document.querySelectorAll(".remove-transaction").forEach((button) => {
        button.addEventListener("click", () => removeTransaction(button.dataset.id));
    });
}

async function removeTransaction(id) {
    try {
        const response = await fetch(`${transactionPoolApi}/transaction/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            throw new Error("Unable to remove transaction");
        }

        await loadPendingTransactions();
    } catch (error) {
        console.log(error);
        alert(`Transaction Pool Error: ${error.message}`);
    }
}

function formatCreatedTime(createdAt) {
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime()) ? createdAt : date.toLocaleString();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        "\"": "&quot;"
    }[character]));
}

// Initial loads
loadTokenDetails();
loadPendingTransactions();
setInterval(loadPendingTransactions, 5000);
