# musicaldirector 视觉规范

## 1. 设计定位

`musicaldirector` 的视觉方向为 **Art Deco Theatre Noir**：

> 深灰棕色创作空间 + 纸面节目单质感 + 古铜金装饰 + 少量酒红舞台信号。

整体灵感来自 Art Deco 剧院、复古票根、皮革票夹、舞台幕布和音乐节目单。界面需要同时具备两点：有仪式感，但仍然清晰、易读、易操作。

视觉重点不是堆叠复古装饰，而是把“纸面创作”转译成数字工作台：项目像节目单，曲目像章节，时间轴像票根齿孔，页面转场像幕布或纸张展开。

## 2. 色彩系统

保留四个核心颜色；装饰框线另用一枚专用金色，避免与古铜金进度线混用。

| Token | HEX | 角色 | 使用场景 |
| --- | --- | --- | --- |
| `--color-main` | `#171513` | 主色 | 页面背景、导航、编辑区、播放器 |
| `--color-text` | `#E8D8BC` | 字体强调色 | 标题、正文、主要信息、按钮文字 |
| `--color-accent` | `#8F302D` | 点缀色 | Icon、选中状态、播放状态、警示状态 |
| `--color-support` | `#AA8656` | 辅助色 | 古铜金进度线、编号、次要提示 |
| `--color-border` | `#D4AF37` | 框线金 | 细边框、分割线及少量 Art Deco 几何点缀 |

### 使用比例

- 主色：约 75%
- 字体强调色：约 15%
- 点缀色：约 6%
- 辅助色：约 4%

### 使用原则

- 不使用纯黑作为主背景，保留 `#171513` 的棕灰暖感。
- 不使用纯白文字，避免破坏旧纸张和剧院空间的氛围。
- 酒红色只作为状态和视觉信号，不大面积铺满页面。
- 古铜金主要用于线条和装饰，不用于大段小字号正文。
- 所有重要操作必须保证文字与背景之间有足够对比度。

## 3. 字体系统

### UI / 导航字体：Oswald

Oswald 用于拉丁字母、数字及所有需要快速阅读和操作的内容；中文正文统一使用仓耳渔阳体 W02，栏目标题使用仓耳渔阳体 W05。两种字重均以本地字体文件随应用打包，不依赖用户设备安装：

- 导航
- 按钮
- Icon 标签
- 播放器控制
- 文件名
- 时间和状态
- 辅助说明

```css
font-family: "Oswald", "CangEr YuYangTi W02", sans-serif;
```

导航建议使用较小字号、较宽字距和适量大写：

```css
font-size: 12px;
letter-spacing: 0.08em;
```

### 特殊展示字体：Limelight

Limelight 用于需要建立舞台感和品牌记忆的场景。它是 Art Deco 风格的展示字体，适合剧院招牌和复古舞台标题，但不适合正文和复杂操作界面。

使用场景：

- 首页主标题
- 项目名称
- 曲目章节标题
- 开场动画文字
- 大型数字和年份
- 项目封面或节目单标题

```css
font-family: "Limelight", display;
```

### 字体 Token

```css
:root {
  --font-ui: "Oswald", "CangEr YuYangTi W02", sans-serif;
  --font-heading: "Oswald", "CangEr YuYangTi W05", sans-serif;
  --font-display: "Limelight", "CangEr YuYangTi W05", display;
}
```

## 4. Art Deco 形态语言

Art Deco 通过结构和装饰体现，不依赖大量颜色。

### 推荐元素

- 对称构图
- 双层细边框
- 阶梯形转角
- 扇形 / 日芒纹
- 中央菱形
- 细长横线
- 圆点和票根齿孔
- 上下对称的装饰徽章
- 编号、章节和时间码

### 边框规范

工作台的矩形组件全部使用直角，不使用圆角矩形。线框由 CSS 或 SVG 原生几何绘制，以便随容器尺寸变化；`ui/borderline` 中的图片只作风格参考，不直接贴在界面上。默认使用 1px 金色细线，可叠加低透明度内线；分区线上最多点缀一个小菱形或短阶梯转角：

```css
border: 1px solid rgba(212, 175, 55, 0.56);
outline: 1px solid rgba(212, 175, 55, 0.24);
outline-offset: -5px;
```

