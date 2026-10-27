from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[1] / 'assets' / 'plates'
font = ImageFont.truetype(str(root / 'GOST-R-50577-93.ttf'), 512)
for char in '0123456789АВЕКМНОРСТУХ':
    box = font.getbbox(char)
    image = Image.new('RGBA', (box[2]-box[0]+4, box[3]-box[1]+4))
    ImageDraw.Draw(image).text((2-box[0], 2-box[1]), char, font=font, fill=(0,0,0,255))
    image.save(root / f'{ord(char):04x}.png', optimize=True)
# Placeholders have their own bounded geometry, independent of system fonts.
image=Image.new('RGBA',(160,160)); draw=ImageDraw.Draw(image)
for a,b in [((80,18),(80,142)),((25,48),(135,112)),((25,112),(135,48))]:
    draw.line((a,b),fill='black',width=16)
image.save(root/'star.png')
image=Image.new('RGBA',(160,40)); ImageDraw.Draw(image).rounded_rectangle((4,14,156,26),radius=4,fill='black');image.save(root/'dash.png')
import json
(root / 'ratios.json').write_text(json.dumps({char: Image.open(root / f'{ord(char):04x}.png').width / Image.open(root / f'{ord(char):04x}.png').height for char in '0123456789АВЕКМНОРСТУХ'}, ensure_ascii=False), encoding='utf8')
