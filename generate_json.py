import os
import re
import json

def generate_id(name):
    """Generate a URL-friendly slug ID from the product name."""
    name = name.lower()
    name = re.sub(r'[^a-z0-9]+', '-', name)
    return name.strip('-')

files = [f for f in os.listdir('.') if f.endswith('.html')]
exclude = ['cart.html', 'contactus.html', 'index.html', 'login.html', 'signuppage.html', 'experiment1on_capstone.html']
categories_files = [f for f in files if f not in exclude]

products = []

for filename in categories_files:
    category = filename.replace('.html', '')
    
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
        
        # This regex matches the standard product-card structure to extract image, name, and price
        # It handles spaces and newlines between tags.
        pattern = r'<img\s+src=["\'](.*?)["\'].*?>\s*<div class="product-name">(.*?)</div>\s*<div class="product-price">(.*?)</div>'
        matches = re.findall(pattern, content, flags=re.DOTALL | re.IGNORECASE)
        
        # Also handle experiment1on_capstone.html style cards if they are in category files
        pattern2 = r'<img\s+src=["\'](.*?)["\'].*?>.*?<div class="product-title">(.*?)</div>.*?<div class="product-price">(.*?)</div>'
        matches2 = re.findall(pattern2, content, flags=re.DOTALL | re.IGNORECASE)
        
        all_matches = matches + matches2
        
        for img, name, price in all_matches:
            name = name.strip()
            products.append({
                "id": generate_id(name),
                "product_name": name,
                "price": price.strip(),
                "category": category,
                "image": img.strip()
            })

# Remove duplicates in case of overlaps
unique_products = {p["id"]: p for p in products}.values()

with open("categories.json", "w", encoding="utf-8") as f:
    json.dump(list(unique_products), f, indent=4)
    print(f"Written {len(unique_products)} products to categories.json")
