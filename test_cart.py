import urllib.request
import json

URL = 'http://localhost:8000/api/cart'
EMAIL = 'testuser@example.com'

print("1. Fetching cart for new user (should be empty):")
req = urllib.request.Request(f"{URL}?email={EMAIL}")
with urllib.request.urlopen(req) as response:
    print(json.loads(response.read().decode()))

print("\n2. Simulating saveCart (POSTing items to backend):")
data = {
    "email": EMAIL,
    "cart": [
        {"name": "Flashlight", "price": 850, "quantity": 2},
        {"name": "iPhone 15", "price": 79999, "quantity": 1}
    ]
}
req = urllib.request.Request(URL, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(req) as response:
    print(json.loads(response.read().decode()))

print("\n3. Fetching cart again (should contain saved items):")
req = urllib.request.Request(f"{URL}?email={EMAIL}")
with urllib.request.urlopen(req) as response:
    print(json.loads(response.read().decode()))
