import unittest
from inventory import parse_ingress, parse_services, parse_containers


class InventoryTest(unittest.TestCase):
    def test_ingress_only_http_routes_not_dns_or_catchall(self):
        text = '''== DNS ==
CNAME example.ncls.cc → tunnel
== Ingress tunnel abc ==
 1. example.ncls.cc  →  http://127.0.0.1:1234
 2. internal.ncls.cc  →  ssh://localhost:22
 3. * (catch-all)  →  http_status:404
'''
        self.assertEqual(parse_ingress(text), [{'name': 'example.ncls.cc', 'url': 'https://example.ncls.cc/', 'source': 'cloudflare'}])

    def test_services_and_containers_provide_names_not_guessed_urls(self):
        self.assertEqual(parse_services('app.service loaded active running App\n'), [{'name': 'app.service', 'source': 'systemd', 'url': None}])
        self.assertEqual(parse_containers('web\nworker\n'), [{'name': 'web', 'source': 'docker', 'url': None}, {'name': 'worker', 'source': 'docker', 'url': None}])


if __name__ == '__main__':
    unittest.main()
