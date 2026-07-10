import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { startEventSync } from './api/eventSync';
import { useAuthStore } from './state/authStore';

// No StrictMode: it double-mounts effects in dev, which would create two
// WebGL contexts / animation loops for the viewport.
createRoot(document.getElementById('root')!).render(<App />);

// Optional backend wiring (Feature 1: persistent event log, Feature 2:
// accounts). Both are no-ops when VITE_API_BASE_URL isn't set, so the app
// behaves exactly as before for anyone running it without the server.
useAuthStore.getState().restore();
startEventSync();
