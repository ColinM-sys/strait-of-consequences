// Node.js equivalent of serve.py — use on machines without Python
// Run: node server.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const SH_TOKEN_URL   = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const SH_PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';

const CORS_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SH-Token, Accept',
};

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

function proxyPost(targetUrl, body, reqHeaders, res) {
  const url = new URL(targetUrl);
  const opts = {
    hostname: url.hostname, port: 443, path: url.pathname + url.search,
    method: 'POST', headers: reqHeaders,
  };
  const req = https.request(opts, (pr) => {
    const ct = pr.headers['content-type'] || 'application/json';
    res.writeHead(pr.statusCode, { ...CORS_HEADERS, 'Content-Type': ct });
    pr.pipe(res);
  });
  req.on('error', e => {
    res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });
  req.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (req.url === '/proxy/sentinel-token') {
        proxyPost(SH_TOKEN_URL, body, { 'Content-Type': 'application/x-www-form-urlencoded' }, res);
      } else if (req.url === '/proxy/sentinel-process') {
        proxyPost(SH_PROCESS_URL, body, {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${req.headers['x-sh-token'] || ''}`,
          'Accept': req.headers['accept'] || 'image/jpeg',
        }, res);
      } else {
        res.writeHead(404, CORS_HEADERS); res.end();
      }
    });
    return;
  }

  // Serve static files
  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, CORS_HEADERS); return res.end('Not found'); }
    const ext = path.extname(filePath);
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Frontend: http://localhost:${PORT}`));
