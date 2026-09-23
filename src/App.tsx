import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Eye, Grid3X3, Lock, LockOpen, Pause, Play, Plus, Redo2, RotateCcw, Settings2, SkipForward, Trash2, Undo2, X } from 'lucide-react'
import { actorColors, stageArt } from './assets'
import { OpeningExperience, PlayLibrary } from './EntryExperience'
import StageCanvas, { type PathEditor } from './StageCanvas'
import Timeline from './Timeline'
import ObjectSidebar from './ObjectSidebar'
import Inspector from './Inspector'
import { clamp, clone, id, makeFirstPosition, makeProduction, normaliseStageMarks, pathFromNodes, placementAt, placementPoint, positionTimes, reconcileTransitions, type ActorColor, type MusicClip, type OffstageSide, type PathNode, type Placement, type Point, type Position, type Production, type PropShape, type StageMark } from './model'
import { deleteMusicFile, loadMusicFile, musicDuration, saveMusicFile } from './musicStore'

const STORAGE_KEY = 'musicaldirector-productions-v1'
const LAYOUT_STORAGE_KEY = 'musicaldirector-editor-layout-v1'
type PanelSizes = { left: number; right: number; timeline: number }
type WorkbenchLayoutStyle = CSSProperties & { '--left-panel-width': string; '--right-panel-width': string }

const loadPanelSizes = (): PanelSizes => {
  const fallback: PanelSizes = { left: 240, right: 280, timeline: 275 }
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || '{}') as Partial<PanelSizes>
    return {
      left: typeof saved.left === 'number' ? clamp(saved.left, 160, 560) : fallback.left,
      right: typeof saved.right === 'number' ? clamp(saved.right, 180, 560) : fallback.right,
      timeline: typeof saved.timeline === 'number' ? clamp(saved.timeline, 160, 720) : fallback.timeline,
    }
  } catch { return fallback }
}

const loadProjects = (): Production[] => { try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Production[]).map(project => ({ ...project, stage: normaliseStageMarks(project.stage), actors: project.actors.map(actor => ({ ...actor, color: ({ pink: 'burgundy', blue: 'slate', yellow: 'ochre' } as Record<string, ActorColor>)[actor.color] ?? actor.color ?? 'burgundy' })), hiddenObjectIds: project.hiddenObjectIds ?? [], positions: project.positions.map(position => ({ ...position, name: position.name.replace(/^Position (\d+)$/, '站位 $1') })) })) } catch { return [] } }

function Preview({ production, position, small = false }: { production: Production; position?: Position; small?: boolean }) {
  return <div className={`preview-stage ${small ? 'small' : ''}`}>
    {production.actors.map(actor => {
      const placement = position?.placements[actor.id]
      return placement?.present && !production.hiddenObjectIds?.includes(actor.id) ? <span key={actor.id} className="preview-actor" style={{ left: `${placement.x}%`, top: `${placement.y}%`, backgroundColor: actorColors[actor.color] }} /> : null
    })}
    {production.props.map(prop => {
      const placement = position?.placements[prop.id]
      return placement?.present && !production.hiddenObjectIds?.includes(prop.id) ? <span key={prop.id} className="preview-prop" style={{ left: `${placement.x}%`, top: `${placement.y}%` }} /> : null
    })}
  </div>
}

