#!/usr/bin/env python3
"""Keep Inter's full character set, but only its used 400–700 weight range."""
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1]
source = root / "assets/fonts/source/inter-latin-variable-full.woff2"
target = root / "assets/fonts/inter-latin-variable.woff2"
font = TTFont(source, recalcTimestamp=False)
original_cmap = font.getBestCmap().copy()
original_glyphs = font.getGlyphOrder().copy()
instantiateVariableFont(font, {"wght": (400, 700)}, inplace=True)
assert font.getBestCmap() == original_cmap
assert font.getGlyphOrder() == original_glyphs
font.flavor = "woff2"
font.save(target)
print(f"Inter: {source.stat().st_size} → {target.stat().st_size} bytes")
