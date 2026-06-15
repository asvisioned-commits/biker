import os
import re

patterns = [
    re.compile(r'DEV_MODE', re.IGNORECASE),
    re.compile(r'IS_DEV', re.IGNORECASE),
    re.compile(r'devHud', re.IGNORECASE),
    re.compile(r'mock_session', re.IGNORECASE),
    re.compile(r'biker_mock', re.IGNORECASE)
]

src_dir = os.path.join(os.path.dirname(__file__), 'src')

for root, dirs, files in os.walk(src_dir):
    # Skip build/node directories
    if 'node_modules' in dirs:
        dirs.remove('node_modules')
    if '.next' in dirs:
        dirs.remove('.next')
        
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.json')):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    for idx, line in enumerate(f, 1):
                        for pattern in patterns:
                            if pattern.search(line):
                                rel_path = os.path.relpath(filepath, os.path.dirname(__file__))
                                print(f"{rel_path}:{idx}: {line.strip()}")
                                break
            except Exception as e:
                pass
