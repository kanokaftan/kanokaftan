"""Finds where a captured bottom bar (tab bar / Add-to-cart bar) sits in a screen, in screenshot pixels.

    python3 -I locate_bar.py raw/shop.png raw/shop-tabbar.png
prints e.g. "top=2581 height=213" -> use style="top:2581px" for the <img class="bar"> overlay.
"""
import sys

import numpy as np
from PIL import Image

STEP = 8  # compare every 8th pixel: plenty for an exact match, much faster

full = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
bar = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(int)
h = bar.shape[0]
best = min(range(full.shape[0] - h), key=lambda y: np.abs(full[y:y + h:STEP, ::STEP] - bar[::STEP, ::STEP]).mean())
print(f"top={best} height={h}")
