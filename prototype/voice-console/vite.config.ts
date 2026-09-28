import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
/* No node:url import — the alias is not used by the prototype (routing is a
   switch, not @tanstack/react-router), and pulling node types in would require
   @types/node for no gain in a design artifact. */
export default defineConfig({
  plugins: [react()],
  // Unminified + source-mapped so a runtime error names the component, not a
  // minified symbol. The prototype is a design artifact; readability wins over
  // bundle size here.
  build: { minify: false, sourcemap: true },
  server: { port: 5199, strictPort: true },
});
