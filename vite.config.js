import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: '0.0.0.0',
        port: 3000,
        fs: {
            strict: false,
            allow: ['..']
        },
        proxy: {
            '/api': {
                target: 'http://localhost:5000', // Pointing to local backend
                //target: 'https://api-dr-indu-child-care.brahmaastra.ai',
                changeOrigin: true,
                secure: false,
            },
        },
    },
})
