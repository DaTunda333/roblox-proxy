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
    cache[key] = { data, timestamp: Date.now() };
}

// Get game passes for a userId
app.get("/passes/:userId", async (req, res) => {
    const userId = req.params.userId;

    const cached = getCached("passes_" + userId);
    if (cached) {
        console.log("Cache hit for userId:", userId);
        return res.json(cached);
    }

    try {
        // Fetch user's public games
        const gamesRes = await axios.get(
            `https://games.roblox.com/v2/users/${userId}/games?limit=50&accessFilter=Public`
        );

        const games = gamesRes.data.data || [];

        console.log("Found games:", games.length);

        const passPromises = games.map(async (game) => {
            try {
                // ✅ FIX: use game.id (Universe ID), NOT rootPlace.id
                const passRes = await axios.get(
                    `https://games.roblox.com/v1/games/${game.id}/game-passes?limit=100&sortOrder=Asc`
                );

                return (passRes.data.data || []).map(pass => ({
                    id: pass.id,
                    name: pass.name,
                    price: pass.price,
                    displayPrice: pass.price ? pass.price + " R$" : "Free",
                    gameName: game.name,
                    gameId: game.id,
                }));
            } catch (err) {
                console.log("Failed to fetch passes for game:", game.id);
                return [];
            }
        });

        const allPassArrays = await Promise.all(passPromises);

        const allPasses = allPassArrays
            .flat()
            // OPTIONAL: keep all passes (including free ones for testing)
            .filter(p => p.price != null);

        const result = { passes: allPasses };

        setCache("passes_" + userId, result);

        res.json(result);

    } catch (e) {
        console.error("ERROR:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get("/", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => console.log("Proxy running on port " + PORT));