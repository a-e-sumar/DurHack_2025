const express = require("express");
const { runAirlineEmissions } = require("./pythonairlineemissions.js");
const path = require("path");

const app = express();
const PORT = 3000;

// 1. Serve static files from /public
//    This makes /public/script.js available at http://localhost:3000/script.js
app.use(express.static(path.join(__dirname, "public")));

// 2. Root route "/" -> send public/index.html
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");

  res.sendFile(indexPath, err => {
    if (err) {
      console.error("Error sending index.html:", err);
      // Send a basic fallback instead of crashing
      res.status(500).send("index.html not found or could not be sent.");
    }
  });
});
app.get("/emissions", async (req, res) => {
  try {
    const data = await runAirlineEmissions(
      req.query.depapt ?? "LHR",
      req.query.arrapt ?? "BOM",
      Number(req.query.year ?? 2024),
      Number(req.query.month ?? 1),
      Number(req.query.day ?? 20),
      "./test_data/",
      "./public/venv/emissions.csv"
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// 3. Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});