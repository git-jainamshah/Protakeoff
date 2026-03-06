import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { PageLoader } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  GitBranch, GitCommit, ArrowLeft, RefreshCw, ExternalLink,
  Clock, User, Hash, AlertTriangle, Github, Layers, CheckCircle,
  RotateCcw, History
} from 'lucide-react';
import type { GitStatus, GitCommit as GitCommitType } from '@/types';
import toast from 'react-hot-toast';

function CommitCard({
  commit, isCurrent, index, onRestore,
}: {
  commit: GitCommitType;
  isCurrent: boolean;
  index: number;
  onRestore: (hash: string, message: string) => void;
}) {
  const isRecent = index < 5;
  const canRestore = index > 0;

  return (
    <div className={cn(
      'relative flex gap-4 pb-4',
      index < 19 && 'before:absolute before:left-[17px] before:top-8 before:bottom-0 before:w-px before:bg-surface-border'
    )}>
      {/* Timeline dot */}
      <div className={cn(
        'relative z-10 w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0',
        isCurrent
          ? 'bg-brand-600 border-brand-500 shadow-sm shadow-brand-500/30'
          : isRecent ? 'bg-surface-card border-surface-border' : 'bg-surface border-surface-border'
      )}>
        {isCurrent
          ? <CheckCircle className="w-4 h-4 text-white" />
          : <GitCommit className={cn('w-4 h-4', isRecent ? 'text-slate-400' : 'text-slate-600')} />
        }
      </div>

      {/* Content */}
      <div className={cn(
        'flex-1 card p-4 transition-all',
        isCurrent && 'border-brand-500/40 bg-brand-950/20'
      )}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {isCurrent && <Badge variant="info">Current</Badge>}
              {index === 0 && !isCurrent && <Badge variant="default">Latest</Badge>}
            </div>
            <p className="text-sm font-medium text-slate-700 leading-tight">{commit.message}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {commit.url && (
              <a href={commit.url} target="_blank" rel="noopener noreferrer"
                className="btn-ghost p-1.5 rounded" title="View on GitHub">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {canRestore && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRestore(commit.hash, commit.message)}
                className="text-xs"
              >
                <RotateCcw className="w-3 h-3" /> Restore
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            <code className="font-mono text-slate-500">{commit.shortHash}</code>
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" /> {commit.author}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeAgo(commit.date)}
          </span>
          {commit.refs && commit.refs.includes('HEAD') && (
            <span className="flex items-center gap-1 text-brand-400">
              <GitBranch className="w-3 h-3" /> {commit.refs.replace(/.*HEAD -> /, '').split(',')[0].trim()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VersionHistoryPage() {
  const navigate = useNavigate();
  const [source, setSource] = useState<'local' | 'github'>('local');
  const [confirmRestore, setConfirmRestore] = useState<{ hash: string; message: string } | null>(null);

  const localQuery = useQuery<GitStatus>({
    queryKey: ['git-log'],
    queryFn: adminApi.gitLog,
    enabled: source === 'local',
    staleTime: 30000,
    retry: false,
  });

  const githubQuery = useQuery<GitCommitType[]>({
    queryKey: ['github-commits'],
    queryFn: adminApi.githubCommits,
    enabled: source === 'github',
    staleTime: 60000,
    retry: false,
  });

  const restoreMutation = useMutation({
    mutationFn: (hash: string) => adminApi.restore(hash),
    onSuccess: (data) => {
      toast.success(data.message || 'Restored successfully!');
      setConfirmRestore(null);
      localQuery.refetch();
    },
    onError: () => {
      setConfirmRestore(null);
    },
  });

  const isLoading = source === 'local' ? localQuery.isLoading : githubQuery.isLoading;
  const error = source === 'local' ? localQuery.error : githubQuery.error;

  const commits: GitCommitType[] = source === 'local'
    ? localQuery.data?.commits || []
    : githubQuery.data || [];

  const currentHash = localQuery.data?.currentHash;
  const currentBranch = localQuery.data?.currentBranch;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <button onClick={() => navigate('/admin')} className="btn-ghost p-2 rounded-lg mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <History className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-bold text-white">Version History</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Browse commit history and restore the platform to any previous version
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => source === 'local' ? localQuery.refetch() : githubQuery.refetch()}
          loading={isLoading}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Source Selector */}
      <div className="flex gap-2 mb-6 p-1 bg-surface-card border border-surface-border rounded-lg w-fit">
        <button
          onClick={() => setSource('local')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
            source === 'local' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-600'
          )}
        >
          <GitBranch className="w-4 h-4" /> Local Repository
        </button>
        <button
          onClick={() => setSource('github')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
            source === 'github' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-600'
          )}
        >
          <Github className="w-4 h-4" /> GitHub Remote
        </button>
      </div>

      {/* Status Bar */}
      {source === 'local' && localQuery.data && (
        <div className="card p-4 mb-6 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-400">
              Branch: <code className="text-brand-400 font-mono">{currentBranch}</code>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="w-3 h-3 text-slate-600" />
            <span className="text-xs text-slate-400">
              HEAD: <code className="text-slate-400 font-mono">{currentHash?.slice(0, 8)}</code>
            </span>
          </div>
          {localQuery.data.hasUncommittedChanges && (
            <div className="flex items-center gap-1.5 text-amber-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              Uncommitted changes present
            </div>
          )}
        </div>
      )}

      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-300">About Version Restore</p>
          <p className="text-xs text-amber-400/80 mt-0.5">
            Restoring to a previous version runs <code className="bg-amber-500/20 px-1 rounded font-mono">git stash && git checkout &lt;hash&gt;</code>.
            Your current work will be stashed. You can recover it with <code className="bg-amber-500/20 px-1 rounded font-mono">git stash pop</code>.
            Restart the dev server after restoring.
          </p>
        </div>
      </div>

      {/* Commit Timeline */}
      {isLoading ? (
        <PageLoader label="Loading version history..." />
      ) : error ? (
        <div className="card p-8 text-center">
          <GitBranch className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-1">Unable to load version history</p>
          <p className="text-xs text-slate-600">
            {source === 'github'
              ? 'The GitHub repository may be private or rate-limited. Add a GITHUB_TOKEN in backend .env.local.'
              : 'Ensure this is a git repository and the backend is running.'}
          </p>
        </div>
      ) : commits.length === 0 ? (
        <div className="card p-8 text-center">
          <GitCommit className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No commits found</p>
        </div>
      ) : (
        <div className="space-y-0">
          {commits.map((commit, i) => (
            <CommitCard
              key={commit.hash}
              commit={commit}
              isCurrent={commit.hash === currentHash || commit.shortHash === currentHash?.slice(0, 7)}
              index={i}
              onRestore={(hash, message) => setConfirmRestore({ hash, message })}
            />
          ))}
        </div>
      )}

      {/* Confirm Restore Modal */}
      <Modal
        open={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        title="Confirm Version Restore"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-300 font-medium mb-1">Restoring to:</p>
            <p className="text-xs text-amber-400 font-mono">{confirmRestore?.hash.slice(0, 12)}</p>
            <p className="text-sm text-slate-600 mt-1">{confirmRestore?.message}</p>
          </div>
          <p className="text-sm text-slate-400">
            This will check out the selected commit. Your current uncommitted work will be stashed automatically.
            You'll need to restart the server for code changes to take effect.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmRestore(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={restoreMutation.isPending}
              onClick={() => confirmRestore && restoreMutation.mutate(confirmRestore.hash)}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
