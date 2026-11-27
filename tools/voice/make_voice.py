"""Renders the narration and commentary lines (tools/voice/lines.json) with the free Piper TTS voice
"Thorsten" (de_DE-thorsten-high, CC0) into small MP3 files in assets/voice/, plus an index the game
reads. Usage: python3 make_voice.py <piper executable> <thorsten.onnx>"""
import json, os, subprocess, sys, tempfile
root = os.path.join(os.path.dirname(__file__), '..', '..')
lines = json.load(open(os.path.join(os.path.dirname(__file__), 'lines.json'), encoding='utf-8'))
out = os.path.join(root, 'assets', 'voice')
os.makedirs(out, exist_ok=True)
piper, model = sys.argv[1], sys.argv[2]
index = {'intro': [], 'comments': {}}
def render(text, name, speed):
    with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
        subprocess.run([piper, '-m', model, '-f', wav.name, '--length-scale', str(speed), '--sentence-silence', '0.15'], input=text.encode(), check=True, capture_output=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav.name, '-ac', '1', '-b:a', '56k', os.path.join(out, name)], check=True)
    return name
for i, t in enumerate(lines['intro']):
    index['intro'].append(render(t, f'intro-{i}.mp3', 1.12))   # calm, a little slower
for group, texts in lines['comments'].items():
    index['comments'][group] = [render(t, f'{group}-{i}.mp3', 0.92) for i, t in enumerate(texts)]  # livelier
json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=1)
print('ok', sum(len(v) for v in index['comments'].values()) + len(index['intro']), 'files')
