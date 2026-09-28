# Crops a few sprite cells onto a mat-coloured background for a quick visual check.
import json, sys
from PIL import Image
m = json.load(open('img/sprites.json'))
names = sys.argv[2:]; n = int(sys.argv[1])
ims = []
for k in names:
    c = next(c for c in m[k]['cells'] if c['n'] == n)
    im = Image.open(f'img/{k}.webp').convert('RGBA').crop((c['x'], c['y'], c['x']+c['w'], c['y']+c['h']))
    bg = Image.new('RGBA', im.size, (81,103,122,255) if k.startswith('plug') else (228,232,230,255)); bg.alpha_composite(im); ims.append(bg)
W = sum(i.width for i in ims)+20*len(ims); H = max(i.height for i in ims)
out = Image.new('RGB', (W, H), (255,255,255)); x = 0
for i in ims: out.paste(i, (x, 0)); x += i.width+20
out.save(sys.stdout.buffer if False else '/private/tmp/claude-502/-Users-vpitvalo-projects-claude/5c311f62-61af-4c7a-bb4a-b1aac830ba74/scratchpad/peek.png')
