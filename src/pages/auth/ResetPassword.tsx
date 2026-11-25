import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { FullPageSpinner, SetupRequired } from '../../components/RouteGuards';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Field';
import { useAuth } from '../../contexts/AuthContext';
import { AuthLayout } from '../../layouts/AuthLayout';
import { isSupabaseConfigured } from '../../lib/supabase';
import { passwordProblem } from '../../utils/validation';

export default function ResetPassword() {
  const { user, loading: authLoading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured) return <SetupRequired />;
  if (authLoading) return <FullPageSpinner />;

  if (!user) {
    return (
      <AuthLayout title="Link expired or invalid" footer={<Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">Request a new link</Link>}>
        <Alert tone="warning">This password-reset link is no longer valid. Reset links expire after a short time and can only be used once.</Alert>
      </AuthLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('Passwords do not match.');
    setError(null);
    setLoading(true);
    try {
      await updatePassword(password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle={`Signed in as ${user.email}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required hint="Use 8+ characters with letters and numbers." />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
