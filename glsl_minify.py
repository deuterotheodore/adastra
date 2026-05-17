#!/usr/bin/env python3
"""
glsl_minify.py — Minifier for GLSL shader strings embedded in JavaScript modules.

Finds every back-tick template literal in the .js source, treats its content as
GLSL, and applies three transformations (JS outside the backticks is untouched):

  1. Strip // line comments and /* block comments */
  2. Collapse all whitespace, re-inserting a single space only where adjacent
     tokens would merge into a different token without it.
  3. Rename every user-defined *internal* identifier to a short generated name
     (a, b, …, z, aa, ab, …, az, ba, …).

Identifiers that are NOT renamed
─────────────────────────────────
  • GLSL keywords, built-in types, and built-in functions/variables
  • Three.js auto-injected uniforms/attributes (position, modelViewMatrix, …)
  • Names declared with  attribute / uniform / varying  — these are the ABI
    shared with JavaScript or with the other shader stage (varyings)
  • Any identifier starting with  gl_
  • Identifiers appearing after a '.' (vector swizzles, struct field accesses)

Assumptions (verify before calling on a new shader)
────────────────────────────────────────────────────
  • No escaped back-ticks inside template literals
  • No template expressions  ${ … }  inside shader strings
  • '//' always introduces a line comment (no '//' inside GLSL strings)

Usage
─────
  python glsl_minify.py  input.js  [output.js]

  Without an output file the result is written to stdout.
  A rename summary is always printed to stderr.
"""

import re
import sys


# ─────────────────────────────────────────────────────────────────────────────
# Short-name generator:  a b … z aa ab … az ba … zz aaa …
# ─────────────────────────────────────────────────────────────────────────────

def name_seq():
    """Bijective base-26 over lowercase letters."""
    n = 0
    while True:
        s, i = '', n
        while True:
            s = chr(ord('a') + i % 26) + s
            i //= 26
            if i == 0:
                break
            i -= 1
        yield s
        n += 1


# ─────────────────────────────────────────────────────────────────────────────
# GLSL built-ins — never rename these.
# ─────────────────────────────────────────────────────────────────────────────
# NOTE: 'color' is listed as a Three.js auto-injected vertex attribute.
# If you use 'color' purely as a local variable and know Three.js won't inject
# it for your material, you can safely remove it from this set.

PROTECTED = frozenset({
    # ── scalar / vector / matrix types ───────────────────────────────────────
    'void', 'bool', 'int', 'uint', 'float', 'double',
    'vec2', 'vec3', 'vec4', 'bvec2', 'bvec3', 'bvec4',
    'ivec2', 'ivec3', 'ivec4', 'uvec2', 'uvec3', 'uvec4',
    'mat2', 'mat3', 'mat4',
    'mat2x2', 'mat2x3', 'mat2x4',
    'mat3x2', 'mat3x3', 'mat3x4',
    'mat4x2', 'mat4x3', 'mat4x4',
    'sampler2D', 'sampler3D', 'samplerCube', 'sampler2DShadow',
    # ── storage / precision qualifiers ───────────────────────────────────────
    'attribute', 'uniform', 'varying',
    'in', 'out', 'inout', 'const', 'precision',
    'highp', 'mediump', 'lowp',
    # ── flow keywords ─────────────────────────────────────────────────────────
    'if', 'else', 'for', 'while', 'do',
    'switch', 'case', 'default',
    'break', 'continue', 'return', 'discard',
    'struct', 'true', 'false',
    # ── entry point ───────────────────────────────────────────────────────────
    'main',
    # ── built-in variables ────────────────────────────────────────────────────
    'gl_Position', 'gl_PointSize',
    'gl_FragCoord', 'gl_FrontFacing', 'gl_FragDepth',
    'gl_PointCoord', 'gl_VertexID', 'gl_InstanceID', 'gl_FragColor',
    # ── built-in functions ────────────────────────────────────────────────────
    'radians', 'degrees',
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
    'pow', 'exp', 'log', 'exp2', 'log2', 'sqrt', 'inversesqrt',
    'abs', 'sign', 'floor', 'trunc', 'round', 'roundEven', 'ceil', 'fract',
    'mod', 'modf', 'min', 'max', 'clamp', 'mix', 'step', 'smoothstep',
    'isnan', 'isinf',
    'length', 'distance', 'dot', 'cross', 'normalize',
    'faceforward', 'reflect', 'refract',
    'matrixCompMult', 'outerProduct', 'transpose', 'determinant', 'inverse',
    'lessThan', 'lessThanEqual', 'greaterThan', 'greaterThanEqual',
    'equal', 'notEqual', 'any', 'all', 'not',
    'texture2D', 'textureCube', 'texture', 'textureProj', 'textureLod',
    'texelFetch', 'textureSize', 'textureGrad',
    'dFdx', 'dFdy', 'fwidth', 'emit', 'endPrimitive',
    # ── Three.js auto-injected uniforms / attributes ──────────────────────────
    'modelViewMatrix', 'projectionMatrix', 'modelMatrix', 'viewMatrix',
    'normalMatrix', 'cameraPosition',
    'position', 'normal', 'uv', 'uv2', 'color',
    'skinWeight', 'skinIndex', 'morphTargetInfluences',
})


