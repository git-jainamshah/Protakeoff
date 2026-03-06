import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Layers, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPw, setShowPw] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.login(data);
      login(res.token, res.user);
      toast.success(`Welcome back, ${res.user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch {
      // Error handled by axios interceptor
    }
  };

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-surface-sidebar via-surface to-surface-card items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%236366f1\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative z-10 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glass mx-auto mb-8">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
            Pro<span className="text-gradient">TakeOff</span>
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed">
            Industry-grade construction takeoff & cost estimation for modern engineering teams.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Accuracy', value: '99.8%' },
              { label: 'Faster Estimates', value: '3x' },
              { label: 'Active Projects', value: '10k+' },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-card/50 border border-surface-border rounded-xl p-4">
                <p className="text-2xl font-bold text-brand-400">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">ProTakeOff</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="text-slate-400 text-sm mt-1">Access your workspace</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              error={errors.password?.message}
              rightIcon={
                <button type="button" onClick={() => setShowPw(!showPw)} className="hover:text-slate-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              {...register('password')}
            />

            <Button type="submit" className="w-full" loading={isSubmitting} size="lg">
              Sign in <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            No account?{' '}
            <Link to="/signup" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Create one
            </Link>
          </p>

          <div className="mt-12 pt-6 border-t border-surface-border text-center">
            <p className="text-[11px] text-slate-600">
              © {new Date().getFullYear()} ProTakeOff · Precision Takeoffs. Professional Estimates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
