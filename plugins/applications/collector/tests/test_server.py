import unittest
import http.client
import socket
import ssl
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from server import authorized, SecureInventoryServer


class AuthorizationTest(unittest.TestCase):
    def test_requires_matching_source_and_bearer(self):
        self.assertTrue(authorized('192.168.15.41', 'Bearer correct', '192.168.15.41', 'correct'))
        self.assertFalse(authorized('192.168.15.42', 'Bearer correct', '192.168.15.41', 'correct'))
        self.assertFalse(authorized('192.168.15.41', 'Bearer wrong', '192.168.15.41', 'correct'))
        self.assertFalse(authorized('192.168.15.41', '', '192.168.15.41', 'correct'))

    def test_stalled_tls_client_does_not_block_other_clients(self):
        with tempfile.TemporaryDirectory() as directory:
            cert, key = str(Path(directory) / 'cert.pem'), str(Path(directory) / 'key.pem')
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(cert, key)
            class Handler(BaseHTTPRequestHandler):
                def do_GET(self):
                    self.send_response(200)
                    self.end_headers()
                def log_message(self, *_args):
                    pass
            server = SecureInventoryServer(('127.0.0.1', 0), Handler, context, '127.0.0.1')
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            stalled = socket.create_connection(server.server_address)
            try:
                client = http.client.HTTPSConnection('127.0.0.1', server.server_address[1], timeout=3, context=ssl._create_unverified_context())
                client.request('GET', '/')
                self.assertEqual(client.getresponse().status, 200)
                client.close()
            finally:
                stalled.close()
                server.shutdown()
                server.server_close()
                thread.join()

    def test_https_endpoint_requires_token(self):
        with tempfile.TemporaryDirectory() as directory:
            cert, key, token = (str(Path(directory) / name) for name in ('cert.pem', 'key.pem', 'token'))
            Path(token).write_text('x' * 40)
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            process = subprocess.Popen(['python3', 'server.py', '--bind', '127.0.0.1', '--peer', '127.0.0.1', '--port', str(port), '--cert', cert, '--key', key, '--token-file', token, '--cf-tunnel', '/bin/false'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                context = ssl.create_default_context(cafile=cert)
                for attempt in range(30):
                    try:
                        connection = http.client.HTTPSConnection('127.0.0.1', port, context=context, timeout=2)
                        connection.request('GET', '/inventory', headers={'Authorization': 'Bearer wrong'})
                        break
                    except ConnectionRefusedError:
                        time.sleep(.1)
                else:
                    self.fail('collector did not start')
                self.assertEqual(connection.getresponse().status, 403)
                connection.close()
                connection = http.client.HTTPSConnection('127.0.0.1', port, context=context, timeout=2)
                connection.request('GET', '/inventory', headers={'Authorization': 'Bearer ' + 'x' * 40})
                self.assertEqual(connection.getresponse().status, 200)
                connection.close()
            finally:
                process.terminate()
                process.wait(timeout=5)
