"""Builds the photorealistic Boni court as a binary glTF (assets/intro/boni_platz.glb).

Modelled after the club's training photos: grey asphalt (Poly Haven "clean_asphalt", CC0, colour
matched to the photos) with worn white markings and the dappled light of the lime trees, a tall
green-grey double-rod fence with diagonal struts, galvanised football goals built into the fence
at both ends, and red street-hockey goals with white nets.

Local frame: a along the long side (A->D, 25.2 m), b across (A->B, 18 m), up. The glTF is Y-up:
X = a, Y = up, Z = -b. src/welt/welt.js places it on the fence rectangle. (The ground model it also writes, boni_boden.glb, was used only by the former intro and is no longer in the repository.)

Usage: python3 tools/intro/court_glb.py <clean_asphalt_diff_2k.jpg> <props.glb> <ground.glb> <flecks.png>
"""
import io, json, math, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RNG = np.random.default_rng(7)
L, W = 25.2, 18.0            # fence rectangle (m)
FENCE_H = 4.0

# ------------------------------------------------------------------ textures
def court_texture(asphalt_path, px_per_m=82):
    w, h = int(L * px_per_m), int(W * px_per_m)
    src = np.asarray(Image.open(asphalt_path).convert('RGB')).astype(np.float32)
    # asphalt: tile the photo texture (one tile = 2.5 m) with a random half-offset per row, so
    # the repetition does not line up
    tile = np.asarray(Image.fromarray(src.astype(np.uint8)).resize((int(2.5 * px_per_m),) * 2, Image.LANCZOS)).astype(np.float32)
    th = tile.shape[0]
    base = np.zeros((h, w, 3), np.float32)
    for y0 in range(0, h, th):
        off = RNG.integers(0, th)
        row = np.tile(np.roll(tile, off, axis=1), (1, w // th + 2, 1))[:, :w]
        base[y0:y0 + th] = row[: min(th, h - y0)]
    grain = base - base.mean(axis=(0, 1))
    # colour matched to the training photos: shade ~ (110,111,110), sun flecks ~ (180,176,166)
    shade = np.array([110, 111, 110], np.float32)
    sun = np.array([182, 177, 165], np.float32)
    def lowfreq(scale):
        n = RNG.random((max(2, h // scale), max(2, w // scale))).astype(np.float32)
        return np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 255
    def fractal(scales, weights):
        return sum(wt * lowfreq(sc) for sc, wt in zip(scales, weights)) / sum(weights)
    wear = fractal((200, 60, 18), (0.5, 0.3, 0.2))
    # dappled light under the lime trees: thresholded fractal noise inside canopy gaps gives
    # organic flecks of very different sizes; edges stay soft (penumbra)
    gaps = fractal((260, 110), (0.6, 0.4))
    leaf = fractal((70, 28, 11, 5), (0.35, 0.3, 0.2, 0.15))
    f = leaf + (gaps - 0.5) * 0.9
    t = np.percentile(f, 78)
    flecks = np.clip((f - t) / 0.06, 0, 1)
    flecks = np.asarray(Image.fromarray((flecks * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(px_per_m * 0.025))).astype(np.float32)[..., None] / 255
    flecks *= (0.7 + 0.3 * lowfreq(30)[..., None])
    fine = (RNG.random((h, w, 1)).astype(np.float32) - 0.5) * 16          # aggregate grain
    col = shade * (0.9 + 0.2 * wear[..., None]) + grain * 2.2 + fine
    # the dappled light is no longer baked in: it is a separate mask the game lights by sun and weather
    flecks_mask = Image.fromarray((np.clip(flecks[..., 0], 0, 1) * 255).astype(np.uint8))
    del sun
    # dirt and leaves along the fence
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy]).astype(np.float32) / px_per_m
    dirt = np.clip(1 - edge / 0.45, 0, 1)[..., None] * (0.5 + 0.5 * lowfreq(12)[..., None])
    col = col * (1 - 0.28 * dirt) + np.array([92, 84, 66], np.float32) * 0.28 * dirt
    img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))

    # worn white markings (reconstructed from the photos: side lines, centre line and circle,
    # arcs in front of the goals)
    lines = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(lines)
    P = lambda a, b: (w / 2 + a * px_per_m, h / 2 - b * px_per_m)
    lw = max(3, int(0.06 * px_per_m))
    m = 0.5
    d.rectangle([P(-L / 2 + m, W / 2 - m), P(L / 2 - m, -W / 2 + m)], outline=255, width=lw)
    d.line([P(0, W / 2 - m), P(0, -W / 2 + m)], fill=255, width=lw)
    r = 3.0
    d.ellipse([P(-r, r), P(r, -r)], outline=255, width=lw)
    for s in (-1, 1):
        cx = s * (L / 2 - m)
        R = 6.0
        box = [P(cx - R, R), P(cx + R, -R)]
        d.arc([min(box[0][0], box[1][0]), min(box[0][1], box[1][1]), max(box[0][0], box[1][0]), max(box[0][1], box[1][1])],
              start=90 if s > 0 else -90, end=270 if s > 0 else 90, fill=255, width=lw)
    paint = np.asarray(lines.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)[..., None] / 255
    paint *= np.clip(0.55 + 0.6 * lowfreq(6)[..., None], 0, 1)          # worn paint
    col = np.asarray(img).astype(np.float32)
    lit = 0.8
    col = col * (1 - paint * 0.85) + np.array([222, 222, 216], np.float32) * lit * paint * 0.85
    return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)), flecks_mask


