import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || 'Something went wrong';
    if (err.response?.status === 401) {
      localStorage.removeItem('pt_token');
      localStorage.removeItem('pt_user');
      window.location.href = '/login';
    } else if (err.response?.status !== 404) {
      toast.error(message);
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { name: string; email: string; password: string; companyName?: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateMe: (data: { name?: string; avatar?: string }) =>
    api.put('/auth/me', data).then((r) => r.data),
  updatePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/me/password', data).then((r) => r.data),
};

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get('/projects').then((r) => r.data),
  get: (id: string) => api.get(`/projects/${id}`).then((r) => r.data),
  create: (data: { name: string; description?: string; address?: string; clientName?: string }) =>
    api.post('/projects', data).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; description: string; address: string; clientName: string; status: string }>) =>
    api.put(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data),
  addMember: (id: string, data: { email: string; role: string }) =>
    api.post(`/projects/${id}/members`, data).then((r) => r.data),
  updateMember: (id: string, userId: string, data: { role: string }) =>
    api.put(`/projects/${id}/members/${userId}`, data).then((r) => r.data),
  removeMember: (id: string, userId: string) =>
    api.delete(`/projects/${id}/members/${userId}`).then((r) => r.data),
};

// ─── Documents ────────────────────────────────────────────────────────────────
export const documentsApi = {
  list: (projectId: string) => api.get(`/documents/project/${projectId}`).then((r) => r.data),
  get: (id: string) => api.get(`/documents/${id}`).then((r) => r.data),
  upload: (projectId: string, formData: FormData) =>
    api.post(`/documents/project/${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; scale: number; unit: string }>) =>
    api.put(`/documents/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/documents/${id}`).then((r) => r.data),
};

// ─── Layers ───────────────────────────────────────────────────────────────────
export const layersApi = {
  list: (documentId: string) => api.get(`/layers/document/${documentId}`).then((r) => r.data),
  create: (documentId: string, data: { name: string; color?: string; type?: string }) =>
    api.post(`/layers/document/${documentId}`, data).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; color: string; type: string; visible: boolean; order: number }>) =>
    api.put(`/layers/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/layers/${id}`).then((r) => r.data),
};

// ─── Shapes ───────────────────────────────────────────────────────────────────
export const shapesApi = {
  list: (layerId: string) => api.get(`/shapes/layer/${layerId}`).then((r) => r.data),
  create: (layerId: string, data: { type: string; data: unknown; label?: string; color?: string }) =>
    api.post(`/shapes/layer/${layerId}`, data).then((r) => r.data),
  batchSave: (layerId: string, shapes: Array<{ type: string; data: unknown; label?: string; color?: string }>) =>
    api.post(`/shapes/layer/${layerId}/batch`, { shapes }).then((r) => r.data),
  update: (id: string, data: Partial<{ type: string; data: unknown; label: string; color: string }>) =>
    api.put(`/shapes/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/shapes/${id}`).then((r) => r.data),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  stats: () => api.get('/admin/stats').then((r) => r.data),
  gitLog: () => api.get('/admin/git/log').then((r) => r.data),
  githubCommits: () => api.get('/admin/github/commits').then((r) => r.data),
  restore: (hash: string) => api.post(`/admin/git/restore/${hash}`).then((r) => r.data),
  restoreLatest: () => api.post('/admin/git/restore-latest').then((r) => r.data),
  users: () => api.get('/admin/users').then((r) => r.data),
};
