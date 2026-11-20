import DevAuthTest from './features/auth/DevAuthTest';
import ArchiveApp from './features/archive/ArchiveApp';
import './features/archive/archive.css';

/** Keep the functional authentication QA page separate from the new archive UI. */
export default function App() {
  return window.location.pathname === '/dev/auth-test' ? <DevAuthTest /> : <ArchiveApp />;
}
