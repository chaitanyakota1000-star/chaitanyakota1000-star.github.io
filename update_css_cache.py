import os
import glob

html_files = glob.glob('*.html')
for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'style.css?v=1.2' in content:
        content = content.replace('style.css?v=1.2', 'style.css?v=2.0')
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated CSS cache in {file}")
