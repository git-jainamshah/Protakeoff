// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  avatar?: string | null;
  company?: Company | null;
  createdAt?: string;
}

export interface Company {
  id: string;
  name: string;
  logo?: string | null;
  website?: string | null;
  plan?: string;
  address?: string | null;
  phone?: string | null;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
export type MemberRole = 'ADMIN' | 'EDIT' | 'VIEW';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  address?: string | null;
  clientName?: string | null;
  thumbnail?: string | null;
  companyId: string;
  company?: { id: string; name: string };
  createdById: string;
  createdBy?: { id: string; name: string; email: string; avatar?: string | null };
  members?: ProjectMember[];
  documents?: Document[];
  memberRole?: MemberRole | 'ADMIN';
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number; members: number };
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user: { id: string; name: string; email: string; avatar?: string | null; role: string };
  role: MemberRole;
  createdAt: string;
}

// ─── Document ─────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  name: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileSize?: number | null;
  pageCount: number;
  thumbnail?: string | null;
  scale: number;
  unit: string;
  projectId: string;
  layers?: Layer[];
  createdAt: string;
  updatedAt: string;
}

// ─── Layer / Shape ────────────────────────────────────────────────────────────

export type LayerType = 'AREA' | 'LINEAR' | 'COUNT';
export type ShapeType = 'RECT' | 'POLYGON' | 'LINE' | 'CIRCLE';

export interface Layer {
  id: string;
  name: string;
  color: string;
  type: LayerType;
  visible: boolean;
  order: number;
  documentId: string;
  shapes: Shape[];
  createdAt: string;
  updatedAt: string;
}

export interface Shape {
  id: string;
  type: ShapeType;
  data: ShapeData;
  label?: string | null;
  color?: string | null;
  layerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RectData { x: number; y: number; width: number; height: number; rotation?: number; }
export interface PolygonData { points: number[]; }
export interface LineData { points: number[]; }
export interface CircleData { x: number; y: number; radius: number; }
export type ShapeData = RectData | PolygonData | LineData | CircleData;

// Local canvas shape (before saving to server)
export interface CanvasShape {
  id: string;
  type: ShapeType;
  data: ShapeData;
  label?: string;
  color?: string;
  layerId: string;
  isNew?: boolean;
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export type ToolType = 'select' | 'pan' | 'rect' | 'polygon' | 'line' | 'circle' | 'calibrate' | 'eraser';

export interface ToolConfig {
  id: ToolType;
  label: string;
  icon: string;
  shortcut: string;
  description: string;
}

// ─── Admin / Git ──────────────────────────────────────────────────────────────

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email?: string;
  date: string;
  refs?: string;
  url?: string;
}

export interface GitStatus {
  commits: GitCommit[];
  currentBranch: string;
  currentHash: string;
  hasUncommittedChanges: boolean;
  status: string;
}

export interface AdminStats {
  counts: {
    users: number;
    companies: number;
    projects: number;
    documents: number;
    shapes: number;
  };
  recentProjects: Project[];
  recentUsers: User[];
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: string;
}