边框应当精致、克制，不要让每个区域都被厚重金框包围。

## 5. 面板和纸面组件

### 深色操作面板

```css
background: #171513;
color: #E8D8BC;
```

适用于：

- 主编辑区
- 导航
- 播放器
- 时间轴
- 设置面板

### 票根 / 节目单组件

纸面组件可以使用字体强调色作为底色，并用酒红或古铜金作为线稿：

```css
background: #E8D8BC;
color: #171513;
border: 1px solid #AA8656;
```

适用于：

- 项目详情
- 曲目说明
- 导出预览
- 节目单
- 创作档案

纸面纹理应当非常轻微，不能影响文字和控件的识别。

## 6. 进度线与时间轴

进度线统一使用古铜金 `#AA8656`。

```css
.progress-line {
  height: 1px;
  background: #AA8656;
  transform-origin: left center;
}
```

视觉上应接近：

- 票根上的细金线
- 乐谱的节拍线
- 剧院节目单的章节分割线
- 金属铭牌上的刻线

不使用粗大的现代播放器进度条。播放中的状态可以使用酒红色圆点或短段高亮来补充。

## 7. Icon 和状态

Icon 以 `ui/icon` 素材为参考，使用清晰一致的矢量线性图标；按钮图标画面尺寸不小于 16px，线宽约 1.8px，避免原始小图放大后失真。

演员标记默认为品牌酒红色 `#8F302D`，提供酒红、赭金、鼠尾草绿、石板蓝、暗紫五组复古色，每组均有普通态与选中态 SVG。选中态增加外圈，不能只靠颜色区分。

- 默认：`#E8D8BC` 或低透明度古铜金
- 选中 / 播放：`#8F302D`
- Hover：`#AA8656`
- 禁用：降低透明度，不新增灰色色板

Icon 的 Art Deco 感主要来自几何比例、对称性和细线，而不是复杂纹样。

## 8. 动效方向

动效应像舞台、纸张和印刷品，而不是科技产品。

### 推荐动效

- 幕布式遮罩展开
- 纸张 / 票根展开
- 金色线条从左向右延展
- 标题逐字或分段出现
- 页面内容从暗处缓慢显现
- 章节切换时的淡入和轻微位移
- 播放时进度线平滑增长

### 动效原则

- 进入动效：300–700ms
- 主要转场：500–900ms
- 线条和进度：平滑、连续、低冲击
- 避免弹跳、强缩放、过快闪烁和霓虹效果

## 9. 页面隐喻

| 功能 | 视觉隐喻 |
| --- | --- |
| 首页 | 剧院舞台 / 开场幕布 |
| 项目库 | 票夹 / 节目册 |
| 曲目列表 | 演出节目单 |
| 播放器 | 舞台控制台 |
| 时间轴 | 票根齿孔 / 乐谱分段 |
| 项目详情 | 一场演出的剧本 |
| 收藏 | 盖章票根 |
| 导出 | “今晚开演”或节目单封面 |

## 10. 组件示例

```css
:root {
  --color-main: #171513;
  --color-text: #E8D8BC;
  --color-accent: #8F302D;
  --color-support: #AA8656;
  --color-border: #D4AF37;

  --font-ui: "Oswald", "CangEr YuYangTi W02", sans-serif;
  --font-heading: "Oswald", "CangEr YuYangTi W05", sans-serif;
  --font-display: "Limelight", "CangEr YuYangTi W05", display;
}

.panel {
  background: var(--color-main);
  color: var(--color-text);
  border: 1px solid rgba(212, 175, 55, 0.56);
}

.display-title {
  font-family: var(--font-display);
  color: var(--color-text);
}

.ui-label,
.button,
.navigation {
  font-family: var(--font-ui);
}

.accent-icon {
  color: var(--color-accent);
}

.deco-line {
  height: 1px;
  background: var(--color-support);
}
```

## 11. 一句话判断标准

每个视觉决定都应该回答：

> 它是在帮助用户创作一场演出，还是只是在装饰界面？

如果装饰影响了识别、操作或阅读，就应该减弱装饰；如果界面太像普通音乐工具，则可以通过 Limelight 标题、票根边框、古铜金进度线和纸面组件补回剧院气质。
