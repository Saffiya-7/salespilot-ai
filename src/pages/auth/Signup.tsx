import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Field';
import { useAuth } from '../../contexts/AuthContext';
import { AuthLayout } from '../../layouts/AuthLayout';
import { passwordProblem } from '../../utils/validation';

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const pwProblem = passwordProblem(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!name.trim()) return setError('Please enter your name.');
    if (pwProblem) return;
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password, name);
      if (needsConfirmation) setSentTo(email);
      else navigate('/app', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox">
        <div className="card">
          <EmptyState
            icon={<MailCheck className="size-6" />}
            title="Confirm your e-mail"
            description={
              <>
                We sent a confirmation link to <strong className="text-ink-800">{sentTo}</strong>. Open it to activate your account, then sign in.
              </>
            }
            action={
              <Link to="/login" className="text-sm font-semibold text-brand-700 hover:underline">
                Go to sign in →
              </Link>
            }
          />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start organising, scoring and closing your leads with AI."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Alex Morgan" maxLength={120} />
        <Input label="Work e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="At least 8 characters"
          error={touched && pwProblem ? pwProblem : undefined}
          hint="Use 8+ characters with letters and numbers."
        />
        <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!email || !password || !name}>
          Create account
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-400">By creating an account you agree to use AI suggestions responsibly and review every message before sending it.</p>
      </form>
    </AuthLayout>
  );
}
