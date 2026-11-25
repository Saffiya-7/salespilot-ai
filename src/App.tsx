import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FullPageSpinner, GuestOnly, ProtectedRoute } from './components/RouteGuards';
import { Spinner } from './components/ui/Feedback';
import { AppLayout } from './layouts/AppLayout';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const Research = lazy(() => import('./pages/Research'));
const Scoring = lazy(() => import('./pages/Scoring'));
const Emails = lazy(() => import('./pages/Emails'));
const Followups = lazy(() => import('./pages/Followups'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Assistant = lazy(() => import('./pages/Assistant'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

const inApp = (el: ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<Spinner className="py-24" label="Loading…" />}>{el}</Suspense>
  </ErrorBoundary>
);

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={inApp(<Dashboard />)} />
            <Route path="leads" element={inApp(<Leads />)} />
            <Route path="research" element={inApp(<Research />)} />
            <Route path="scoring" element={inApp(<Scoring />)} />
            <Route path="emails" element={inApp(<Emails />)} />
            <Route path="followups" element={inApp(<Followups />)} />
            <Route path="pipeline" element={inApp(<Pipeline />)} />
            <Route path="analytics" element={inApp(<Analytics />)} />
            <Route path="assistant" element={inApp(<Assistant />)} />
            <Route path="settings" element={inApp(<SettingsPage />)} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
