import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import { PageLoader } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  GitBranch, GitCommit, ArrowLeft, RefreshCw, ExternalLink,
  Clock, User, Hash, AlertTriangle, Github,
  CheckCircle2, RotateCcw, History, Unlock
} from 'lucide-react';
import type { GitStatus, GitCommit as GitCommitType } from '@/types';
import toast from 'react-hot-toast';

const REPO_URL = 'https://github.com/git-jainamshah/Protakeoff';
// Only show Restore button for the most recent N commits
const MAX_RESTORABLE = 6;

// ─── Single commit row ────────────────────────────────────────────────────────
function CommitRow({
  commit, index, isCurrent, onRestore,
}: {
  commit: GitCommitType; index: number; isCurrent: boolean;
  onRestore: (hash: string, message: string) => void;
}) {
  const isRestorable = index > 0 && index < MAX_RESTORABLE;
  const isLatest = index === 0;

  return (
    <div className={cn(
      'relative flex gap-3',
      index < 19 && 'pb-0',
    )}>
      {/* Vertical line */}
      {index < 19 && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-slate-200 z-0" />
      )}

      {/* Node dot */}
      <div className={cn(
        'relative z-10 mt-3 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2',
        isCurrent
          ? 'bg-brand-600 border-brand-500 shadow-md'
          : isLatest
            ? 'bg-emerald-50 border-emerald-300'
            : isRestorable
              ? 'bg-white border-slate-300'
              : 'bg-slate-50 border-slate-200',
      )}>
        {isCurrent
          ? <CheckCircle2 className="w-4 h-4 text-white" />
          : isLatest
            ? <GitCommit className="w-4 h-4 text-emerald-600" />
            : <GitCommit className={cn('w-4 h-4', isRestorable ? 'text-slate-500' : 'text-slate-300')} />
        }
      </div>

      {/* Card */}
      <div className={cn(
        'flex-1 mb-3 rounded-xl border px-4 py-3 transition-all',
        isCurrent
          ? 'border-brand-400 bg-brand-50'
          : isLatest
            ? 'border-emerald-200 bg-emerald-50/50'
            : isRestorable
              ? 'border-slate-200 bg-white hover:border-slate-300'
              : 'border-slate-100 bg-slate-50/50',
      )}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {isCurrent && <Badge variant="info">● Live Version</Badge>}
              {isLatest && !isCurrent && <Badge variant="success">Latest</Badge>}
              {isRestorable && !isCurrent && (
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-px rounded">
                  v–{index}
                </span>
              )}
            </div>
            <p className={cn(
              'text-sm font-semibold leading-snug',
              isCurrent ? 'text-brand-800' : isRestorable ? 'text-slate-800' : 'text-slate-500',
            )}>
              {commit.message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {commit.url && (
              <a href={commit.url} target="_blank" rel="noopener noreferrer"
                title="View on GitHub"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {isRestorable && (
              <button
                onClick={() => onRestore(commit.hash, commit.message)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                           border border-amber-300 text-amber-700 bg-amber-50
                           hover:bg-amber-100 hover:border-amber-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Restore
              </button>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3 text-slate-400" />
            <code className="font-mono">{commit.shortHash}</code>
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400" /> {commit.author}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" /> {timeAgo(commit.date)}
          </span>
          {commit.refs?.includes('HEAD') && (
            <span className="flex items-center gap-1 text-brand-500 font-medium">
              <GitBranch className="w-3 h-3" />
              {commit.refs.replace(/.*HEAD -> /, '').split(',')[0].trim()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function VersionHistoryPage() {
  const navigate = useNavigate();
  const [source, setSource] = useState<'local' | 'github'>('github');
  const [confirmRestore, setConfirmRestore] = useState<{ hash: string; message: string } | null>(null);

  const localQuery = useQuery<GitStatus>({
    queryKey: ['git-log'],
    queryFn: adminApi.gitLog,
    enabled: source === 'local',
    staleTime: 30_000, retry: false,
  });

  const githubQuery = useQuery<GitCommitType[]>({
    queryKey: ['github-commits'],
    queryFn: adminApi.githubCommits,
    enabled: source === 'github',
    staleTime: 60_000, retry: false,
  });

  const restoreMutation = useMutation({
    mutationFn: (hash: string) => adminApi.restore(hash),
    onSuccess: (data) => {
      toast.success(data.message || 'Restored successfully! Restart the server.');
      setConfirmRestore(null);
      localQuery.refetch();
    },
    onError: () => setConfirmRestore(null),
  });

  const isLoading = source === 'local' ? localQuery.isLoading : githubQuery.isLoading;
  const queryError = source === 'local' ? localQuery.error : githubQuery.error;
  const commits: GitCommitType[] = source === 'local'
    ? localQuery.data?.commits || []
    : githubQuery.data || [];
  const currentHash  = localQuery.data?.currentHash;
  const currentBranch = localQuery.data?.currentBranch;

  const restorableCount = Math.min(MAX_RESTORABLE - 1, commits.length - 1);

  return (
    <div className="p-8 max-w-3xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start gap-3 mb-8">
        <button onClick={() => navigate('/admin')}
          className="mt-1 p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <History className="w-5 h-5 text-brand-500" />
            <h1 className="text-2xl font-bold text-slate-900">Version History</h1>
          </div>
          <p className="text-sm text-slate-500">
            Browse every commit and restore the platform to any of the last {MAX_RESTORABLE} versions in one click.
          </p>
        </div>
        <Button variant="secondary" size="sm"
          onClick={() => source === 'local' ? localQuery.refetch() : githubQuery.refetch()}
          loading={isLoading}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* ── Repo info card ── */}
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 transition-colors mb-5 group">
        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
          <Github className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">
            git-jainamshah / Protakeoff
          </p>
          <p className="text-xs text-slate-500 truncate">{REPO_URL}</p>
        </div>
        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-brand-500 flex-shrink-0" />
      </a>

      {/* ── Source toggle ── */}
      <div className="flex gap-1 mb-5 p-1 bg-slate-100 border border-slate-200 rounded-xl w-fit">
        {[
          { id: 'github', label: 'GitHub', icon: Github },
          { id: 'local',  label: 'Local Git', icon: GitBranch },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSource(id as 'github' | 'local')}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              source === id ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700')}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── Local branch status ── */}
      {source === 'local' && localQuery.data && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-slate-200 bg-white mb-5 flex-wrap text-xs">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Branch: <code className="font-mono font-semibold text-emerald-700">{currentBranch}</code>
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <Hash className="w-3 h-3" />
            HEAD: <code className="font-mono">{currentHash?.slice(0, 8)}</code>
          </span>
          {localQuery.data.hasUncommittedChanges && (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> Uncommitted changes
            </span>
          )}
        </div>
      )}

      {/* ── Restore info banner ── */}
      <div className="flex gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 mb-6">
        <Unlock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          <strong>Restore runs:</strong> <code className="bg-amber-100 px-1 rounded">git stash &amp;&amp; git checkout &lt;hash&gt;</code>
          — your current work is stashed safely. Restart the dev server after restoring.
          Buttons appear for the most recent <strong>{restorableCount}</strong> commits.
        </p>
      </div>

      {/* ── Commit list ── */}
      {isLoading ? (
        <PageLoader label="Loading version history…" />
      ) : queryError ? (
        <div className="text-center py-12 border border-slate-200 rounded-2xl bg-white">
          <Github className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 mb-1">Could not load history</p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {source === 'github'
              ? 'Check that GITHUB_TOKEN is set in backend/.env.local'
              : 'Ensure the backend is running and this is a git repo'}
          </p>
          <button onClick={() => source === 'local' ? localQuery.refetch() : githubQuery.refetch()}
            className="mt-4 text-xs text-brand-600 hover:underline font-medium">
            Try again
          </button>
        </div>
      ) : commits.length === 0 ? (
        <div className="text-center py-12 border border-slate-200 rounded-2xl bg-white">
          <GitCommit className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No commits found</p>
        </div>
      ) : (
        <div>
          {commits.map((commit, i) => (
            <CommitRow key={commit.hash} commit={commit} index={i}
              isCurrent={!!(currentHash && (commit.hash === currentHash || commit.shortHash === currentHash?.slice(0, 7)))}
              onRestore={(hash, msg) => setConfirmRestore({ hash, message: msg })} />
          ))}
        </div>
      )}

      {/* ── Confirm modal ── */}
      <Modal open={!!confirmRestore} onClose={() => setConfirmRestore(null)}
        title="Restore to this version?" size="sm">
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs font-semibold text-amber-700 mb-1 uppercase tracking-wide">Target commit</p>
            <code className="text-xs font-mono text-amber-600">{confirmRestore?.hash.slice(0, 12)}</code>
            <p className="text-sm text-slate-700 mt-1.5 font-medium leading-snug">{confirmRestore?.message}</p>
          </div>
          <p className="text-sm text-slate-600">
            This checks out the selected commit. Any uncommitted changes are automatically stashed.
            <strong className="text-slate-800"> Restart the dev server</strong> after restoring for code changes to take effect.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmRestore(null)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1"
              loading={restoreMutation.isPending}
              onClick={() => confirmRestore && restoreMutation.mutate(confirmRestore.hash)}>
              <RotateCcw className="w-3.5 h-3.5" /> Yes, Restore
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
