#!/usr/bin/env python3
import os
import re
import shutil
import subprocess

SRC = '.'
WORK = '/tmp/minify'
OUTPUT = '/tmp/minify/adastra_bundle.html'

os.makedirs(WORK, exist_ok=True)

# --- Read source files ---
with open(f'{SRC}/adastra.html', 'r') as f:
    html = f.read()
with open(f'{SRC}/adastra.css', 'r') as f:
    css = f.read()

# --- Copy .js files verbatim (esbuild handles exports/imports fine) ---
# 'three.min.js' not copied, assume it's already in {WORK}!
for js in ['constellations.js', 'physics.js', 'texture.js', 'extrasolar.js', 'data.js', 'galaxymap.js']:
    shutil.copy(f'{SRC}/{js}', f'{WORK}/{js}')

shutil.copy(f'{SRC}/minishader.js', f'{WORK}/shaderstring.js')

# --- Extract the <script type="module"> block from index.html ---
module_match = re.search(r'<script type=["\']module["\']>(.*?)</script>', html, re.DOTALL)
if not module_match:
    raise RuntimeError("Could not find <script type=\"module\"> in index.html")
module_code = module_match.group(1)

# three.min.js is a global script, not an ES module.
# Import it as a side-effect using esbuild's inject or just prepend a reference.
# Easiest: copy it to work dir (done above) and prepend an import of the globals we need,
# but since three.min.js sets window.THREE, we just need it executed first.
# We handle this by keeping it as a separate <script> in the final HTML (see below).

# Write main.js from the extracted module block
with open(f'{WORK}/main.js', 'w') as f:
    f.write(module_code)

# --- Run esbuild ---
result = subprocess.run([
    'esbuild', f'{WORK}/main.js',
    '--bundle',
    '--minify',
    '--format=iife',
    '--external:three',      # THREE is a global from three.min.js, don't bundle it
    f'--outfile={WORK}/main.min.js',
], capture_output=True, text=True)

if result.returncode != 0:
    print("esbuild stderr:", result.stderr)
    raise RuntimeError("esbuild failed")
print("esbuild ok:", result.stderr.strip())

# --- Read esbuild output ---
with open(f'{WORK}/main.min.js', 'r') as f:
    js_min = f.read()
with open(f'{WORK}/three.min.js', 'r') as f:
    three_js = f.read()

# --- Build final HTML ---
# Start from original, strip script and link tags, inject everything inline
out_html = html

# Remove <link> stylesheet tag
out_html = re.sub(r'<link\b[^>]*rel=["\']stylesheet["\'][^>]*>', '', out_html)

# Remove <script src='./three.min.js'> tag
out_html = re.sub(r'<script\s+src=["\']\.\/three\.min\.js["\'][^>]*></script>', '', out_html)

# Remove the module script block
out_html = re.sub(r'<script type=["\']module["\']>.*?</script>', '', out_html, flags=re.DOTALL)

# Inject CSS into <head>
out_html = out_html.replace('</head>', f'<style>\n{css}\n</style>\n</head>')

# Inject three.min.js and then bundled code before </body>
# three.min.js must come first since main bundle references THREE as a global
out_html = out_html.replace('</body>',
    f'<script>\n{three_js}\n</script>\n'
    f'<script>\n{js_min}\n</script>\n'
    f'</body>'
)

with open(OUTPUT, 'w') as f:
    f.write(out_html)

print(f"Written {OUTPUT}")
