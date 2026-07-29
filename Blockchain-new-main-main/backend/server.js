require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const routes = require("./routes");
const rpcProxy = require("./rpcProxy");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(routes);

// Mount the Hardhat RPC proxy under the /rpc route
app.use("/rpc", rpcProxy);

app.get("/", (req, res) => {
    res.json({ message: "Transaction Pool API is running" });
});

app.listen(port, () => {
    console.log(`Transaction Pool API listening on http://localhost:${port}`);
});

module.exports = app;
