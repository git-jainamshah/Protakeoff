import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { cn, timeAgo, ROLE_COLORS } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import {
  Users, FolderOpen, FileText, Layers, GitBranch, ArrowRight,
  Building2, Activity, Shield, TrendingUp
} from 'lucide-react';
import type { AdminStats } from '@/types';

export default function AdminPage() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: adminApi.stats,
    staleTime: 30000,
  });

  if (isLoading) return <PageLoader label="Loading admin data..." />;
  if (!stats) return <div className="p-8 text-slate-400">Unable to load admin data</div>;

  const STAT_CARDS = [
    { label: 'Total Users', value: stats.counts.users, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Companies', value: stats.counts.companies, icon: Building2, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'Projects', value: stats.counts.projects, icon: FolderOpen, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Documents', value: stats.counts.documents, icon: FileText, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Shapes Drawn', value: stats.counts.shapes, icon: Layers, color: 'text-rose-400', bg: 'bg-rose-400/10' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          </div>
          <p className="text-slate-500 text-sm">Platform overview and management</p>
        </div>
        <button
          onClick={() => navigate('/admin/versions')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-card border border-surface-border text-sm text-slate-300 hover:border-brand-500 hover:text-brand-400 transition-colors"
        >
          <GitBranch className="w-4 h-4" />
          Version History
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="card p-5">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', s.bg)}>
              <s.icon className={cn('w-4.5 h-4.5', s.color)} />
            </div>
            <p className="text-2xl font-bold text-white mb-0.5">{s.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-200">Recent Projects</h2>
            </div>
          </div>
          <div className="divide-y divide-surface-border/50">
            {stats.recentProjects.length === 0 ? (
              <p className="p-5 text-sm text-slate-600">No projects yet</p>
            ) : stats.recentProjects.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-4 hover:bg-surface-hover/30 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                <div className="w-8 h-8 rounded-lg bg-brand-900/40 border border-brand-800/40 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 truncate">{p.company?.name}</p>
                </div>
                <div className="text-right">
                  <Badge variant={p.status === 'ACTIVE' ? 'success' : p.status === 'COMPLETED' ? 'info' : 'default'}>
                    {p.status}
                  </Badge>
                  <p className="text-[10px] text-slate-600 mt-0.5">{timeAgo(p.updatedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Users */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-200">Recent Users</h2>
            </div>
          </div>
          <div className="divide-y divide-surface-border/50">
            {stats.recentUsers.length === 0 ? (
              <p className="p-5 text-sm text-slate-600">No users yet</p>
            ) : stats.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-4 hover:bg-surface-hover/30 transition-colors">
                <Avatar name={u.name} src={u.avatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{u.name}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                <div className="text-right">
                  <span className={cn('badge border text-[10px]', ROLE_COLORS[u.role])}>{u.role}</span>
                  <p className="text-[10px] text-slate-600 mt-0.5">{timeAgo(u.createdAt!)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform Info */}
      <div className="mt-6 card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">ProTakeOff Platform</p>
            <p className="text-xs text-slate-500">Precision Takeoffs. Professional Estimates.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Version', value: 'v1.0.0' },
            { label: 'Environment', value: 'Production' },
            { label: 'GitHub', value: 'git-jainamshah/Protakeoff' },
            { label: 'License', value: 'Enterprise' },
          ].map((item) => (
            <div key={item.label} className="bg-surface rounded-lg p-3 border border-surface-border">
              <p className="text-[10px] text-slate-600 mb-1">{item.label}</p>
              <p className="text-xs text-slate-300 font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
