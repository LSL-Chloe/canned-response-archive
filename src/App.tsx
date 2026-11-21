import { lazy, Suspense } from 'react';
// Development QA should not ship with the public production app.
const DevAuthTest = import.meta.env.DEV ? lazy(() => import('./features/auth/DevAuthTest')) : null;
import AuthPage from './features/auth/AuthPage';
import ArchiveApp from './features/archive/ArchiveApp';
import { useTheme } from './ui/theme';
import './features/archive/archive.css';
import './styles/premium.css';

export default function App() {
  const [theme, onThemeToggle] = useTheme();
  const path = window.location.pathname;
  if (path === '/dev/auth-test' && DevAuthTest) {
    return <Suspense fallback={null}><DevAuthTest /></Suspense>;
  }
  if (path === '/auth') return <AuthPage theme={theme} onThemeToggle={onThemeToggle} />;
  return <ArchiveApp theme={theme} onThemeToggle={onThemeToggle} />;
}
