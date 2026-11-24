import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base: process.env.GITHUB_ACTIONS ? '/luma-cinema/' : '/',build:{outDir:'dist',rollupOptions:{output:{manualChunks:{three:['three']}}}}});
