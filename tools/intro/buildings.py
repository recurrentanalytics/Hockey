# Building footprints from the LGLN ALKIS WMS (layer ALKIS, standard colours: residential grey
# 178/178/178, public red 244/132/127) -> 1 m mask aligned with boni_hoehe.png, dilated by 1 m
# so the wall ramps of the surface model are covered.
# Usage: python3 buildings.py alkis_2448.png out.png
import sys, numpy as np, cv2
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)
near = lambda c, t=10: np.abs(a - np.array(c)).sum(2) < t
m = (near((178, 178, 178)) | near((244, 132, 127))).astype(np.uint8) * 255
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))   # fill hatching and labels
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))    # drop thin road-edge lines
m = cv2.resize(m, (1224, 1224), interpolation=cv2.INTER_AREA)
m = cv2.dilate(m, np.ones((3, 3), np.uint8))
Image.fromarray(m).save(sys.argv[2], optimize=True)
