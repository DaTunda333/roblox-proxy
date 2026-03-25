const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// Cache system
// ======================
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

// ======================
// Resolve input → userId
// ======================
async function resolveUserId(input) {
    let userId;

    // Case 1: Roblox profile link
    if (input.includes("roblox.com")) {
        const match = input.match(/users\/(\d+)/);
        if (match) {
            userId = match[1];
        } else {
            throw new Error("Invalid Roblox profile link.");
        }
    }

    // Case 2: Already a userId
    else if (/^\d+$/.test(input)) {
        userId = input;
    }

    // Case 3: Username
    else {
        const res = await axios.post(
            "https://users.roblox.com/v1/usernames/users",
            {
                usernames: [input],
                excludeBannedUsers: true
            }
        );

        if (!res.data.data.length) {
            throw new Error("User not found.");
        }

        userId = res.data.data[0].id;
    }

    return userId;
}

// ======================
// MAIN ROUTE
// ======================
app.get("/passes/:input", async (req, res) => {
    const input = req.params.input;

    try {
        const userId = await resolveUserId(input);

        // Check cache
        const cached = getCached("passes_" + userId);
        if (cached) {
            console.log("Cache hit:", userId);
            return res.json({ passes: cached });
        }

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
                displayPrice: item.price ? item.price + " R$" : "Offsale"
            }));

            allPasses.push(...passes);
            cursor = data.nextPageCursor;

        } while (cursor);

        console.log("Fetched passes:", allPasses.length);

        setCache("passes_" + userId, allPasses);

        res.json({ passes: allPasses });

    } catch (err) {
        if (err.response && err.response.status === 404) {
            return res.json({ passes: [] });
        }

        console.error("ERROR:", err.message);

        res.status(500).json({
            error: err.message || "Unknown error"
        });
    }
});

// ======================
// Health check
// ======================
app.get("/", (req, res) => {
    res.json({ status: "ok" });
});

// ======================
// Start server
// ======================
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});