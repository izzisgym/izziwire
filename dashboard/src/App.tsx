import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ApprovalQueue from './pages/ApprovalQueue';
import PublishedPosts from './pages/PublishedPosts';
import NewsSources from './pages/NewsSources';
import Settings from './pages/Settings';
import Metrics from './components/Metrics';

function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <Link to="/">Approval queue</Link>
        <span style={{ margin: '0 0.5rem' }}>|</span>
        <Link to="/published">Published</Link>
        <span style={{ margin: '0 0.5rem' }}>|</span>
        <Link to="/sources">Sources</Link>
        <span style={{ margin: '0 0.5rem' }}>|</span>
        <Link to="/settings">Settings</Link>
      </nav>
      <main style={{ padding: '1rem' }}>
        <Metrics />
        <Routes>
          <Route path="/" element={<ApprovalQueue />} />
          <Route path="/published" element={<PublishedPosts />} />
          <Route path="/sources" element={<NewsSources />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
