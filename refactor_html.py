import os
import glob
import re
import json

# Load categories to map product names to IDs
with open('categories.json', 'r', encoding='utf-8') as f:
    products = json.load(f)
name_to_id = {p['product_name']: p['id'] for p in products}

html_files = glob.glob('*.html')
modified_files = 0

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace addToCart('Name', Price) with addToCart('id')
    def replacer(match):
        name = match.group(1).strip()
        if name in name_to_id:
            return f"addToCart('{name_to_id[name]}')"
        print(f"Warning: Product '{name}' not found in categories.json for {filepath}")
        # fallback, just generate the id logic here
        generated_id = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        return f"addToCart('{generated_id}')"
    
    # Match addToCart('Name', price) or addToCart("Name", price)
    # The regex looks for addToCart( followed by quotes, capturing the name, followed by quotes, comma, digits, closing paren
    new_content = re.sub(r'addToCart\(\s*[\'"](.*?)[\'"]\s*,\s*\d+\s*\)', replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        modified_files += 1
        print(f"Updated {filepath}")

print(f"Migration complete. Updated {modified_files} HTML files.")
