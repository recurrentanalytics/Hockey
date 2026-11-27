"""Invisible shadow casters for the Boni court: every tree crown and house within ~45 m, built as
columns from the LGLN surface model (DOM1 minus DGM1, 1 m grid; see docs/BONI_ORT.md) and the ALKIS
building mask. The game loads them cast-only, so the sun throws real shadows of the real trees and
houses onto the court at the real sun position.
Usage: python3 shadow_casters.py <hoehe.png> <gebaeude.png> <out.glb>"""
import sys, numpy as np
from PIL import Image
sys.path.insert(0, __import__('os').path.dirname(__file__))
from court_glb import Gltf, Geo

H = np.asarray(Image.open(sys.argv[1])).astype(np.float32) * 0.15        # height above ground, m
B = np.asarray(Image.open(sys.argv[2])) > 128                            # buildings
N = H.shape[0]
OUT = dict(x0=-2176, y0=-2395.7, w=6120, h=6128.6)                     # grid extent in 0.2 m reference pixels
CENTER = np.array([898.4, 668.4])
enu = lambda px, py: np.array([(px - CENTER[0]) * 0.2, -(py - CENTER[1]) * 0.2])
A_, B_, D_ = enu(888.6, 591.5), enu(967.9, 634.1), enu(828.9, 702.7)
C_ = (enu(888.6, 591.5) + enu(967.9, 634.1) + enu(908.2, 745.3) + enu(828.9, 702.7)) / 4
u = (D_ - A_) / np.linalg.norm(D_ - A_); v = (B_ - A_) / np.linalg.norm(B_ - A_)
def local(i, j):
    """grid corner (i, j) → court coordinates (a, b)"""
    e = enu(OUT['x0'] + i * OUT['w'] / N, OUT['y0'] + j * OUT['h'] / N) - C_
    return float(e @ u), float(e @ v)

R = 46
# a smooth canopy instead of blocky 1 m columns: blur the heights (crowns are round), sample them on a
# 0.5 m grid aligned with the court and stretch one continuous surface over it. Where nothing stands it
# dips below the ground, so the outline of every shadow comes out soft and rounded.
def blur(img, sigma):
    r = int(3 * sigma); k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * sigma * sigma)); k /= k.sum()
    img = np.apply_along_axis(lambda m: np.convolve(m, k, 'same'), 0, img)
    return np.apply_along_axis(lambda m: np.convolve(m, k, 'same'), 1, img)
# only the window around the court is needed
ci, cj = [int(round((CENTER[k] - (OUT['x0'], OUT['y0'])[k]) / ((OUT['w'], OUT['h'])[k] / N))) for k in (0, 1)]
W0 = 80
win = H[cj - W0:cj + W0, ci - W0:ci + W0].copy()
win = np.where(B[cj - W0:cj + W0, ci - W0:ci + W0], win, blur(win, 1.1))
def height(a, b):
    e = C_ + a * u + b * v
    px = (e[0] / 0.2 + CENTER[0] - OUT['x0']) / (OUT['w'] / N) - 0.5 - (ci - W0)
    py = (-e[1] / 0.2 + CENTER[1] - OUT['y0']) / (OUT['h'] / N) - 0.5 - (cj - W0)
    x0, y0 = int(np.floor(px)), int(np.floor(py)); fx, fy = px - x0, py - y0
    w = win[y0:y0 + 2, x0:x0 + 2]
    return (w[0, 0] * (1 - fx) + w[0, 1] * fx) * (1 - fy) + (w[1, 0] * (1 - fx) + w[1, 1] * fx) * fy
STEP = 0.5
A = np.arange(-R, R + STEP / 2, STEP); Bs = np.arange(-R * 0.9, R * 0.9 + STEP / 2, STEP)
Z = np.array([[height(a, b) for a in A] for b in Bs])
# continuous fall-off at the crown edge (a hard cut would leave the grid's steps in the shadow outline)
Z = np.where(Z >= 3, Z, np.maximum(-1.0, 2 * Z - 3))
geo = Geo()
keep = 0
for j in range(len(Bs) - 1):
    for i in range(len(A) - 1):
        z = (Z[j, i], Z[j, i + 1], Z[j + 1, i + 1], Z[j + 1, i])
        if max(z) < 0: continue
        keep += 1
        geo.quad((A[i], Bs[j], z[0]), (A[i + 1], Bs[j], z[1]), (A[i + 1], Bs[j + 1], z[2]), (A[i], Bs[j + 1], z[3]))
cells = range(keep)
# the same canopy as a small height map for the game: are the pixel figures in the sun or in the shade?
# (grey level = height in 0.2 m; rows run along b from -R*0.9, columns along a from -R, every STEP metres)
Image.fromarray(np.clip(np.round(np.maximum(Z, 0) / 0.2), 0, 255).astype(np.uint8)).save(sys.argv[3].replace('.glb', '_hoehen.png'), optimize=True)
g = Gltf()
m = g.material('shadow caster', color=(0.3, 0.3, 0.3, 1), rough=1.0, double=True)
g.mesh('trees and houses', geo.p, geo.n, geo.t, geo.i, m)
g.save(sys.argv[3])
print(len(cells), 'canopy cells,', len(geo.i) // 3, 'triangles')
