"""Render every manual page with Poppler and validate structure/text. Output stays in tmp/pdfs."""
import json
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import pymupdf
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[3]
DATA=json.loads((ROOT/'docs/manuals/source/manuals.json').read_text(encoding='utf8'))
OUT=ROOT/'tmp/pdfs/manual-qa'; OUT.mkdir(parents=True,exist_ok=True)
renderer=shutil.which('pdftoppm')
if not renderer:raise SystemExit('Poppler pdftoppm must be on PATH.')
def render(m):
 p=ROOT/'docs/manuals'/m['fileName']; folder=OUT/p.stem; folder.mkdir(exist_ok=True)
 subprocess.run([renderer,'-r','100','-png',str(p),str(folder/'page')],check=True,capture_output=True)
 reader=PdfReader(p); expected=len(m['pages'])+1
 assert len(reader.pages)==expected,(p.name,'page count')
 assert len(reader.outline)==expected-1,(p.name,'PDF bookmarks')
 assert len(reader.pages[0].get('/Annots',[]))==expected,(p.name,'cover navigation')
 doc=pymupdf.open(p)
 for n,page in enumerate(doc):
  content=page.get_text()
  assert '\ufffd' not in content and '\x00' not in content,(p.name,n,'broken text')
  assert 'DemoPass' not in content,(p.name,n,'password in body')
  assert f'{n+1} / {expected}' in content,(p.name,n,'page number')
  if n:
   source=m['pages'][n-1]
   assert source['title'] in content,(p.name,n,'missing heading')
   compact=lambda value: ''.join(value.split())
   for expected_text in [source['where'],source['tip']]+source['steps']:
    assert compact(expected_text) in compact(content),(p.name,n,'stale or missing body text',expected_text)
  for block in page.get_text('dict')['blocks']:
   if 'lines' not in block:continue
   for line in block['lines']:
    for span in line['spans']:
     x0,y0,x1,y1=span['bbox']
     assert 0<=x0<x1<=page.rect.width and 0<=y0<y1<=page.rect.height,(p.name,n,'text outside page',span)
 pages=sorted(folder.glob('page-*.png'))
 assert len(pages)==expected
 # Contact sheets: 4 pages each, readable at full resolution (not a single tiny overview).
 font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',20)
 for offset in range(0,len(pages),4):
  subset=pages[offset:offset+4]; sheet=Image.new('RGB',(1200,1740),'#DDE5EF'); draw=ImageDraw.Draw(sheet)
  for j,img in enumerate(subset):
   preview=Image.open(img);preview.thumbnail((580,815))
   x=(j%2)*600+10;y=(j//2)*870+5;sheet.paste(preview,(x,y));draw.text((x,y+822),f'{p.stem}  p{offset+j+1}',fill='#14263F',font=font)
  sheet.save(folder/f'contact-{offset//4+1}.jpg',quality=90)
 return {'file':p.name,'pages':expected,'renderedPages':len(pages),'bytes':p.stat().st_size}
with ThreadPoolExecutor(max_workers=3) as pool:result=list(pool.map(render,DATA['manuals']))
(OUT/'checks.json').write_text(json.dumps({'revision':DATA['revision'],'results':result},indent=2)+'\n',encoding='utf8')
shutil.copyfile(OUT/'student-manual/page-07.png',ROOT/'docs/manuals/images/manual-preview.png')
print(json.dumps(result,indent=2))
