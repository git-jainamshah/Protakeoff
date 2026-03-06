import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Upload, FileText, Plus, Trash2, Users, Settings,
  ChevronRight, Clock, Layers, Eye, Edit3, Shield, ExternalLink
} from 'lucide-react';
import { projectsApi, documentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn, formatDate, formatFileSize, timeAgo, ROLE_COLORS } from '@/lib/utils';
import type { Document, ProjectMember } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoader } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

function roleIcon(role: string) {
  if (role === 'ADMIN') return <Shield className="w-3 h-3" />;
  if (role === 'EDIT') return <Edit3 className="w-3 h-3" />;
  return <Eye className="w-3 h-3" />;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'plans' | 'team'>('plans');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEW');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name.replace(/\.[^/.]+$/, ''));
      return documentsApi.upload(id!, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Plan uploaded successfully');
    },
    onSettled: () => setUploading(false),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.delete(docId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); toast.success('Plan deleted'); },
  });

  const inviteMutation = useMutation({
    mutationFn: () => projectsApi.addMember(id!, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      setInviteOpen(false);
      setInviteEmail('');
      toast.success('Member invited!');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id!, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); toast.success('Member removed'); },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    uploadMutation.mutate(file);
    e.target.value = '';
  };

  if (isLoading) return <PageLoader label="Loading project..." />;
  if (!project) return <div className="p-8 text-slate-400">Project not found</div>;

  const isAdmin = project.memberRole === 'ADMIN' || project.createdById === user?.id;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
        <Link to="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-300">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-lg mt-0.5">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <Badge variant={project.status === 'ACTIVE' ? 'success' : project.status === 'COMPLETED' ? 'info' : 'default'}>
                {project.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {project.clientName && <span>{project.clientName}</span>}
              {project.address && <span>{project.address}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Updated {timeAgo(project.updatedAt)}</span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setInviteOpen(true)}
            >
              <Users className="w-3.5 h-3.5" /> Invite
            </Button>
            <Button
              size="sm"
              onClick={() => fileRef.current?.click()}
              loading={uploading}
            >
              <Upload className="w-3.5 h-3.5" /> Upload Plan
            </Button>
            <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChange} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-surface-border mb-6">
        {[
          { id: 'plans', label: 'Plans', icon: Layers, count: project.documents?.length },
          { id: 'team', label: 'Team', icon: Users, count: project.members?.length },
        ].map(({ id: tid, label, icon: Icon, count }) => (
          <button
            key={tid}
            onClick={() => setActiveTab(tid as 'plans' | 'team')}
            className={cn(
              'flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tid
                ? 'text-brand-400 border-brand-500'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count !== undefined && (
              <span className={cn(
                'text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center',
                activeTab === tid ? 'bg-brand-900 text-brand-300' : 'bg-surface-card text-slate-500'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div>
          {!project.documents?.length ? (
            <div
              className="border-2 border-dashed border-surface-border rounded-xl p-16 text-center hover:border-slate-600 transition-colors cursor-pointer"
              onClick={() => isAdmin && fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-400 mb-1">No plans uploaded yet</h3>
              <p className="text-sm text-slate-600 mb-4">Upload PDF construction plans to start your takeoff</p>
              {isAdmin && (
                <Button size="sm" onClick={() => fileRef.current?.click()}>
                  <Plus className="w-4 h-4" /> Upload First Plan
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(project.documents as Document[]).map((doc) => (
                <div
                  key={doc.id}
                  className="card p-4 hover:border-slate-600 hover:shadow-card-hover transition-all cursor-pointer group"
                  onClick={() => navigate(`/projects/${id}/takeoff/${doc.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/projects/${id}/takeoff/${doc.id}`)}
                        className="btn-ghost p-1.5 rounded"
                        title="Open takeoff"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => { if (confirm('Delete this plan?')) deleteDocMutation.mutate(doc.id); }}
                          className="btn-ghost p-1.5 rounded text-red-400 hover:text-red-300"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-200 truncate mb-1">{doc.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>{doc.pageCount} page{doc.pageCount > 1 ? 's' : ''}</span>
                    {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
              ))}

              {isAdmin && (
                <div
                  className="card p-4 border-dashed hover:border-slate-500 transition-colors cursor-pointer flex items-center justify-center min-h-[120px] text-slate-600 hover:text-slate-400"
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="text-center">
                    <Plus className="w-6 h-6 mx-auto mb-1" />
                    <p className="text-xs">Upload plan</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-2">
          {(project.members as ProjectMember[])?.map((member) => (
            <div key={member.id} className="card px-4 py-3 flex items-center gap-4">
              <Avatar name={member.user.name} src={member.user.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{member.user.name}</p>
                <p className="text-xs text-slate-500">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('badge border flex items-center gap-1', ROLE_COLORS[member.role])}>
                  {roleIcon(member.role)} {member.role}
                </span>
                {isAdmin && member.userId !== user?.id && (
                  <button
                    onClick={() => { if (confirm('Remove this member?')) removeMemberMutation.mutate(member.userId); }}
                    className="btn-ghost p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member">
        <div className="space-y-4">
          <Input
            label="Email address"
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Access level</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { role: 'ADMIN', desc: 'Full access', icon: Shield },
                { role: 'EDIT', desc: 'Can edit', icon: Edit3 },
                { role: 'VIEW', desc: 'View only', icon: Eye },
              ].map(({ role, desc, icon: Icon }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setInviteRole(role)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    inviteRole === role
                      ? 'border-brand-500 bg-brand-950/40'
                      : 'border-surface-border bg-surface-card hover:border-slate-500'
                  )}
                >
                  <Icon className={cn('w-4 h-4 mb-1.5', inviteRole === role ? 'text-brand-400' : 'text-slate-500')} />
                  <p className="text-xs font-medium text-slate-300">{role}</p>
                  <p className="text-[11px] text-slate-600">{desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              className="flex-1"
              loading={inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail}
            >
              Send Invite
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
