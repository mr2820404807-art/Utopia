# -*- coding: utf-8 -*-
"""乌托邦本地开发服务器：发送 no-cache 头，避免浏览器缓存旧版游戏模块"""
import http.server, socketserver, os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PORT = 8792
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()
    def log_message(self, fmt, *args):
        pass

with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
    print(f'乌托邦本地服务器已启动: http://127.0.0.1:{PORT}/index.html')
    httpd.serve_forever()
