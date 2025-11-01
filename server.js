const express = require("express");
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

// 3. Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});