def mulch_texture(asphalt_path, px=512):
    """Bark mulch and trodden earth around the fence, 2 m tile."""
    n = lambda sc: np.asarray(Image.fromarray((RNG.random((px // sc, px // sc)) * 255).astype(np.uint8)).resize((px, px), Image.BICUBIC)).astype(np.float32)[..., None] / 255
    base = np.array([86, 72, 54], np.float32) * (0.75 + 0.35 * n(32)) * (0.8 + 0.3 * n(4))
    chips = (RNG.random((px, px, 1)) > 0.93).astype(np.float32)
    chips = np.asarray(Image.fromarray((chips[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)[..., None] / 255
    col = base * (1 - 0.5 * chips) + np.array([140, 112, 76], np.float32) * 0.5 * chips
    leaf = (n(16) > 0.72).astype(np.float32) * 0.35
    col = col * (1 - leaf) + np.array([96, 92, 52], np.float32) * leaf
    return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))


def mesh_texture(px=256, rod=(96, 110, 98)):
    """Double-rod fence panel, 1 m x 1 m: vertical rods every 5 cm, double horizontals every 20 cm."""
    a = np.zeros((px, px, 4), np.uint8)
    s = px / 100  # px per cm
    for x in np.arange(2.5, 100, 5):
        a[:, int(x * s): int(x * s) + max(1, int(0.6 * s))] = (*rod, 255)
    for y in np.arange(10, 100, 20):
        for dy in (-0.6, 0.6):
            yy = int((y + dy) * s)
            a[yy: yy + max(1, int(0.7 * s))] = (*rod, 255)
    return Image.fromarray(a, 'RGBA')


def net_texture(px=256):
    """Hockey net: white cord, 5 cm mesh."""
    a = np.zeros((px, px, 4), np.uint8)
    step = px // 10
    for i in range(0, px, step):
        a[:, i: i + 2] = (245, 245, 240, 255)
        a[i: i + 2, :] = (245, 245, 240, 255)
    return Image.fromarray(a, 'RGBA')

# ------------------------------------------------------------------ glTF builder
class Gltf:
    def __init__(self):
        self.bin = bytearray()
        self.j = {'asset': {'version': '2.0', 'generator': 'boni court_glb.py'}, 'scene': 0, 'scenes': [{'nodes': []}],
                  'nodes': [], 'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [], 'buffers': [],
                  'images': [], 'textures': [], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
                  'extensionsUsed': ['KHR_materials_unlit']}

    def view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)}
        if target:
            v['target'] = target
        self.bin += data
        self.j['bufferViews'].append(v)
        return len(self.j['bufferViews']) - 1

    def accessor(self, arr, kind, comp, target):
        arr = np.ascontiguousarray(arr)
        acc = {'bufferView': self.view(arr.tobytes(), target), 'componentType': comp, 'count': len(arr), 'type': kind}
        if kind == 'VEC3' and comp == 5126:
            acc['min'] = arr.min(0).tolist(); acc['max'] = arr.max(0).tolist()
        self.j['accessors'].append(acc)
        return len(self.j['accessors']) - 1

    def image(self, img, fmt):
        buf = io.BytesIO()
        img.save(buf, format=fmt, quality=88) if fmt == 'JPEG' else img.save(buf, format=fmt, optimize=True)
        self.j['images'].append({'bufferView': self.view(buf.getvalue()), 'mimeType': 'image/jpeg' if fmt == 'JPEG' else 'image/png'})
        self.j['textures'].append({'source': len(self.j['images']) - 1, 'sampler': 0})
        return len(self.j['textures']) - 1

    def material(self, name, color=(1, 1, 1, 1), metal=0.0, rough=0.8, tex=None, blend=False, unlit=False, double=False):
        m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': list(color), 'metallicFactor': metal, 'roughnessFactor': rough}, 'doubleSided': double}
        if tex is not None:
            m['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex}
        if blend:
            m['alphaMode'] = 'BLEND'
        if unlit:
            m['extensions'] = {'KHR_materials_unlit': {}}
        self.j['materials'].append(m)
        return len(self.j['materials']) - 1

    def mesh(self, name, pos, nrm, uv, idx, mat):
        a = {'POSITION': self.accessor(np.asarray(pos, np.float32), 'VEC3', 5126, 34962),
             'NORMAL': self.accessor(np.asarray(nrm, np.float32), 'VEC3', 5126, 34962),
             'TEXCOORD_0': self.accessor(np.asarray(uv, np.float32), 'VEC2', 5126, 34962)}
        i = self.accessor(np.asarray(idx, np.uint32), 'SCALAR', 5125, 34963)
        self.j['meshes'].append({'name': name, 'primitives': [{'attributes': a, 'indices': i, 'material': mat}]})
        self.j['nodes'].append({'name': name, 'mesh': len(self.j['meshes']) - 1})
        self.j['scenes'][0]['nodes'].append(len(self.j['nodes']) - 1)

    def save(self, path):
        while len(self.bin) % 4:
            self.bin.append(0)
        self.j['buffers'] = [{'byteLength': len(self.bin)}]
        js = json.dumps(self.j, separators=(',', ':')).encode()
        js += b' ' * ((4 - len(js) % 4) % 4)
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.bin))
        out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(out)


class Geo:
    """Collects triangles in the local frame (a, b, up) and converts to glTF (X=a, Y=up, Z=-b)."""
    def __init__(self):
        self.p, self.n, self.t, self.i = [], [], [], []

    def quad(self, c0, c1, c2, c3, uv=((0, 0), (1, 0), (1, 1), (0, 1))):
        c = [np.asarray(x, float) for x in (c0, c1, c2, c3)]
        nrm = np.cross(c[1] - c[0], c[3] - c[0]); nrm /= np.linalg.norm(nrm) or 1
        k = len(self.p)
        for x, t in zip(c, uv):
            self.p.append((x[0], x[2], -x[1])); self.n.append((nrm[0], nrm[2], -nrm[1])); self.t.append(t)
        self.i += [k, k + 1, k + 2, k, k + 2, k + 3]

    def beam(self, p0, p1, w, hgt=None):
        """Square bar from p0 to p1 (local coordinates), width w."""
        p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
        d = p1 - p0; d /= np.linalg.norm(d)
        up = np.array([0, 0, 1.0]) if abs(d[2]) < 0.9 else np.array([1.0, 0, 0])
        s1 = np.cross(d, up); s1 /= np.linalg.norm(s1)
        s2 = np.cross(s1, d)
        h1, h2 = s1 * w / 2, s2 * (hgt or w) / 2
        ring = lambda p: [p - h1 - h2, p + h1 - h2, p + h1 + h2, p - h1 + h2]
        r0, r1 = ring(p0), ring(p1)
        for k in range(4):
            self.quad(r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k])


def build(asphalt, out, out_ground, out_flecks):
    g = Gltf()
    gg = Gltf()  # ground (asphalt + mulch) in its own model: the game lights it by sun and weather
    court_img, flecks_img = court_texture(asphalt)
    flecks_img.resize((1024, round(1024 * W / L)), Image.LANCZOS).save(out_flecks, optimize=True)
    t_court = gg.image(court_img, 'JPEG')
    t_mesh = g.image(mesh_texture(), 'PNG')
    t_net = g.image(net_texture(), 'PNG')
    t_mulch = gg.image(mulch_texture(asphalt), 'JPEG')
    m_court = gg.material('asphalt', tex=t_court, unlit=True)
    m_mulch = gg.material('mulch', tex=t_mulch, color=(0.92, 0.92, 0.92, 1), unlit=True)
    m_fence = g.material('fence mesh', tex=t_mesh, blend=True, double=True, metal=0.3, rough=0.6)
    m_fence_near = g.material('fence mesh (camera side)', tex=t_mesh, color=(1, 1, 1, 0.28), blend=True, double=True, metal=0.3, rough=0.6)
    m_post = g.material('fence posts', color=(0.36, 0.42, 0.37, 1), metal=0.4, rough=0.55)
    m_galv = g.material('galvanised steel', color=(0.70, 0.71, 0.70, 1), metal=0.8, rough=0.45)
    m_galv_mesh = g.material('goal mesh', tex=t_mesh, color=(1.45, 1.4, 1.45, 1), blend=True, double=True, metal=0.5, rough=0.5)
    m_red = g.material('hockey goal frame', color=(0.86, 0.10, 0.22, 1), metal=0.2, rough=0.35)
    m_white = g.material('hockey goal base', color=(0.92, 0.92, 0.9, 1), rough=0.6)
    m_net = g.material('hockey net', tex=t_net, blend=True, double=True, rough=0.9)

    ga, gb = L / 2, W / 2
    # ground
    geo = Geo()
    geo.quad((-ga, -gb, 0), (ga, -gb, 0), (ga, gb, 0), (-ga, gb, 0), uv=((0, 1), (1, 1), (1, 0), (0, 0)))
    gg.mesh('court', geo.p, geo.n, geo.t, geo.i, m_court)
    # 3.5 m apron of mulch around the fence, 1 cm lower (the Google mesh has no ground under the
    # tree crowns, and the see-through trees would otherwise show the void)
    ap, e = Geo(), 3.5
    ring = [(-ga, -gb), (ga, -gb), (ga, gb), (-ga, gb)]
    outer = [(-ga - e, -gb - e), (ga + e, -gb - e), (ga + e, gb + e), (-ga - e, gb + e)]
    for k in range(4):
        i0, i1 = ring[k], ring[(k + 1) % 4]
        o0, o1 = outer[k], outer[(k + 1) % 4]
        pts = [(*o0, -0.01), (*o1, -0.01), (*i1, -0.01), (*i0, -0.01)]
        ap.quad(*pts, uv=tuple((p[0] / 2, p[1] / 2) for p in pts))
    gg.mesh('apron', ap.p, ap.n, ap.t, ap.i, m_mulch)

    # fence panels (texture: 1 m tiles) and posts every 2.5 m, top rail, diagonal struts outside
    fence, near, posts = Geo(), Geo(), Geo()
    sides = [((-ga, gb), (ga, gb)), ((ga, gb), (ga, -gb)), ((ga, -gb), (-ga, -gb)), ((-ga, -gb), (-ga, gb))]
    for (x0, y0), (x1, y1) in sides:
        ln = math.hypot(x1 - x0, y1 - y0)
        # the side facing the game camera (b = -W/2) stays almost see-through, as in sports games
        (near if y0 == y1 == -gb else fence).quad((x0, y0, 0), (x1, y1, 0), (x1, y1, FENCE_H), (x0, y0, FENCE_H), uv=((0, FENCE_H), (ln, FENCE_H), (ln, 0), (0, 0)))
        n = round(ln / 2.5)
        out_n = np.array([-(y1 - y0), x1 - x0]) / ln
        out_n = out_n if np.dot(out_n, [(x0 + x1) / 2, (y0 + y1) / 2]) > 0 else -out_n
        for k in range(n + 1):
            x, y = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
            posts.beam((x, y, 0), (x, y, FENCE_H + 0.05), 0.07)
            if k % 3 == 1:   # diagonal strut on the outside
                posts.beam((x, y, FENCE_H * 0.62), (x + out_n[0] * 1.6, y + out_n[1] * 1.6, 0), 0.05)
        posts.beam((x0, y0, FENCE_H), (x1, y1, FENCE_H), 0.05)
        posts.beam((x0, y0, 0.06), (x1, y1, 0.06), 0.05)
    g.mesh('fence', fence.p, fence.n, fence.t, fence.i, m_fence)
    g.mesh('fence camera side', near.p, near.n, near.t, near.i, m_fence_near)
    g.mesh('fence posts', posts.p, posts.n, posts.t, posts.i, m_post)

    # football goals built into the short sides: 5 m x 2 m cage, 1.2 m deep into the court
    frame, cage = Geo(), Geo()
    for s in (-1, 1):
        xb, xf = s * ga, s * (ga - 1.2)
        for y in (-2.5, 2.5):
            frame.beam((xf, y, 0), (xf, y, 2.0), 0.08)
            frame.beam((xb, y, 0), (xb, y, 2.0), 0.08)
            frame.beam((xf, y, 2.0), (xb, y, 2.0), 0.06)
            frame.beam((xf, y, 0.03), (xb, y, 0.03), 0.06)
        frame.beam((xf, -2.5, 2.0), (xf, 2.5, 2.0), 0.08)
        frame.beam((xb, -2.5, 2.0), (xb, 2.5, 2.0), 0.06)
        cage.quad((xf, -2.5, 2.0), (xf, 2.5, 2.0), (xb, 2.5, 2.0), (xb, -2.5, 2.0), uv=((0, 0), (5, 0), (5, 1.2), (0, 1.2)))
        for y in (-2.5, 2.5):
            cage.quad((xf, y, 0), (xb, y, 0), (xb, y, 2.0), (xf, y, 2.0), uv=((0, 2), (1.2, 2), (1.2, 0), (0, 0)))
    g.mesh('football goal frames', frame.p, frame.n, frame.t, frame.i, m_galv)
    g.mesh('football goal mesh', cage.p, cage.n, cage.t, cage.i, m_galv_mesh)

    # street-hockey goals (1.37 m x 1.12 m, 0.6 m deep), 2 m in front of the football goals
    red, white, net = Geo(), Geo(), Geo()
    hw, hh, dep = 0.685, 1.12, 0.6
    for s in (-1, 1):
        x = s * (ga - 3.4)
        xb = x + s * dep
        red.beam((x, -hw, 0), (x, -hw, hh), 0.045)
        red.beam((x, hw, 0), (x, hw, hh), 0.045)
        red.beam((x, -hw, hh), (x, hw, hh), 0.045)
        red.beam((x, -hw, hh), (xb, -hw, 0.02), 0.035)
        red.beam((x, hw, hh), (xb, hw, 0.02), 0.035)
        white.beam((xb, -hw, 0.02), (xb, hw, 0.02), 0.04)
        white.beam((x, -hw, 0.02), (xb, -hw, 0.02), 0.04)
        white.beam((x, hw, 0.02), (xb, hw, 0.02), 0.04)
        net.quad((x, -hw, hh), (x, hw, hh), (xb, hw, 0), (xb, -hw, 0), uv=((0, 0), (1.37, 0), (1.37, 1.25), (0, 1.25)))
        for y in (-hw, hw):
            net.quad((x, y, 0), (xb, y, 0), (x, y, hh), (x, y, hh), uv=((0, 1.1), (0.6, 1.1), (0, 0), (0, 0)))
    g.mesh('hockey goal frames', red.p, red.n, red.t, red.i, m_red)
    g.mesh('hockey goal base', white.p, white.n, white.t, white.i, m_white)
    g.mesh('hockey nets', net.p, net.n, net.t, net.i, m_net)
    g.save(out)
    gg.save(out_ground)


if __name__ == '__main__':
    build(*sys.argv[1:5])
    print('ok')