# ─────────────────────────────────────────────────────────────────────────────
# Tokenizer
# ─────────────────────────────────────────────────────────────────────────────
# Operators are tokenised greedily longest-first so that compound operators
# (+=, ++, &&, …) are never split, preventing the whitespace pass from
# accidentally forming a different operator (e.g. '+' ' ' '=' → '+ =' not '+=').

_OP = (
    r'&&|\|\|'                           # logical
    r'|<<=|>>='                          # shift-assign
    r'|==|!=|<=|>='                      # comparison
    r'|<<|>>'                            # shift
    r'|\+\+|--'                          # increment / decrement
    r'|\+=|-=|\*=|/=|%=|&=|\|=|\^='     # compound assignments
    r'|[+\-*/%&|^~!<>=?:.;,\(\)\[\]{}]' # single-char operators & punctuation
)

_TOK = re.compile(
    r'(?P<lcomment>//[^\n]*)'                                        # // …
    r'|(?P<bcomment>/\*.*?\*/)'                                      # /* … */
    r'|(?P<ident>[a-zA-Z_]\w*)'                                      # identifier
    r'|(?P<number>(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[fFuUlL]?)'  # numeric
    r'|(?P<ws>\s+)'                                                  # whitespace
    r'|(?P<op>' + _OP + r')'                                        # operators
    r'|(?P<other>.)',                                                # catch-all
    re.DOTALL,
)

def tokenize(src):
    """Return list of (kind, value) pairs for every token in src."""
    return [(m.lastgroup, m.group()) for m in _TOK.finditer(src)]


# ─────────────────────────────────────────────────────────────────────────────
# Interface-name extraction
# ─────────────────────────────────────────────────────────────────────────────

_IFACE = re.compile(
    r'\b(?:attribute|uniform|varying)\s+'
    r'(?:(?:highp|mediump|lowp)\s+)?'   # optional precision qualifier
    r'\w+\s+'                            # type name
    r'(\w+)',                            # ← the declared variable name
)

def find_interface_names(src):
    """Return the set of names introduced by attribute / uniform / varying."""
    return {m.group(1) for m in _IFACE.finditer(src)}


# ─────────────────────────────────────────────────────────────────────────────
# Post-dot identifier detection
# ─────────────────────────────────────────────────────────────────────────────

def _split_post_dot(tokens):
    """
    Walk the token stream (whitespace ignored for adjacency) and return:

      post_dot   — identifiers appearing immediately after a '.' token;
                   these are vector swizzles or struct field accesses and
                   must never be renamed regardless of their spelling.
      standalone — every other identifier occurrence.

    If the same name appears in both groups (e.g. a local variable named 'z'
    that also appears as a swizzle), post_dot wins — conservative but safe.
    """
    post_dot, standalone = set(), set()
    prev_k, prev_v = None, None
    for k, v in tokens:
        if k == 'ws':
            continue
        if k == 'ident':
            if prev_k == 'op' and prev_v == '.':
                post_dot.add(v)
            else:
                standalone.add(v)
        prev_k, prev_v = k, v
    standalone -= post_dot
    return post_dot, standalone


# ─────────────────────────────────────────────────────────────────────────────
# Rename-map builder
# ─────────────────────────────────────────────────────────────────────────────

def build_rename_map(tokens, interface_names):
    """
    Return  {original_name: short_name}  for every renameable identifier.
    """
    post_dot, standalone = _split_post_dot(tokens)
    all_idents = post_dot | standalone

    protected_here = (
        PROTECTED
        | interface_names
        | {n for n in all_idents if n.startswith('gl_')}
        | post_dot                       # swizzles / field names stay as-is
    )

    renameable = sorted(n for n in standalone if n not in protected_here)

    taken = set(protected_here)
    gen = name_seq()
    rename = {}
    for name in renameable:
        short = next(gen)
        while short in taken:
            short = next(gen)
        rename[name] = short
        taken.add(short)
    return rename


