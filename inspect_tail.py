from pathlib import Path
import imageio.v2 as imageio
from PIL import Image, ImageDraw

video = Path(r"D:\Program Files\codex_projects\musicaldirector\ui\opening animation\幕布拉开定格动画.mp4")
out = Path(r"D:\Program Files\codex_projects\musicaldirector\ui\opening animation\尾部帧检查.jpg")
r = imageio.get_reader(str(video))
meta = r.get_meta_data(); fps = float(meta.get('fps') or 25); n = r.count_frames()
idxs = list(range(max(0, n-20), n))
thumbs=[]
for i in idxs:
    im=Image.fromarray(r.get_data(i)).convert('RGB'); im.thumbnail((320,180)); thumbs.append((i,im.copy()))
r.close()
sheet=Image.new('RGB',(640,((len(thumbs)+1)//2)*220),'white'); d=ImageDraw.Draw(sheet)
for j,(i,im) in enumerate(thumbs):
    x=(j%2)*320; y=(j//2)*220; sheet.paste(im,(x,y+25)); d.text((x+4,y+4),f'frame {i} / {i/fps:.3f}s',fill='black')
sheet.save(out,quality=92)
print(out)
