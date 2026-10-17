#!/usr/bin/env python3
"""Serve the app on http://localhost:8127 for local testing.

    python3 tools/serve.py [port]

`python3 -m http.server` is the usual way to do this, but it reads the current
working directory before it starts, which fails under a sandbox that cannot stat
the directory the command was launched from. This serves the repo root explicitly
instead, and registers the two media types the stock table is missing.
"""
import mimetypes, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8127

mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('audio/mp4', '.m4a')

handler = partial(SimpleHTTPRequestHandler, directory=ROOT)
print('Color Lab on http://localhost:%d  (serving %s)' % (PORT, ROOT), flush=True)
ThreadingHTTPServer(('127.0.0.1', PORT), handler).serve_forever()
