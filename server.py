"""
ShopEase — Basic Python Backend Server
=======================================
Serves static files and handles signup/login API endpoints.
User data is stored in a local users.json file.

Usage:  python server.py
Then visit: http://localhost:8000
"""

import http.server
import json
import os
import hashlib
import re

PORT = 8000
import xml.etree.ElementTree as ET

USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data_base_users.xml')


def load_users():
    """Load user database from XML file."""
    if not os.path.exists(USERS_FILE):
        return []
    try:
        tree = ET.parse(USERS_FILE)
        root = tree.getroot()
        users = []
        for user_node in root.findall('user'):
            users.append({
                'name': (user_node.find('name').text or '').strip(),
                'email': (user_node.find('email').text or '').strip().lower(),
                'password': (user_node.find('password').text or '').strip(),
                'phone': (user_node.find('phone').text or '').strip()
            })
        return users
    except Exception:
        return []


def save_users(users):
    """Save user database to XML file."""
    root = ET.Element('users')
    for u in users:
        user_node = ET.SubElement(root, 'user')
        ET.SubElement(user_node, 'name').text = u.get('name', '')
        ET.SubElement(user_node, 'email').text = u.get('email', '')
        ET.SubElement(user_node, 'password').text = u.get('password', '')
        ET.SubElement(user_node, 'phone').text = u.get('phone', '')
    
    tree = ET.ElementTree(root)
    try:
        ET.indent(tree, space="  ")
    except AttributeError:
        pass
    tree.write(USERS_FILE, encoding='utf-8', xml_declaration=True)


def hash_password(password):
    """Simple SHA-256 hash for password storage."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def validate_email(email):
    """Basic email format check."""
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email))


class ShopEaseHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that serves static files and handles API routes."""

    def do_POST(self):
        if self.path == '/api/signup':
            self.handle_signup()
        elif self.path == '/api/login':
            self.handle_login()
        else:
            self.send_json(404, {'success': False, 'message': 'Not found'})

    def handle_signup(self):
        data = self.read_json_body()
        if not data:
            return self.send_json(400, {'success': False, 'message': 'Invalid request body'})

        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        phone = (data.get('phone') or '').strip()

        # Validation
        errors = []
        if not name:
            errors.append('Name is required')
        if not email or not validate_email(email):
            errors.append('Valid email is required')
        if len(password) < 5:
            errors.append('Password must be at least 5 characters')

        if errors:
            return self.send_json(400, {'success': False, 'message': '; '.join(errors)})

        users = load_users()

        # Check if email already exists
        if any(u['email'] == email for u in users):
            return self.send_json(409, {'success': False, 'message': 'An account with this email already exists'})

        # Create user
        new_user = {
            'name': name,
            'email': email,
            'password': hash_password(password),
            'phone': phone
        }
        users.append(new_user)
        save_users(users)

        print(f"[SIGNUP] New user registered: {name} ({email})")
        self.send_json(201, {'success': True, 'message': 'Account created successfully!'})

    def handle_login(self):
        data = self.read_json_body()
        if not data:
            return self.send_json(400, {'success': False, 'message': 'Invalid request body'})

        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not email or not password:
            return self.send_json(400, {'success': False, 'message': 'Email and password are required'})

        users = load_users()
        password_hash = hash_password(password)

        user = next((u for u in users if u['email'] == email and u['password'] == password_hash), None)

        if user:
            print(f"[LOGIN] User logged in: {user['name']} ({email})")
            self.send_json(200, {
                'success': True,
                'message': 'Login successful!',
                'user': {
                    'name': user['name'],
                    'email': user['email']
                }
            })
        else:
            self.send_json(401, {'success': False, 'message': 'Invalid email or password'})

    def read_json_body(self):
        """Read and parse JSON from the request body."""
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            return json.loads(body)
        except (json.JSONDecodeError, ValueError, UnicodeDecodeError):
            return None

    def send_json(self, status, data):
        """Send a JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        """Custom log format."""
        print(f"[{self.log_date_time_string()}] {format % args}")


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print(f"""
================================================
       ShopEase Backend Server
================================================
  Server running at:
    http://localhost:{PORT}

  API Endpoints:
    POST /api/signup
    POST /api/login

  User DB: {os.path.basename(USERS_FILE)}
  Press Ctrl+C to stop
================================================
    """)

    server = http.server.HTTPServer(('', PORT), ShopEaseHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[SERVER] Shutting down…")
        server.server_close()


if __name__ == '__main__':
    main()