export default function App() {
  const [projects, setProjects] = useState<Production[]>(loadProjects)
  const [view, setView] = useState<'opening' | 'library' | 'create' | 'editor'>('opening')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mode, setMode] = useState<'rehearsal' | 'preview'>('rehearsal')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null)
  const [marksUnlocked, setMarksUnlocked] = useState(false)
  const [sceneEditing, setSceneEditing] = useState(false)
  const [sceneDraft, setSceneDraft] = useState('')
  const [newName, setNewName] = useState('')
  const [actorCount, setActorCount] = useState(8)
  const [stageWidth, setStageWidth] = useState(14)
  const [stageDepth, setStageDepth] = useState(12)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [positionMenu, setPositionMenu] = useState(false)
  const [pathEditor, setPathEditor] = useState<{ transitionIndex: number; objectId: string; tool: PathEditor['tool'] } | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth <= 800)
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth <= 800)
  const [bottomCollapsed, setBottomCollapsed] = useState(() => window.innerWidth <= 800)
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(loadPanelSizes)
  const [message, setMessage] = useState('')
  const [saveLabel, setSaveLabel] = useState('已保存')
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [musicUrls, setMusicUrls] = useState<Record<string, string>>({})
  const history = useRef<Production[]>([])
  const redoHistory = useRef<Production[]>([])
  const targetTime = useRef<number | null>(null)
  const playheadRef = useRef(0)
  const selectedRef = useRef(0)
  const positionDrag = useRef<{ from: number; startX: number; startY: number; active: boolean } | null>(null)
  const suppressPositionClick = useRef(false)
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null)
  const positionStripRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<Record<string, HTMLAudioElement>>({})
  const project = projects.find(item => item.id === activeId) ?? null
  const selectedId = selectedIds.at(-1) ?? null
  const position = project?.positions[selectedIndex]
  const times = project ? positionTimes(project) : [0]
  const totalTime = times.at(-1) ?? 0
  const playbackTotal = project ? Math.max(totalTime, ...project.music.map(clip => clip.start + clip.duration), 0.1) : 0.1

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); setSaveLabel('已保存') }, [projects])
  useEffect(() => { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(panelSizes)) }, [panelSizes])
  useEffect(() => {
    const keepPanelsInViewport = () => {
      if (window.innerWidth <= 800) return
      setPanelSizes(current => {
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth
        const leftMax = Math.max(160, viewportWidth - (rightCollapsed ? 52 : current.right) - 360)
        const left = clamp(current.left, 160, leftMax)
        const rightMax = Math.max(180, viewportWidth - (leftCollapsed ? 52 : left) - 360)
        const right = clamp(current.right, 180, rightMax)
        return left === current.left && right === current.right ? current : { ...current, left, right }
      })
    }
    keepPanelsInViewport()
    window.addEventListener('resize', keepPanelsInViewport)
    return () => window.removeEventListener('resize', keepPanelsInViewport)
  }, [leftCollapsed, rightCollapsed])
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 3500); return () => clearTimeout(timer) }, [message])
  useEffect(() => {
    if (view !== 'editor' || !project) return
    const timer = window.setInterval(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); setSaveLabel('刚刚自动保存') }, 30000)
    return () => clearInterval(timer)
  }, [view, projects, project?.id])
  useEffect(() => { selectedRef.current = selectedIndex }, [selectedIndex])

  const updateProject = useCallback((mutate: (draft: Production) => void) => {
    if (!activeId) return
    setProjects(previous => previous.map(item => {
      if (item.id !== activeId) return item
      history.current.push(clone(item)); if (history.current.length > 60) history.current.shift()
      redoHistory.current = []
      const draft = clone(item)
      mutate(draft)
      draft.updatedAt = Date.now()
      return draft
    }))
    setSaveLabel('正在保存…')
  }, [activeId])
  const beginObjectDrag = () => {
    if (!project) return
    history.current.push(clone(project))
    if (history.current.length > 60) history.current.shift()
    redoHistory.current = []
  }
  const moveDraggedObjects = (points: Record<string, Point>) => {
    if (!activeId) return
    setProjects(previous => previous.map(item => {
      if (item.id !== activeId) return item
      const current = item.positions[selectedIndex]
      if (!current) return item
      return {
        ...item,
        updatedAt: Date.now(),
        positions: item.positions.map((position, index) => index === selectedIndex
          ? { ...position, placements: { ...position.placements, ...Object.fromEntries(Object.entries(points).map(([objectId, point]) => [objectId, { ...point, present: true }])) } }
          : position),
      }
    }))
    setSaveLabel('正在保存…')
  }

  const undo = () => {
    if (!project || !history.current.length) return
    const previous = history.current.pop()!
    redoHistory.current.push(clone(project))
    setProjects(items => items.map(item => item.id === project.id ? previous : item))
    setSelectedIndex(current => Math.min(current, Math.max(0, previous.positions.length - 1)))
    setMessage('已撤销')
  }
  const redo = () => {
    if (!project || !redoHistory.current.length) return
    const next = redoHistory.current.pop()!
    history.current.push(clone(project))
    setProjects(items => items.map(item => item.id === project.id ? next : item))
    setMessage('已重做')
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
      if (event.code === 'Space' && view === 'editor' && project && !settingsOpen && !(event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) {
        event.preventDefault()
        if (event.repeat) return
        if (mode === 'rehearsal') next()
        else setPlaying(current => !current)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  })

  const setTime = (time: number) => { playheadRef.current = time; setPlayhead(time) }
  const stop = () => { setPlaying(false); targetTime.current = null }
  useEffect(() => {
    if (!playing || !project) return
    let handle = 0
    let last = performance.now()
    const tick = (now: number) => {
      const limit = targetTime.current ?? Math.max(totalTime, ...project.music.map(clip => clip.start + clip.duration), 0)
      const next = Math.min(limit, playheadRef.current + (now - last) / 1000)
      last = now
      setTime(next)
      if (next >= limit - 0.001) {
        setPlaying(false)
        if (targetTime.current !== null) { setSelectedIndex(Math.min(selectedRef.current + 1, project.positions.length - 1)); targetTime.current = null }
      } else handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [playing, project?.id, totalTime, project?.music.length])

  useEffect(() => {
    const clips = project?.music ?? []
    let cancelled = false
    Promise.all(clips.filter(clip => clip.fileId && !musicUrls[clip.id]).map(async clip => {
      const blob = await loadMusicFile(clip.fileId!)
      return [clip.id, blob ? URL.createObjectURL(blob) : ''] as const
    })).then(entries => { if (cancelled) entries.forEach(([, url]) => url && URL.revokeObjectURL(url)); else if (entries.length) setMusicUrls(current => ({ ...current, ...Object.fromEntries(entries) })) }).catch(() => setMessage('部分音乐文件未能加载，请重新上传'))
    return () => { cancelled = true }
  }, [project?.id, project?.music, musicUrls])
  useEffect(() => {
    if (!project) return
    for (const clip of project.music) {
      const url = musicUrls[clip.id]
      if (!url) continue
      let audio = audioRef.current[clip.id]
      if (!audio || audio.src !== url) { audio?.pause(); audio = new Audio(url); audioRef.current[clip.id] = audio }
      const relative = playhead - clip.start
      if (playing && relative >= 0 && relative < clip.duration) {
        if (Math.abs(audio.currentTime - relative) > 0.35) audio.currentTime = relative
        if (audio.paused) void audio.play().catch(() => {})
      } else audio.pause()
    }
  }, [project?.music, musicUrls, playhead, playing])

  const selectObject = (objectId: string | null, additive = false) => {
    if (!objectId) { setSelectedIds([]); setSelectedMarkId(null); setPathEditor(null); return }
    setSelectedMarkId(null)
    const isActor = project?.actors.some(actor => actor.id === objectId) ?? false
    setSelectedIds(current => {
      if (!isActor) return [objectId]
      if (additive) return current.includes(objectId) ? current.filter(id => id !== objectId) : [...current.filter(id => project?.actors.some(actor => actor.id === id)), objectId]
      if (current.length > 1 && current.includes(objectId)) return current
      return [objectId]
    })
    if (pathEditor?.objectId !== objectId) setPathEditor(null)
  }
  const selectStageMark = (markId: string | null) => { setSelectedMarkId(markId); setSelectedIds([]); setPathEditor(null) }
  const openProject = (item: Production) => { stop(); setActiveId(item.id); setSelectedIndex(0); setSelectedIds([]); setSelectedMarkId(null); setMarksUnlocked(false); setPathEditor(null); setTime(0); setMode('rehearsal'); history.current = []; redoHistory.current = []; setView('editor') }
  const deleteProject = (item: Production) => {
    item.music.forEach(clip => { if (clip.fileId) void deleteMusicFile(clip.fileId) })
    setProjects(current => current.filter(project => project.id !== item.id))
    if (activeId === item.id) { stop(); setActiveId(null); setView('library') }
  }
  const createProject = () => {
    if (!newName.trim() || actorCount < 1 || actorCount > 100) { setMessage('请填写剧目名称，并设置 1–100 位演员'); return }
    const item = makeProduction(newName.trim(), Math.floor(actorCount), stageWidth, stageDepth)
    setProjects(previous => [item, ...previous])
    setNewName(''); openProject(item)
  }
  const chooseFirst = (preset: 'backstage' | 'custom') => {
    updateProject(draft => { draft.positions = [makeFirstPosition(draft.actors, preset)] })
    setSelectedIndex(0)
  }
  const addPosition = (copyMode: 'all' | 'blank' | 'actors' | 'props') => {
    if (!project || !position) return
    const placements: Record<string, Placement> = {}
    for (const actor of project.actors) placements[actor.id] = copyMode === 'all' || copyMode === 'actors' ? clone(position.placements[actor.id] ?? { x: 50, y: 50, present: false }) : { x: 50, y: 50, present: false }
    for (const prop of project.props) placements[prop.id] = copyMode === 'all' || copyMode === 'props' ? clone(position.placements[prop.id] ?? { x: 50, y: 50, present: false }) : { x: 50, y: 50, present: false }
    const index = selectedIndex + 1
    const next: Position = { id: id(), name: `站位 ${project.positions.length + 1}`, placements }
    updateProject(draft => { draft.positions.splice(index, 0, next); draft.transitions = reconcileTransitions(draft.positions, draft.transitions) })
    setSelectedIndex(index); setTime(times[selectedIndex]); setPositionMenu(false); setPathEditor(null)
  }
  const deletePosition = (index: number) => {
    if (!project || project.positions.length <= 1) return
    if (!confirm(`删除「${project.positions[index].name}」及相邻转换？`)) return
    updateProject(draft => { draft.positions.splice(index, 1); draft.transitions = reconcileTransitions(draft.positions, draft.transitions) })
    setSelectedIndex(current => Math.min(current, project.positions.length - 2)); stop(); setPathEditor(null)
  }
  const reorderPosition = (from: number, to: number) => {
    if (from === to || !project) return
    updateProject(draft => { const [moved] = draft.positions.splice(from, 1); draft.positions.splice(to, 0, moved); draft.transitions = reconcileTransitions(draft.positions, draft.transitions) })
    setSelectedIndex(to); stop(); setPathEditor(null)
  }
  const moveObject = (objectId: string, point: Point) => {
    updateProject(draft => {
      const current = draft.positions[selectedIndex]
      if (!current) return
      const isSelectedActor = selectedIds.includes(objectId) && draft.actors.some(actor => actor.id === objectId)
      const movingIds = isSelectedActor && selectedIds.length > 1 ? selectedIds.filter(id => draft.actors.some(actor => actor.id === id)) : [objectId]
      const anchor = current.placements[objectId]
      const dx = point.x - (anchor?.x ?? point.x)
      const dy = point.y - (anchor?.y ?? point.y)
      for (const id of movingIds) {
        const placement = current.placements[id] ?? { x: point.x, y: point.y, present: false }
        current.placements[id] = id === objectId
          ? { ...point, present: true }
          : { x: clamp(placement.x + dx, 0, 100), y: clamp(placement.y + dy, 0, 100), present: true }
      }
    })
  }
  const selectPosition = (index: number) => { stop(); setSelectedIndex(index); setSelectedIds([]); setSelectedMarkId(null); setPathEditor(null); setTime(times[index] ?? 0) }
  const addActor = () => { const number = (project?.actors.length ?? 0) + 1; updateProject(draft => { const actor = { id: id(), name: `演员 ${number}`, color: 'burgundy' as ActorColor }; draft.actors.push(actor); draft.positions.forEach(item => { item.placements[actor.id] = { x: 50, y: 50, present: false } }) }) }
  const addProp = (shape: PropShape) => { const number = (project?.props.length ?? 0) + 1; updateProject(draft => { const prop = { id: id(), name: `道具 ${number}`, shape, width: shape === 'circle' ? 1.4 : 2, depth: shape === 'rectangle' ? 1 : 1.4, rotation: 0 }; draft.props.push(prop); draft.positions.forEach((item, index) => { item.placements[prop.id] = { x: 50, y: 50, present: index === selectedIndex } }) }) }
  const deleteObject = (objectId: string) => {
    if (!project || !confirm('删除这个对象及其在所有站位和转换中的数据？')) return
    updateProject(draft => { draft.actors = draft.actors.filter(item => item.id !== objectId); draft.props = draft.props.filter(item => item.id !== objectId); draft.hiddenObjectIds = (draft.hiddenObjectIds ?? []).filter(id => id !== objectId); draft.positions.forEach(item => delete item.placements[objectId]); draft.transitions.forEach(item => delete item.movements[objectId]) })
    setSelectedIds(current => current.filter(id => id !== objectId))
    if (pathEditor?.objectId === objectId) setPathEditor(null)
  }
  const beginMovementEditing = (transitionIndex: number, objectId: string) => {
    stop()
    setMode('rehearsal')
    setSelectedIndex(transitionIndex + 1)
    setSelectedIds([objectId])
    setTime(times[transitionIndex + 1] ?? 0)
    setPathEditor({ transitionIndex, objectId, tool: 'select' })
    setMessage('点击画布上的直线 / 折点或曲线点工具，再点击虚线添加节点')
  }
  const addStageMark = () => {
    const mark: StageMark = { id: id(), name: `参考线 ${project?.stage.marks.length ? project.stage.marks.length + 1 : 1}`, x: 50, y: 50, length: 35, angle: 0, color: '#AA8656', width: 1, dashed: false, visible: true }
    updateProject(draft => { draft.stage.marks.push(mark) })
    setSelectedMarkId(mark.id)
    setMarksUnlocked(true)
  }
  const deleteStageMark = (markId: string) => {
    if (!project || !confirm('删除这个舞台标记？')) return
    updateProject(draft => { draft.stage.marks = draft.stage.marks.filter(mark => mark.id !== markId) })
    setSelectedMarkId(current => current === markId ? null : current)
  }
  const toggleStageMarkVisibility = (markId: string) => updateProject(draft => {
    const mark = draft.stage.marks.find(item => item.id === markId)
    if (mark) mark.visible = mark.visible === false
  })
  const changeStageMark = (markId: string, change: Partial<StageMark>) => updateProject(draft => {
    const mark = draft.stage.marks.find(item => item.id === markId)
    if (mark) Object.assign(mark, change)
  })
  const startPositionDrag = (event: React.PointerEvent, from: number) => {
    if ((event.target as HTMLElement).closest('.thumb-delete')) return
    positionDrag.current = { from, startX: event.clientX, startY: event.clientY, active: false }
    const move = (moveEvent: PointerEvent) => {
      const drag = positionDrag.current
      if (!drag) return
      if (!drag.active && Math.hypot(moveEvent.clientX - drag.startX, moveEvent.clientY - drag.startY) > 6) drag.active = true
      if (drag.active) {
        const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('.position-thumb') as HTMLElement | null
        setDragOverPosition(target ? Number(target.dataset.index) : null)
      }
    }
    const up = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const drag = positionDrag.current
      positionDrag.current = null
      setDragOverPosition(null)
      if (!drag?.active) return
      suppressPositionClick.current = true
      window.setTimeout(() => { suppressPositionClick.current = false }, 0)
      const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest('.position-thumb') as HTMLElement | null
      if (target) reorderPosition(drag.from, Number(target.dataset.index))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
  const startPanelResize = (edge: 'left' | 'right' | 'bottom') => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || window.innerWidth <= 800) return
    event.preventDefault()
    const start = panelSizes
    const originX = event.clientX
    const originY = event.clientY
    const move = (moveEvent: PointerEvent) => {
      setPanelSizes(() => {
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth
        if (edge === 'left') {
          const max = Math.max(160, viewportWidth - (rightCollapsed ? 52 : start.right) - 360)
          return { ...start, left: clamp(start.left + moveEvent.clientX - originX, 160, max) }
        }
        if (edge === 'right') {
          const max = Math.max(180, viewportWidth - (leftCollapsed ? 52 : start.left) - 360)
          return { ...start, right: clamp(start.right - (moveEvent.clientX - originX), 180, max) }
        }
        return { ...start, timeline: clamp(start.timeline - (moveEvent.clientY - originY), 160, Math.max(160, Math.round(window.innerHeight * .72))) }
      })
    }
    const finish = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish, { once: true })
  }
  const commitPath = (nodes: PathNode[]) => {
    if (!pathEditor || !project) return
    const { transitionIndex, objectId } = pathEditor
    const from = project.positions[transitionIndex]?.placements[objectId]
    const to = project.positions[transitionIndex + 1]?.placements[objectId]
    if (!from || !to || (!from.present && !to.present)) return
    updateProject(draft => {
      const transition = draft.transitions[transitionIndex]
      const previous = transition.movements[objectId]
      transition.movements[objectId] = { offset: previous?.offset ?? 0, duration: previous?.duration ?? transition.duration, nodes, path: pathFromNodes(placementPoint(from), nodes, placementPoint(to)) }
    })
  }
  const changeDuration = (index: number, value: number) => {
    if (!Number.isFinite(value) || value < 0.5) return
    updateProject(draft => { const transition = draft.transitions[index]; const longest = Math.max(0.5, ...Object.values(transition.movements).map(m => m.offset + m.duration)); transition.duration = Math.max(value, longest) })
  }
  const changeMovement = (index: number, objectId: string, offset: number, duration: number) => {
    updateProject(draft => { const transition = draft.transitions[index]; const old = transition.movements[objectId]; const nextDuration = clamp(duration, 0.1, transition.duration); const nextOffset = clamp(offset, 0, transition.duration - nextDuration); transition.movements[objectId] = { offset: nextOffset, duration: nextDuration, path: old?.path ?? [], controls: old?.controls, nodes: old?.nodes } })
  }
  const next = () => {
    if (!project || selectedIndex >= project.positions.length - 1) return
    setPathEditor(null)
    if (playing && targetTime.current !== null) { const goal = targetTime.current; stop(); setTime(goal); setSelectedIndex(index => index + 1); return }
    const start = times[selectedIndex]
    setTime(start); targetTime.current = times[selectedIndex + 1]; setPlaying(true)
  }
  const seek = (time: number) => { stop(); setTime(clamp(time, 0, Math.max(totalTime, ...((project?.music ?? []).map(clip => clip.start + clip.duration)), 0))) }
  const musicUpdate = (musicId: string, updates: Partial<MusicClip>) => {
    if (!project) return
    const clip = project.music.find(item => item.id === musicId)
    if (!clip) return
    if (updates.start !== undefined) {
      const start = Math.max(0, updates.start)
      if (project.music.some(item => item.id !== musicId && start < item.start + item.duration && start + clip.duration > item.start)) return
      updates = { ...updates, start }
    }
    updateProject(draft => { const item = draft.music.find(item => item.id === musicId); if (item) Object.assign(item, updates) })
  }
  const uploadMusic = async (files: FileList | null) => {
    if (!files || !project) return
    let nextStart = Math.max(0, ...project.music.map(clip => clip.start + clip.duration))
    for (const file of Array.from(files)) {
      try {
        const duration = await musicDuration(file)
        if (!duration) throw new Error('无法读取音乐时长')
        const fileId = id(), clipId = id()
        await saveMusicFile(fileId, file)
        const start = nextStart
        nextStart += duration
        updateProject(draft => { draft.music.push({ id: clipId, name: file.name.replace(/\.[^.]+$/, ''), start, duration, fileId }) })
        setMusicUrls(current => ({ ...current, [clipId]: URL.createObjectURL(file) }))
      } catch { setMessage(`无法读取「${file.name}」，请换一个音频文件`) }
    }
  }
  const replaceMusic = async (clipId: string, file: File) => {
    const clip = project?.music.find(item => item.id === clipId)
    if (!clip) return
    try {
      const duration = await musicDuration(file)
      if (project?.music.some(item => item.id !== clipId && clip.start < item.start + item.duration && clip.start + duration > item.start)) { setMessage('替换文件会与相邻音乐重叠，请先调整音乐位置'); return }
      const fileId = id(); await saveMusicFile(fileId, file)
      if (clip.fileId) void deleteMusicFile(clip.fileId)
      updateProject(draft => { const target = draft.music.find(item => item.id === clipId); if (target) { target.fileId = fileId; target.duration = duration } })
      setMusicUrls(current => { if (current[clipId]) URL.revokeObjectURL(current[clipId]); return { ...current, [clipId]: URL.createObjectURL(file) } })
    } catch { setMessage('无法读取替换的音频文件') }
  }
  const removeMusic = (clipId: string) => {
    const clip = project?.music.find(item => item.id === clipId)
    if (!clip) return
    updateProject(draft => { draft.music = draft.music.filter(item => item.id !== clipId) })
    if (clip.fileId) void deleteMusicFile(clip.fileId)
    setMusicUrls(current => { if (current[clipId]) URL.revokeObjectURL(current[clipId]); const next = { ...current }; delete next[clipId]; return next })
  }

  const renameObject = (objectId: string, name: string) => updateProject(draft => {
    const object = [...draft.actors, ...draft.props].find(item => item.id === objectId)
    if (object) object.name = name
  })
  const removeFromStage = (objectId: string, side: OffstageSide, y: number) => {
    updateProject(draft => {
      const current = draft.positions[selectedIndex]
      if (!current) return
      const isSelectedActor = selectedIds.includes(objectId) && draft.actors.some(actor => actor.id === objectId)
      const leavingIds = isSelectedActor && selectedIds.length > 1 ? selectedIds : [objectId]
      leavingIds.forEach(id => {
        const placement = current.placements[id]
        if (placement) Object.assign(placement, { x: side === 'left' ? 4 : 96, y, present: false, offstageSide: side })
      })
    })
    if (pathEditor?.objectId === objectId) setPathEditor(null)
  }
  const toggleVisibility = (objectId: string) => updateProject(draft => {
    const hidden = new Set(draft.hiddenObjectIds ?? [])
    if (hidden.has(objectId)) hidden.delete(objectId); else hidden.add(objectId)
    draft.hiddenObjectIds = [...hidden]
  })
  const changeActorColor = (objectId: string, color: ActorColor) => updateProject(draft => {
    const actor = draft.actors.find(item => item.id === objectId)
    if (actor) actor.color = color
  })
  const changeProp = (objectId: string, changes: { shape?: PropShape; width?: number; depth?: number; rotation?: number }) => updateProject(draft => {
    const prop = draft.props.find(item => item.id === objectId)
    if (prop) Object.assign(prop, changes)
  })
  const commitSceneName = () => {
    const name = sceneDraft.trim()
    if (name && name !== project?.sceneName) updateProject(draft => { draft.sceneName = name })
    setSceneEditing(false)
  }

  const visiblePlacements = useMemo(() => project && (playing || mode === 'preview') ? placementAt(project, playhead) : position?.placements ?? {}, [project, playing, mode, playhead, position])
  const selectedPlacement = position?.placements[selectedId ?? '']
  const pathEditorData: PathEditor | null = useMemo(() => {
    if (!project || !pathEditor) return null
    const { transitionIndex, objectId, tool } = pathEditor
    const transition = project.transitions[transitionIndex]
    const from = project.positions[transitionIndex]?.placements[objectId]
    const to = project.positions[transitionIndex + 1]?.placements[objectId]
    if (!transition || !from || !to || (!from.present && !to.present)) return null
    const movement = transition.movements[objectId]
    return { transitionId: transition.id, objectId, from: placementPoint(from), to: placementPoint(to), path: movement?.path ?? [], controls: movement?.controls, nodes: movement?.nodes, tool }
  }, [project, pathEditor])

  if (view === 'opening') return <OpeningExperience onBegin={() => setView('library')} />
  if (view === 'library') return <PlayLibrary projects={projects} onCreate={() => setView('create')} onOpen={openProject} onDelete={deleteProject} />
  if (view === 'create') return <div className="create-page"><header className="simple-header"><button className="icon-button" onClick={() => setView('library')} aria-label="返回"><ArrowLeft size={20} /></button><span>新建剧目</span><div className="brand-symbol small">S<span>·</span>N</div></header><main className="create-main"><div className="create-intro"><span className="kicker">开始排演</span><h1>先搭好你的舞台。</h1><p>只需要剧目名称、演员人数和一个舞台预设。</p></div><div className="setup-layout"><section className="setup-form"><label className="field"><span>剧目名称</span><input autoFocus value={newName} onChange={event => setNewName(event.target.value)} placeholder="例如：春之觉醒" maxLength={60} /></label><label className="field"><span>演员数量</span><input type="number" min="1" max="100" value={actorCount} onChange={event => setActorCount(Number(event.target.value))} /><small>进入编辑页后会自动创建「演员 1」至「演员 {Math.max(1, actorCount)}」</small></label><div className="dimension-row"><label className="field"><span>舞台宽度 · 米</span><input type="number" min="4" max="50" value={stageWidth} onChange={event => setStageWidth(clamp(Number(event.target.value), 4, 50))} /></label><label className="field"><span>舞台深度 · 米</span><input type="number" min="4" max="50" value={stageDepth} onChange={event => setStageDepth(clamp(Number(event.target.value), 4, 50))} /></label></div><button className="primary-button create-submit" onClick={createProject}>创建剧目 <span>→</span></button></section><section className="stage-options"><span className="section-label">选择舞台类型</span><div className="stage-option-grid"><div className="stage-option chosen" aria-label="已选择镜框式舞台"><img src={stageArt.proscenium} alt="镜框式舞台" /><strong>镜框式舞台</strong><small>标准矩形 · 本期可用</small><span className="option-check">✓</span></div><div className="stage-option disabled"><img src={stageArt.arena} alt="环形舞台" /><strong>环形舞台</strong><small>敬请期待</small></div><div className="stage-option disabled custom-option"><div className="custom-stage-art">自定义</div><strong>自定义舞台</strong><small>敬请期待</small></div></div></section></div></main>{message && <div className="toast">{message}</div>}</div>
  if (!project) return null
  return <div className="editor-page">
    <header className="editor-header"><div className="editor-breadcrumb"><button className="icon-button" onClick={() => { stop(); setView('library') }} aria-label="返回剧目列表"><ArrowLeft size={19} /></button><div className="brand-symbol small">S<span>·</span>N</div><span className="breadcrumb-sep">/</span><strong>{project.name}</strong><span className="breadcrumb-sep">/</span>{sceneEditing ? <input className="scene-name-input" autoFocus aria-label="Scene 名称" maxLength={60} value={sceneDraft} onChange={event => setSceneDraft(event.target.value)} onBlur={commitSceneName} onKeyDown={event => { if (event.key === 'Enter') commitSceneName(); if (event.key === 'Escape') setSceneEditing(false) }} /> : <button className="scene-name" onClick={() => { setSceneDraft(project.sceneName); setSceneEditing(true) }} aria-label="修改 Scene 名称">{project.sceneName} <span>✎</span></button>}</div><div className="header-controls"><button className="header-control" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /> 舞台参数</button><div className="mode-switch"><button className={mode === 'rehearsal' ? 'active' : ''} onClick={() => { stop(); setPathEditor(null); setMode('rehearsal') }}>排练模式</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => { stop(); setPathEditor(null); setMarksUnlocked(false); setMode('preview'); setTime(times[selectedIndex] ?? playhead) }}>预演模式</button></div><span className="save-indicator"><span />{saveLabel}</span></div></header>
    <div className={`editor-main ${leftCollapsed ? 'left-collapsed' : ''} ${rightCollapsed ? 'right-collapsed' : ''}`} style={{ '--left-panel-width': `${leftCollapsed ? 52 : panelSizes.left}px`, '--right-panel-width': `${rightCollapsed ? 52 : panelSizes.right}px` } as WorkbenchLayoutStyle}>
      <ObjectSidebar
        production={project} position={position} selectedIds={selectedIds} selectedMarkId={selectedMarkId} collapsed={leftCollapsed}
        editable={mode === 'rehearsal'} onToggle={() => setLeftCollapsed(value => !value)}
        onSelect={selectObject}
        onAddActor={addActor} onAddProp={addProp} onDelete={deleteObject}
        onToggleVisibility={toggleVisibility} onRename={renameObject}
        onSelectMark={selectStageMark} onAddMark={addStageMark} onDeleteMark={deleteStageMark} onToggleMarkVisibility={toggleStageMarkVisibility}
      />
      <main className="stage-workspace">
        {project.positions.length === 0 ? <div className="first-position">
          <span className="kicker">第一个站位</span><h2>从哪里开始？</h2>
          <p>选择演员的起始布局，之后仍可自由调整。</p>
          <div className="preset-cards">
            <button onClick={() => chooseFirst('backstage')}><div className="preset-stage"><i/><i/><i/><i/><i/><i/></div><strong>在幕后</strong><small>演员均分到左右侧台</small></button>
            <button onClick={() => chooseFirst('custom')}><div className="preset-stage custom"><i/><i/><i/></div><strong>自定义</strong><small>从空白舞台开始摆放</small></button>
          </div>
        </div> : <>
          <div className="position-strip">
            <div className="position-strip-label">站位 <span>{project.positions.length}</span></div>
            <button className="strip-scroll-arrow" onClick={() => positionStripRef.current?.scrollBy({ left: -280, behavior: 'smooth' })} aria-label="向左浏览站位"><ChevronLeft size={21} /></button>
            <div className="position-thumbs" ref={positionStripRef}>{project.positions.map((item, index) => <div key={item.id} data-index={index} className={`position-thumb ${selectedIndex === index ? 'active' : ''} ${dragOverPosition === index ? 'drag-target' : ''}`} onPointerDown={event => startPositionDrag(event, index)}>
              <button onClick={() => { if (!suppressPositionClick.current) selectPosition(index) }}><Preview production={project} position={item} small /><span>{item.name}</span></button>
              <button className="thumb-delete" onClick={() => deletePosition(index)} aria-label={`删除 ${item.name}`}><X size={12} /></button>
            </div>)}
              <div className="new-position-wrap">
                <button className="new-position-button" onClick={() => addPosition('all')} title="复制当前状态创建下一个站位"><Plus size={20} /><span>新建</span></button>
                <button className="new-position-more" onClick={() => setPositionMenu(open => !open)} aria-label="其他新建方式"><ChevronDown size={14} /></button>
              </div>
            </div>
            {positionMenu && <div className="position-menu strip-menu"><button onClick={() => addPosition('blank')}>新建空白站位</button><button onClick={() => addPosition('actors')}>仅复制演员</button><button onClick={() => addPosition('props')}>仅复制道具</button></div>}
            <button className="strip-scroll-arrow" onClick={() => positionStripRef.current?.scrollBy({ left: 280, behavior: 'smooth' })} aria-label="向右浏览站位"><ChevronRight size={21} /></button>
            <div className="position-strip-actions">
              <button className="icon-button" title="撤销" onClick={undo} disabled={!history.current.length}><Undo2 size={17} /></button>
              <button className="icon-button" title="重做" onClick={redo} disabled={!redoHistory.current.length}><Redo2 size={17} /></button>
            </div>
          </div>
          <div className="canvas-toolbar">
            <div><span className="position-number">{String(selectedIndex + 1).padStart(2, '0')}</span>
              <input className="position-name-input" aria-label="站位名称" value={position?.name ?? ''} onChange={event => updateProject(draft => { draft.positions[selectedIndex].name = event.target.value })} disabled={mode === 'preview'} />
              <span className="canvas-subtitle">{pathEditor ? '点击画布动线工具，在线上添加节点' : mode === 'preview' ? '预演中' : selectedIds.length > 1 ? `已选择 ${selectedIds.length} 位演员 · 拖动可同步移动` : '拖动对象或从左侧拖入演员'}</span>
            </div>
            <div className="canvas-tools">
              <button className={project.stage.showGrid ? 'active' : ''} onClick={() => updateProject(draft => { draft.stage.showGrid = !draft.stage.showGrid })} title="显示或隐藏网格" aria-label="切换网格"><Grid3X3 size={16} /> 网格</button>
              <button className={project.stage.showMarks !== false ? 'active' : ''} onClick={() => updateProject(draft => { draft.stage.showMarks = draft.stage.showMarks === false })} title="显示或隐藏 Stage Mark" aria-label="切换 Stage Mark"><Eye size={16} /> Stage Mark</button>
              <button className={marksUnlocked ? 'active' : ''} onClick={() => setMarksUnlocked(value => !value)} title={marksUnlocked ? '锁定舞台标记，避免误触' : '解锁舞台标记，允许选中和拖拽'} aria-label={marksUnlocked ? '锁定舞台标记' : '解锁舞台标记'} disabled={mode !== 'rehearsal' || Boolean(pathEditor)}>{marksUnlocked ? <LockOpen size={16} /> : <Lock size={16} />}</button>
            </div>
          </div>
          <StageCanvas production={project} placements={visiblePlacements} selectedIds={selectedIds} selectedMarkId={selectedMarkId} marksUnlocked={marksUnlocked}
            editable={mode === 'rehearsal' && !playing} pathEditor={pathEditorData}
            onSelect={selectObject} onSelectMark={selectStageMark} onMoveMark={(markId, point) => changeStageMark(markId, point)}
            onDragStart={beginObjectDrag} onMove={moveDraggedObjects} onDropObject={(id, point) => { moveObject(id, point); updateProject(draft => { draft.hiddenObjectIds = (draft.hiddenObjectIds ?? []).filter(item => item !== id) }); selectObject(id); if (pathEditor?.objectId !== id) setPathEditor(null) }}
            onExitStage={removeFromStage} onPathCommit={commitPath}
            onPathTool={tool => setPathEditor(current => current && { ...current, tool })} onPathDone={() => setPathEditor(null)}
          />
          <div className={`canvas-bottom-bar ${mode === 'preview' ? 'has-progress' : ''}`}>
            <span><span className="status-light" /> {mode === 'rehearsal' ? '排练编辑' : '自动预演'} <small>Space 快捷播放</small></span>
            <div className="playback-dock">
              <div className="playback-controls">{mode === 'rehearsal' ?
                <button className="next-button" onClick={next} disabled={selectedIndex >= project.positions.length - 1}><SkipForward size={17} /> {playing && targetTime.current !== null ? '直接到位' : 'Next'}</button> :
                <div className="preview-controls"><button onClick={() => { stop(); setTime(0) }} title="从头重播"><RotateCcw size={17} /></button><button className="play-button" onClick={() => setPlaying(current => !current)}>{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? '暂停' : '播放'}</button></div>}
              </div>
              {mode === 'preview' && <div className="playback-progress" role="progressbar" aria-label="播放进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(playhead / playbackTotal * 100)}><span style={{ width: `${clamp(playhead / playbackTotal * 100, 0, 100)}%` }} /></div>}
            </div>
          </div>
        </>}
      </main>
      <Inspector production={project} selectedId={selectedId} selectedMarkId={selectedMarkId} selectedCount={selectedIds.length} placement={selectedPlacement} collapsed={rightCollapsed}
        onToggle={() => setRightCollapsed(value => !value)}
        onSelect={id => selectObject(id)} onSelectMark={selectStageMark} onActorColor={changeActorColor} onPropChange={changeProp} onMarkChange={changeStageMark} />
      {!leftCollapsed && <div className="panel-resizer panel-resizer-left" style={{ left: panelSizes.left - 5 }} role="separator" aria-orientation="vertical" aria-label="调整左侧舞台对象栏宽度" title="拖动调整左栏宽度" onPointerDown={startPanelResize('left')} />}
      {!rightCollapsed && <div className="panel-resizer panel-resizer-right" style={{ right: panelSizes.right - 5 }} role="separator" aria-orientation="vertical" aria-label="调整右侧对象信息栏宽度" title="拖动调整右栏宽度" onPointerDown={startPanelResize('right')} />}
    </div>
    {project.positions.length > 0 && !bottomCollapsed && <div className="timeline-resizer" role="separator" aria-orientation="horizontal" aria-label="调整动线编排高度" title="拖动调整动线编排高度" onPointerDown={startPanelResize('bottom')} />}
    {project.positions.length > 0 && <Timeline production={project} playhead={playhead} selectedPosition={selectedIndex}
      collapsed={bottomCollapsed} onToggle={() => setBottomCollapsed(value => !value)}
      panelHeight={panelSizes.timeline}
      onPosition={selectPosition} onDuration={changeDuration} onMovement={changeMovement} onEditMovement={beginMovementEditing}
      onMusicUpload={uploadMusic} onMusicUpdate={musicUpdate} onMusicDelete={removeMusic} onMusicReplace={replaceMusic} onSeek={seek} />}
    {settingsOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false) }}><div className="settings-modal"><div className="modal-title"><div><span className="kicker">项目基础参数</span><h2>舞台参数</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={20} /></button></div><div className="dimension-row"><label className="field"><span>宽度 · 米</span><input type="number" min="4" max="50" value={project.stage.width} onChange={event => updateProject(draft => { draft.stage.width = clamp(Number(event.target.value), 4, 50) })} /></label><label className="field"><span>深度 · 米</span><input type="number" min="4" max="50" value={project.stage.depth} onChange={event => updateProject(draft => { draft.stage.depth = clamp(Number(event.target.value), 4, 50) })} /></label></div><label className="field"><span>网格密度 · 米</span><select value={project.stage.grid} onChange={event => updateProject(draft => { draft.stage.grid = Number(event.target.value) })}><option value="0.5">0.5 m</option><option value="1">1 m</option><option value="2">2 m</option></select></label><button className="primary-button modal-close" onClick={() => setSettingsOpen(false)}>完成</button></div></div>}
    {message && <div className="toast">{message}</div>}
  </div>
}
