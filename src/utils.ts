import { FileSystemRecord, TreeNode } from "./types";

/**
 * Builds a hierarchical tree structure from a flat map of relative file paths.
 */
export function buildTree(files: FileSystemRecord): TreeNode[] {
  const root: TreeNode[] = [];

  Object.keys(files).forEach((filePath) => {
    const parts = filePath.split("/");
    let currentLevel = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = index === parts.length - 1;

      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          type: isLast ? "file" : "directory",
          isOpen: true, // Default to expanded
        };
        if (!isLast) {
          existingNode.children = [];
        }
        currentLevel.push(existingNode);
      }

      if (!isLast && existingNode.children) {
        currentLevel = existingNode.children;
      }
    });
  });

  // Sort directories first, then files alphabetically
  const sortTree = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map((node) => {
        if (node.children) {
          node.children = sortTree(node.children);
        }
        return node;
      });
  };

  return sortTree(root);
}

/**
 * Client-side helper to determine MIME content types for file uploads or creation.
 */
export function guessContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
    case "htm":
      return "text/html; charset=utf-8";
    case "css":
      return "text/css; charset=utf-8";
    case "js":
    case "mjs":
      return "application/javascript; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml; charset=utf-8";
    case "webp":
      return "image/webp";
    case "woff":
      return "font/woff";
    case "woff2":
      return "font/woff2";
    case "ttf":
      return "font/ttf";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

/**
 * Returns whether a file format is a viewable text type or a binary item (image/font)
 */
export function isTextFileType(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ["html", "htm", "css", "js", "mjs", "json", "svg", "txt", "md"].includes(ext || "");
}
