import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Ye check karega ke kya hum Vercel par hain?
  const isVercel = process.env.VERCEL === '1';

  return {
    // SMART LOGIC:
    // Agar Vercel hai to '/', warnaa tumhara GitHub repo path
    base: isVercel ? '/' : '/VibeCoding-AI-Intercom/',

    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
