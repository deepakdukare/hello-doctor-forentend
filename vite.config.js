import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        fs: {
            strict: false,
            allow: ['..']
        },
        proxy: {
            '/api': {
                target: 'https://api-dr-indu-child-care.brahmaastra.ai/',
                changeOrigin: true,
            },
        },
    },
})
