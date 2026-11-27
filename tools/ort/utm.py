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
