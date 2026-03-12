import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("interventions.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS patient_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    pharmacist_name TEXT,
    sector TEXT,
    bed_number TEXT
  );

  CREATE TABLE IF NOT EXISTS interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER,
    type TEXT,
    specialty TEXT,
    classifications TEXT, -- Stored as JSON string
    acceptance TEXT,
    is_economic TEXT,
    cost_classification TEXT,
    FOREIGN KEY(record_id) REFERENCES patient_records(id)
  );
`);

// Migration for existing databases
try {
  db.exec("ALTER TABLE interventions ADD COLUMN specialty TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE interventions ADD COLUMN is_economic TEXT");
} catch (e) {}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/test", (req, res) => {
    res.status(200).json({ message: "API funcionando!" });
  });

  app.post("/api/records", (req, res) => {
    console.log("POST /api/records received", req.body);
    const { date, pharmacist_name, sector, bed_number, interventions } = req.body;
    
    try {
      const insertRecord = db.prepare(`
        INSERT INTO patient_records (date, pharmacist_name, sector, bed_number)
        VALUES (?, ?, ?, ?)
      `);
      
      const info = insertRecord.run(date, pharmacist_name, sector, bed_number);
      const recordId = info.lastInsertRowid;

      const insertIntervention = db.prepare(`
        INSERT INTO interventions (record_id, type, specialty, classifications, acceptance, is_economic, cost_classification)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const intervention of interventions) {
        if (intervention.type) {
          insertIntervention.run(
            recordId,
            intervention.type,
            intervention.specialty,
            JSON.stringify(intervention.classifications || []),
            intervention.acceptance,
            intervention.is_economic,
            intervention.cost_classification
          );
        }
      }

      res.json({ success: true, id: recordId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save record" });
    }
  });

  app.get("/api/stats", (req, res) => {
    try {
      const totalRecords = db.prepare("SELECT COUNT(*) as count FROM patient_records").get();
      const totalInterventions = db.prepare("SELECT COUNT(*) as count FROM interventions").get();
      
      const byType = db.prepare("SELECT type, COUNT(*) as count FROM interventions GROUP BY type").all();
      const byAcceptance = db.prepare("SELECT acceptance, COUNT(*) as count FROM interventions GROUP BY acceptance").all();
      const bySector = db.prepare("SELECT sector, COUNT(*) as count FROM patient_records GROUP BY sector").all();

      res.json({
        totalRecords: totalRecords.count,
        totalInterventions: totalInterventions.count,
        byType,
        byAcceptance,
        bySector
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
