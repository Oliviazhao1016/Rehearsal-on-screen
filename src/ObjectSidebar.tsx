import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from 'lucide-react'
import { actorArt } from './assets'
import type { Position, Production, PropShape } from './model'

const SHAPES: { shape: PropShape; label: string }[] = [{ shape: 'rectangle', label: '长方形' }, { shape: 'circle', label: '圆形' }, { shape: 'ellipse', label: '椭圆形' }]

type Props = {
  production: Production
  position?: Position
  selectedIds: string[]
  selectedMarkId: string | null
  collapsed: boolean
  editable: boolean
  onToggle: () => void
  onSelect: (id: string, additive?: boolean) => void
  onAddActor: () => void
  onAddProp: (shape: PropShape) => void
  onDelete: (id: string) => void
  onToggleVisibility: (id: string) => void
  onRename: (id: string, name: string) => void
  onSelectMark: (id: string) => void
  onAddMark: () => void
  onDeleteMark: (id: string) => void
  onToggleMarkVisibility: (id: string) => void
}

export default function ObjectSidebar({ production, position, selectedIds, selectedMarkId, collapsed, editable, onToggle, onSelect, onAddActor, onAddProp, onDelete, onToggleVisibility, onRename, onSelectMark, onAddMark, onDeleteMark, onToggleMarkVisibility }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [propMenu, setPropMenu] = useState(false)
  const [actorsOpen, setActorsOpen] = useState(true)
  const [propsOpen, setPropsOpen] = useState(true)
  const [marksOpen, setMarksOpen] = useState(true)
  const startRename = (id: string, name: string) => { if (!editable) return; setRenaming(id); setDraftName(name) }
  const finishRename = () => { if (renaming && draftName.trim()) onRename(renaming, draftName.trim()); setRenaming(null) }
  const dragObject = (event: React.DragEvent, id: string) => {
    event.dataTransfer.setData('application/x-stage-object', id)
    event.dataTransfer.setData('text/plain', id)
    event.dataTransfer.effectAllowed = 'copy'
  }

  return <aside className={`object-sidebar ${collapsed ? 'panel-is-collapsed' : ''}`}>
    <div className="sidebar-header"><span>{collapsed ? '对象' : '舞台对象'}</span><button className="panel-collapse-button" onClick={onToggle} aria-label={collapsed ? '展开左侧对象栏' : '收起左侧对象栏'} title={collapsed ? '展开对象栏' : '收起对象栏'}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
    {!collapsed && <>
      <div className="sidebar-section"><div className="sidebar-section-title"><button className="section-collapse" title={actorsOpen ? '收起演员' : '展开演员'} aria-label={actorsOpen ? '收起演员' : '展开演员'} onClick={() => setActorsOpen(value => !value)}>{actorsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>演员 <span>{production.actors.length}</span><button title="添加演员" onClick={onAddActor}><Plus size={17} /></button></div>
        {actorsOpen && <div className="sidebar-list">{production.actors.map((actor, index) => {
          const present = position?.placements[actor.id]?.present
          const visible = !production.hiddenObjectIds?.includes(actor.id)
          const selected = selectedIds.includes(actor.id)
          return <div key={actor.id} className={`object-row ${selected ? 'active' : ''}`} draggable={editable && renaming !== actor.id} onDragStart={event => dragObject(event, actor.id)} title="拖到舞台；Ctrl / Shift 点击可多选；双击名称可修改">
            <img src={actorArt[actor.color][selected ? 'selected' : 'normal']} alt="" />
            {renaming === actor.id ? <input className="object-rename" autoFocus aria-label={`修改${actor.name}名称`} value={draftName} onChange={event => setDraftName(event.target.value)} onBlur={finishRename} onKeyDown={event => { if (event.key === 'Enter') finishRename(); if (event.key === 'Escape') setRenaming(null) }} /> : <button className="object-select" onClick={event => onSelect(actor.id, event.ctrlKey || event.metaKey || event.shiftKey)} onDoubleClick={() => startRename(actor.id, actor.name)}>{actor.name}</button>}
            <small>{present ? `#${index + 1}` : '不在场'}</small>
            <button className={`object-row-action visibility ${visible ? 'on' : ''}`} title={visible ? '隐藏舞台显示' : '显示舞台对象'} aria-label={`${visible ? '隐藏' : '显示'} ${actor.name}`} onClick={() => onToggleVisibility(actor.id)}>{visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            {editable && <button className="object-row-action danger" title="从剧目删除演员" aria-label={`删除 ${actor.name}`} onClick={() => onDelete(actor.id)}><Trash2 size={16} /></button>}
          </div>
        })}</div>}
      </div>
      <div className="sidebar-section props-section"><div className="sidebar-section-title"><button className="section-collapse" title={propsOpen ? '收起道具' : '展开道具'} aria-label={propsOpen ? '收起道具' : '展开道具'} onClick={() => setPropsOpen(value => !value)}>{propsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>道具 <span>{production.props.length}</span><div className="add-prop-menu"><button title="添加道具" onClick={() => setPropMenu(value => !value)}><Plus size={17} /></button>{propMenu && <div className="add-prop-options">{SHAPES.map(shape => <button key={shape.shape} onClick={() => { onAddProp(shape.shape); setPropMenu(false) }}>{shape.label}</button>)}</div>}</div></div>
        {propsOpen && <><div className="sidebar-list">{production.props.map(prop => {
          const present = position?.placements[prop.id]?.present
          const visible = !production.hiddenObjectIds?.includes(prop.id)
          return <div key={prop.id} className={`object-row ${selectedIds.includes(prop.id) ? 'active' : ''}`} draggable={editable && renaming !== prop.id} onDragStart={event => dragObject(event, prop.id)} title="拖到舞台；双击名称可修改">
            <span className={`prop-glyph ${prop.shape}`} />
            {renaming === prop.id ? <input className="object-rename" autoFocus aria-label={`修改${prop.name}名称`} value={draftName} onChange={event => setDraftName(event.target.value)} onBlur={finishRename} onKeyDown={event => { if (event.key === 'Enter') finishRename(); if (event.key === 'Escape') setRenaming(null) }} /> : <button className="object-select" onClick={() => onSelect(prop.id)} onDoubleClick={() => startRename(prop.id, prop.name)}>{prop.name}</button>}
            <small>{present ? '在场' : '不在场'}</small>
            <button className={`object-row-action visibility ${visible ? 'on' : ''}`} title={visible ? '隐藏舞台显示' : '显示舞台对象'} aria-label={`${visible ? '隐藏' : '显示'} ${prop.name}`} onClick={() => onToggleVisibility(prop.id)}>{visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            {editable && <button className="object-row-action danger" title="从剧目删除道具" aria-label={`删除 ${prop.name}`} onClick={() => onDelete(prop.id)}><Trash2 size={16} /></button>}
          </div>
        })}</div>
        {!production.props.length && <p className="sidebar-empty">添加道具，安排舞台物件的走位。</p>}</>}
      </div>
      <div className="sidebar-section marks-section"><div className="sidebar-section-title"><button className="section-collapse" title={marksOpen ? '收起舞台标记' : '展开舞台标记'} aria-label={marksOpen ? '收起舞台标记' : '展开舞台标记'} onClick={() => setMarksOpen(value => !value)}>{marksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>舞台标记 <span>{production.stage.marks.length}</span><button title="添加舞台标记" aria-label="添加舞台标记" onClick={onAddMark}><Plus size={17} /></button></div>
        {marksOpen && <div className="sidebar-list">{production.stage.marks.map(mark => {
          const visible = mark.visible !== false
          return <div key={mark.id} className={`object-row stage-mark-row ${selectedMarkId === mark.id ? 'active' : ''}`} title="点击选中；在画布解锁后可拖拽调整位置">
            <span className="mark-glyph" style={{ backgroundColor: mark.color, transform: `rotate(${mark.angle}deg)` }} />
            <button className="object-select" onClick={() => onSelectMark(mark.id)}>{mark.name}</button>
            <small>{mark.preset ? '预设' : '自定义'}</small>
            <button className={`object-row-action visibility ${visible ? 'on' : ''}`} title={visible ? '隐藏舞台标记' : '显示舞台标记'} aria-label={`${visible ? '隐藏' : '显示'} ${mark.name}`} onClick={() => onToggleMarkVisibility(mark.id)}>{visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            {editable && <button className="object-row-action danger" title="删除舞台标记" aria-label={`删除 ${mark.name}`} onClick={() => onDeleteMark(mark.id)}><Trash2 size={16} /></button>}
          </div>
        })}</div>}
      </div>
    </>}
  </aside>
}
