"""Build the Korean screenshot manuals. No LMS database or network access is used."""
from __future__ import annotations
import argparse
import io
import json
import os
from pathlib import Path
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[3]
MANUALS = ROOT / 'docs' / 'manuals'
WIDTH, HEIGHT = A4
MARGIN, CONTENT = 42, WIDTH - 84
NAVY = colors.HexColor('#14263F')
BLUE = colors.HexColor('#174AA0')
ORANGE = colors.HexColor('#C34A12')
INK = colors.HexColor('#172C45')
PALE = colors.HexColor('#EFF5FC')

def register_fonts():
    regular = os.environ.get('LMS_MANUAL_FONT', 'C:/Windows/Fonts/malgun.ttf')
    bold = os.environ.get('LMS_MANUAL_BOLD_FONT', 'C:/Windows/Fonts/malgunbd.ttf')
    for name, file in [('Korean', regular), ('KoreanBold', bold)]:
        if not Path(file).is_file():
            raise SystemExit(f'Font missing: {file}. Set LMS_MANUAL_FONT and LMS_MANUAL_BOLD_FONT to Korean TTF fonts.')
        pdfmetrics.registerFont(TTFont(name, file))

def lines(text, width, size=16, font='Korean'):
    """Wrap Korean at character boundaries, keeping Latin words together where possible."""
    output=[]
    for paragraph in text.split('\n'):
        current=''
        for ch in paragraph:
            if pdfmetrics.stringWidth(current+ch,font,size)>width:
                # Prefer a nearby whitespace over splitting an English button label.
                split=current.rfind(' ')
                if split>len(current)*.60:
                    output.append(current[:split].rstrip()); current=current[split+1:]+ch
                else:
                    output.append(current.rstrip()); current=ch.lstrip()
            else: current+=ch
        output.append(current.rstrip())
    return output

def text(c, value, x, y, width=CONTENT, size=16, leading=23, font='Korean', color=INK):
    c.setFont(font,size); c.setFillColor(color)
    for line in lines(value,width,size,font):
        c.drawString(x,y,line); y-=leading
    return y

def base(c, manual, page, count, revision):
    c.setFillColor(NAVY); c.rect(0,HEIGHT-37,WIDTH,37,fill=1,stroke=0)
    c.setFont('KoreanBold',12); c.setFillColor(colors.white)
    c.drawString(MARGIN,HEIGHT-24,'LMS  |  '+manual['role'])
    c.setStrokeColor(colors.HexColor('#CBD5E1')); c.line(MARGIN,47,WIDTH-MARGIN,47)
    c.setFillColor(INK); c.setFont('Korean',11)
    c.drawString(MARGIN,30,'최신 화면 '+revision+'  ·  데모 자료')
    c.drawRightString(WIDTH-MARGIN,30,f'{page} / {count}')

def screenshot(c,spec,captures,top=651,maxheight=248):
    path=MANUALS/'images'/(spec['name']+'.jpg')
    im=Image.open(path).convert('RGB')
    x,y,w,h=spec['crop']
    if x<0 or y<0 or x+w>im.width or y+h>im.height:
        raise ValueError(f'Crop outside {path.name}: {spec["crop"]}, image {im.size}')
    region=im.crop((x,y,x+w,y+h))
    # Preserve aspect ratio: a mobile screen must never be stretched.
    scale=min(CONTENT/w,maxheight/h)
    dw,dh=w*scale,h*scale
    dx=MARGIN+(CONTENT-dw)/2; image_top=top-(maxheight-dh)/2
    dy=image_top-dh
    c.setFillColor(PALE); c.roundRect(MARGIN-4,top-maxheight-7,CONTENT+8,maxheight+14,9,fill=1,stroke=0)
    c.drawImage(ImageReader(region),dx,dy,width=dw,height=dh)
    c.setLineWidth(.6); c.setStrokeColor(colors.HexColor('#B6C9E2')); c.rect(dx,dy,dw,dh,fill=0,stroke=1)
    boxes=spec.get('boxes')
    if boxes is None:
        available=captures[spec['name']]['boxes']; boxes=[]
        for i,label in enumerate(spec.get('labels',[]),1):
            matches=[b for b in available if b['label']==label]
            if not matches: raise ValueError(f'Missing captured label {spec["name"]}: {label}')
            b=dict(matches[0],number=i)
            # Text-label locators may include the whole field's width; highlight the label itself.
            b['w']=min(b['w'],max(70,len(label)*8+10))
            boxes.append(b)
    visible=0
    for b in boxes:
        bx,by,bw,bh=b['x'],b['y'],b['w'],b['h']
        if bx<x or by<y or bx+bw>x+w or by+bh>y+h:
            raise ValueError(f'Annotation outside crop: {spec["name"]} {b}')
        px=dx+(bx-x)*scale; py=image_top-(by-y+bh)*scale
        pw,ph=bw*scale,bh*scale
        c.setStrokeColor(ORANGE); c.setLineWidth(1.6)
        c.roundRect(px-2,py-2,pw+4,ph+4,2,stroke=1,fill=0)
        # Place the numbered badge and arrow above its target, inside the crop.
        nx=min(dx+dw-12,max(dx+12,px+10))
        ny=py+ph+17
        c.line(nx,ny-9,px+min(pw/2,12),py+ph+3)
        c.line(px+min(pw/2,12),py+ph+3,px+min(pw/2,12)-3,py+ph+7)
        c.setFillColor(ORANGE); c.circle(nx,ny,10,fill=1,stroke=0)
        c.setFillColor(colors.white); c.setFont('KoreanBold',13)
        c.drawCentredString(nx,ny-4,str(b['number'])); visible+=1
    if not visible: raise ValueError(f'No callouts on {spec["name"]}')
    c.setFont('Korean',11); c.setFillColor(INK)
    c.drawString(MARGIN,top-maxheight-14,'번호·주황색 테두리가 있는 부분을 찾아보세요. 화면은 데모 예시입니다.')

