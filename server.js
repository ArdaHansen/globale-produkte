const express = require("express");
const path = require("path");
const fs = require("fs");

// Optional Supabase (for permanent shared edits)
let supabase = null;
try {
  const { createClient } = require("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Prefer service-role if provided (bypasses RLS). Otherwise use anon + RLS policies.
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

  if (SUPABASE_URL && key) {
    supabase = createClient(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log("[Supabase] enabled");
  } else {
    console.log("[Supabase] disabled (missing SUPABASE_URL / SUPABASE_*_KEY)");
  }
} catch (e) {
  console.log("[Supabase] disabled (missing dependency @supabase/supabase-js)");
}

const app = express();

const PORT = process.env.PORT || 3000;
const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD || "55";

const DATA_FILE = path.join(__dirname, "data", "site.json"); // fallback only
const PUBLIC_DIR = path.join(__dirname, "public");

// Supabase storage settings
const SB_TABLE = process.env.SUPABASE_TABLE || "site_data";
const SB_ROW_ID = process.env.SUPABASE_ROW_ID || "main";

app.use(express.json({ limit: "2mb" }));

/** -----------------------------
 * Local fallback (site.json)
 * ------------------------------*/
function readLocalSite() {
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}
function writeLocalSite(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/** -----------------------------
 * Supabase storage
 * - Table: site_data
 * - Columns: id (text, PK), data (jsonb)
 * - Row: id = "main"
 * ------------------------------*/
async function readSupabaseSite() {
  const { data, error } = await supabase
    .from(SB_TABLE)
    .select("data")
    .eq("id", SB_ROW_ID)
    .single();

  // If row doesn't exist yet, create it with local defaults (or empty shell)
  if (
    error &&
    (error.code === "PGRST116" ||
      String(error.message || "").includes("0 rows"))
  ) {
    const seed = safeSeed();
    await writeSupabaseSite(seed);
    return seed;
  }

  if (error) throw error;
  return data?.data ?? safeSeed();
}

async function writeSupabaseSite(siteData) {
  // Use upsert so the row is created if missing
  const { error } = await supabase
    .from(SB_TABLE)
    .upsert({ id: SB_ROW_ID, data: siteData }, { onConflict: "id" });

  if (error) throw error;
}

function safeSeed() {
  // Prefer local file as seed so you keep your current content if present
  try {
    if (fs.existsSync(DATA_FILE)) return readLocalSite();
  } catch (_) {}
  return { site: { title: "EcoSupply", subtitle: "" }, tiles: [], pages: {} };
}

function validateIncomingSite(data) {
  if (!data || typeof data !== "object") return "Invalid JSON";
  if (!Array.isArray(data.tiles)) return "tiles missing";
  if (!data.pages || typeof data.pages !== "object") return "pages missing";
  return null;
}

/** -----------------------------
 * API: public read
 * ------------------------------*/
app.get("/api/site", async (req, res) => {
  try {
    const data = supabase ? await readSupabaseSite() : readLocalSite();
    res.setHeader("Cache-Control", "no-store");
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send("Could not read site data");
  }
});

/** -----------------------------
 * API: protected write (password via header)
 * ------------------------------*/
app.put("/api/site", async (req, res) => {
  const pw = String(req.headers["x-editor-password"] || "");
  if (pw !== EDITOR_PASSWORD) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const incoming = req.body;
    const err = validateIncomingSite(incoming);
    if (err) return res.status(400).send(err);

    if (supabase) {
      await writeSupabaseSite(incoming);
    } else {
      writeLocalSite(incoming);
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).send("Could not write site data");
  }
});

app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// fallback to index (SPA-style)
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
