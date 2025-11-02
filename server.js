require("dotenv").config();

const express = require("express");
const { runAirlineEmissions } = require("./pythonairlineemissions.js");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

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
    const depapt = req.query.depapt ?? "LHR";
    const arrapt = req.query.arrapt ?? "BOM";
    const year   = Number(req.query.year ?? 2024);
    const month  = Number(req.query.month ?? 1);
    const day    = Number(req.query.day ?? 20);

    const data = await runAirlineEmissions(
      depapt,
      arrapt,
      year,
      month,
      day,
      process.env.DATA_PATH,
      process.env.CO2_PATH,
      process.env.PYTHON_PATH,
      process.env.SCRIPT_PATH
    );

    res.json(data || []);
  } catch (err) {
    console.error("emissions route error:", err);
    res.json([]);
  }
});

// 3. Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});