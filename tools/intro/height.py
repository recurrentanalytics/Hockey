# Decodes the LGLN DOM1/DGM1 colour ramp ("farbe" WMS layers) into a normalised surface model
# (height above ground, metres) and stores it as an 8-bit PNG with 0.15 m per step.
# Calibration: grey level 82.5 = ground, roof ridges of the 4-5 storey Gruenderzeit blocks
# (grey ~100) = about 21 m -> 1.2 m per grey level; R+B of the colour ramp falls 4.39 per grey level.
import sys, numpy as np, cv2
from PIL import Image
M_PER_SUM = 1.2 / 4.39
def ramp(p):
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
    return a[..., 0] + a[..., 2]
dom, dgm = ramp(sys.argv[1]), ramp(sys.argv[2])
dgm = cv2.GaussianBlur(dgm, (0, 0), 6)                     # terrain is smooth; removes ramp steps
h = np.clip((dgm - dom) * M_PER_SUM, 0, 38)
h[h < 0.8] = 0                                             # flatten ground noise (kerbs, cars stay below)
h = cv2.medianBlur(h.astype(np.float32), 3)
Image.fromarray(np.round(h / 0.15).astype(np.uint8)).save(sys.argv[3], optimize=True)
print('max m', h.max(), 'mean', h.mean())

# Keep the court playable: the summer DOM has tree crowns over the court, so the fenced area
# (plus a 1.5 m margin) is flattened; the aerial photo still shows it. Trees on the camera side
# are lowered at runtime by a sight-line cut-away in src/intro/intro.js.
if len(sys.argv) > 4:
    W, Hh = h.shape[1], h.shape[0]
    tx = lambda p: ((p[0] + 2176) * W / 6120, (p[1] + 2395.7) * Hh / 6128.6)
    A, B, C, D = [np.array(p) for p in ((888.6, 591.5), (967.9, 634.1), (908.2, 745.3), (828.9, 702.7))]
    out = (A - B) / np.linalg.norm(A - B)                      # from the court towards the camera
    along = (D - A) / np.linalg.norm(D - A)
    m = 1.5 / 0.2                                              # 1.5 m margin around the fence
    court = [A + out * m - along * m, B - out * m - along * m, C - out * m + along * m, D + out * m + along * m]
    mask = np.zeros(h.shape, np.uint8)
    for poly in (court,):
        cv2.fillPoly(mask, [np.round([tx(p) for p in poly]).astype(np.int32)], 255)
    mask = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 1.2)
    h2 = h * (1 - mask)
    Image.fromarray(np.round(h2 / 0.15).astype(np.uint8)).save(sys.argv[4], optimize=True)
    print('flattened', sys.argv[4])
