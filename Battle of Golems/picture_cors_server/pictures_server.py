import http.server
import socketserver

PORT = 7506

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

Handler = CORSRequestHandler

# Убедись, что ты находишься в нужной директории или укажи path явно
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving Pictures at http://0.0.0.0:{PORT}")
    httpd.serve_forever()
 
