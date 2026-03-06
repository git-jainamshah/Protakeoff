import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, pattern = 'MMM d, yyyy') {
  return format(new Date(date), pattern);
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatArea(sqUnits: number, unit = 'ft', scale = 1): string {
  const area = sqUnits / (scale * scale);
  return `${area.toFixed(2)} sq ${unit}`;
}

export function formatLength(pixels: number, unit = 'ft', scale = 1): string {
  const length = pixels / scale;
  return `${length.toFixed(2)} ${unit}`;
}

// Shoelace formula
export function calcPolygonArea(points: number[]): number {
  let area = 0;
  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i * 2] * points[j * 2 + 1];
    area -= points[j * 2] * points[i * 2 + 1];
  }
  return Math.abs(area) / 2;
}

export function calcPolygonCentroid(points: number[]): { x: number; y: number } {
  let cx = 0, cy = 0;
  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    cx += points[i * 2];
    cy += points[i * 2 + 1];
  }
  return { x: cx / n, y: cy / n };
}

export function calcLineLength(points: number[]): number {
  if (points.length < 4) return 0;
  const dx = points[2] - points[0];
  const dy = points[3] - points[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  ARCHIVED: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  COMPLETED: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

export const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  EDIT: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  VIEW: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  SUPER_ADMIN: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  MEMBER: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
};
