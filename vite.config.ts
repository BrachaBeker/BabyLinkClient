import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // השרת המקומי מאשר CORS רק ל-http://localhost:5173. strictPort - אם הפורט תפוס תופיע שגיאה,
  // במקום ש-Vite יעבור בשקט ל-5174 והבקשות לשרת ייחסמו.
  server: {
    port: 5173,
    strictPort: true,
  },
})
