const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: only allow requests from Roblox servers
app.use((req, res, next) => {
    // Optional: add a secret key check for security
    // if (req.headers["x-api-key"] !== process.env.SECRET_KEY) return res.status(403).json({ error: "Forbidden" });
    next();
});

// 1. Resolve username → userId
app.get("/user/:username", async (req, res) => {
    try {
        const response = await axios.post("https://users.roblox.com/v1/usernames/users", {
            usernames: [req.params.username],
            excludeBannedUsers: true
        });
        const user = response.data.data[0];
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ id: user.id, name: user.name, displayName: user.displayName });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Get all game passes for a userId (searches across their games)
app.get("/passes/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        // Fetch user's games
        const gamesRes = await axios.get(
            `https://games.roblox.com/v2/users/${userId}/games?limit=10&accessFilter=Public`
        );
        const games = gamesRes.data.data || [];

        // For each game, fetch its game passes
        const passPromises = games.map(async (game) => {
            try {
                const passRes = await axios.get(
                    `https://games.roblox.com/v1/games/${game.rootPlace.id}/game-passes?limit=100&sortOrder=Asc`
                );
                return (passRes.data.data || []).map(pass => ({
                    id: pass.id,
                    name: pass.name,
                    price: pass.price,
                    displayPrice: pass.price ? `${pass.price} R$` : "Free",
                    imageToken: pass.imageToken,
                    gameName: game.name,
                    gameId: game.id,
                }));
            } catch {
                return [];
            }
        });

        const allPassArrays = await Promise.all(passPromises);
        const allPasses = allPassArrays
            .flat()
            .filter(p => p.price && p.price > 0); // only paid passes

        res.json({ passes: allPasses });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));