def cover(c,manual,data,count):
    base(c,manual,1,count,data['revision'])
    c.setFillColor(PALE); c.roundRect(MARGIN,HEIGHT-208,CONTENT,126,12,fill=1,stroke=0)
    text(c,manual['title'],MARGIN+18,HEIGHT-120,CONTENT-36,28,36,'KoreanBold',NAVY)
    text(c,manual['role'],MARGIN+18,HEIGHT-162,CONTENT-36,18,25,'KoreanBold',BLUE)
    y=text(c,manual['scope'],MARGIN,HEIGHT-243,CONTENT,16,23)
    y-=10
    y=text(c,'사용 주소  '+data['operatingUrl'],MARGIN,y,CONTENT,16,23,'KoreanBold',BLUE)
    c.linkURL(data['operatingUrl'],(MARGIN,y,WIDTH-MARGIN,y+24),relative=0)
    y-=16; y=text(c,'필요한 작업을 찾아 해당 쪽을 펼치세요.',MARGIN,y,CONTENT,16,24,'KoreanBold')
    y-=4
    for index,p in enumerate(manual['pages'],2):
        c.setFont('Korean',16); c.setFillColor(INK)
        c.drawString(MARGIN,y,p['title']); c.drawRightString(WIDTH-MARGIN,y,str(index))
        c.linkRect('',f'p{index}',(MARGIN,y-5,WIDTH-MARGIN,y+17),relative=0,thickness=0)
        y-=26
    if y<75: raise ValueError(f'Cover overflow: {manual["fileName"]}')
    c.showPage()

def task(c,manual,p,number,count,data,captures):
    base(c,manual,number,count,data['revision'])
    c.bookmarkPage(f'p{number}'); c.addOutlineEntry(p['title'],f'p{number}',0)
    y=text(c,p['title'],MARGIN,HEIGHT-84,CONTENT,25,32,'KoreanBold',NAVY)
    y=text(c,p['where'],MARGIN,y-12,CONTENT,16,23,'KoreanBold',BLUE)
    if y<662: raise ValueError(f'Heading overflow: {p["title"]}')
    screenshot(c,p['image'],captures)
    y=text(c,'따라 해 보세요',MARGIN,365,CONTENT,18,25,'KoreanBold')-7
    for index,step in enumerate(p['steps'],1):
        c.setFont('KoreanBold',16); c.setFillColor(BLUE); c.drawString(MARGIN,y,str(index)+'.')
        y=text(c,step,MARGIN+28,y,CONTENT-28,16,23)-7
    tip_lines=lines(p['tip'],CONTENT-28,16)
    tipheight=38+len(tip_lines)*22
    tiptop=y+1
    if tiptop-tipheight<61: raise ValueError(f'Body overflow: {manual["fileName"]} p{number} {p["title"]}, bottom={tiptop-tipheight:.1f}')
    c.setFillColor(PALE); c.roundRect(MARGIN,tiptop-tipheight,CONTENT,tipheight,8,fill=1,stroke=0)
    text(c,'막히면 이렇게 하세요',MARGIN+14,tiptop-23,CONTENT-28,16,22,'KoreanBold',BLUE)
    text(c,p['tip'],MARGIN+14,tiptop-48,CONTENT-28,16,22)
    c.showPage()

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--only',help='One PDF file name to regenerate'); args=parser.parse_args()
    register_fonts()
    data=json.loads((MANUALS/'source/manuals.json').read_text(encoding='utf-8'))
    captures={p['name']:p for p in json.loads((MANUALS/'images/captures.json').read_text(encoding='utf-8'))}
    for m in data['manuals']:
        if args.only and m['fileName']!=args.only:continue
        output=MANUALS/m['fileName']; count=len(m['pages'])+1
        buffer=io.BytesIO()
        c=canvas.Canvas(buffer,pagesize=A4,pageCompression=1,invariant=1)
        c.setTitle(m['title']); c.setAuthor('GTCC LMS'); c.setSubject('한국어 역할별 쉬운 사용법 - 실제 데모 화면')
        cover(c,m,data,count)
        for n,p in enumerate(m['pages'],2):task(c,m,p,n,count,data,captures)
        c.save()
        temporary=output.with_suffix('.pdf.tmp')
        temporary.write_bytes(buffer.getvalue())
        os.replace(temporary,output)
        print(f'{output.name}: {count} pages')
if __name__=='__main__':main()
