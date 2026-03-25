const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.roblox.com/"
};

const cache = {};
const CACHE_DURATION_MS = 5 * 60 * 1000;

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
    cache[key] = { data, timestamp: Date.now() };
}

app.get("/passes/:userId", async (req, res) => {
    const userId = req.params.userId;

    const cached = getCached("passes_" + userId);
    if (cached) {
        console.log("Cache hit for userId:", userId);
        return res.json(cached);
    }

    try {
        console.log(`Fetching game passes for userId: ${userId}`);

        const passRes = await axios.get(
            `https://catalog.roblox.com/v1/search/items?category=GamePass&creatorUserId=${userId}&limit=30`,
            { headers }
        );

        console.log("Catalog response:", JSON.stringify(passRes.data));

        const items = passRes.data.data || [];
        const passes = items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            displayPrice: item.price ? item.price + " R$" : "Free",
            gameName: "Game Pass",
            gameId: null,
        })).filter(p => p.price && p.price > 0);

        const result = { passes };
        setCache("passes_" + userId, result);
        res.json(result);

    } catch (e) {
        console.log("Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get("/", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => console.log("Proxy running on port " + PORT));