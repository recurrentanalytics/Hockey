import base64, json, subprocess, sys
model, src, out, pf = sys.argv[1:5]
size = sys.argv[5] if len(sys.argv) > 5 else '1536x1024'
r = subprocess.run(['curl', '-s', '-m', '300', '-X', 'POST', 'https://gen.pollinations.ai/v1/images/edits',
    '-F', f'image=@{src}', '--form-string', 'prompt=' + open(pf).read(), '--form-string', 'model=' + model,
    '--form-string', 'response_format=b64_json', '--form-string', 'size=' + size, '-o', 'resp2.json', '-w', '%{http_code}'], capture_output=True, text=True)
print('http', r.stdout)
j = json.load(open('resp2.json'))
if 'data' in j and j['data'] and j['data'][0].get('b64_json'):
    open(out, 'wb').write(base64.b64decode(j['data'][0]['b64_json'])); print('saved', out)
else:
    print(json.dumps(j)[:500])
