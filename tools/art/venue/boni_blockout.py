# Layout sketch of the view from the Boni court across to the north-east (from LGLN aerial + cadastre and on-site photos).
from PIL import Image, ImageDraw
import random
random.seed(61)
W, H = 1536, 864
im = Image.new('RGB', (W, H), (190, 220, 240))
d = ImageDraw.Draw(im)
K = (25, 20, 15)
horizon = 520
# north-east building row: Gründerzeit houses, 4-5 storeys, red roofs, some dormers; the big Bonifatiusschule on the left
x = 0
blocks = [(330, 'school')] + [(random.randint(130, 190), 'house') for _ in range(9)]
for w, kind in blocks:
    top = horizon - (300 if kind == 'school' else random.randint(200, 250))
    roof = 60 if kind == 'school' else 45
    wall = (240, 235, 222) if kind == 'school' or random.random() < 0.5 else random.choice([(232, 214, 186), (224, 200, 170), (236, 226, 205)])
    d.rectangle([x, top, x + w, horizon], fill=wall, outline=K, width=3)
    d.polygon([(x - 6, top), (x + 18, top - roof), (x + w - 18, top - roof), (x + w + 6, top)], fill=(184, 80, 46), outline=K, width=3)
    for dx in range(x + 30, x + w - 30, 70 if kind == 'school' else 60):
        d.chord([dx - 12, top - roof + 12, dx + 12, top - roof + 36], 180, 360, fill=wall, outline=K, width=2)
    for fy in range(top + 25, horizon - 60, 48):
        for fx in range(x + 18, x + w - 30, 38):
            d.rectangle([fx, fy, fx + 20, fy + 32], fill=(170, 196, 207), outline=K, width=2)
    if kind == 'school':
        d.rectangle([x + w // 2 - 26, horizon - 70, x + w // 2 + 26, horizon], fill=(120, 90, 60), outline=K, width=3)
    x += w
# street with the row of parked cars
d.rectangle([0, horizon, W, horizon + 40], fill=(150, 150, 148), outline=K, width=2)
cx = 10
while cx < W - 120:
    col = random.choice([(198, 59, 59), (138, 144, 153), (63, 74, 92), (230, 230, 230), (40, 40, 45)])
    d.rounded_rectangle([cx, horizon + 6, cx + 110, horizon + 36], 8, fill=col, outline=K, width=2)
    d.rounded_rectangle([cx + 22, horizon - 14, cx + 86, horizon + 10], 8, fill=col, outline=K, width=2)
    cx += random.randint(118, 140)
d.rectangle([0, horizon + 40, W, 680], fill=(150, 118, 86))
# linden trees of the park strip between court and street
for tx in range(60, W, 190):
    tx += random.randint(-30, 30)
    d.rectangle([tx - 9, 260, tx + 9, 640], fill=(107, 84, 66), outline=K, width=2)
    for _ in range(7):
        r = random.randint(60, 95)
        ox, oy = tx + random.randint(-90, 90), random.randint(90, 280)
        d.ellipse([ox - r, oy - r * 0.8, ox + r, oy + r * 0.8], fill=random.choice([(127, 174, 74), (100, 150, 60), (140, 190, 90)]), outline=K, width=2)
# left (north-west) behind the fence: the sand playground with the wooden hippo sculpture,
# a red brick border, a swing and the play house with a red roof
d.polygon([(0, 600), (420, 600), (380, 660), (0, 660)], fill=(236, 217, 168), outline=K, width=3)   # sand
d.line([(0, 598), (420, 598)], fill=(170, 70, 50), width=6)                                    # brick border
d.ellipse([120, 560, 300, 640], fill=(150, 140, 125), outline=K, width=3)                      # hippo body (wood)
d.ellipse([270, 545, 345, 610], fill=(150, 140, 125), outline=K, width=3)                      # hippo head
d.rectangle([140, 620, 160, 650], fill=(150, 140, 125), outline=K, width=2); d.rectangle([250, 620, 270, 650], fill=(150, 140, 125), outline=K, width=2)
d.line([(330, 470), (360, 600)], fill=K, width=4); d.line([(420, 470), (390, 600)], fill=K, width=4); d.line([(325, 470), (425, 470)], fill=K, width=5)  # swing frame
d.rectangle([20, 520, 110, 600], fill=(190, 150, 100), outline=K, width=3)                     # play house
d.polygon([(10, 520), (65, 480), (120, 520)], fill=(184, 80, 46), outline=K, width=3)
# right (south-east), right next to the fence: the stainless steel bowl ("Schale") and spinning tops
d.ellipse([1040, 640, 1320, 690], fill=(200, 205, 210), outline=K, width=4)
d.ellipse([1070, 648, 1290, 682], fill=(225, 230, 235), outline=K, width=2)
for kx in (1380, 1460):
    d.line([(kx, 600), (kx, 660)], fill=(200, 40, 40), width=6)
    d.ellipse([kx - 30, 640, kx + 30, 660], fill=(160, 165, 170), outline=K, width=3)
# tall welded-mesh ball-stop fence with posts, diagonal struts and two built-in steel football goals
ft, fb = 300, 680
for gx in range(0, W, 14):
    d.line([gx, ft, gx, fb], fill=(70, 85, 75), width=1)
for gy in range(ft, fb, 26):
    d.line([0, gy, W, gy], fill=(70, 85, 75), width=1)
for px in range(0, W, 210):
    d.rectangle([px, ft - 8, px + 7, fb], fill=(80, 95, 85), outline=K, width=1)
    d.line([px + 3, ft + 60, px + 90, fb], fill=(80, 95, 85), width=5)
for gx in (90, 1180):
    d.rectangle([gx, fb - 150, gx + 260, fb], outline=(120, 128, 122), width=10)
# court: white mobile boards with green rail, two red hockey goals, asphalt with worn lines
d.rectangle([0, fb, W, fb + 60], fill=(242, 240, 234), outline=K, width=3)
d.rectangle([0, fb, W, fb + 10], fill=(31, 90, 51))
for bx in range(0, W, 128):
    d.line([bx, fb, bx, fb + 60], fill=K, width=2)
d.rectangle([0, fb + 60, W, H], fill=(96, 99, 104))
d.line([0, H - 40, W, H - 70], fill=(238, 236, 228), width=5)
for gx in (200, 1240):
    d.rectangle([gx, fb + 20, gx + 110, fb + 90], outline=(216, 48, 60), width=8)
im.save('blockout.png')
print('ok')
