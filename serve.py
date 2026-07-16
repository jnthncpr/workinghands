"""Local dev server with caching fully disabled.

Plain `python3 -m http.server` sends no cache-control headers, which lets
Safari (and other browsers) hold onto stale files across reloads — a real
source of confusion when testing local changes. Use this instead:

    python3 serve.py [port]

Defaults to port 8420 if no port is given.
"""

import functools
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8420


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


handler = functools.partial(NoCacheHandler, directory=".")
http.server.test(HandlerClass=handler, port=PORT)
