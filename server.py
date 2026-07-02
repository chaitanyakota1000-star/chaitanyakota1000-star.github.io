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
from urllib.parse import urlparse, parse_qs

PORT = 8000

USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.json')
CATEGORIES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'categories.json')
CART_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cart.json')

def load_carts():
    """Load user carts from JSON file."""
    if not os.path.exists(CART_FILE):
        return {}
    try:
        with open(CART_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def save_carts(carts):
    """Save user carts to JSON file."""
    with open(CART_FILE, 'w', encoding='utf-8') as f:
        json.dump(carts, f, indent=2)


def load_categories():
    """Load categories database from JSON file."""
    if not os.path.exists(CATEGORIES_FILE):
        return []
    try:
        with open(CATEGORIES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def load_users():
    """Load user database from JSON file."""
    if not os.path.exists(USERS_FILE):
        return []
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def save_users(users):
    """Save user database to JSON file."""
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=2)


def hash_password(password):
    """Simple SHA-256 hash for password storage."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def validate_email(email):
    """Basic email format check."""
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email))


class ShopEaseHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that serves static files and handles API routes."""

    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/categories':
            self.handle_get_categories()
        elif parsed_path.path == '/api/search':
            query_components = parse_qs(parsed_path.query)
            self.handle_search(query_components)
        elif parsed_path.path == '/api/cart':
            query_components = parse_qs(parsed_path.query)
            self.handle_get_cart(query_components)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/signup':
            self.handle_signup()
        elif self.path == '/api/login':
            self.handle_login()
        elif self.path == '/api/cart':
            self.handle_post_cart()
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

    def handle_get_categories(self):
        categories = load_categories()
        self.send_json(200, {'success': True, 'data': categories})

    def handle_search(self, query_components):
        query = query_components.get('q', [''])[0].lower().strip()
        categories = load_categories()
        
        if not query:
            results = categories
        else:
            results = [
                item for item in categories 
                if query in item.get('product_name', '').lower() 
                or query in item.get('category', '').lower()
            ]
            
        self.send_json(200, {'success': True, 'data': results})

    def handle_get_cart(self, query_components):
        email = query_components.get('email', [''])[0].lower().strip()
        if not email:
            return self.send_json(400, {'success': False, 'message': 'Email is required'})
        
        carts = load_carts()
        user_cart = carts.get(email, [])
        self.send_json(200, {'success': True, 'cart': user_cart})

    def handle_post_cart(self):
        data = self.read_json_body()
        if not data:
            return self.send_json(400, {'success': False, 'message': 'Invalid request body'})
            
        email = (data.get('email') or '').lower().strip()
        cart = data.get('cart')
        
        if not email or cart is None:
            return self.send_json(400, {'success': False, 'message': 'Email and cart are required'})
            
        carts = load_carts()
        carts[email] = cart
        save_carts(carts)
        self.send_json(200, {'success': True, 'message': 'Cart saved successfully'})


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
    GET  /api/categories
    GET  /api/search?q=query
    POST /api/signup
    POST /api/login

  User DB: {os.path.basename(USERS_FILE)}
  Data DB: {os.path.basename(CATEGORIES_FILE)}
  Press Ctrl+C to stop
================================================
    """)

    server = http.server.ThreadingHTTPServer(('', PORT), ShopEaseHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[SERVER] Shutting down…")
        server.server_close()


if __name__ == '__main__':
    main()
