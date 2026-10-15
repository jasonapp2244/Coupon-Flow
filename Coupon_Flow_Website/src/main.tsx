import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { readEmbeddedPreload } from './lib/preload';
import './index.css';

// A pre-rendered page (store pages) embeds its API data: the app starts from it, then refreshes.
// It mounts fresh rather than hydrating. The first render already matches visually.
readEmbeddedPreload();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
