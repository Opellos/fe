import { FileSystemRecord } from "./types";

export const DEMO_PROJECT: FileSystemRecord = {
  "index.html": {
    encoding: "utf-8",
    contentType: "text/html; charset=utf-8",
    content: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>1-zu-1 HTML Sandbox Demo</title>
    <!-- Relative stylesheet link -->
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">✦ SandboxEngine</div>
            <nav>
                <a href="index.html" class="active">Startseite</a>
                <a href="pages/features.html">Funktionen</a>
                <a href="pages/about.html">Über Uns</a>
            </nav>
        </header>
        
        <main class="hero-section">
            <span class="badge">100% Struktur-Erhalt</span>
            <h1>Perfekte Ordner-Strukturen online testen</h1>
            <p>Diese App lädt deine komplette Website-Ordnerstruktur inklusive aller HTML-, CSS-, JS- und Bilddateien hoch. Relative Pfade funktionieren exakt wie auf deiner Festplatte!</p>
            
            <div class="cta-group">
                <a href="pages/features.html" class="btn btn-primary">Mehr erfahren</a>
                <button id="alert-btn" class="btn btn-outline">Klick mich (interaktives JS)</button>
            </div>

            <div class="visual-card">
                <h3>Deine aktuelle Ordner-Struktur für dieses Demo-Projekt:</h3>
                <pre class="folder-tree">
📁 Projekt-Wurzel/
├── 📄 index.html
├── 📁 css/
│   └── 📄 style.css
├── 📁 js/
│   └── 📄 main.js
└── 📁 pages/
    ├── 📄 features.html
    └── 📄 about.html</pre>
            </div>
        </main>
        
        <footer>
            <p>&copy; 2026 Web Project Sandbox. Lokaler Live-Server im Browser.</p>
        </footer>
    </div>
    
    <!-- Relative script link -->
    <script src="js/main.js"></script>
</body>
</html>`
  },
  "css/style.css": {
    encoding: "utf-8",
    contentType: "text/css; charset=utf-8",
    content: `/* CSS-Stylesheet im Unterordner "css/" geladen */
:root {
    --primary: #6366f1;
    --primary-hover: #4f46e5;
    --background: #0f172a;
    --card-bg: #1e293b;
    --text: #f8fafc;
    --text-muted: #94a3b8;
    --border: #334155;
}

body {
    font-family: system-ui, -apple-system, sans-serif;
    background-color: var(--background);
    color: var(--text);
    margin: 0;
    line-height: 1.6;
}

.container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem;
    box-sizing: border-box;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
}

.logo {
    font-weight: 800;
    font-size: 1.25rem;
    letter-spacing: -0.05em;
    color: #a5b4fc;
}

nav {
    display: flex;
    gap: 1.5rem;
}

nav a {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 500;
    transition: color 0.2s;
}

nav a:hover, nav a.active {
    color: var(--text);
}

.hero-section {
    flex-grow: 1;
    max-width: 800px;
    margin: 3rem auto;
    text-align: center;
}

.badge {
    background: rgba(99, 102, 241, 0.15);
    color: #c7d2fe;
    border: 1px solid rgba(99, 102, 241, 0.3);
    padding: 0.3rem 0.8rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
    display: inline-block;
    margin-bottom: 1.5rem;
}

h1 {
    font-size: 3rem;
    letter-spacing: -0.03em;
    font-weight: 800;
    line-height: 1.1;
    margin-bottom: 1.5rem;
    background: linear-gradient(to right, #a5b4fc, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

p {
    font-size: 1.15rem;
    color: var(--text-muted);
    margin-bottom: 2.5rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}

.cta-group {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 3.5rem;
}

.btn {
    padding: 0.75rem 1.75rem;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s;
}

.btn-primary {
    background-color: var(--primary);
    color: white;
    border: none;
}

.btn-primary:hover {
    background-color: var(--primary-hover);
    transform: translateY(-1px);
}

.btn-outline {
    background-color: transparent;
    color: var(--text);
    border: 1px solid var(--border);
}

.btn-outline:hover {
    background-color: rgba(255, 255, 255, 0.05);
}

.visual-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    text-align: left;
    margin-top: 2rem;
}

.visual-card h3 {
    margin-top: 0;
    color: #e2e8f0;
}

.folder-tree {
    font-family: 'Courier New', Courier, monospace;
    background: #090d16;
    padding: 1rem;
    border-radius: 6px;
    color: #34d399;
    margin: 0;
    overflow-x: auto;
}

.about-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 2rem;
    text-align: left;
    max-width: 650px;
    margin: 2rem auto;
}

footer {
    text-align: center;
    border-top: 1px solid var(--border);
    padding-top: 1.5rem;
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-top: 4rem;
}`
  },
  "js/main.js": {
    encoding: "utf-8",
    contentType: "application/javascript; charset=utf-8",
    content: `// JavaScript Datei im Unterordner "js/" geladen
console.log("✦ SandboxEngine: Live-Skript erfolgreich initialisiert!");

const alertButton = document.getElementById("alert-btn");
if (alertButton) {
    alertButton.addEventListener("click", () => {
        // Create an elegant notification instead of a blocking window.alert
        const notification = document.createElement("div");
        notification.style.position = "fixed";
        notification.style.bottom = "24px";
        notification.style.right = "24px";
        notification.style.background = "#6366f1";
        notification.style.color = "white";
        notification.style.padding = "16px 24px";
        notification.style.borderRadius = "8px";
        notification.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.3)";
        notification.style.fontFamily = "system-ui, sans-serif";
        notification.style.fontWeight = "600";
        notification.style.zIndex = "9999";
        notification.style.transition = "all 0.3s ease";
        notification.style.transform = "translateY(50px)";
        notification.style.opacity = "0";
        notification.innerText = "🎉 Interaktives JS funktioniert 100% einwandfrei!";
        
        document.body.appendChild(notification);
        
        // Triggers animation
        setTimeout(() => {
            notification.style.transform = "translateY(0)";
            notification.style.opacity = "1";
        }, 10);
        
        // Dismiss after 4s
        setTimeout(() => {
            notification.style.transform = "translateY(50px)";
            notification.style.opacity = "0";
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    });
}`
  },
  "pages/features.html": {
    encoding: "utf-8",
    contentType: "text/html; charset=utf-8",
    content: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Funktionen - SandboxEngine</title>
    <!-- Relative navigation up one level into "css/style.css" -->
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">✦ SandboxEngine</div>
            <nav>
                <a href="../index.html">Startseite</a>
                <a href="features.html" class="active">Funktionen</a>
                <a href="about.html">Über Uns</a>
            </nav>
        </header>
        
        <main>
            <section class="about-card">
                <span class="badge">Echte Web-Pfade</span>
                <h2>Wie löst diese App das Ordner-Problem?</h2>
                
                <p>Normalerweise weigern sich einfache Upload-Websites, komplette Ordner zu empfangen. Du müsstest jede Datei einzeln hochladen und mühsam alle Pfade anpassen.</p>
                
                <p><strong>Die Sandbox-Lösung:</strong> Webtauglicher Multi-File-Upload erfasst die relative Ordnerstruktur der ausgewählten Dateien. Unser lokaler Server ordnet das gesamte Projekt virtuell oder im Hintergrund ein, sodass relative Bezüge zwischen Seiten reibungslos funktionieren!</p>
                
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 1.5rem 0;">
                
                <h3>Wichtigste Funktionen:</h3>
                <ul style="padding-left: 1.25rem; color: var(--text-muted); line-height: 1.8;">
                    <li><strong>Echte Ordner-Struktur:</strong> Behält sämtliche Verzeichnisse (z.B. subfolders, CSS-Ordner, Assets) ohne Änderungen bei.</li>
                    <li><strong>Einfacher ZIP-Upload:</strong> Lade alternativ deine fertige <code>.zip</code>-Datei hoch – die App entpackt sie komplett im Sandbox-Verzeichnis.</li>
                    <li><strong>Dateieditor & Live-Edit:</strong> Klicke im Explorer auf Webdateien, nimm Änderungen vor, und die Sandbox aktualisiert die Live-Vorschau sofort!</li>
                    <li><strong>Download-Zurückexport:</strong> Lade geänderte oder neu angelegte Projekte per Knopfdruck als fertigen Zip-Ordner herunter.</li>
                </ul>
                
                <div style="margin-top: 2rem;">
                    <a href="../index.html" class="btn btn-outline">&larr; Zurück zur Übersicht</a>
                </div>
            </section>
        </main>
        
        <footer>
            <p>&copy; 2026 Web Project Sandbox. Lokaler Live-Server im Browser.</p>
        </footer>
    </div>
</body>
</html>`
  },
  "pages/about.html": {
    encoding: "utf-8",
    contentType: "text/html; charset=utf-8",
    content: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Über Uns - SandboxEngine</title>
    <!-- Relative stylesheet link -->
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">✦ SandboxEngine</div>
            <nav>
                <a href="../index.html">Startseite</a>
                <a href="features.html">Funktionen</a>
                <a href="about.html" class="active">Über Uns</a>
            </nav>
        </header>
        
        <main>
            <section class="about-card" style="text-align: center;">
                <span class="badge">Kein Rausziehen nötig</span>
                <h2>100% flexibler Import</h2>
                <p>Diese Sandbox wurde speziell entwickelt, um lästiges Verschieben von CSS-Dateien aus Unterordnern zu verhindern. Wir glauben, dass dein Code genau so funktionieren sollte, wie du ihn geschrieben hast.</p>
                
                <div style="font-size: 4rem; margin: 2rem 0;">🧩 &rarr; 💻</div>
                
                <p>Nutz einfach links die Buttons, um einen Ordner per Drag & Drop oder einen vollständigen ZIP-Import zu übergeben. Du kannst in Echtzeit neue Ordner erstellen oder Dateien löschen.</p>
                
                <div style="margin-top: 2.5rem;">
                    <a href="../index.html" class="btn btn-primary">Ausprobieren</a>
                </div>
            </section>
        </main>
        
        <footer>
            <p>&copy; 2026 Web Project Sandbox. Lokaler Live-Server im Browser.</p>
        </footer>
    </div>
</body>
</html>`
  }
};
