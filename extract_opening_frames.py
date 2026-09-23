from pathlib import Path
import csv
import imageio.v2 as imageio
from PIL import Image

video = Path(r"D:\Program Files\codex_projects\musicaldirector\ui\opening animation\幕布拉开定格动画.mp4")
out_dir = video.parent / "幕布拉开定格动画_最终态完全拉开"
out_dir.mkdir(exist_ok=True)

reader = imageio.get_reader(str(video))
meta = reader.get_meta_data()
fps = float(meta.get("fps") or 25)
nframes = int(reader.count_frames())

# 视频在约4.19秒（第101帧）达到完全拉开；之后又出现回收动作。
final_index = 101
count = 31
indices = [round(i * final_index / (count - 1)) for i in range(count)]

rows = []
previous_time = None
for number, index in enumerate(indices, start=1):
    timestamp = index / fps
    is_final = number == count
    label = "最终态_完全拉开" if is_final else f"关键帧_{number:02d}"
    filename = f"{label}_{timestamp:05.2f}s.jpg"
    Image.fromarray(reader.get_data(index)).save(out_dir / filename, quality=95)
    delta = "" if previous_time is None else f"{timestamp - previous_time:.3f}"
    rows.append([number, filename, index, f"{timestamp:.3f}", delta, "是" if is_final else "否"])
    previous_time = timestamp

reader.close()
with (out_dir / "关键帧时间表.csv").open("w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(["序号", "文件名", "视频帧号", "时间点(秒)", "与上一张间隔(秒)", "是否最终态"])
    writer.writerows(rows)

print(f"fps={fps:.3f} total_frames={nframes} opening_final_frame={final_index} opening_final_time={final_index/fps:.3f}s")
print(f"output={out_dir}")
