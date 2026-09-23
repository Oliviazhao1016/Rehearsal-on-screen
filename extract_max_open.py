from pathlib import Path
import csv
import imageio.v2 as imageio
from PIL import Image

video = Path(r"D:\Program Files\codex_projects\musicaldirector\ui\opening animation\幕布拉开定格动画.mp4")
out_dir = video.parent / "幕布拉开定格动画_关键帧_最大开口版"
out_dir.mkdir(exist_ok=True)
r = imageio.get_reader(str(video))
meta = r.get_meta_data(); fps = float(meta.get('fps') or 25); n = int(r.count_frames())
final_index = n - 1
count = 31
indices = [round(i * final_index / (count - 1)) for i in range(count)]
rows = []; prev = None
for number, index in enumerate(indices, 1):
    t = index / fps
    final = number == count
    name = f"{'最终态_视频中最大开口' if final else f'关键帧_{number:02d}'}_{t:05.2f}s.jpg"
    Image.fromarray(r.get_data(index)).save(out_dir / name, quality=95)
    delta = '' if prev is None else f'{t-prev:.3f}'
    rows.append([number, name, index, f'{t:.3f}', delta, '是' if final else '否'])
    prev = t
r.close()
with (out_dir / '关键帧时间表.csv').open('w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f); w.writerow(['序号','文件名','视频帧号','时间点(秒)','与上一张间隔(秒)','是否最终态']); w.writerows(rows)
print(f'fps={fps:.3f} frames={n} final_time={final_index/fps:.3f}s output={out_dir}')
