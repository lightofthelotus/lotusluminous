#!/usr/bin/env python3
"""Serve this directory at a /lotusluminous context path.

Usage: python serve.py [port]
Then browse to http://localhost:<port>/lotusluminous/
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

CONTEXT_PATH = "/lotusluminous"


class ContextPathHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path == CONTEXT_PATH:
            path = CONTEXT_PATH + "/"
        if path.startswith(CONTEXT_PATH + "/"):
            path = path[len(CONTEXT_PATH):]
        elif path == "/" or not path.startswith(CONTEXT_PATH):
            self.send_error(404, "Not found (expected path under %s)" % CONTEXT_PATH)
            return super().translate_path("/__404__")
        return super().translate_path(path)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("", port), ContextPathHandler)
    print(f"Serving at http://localhost:{port}{CONTEXT_PATH}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
