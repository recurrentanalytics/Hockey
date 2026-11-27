"""WGS84 (Länge, Breite) → ETRS89 / UTM Zone 32N (EPSG:25832), ohne Zusatzbibliothek.
Krüger-Reihe nach Karney (2011), auf Millimeter genau im Zonenbereich."""
import math

A, F = 6378137.0, 1 / 298.257222101          # GRS80 (ETRS89); von WGS84 um < 0,1 mm verschieden
K0, E0, LON0 = 0.9996, 500000.0, math.radians(9)

def to_utm32(lon, lat):
    n = F / (2 - F)
    a = A / (1 + n) * (1 + n * n / 4 + n ** 4 / 64)
    al = [n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16, 13 * n * n / 48 - 3 * n ** 3 / 5, 61 * n ** 3 / 240]
    phi, lam = math.radians(lat), math.radians(lon) - LON0
    e = math.sqrt(F * (2 - F))
    t = math.sinh(math.atanh(math.sin(phi)) - e * math.atanh(e * math.sin(phi)))
    xi, eta = math.atan2(t, math.cos(lam)), math.atanh(math.sin(lam) / math.sqrt(1 + t * t))
    x = eta + sum(al[j] * math.cos(2 * (j + 1) * xi) * math.sinh(2 * (j + 1) * eta) for j in range(3))
    y = xi + sum(al[j] * math.sin(2 * (j + 1) * xi) * math.cosh(2 * (j + 1) * eta) for j in range(3))
    return E0 + K0 * a * x, K0 * a * y

def from_utm32(e, n_):
    """ETRS89 / UTM 32N → (Länge, Breite) in Grad. Umkehrung der Reihe oben, gleiche Genauigkeit."""
    n = F / (2 - F)
    a = A / (1 + n) * (1 + n * n / 4 + n ** 4 / 64)
    be = [n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96, n * n / 48 + n ** 3 / 15, 17 * n ** 3 / 480]
    de = [2 * n - 2 * n * n / 3 - 2 * n ** 3, 7 * n * n / 3 - 8 * n ** 3 / 5, 56 * n ** 3 / 15]
    xi, eta = n_ / (K0 * a), (e - E0) / (K0 * a)
    xi1 = xi - sum(be[j] * math.sin(2 * (j + 1) * xi) * math.cosh(2 * (j + 1) * eta) for j in range(3))
    eta1 = eta - sum(be[j] * math.cos(2 * (j + 1) * xi) * math.sinh(2 * (j + 1) * eta) for j in range(3))
    chi = math.asin(math.sin(xi1) / math.cosh(eta1))
    phi = chi + sum(de[j] * math.sin(2 * (j + 1) * chi) for j in range(3))
    return math.degrees(LON0 + math.atan2(math.sinh(eta1), math.cos(xi1))), math.degrees(phi)

def konvergenz_grad(lon, lat):
    """Meridiankonvergenz: Gitternord gegen geografisch Nord, in Grad (positiv östlich von 9° Ost)."""
    return math.degrees(math.atan(math.tan(math.radians(lon) - LON0) * math.sin(math.radians(lat))))

def massstab(e):
    """Streckenverzerrung der Abbildung am Rechtswert e: Gitterstrecke = Naturstrecke × Faktor."""
    return K0 * (1 + ((e - E0) / K0) ** 2 / (2 * 6381000.0 ** 2))
