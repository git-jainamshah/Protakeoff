import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import {
  LayoutDashboard,
  FolderOpen,
  Shield,
  GitBranch,
  LogOut,
  ChevronRight,
  Layers,
  Settings,
} from 'lucide-react';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Admin Portal', icon: Shield },
  { to: '/admin/versions', label: 'Version History', icon: GitBranch },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-surface-sidebar border-r border-surface-border h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-surface-border">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-none tracking-wide">ProTakeOff</p>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Estimation Platform</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Workspace</p>
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn('sidebar-item', isActive(to) && 'sidebar-item-active')}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {isActive(to) && <ChevronRight className="w-3 h-3 opacity-60" />}
          </Link>
        ))}

        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
          <>
            <p className="px-3 mt-5 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Platform</p>
            {ADMIN_NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn('sidebar-item', isActive(to) && 'sidebar-item-active')}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive(to) && <ChevronRight className="w-3 h-3 opacity-60" />}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Version badge */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-slate-500">v1.0.0 · Live</span>
        </div>
      </div>

      {/* User */}
      <div className="px-3 py-3 border-t border-surface-border">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer group">
          <Avatar name={user?.name || 'U'} src={user?.avatar} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.role}</p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => navigate('/settings')}
              className="p-1 rounded text-slate-500 hover:text-slate-700 transition-colors"
              title="Settings"
            >
              <Settings className="w-3 h-3" />
            </button>
            <button
              onClick={handleLogout}
              className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
