import os
import glob

html_files = glob.glob('*.html')
for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '<script src="main.js?v=8.0"></script>' in content:
        content = content.replace('<script src="main.js?v=8.0"></script>', '<script src="main.js?v=9.0"></script>')
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")
