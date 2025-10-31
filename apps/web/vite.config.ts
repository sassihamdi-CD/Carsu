/**
 * Purpose: Vite build tool configuration for the React frontend.
 * Usage: Used by Vite to build and serve the development server.
 * Why: Configures React plugin and server settings for Docker compatibility.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
});


