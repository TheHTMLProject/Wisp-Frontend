import re
import os

filepath = r'c:\Users\yzycoin\Desktop\Backuo\public\index.html'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix SVG filter type attribute (e.g., type=" matrix")
content = re.sub(r'type="\s+matrix"', 'type="matrix"', content)

# 2. Fix broken template literal placeholders
# Pattern: $ { something } or $ { something } across lines
# We want to match $ followed by any amount of whitespace, then {, then any content, then }
# We use a non-greedy match for the content.
def fix_template(match):
    placeholder_content = match.group(1).strip()
    # Normalize internal spaces/newlines if it's a simple variable or property access
    if '\n' in placeholder_content:
        placeholder_content = re.sub(r'\s+', ' ', placeholder_content).strip()
    return f'${{{placeholder_content}}}'

# Fix instances like $ { savedStyle }
content = re.sub(r'\$\s*\{\s*([^}]+?)\s*\}', fix_template, content, flags=re.MULTILINE)

# 3. Fix specific broken regex in xorDecode
# const match = str.match(/^([a-z0-9] { 8 } \/[a-z0-9] { 8 } \/)(.*)$/);
# Note: The input might have been broken by newlines too.
regex_pattern = r'str\.match\(\/\^([^/]+)\/\);'
def fix_regex(match):
    r_content = match.group(1)
    # Remove all whitespace from the regex content part that handles quantifier
    r_content = r_content.replace(' ', '').replace('\n', '').replace('\r', '')
    return f'str.match(/^{r_content}/);'

content = re.sub(regex_pattern, fix_regex, content, flags=re.MULTILINE)

# 4. Fix specific broken greeting/clock logic in initNewTab
# This might have been caught by the general template fix, but let's be sure.

# Write back
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleanup complete.")
