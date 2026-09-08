import { Type, type Static } from "@sinclair/typebox";

export const WorkspaceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    name: Type.String(),
    rootPath: Type.String(),
    subPaths: Type.Array(Type.String()),
    providerId: Type.String(),
    createdAt: Type.Integer(),
    lastOpenedAt: Type.Integer(),
  },
  { $id: "Workspace" }
);
export type Workspace = Static<typeof WorkspaceSchema>;

export const WorkspaceCreateInputSchema = Type.Object(
  {
    name: Type.String(),
    rootPath: Type.String(),
    subPaths: Type.Optional(Type.Array(Type.String())),
    providerId: Type.String(),
  },
  { $id: "WorkspaceCreateInput" }
);
export type WorkspaceCreateInput = Static<typeof WorkspaceCreateInputSchema>;

export const FileTreeNodeSchema = Type.Object(
  {
    name: Type.String(),
    path: Type.String(),
    isDirectory: Type.Boolean(),
    size: Type.Optional(Type.Integer()),
    children: Type.Optional(Type.Array(Type.Any())), // Recursive FileTreeNode
  },
  { $id: "FileTreeNode" }
);
export type FileTreeNode = Static<typeof FileTreeNodeSchema>;
