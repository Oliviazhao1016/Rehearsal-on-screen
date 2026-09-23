import { useEffect, useRef, useState } from 'react'
import { clamp, positionTimes, type MusicClip, type Production } from './model'
import { ChevronDown, ChevronLeft, ChevronRight, Ellipsis, MapPin, Music2, PanelBottomClose, PanelBottomOpen, Pencil, Trash2, Upload } from 'lucide-react'

type Props = {
  production: Production
  playhead: number
  selectedPosition: number
  collapsed: boolean
  panelHeight: number
  onToggle: () => void
  onPosition: (index: number) => void
  onDuration: (index: number, duration: number) => void
  onMovement: (index: number, objectId: string, offset: number, duration: number) => void
  onEditMovement: (index: number, objectId: string) => void
  onMusicUpload: (files: FileList | null) => void
  onMusicUpdate: (id: string, updates: Partial<MusicClip>) => void
  onMusicDelete: (id: string) => void
  onMusicReplace: (id: string, file: File) => void
  onSeek: (time: number) => void
}

type TimingDrag = { pointer: number; startX: number; width: number; original: number; index: number }
type MovementDrag = {
  pointer: number; startX: number; width: number; index: number; objectId: string
  offset: number; duration: number; transitionDuration: number
  part: 'body' | 'start' | 'end'
}
type NavigatorDrag = { pointer: number; part: 'move' | 'start' | 'end'; x: number; width: number; start: number; duration: number }

