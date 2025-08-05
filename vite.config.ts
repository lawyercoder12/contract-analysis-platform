import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    define: {
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'process.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY),
      'process.env.VITE_GROQ_API_KEY': JSON.stringify(env.VITE_GROQ_API_KEY),
      'process.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL),
      'process.env.VITE_BEDROCK_ACCESS_KEY_ID': JSON.stringify(env.VITE_BEDROCK_ACCESS_KEY_ID),
      'process.env.VITE_BEDROCK_SECRET_ACCESS_KEY': JSON.stringify(env.VITE_BEDROCK_SECRET_ACCESS_KEY),
      'process.env.VITE_WATSONX_API_KEY': JSON.stringify(env.VITE_WATSONX_API_KEY),
    },
    server: {
      port: 3000,
      host: true,
    }
  };
});
