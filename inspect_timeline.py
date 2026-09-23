from pathlib import Path
import imageio.v2 as imageio
from PIL import Image, ImageDraw

video = Path(r"D:\Program Files\codex_projects\musicaldirector\ui\opening animation\幕布拉开定格动画.mp4")
out = video.parent / "全片时间线检查.jpg"
r = imageio.get_reader(str(video)); fps=float(r.get_meta_data().get('fps') or 25); n=r.count_frames()
idxs=list(range(0,n,10)); frames=[]
for i in idxs:
    im=Image.fromarray(r.get_data(i)).convert('RGB'); im.thumbnail((320,180)); frames.append((i,im.copy()))
r.close()
cols=4; rows=(len(frames)+cols-1)//cols
sheet=Image.new('RGB',(cols*320,rows*210),'white'); d=ImageDraw.Draw(sheet)
for j,(i,im) in enumerate(frames):
    x=(j%cols)*320; y=(j//cols)*210; d.text((x+4,y+4),f'frame {i} / {i/fps:.3f}s',fill='black'); sheet.paste(im,(x,y+25))
sheet.save(out,quality=92); print(out)
