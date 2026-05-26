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
        : `Analysiere das Webprojekt nach typischen Fehlern (z.B. falsche/kaputte relative Verknüpfungen für Bilder oder CSS-Dateien, syntaktische Fehler, Inkonsistenzen in den CSS-Stilen) und nimm umfassende Verbesserungen vor.`;

      const prompt = `Du bist ein erstklassiger Webentwicklungs-Experte und KI-Entwicklungspartner.
Wir betreiben eine Live-App, in der Nutzer Website-Ordner als 1-zu-1-Struktur hochladen. Jedes Projekt enthält HTML-, CSS-, JS-Dateien im Verbund unter exakten relativen Pfaden.

Hier ist der aktuelle Quellcode des Projekts als JSON-Mapping der relativen Dateipfade auf ihre Inhalte:
${JSON.stringify(textFilesForPrompt, null, 2)}

Spezifische Anweisung:
${userInstruction}

DEINE AUFGABE:
1. Analysiere alle bereitgestellten Dateien gründlich.
2. Finde Fehler wie:
   - Falsche relative Links (z.B. wenn eine CSS-Datei in "css/style.css" liegt, aber eine HTML-Datei "../css/style.css" oder "styles.css" referenziert - korrigiere das, indem du die Pfade in den Dateien aneinander anpasst!).
   - CSS-Syntaxfehler, unfertiger oder inkonsistenter Code.
   - Fehlende moderne Styling-Optimierungen, veraltete Design-Regeln, schlechte Abstände, falsche Typografie oder schlechter Kontrast.
3. Führe die Optimierungen/Korrekturen vollautomatisch im gesamten Projekt durch. Wenn ein spezifischer Nutzerwunsch vorliegt, setze diesen in ALLEN betroffenen Dateien um.
4. Gib das Ergebnis in folgendem exakten JSON-Format zurück (gemeldet in responseSchema):
   - "explanation": Eine detaillierte, professionelle Zusammenfassung der Fehleranalyse und der vorgenommenen Anpassungen auf Deutsch im lesbaren Markdown-Format (Stichpunkte). Erkläre präzise, welche Fehler in welchen Dateien behoben wurden!
   - "changes": Ein Objekt, das die geänderten Web-Dateipfade auf ihre NEUEN, VOLLSTÄNDIG optimierten Dateiinhalte abbildet (z.B. {"index.html": "<vollständiger code...>", "css/style.css": "<vollständiger code...>"}). Du musst NUR die geänderten Dateien zurückgeben. Gib immer den VOLLSTÄNDIGEN Dateiinhalt an, nicht bloß Diffs!

WICHTIG: Übersetze Designwünsche in hervorragende Webdesigns (z.B. ansprechende Farbpaletten wie Indigo/Slate, weiche Schatten, harmonische Abstände, klare Typografie).`;

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
