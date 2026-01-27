const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;
const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD || "55";

const DATA_FILE = path.join(__dirname, "data", "site.json");
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.json({ limit: "2mb" }));

function readSite(){
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}
function writeSite(data){
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// API: public read
app.get("/api/site", (req, res) => {
  try{
    const data = readSite();
    res.setHeader("Cache-Control", "no-store");
    res.json(data);
  }catch(e){
    res.status(500).send("Could not read site data");
  }
});

// API: protected write
app.put("/api/site", (req, res) => {
  const pw = String(req.headers["x-editor-password"] || "");
  if(pw !== EDITOR_PASSWORD){
    return res.status(401).send("Unauthorized");
  }
  try{
    const data = req.body;
    if(!data || typeof data !== "object") return res.status(400).send("Invalid JSON");
    // Minimal sanity checks
    if(!Array.isArray(data.tiles)) return res.status(400).send("tiles missing");
    if(!data.pages || typeof data.pages !== "object") return res.status(400).send("pages missing");
    writeSite(data);
    res.json({ ok: true });
  }catch(e){
    res.status(500).send("Could not write site data");
  }
});

app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// fallback to index
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});