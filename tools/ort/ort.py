"""Liest eine Ortsbeschreibung locations/<id>/ort.js in Python: der Rumpf nach `export default` ist reines JSON.

    from ort import lade; ort = lade('boni')
"""
import json, os

WURZEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')

def lade(ort_id):
    text = open(os.path.join(WURZEL, 'locations', ort_id, 'ort.js'), encoding='utf-8').read()
    return json.loads(text.split('\nexport default', 1)[1].strip().rstrip(';'))

if __name__ == '__main__':
    import sys
    print(json.dumps(lade(sys.argv[1] if len(sys.argv) > 1 else 'boni'), ensure_ascii=False, indent=2))
