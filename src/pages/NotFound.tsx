import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '../components/ui/Feedback';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-lavender-50 px-6">
      <div className="card w-full max-w-md">
        <EmptyState
          icon={<Compass className="size-6" />}
          title="Page not found"
          description="The page you're looking for doesn't exist or has moved."
          action={
            <Link to="/" className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              Go home
            </Link>
          }
        />
      </div>
    </div>
  );
}
