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
    { label: 'Total Users', value: stats.counts.users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 border border-blue-100' },
    { label: 'Companies', value: stats.counts.companies, icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50 border border-purple-100' },
    { label: 'Projects', value: stats.counts.projects, icon: FolderOpen, color: 'text-emerald-600', bg: 'bg-emerald-50 border border-emerald-100' },
    { label: 'Documents', value: stats.counts.documents, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50 border border-amber-100' },
    { label: 'Shapes Drawn', value: stats.counts.shapes, icon: Layers, color: 'text-rose-600', bg: 'bg-rose-50 border border-rose-100' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
          </div>
          <p className="text-slate-500 text-sm">Platform overview and management</p>
        </div>
        <button
          onClick={() => navigate('/admin/versions')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:border-brand-500 hover:text-brand-600 transition-colors shadow-sm"
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
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', s.bg)}>
              <s.icon className={cn('w-5 h-5', s.color)} />
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-0.5">{s.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800">Recent Projects</h2>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recentProjects.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">No projects yet</p>
            ) : stats.recentProjects.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 truncate">{p.company?.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge variant={p.status === 'ACTIVE' ? 'success' : p.status === 'COMPLETED' ? 'info' : 'default'}>
                    {p.status}
                  </Badge>
                  <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(p.updatedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Users */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800">Recent Users</h2>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recentUsers.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">No users yet</p>
            ) : stats.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <Avatar name={u.name} src={u.avatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={cn('badge border text-[10px]', ROLE_COLORS[u.role])}>{u.role}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(u.createdAt!)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform Info */}
      <div className="mt-6 card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <Layers className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">ProTakeOff Platform</p>
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
            <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
              <p className="text-sm text-slate-700 font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
