import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

// In CJS (which this will be bundled to), __dirname is available.
// In ESM, we would use fileURLToPath(import.meta.url).
// esbuild handles the conversion if we use a safe way.

const PORT = process.env.PORT || 3000;

// The executable path
const exePath = process.execPath;
const exeDir = path.dirname(exePath);

// We expect resources to be in a 'resources' folder next to the executable
// Or, if running via node directly, relative to the script.
const resourcesDir = path.join(exeDir, 'resources');

const server = http.createServer((req, res) => {
  let filePath = path.join(resourcesDir, req.url === '/' ? 'index.html' : req.url);
  
  // Basic security: prevent directory traversal
  if (!filePath.startsWith(resourcesDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA
        fs.readFile(path.join(resourcesDir, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data2);
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
      }[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log('-------------------------------------------');
  console.log('Etikit Single Executable Application');
  console.log(`Server running at ${url}`);
  console.log(`Serving resources from: ${resourcesDir}`);
  console.log('Press Ctrl+C to stop.');
  console.log('-------------------------------------------');

  // Automatically open the browser
  const startCommand = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${startCommand} ${url}`, (err) => {
    if (err) {
      console.error('Failed to open browser automatically:', err.message);
    } else {
      console.log('Browser opened automatically.');
    }
  });
});
