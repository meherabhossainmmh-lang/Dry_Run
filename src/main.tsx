import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// No StrictMode: it double-mounts effects in dev, which would create two
// WebGL contexts / animation loops for the viewport.
createRoot(document.getElementById('root')!).render(<App />);
