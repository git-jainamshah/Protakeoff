import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Layers, ArrowRight, Building2, User, Mail, Lock } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
});
type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const [showPw, setShowPw] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.register(data);
      login(res.token, res.user);
      toast.success('Account created! Welcome to ProTakeOff.');
      navigate('/dashboard');
    } catch {
      // Error handled by interceptor
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white">ProTakeOff</span>
            <span className="ml-2 text-xs text-slate-500 font-normal">Estimation Platform</span>
          </div>
        </div>

        <div className="card p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Create your workspace</h2>
            <p className="text-slate-400 text-sm mt-1">Set up your team account in under a minute</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Your full name"
              placeholder="Jane Smith"
              error={errors.name?.message}
              leftIcon={<User className="w-4 h-4" />}
              {...register('name')}
            />

            <Input
              label="Company name"
              placeholder="Acme Construction LLC"
              error={errors.companyName?.message}
              leftIcon={<Building2 className="w-4 h-4" />}
              {...register('companyName')}
            />

            <Input
              label="Work email"
              type="email"
              placeholder="jane@acmeconstruction.com"
              error={errors.email?.message}
              leftIcon={<Mail className="w-4 h-4" />}
              {...register('email')}
            />

            <Input
              label="Password"
              type={showPw ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              error={errors.password?.message}
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button type="button" onClick={() => setShowPw(!showPw)} className="hover:text-slate-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              {...register('password')}
            />

            <Button type="submit" className="w-full mt-2" loading={isSubmitting} size="lg">
              Create account <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          By creating an account you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
