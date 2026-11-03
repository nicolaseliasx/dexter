"""Small authenticated HTTPS endpoint for a filtered inventory snapshot."""
import argparse
import hmac
import json
import ssl
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from inventory import collect


def authorized(peer, header, allowed_peer, token):
    return peer == allowed_peer and bool(token) and hmac.compare_digest(header, 'Bearer ' + token)


class SecureInventoryServer(ThreadingHTTPServer):
    def __init__(self, address, handler, tls, peer):
        self.tls = tls
        self.peer = peer
        super().__init__(address, handler)

    def verify_request(self, request, client_address):
        return client_address[0] == self.peer

    def process_request_thread(self, request, client_address):
        try:
            request.settimeout(5)
            request = self.tls.wrap_socket(request, server_side=True)
        except (OSError, ssl.SSLError):
            request.close()
            return
        super().process_request_thread(request, client_address)


def main():
    parser = argparse.ArgumentParser()
    for argument in ('bind', 'peer', 'cert', 'key', 'token-file', 'cf-tunnel'):
        parser.add_argument('--' + argument, required=True)
    parser.add_argument('--port', type=int, default=18443)
    args = parser.parse_args()
    token = Path(args.token_file).read_text().strip()
    if len(token) < 32:
        raise SystemExit('Token must contain at least 32 characters')
    snapshot = {'items': [], 'unavailable': ['not_ready']}
    lock = threading.Lock()

    def refresh():
        nonlocal snapshot
        while True:
            result = collect(args.cf_tunnel)
            result['collected_at'] = int(time.time())
            with lock:
                snapshot = result
            time.sleep(60)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_GET(self):
            if not authorized(self.client_address[0], self.headers.get('Authorization', ''), args.peer, token):
                self.send_error(403)
                return
            if self.path != '/inventory':
                self.send_error(404)
                return
            with lock:
                body = json.dumps(snapshot).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls.minimum_version = ssl.TLSVersion.TLSv1_2
    tls.load_cert_chain(args.cert, args.key)
    server = SecureInventoryServer((args.bind, args.port), Handler, tls, args.peer)
    threading.Thread(target=refresh, daemon=True).start()
    server.serve_forever()


if __name__ == '__main__':
    main()
