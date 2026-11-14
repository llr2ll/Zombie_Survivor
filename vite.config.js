import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true, allowedHosts: true,
    // no dev, repassa a conexão do servidor da sala pela porta do jogo (Codespaces só abre uma porta por vez)
    proxy: { '/ws': { target: `ws://localhost:${process.env.PORT || 8080}`, ws: true, rewrite: (p) => p.replace(/^\/ws/, '') } },
  },
  build: {
    rollupOptions: { input: { main: 'index.html', controller: 'controller.html' } },
  },
})
