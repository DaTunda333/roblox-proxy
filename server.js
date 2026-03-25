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
        const gamesRes = await axios.get(
            `https://games.roblox.com/v2/users/${userId}/games?limit=10&accessFilter=Public`,
            { headers }
        );
        const games = gamesRes.data.data || [];
        console.log(`Found ${games.length} games for user ${userId}`);

        const passPromises = games.map(async (game) => {
            try {
                console.log(`Fetching passes for game: ${game.name} (universeId: ${game.id})`);
                const passRes = await axios.get(
                    `https://games.roblox.com/v1/games/${game.id}/game-passes?limit=100&sortOrder=Asc`,
                    { headers }
                );
                console.log(`Game ${game.name} response:`, JSON.stringify(passRes.data));
                return (passRes.data.data || []).map(pass => ({
                    id: pass.id,
                    name: pass.name,
                    price: pass.price,
                    displayPrice: pass.price ? pass.price + " R$" : "Free",
                    gameName: game.name,
                    gameId: game.id,
                }));
            } catch (e) {
                console.log(`Error fetching passes for game ${game.name}:`, e.message);
                return [];
            }
        });

        const allPassArrays = await Promise.all(passPromises);
        const allPasses = allPassArrays
            .flat()
            .filter(p => p.price && p.price > 0);

        const result = { passes: allPasses };
        setCache("passes_" + userId, result);
        res.json(result);

    } catch (e) {
        console.log("Top level error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get("/", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => console.log("Proxy running on port " + PORT));