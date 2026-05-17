#!/usr/bin/env python3

"""
Bakes data files into data.js as JavaScript constants.

Text files (.csv, .dat):
  Exposed as { text: async () => string }.
  single_read=True  → nulls _d after first call (large files, one consumer)
  single_read=False → keeps _d alive (small files with multiple consumers)

JSON files (.json):
  Pre-parsed and emitted as a compact JS object-array literal.
  Exposed as { get: () => array } — one-shot, nulls _d after first call.

Memory notes:
  - stars.dat (11 MB) is nulled immediately after the parser runs.
  - milkyway.csv (378 KB) is kept alive; both physics.js and galaxymap.js
    call .text() on it at different times.
  - galaxy_dots.json is nulled after galaxymap.js builds the scene geometry.
"""

import json

# (filename, single_read)  — single_read only applies to text files
TEXT_FILES = [
    ('milkyway.csv',      True),    # read once by physics.js; shared via milkywayData export
    ('star_name_map.dat', True),
    ('stars.dat',         True),
]

JSON_FILES = [
    'galaxy_dots.json',
]


def js_name(filename):
    stem = filename.rsplit('.', 1)[0]
    return ''.join(w.capitalize() for w in stem.replace('_', ' ').split())


def escape(s):
    s = s.replace('\\', '\\\\')
    s = s.replace('`', '\\`')
    s = s.replace('${', '\\${')
    return s


def fmt_float(v):
    """Round to 3 decimal places, strip trailing zeros."""
    r = round(v, 3)
    if r == int(r):
        return str(int(r))
    return f'{r:g}'


with open('data.js', 'w') as out:

    # ── Text constants ─────────────────────────────────────────────────────
    for filename, single_read in TEXT_FILES:
        name = js_name(filename)
        with open(filename, 'r', encoding='utf-8') as f:
            content = escape(f.read())
        out.write(f'export const {name} = (function() {{\n')
        out.write(f'  let _d = `{content}`;\n')
        if single_read:
            out.write('  return { text: async () => { const s = _d; _d = null; return s; } };\n')
        else:
            out.write('  return { text: async () => _d };\n')
        out.write('})();\n\n')

    # ── JSON constants ─────────────────────────────────────────────────────
    for filename in JSON_FILES:
        name = js_name(filename)
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        out.write(f'export const {name} = (function() {{\n')
        out.write('  let _d = [\n')
        last = len(data) - 1
        for i, e in enumerate(data):
            x, y, r = int(e['x']), int(e['y']), int(e['r'])
            R, G, B, A = fmt_float(e['R']), fmt_float(e['G']), fmt_float(e['B']), fmt_float(e['A'])
            comma = ',' if i < last else ''
            out.write(f'    {{x:{x},y:{y},r:{r},R:{R},G:{G},B:{B},A:{A}}}{comma}\n')
        out.write('  ];\n')
        out.write('  return { get: () => { const d = _d; _d = null; return d; } };\n')
        out.write('})();\n\n')

print("Written data.js")
