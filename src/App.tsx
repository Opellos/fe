/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  Trash2, 
  Plus, 
  File, 
  Image,
  Upload, 
  Download, 
  RotateCcw, 
  Play, 
  ExternalLink, 
  Check, 
  Save, 
  FileText,
  ChevronRight,
  ChevronDown,
  Info,
  Sparkles,
  AlertCircle,
  X,
  ChevronLeft,
  Wand2,
  Brain
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { FileSystemRecord, TreeNode, ProjectFile } from "./types";
import { DEMO_PROJECT } from "./demoData";
import { buildTree, guessContentType, isTextFileType } from "./utils";

// Generate a unique session site ID to avoid overwriting other users' workspace states
const getOrCreateSiteId = (): string => {
  let id = localStorage.getItem("sandbox_site_id");
  if (!id) {
    id = "site-" + Math.random().toString(36).substring(2, 11);
    localStorage.setItem("sandbox_site_id", id);
  }
  return id;
};

export default function App() {
  const [siteId] = useState<string>(getOrCreateSiteId);
  const [files, setFiles] = useState<FileSystemRecord>({});
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Selection states
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [editorContent, setEditorContent] = useState<string>("");
  const [isUnsaved, setIsUnsaved] = useState<boolean>(false);
  
  // File tree expanded nodes state (relative paths => boolean)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  
  // Creation modal states
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>("");
  const [targetFolderPath, setTargetFolderPath] = useState<string>(""); // "" means root

  // AI Assistant panel states
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(true);
  const [aiInstruction, setAiInstruction] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string>("");
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [aiChanges, setAiChanges] = useState<Record<string, string> | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Live preview properties
  const [previewKey, setPreviewKey] = useState<number>(0);
  const [currentUrlPath, setCurrentUrlPath] = useState<string>("index.html");
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Initialize with demo project if local storage is empty, else load stored project
  useEffect(() => {
    const saved = localStorage.getItem(`sandbox_files_${siteId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Object.keys(parsed).length > 0) {
          setFiles(parsed);
          // Auto select first HTML file or any file
          const firstHtml = Object.keys(parsed).find(p => p.endsWith(".html")) || Object.keys(parsed)[0];
          if (firstHtml) {
            setSelectedFilePath(firstHtml);
            setEditorContent(parsed[firstHtml]?.content || "");
          }
          return;
        }
      } catch (e) {
        console.error("Failed to load saved files", e);
      }
    }
    // Load default demo project
    setFiles(DEMO_PROJECT);
    setSelectedFilePath("index.html");
    setEditorContent(DEMO_PROJECT["index.html"]?.content || "");
    
    // Expand default folder structures
    setExpandedFolders({
      "css": true,
      "js": true,
      "pages": true,
    });
  }, [siteId]);

  // Persist files in local storage and synchronize to the server whenever they change
  useEffect(() => {
    if (Object.keys(files).length === 0) return;
    
    localStorage.setItem(`sandbox_files_${siteId}`, JSON.stringify(files));
    syncFilesToServer();
  }, [files]);

  // Read message events from the preview iframe.
  // If the iframe gets a 404 and requests re-sync, trigger it!
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data === "sync_required") {
        syncFilesToServer();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [files]);

  // Push local Workspace Files over HTTP into the Express background proxy
  const syncFilesToServer = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch(`/api/sites/${siteId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Synchronisierungsfehler aufgetreten");
      }
      
      // Update the iframe to load the latest state
      setPreviewKey((prev) => prev + 1);
    } catch (err: any) {
      console.error("HTTP Sync Failure:", err);
      setSyncError(err.message || "Verbindung zum Server fehlgeschlagen");
    } finally {
      setIsSyncing(false);
    }
  };

  // Select file handler
  const handleFileClick = (path: string) => {
    // If unsaved changes exist in current file, flash warning or auto-save
    if (isUnsaved && selectedFilePath) {
      // Auto save current file before switching
      saveFileContent(selectedFilePath, editorContent);
    }
    
    setSelectedFilePath(path);
    const selectedFile = files[path];
    if (selectedFile) {
      setEditorContent(selectedFile.content);
      setIsUnsaved(false);
      
      // Set preview container target path dynamically if it's an HTML page
      if (path.endsWith(".html")) {
        setCurrentUrlPath(path);
      }
    }
  };

  // Editor content update handler
  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorContent(e.target.value);
    setIsUnsaved(true);
  };

  // Save specific file contents
  const saveFileContent = (path: string, content: string) => {
    if (!path) return;
    setFiles((prev) => ({
      ...prev,
      [path]: {
        ...prev[path],
        content,
      },
    }));
    setIsUnsaved(false);
  };

  const handleManualSave = () => {
    saveFileContent(selectedFilePath, editorContent);
  };

  // Reload Live preview
  const handleReloadPreview = () => {
    setPreviewKey((prev) => prev + 1);
  };

  // Download entire sandbox as ZIP archive
  const handleDownloadZip = async () => {
    const zip = new JSZip();
    
    // Add all active files into zip structure
    (Object.entries(files) as Array<[string, ProjectFile]>).forEach(([filePath, fileInfo]) => {
      if (fileInfo.encoding === "base64") {
        zip.file(filePath, fileInfo.content, { base64: true });
      } else {
        zip.file(filePath, fileInfo.content);
      }
    });

    try {
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `project-${siteId}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
      console.error("Error generating ZIP:", e);
    }
  };

  // Execute server-side Gemini code analysis and design optimization
  const handleExecuteAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiError(null);
    setAiExplanation("");
    setAiChanges(null);

    // Dynamic loading texts to keep user interactive
    const statusMessages = [
      "Katalogisiere Ordner-Strukturen...",
      "Analysiere HTML-Elemente & Web-Bezüge...",
      "Untersuche CSS-Syntax & Link-Schnittstellen...",
      "Prüfe relative Pfad-Verknüpfungen...",
      "Generiere fehlerfreien, modernen Quellcode...",
    ];
    let msgIndex = 0;
    setAiStatusMessage(statusMessages[0]);
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % statusMessages.length;
      setAiStatusMessage(statusMessages[msgIndex]);
    }, 4500);

    try {
      // Auto-save active file first if it has unsaved changes
      if (isUnsaved && selectedFilePath) {
        saveFileContent(selectedFilePath, editorContent);
      }

      const response = await fetch("/api/ai/analyze-and-fix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files,
          instruction: aiInstruction,
        }),
      });

      clearInterval(interval);

      if (!response.ok) {
        const errObj = await response.json();
        throw new Error(errObj.error || "Fehler bei der KI-Analyse.");
      }

      const data = await response.json();
      setAiExplanation(data.explanation || "Die Analyse wurde erfolgreich abgeschlossen.");
      setAiChanges(data.changes || null);
    } catch (err: any) {
      clearInterval(interval);
      console.error("AI analysis error:", err);
      setAiError(err.message || "Unerwarteter Fehler bei der Kommunikation mit dem KI-Modell.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Merge optimisations into the current Workspace Files
  const handleApplyAiChanges = () => {
    if (!aiChanges || Object.keys(aiChanges).length === 0) return;

    setFiles((prev) => {
      const copy = { ...prev };
      Object.entries(aiChanges!).forEach(([filePath, content]) => {
        copy[filePath] = {
          content,
          encoding: "utf-8",
          contentType: guessContentType(filePath),
        };
      });
      return copy;
    });

    // Reload active editor file if it was altered by the AI updates
    if (selectedFilePath && aiChanges[selectedFilePath] !== undefined) {
      setEditorContent(aiChanges[selectedFilePath]);
      setIsUnsaved(false);
    }

    setAiChanges(null);
    setAiExplanation("");
    alert("Klasse! Die optimierte Datenlage wurde erfolgreich in deine Projekt-Ordner übernommen.");
  };

  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="text-[#a5b4fc] font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderMarkdownSimple = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h4 key={idx} className="text-xs font-bold text-slate-100 mt-4 mb-2 first:mt-0 font-sans tracking-wide uppercase">{line.replace("### ", "")}</h4>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={idx} className="text-sm font-bold text-indigo-400 mt-5 mb-2 first:mt-0 font-sans">{line.replace("## ", "")}</h3>;
      }
      if (line.startsWith("# ")) {
        return <h2 key={idx} className="text-base font-black text-white mt-6 mb-3 first:mt-0 font-sans border-b border-slate-800 pb-1">{line.replace("# ", "")}</h2>;
      }
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const cleanLine = line.trim().replace(/^[-*]\s+/, "");
        return (
          <li key={idx} className="text-xs text-slate-300 ml-4 list-disc py-1 font-sans leading-relaxed">
            {parseBoldText(cleanLine)}
          </li>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-2"></div>;
      }
      return <p key={idx} className="text-xs text-slate-300 leading-relaxed py-1 font-sans">{parseBoldText(line)}</p>;
    });
  };

  // Helper helper to convert uploaded files logically
  const readAsDataURLOrText = (file: File, isText: boolean): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (isText) {
          resolve(reader.result as string);
        } else {
          // Base64 is the portion after the comma in a Data URL
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1] || "";
          resolve(base64);
        }
      };
      reader.onerror = reject;
      if (isText) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  // Upload folder 1-to-1 preserving directories
  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = event.target.files;
    if (!filesList || filesList.length === 0) return;
    
    const newFiles: FileSystemRecord = {};
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const webkitPath = file.webkitRelativePath; // e.g. "my-folder/css/styles.css"
      if (!webkitPath) continue;

      // Extract path parts and strip the outer root folder part
      // This maps "my-folder/index.html" directly onto "index.html" at root,
      // and "my-folder/css/styles.css" to "css/styles.css".
      // This is EXACTLY the 1:1 mapping the user requests!
      const parts = webkitPath.split("/");
      if (parts.length <= 1) continue;
      const relativePath = parts.slice(1).join("/");
      
      const isText = isTextFileType(relativePath);
      const promise = readAsDataURLOrText(file, isText).then((contentStr) => {
        newFiles[relativePath] = {
          content: contentStr,
          encoding: isText ? "utf-8" : "base64",
          contentType: guessContentType(relativePath),
        };
      }).catch(err => console.error("FileReader failure:", err));
      
      promises.push(promise);
    }
    
    await Promise.all(promises);
    
    if (Object.keys(newFiles).length > 0) {
      setFiles(newFiles);
      
      // Auto-select index.html or first file to make it comfortable
      const firstHtml = Object.keys(newFiles).find(p => p.endsWith("index.html")) || Object.keys(newFiles)[0];
      setSelectedFilePath(firstHtml || "");
      setEditorContent(newFiles[firstHtml]?.content || "");
      setIsUnsaved(false);
      setCurrentUrlPath(firstHtml && firstHtml.endsWith(".html") ? firstHtml : "index.html");
      
      // Auto-expand uploaded directories
      const dirs: Record<string, boolean> = {};
      Object.keys(newFiles).forEach(p => {
        const parts = p.split("/");
        if (parts.length > 1) {
          dirs[parts[0]] = true;
        }
      });
      setExpandedFolders(dirs);
    }
    
    // Clear input value to allow uploading same folder again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Unzip uploaded .ZIP file maintaining structure
  const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    
    const file = fileList[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const newFiles: FileSystemRecord = {};
      const promises: Promise<void>[] = [];
      
      zip.forEach((relativePath, zipEntry) => {
        // Skip directory placeholders, JSZip will deliver standard entries
        if (!zipEntry.dir) {
          const isText = isTextFileType(relativePath);
          
          const promise = zipEntry.async(isText ? "string" : "base64").then((content) => {
            newFiles[relativePath] = {
              content,
              encoding: isText ? "utf-8" : "base64",
              contentType: guessContentType(relativePath),
            };
          });
          promises.push(promise);
        }
      });
      
      await Promise.all(promises);
      
      if (Object.keys(newFiles).length > 0) {
        // Strip a common root folder if EVERYTHING in the zip is inside a single containing folder
        let processedFiles = newFiles;
        const keys = Object.keys(newFiles);
        const topLevelDirs = new Set<string>();
        
        keys.forEach(k => {
          const firstPart = k.split("/")[0];
          if (firstPart) topLevelDirs.add(firstPart);
        });
        
        // If everything is in exactly one single container folder, we strip it to make the site launch directly at index.html
        if (topLevelDirs.size === 1 && keys.every(k => k.includes("/"))) {
          const rootFolder = Array.from(topLevelDirs)[0] + "/";
          const strippedFiles: FileSystemRecord = {};
          keys.forEach(k => {
            const cleanKey = k.substring(rootFolder.length);
            if (cleanKey) {
              strippedFiles[cleanKey] = newFiles[k];
            }
          });
          processedFiles = strippedFiles;
        }

        setFiles(processedFiles);
        
        // Select entry point file
        const firstHtml = Object.keys(processedFiles).find(p => p.endsWith("index.html")) || Object.keys(processedFiles)[0];
        setSelectedFilePath(firstHtml || "");
        setEditorContent(processedFiles[firstHtml]?.content || "");
        setIsUnsaved(false);
        setCurrentUrlPath(firstHtml && firstHtml.endsWith(".html") ? firstHtml : "index.html");
        
        // Auto expand folders
        const dirs: Record<string, boolean> = {};
        Object.keys(processedFiles).forEach(p => {
          const parts = p.split("/");
          if (parts.length > 1) {
            dirs[parts[0]] = true;
          }
        });
        setExpandedFolders(dirs);
      }
    } catch (e) {
      console.error("ZIP Unpack Error:", e);
      alert("ZIP-Archiv konnte nicht gelesen werden. Stelle sicher, dass es sich um eine gültige ZIP-Datei handelt.");
    }
    
    if (zipInputRef.current) zipInputRef.current.value = "";
  };

  // Create new folder node
  const handleAddNewFolder = () => {
    if (!newItemName.trim()) return;
    const cleanName = newItemName.trim().replace(/^\/|\/$/g, "");
    
    // Virtual directory indicator file (.keep) so folder displays, otherwise flat maps skip empty directories
    const path = targetFolderPath 
      ? `${targetFolderPath}/${cleanName}/.keep` 
      : `${cleanName}/.keep`;
      
    setFiles((prev) => ({
      ...prev,
      [path]: {
        content: "",
        encoding: "utf-8",
        contentType: "text/plain",
      }
    }));
    
    // Auto expand parent and target
    const parent = targetFolderPath || cleanName;
    setExpandedFolders((prev) => ({ ...prev, [parent]: true }));
    
    setNewItemName("");
    setIsCreatingFolder(false);
  };

  // Create new file node
  const handleAddNewFile = () => {
    if (!newItemName.trim()) return;
    const cleanName = newItemName.trim();
    
    const path = targetFolderPath 
      ? `${targetFolderPath}/${cleanName}` 
      : cleanName;
      
    if (files[path]) {
      alert("Eine Datei mit diesem Namen existiert bereits!");
      return;
    }

    const defaultContent = cleanName.endsWith(".html") 
      ? `<!DOCTYPE html>\n<html lang="de">\n<head>\n    <title>Neue Seite</title>\n</head>\n<body>\n    <h1>${cleanName}</h1>\n</body>\n</html>`
      : cleanName.endsWith(".css")
      ? `/* Stylesheet ${cleanName} */\nbody {\n    color: #333;\n}`
      : `// Skript ${cleanName}`;

    setFiles((prev) => ({
      ...prev,
      [path]: {
        content: defaultContent,
        encoding: "utf-8",
        contentType: guessContentType(path),
      }
    }));
    
    setSelectedFilePath(path);
    setEditorContent(defaultContent);
    setIsUnsaved(false);

    setNewItemName("");
    setIsCreatingFile(false);
  };

  // Deletion logic
  const handleDeleteItem = (pathToDelete: string, isDir: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Möchtest du diese ${isDir ? "Ordner-Struktur" : "Datei"} wirklich löschen?`)) {
      return;
    }

    setFiles((prev) => {
      const copy = { ...prev };
      if (isDir) {
        // Delete all files matching the folder prefix (e.g. css/*)
        const prefix = pathToDelete + "/";
        Object.keys(copy).forEach((k) => {
          if (k.startsWith(prefix)) {
            delete copy[k];
          }
        });
      } else {
        delete copy[pathToDelete];
      }
      return copy;
    });

    // If active file was deleted, switch to another
    if (selectedFilePath === pathToDelete || (isDir && selectedFilePath.startsWith(pathToDelete + "/"))) {
      setSelectedFilePath("");
      setEditorContent("");
    }
  };

  // Reset to original sandbox demo structure
  const handleResetToDemo = () => {
    if (confirm("Möchtest du das aktuelle Projekt verwerfen und auf das Demo-Projekt zurücksetzen?")) {
      setFiles(DEMO_PROJECT);
      setSelectedFilePath("index.html");
      setEditorContent(DEMO_PROJECT["index.html"]?.content || "");
      setIsUnsaved(false);
      setCurrentUrlPath("index.html");
      setExpandedFolders({
        "css": true,
        "js": true,
        "pages": true,
      });
    }
  };

  // File explorer icons switcher
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "html":
      case "htm":
        return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
      case "css":
        return <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />;
      case "js":
      case "mjs":
        return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
      case "json":
        return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "webp":
      case "svg":
        return <Image className="w-4 h-4 text-pink-400 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-gray-400 shrink-0" />;
    }
  };

  // Toggle folder open/collapsed
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  // Rendering files and directories recursively
  const renderTreeNodes = (nodes: TreeNode[], depth: number = 0) => {
    return nodes.map((node) => {
      const isDir = node.type === "directory";
      const isExpanded = expandedFolders[node.path];
      const isSelected = selectedFilePath === node.path;
      
      // Filter out utility .keep files from being displayed in explorer
      if (node.name === ".keep" && node.type === "file") {
        return null;
      }

      return (
        <div key={node.path} className="select-none">
          {/* Node heading row */}
          <div
            onClick={() => isDir ? toggleFolder(node.path) : handleFileClick(node.path)}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className={`group flex items-center justify-between py-1.5 px-3 rounded-md cursor-pointer transition-all duration-150 text-sm ${
              isSelected 
                ? "bg-slate-700/80 text-white font-medium shadow-sm border-l-2 border-indigo-500" 
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden truncate">
              {isDir ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-yellow-500 shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-yellow-500 shrink-0" />
                  )}
                </>
              ) : (
                <>
                  <div className="w-3.5 h-3.5 shrink-0" /> {/* Spacer alignment matching chvron */}
                  {getFileIcon(node.name)}
                </>
              )}
              <span className="truncate">{node.name}</span>
            </div>

            {/* Quick utility actions on hover */}
            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
              {isDir && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetFolderPath(node.path);
                      setIsCreatingFile(true);
                    }}
                    title="Datei in Ordner anlegen"
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    <Plus className="w-3" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => handleDeleteItem(node.path, isDir, e)}
                title={isDir ? "Ordner löschen" : "Datei löschen"}
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Render children directories recursive if open */}
          {isDir && isExpanded && node.children && (
            <div className="mt-0.5">
              {renderTreeNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Convert files object to build tree representation
  const treeNodes = buildTree(files);

  // Address of hosted frame structure
  const activePreviewUrl = `/site-preview/${siteId}/${currentUrlPath}?key=${previewKey}`;

  return (
    <div id="app-workspace" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Top Professional Applet Header */}
      <header id="workspace-header" className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap gap-4 items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-xl text-white shadow-md shadow-indigo-950/50">
            <span className="text-xl font-black tracking-tighter block leading-none">✦</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-tight flex items-center gap-2">
              1-zu-1 Web-Ordner Sandbox
              <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/20 text-xs text-indigo-300 font-normal">
                Live Server
              </span>
            </h1>
            <p className="text-xs text-slate-400">Dateistruktur & relative Verknüpfungen bleiben exakt erhalten</p>
          </div>
        </div>

        {/* Action Controls Headings Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sync indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isSyncing ? "bg-amber-400 animate-pulse" : syncError ? "bg-rose-500" : "bg-emerald-400"}`}></span>
            <span>
              {isSyncing ? "Synchronisiere..." : syncError ? `Fehler: ${syncError}` : "Server ist synchron"}
            </span>
          </div>

          {/* Reset button */}
          <button
            onClick={handleResetToDemo}
            className="flex items-center gap-2 px-3 tracking-wide py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 hover:text-white border border-slate-700 font-semibold transition-colors shadow-sm cursor-pointer"
            title="Demo-Projekt importieren"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Demo laden</span>
          </button>

          {/* Download button */}
          <button
            onClick={handleDownloadZip}
            disabled={Object.keys(files).length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-white border border-slate-700 font-semibold transition-colors shadow-sm cursor-pointer"
            title="Projekt als ZIP herunterladen"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Als ZIP exportieren</span>
          </button>

          {/* KI-Assistent show/hide Toggle button */}
          <button
            onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-semibold text-xs transition-all shadow-sm cursor-pointer ${
              isAiPanelOpen
                ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
                : "bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200"
            }`}
            title="KI Design- & Bug-Assistent einblenden/ausblenden"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiPanelOpen ? "text-yellow-300 animate-pulse" : "text-indigo-400"}`} />
            <span>✦ KI-Assistent</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout Block */}
      <main id="app-layout" className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Side File Explorer Container */}
        <section id="sidebar-explorer" className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          
          {/* Dropzone & Import Actions Header */}
          <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
            <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">Projekt-Import</div>
            
            <div className="grid grid-cols-2 gap-2">
              
              {/* Folder Selector Label */}
              <label 
                className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-950 transition-all cursor-pointer text-center group"
                title="Wähle einen ganzen Ordner von deinem Computer aus"
              >
                <Upload className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-1" />
                <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">Ordner hochladen</span>
                <span className="text-[9px] text-slate-500 mt-0.5">(Struktur bleibt!)</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFolderUpload}
                  className="hidden"
                  webkitdirectory=""
                  directory=""
                  multiple
                />
              </label>

              {/* Zip Archive Selector */}
              <label 
                className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-950 transition-all cursor-pointer text-center group"
                title="Lade eine Website-ZIP-Datei hoch"
              >
                <Download className="w-5 h-5 text-indigo-400 group-hover:scale-110 rotate-180 transition-transform mb-1" />
                <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">ZIP hochladen</span>
                <span className="text-[9px] text-slate-500 mt-0.5">(Entpackt direkt!)</span>
                <input
                  type="file"
                  ref={zipInputRef}
                  onChange={handleZipUpload}
                  className="hidden"
                  accept=".zip"
                />
              </label>
              
            </div>
          </div>

          <div className="p-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">Dateien ({Object.keys(files).filter(k => !k.endsWith(".keep")).length})</div>
            <div className="flex gap-1.5 items-center">
              <button
                onClick={() => {
                  if (confirm("Möchtest du wirklich alle Dateien und Ordner im Workspace löschen? Dies leert dein gesamtes Projekt, damit du neu starten kannst.")) {
                    setFiles({});
                    setSelectedFilePath("");
                    setEditorContent("");
                    setIsUnsaved(false);
                    setCurrentUrlPath("index.html");
                  }
                }}
                className="p-1 hover:bg-slate-800 rounded text-rose-400 hover:text-rose-300 transition-colors mr-1"
                title="Gesamtes Projekt leeren (Alle Dateien löschen)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setTargetFolderPath("");
                  setIsCreatingFile(true);
                }}
                className="p-1 hover:bg-slate-800 rounded text-indigo-400 hover:text-white transition-colors"
                title="Neue Datei im Hauptverzeichnis"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setTargetFolderPath("");
                  setIsCreatingFolder(true);
                }}
                className="p-1 hover:bg-slate-800 rounded text-yellow-500 hover:text-white transition-colors"
                title="Neuer Ordner im Hauptverzeichnis"
              >
                <Folder className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive tree file hierarchy display */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {Object.keys(files).length === 0 ? (
              <div className="text-center py-8 px-4 text-slate-500">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Keine Dateien vorhanden.</p>
                <p className="text-[10px] mt-1">Lade einen Ordner hoch oder klicke oben auf "Demo laden"!</p>
              </div>
            ) : (
              renderTreeNodes(treeNodes)
            )}
          </div>
        </section>

        {/* Center / Editor & Live preview columns stack */}
        <section id="workspace-center" className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-950 p-4 gap-4 h-full">
          
          {/* Editor block container */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-lg">
            
            {/* Editor tab heading info */}
            <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200 truncate">
                  {selectedFilePath ? selectedFilePath : "Keine Datei ausgewählt"}
                </span>
                {isUnsaved && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" title="Ungespeicherte Änderungen"></span>
                )}
              </div>
              
              {selectedFilePath && isTextFileType(selectedFilePath) && (
                <button
                  onClick={handleManualSave}
                  disabled={!isUnsaved}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold tracking-wide transition-all ${
                    isUnsaved 
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer" 
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <Save className="w-3 h-3" />
                  <span>Speichern</span>
                </button>
              )}
            </div>

            {/* Code Field or Binary Placeholder */}
            <div className="flex-1 relative overflow-hidden bg-[#090d16] flex">
              {selectedFilePath ? (
                isTextFileType(selectedFilePath) ? (
                  <div className="flex-1 flex font-mono text-sm leading-relaxed text-[#f8fafc] h-full overflow-hidden">
                    {/* Line Numbers column */}
                    <div className="p-4 bg-slate-950/40 text-slate-600 border-r border-slate-800/50 text-right select-none select-none min-w-[3rem] h-full overflow-y-hidden text-xs">
                      {editorContent.split("\n").map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    {/* Text field area */}
                    <textarea
                      value={editorContent}
                      onChange={handleEditorChange}
                      className="flex-1 w-full p-4 bg-transparent outline-none border-none resize-none overflow-y-auto align-top text-xs custom-scrollbar h-full focus:ring-0"
                      placeholder="Trage deinen HTML/CSS/JS-Code hier ein..."
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  // Binary Preview (Images, fonts, etc)
                  <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center border border-slate-700/50 shadow-md mb-4 text-indigo-400">
                      {guessContentType(selectedFilePath).startsWith("image/") ? (
                        <Image className="w-8 h-8" />
                      ) : (
                        <File className="w-8 h-8" />
                      )}
                    </div>
                    <div className="font-semibold text-slate-200 truncate max-w-xs">{selectedFilePath.split("/").pop()}</div>
                    <div className="text-xs text-slate-500 mt-1 uppercase">{guessContentType(selectedFilePath)}</div>
                    
                    {guessContentType(selectedFilePath).startsWith("image/") && files[selectedFilePath] && (
                      <div className="mt-6 max-w-full max-h-56 p-1 border border-slate-800 bg-slate-950/80 rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                        <img 
                          src={`data:${files[selectedFilePath].contentType};base64,${files[selectedFilePath].content}`}
                          alt="Asset Preview"
                          className="max-w-full max-h-48 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-2xl mb-3">
                    <FileCode className="w-8 h-8 text-indigo-500/50" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-300">Keine Datei ausgewählt</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    Klicke im linken Explorer auf eine Code-Datei, um sie zu bearbeiten. Wenn du Änderungen machst, klicke auf "Speichern" oder wechsle zur Live-Vorschau.
                  </p>
                </div>
              )}
            </div>

            {/* Editor info footer bar */}
            <div className="bg-slate-950 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0 select-none">
              <span>Lines: {editorContent.split("\n").length}</span>
              <span>Encoding: {selectedFilePath && files[selectedFilePath]?.encoding === "base64" ? "Base64 Binary" : "UTF-8 String"}</span>
            </div>
          </div>

          {/* Sandbox Live Preview Container */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-lg">
            
            {/* Browser frame decoration header bar */}
            <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center gap-3 shrink-0">
              {/* Colored buttons macOS style */}
              <div className="flex items-center gap-1.5 shrink-0 select-none">
                <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
              </div>

              {/* Live Status Address Bar Mockup */}
              <div className="flex-1 flex items-center justify-center gap-1.5 bg-[#090d16] border border-slate-850 px-3 py-1 rounded-lg text-[11px] text-slate-400 font-mono overflow-hidden truncate">
                <span className="text-indigo-400/50">http://sandbox.local/</span>
                <span className="text-slate-200 select-all truncate">{currentUrlPath}</span>
              </div>

              {/* Actions for sandbox */}
              <div className="flex items-center gap-1">
                {/* Manual frame reload */}
                <button
                  onClick={handleReloadPreview}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                  title="Vorschau aktualisieren"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                {/* External blank window target preview */}
                <a
                  href={`/site-preview/${siteId}/${currentUrlPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors flex items-center"
                  title="In neuem Tab öffnen"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Dynamic Iframe renderer sandbox container */}
            <div className="flex-1 bg-white relative">
              {Object.keys(files).length > 0 ? (
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  src={activePreviewUrl}
                  title="Interactive Website View"
                  className="w-full h-full border-none bg-white font-sans"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              ) : (
                <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <Play className="w-10 h-10 text-indigo-500/30 mb-2 animate-bounce" />
                  <p className="text-xs">Projekt-Vorschau ist bereit</p>
                  <p className="text-[10px] mt-1 text-slate-500">Lade ein funktionierendes Webprojekt hoch.</p>
                </div>
              )}
            </div>

            {/* Console output/info notice footer */}
            <div className="bg-slate-950 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-400 font-mono truncate shrink-0 select-none">
              💡 Relative Links (wie <code>&lt;a href="pages/features.html"&gt;</code>) funktionieren vollkommen reibungslos!
            </div>
          </div>
          
        </section>

        {/* Right Side AI Panel */}
        <AnimatePresence>
          {isAiPanelOpen && (
            <motion.section
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "24rem", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="w-full lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-hidden shadow-2xl relative"
            >
              <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-widest uppercase">KI-Design & Fehlerbehebung</h3>
                    <p className="text-[10px] text-slate-400 font-sans">Gemini-optimierter Projektverbund</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAiPanelOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Panel schließen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Central scroll container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900/20">
                
                {/* Visual Intro Info Box */}
                <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 p-3 rounded-xl border border-indigo-900/30">
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Unser KI-Assistent durchleuchtet hochgeladene Ordner nach typischen Web-Fehlern 
                    (wie fehlerhafte Links oder missglückte CSS-Dateipfade) und korrigiert diese auf Knopfdruck.
                  </p>
                </div>

                {/* Prompt Instruction fields */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    Spezifische Anpassungswünsche (Optional)
                  </label>
                  <textarea
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    placeholder="z.B.: 'Mache das Design moderner, verwende eine weiche violett-blaue Farbpalette im CSS und zentriere alle Hauptüberschriften' oder leer lassen für allgemeinen Bug-Fix..."
                    className="w-full h-24 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-0 resize-none font-sans transition-colors custom-scrollbar"
                  />
                  <p className="text-[10px] text-slate-500 font-medium">
                    Leer lassen für automatische Reparatur verwaister Pfade, Links und Syntaxmängel im geladenen Projekt.
                  </p>
                </div>

                {/* Trigger Analysis Button */}
                <button
                  onClick={handleExecuteAiAnalysis}
                  disabled={isAiLoading || Object.keys(files).length === 0}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-40 text-white flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed group font-sans font-semibold"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300 group-hover:rotate-12 transition-transform" />
                  <span>{isAiLoading ? "Analysiere Projekt..." : "Projekt optimieren & reparieren"}</span>
                </button>

                {/* Dynamic Status Display (with spinning glow) */}
                {isAiLoading && (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 bg-slate-950/40 rounded-xl border border-slate-800/80 animate-pulse">
                    <div className="relative flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-indigo-400 animate-spin"></div>
                      <Sparkles className="w-4 h-4 text-yellow-400 absolute animate-bounce" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white">{aiStatusMessage}</p>
                      <p className="text-[10px] text-slate-500">Bitte gedulde dich kurz, Gemini nimmt tiefgehende Vergleiche vor...</p>
                    </div>
                  </div>
                )}

                {/* Alert/Error notification block */}
                {aiError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex gap-2.5 text-left text-xs text-red-200">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-red-300">Analyse-Fehler</h4>
                      <p className="text-[11px] mt-0.5 leading-relaxed text-red-400">{aiError}</p>
                    </div>
                  </div>
                )}

                {/* Response / Explanation block from Gemini */}
                {aiExplanation && (
                  <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-3 text-left">
                    <div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                      <Brain className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Ergebnisse & Fehleranalyse</h4>
                    </div>
                    <div className="space-y-2 custom-scrollbar max-h-96 overflow-y-auto pr-1">
                      {renderMarkdownSimple(aiExplanation)}
                    </div>
                  </div>
                )}

                {/* Updates Log with Direct Action Trigger to Merge changes */}
                {aiChanges && Object.keys(aiChanges).length > 0 && (
                  <div className="bg-[#090d16] p-4 rounded-xl border border-indigo-950/50 shadow-inner text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Optimierungs-Update ({Object.keys(aiChanges).length})</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    </div>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                      {Object.keys(aiChanges).map((filePath) => (
                        <div key={filePath} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate text-[11px]">{filePath}</span>
                          </div>
                          <span className="text-[9px] font-mono bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 py-0.5 px-1.5 rounded uppercase font-medium">Bereit</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleApplyAiChanges}
                      className="w-full mt-2 cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide transition-all shadow-md group active:scale-95 duration-150"
                    >
                      <Check className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                      <span>Optimierte Dateien anwenden</span>
                    </button>
                    <p className="text-[10px] text-slate-500 text-center font-sans leading-relaxed">
                      Durch Klick werden alle geänderten und reparierten Web-Dateien direkt übernommen und der Vorschau-Server aktualisiert.
                    </p>
                  </div>
                )}

              </div>
            </motion.section>
          )}
        </AnimatePresence>

      </main>

      {/* CREATE FILE DIALOG ANCHOR (FADE-IN ANIMATION OVERLAY) */}
      <AnimatePresence>
        {isCreatingFile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-400" />
                Neue Datei anlegen
              </h3>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium font-semibold">Ziel-Verzeichnis:</label>
                <div className="text-xs bg-slate-950 p-2 rounded-lg border border-slate-800 text-emerald-400 font-mono truncate">
                  {targetFolderPath ? `/${targetFolderPath}/` : "Root (Hauptverzeichnis)"}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium font-semibold">Dateiname (inkl. Endung, z.B. contact.html):</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="index.html, styles.css oder script.js"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddNewFile();
                    if (e.key === "Escape") setIsCreatingFile(false);
                  }}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setNewItemName("");
                    setIsCreatingFile(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleAddNewFile}
                  disabled={!newItemName.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Erstellen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE FOLDER DIALOG ANCHOR (FADE-IN ANIMATION OVERLAY) */}
      <AnimatePresence>
        {isCreatingFolder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Folder className="w-5 h-5 text-yellow-500" />
                Neuen Ordner anlegen
              </h3>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium font-semibold">Ziel-Verzeichnis:</label>
                <div className="text-xs bg-slate-950 p-2 rounded-lg border border-slate-800 text-emerald-400 font-mono truncate">
                  {targetFolderPath ? `/${targetFolderPath}/` : "Root (Hauptverzeichnis)"}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium font-semibold">Ordnername (z.B. img oder subfolder):</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="z.B. assets, css, js"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddNewFolder();
                    if (e.key === "Escape") setIsCreatingFolder(false);
                  }}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setNewItemName("");
                    setIsCreatingFolder(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleAddNewFolder}
                  disabled={!newItemName.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-semibold cursor-pointer transition-colors"
                >
                  Erstellen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
