import DevAuthTest from './features/auth/DevAuthTest';
import AuthPage from './features/auth/AuthPage';
import ArchiveApp from './features/archive/ArchiveApp';
import { useTheme } from './ui/theme';
import './features/archive/archive.css';
import './styles/premium.css';

export default function App() {
  const [theme, onThemeToggle] = useTheme();
  const path = window.location.pathname;
  if (path === '/dev/auth-test') return <DevAuthTest />;
  if (path === '/auth') return <AuthPage theme={theme} onThemeToggle={onThemeToggle} />;
  return <ArchiveApp theme={theme} onThemeToggle={onThemeToggle} />;
}
