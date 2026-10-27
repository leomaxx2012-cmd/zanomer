from pathlib import Path
from PIL import Image, ImageChops, ImageDraw
import json, sys
src=Path(sys.argv[1])
out=Path('assets/exact-plates');out.mkdir(exist_ok=True)
bg=(248,248,248)
def load(name):return Image.open(src/(name+'.png')).convert('RGB')
def take(im,box):
 c=im.crop(box);b=ImageChops.difference(c,Image.new('RGB',c.size,bg)).getbbox()
 if not b:raise ValueError(box)
 return c.crop(b),(box[0]+b[0],box[1]+b[1])
groups={}
for group,origin,clip in [('letters',(60,57),(45,50,140,151)),('large',(152,29),(145,20,230,151)),('region2',(640,21),(630,15,700,115)),('region3',(586,21),(584,18,642,115)),('motoDigits',(71,30),(65,20,130,122)),('motoRegion',(222,175),(215,168,280,267))]:
 groups[group]={}
 for ch in ('АВЕКМНОРСТУХ' if group=='letters' else '0123456789'):
  name=f'letter-{ord(ch):04x}' if group=='letters' else f'region3-{ch}' if group=='region3' else f'moto-{ch}' if group.startswith('moto') else f'digit-{ch}'
  glyph,xy=take(load(name),clip);fn=f'{group}-{ord(ch):04x}.png';glyph.save(out/fn,optimize=True)
  groups[group][ch]={'file':fn,'dx':xy[0]-origin[0],'dy':xy[1]-origin[1],'width':glyph.width,'height':glyph.height}
layouts={
 'car2':{'reference':'car-original','size':[800,172],'letters':[(45,50,140,151),(400,50,490,151),(490,50,580,151)],'large':[(145,20,230,151),(230,20,315,151),(315,20,400,151)],'region2':[(630,15,700,115),(700,15,760,115)]},
 'car3':{'reference':'car3-original','size':[800,172],'letters':[(40,50,130,151),(380,50,470,151),(470,50,560,151)],'large':[(135,20,220,151),(220,20,305,151),(305,20,390,151)],'region3':[(584,18,642,115),(642,15,703,115),(703,15,764,115)]},
 'trailer':{'reference':'trailer-original','size':[800,172],'letters':[(50,50,135,151),(135,50,220,151)],'large':[(240,20,325,151),(325,20,410,151),(410,20,495,151),(495,20,590,151)],'region2':[(630,15,700,115),(700,15,760,115)]},
 'motorcycle':{'reference':'moto-original','size':[377,285],'letters':[(20,168,99,267),(99,168,181,267)],'motoDigits':[(65,20,130,122),(130,20,195,122),(195,20,260,122),(260,20,323,122)],'motoRegion':[(215,168,280,267),(280,168,350,267)]}
}
refs={'letters':'ААА','large':'001','region2':'77','region3':'777','motoDigits':'0001','motoRegion':'77'}
origins={'letters':(60,57),'large':(152,29),'region2':(640,21),'region3':(586,21),'motoDigits':(71,30),'motoRegion':(222,175)}
proof={}
for kind,layout in layouts.items():
 original=load(layout['reference']); frame=original.copy();draw=ImageDraw.Draw(frame); slots=[]
 for group,boxes in layout.items():
  if group in ['reference','size']:continue
  values=refs[group]
  if kind=='trailer' and group=='large':values='0001'
  if kind=='motorcycle' and group=='letters':values='АА'
  for i,box in enumerate(boxes):
   glyph,xy=take(original,box); char=values[i]; canonical=groups[group][char]
   # Anchor stores the exact generator position; per-character inset stays in the glyph metadata.
   slot={'group':group,'index':i,'x':xy[0]-canonical['dx'],'y':xy[1]-canonical['dy']}
   slots.append(slot);draw.rectangle((box[0],box[1],box[2]-1,box[3]-1),fill=bg)
 layout['slots']=slots;frame.save(out/(kind+'.png'),optimize=True)
 reconstructed=frame.copy()
 for slot in slots:
  group=slot['group'];values=refs[group]
  if kind=='trailer' and group=='large':values='0001'
  meta=groups[group][values[slot['index']]]
  reconstructed.paste(Image.open(out/meta['file']), (slot['x']+meta['dx'],slot['y']+meta['dy']))
 diff=ImageChops.difference(original,reconstructed);proof[kind]={'differentPixels':sum(1 for p in diff.getdata() if p!=(0,0,0)),'bounds':diff.getbbox()}
 reconstructed.save(src/(kind+'-reconstructed.png'))
 layout.pop('reference');
 for key in list(layout):
  if key not in ['size','slots']:layout.pop(key)
# Generate static requires so Metro includes every local image on web and native.
lines=['// Local number artwork reconstructed from the user-provided reference.','export const plateArtwork = {']
for kind,layout in layouts.items():
 lines.append(f'  {kind}: {{ image: require("../assets/exact-plates/{kind}.png"), width: {layout["size"][0]}, height: {layout["size"][1]}, slots: {json.dumps(layout["slots"])} }},')
lines+=['};','export const plateGlyphs: Record<string, Record<string, {image: number; dx: number; dy: number; width: number; height: number}>> = {']
for group,chars in groups.items():
 lines.append(f'  {group}: {{')
 for char,m in chars.items():lines.append(f'    "{char}": {{image: require("../assets/exact-plates/{m["file"]}"), dx: {m["dx"]}, dy: {m["dy"]}, width: {m["width"]}, height: {m["height"]}}},')
 lines.append('  },')
lines+=['};'];Path('lib/plate-artwork.ts').write_text('\n'.join(lines)+'\n',encoding='utf8')
(src/'pixel-comparison.json').write_text(json.dumps(proof,indent=2))
print(json.dumps(proof,indent=2));print(json.dumps({k:v['slots'] for k,v in layouts.items()},indent=2))


