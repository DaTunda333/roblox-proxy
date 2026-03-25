const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory cache
const cache = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
    const entry = cache[key];
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
        delete cache[key];
        return null;
    }

    return entry.data;
}

function setCache(key, data) {
    cache[key] = {
        data,
        timestamp: Date.now()
    };
}

// ✅ MAIN ENDPOINT (PLS DONATE METHOD)
app.get("/passes/:userId", async (req, res) => {
    const userId = req.params.userId;

    // Check cache
    const cached = getCached("passes_" + userId);
    if (cached) {
        console.log("Cache hit:", userId);
        return res.json(cached);
    }

    try {
        let cursor = null;
        let allPasses = [];

        do {
            let url = `https://inventory.roblox.com/v1/users/${userId}/items/GamePass?limit=100`;
            if (cursor) url += `&cursor=${cursor}`;

            const response = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json"
                }
            });

            const data = response.data;

            const passes = (data.data || []).map(item => ({
                id: item.id,
                name: item.name,
                price: item.price ?? null,
                displayPrice: item.price ? item.price + " R$" : "Offsale/Hidden"
            }));

            allPasses.push(...passes);
            cursor = data.nextPageCursor;

        } while (cursor);

        console.log("Fetched passes:", allPasses.length);

        const result = { passes: allPasses };

        setCache("passes_" + userId, result);

        res.json(result);

    } catch (err) {
        console.error("ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get("/", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});