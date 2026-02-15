import re
import os

filepath = r'c:\Users\yzycoin\Desktop\Backuo\public\index.html'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix broken template placeholders $ { -> ${
content = re.sub(r'\$\s*\{\s*([^}]+?)\s*\}', lambda m: f"${{{m.group(1).strip()}}}", content)

# 2. Fix template literals with newlines used for IDs or Classes
# This helps avoid DOMTokenList errors
def clean_template_literals(m):
    inner = m.group(1)
    # If the literal contains typical class/ID prefixes or is short and contains a placeholder
    if '${' in inner and any(p in inner for p in ['tab-style', 'nt-', 'auth-view', 'clock-', 'st-']):
        # Remove all whitespace and newlines
        return "`" + re.sub(r'\s+', '', inner) + "`"
    return m.group(0)

content = re.sub(r'`([^`]+?)`', clean_template_literals, content, flags=re.DOTALL)

# 3. Fix broken regexes (specifically in xorDecode)
def clean_regex_matches(m):
    inner = m.group(1)
    # Remove all whitespace from the regex content
    cleaned = re.sub(r'\s+', '', inner)
    return f"str.match(/^" + cleaned + "/);"

content = re.sub(r'str\.match\(\/\^(.+?)\/\);', clean_regex_matches, content, flags=re.DOTALL)

# 4. Fix broken HTML comments
content = re.sub(r'<\s*!\s*--\s*-*', '<!-- ', content)

# 5. Fix SVG feColorMatrix
content = re.sub(r'type="\s+matrix"', 'type="matrix"', content)

# 6. Fix broken commas in function arguments
content = re.sub(r'\}\s*,\s*event\.origin', '}, event.origin', content)
content = re.sub(r'\}\s*,\s*1000\)', '}, 1000)', content)
content = re.sub(r'\}\s*,\s*100\)', '}, 100)', content)
content = re.sub(r'\}\s*,\s*200\)', '}, 200)', content)
content = re.sub(r'\}\s*,\s*300\)', '}, 300)', content)

# 7. Fix broken object properties/methods
content = re.sub(r'src:\s*entry\.proxyUrl', 'src: entry.proxyUrl', content)
content = re.sub(r'type:\s*\'newtab\'', "type: 'newtab'", content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Refined cleanup complete.")
