#!/usr/bin/env python3
import http.server, os, json, urllib.request, urllib.parse

SH_TOKEN_URL   = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
SH_PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process'

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length) if length else b''

        if self.path == '/proxy/sentinel-token':
            try:
                req = urllib.request.Request(SH_TOKEN_URL, data=body,
                    headers={'Content-Type': 'application/x-www-form-urlencoded'})
                with urllib.request.urlopen(req, timeout=15) as r:
                    data = r.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self._error(str(e))

        elif self.path == '/proxy/sentinel-process':
            token = self.headers.get('X-SH-Token', '')
            accept = self.headers.get('Accept', 'image/jpeg')
            try:
                req = urllib.request.Request(SH_PROCESS_URL, data=body,
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {token}',
                        'Accept': accept,
                    })
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = r.read()
                    ct   = r.headers.get('Content-Type', 'image/jpeg')
                self.send_response(200)
                self.send_header('Content-Type', ct)
                self.end_headers()
                self.wfile.write(data)
            except urllib.error.HTTPError as e:
                self._error(f'SH {e.code}: {e.read().decode()}')
            except Exception as e:
                self._error(str(e))
        else:
            self.send_response(404)
            self.end_headers()

    def _error(self, msg):
        self.send_response(500)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': msg}).encode())

    def log_message(self, *a): pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print("Frontend: http://localhost:3000")
http.server.HTTPServer(('', 3000), Handler).serve_forever()
