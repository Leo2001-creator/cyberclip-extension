#!/usr/bin/env python3
"""
Cyberclip Icon Generator
Generates high-contrast cyberpunk HUD icons (16x16, 48x48, 128x128 PNG and SVG)
Colors:
  Cyber Yellow: #FCEE0A
  Electric Cyan: #00F0FF
  Deep Void: #08090C
  Armor Plate: #12151D
"""

import os
from PIL import Image, ImageDraw

ICON_DIR = "/home/antigravity/cyberclip-extension/icons"
os.makedirs(ICON_DIR, exist_ok=True)

def generate_png_icon(size):
    # Create RGBA canvas
    img = Image.new("RGBA", (size, size), (8, 9, 12, 255))
    draw = ImageDraw.Draw(img)
    
    # Scale helper
    def s(val):
        return int(round(val * size / 128.0))
    
    pad = s(6)
    w = size
    
    # Background Armor Plate with chamfer
    chamfer = s(16)
    # Polygon points with chamfered top-right and bottom-left
    poly_points = [
        (pad, pad),
        (w - pad - chamfer, pad),
        (w - pad, pad + chamfer),
        (w - pad, w - pad),
        (pad + chamfer, w - pad),
        (pad, w - pad - chamfer)
    ]
    draw.polygon(poly_points, fill=(18, 21, 29, 255), outline=(0, 240, 255, 255), width=max(1, s(3)))
    
    # Tech Corner brackets (Electric Cyan)
    bracket_len = s(18)
    line_w = max(1, s(4))
    cyan = (0, 240, 255, 255)
    yellow = (252, 238, 10, 255)
    
    # Top-left bracket
    draw.line([(pad + s(2), pad + s(2)), (pad + s(2) + bracket_len, pad + s(2))], fill=cyan, width=line_w)
    draw.line([(pad + s(2), pad + s(2)), (pad + s(2), pad + s(2) + bracket_len)], fill=cyan, width=line_w)
    
    # Bottom-right bracket
    draw.line([(w - pad - s(2), w - pad - s(2)), (w - pad - s(2) - bracket_len, w - pad - s(2))], fill=cyan, width=line_w)
    draw.line([(w - pad - s(2), w - pad - s(2)), (w - pad - s(2), w - pad - s(2) - bracket_len)], fill=cyan, width=line_w)
    
    # Center glyph: High-voltage lightning bolt / Cyber chevron
    # Lightning coordinates normalized to 128x128
    lightning = [
        (68, 26),
        (42, 64),
        (62, 64),
        (56, 102),
        (86, 56),
        (66, 56)
    ]
    scaled_lightning = [(s(x), s(y)) for (x, y) in lightning]
    draw.polygon(scaled_lightning, fill=yellow, outline=(255, 255, 255, 220), width=max(1, s(1)))
    
    # Telemetry dot (Cyan or Red accent)
    dot_r = max(1, s(3))
    cx = s(100)
    cy = s(28)
    draw.ellipse([(cx - dot_r, cy - dot_r), (cx + dot_r, cy + dot_r)], fill=cyan)
    
    filename = f"{ICON_DIR}/icon{size}.png"
    img.save(filename, "PNG")
    print(f"Generated {filename}")

for sz in [16, 48, 128]:
    generate_png_icon(sz)

# Also generate SVG
svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#00F0FF" flood-opacity="0.6"/>
    </filter>
    <filter id="yellow-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#FCEE0A" flood-opacity="0.8"/>
    </filter>
  </defs>
  
  <!-- Base Background -->
  <rect width="128" height="128" fill="#08090C" />
  
  <!-- HUD Chamfered Card -->
  <polygon points="6,6 106,6 122,22 122,122 22,122 6,106" 
           fill="#12151D" stroke="#00F0FF" stroke-width="2.5" filter="url(#glow)"/>
  
  <!-- Technical Grid lines inside -->
  <line x1="16" y1="40" x2="112" y2="40" stroke="#00F0FF" stroke-width="0.5" stroke-opacity="0.3" stroke-dasharray="4 2"/>
  <line x1="16" y1="88" x2="112" y2="88" stroke="#00F0FF" stroke-width="0.5" stroke-opacity="0.3" stroke-dasharray="4 2"/>
  
  <!-- Corner Tech Brackets -->
  <path d="M 12 28 L 12 12 L 28 12" fill="none" stroke="#00F0FF" stroke-width="3" />
  <path d="M 116 100 L 116 116 L 100 116" fill="none" stroke="#00F0FF" stroke-width="3" />
  
  <!-- Telemetry Beacon -->
  <circle cx="102" cy="24" r="3.5" fill="#00F0FF" />
  <circle cx="102" cy="24" r="6" fill="none" stroke="#00F0FF" stroke-width="1" stroke-opacity="0.5"/>
  
  <!-- High-voltage Lightning / Cyber Glyph -->
  <polygon points="68,26 42,64 62,64 56,102 86,56 66,56" 
           fill="#FCEE0A" stroke="#FFFFFF" stroke-width="1" filter="url(#yellow-glow)"/>
           
  <!-- Sub-label -->
  <text x="14" y="118" font-family="'Share Tech Mono', monospace" font-size="8" fill="#00F0FF" letter-spacing="1">CLIP // V1</text>
</svg>"""

with open(f"{ICON_DIR}/icon.svg", "w") as f:
    f.write(svg_content)
print(f"Generated {ICON_DIR}/icon.svg")
