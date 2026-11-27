// ETRS89 / UTM zone 32N (EPSG:25832) ↔ longitude/latitude in degrees. Same Krüger series as
// tools/ort/utm.py (Karney 2011); better than a millimetre inside the zone.
const A = 6378137.0, F = 1 / 298.257222101, K0 = 0.9996, E0 = 500000.0, LON0 = (9 * Math.PI) / 180;
const N = F / (2 - F), RA = (A / (1 + N)) * (1 + (N * N) / 4 + N ** 4 / 64);
const AL = [N / 2 - (2 * N * N) / 3 + (5 * N ** 3) / 16, (13 * N * N) / 48 - (3 * N ** 3) / 5, (61 * N ** 3) / 240];
const BE = [N / 2 - (2 * N * N) / 3 + (37 * N ** 3) / 96, (N * N) / 48 + N ** 3 / 15, (17 * N ** 3) / 480];
const DE = [2 * N - (2 * N * N) / 3 - 2 * N ** 3, (7 * N * N) / 3 - (8 * N ** 3) / 5, (56 * N ** 3) / 15];

export function toUtm32(lon, lat) {
  const phi = (lat * Math.PI) / 180, lam = (lon * Math.PI) / 180 - LON0, e = Math.sqrt(F * (2 - F));
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(lam)), eta = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let x = eta, y = xi;
  AL.forEach((a, j) => { x += a * Math.cos(2 * (j + 1) * xi) * Math.sinh(2 * (j + 1) * eta); y += a * Math.sin(2 * (j + 1) * xi) * Math.cosh(2 * (j + 1) * eta); });
  return [E0 + K0 * RA * x, K0 * RA * y];
}

export function fromUtm32(e, n) {
  const xi = n / (K0 * RA), eta = (e - E0) / (K0 * RA);
  let xi1 = xi, eta1 = eta;
  BE.forEach((b, j) => { xi1 -= b * Math.sin(2 * (j + 1) * xi) * Math.cosh(2 * (j + 1) * eta); eta1 -= b * Math.cos(2 * (j + 1) * xi) * Math.sinh(2 * (j + 1) * eta); });
  const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1));
  let phi = chi;
  DE.forEach((d, j) => { phi += d * Math.sin(2 * (j + 1) * chi); });
  return [((LON0 + Math.atan2(Math.sinh(eta1), Math.cos(xi1))) * 180) / Math.PI, (phi * 180) / Math.PI];
}
