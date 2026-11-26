#!/usr/bin/env python3
"""Serve the game on http://localhost:8000 without browser caching.

Plain `python3 -m http.server` lets the browser cache the game's files, so after a
`git pull` the browser can mix old and new code. This server tells it not to.
Usage:  python3 serve.py        (optional port: python3 serve.py 8080)
"""
import http.server
import socketserver
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


http.server.SimpleHTTPRequestHandler.extensions_map[".js"] = "text/javascript"
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCache) as httpd:
    print(f"Inline Hockey: open http://localhost:{PORT}  (Ctrl+C to stop)")
    httpd.serve_forever()
