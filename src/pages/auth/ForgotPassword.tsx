import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Field';
import { useAuth } from '../../contexts/AuthContext';
import { AuthLayout } from '../../layouts/AuthLayout';

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll e-mail you a secure link to choose a new password."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="info" title="Check your inbox">
          If an account exists for {email}, a reset link is on its way. The link opens a page where you can set a new password.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Input label="Work e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
          <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
