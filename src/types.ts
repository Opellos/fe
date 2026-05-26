/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProjectFile {
  content: string;
  encoding: "utf-8" | "base64";
  contentType: string;
  size?: number;
}

export type FileSystemRecord = Record<string, ProjectFile>;

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
  isOpen?: boolean;
}
