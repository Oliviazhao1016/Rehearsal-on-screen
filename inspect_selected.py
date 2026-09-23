from pathlib import Path
import imageio.v2 as imageio
from PIL import Image, ImageDraw

video = Path(r"D:\Program Files\codex_projects\musicaldirector\ui\opening animation\幕布拉开定格动画.mp4")
out = video.parent / "选定帧检查.jpg"
r = imageio.get_reader(str(video))
fps = float(r.get_meta_data().get('fps') or 25)
idxs = list(range(95, 108))
frames = []
for i in idxs:
    im = Image.fromarray(r.get_data(i)).convert('RGB')
    im.thumbnail((320, 180))
    frames.append((i, im.copy()))
r.close()
sheet = Image.new('RGB', (960, ((len(frames) + 2) // 3) * 210), 'white')
d = ImageDraw.Draw(sheet)
for j, (i, im) in enumerate(frames):
    x = (j % 3) * 320
    y = (j // 3) * 210
    d.text((x + 4, y + 4), f'frame {i} / {i / fps:.3f}s', fill='black')
    sheet.paste(im, (x, y + 25))
sheet.save(out, quality=92)
print(out)
