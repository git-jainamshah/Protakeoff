import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, FolderOpen, Clock, Users, FileText, Search,
  MoreVertical, Archive, Trash2, Building2, MapPin, User2
} from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn, formatDate, timeAgo, STATUS_COLORS, ROLE_COLORS } from '@/lib/utils';
import type { Project } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(2, 'Project name required'),
  description: z.string().optional(),
  address: z.string().optional(),
  clientName: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function ProjectCard({ project, onOpen }: { project: Project; onOpen: (p: Project) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project deleted'); },
  });

  const archiveMutation = useMutation({
    mutationFn: () => projectsApi.update(project.id, { status: 'ARCHIVED' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project archived'); },
  });

  return (
    <div
      className="card p-5 hover:border-slate-600 hover:shadow-card-hover transition-all duration-200 cursor-pointer group"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-800 to-brand-900 flex items-center justify-center border border-brand-700/50">
            <FolderOpen className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 group-hover:text-slate-900 transition-colors leading-tight">
              {project.name}
            </h3>
            {project.clientName && (
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <User2 className="w-3 h-3" /> {project.clientName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn('badge border text-[10px]', STATUS_COLORS[project.status])}>
            {project.status}
          </span>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="btn-ghost p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-20 card shadow-glass py-1 w-36 animate-fade-in">
                <button
                  onClick={() => { onOpen(project); setMenuOpen(false); }}
                  className="w-full px-3 py-1.5 text-xs text-left text-slate-300 hover:bg-surface-hover flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" /> View details
                </button>
                <button
                  onClick={() => { archiveMutation.mutate(); setMenuOpen(false); }}
                  className="w-full px-3 py-1.5 text-xs text-left text-slate-300 hover:bg-surface-hover flex items-center gap-2"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
                <hr className="border-surface-border my-1" />
                <button
                  onClick={() => { if (confirm('Delete this project?')) deleteMutation.mutate(); setMenuOpen(false); }}
                  className="w-full px-3 py-1.5 text-xs text-left text-red-400 hover:bg-red-400/10 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {project.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>
      )}

      {project.address && (
        <p className="text-xs text-slate-600 mb-3 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {project.address}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-600 mt-4 pt-3 border-t border-surface-border">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {project._count?.documents ?? 0}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {project._count?.members ?? 0}</span>
        </div>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(project.updatedAt)}</span>
      </div>

      {project.memberRole && (
        <div className="mt-2">
          <span className={cn('badge border text-[10px]', ROLE_COLORS[project.memberRole])}>
            {project.memberRole}
          </span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => projectsApi.create(data),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setCreateOpen(false);
      toast.success('Project created!');
      navigate(`/projects/${project.id}`);
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const filtered = (projects as Project[]).filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="text-gradient">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {user?.company?.name} · {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => { reset(); setCreateOpen(true); }} size="md">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Projects', value: projects.length, icon: FolderOpen, color: 'text-blue-400' },
          { label: 'Active', value: (projects as Project[]).filter((p) => p.status === 'ACTIVE').length, icon: Building2, color: 'text-emerald-400' },
          { label: 'Completed', value: (projects as Project[]).filter((p) => p.status === 'COMPLETED').length, icon: FileText, color: 'text-purple-400' },
          { label: 'Archived', value: (projects as Project[]).filter((p) => p.status === 'ARCHIVED').length, icon: Archive, color: 'text-slate-400' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">{s.label}</p>
              <s.icon className={cn('w-4 h-4', s.color)} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-card border border-surface-border text-slate-400 hover:text-slate-200'
              )}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <PageLoader label="Loading projects..." />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No projects yet</h3>
          <p className="text-sm text-slate-600 mb-6 max-w-xs">
            Create your first project to start uploading plans and building estimates.
          </p>
          <Button onClick={() => { reset(); setCreateOpen(true); }}>
            <Plus className="w-4 h-4" /> Create first project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={(proj) => navigate(`/projects/${proj.id}`)} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Project"
        description="Create a new construction project"
      >
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Input
            label="Project name *"
            placeholder="Downtown Office Complex"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Client name"
            placeholder="Acme Realty Group"
            {...register('clientName')}
          />
          <Input
            label="Project address"
            placeholder="123 Main St, City, State"
            {...register('address')}
          />
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Brief project overview..."
              {...register('description')}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting || createMutation.isPending}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
