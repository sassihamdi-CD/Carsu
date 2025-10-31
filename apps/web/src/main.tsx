/**
 * Purpose: Frontend application entry point.
 * Usage: Bootstraps the React application and mounts it to the DOM.
 * Why: Single entry point ensures consistent initialization and global styles are loaded.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}