# ─────────────────────────────────────────────────────────────────────────────
# Whitespace minifier
# ─────────────────────────────────────────────────────────────────────────────

# Single-char token pairs whose concatenation would form a meaningful two-char
# token.  Compound operators (+=, ++, …) are already single tokens so they
# can't form by accident; only these comment-starters and incr/decr remain.
_DANGER = frozenset({'//','/*','++','--'})

def _needs_space(a: str, b: str) -> bool:
    """True when concatenating token values a and b would change meaning."""
    if (a[-1].isalnum() or a[-1] == '_') and (b[0].isalnum() or b[0] == '_'):
        return True
    if a[-1] + b[0] in _DANGER:
        return True
    return False

def minify(tokens):
    """
    Drop whitespace and comment tokens; re-insert a single space between
    adjacent tokens only where required to preserve meaning.
    """
    meaningful = [(k, v) for k, v in tokens
                  if k not in ('ws', 'lcomment', 'bcomment')]
    parts = []
    for i, (_, v) in enumerate(meaningful):
        parts.append(v)
        if i + 1 < len(meaningful):
            if _needs_space(v, meaningful[i + 1][1]):
                parts.append(' ')
    return ''.join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# Process a single GLSL string
# ─────────────────────────────────────────────────────────────────────────────

def process_glsl(src):
    """Minify one GLSL source string. Returns (minified_string, rename_dict)."""
    tokens = tokenize(src)

    # Extract interface names from the *original* source (before comment removal)
    iface = find_interface_names(src)

    # Drop comments for all subsequent analysis
    clean = [(k, v) for k, v in tokens if k not in ('lcomment', 'bcomment')]

    rename = build_rename_map(clean, iface)

    # Apply rename: identifier tokens get the short name UNLESS they follow a
    # '.' (swizzle / field access), in which case they stay unchanged.
    renamed = []
    prev_k, prev_v = None, None
    for k, v in clean:
        if k == 'ws':
            renamed.append((k, v))
        else:
            is_post_dot = (k == 'ident' and prev_k == 'op' and prev_v == '.')
            if k == 'ident' and not is_post_dot and v in rename:
                renamed.append((k, rename[v]))
            else:
                renamed.append((k, v))
            prev_k, prev_v = k, v

    return minify(renamed), rename


# ─────────────────────────────────────────────────────────────────────────────
# JS file processor — walk the source, process each template literal
# ─────────────────────────────────────────────────────────────────────────────

def process_js(src):
    """
    Walk src character by character.  Everything outside back-tick literals
    is passed through verbatim.  Each literal's content is processed as GLSL.

    Assumptions:
      • No escaped back-ticks  (per caller's guarantee)
      • No  ${ … }  template expressions inside shader literals
    """
    out = []
    all_renames = {}
    i = 0
    while i < len(src):
        if src[i] == '`':
            j = src.index('`', i + 1)
            glsl_src = src[i + 1 : j]
            mini, rename = process_glsl(glsl_src)
            out.append('`')
            out.append(mini)
            out.append('`')
            all_renames.update(rename)
            i = j + 1
        else:
            out.append(src[i])
            i += 1
    return ''.join(out), all_renames


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        sys.exit(f'Usage: {sys.argv[0]} input.js [output.js]')

    with open(sys.argv[1], encoding='utf-8') as fh:
        src = fh.read()

    result, renames = process_js(src)

    if len(sys.argv) >= 3:
        with open(sys.argv[2], 'w', encoding='utf-8') as fh:
            fh.write(result)
        print(f'Written → {sys.argv[2]}', file=sys.stderr)
    else:
        sys.stdout.write(result)

    # ── rename summary ────────────────────────────────────────────────────────
    if renames:
        w = max(len(k) for k in renames)
        orig_chars = sum(len(k) for k in renames)
        new_chars  = sum(len(v) for v in renames.values())
        print(
            f'\n{len(renames)} identifier(s) renamed '
            f'({orig_chars} → {new_chars} chars across all declaration sites):',
            file=sys.stderr,
        )
        for orig, short in sorted(renames.items()):
            print(f'  {orig:<{w}}  →  {short}', file=sys.stderr)
    else:
        print('\nNo identifiers renamed.', file=sys.stderr)


if __name__ == '__main__':
    main()
