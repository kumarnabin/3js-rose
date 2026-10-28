import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages: the rose study at / and the lily lifecycle at /flower-lifecycle/.
const PAGES = ['/flower-lifecycle'];

// Without this, /flower-lifecycle (no trailing slash) falls through to the root index.html.
// Redirect it to the directory URL, as static hosts do, in both `vite` and `vite preview`.
function pageTrailingSlash() {
  const redirect = (req, res, next) => {
    const [path, query] = req.url.split('?');
    if (!PAGES.includes(path)) return next();
    res.statusCode = 301;
    res.setHeader('Location', `${path}/${query ? `?${query}` : ''}`);
    res.end();
  };
  return {
    name: 'page-trailing-slash',
    configureServer(server) { server.middlewares.use(redirect); },
    configurePreviewServer(server) { server.middlewares.use(redirect); },
  };
}

export default defineConfig({
  plugins: [pageTrailingSlash()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        flowerLifecycle: resolve(import.meta.dirname, 'flower-lifecycle/index.html'),
      },
    },
  },
});
