import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

interface ProjectFile {
  content: string;
  encoding: "utf-8" | "base64";
  contentType: string;
}

// In-memory store for active sites. Key is siteId, value is object mapping relative paths to file details.
const activeSites = new Map<string, Record<string, ProjectFile>>();

// Lazy initializer for server-only Gemini API client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Der GEMINI_API_KEY fehlt oder ist im Secrets-Panel nicht hinterlegt.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Simple helper to get content-type if not already provided or if we want to resolve automatically
function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".webp":
      return "image/webp";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body limit to support uploading larger folder hierarchies or media assets.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --- API Endpoints ---
  
  // Endpoint to upload/re-sync files for a site
  app.post("/api/sites/:siteId", (req, res) => {
    try {
      const { siteId } = req.params;
      const { files } = req.body; // Expecting Record<string, ProjectFile>
      
      if (!files || typeof files !== "object") {
        res.status(400).json({ error: "Invalid files format. Must be an object mapping paths to content info." });
        return;
      }

      // Store in memory
      activeSites.set(siteId, files);
      
      // Calculate statistics
      const filePaths = Object.keys(files);
      const totalSize = filePaths.reduce((acc, p) => acc + (files[p].content?.length || 0), 0);

      console.log(`[Server] Site "${siteId}" successfully registered with ${filePaths.length} files (${Math.round(totalSize / 1024)} KB)`);
      res.json({ success: true, siteId, fileCount: filePaths.length, totalSize });
    } catch (error: any) {
      console.error("[Server] Error in upload API:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint to retrieve a specific site's file overview
  app.get("/api/sites/:siteId", (req, res) => {
    const { siteId } = req.params;
    const site = activeSites.get(siteId);
    if (!site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }
    
    // Return paths and metadata (omit actual contents to keep payload small)
    const summary = Object.entries(site).reduce((acc, [filePath, file]) => {
      acc[filePath] = {
        contentType: file.contentType || guessContentType(filePath),
        encoding: file.encoding,
        size: file.content.length
      };
      return acc;
    }, {} as Record<string, any>);

    res.json({ siteId, files: summary });
  });

  // Endpoint to analyze and optimize the workspace files using server-side Gemini
  app.post("/api/ai/analyze-and-fix", async (req, res) => {
    try {
      const { files, instruction } = req.body;
      
      if (!files || typeof files !== "object" || Object.keys(files).length === 0) {
        res.status(400).json({ error: "Keine Projekt-Dateien zur Analyse gefunden." });
        return;
      }

      // Filter to only analyze text files (HTML, CSS, JS, JSON) to keep prompt tokens reasonable and avoid binary clutter
      const textFilesForPrompt: Record<string, string> = {};
      Object.entries(files).forEach(([filePath, fileInfo]: [string, any]) => {
        if (fileInfo.encoding === "utf-8" && !filePath.endsWith(".keep") && fileInfo.content) {
          textFilesForPrompt[filePath] = fileInfo.content;
        }
      });

      if (Object.keys(textFilesForPrompt).length === 0) {
        res.status(400).json({ error: "Keine bearbeitbaren Text-Dateien (HTML/CSS/JS) im Workspace gefunden." });
        return;
      }

      const client = getAiClient();

      const userInstruction = instruction?.trim() 
        ? `Spezifischer Optimierungswunsch des Nutzers: "${instruction}"` 
        : `Führe eine vollumfängliche, hochmoderne architektonische Optimierung der Frontend-Ressourcen durch unter Einhaltung zeitgemäßer Standards (fluide Typografie via clamp(), semantische Design-Tokens im :root, mobile-first Strukturierung, robustere Flex/Grid-Steuerungen, semantisches HTML5 und Reduzierung redundanter CSS-Deklarationen).`;

      const prompt = `Du bist ein weltklasse, extrem präziser Webentwicklungs-Architekt und Senior Frontend Engineer. Du analysierst die hochgeladenen Workspace-Dateien (HTML, CSS, JS) ganzheitlich im Verbund.

Wir betreiben eine Live-Sandbox. Hier ist der aktuelle Code des hochgeladenen Projekts als JSON-Mapping der relativen Dateipfade auf ihre Dateiinhalte:
${JSON.stringify(textFilesForPrompt, null, 2)}

Spezifische Anweisung des Nutzers:
${userInstruction}

DEINE ARCHITEKTONISCHE ANALYSE- UND OPTIMIERUNGSAUFGABE:

1. KASKADE UND STRUKTUR (CSS-Architektur):
   - Ist der CSS-Aufbau kontrolliert und nachvollziehbar? Ist zuerst der gestalterische Kern definiert, bevor einzelne Komponenten gestaltet werden?
   - Trenne Basiswerte, Layout-Regeln, Komponenten-Regeln und globale Klassen sauber. Verhindere unkontrollierte Seiteneffekte der Kaskade.

2. DESIGN TOKENS (Custom Properties):
   - Definiere und verwende zentrale Werte konsistent über CSS Custom Properties (:root).
   - Erstelle semantische Tokens für Farben, Typografie, Abstände, max-width Container-Breiten, Radien, Schatten, Z-Indexes und Übergangsgeschwindigkeiten.
   - Sorge dafür, dass das Token-System robust genug ist, um neue Seiten erweiterbar zu machen.

3. FLUID DESIGN UND SKALISIERUNG:
   - Ersetze starre Pixel-Angaben (px) für Schriften, Abstände und Breiten durch zeitgemäße, fluide Einheiten und Funktionen (\`clamp()\`, \`min()\`, \`max()\`, \`rem\`, \`em\`, \`vw\`).
   - Sorge für fließende Übergänge für Schriftgrößen (Fluid Typography) und Sektion-Abstände (Fluid Spacing) zwischen Viewports, ohne harte Breakpoint-Brüche.

4. RESPONSIVE SYSTEM (Mobile-First):
   - Baue das CSS konsequent Mobile-First auf.
   - Setze Breakpoints sparsam, systematisch und konsistent ein. Verwende moderne Viewport-Einheiten (svh, dvh, lvh) und ggf. Container Queries (@container) für Komponenten.
   - Stelle sicher, dass Inhalte, Bilder und CTAs auf kleinen Bildschirmen perfekt lesbar und fingerfreundlich bedienbar sind.

5. HERO-BEREICH:
   - Optimiere Headline (responsiv via clamp()), Subline, CTAs und Medien-Einbindung.
   - Begrenze Textbreiten für optimale Lesbarkeit. Sorge für eine robuste Mindesthöhe des Heros, die das Layout auf kleinen Screens nicht sprengt.
   - Hinterlege saubere CSS-Fallbacks für Medien.

6. NAVIGATION:
   - Sorge für eine strukturell saubere, robuste Menüstruktur, die auf Desktop und Mobile exzellent funktioniert (z.B. barrierefreies Mobile Burger-Menü/Offcanvas oder gestapelte Links).
   - Definiere saubere States (hover, active, focus-visible, sticky, open, closed) ohne unsaubere Inline-Styles oder harte Einzelwerte im JS.

7. LAYOUT-ROBUSTHEIT & SPEZIFITÄT:
   - Verwende Flexbox und CSS Grid passend mit sauberen Gaps und Alignment-Regeln. Vermeide fragile absolute Abstände oder feste Höhen.
   - Halte CSS-Selektoren leichtgewichtig und kontrollierbar. Beseitige tiefe Verschachtelungen und Spezifitätskämpfe.
   - Bereinige redundanten oder ungenutzten CSS-Code vollständig.

8. AUSGABEFORM DER ANALYSE ("explanation", MUSS exakt dieser Struktur folgen):
   Gib eine hochprofessionelle, detaillierte Kritik und Erklärung auf Deutsch aus, strukturiert wie folgt:
   
   ## 🏆 COMPAKT-GESAMTURTEIL
   [Eine prägnante, architektonische Einordnung des Projekts bezüglich Design-Qualität, Struktur und Modernität]

   ## ⚠️ DIE WICHTIGSTEN STRUKTURELLEN SCHWÄCHEN
   [Präzise Aufzählung der schwerwiegendsten Defizite, z.B. starre Pixelwerte, CSS-Chaos oder fragile Komponenten]

   ## 📊 DETAIL-BEWERTUNGEN
   - **Basisstruktur & Kaskade**: [Kritik/Lob]
   - **Design Tokens (Properties)**: [Kritik/Lob]
   - **Hero-Bereich & CTA-Fokus**: [Kritik/Lob]
   - **Navigations-Architektur**: [Kritik/Lob]
   - **Mobile-Verhalten & Breakpoints**: [Kritik/Lob]
   - **Fluid Design (clamp/rem)**: [Kritik/Lob]
   - **Layout-Robustheit (Grid/Flex)**: [Kritik/Lob]
   - **Komponenten-Wiederverwendbarkeit**: [Kritik/Lob]
   - **Redundanz- & Spezifitätsanalyse**: [Kritik/Lob]

   ## 🔍 KONKRETE FUNDSTELLEN & FEHLER-ANALYSEN
   - **Fundstelle**: [Dateipfad + Codezeile/Bereich]
     - *Technische Ursache*: [Warum ist das suboptimal?]
     - *Auswirkung*: [Wie äußert sich das beim Nutzer?]
     - *Bessere Lösung*: [Die moderne Alternative]

   ## 💡 BEST-PRACTICE REFERENZ-CODEBEISPIELE
   ### 1. Perfekt strukturierter Design-Token CSS-Basis Reset
   \`\`\`css
   /* Code mit CSS Custom Properties, intuitivem Box-Sizing & fluiden Schrift-Größen */
   \`\`\`
   ### 2. Robuster & Fluider Hero-Bereich (HTML/CSS)
   \`\`\`html
   /* Beispiel */
   \`\`\`
   ### 3. Responsive & State-sichere Navigation (CSS/JS)
   \`\`\`html
   /* Beispiel */
   \`\`\`

9. CODE-AKTUALISIERUNG ("changes"):
   - Liefere im "changes"-Objekt die korrigierten, vollendeten Dateiversionen mit erstklassigen Design-Token-Implementierungen zurück. Jede Datei muss als vollständiger neuer Code geliefert werden, der das System in ein hochmodernes, flexibles Pixel-freies Premium-Layout transformiert.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Du bist eine weltklasse Web-Development-KI, die gesamte Projekte im Verbund versteht, korrigiert und optimiert. Antworte in fehlerfreiem JSON. Sprich Deutsch in Erklärungen.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: {
                type: Type.STRING,
                description: "Detaillierte Analyse der gefundenen Fehler und vorgenommenen Optimierungen auf Deutsch (Markdown Form)."
              },
              changes: {
                type: Type.OBJECT,
                description: "Ein Objekt, das relative Dateipfade den modifizierten, vollständigen Programmcodes zuweist.",
                properties: {}
              }
            },
            required: ["explanation", "changes"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Leere Antwort von der Gemini API erhalten.");
      }

      const result = JSON.parse(responseText.trim());
      res.json(result);

    } catch (error: any) {
      console.error("[Server AI Error]:", error);
      res.status(500).json({ error: error.message || "Interner KI-Verarbeitungsfehler." });
    }
  });

  // --- 1-to-1 Web Preview Sandbox Server ---
  // Serves uploaded and structured web projects dynamically preserving relative URL pathways
  app.get("/site-preview/:siteId/*", (req, res) => {
    const { siteId } = req.params;
    const site = activeSites.get(siteId);

    if (!site) {
      res.status(404).send(`
        <html>
          <head>
            <style>
              body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f8fafc; color: #475569; margin: 0; }
              .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
              h2 { margin-top: 0; color: #0f172a; }
              p { font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem; }
              .btn { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; font-size: 0.875rem; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Sandbox Not Found</h2>
              <p>Your session may have expired, or files haven't been synchronized under project frame identifier <strong>"${siteId}"</strong>.</p>
              <button onclick="window.parent.postMessage('sync_required', '*')" class="btn">Reload & Synchronize Files</button>
            </div>
          </body>
        </html>
      `);
      return;
    }

    // Extract file path inside the site context
    // Resolves /site-preview/:siteId/css/style.css -> css/style.css
    const fullPathUrl = req.path;
    const sitePrefix = `/site-preview/${siteId}/`;
    let relativeFilePath = fullPathUrl.substring(sitePrefix.length);

    // Decode URL formatting (e.g. %20 -> space)
    relativeFilePath = decodeURIComponent(relativeFilePath);

    // If empty or ends with a slash, default to index.html
    if (!relativeFilePath || relativeFilePath.endsWith("/")) {
      relativeFilePath += "index.html";
    }

    // Try finding exact file match
    let file = site[relativeFilePath];

    // Fallback search: if path doesn't have an extension, try adding .html (e.g. /about -> about.html)
    if (!file && !path.extname(relativeFilePath)) {
      const htmlPath = relativeFilePath + ".html";
      if (site[htmlPath]) {
        relativeFilePath = htmlPath;
        file = site[htmlPath];
      }
    }

    // Fallback: If still not found, try searching case-insensitively or stripping prefix dots
    if (!file) {
      const cleanPath = relativeFilePath.replace(/^\.\//, "");
      if (site[cleanPath]) {
        file = site[cleanPath];
      }
    }

    if (!file) {
      // Return beautiful 404 message within the sandbox frame context so user is warned nicely
      res.status(404).send(`
        <html>
          <head>
            <style>
              body { font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #fef2f2; color: #991b1b; padding: 2rem; margin: 0; box-sizing: border-box; }
              .alert { border: 1px solid #fee2e2; background: #fff; padding: 1.5rem; border-radius: 6px; max-width: 500px; width: 100%; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
              h3 { margin-top: 0; }
              .path { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #0f172a; word-break: break-all; }
              .explanation { font-size: 0.85rem; color: #64748b; line-height: 1.5; margin-top: 1rem; }
            </style>
          </head>
          <body>
            <div class="alert">
              <h3>📄 404 - File Not Found in Project Folders</h3>
              <p>The site sandbox requested a path that does not exist in your uploaded workspace directories:</p>
              <div class="path">${relativeFilePath}</div>
              <div class="explanation">
                Check if your links, image tags (<code>&lt;img src="..."&gt;</code>) or stylesheet references (<code>&lt;link href="..."&gt;</code>) are spelled correctly and match case-sensitively in your original directory structure.
              </div>
            </div>
          </body>
        </html>
      `);
      return;
    }

    // Set header
    const contentType = file.contentType || guessContentType(relativeFilePath);
    res.setHeader("Content-Type", contentType);
    // Allow embedding in iframes
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Send content
    if (file.encoding === "base64") {
      const buffer = Buffer.from(file.content, "base64");
      res.send(buffer);
    } else {
      res.send(file.content);
    }
  });

  // --- Serve Frontend UI applet (Vite Dev vs Prod) ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Core sandbox engine running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