const tickSteps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]
const timeLabel = (seconds: number) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export default function Timeline({ production, playhead, selectedPosition, collapsed, panelHeight, onToggle, onPosition, onDuration, onMovement, onEditMovement, onMusicUpload, onMusicUpdate, onMusicDelete, onMusicReplace, onSeek }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const [replaceId, setReplaceId] = useState<string | null>(null)
  const [editingMusicId, setEditingMusicId] = useState<string | null>(null)
  const [musicMenuId, setMusicMenuId] = useState<string | null>(null)
  const [musicNameDraft, setMusicNameDraft] = useState('')
  const railRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const navigatorRef = useRef<HTMLDivElement>(null)
  const navigatorDrag = useRef<NavigatorDrag | null>(null)
  const previousPlayhead = useRef(playhead)
  const [view, setView] = useState({ start: 0, duration: 30 })
  const musicDrag = useRef<{ id: string; startX: number; original: number; pointer: number } | null>(null)
  const timingDrag = useRef<TimingDrag | null>(null)
  const movementDrag = useRef<MovementDrag | null>(null)
  const times = positionTimes(production)
  const timelineLength = Math.max(30, (times.at(-1) ?? 0) + 5, ...production.music.map(clip => clip.start + clip.duration + 5))
  const minimumViewDuration = Math.min(timelineLength, Math.max(5, timelineLength * .03))
  const viewDuration = clamp(view.duration, minimumViewDuration, timelineLength)
  const viewStart = clamp(view.start, 0, timelineLength - viewDuration)
  const viewEnd = viewStart + viewDuration
  const at = (time: number) => `${(time - viewStart) / viewDuration * 100}%`
  const segment = (start: number, end: number) => {
    const first = Math.max(start, viewStart)
    const last = Math.min(end, viewEnd)
    return last > first ? { left: at(first), width: `${(last - first) / viewDuration * 100}%` } : null
  }
  const tickStep = tickSteps.find(step => step >= viewDuration / 8) ?? Math.ceil(viewDuration / 8 / 3600) * 3600
  const ticks = Array.from({ length: Math.ceil(viewDuration / tickStep) + 2 }, (_, index) => (Math.ceil(viewStart / tickStep) + index) * tickStep).filter(time => time <= viewEnd + .001)
  const pan = (seconds: number) => setView(current => {
    const duration = clamp(current.duration, minimumViewDuration, timelineLength)
    return { start: clamp(clamp(current.start, 0, timelineLength - duration) + seconds, 0, timelineLength - duration), duration }
  })
  const zoom = (factor: number, anchor: number) => setView(current => {
    const duration = clamp(current.duration, minimumViewDuration, timelineLength)
    const start = clamp(current.start, 0, timelineLength - duration)
    const nextDuration = clamp(duration * factor, minimumViewDuration, timelineLength)
    const anchorFraction = clamp((anchor - start) / duration, 0, 1)
    return { start: clamp(anchor - anchorFraction * nextDuration, 0, timelineLength - nextDuration), duration: nextDuration }
  })
  useEffect(() => {
    const elements = [navigatorRef.current, contentRef.current?.querySelector<HTMLElement>('.timeline-ruler'), railRef.current].filter((element): element is HTMLElement => Boolean(element))
    const handleWheel = (event: WheelEvent) => {
      const element = event.currentTarget as HTMLElement
      if ((event.target as HTMLElement).closest('.music-clip-menu')) return
      event.preventDefault()
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        pan(event.deltaX / Math.max(1, element.clientWidth) * viewDuration)
      } else if (event.deltaY) {
        const rect = element.getBoundingClientRect()
        const anchor = viewStart + clamp((event.clientX - rect.left) / rect.width, 0, 1) * viewDuration
        zoom(Math.exp(event.deltaY * .002), anchor)
      }
    }
    elements.forEach(element => element.addEventListener('wheel', handleWheel, { passive: false }))
    return () => elements.forEach(element => element.removeEventListener('wheel', handleWheel))
  }, [viewStart, viewDuration, timelineLength, collapsed])
  const startNavigatorDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!navigatorRef.current) return
    const rect = navigatorRef.current.getBoundingClientRect()
    const part = ((event.target as HTMLElement).dataset.part as NavigatorDrag['part']) || 'move'
    const start = part === 'move' && !(event.target as HTMLElement).closest('.timeline-view-window')
      ? clamp((event.clientX - rect.left) / rect.width * timelineLength - viewDuration / 2, 0, timelineLength - viewDuration)
      : viewStart
    if (start !== viewStart) setView({ start, duration: viewDuration })
    navigatorDrag.current = { pointer: event.pointerId, part, x: event.clientX, width: rect.width, start, duration: viewDuration }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  const moveNavigatorDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = navigatorDrag.current
    if (!drag || drag.pointer !== event.pointerId) return
    const delta = (event.clientX - drag.x) / drag.width * timelineLength
    if (drag.part === 'move') setView({ start: clamp(drag.start + delta, 0, timelineLength - drag.duration), duration: drag.duration })
    if (drag.part === 'start') {
      const end = drag.start + drag.duration
      const start = clamp(drag.start + delta, 0, end - minimumViewDuration)
      setView({ start, duration: end - start })
    }
    if (drag.part === 'end') setView({ start: drag.start, duration: clamp(drag.duration + delta, minimumViewDuration, timelineLength - drag.start) })
  }
  useEffect(() => {
    if (Math.abs(playhead - previousPlayhead.current) > .001 && (playhead < viewStart || playhead > viewEnd)) {
      setView(current => {
        const duration = clamp(current.duration, minimumViewDuration, timelineLength)
        return { start: clamp(playhead - duration * .15, 0, timelineLength - duration), duration }
      })
    }
    previousPlayhead.current = playhead
  }, [playhead, viewStart, viewEnd, minimumViewDuration, timelineLength])
  const allObjects = [...production.actors, ...production.props]
  const transitionObjects = expanded === null ? [] : allObjects.filter(object => production.positions[expanded]?.placements[object.id]?.present || production.positions[expanded + 1]?.placements[object.id]?.present)
  const commitMusicName = () => {
    if (editingMusicId && musicNameDraft.trim()) onMusicUpdate(editingMusicId, { name: musicNameDraft.trim() })
    setEditingMusicId(null)
    setMusicMenuId(null)
  }

  const moveMusic = (event: React.PointerEvent) => {
    const drag = musicDrag.current
    if (!drag || drag.pointer !== event.pointerId || !railRef.current) return
    const elapsed = (event.clientX - drag.startX) / railRef.current.clientWidth * viewDuration
    const nearby = [...times, ...production.music.filter(c => c.id !== drag.id).flatMap(c => [c.start, c.start + c.duration])]
    let start = clamp(drag.original + elapsed, 0, timelineLength)
    const closest = nearby.reduce<number | null>((best, boundary) => Math.abs(boundary - start) < .3 && (best === null || Math.abs(boundary - start) < Math.abs(best - start)) ? boundary : best, null)
    if (closest !== null) start = closest
    onMusicUpdate(drag.id, { start: Math.round(start * 10) / 10 })
  }
  const moveTiming = (event: React.PointerEvent) => {
    const drag = timingDrag.current
    if (!drag || drag.pointer !== event.pointerId) return
    const delta = (event.clientX - drag.startX) / drag.width * viewDuration
    onDuration(drag.index, Math.max(.5, Math.round((drag.original + delta) * 10) / 10))
  }
  const startTiming = (event: React.PointerEvent, index: number) => {
    if (!railRef.current) return
    const transition = production.transitions[index]
    if (!transition) return
    event.stopPropagation()
    timingDrag.current = { pointer: event.pointerId, startX: event.clientX, width: railRef.current.clientWidth, original: transition.duration, index }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveMovement = (event: React.PointerEvent) => {
    const drag = movementDrag.current
    if (!drag || drag.pointer !== event.pointerId) return
    const delta = (event.clientX - drag.startX) / drag.width * drag.transitionDuration
    let offset = drag.offset
    let duration = drag.duration
    if (drag.part === 'body') offset = clamp(drag.offset + delta, 0, drag.transitionDuration - drag.duration)
    if (drag.part === 'start') {
      offset = clamp(drag.offset + delta, 0, drag.offset + drag.duration - .1)
      duration = drag.duration - (offset - drag.offset)
    }
    if (drag.part === 'end') duration = clamp(drag.duration + delta, .1, drag.transitionDuration - drag.offset)
    onMovement(drag.index, drag.objectId, Math.round(offset * 10) / 10, Math.round(duration * 10) / 10)
  }
  const startMovement = (event: React.PointerEvent, index: number, objectId: string, offset: number, duration: number, transitionDuration: number) => {
    const track = event.currentTarget.parentElement as HTMLDivElement
    event.stopPropagation()
    movementDrag.current = { pointer: event.pointerId, startX: event.clientX, width: track.clientWidth, index, objectId, offset, duration, transitionDuration, part: (event.target as HTMLElement).dataset.part as MovementDrag['part'] || 'body' }
    track.setPointerCapture(event.pointerId)
  }

  return <section className={`timeline-panel ${collapsed ? 'collapsed' : expanded !== null ? 'expanded' : ''}`} style={collapsed ? undefined : { height: expanded !== null ? Math.max(panelHeight, 340) : panelHeight }} aria-label="动线编排时间轴">
    <div className="timeline-heading">
      <div><button className="timeline-toggle" onClick={onToggle} aria-label={collapsed ? '展开下方动线编排' : '收起下方动线编排'} title={collapsed ? '展开动线编排' : '收起动线编排'}>{collapsed ? <PanelBottomOpen size={18} /> : <PanelBottomClose size={18} />}</button><strong>动线编排</strong><span>拖动站位点或转换条，安排时间</span></div>
      <div className="timeline-actions">{!collapsed && <><button className="timeline-scroll-arrow" onClick={() => pan(-viewDuration * .75)} disabled={viewStart <= .01} aria-label="时间轴向左"><ChevronLeft size={19} /></button><button className="timeline-scroll-arrow" onClick={() => pan(viewDuration * .75)} disabled={viewEnd >= timelineLength - .01} aria-label="时间轴向右"><ChevronRight size={19} /></button><button className="text-button" onClick={() => uploadRef.current?.click()}><Upload size={17} /> 上传音乐</button></>}<input ref={uploadRef} type="file" accept="audio/*" multiple hidden onChange={event => { onMusicUpload(event.target.files); event.target.value = '' }} /><input ref={replaceRef} type="file" accept="audio/*" hidden onChange={event => { const file = event.target.files?.[0]; if (file && replaceId) onMusicReplace(replaceId, file); event.target.value = '' }} /></div>
    </div>
    {!collapsed && <div className="timeline-content" ref={contentRef}>
      <div className="timeline-navigator" ref={navigatorRef} role="slider" aria-label="可见时间范围" aria-valuemin={0} aria-valuemax={Math.round(timelineLength)} aria-valuenow={Math.round(viewStart)} aria-valuetext={`${timeLabel(Math.round(viewStart))} 到 ${timeLabel(Math.round(viewEnd))}`} tabIndex={0} title="拖动查看局部；拖动两端调整范围；滚轮缩放" onPointerDown={startNavigatorDrag} onPointerMove={moveNavigatorDrag} onPointerUp={event => { navigatorDrag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} onPointerCancel={() => { navigatorDrag.current = null }} onKeyDown={event => { if (event.key === 'ArrowLeft') { pan(-viewDuration * .1); event.preventDefault() } if (event.key === 'ArrowRight') { pan(viewDuration * .1); event.preventDefault() } if (event.key === '+' || event.key === '=') { zoom(.8, viewStart + viewDuration / 2); event.preventDefault() } if (event.key === '-') { zoom(1.25, viewStart + viewDuration / 2); event.preventDefault() } }}>
        {production.music.map(clip => <span key={clip.id} className="timeline-navigator-clip" style={{ left: `${clip.start / timelineLength * 100}%`, width: `${clip.duration / timelineLength * 100}%` }} />)}
        <div className="timeline-view-window" style={{ left: `${viewStart / timelineLength * 100}%`, width: `${viewDuration / timelineLength * 100}%` }}><i data-part="start" title="拖动缩放起点" /><i data-part="end" title="拖动缩放终点" /></div>
      </div>
      <div className="timeline-ruler" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); onSeek(viewStart + (event.clientX - rect.left) / rect.width * viewDuration) }}>
        {ticks.map(time => <span key={time} style={{ left: at(time) }}>{timeLabel(time)}</span>)}
      </div>
      <div className="timeline-rail" ref={railRef} onPointerMove={moveMusic} onPointerUp={event => { musicDrag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}>
        <div className="track-name music-name"><Music2 size={16} /> 音乐</div>
        <div className="music-track">
          {production.music.map(clip => { const visible = segment(clip.start, clip.start + clip.duration); return visible && <div key={clip.id} className={`music-clip ${musicMenuId === clip.id ? 'menu-open' : ''}`} title={`${clip.name} · ${clip.duration.toFixed(1)} 秒`} style={visible} onPointerDown={event => { if ((event.target as HTMLElement).closest('button,input')) return; musicDrag.current = { id: clip.id, startX: event.clientX, original: clip.start, pointer: event.pointerId }; railRef.current?.setPointerCapture(event.pointerId) }}>
            <span title={clip.name}>{clip.name}</span>
            <button className="music-menu-trigger" title="音乐操作" aria-label={`${clip.name} 操作`} onClick={() => setMusicMenuId(current => current === clip.id ? null : clip.id)}><Ellipsis size={16} /></button>
            {musicMenuId === clip.id && <div className="music-clip-menu" style={(Math.max(clip.start, viewStart) - viewStart) / viewDuration > .75 ? { right: 0 } : { left: 0 }} onPointerDown={event => event.stopPropagation()}>
              {editingMusicId === clip.id ? <><input className="music-name-input" aria-label="音乐名称" autoFocus maxLength={80} value={musicNameDraft} onChange={event => setMusicNameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') commitMusicName(); if (event.key === 'Escape') { setEditingMusicId(null); setMusicMenuId(null) } }} /><button onClick={commitMusicName}>保存</button></> : <><button onClick={() => { setMusicNameDraft(clip.name); setEditingMusicId(clip.id) }}><Pencil size={15} /> 重命名</button><button onClick={() => { setMusicMenuId(null); setReplaceId(clip.id); replaceRef.current?.click() }}>↻ 替换文件</button><button onClick={() => { setMusicMenuId(null); onMusicDelete(clip.id) }}><Trash2 size={15} /> 删除音乐</button></>}
            </div>}
          </div> })}
          {!production.music.length && <span className="track-empty">上传音乐后可拖动片段，对齐走位节奏</span>}
        </div>
        <div className="track-name position-name"><MapPin size={16} /> 站位</div>
        <div className="position-track">
          {production.transitions.map((transition, index) => { const visible = segment(times[index], times[index] + transition.duration); return visible && <button key={transition.id} className={`transition-bar ${expanded === index ? 'active' : ''}`} style={visible} onClick={() => setExpanded(expanded === index ? null : index)} title={`转换 ${index + 1}，${transition.duration} 秒`}>
            <span>{transition.duration.toFixed(1)}s</span><span className="transition-resize" title="拖动调整转换时长" onPointerDown={event => startTiming(event, index)} onPointerMove={moveTiming} onPointerUp={event => { timingDrag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} />
          </button> })}
          {production.positions.map((position, index) => times[index] >= viewStart && times[index] <= viewEnd && <button key={position.id} className={`timeline-position ${selectedPosition === index ? 'active' : ''} ${index === 0 ? 'fixed' : ''}`} style={{ left: at(times[index]) }} onClick={() => onPosition(index)} onPointerDown={event => { if (index > 0) startTiming(event, index - 1) }} onPointerMove={moveTiming} onPointerUp={event => { timingDrag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} title={index === 0 ? `${position.name} · 起点` : `拖动调整 ${position.name} 的时间`}><span /></button>)}
        </div>
        {playhead >= viewStart && playhead <= viewEnd && <div className="playhead" style={{ left: at(playhead) }} />}
      </div>
      {expanded === null && production.transitions.length > 0 && <div className="timeline-hint"><ChevronRight size={16} /> 点击 Transition 展开对象轨道；拖动末端调节转换时长</div>}
      {expanded !== null && production.transitions[expanded] && <div className="transition-details">
        <div className="transition-detail-head"><button className="text-button" onClick={() => setExpanded(null)}><ChevronDown size={16} /> Transition {expanded + 1}</button><span>走位时间</span><input aria-label="走位时间" type="number" min="0.5" step="0.1" value={production.transitions[expanded].duration} onChange={event => onDuration(expanded, Number(event.target.value))} /><span>秒</span></div>
        <div className="movement-list">{transitionObjects.map(object => {
          const transition = production.transitions[expanded]
          const movement = transition.movements[object.id]
          const offset = movement?.offset ?? 0
          const moveDuration = movement?.duration ?? transition.duration
          const from = production.positions[expanded]?.placements[object.id]
          const to = production.positions[expanded + 1]?.placements[object.id]
          const canDraw = Boolean(from?.present || to?.present)
          return <div key={object.id} className="movement-row">
            <span className="movement-object-name" title={object.name}>{object.name}</span>
            <div className="movement-mini-track" onPointerMove={moveMovement} onPointerUp={event => { movementDrag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}>
              <div className="movement-bar" style={{ left: `${offset / transition.duration * 100}%`, width: `${moveDuration / transition.duration * 100}%` }} onPointerDown={event => startMovement(event, expanded, object.id, offset, moveDuration, transition.duration)}><i data-part="start" title="拖动起点" /><span title="拖动整条移动时间">{movement?.path.length ? '自定义动线' : '默认动线'}</span><i data-part="end" title="拖动终点" /></div>
            </div>
            <label>开始 <input aria-label={`${object.name} 开始时间`} type="number" min="0" max={transition.duration} step="0.1" value={offset.toFixed(1)} onChange={event => onMovement(expanded, object.id, Number(event.target.value), moveDuration)} />s</label>
            <label>结束 <input aria-label={`${object.name} 结束时间`} type="number" min="0.1" max={transition.duration} step="0.1" value={(offset + moveDuration).toFixed(1)} onChange={event => onMovement(expanded, object.id, offset, Number(event.target.value) - offset)} />s</label>
            <button className="movement-draw" disabled={!canDraw} title={canDraw ? '在舞台与下场区之间查看并编辑动线' : '仅当相邻站位至少一端在场时可编辑动线'} onClick={() => onEditMovement(expanded, object.id)}>编辑动线</button>
          </div>
        })}{!transitionObjects.length && <p className="movement-empty">这段转换没有在场对象。</p>}</div>
      </div>}
    </div>}
  </section>
}
