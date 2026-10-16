#!/usr/bin/env python3
"""
    Dev static server + same-origin proxy for the portfolio frontend.
    Usage: python3 dev_proxy.py [frontend_dir] [backend_url] [port]
"""
import http.server
import mimetypes
import os
import posixpath
import sys
import urllib.error
import urllib.parse
import urllib.request

FRONTEND_DIR = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
BACKEND = (sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:5050").rstrip("/")
PORT = int(sys.argv[3]) if len(sys.argv) > 3 else 8080
PROXY_PREFIXES = ("/get_", "/license")

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith(PROXY_PREFIXES):
            self._proxy()
        else:
            self._static()

    def _proxy(self):
        url = BACKEND + self.path
        try:
            with urllib.request.urlopen(url) as r:
                body = r.read()
                status = r.status
                ctype = r.headers.get("Content-Type")
        except urllib.error.HTTPError as e:
            body = e.read()
            status = e.code
            ctype = e.headers.get("Content-Type")
        except Exception as e:
            body = ("backend unreachable at %s: %s" % (BACKEND, e)).encode()
            status = 502
            ctype = "text/plain"
        self.send_response(status)
        if ctype:
            self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _static(self):
        rel = posixpath.normpath(urllib.parse.unquote(self.path.split("?")[0]))
        if rel.startswith("/"):
            rel = rel[1:]
        if rel == "" or rel.endswith("/"):
            rel += "index.html"
        full = os.path.abspath(os.path.join(FRONTEND_DIR, rel))
        if full != FRONTEND_DIR and not full.startswith(FRONTEND_DIR + os.sep):
            self.send_error(403)
            return
        if not os.path.isfile(full):
            self.send_error(404)
            return
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(full)[0] or "application/octet-stream")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("[proxy] %s" % (fmt % args), flush=True)


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("", PORT), Handler)
    print("proxy on http://localhost:%d (all interfaces)" % PORT, flush=True)
    print("  static:  %s" % FRONTEND_DIR, flush=True)
    print("  backend: %s" % BACKEND, flush=True)
    server.serve_forever()
