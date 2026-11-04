"""Serves this folder on http://localhost:5173 and makes browsers check for changed files on every load."""

import http.server
import os

PORT = 5173


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler) as server:
        print(f"Serving on http://localhost:{PORT}")
        server.serve_forever()
