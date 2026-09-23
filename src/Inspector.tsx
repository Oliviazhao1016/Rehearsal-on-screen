import { Eye, PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { actorArt } from './assets'
import type { ActorColor, Placement, Production, PropShape, StageMark } from './model'

const COLORS: ActorColor[] = ['burgundy', 'ochre', 'sage', 'slate', 'plum']
const COLOR_LABELS: Record<ActorColor, string> = { burgundy: '酒红', ochre: '赭金', sage: '鼠尾草绿', slate: '石板蓝', plum: '烟紫' }
const SHAPES: { shape: PropShape; label: string }[] = [{ shape: 'rectangle', label: '长方形' }, { shape: 'circle', label: '圆形' }, { shape: 'ellipse', label: '椭圆形' }]

type Props = {
  production: Production
  selectedId: string | null
  selectedMarkId: string | null
  selectedCount: number
  placement?: Placement
  collapsed: boolean
  onToggle: () => void
  onSelect: (id: string | null) => void
  onSelectMark: (id: string | null) => void
  onActorColor: (id: string, color: ActorColor) => void
  onPropChange: (id: string, change: { shape?: PropShape; width?: number; depth?: number; rotation?: number }) => void
  onMarkChange: (id: string, change: Partial<StageMark>) => void
}

export default function Inspector({ production, selectedId, selectedMarkId, selectedCount, placement, collapsed, onToggle, onSelect, onSelectMark, onActorColor, onPropChange, onMarkChange }: Props) {
  const actor = production.actors.find(item => item.id === selectedId)
  const prop = production.props.find(item => item.id === selectedId)
  const mark = production.stage.marks.find(item => item.id === selectedMarkId)
  return <aside className={`inspector ${collapsed ? 'panel-is-collapsed' : ''}`}>
    <div className="sidebar-header"><span>{collapsed ? '信息' : '对象信息'}</span><button className="panel-collapse-button" onClick={onToggle} aria-label={collapsed ? '展开右侧信息栏' : '收起右侧信息栏'} title={collapsed ? '展开信息栏' : '收起信息栏'}>{collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}</button></div>
    {!collapsed && (!selectedId && !selectedMarkId ? <div className="inspector-empty"><Eye size={28} /><strong>选择舞台对象</strong><p>点击演员、道具或已解锁的舞台标记，在这里查看详细信息。</p></div> : <div className="inspector-content">
      <span className="section-label">{mark ? '舞台标记' : `当前站位${selectedCount > 1 ? ` · 已选 ${selectedCount} 位演员` : ''}`}</span>
      <div className="inspector-title"><strong>{actor?.name ?? prop?.name ?? mark?.name}</strong><button className="icon-button" onClick={() => mark ? onSelectMark(null) : onSelect(null)} aria-label="关闭信息"><X size={17} /></button></div>
      {actor && <><div className="inspector-marker"><img src={actorArt[actor.color].selected} alt="" /><span>演员标记</span></div><span className="section-label">标记颜色</span><div className="color-choices">{COLORS.map(color => <button key={color} className={actor.color === color ? 'active' : ''} onClick={() => onActorColor(actor.id, color)} aria-label={`选择${COLOR_LABELS[color]}`} title={COLOR_LABELS[color]}><img src={actorArt[color].normal} alt="" /></button>)}</div></>}
      {prop && <><label className="field compact"><span>形状</span><select value={prop.shape} onChange={event => onPropChange(prop.id, { shape: event.target.value as PropShape })}>{SHAPES.map(shape => <option key={shape.shape} value={shape.shape}>{shape.label}</option>)}</select></label><div className="dimension-row"><label className="field compact"><span>{prop.shape === 'circle' ? '直径' : '长度'} · 米</span><input type="number" min="0.2" step="0.1" value={prop.width} onChange={event => onPropChange(prop.id, { width: Math.max(.2, Number(event.target.value)) })} /></label>{prop.shape !== 'circle' && <label className="field compact"><span>宽度 · 米</span><input type="number" min="0.2" step="0.1" value={prop.depth} onChange={event => onPropChange(prop.id, { depth: Math.max(.2, Number(event.target.value)) })} /></label>}</div><label className="field compact"><span>旋转 · 度</span><input type="range" min="0" max="360" value={prop.rotation} onChange={event => onPropChange(prop.id, { rotation: Number(event.target.value) })} /><small>{prop.rotation}°</small></label></>}
      {mark ? <><div className="inspector-marker mark-inspector-preview"><span className="mark-glyph" style={{ backgroundColor: mark.color, transform: `rotate(${mark.angle}deg)` }} /><span>{mark.preset ? '预设舞台标记' : '自定义舞台标记'}</span></div><label className="field compact"><span>名称</span><input aria-label="舞台标记名称" value={mark.name} onChange={event => onMarkChange(mark.id, { name: event.target.value })} /></label><label className="field compact"><span>颜色</span><input aria-label="舞台标记颜色" type="color" value={mark.color} onChange={event => onMarkChange(mark.id, { color: event.target.value })} /></label><div className="dimension-row"><label className="field compact"><span>长度 · %</span><input aria-label="舞台标记长度" type="number" min="5" max="90" value={mark.length} onChange={event => onMarkChange(mark.id, { length: Math.min(90, Math.max(5, Number(event.target.value))) })} /></label><label className="field compact"><span>粗细 · px</span><input aria-label="舞台标记粗细" type="number" min="1" max="8" value={mark.width} onChange={event => onMarkChange(mark.id, { width: Math.min(8, Math.max(1, Number(event.target.value))) })} /></label></div><label className="field compact"><span>角度 · °</span><input aria-label="舞台标记角度" type="number" min="0" max="360" value={mark.angle} onChange={event => onMarkChange(mark.id, { angle: Number(event.target.value) })} /></label><label className="mark-style-toggle"><input type="checkbox" checked={mark.dashed} onChange={event => onMarkChange(mark.id, { dashed: event.target.checked })} /> 虚线</label><div className="coordinate-box"><span>画布位置</span><strong>X {mark.x.toFixed(0)}%</strong><strong>Y {mark.y.toFixed(0)}%</strong></div></> : <><div className="inspector-divider" /><span className="section-label">站位状态</span><div className="presence-row"><span>{placement?.present ? '在场' : '不在场'}</span></div>
      {placement?.present ? <div className="coordinate-box"><span>当前位置</span><strong>X {(placement.x / 100 * production.stage.width - production.stage.width / 2).toFixed(1)}m</strong><strong>Y {((100 - placement.y) / 100 * production.stage.depth).toFixed(1)}m</strong></div> : <p className="inspector-help">从左侧拖动对象到舞台，或在左侧列表管理当前站位。</p>}</>}
    </div>)}
  </aside>
}
