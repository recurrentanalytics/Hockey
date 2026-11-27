// Load a picture and wait for it with the load event. (Image.decode() can stay pending for as long as
// the page is in the background or not painted, which left the world view hanging at "Lade Geodaten".)
export function ladeBild(url, fremd = false) {
  return new Promise((fertig, fehler) => {
    const img = new Image();
    if (fremd) img.crossOrigin = 'anonymous';
    img.onload = () => fertig(img);
    img.onerror = () => fehler(new Error('Bild nicht geladen: ' + String(url).split('?')[0]));
    img.src = url;
  });
}
