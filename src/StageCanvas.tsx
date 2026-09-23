import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, CornerDownRight, MousePointer2, Spline } from 'lucide-react'
import { actorArt } from './assets'
import { bezierPoint, clamp, id, pathFromNodes, type OffstageSide, type PathNode, type Placement, type Point, type Production } from './model'

export type PathTool = 'select' | 'corner' | 'smooth'
const OFFSTAGE_ZONE_WIDTH = 7.5
export type PathEditor = {
  transitionId: string
  objectId: string
  from: Point
  to: Point
  path: Point[]
  controls?: [Point, Point]
  nodes?: PathNode[]
  tool: PathTool
}

type Props = {
  production: Production
  placements: Record<string, Placement>
  selectedIds: string[]
  selectedMarkId: string | null
  marksUnlocked: boolean
  editable: boolean
  pathEditor: PathEditor | null
  onSelect: (id: string | null, additive?: boolean) => void
  onSelectMark: (id: string) => void
  onMoveMark: (id: string, point: Point) => void
  onDragStart: () => void
  onMove: (points: Record<string, Point>) => void
  onDropObject: (id: string, point: Point) => void
  onExitStage: (id: string, side: OffstageSide, y: number) => void
  onPathCommit: (nodes: PathNode[]) => void
  onPathTool: (tool: PathTool) => void
  onPathDone: () => void
}

function initialNodes(editor: PathEditor): PathNode[] {
  if (editor.nodes) return structuredClone(editor.nodes)
  if (editor.controls) {
    const point = bezierPoint(editor.from, editor.controls[0], editor.controls[1], editor.to, .5)
    return [{ ...point, id: id(), kind: 'smooth', in: editor.controls[0], out: editor.controls[1] }]
  }
  if (editor.path.length) return editor.path.filter((_, i) => i % Math.max(1, Math.floor(editor.path.length / 6)) === 0).map(point => ({ ...point, id: id(), kind: 'corner' }))
  return []
}

function nearestSegment(start: Point, nodes: PathNode[], end: Point, point: Point): number {
  const anchors: (Point & { in?: Point; out?: Point })[] = [start, ...nodes, end]
  let nearest = 0
  let best = Infinity
  for (let index = 0; index < anchors.length - 1; index++) {
    const a = anchors[index], b = anchors[index + 1]
    const sampled = a.out || b.in
      ? Array.from({ length: 17 }, (_, step) => bezierPoint(a, a.out ?? a, b.in ?? b, b, step / 16))
      : [a, b]
    for (let step = 0; step < sampled.length - 1; step++) {
      const p = sampled[step], q = sampled[step + 1]
      const dx = q.x - p.x, dy = q.y - p.y
      const t = clamp(((point.x - p.x) * dx + (point.y - p.y) * dy) / Math.max(.001, dx * dx + dy * dy), 0, 1)
      const distance = Math.hypot(point.x - (p.x + dx * t), point.y - (p.y + dy * t))
      if (distance < best) { best = distance; nearest = index }
    }
  }
  return nearest
}

export default function StageCanvas({ production, placements, selectedIds, selectedMarkId, marksUnlocked, editable, pathEditor, onSelect, onSelectMark, onMoveMark, onDragStart, onMove, onDropObject, onExitStage, onPathCommit, onPathTool, onPathDone }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; pointer: number; startX: number; startY: number; origins: Record<string, Point>; active: boolean } | null>(null)
  const nodeDrag = useRef<{ id: string; pointer: number; part: 'anchor' | 'in' | 'out' } | null>(null)
  const markDrag = useRef<{ id: string; pointer: number; startX: number; startY: number; active: boolean } | null>(null)
  const nodesRef = useRef<PathNode[]>([])
  const [nodes, setNodes] = useState<PathNode[]>([])
  const [outsideDrag, setOutsideDrag] = useState(false)
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null)
  const editorKey = pathEditor ? `${pathEditor.transitionId}:${pathEditor.objectId}` : ''

  useEffect(() => {
    const next = pathEditor ? initialNodes(pathEditor) : []
    nodesRef.current = next
    setNodes(next)
  }, [editorKey, pathEditor?.nodes, pathEditor?.controls])

  const pointFromEvent = (event: { clientX: number; clientY: number }): Point => {
    const box = ref.current!.getBoundingClientRect()
    return { x: clamp((event.clientX - box.left) / box.width * 100, 0, 100), y: clamp((event.clientY - box.top) / box.height * 100, 0, 100) }
  }
  const offstageSideAt = (event: { clientX: number; clientY: number }): OffstageSide | null => {
    const box = ref.current?.getBoundingClientRect()
    if (!box || event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return null
    const point = pointFromEvent(event)
    if (point.x <= OFFSTAGE_ZONE_WIDTH) return 'left'
    if (point.x >= 100 - OFFSTAGE_ZONE_WIDTH) return 'right'
    return null
  }
  const updateNodes = (next: PathNode[]) => { nodesRef.current = next; setNodes(next) }
  const pointerMove = (event: React.PointerEvent) => {
    if (drag.current?.pointer === event.pointerId) {
      const movement = drag.current
      if (!movement.active && Math.hypot(event.clientX - movement.startX, event.clientY - movement.startY) < 3) return
      if (!movement.active) { movement.active = true; onDragStart() }
      const offstageSide = offstageSideAt(event)
      setOutsideDrag(Boolean(offstageSide))
      if (!offstageSide && ref.current) {
        const bounds = ref.current.getBoundingClientRect()
        const origins = Object.values(movement.origins)
        const dx = clamp((event.clientX - movement.startX) / bounds.width * 100, -Math.min(...origins.map(point => point.x)), 100 - Math.max(...origins.map(point => point.x)))
        const dy = clamp((event.clientY - movement.startY) / bounds.height * 100, -Math.min(...origins.map(point => point.y)), 100 - Math.max(...origins.map(point => point.y)))
        onMove(Object.fromEntries(Object.entries(movement.origins).map(([objectId, origin]) => [objectId, { x: origin.x + dx, y: origin.y + dy }])))
      }
      return
    }
    const point = pointFromEvent(event)
    setHoverPoint(point)
    if (nodeDrag.current?.pointer === event.pointerId) {
      const { id: nodeId, part } = nodeDrag.current
      updateNodes(nodesRef.current.map(node => {
        if (node.id !== nodeId) return node
        if (part === 'anchor') {
          const dx = point.x - node.x, dy = point.y - node.y
          return { ...node, ...point, in: node.in && { x: clamp(node.in.x + dx, 0, 100), y: clamp(node.in.y + dy, 0, 100) }, out: node.out && { x: clamp(node.out.x + dx, 0, 100), y: clamp(node.out.y + dy, 0, 100) } }
        }
        const opposite = { x: clamp(node.x * 2 - point.x, 0, 100), y: clamp(node.y * 2 - point.y, 0, 100) }
        return part === 'in' ? { ...node, in: point, out: opposite } : { ...node, in: opposite, out: point }
      }))
    }
  }
  const pointerUp = (event: React.PointerEvent) => {
    if (drag.current?.pointer === event.pointerId) {
      const offstageSide = drag.current.active ? offstageSideAt(event) : null
      if (offstageSide) {
        const box = ref.current?.getBoundingClientRect()
        const y = box ? clamp((event.clientY - box.top) / box.height * 100, 8, 92) : 50
        onExitStage(drag.current.id, offstageSide, y)
      }
      drag.current = null
      setOutsideDrag(false)
    }
    if (nodeDrag.current?.pointer === event.pointerId) {
      nodeDrag.current = null
      onPathCommit(nodesRef.current)
    }
    if (ref.current?.hasPointerCapture(event.pointerId)) ref.current.releasePointerCapture(event.pointerId)
  }
  const objectPointerDown = (event: React.PointerEvent, objectId: string) => {
    event.stopPropagation()
    const additive = event.ctrlKey || event.metaKey || event.shiftKey
    onSelect(objectId, additive)
    if (!editable || pathEditor) return
    const isActor = production.actors.some(actor => actor.id === objectId)
    const groupIds = isActor && selectedIds.includes(objectId) && selectedIds.length > 1
      ? selectedIds
      : additive && isActor && !selectedIds.includes(objectId)
        ? [...selectedIds, objectId]
        : [objectId]
    const origins = Object.fromEntries(groupIds.filter(id => placements[id]?.present).map(id => [id, { x: placements[id].x, y: placements[id].y }]))
    drag.current = { id: objectId, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, origins, active: false }
    ref.current?.setPointerCapture(event.pointerId)
  }
  const markPointerDown = (event: React.PointerEvent, markId: string) => {
    event.stopPropagation()
    if (!editable || !marksUnlocked || pathEditor) return
    const mark = production.stage.marks.find(item => item.id === markId)
    if (!mark) return
    onSelectMark(markId)
    markDrag.current = { id: markId, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, active: false }
    const move = (moveEvent: PointerEvent) => {
      const movement = markDrag.current
      if (!movement || movement.pointer !== moveEvent.pointerId) return
      if (!movement.active && Math.hypot(moveEvent.clientX - movement.startX, moveEvent.clientY - movement.startY) < 3) return
      movement.active = true
      onMoveMark(movement.id, pointFromEvent(moveEvent))
    }
    const up = (upEvent: PointerEvent) => {
      const movement = markDrag.current
      if (movement?.pointer === upEvent.pointerId && movement.active) onMoveMark(movement.id, pointFromEvent(upEvent))
      markDrag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
  const startNodeDrag = (event: React.PointerEvent, nodeId: string, part: 'anchor' | 'in' | 'out') => {
    event.stopPropagation()
    if (!editable || !pathEditor) return
    nodeDrag.current = { id: nodeId, pointer: event.pointerId, part }
    ref.current?.setPointerCapture(event.pointerId)
  }
  const insertNode = (event: React.PointerEvent<SVGPolylineElement>) => {
    if (!pathEditor || pathEditor.tool === 'select') return
    event.stopPropagation()
    const point = pointFromEvent(event)
    const index = nearestSegment(pathEditor.from, nodesRef.current, pathEditor.to, point)
    const anchors = [pathEditor.from, ...nodesRef.current, pathEditor.to]
    const a = anchors[index], b = anchors[index + 1]
    const dx = (b.x - a.x) / 5, dy = (b.y - a.y) / 5
    const node: PathNode = { ...point, id: id(), kind: pathEditor.tool, ...(pathEditor.tool === 'smooth' ? { in: { x: clamp(point.x - dx, 0, 100), y: clamp(point.y - dy, 0, 100) }, out: { x: clamp(point.x + dx, 0, 100), y: clamp(point.y + dy, 0, 100) } } : {}) }
    const next = [...nodesRef.current]
    next.splice(index, 0, node)
    updateNodes(next)
    onPathCommit(next)
  }
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    if (!editable) return
    const objectId = event.dataTransfer.getData('application/x-stage-object') || event.dataTransfer.getData('text/plain')
    if (!objectId || ![...production.actors, ...production.props].some(object => object.id === objectId)) return
    onDropObject(objectId, pointFromEvent(event))
    setHoverPoint(null)
  }
  const grid = production.stage.showGrid ? `${Math.max(2, 100 / production.stage.width * production.stage.grid)}% ${Math.max(2, 100 / production.stage.depth * production.stage.grid)}%` : undefined
  const ticks = Array.from({ length: Math.floor(production.stage.depth) + 1 }, (_, meter) => meter)
  const pathPoints = pathEditor ? [pathEditor.from, ...pathFromNodes(pathEditor.from, nodes, pathEditor.to), pathEditor.to] : []
  const xMeters = hoverPoint ? hoverPoint.x / 100 * production.stage.width - production.stage.width / 2 : 0
  const yMeters = hoverPoint ? (100 - hoverPoint.y) / 100 * production.stage.depth : 0
  const hidden = new Set(production.hiddenObjectIds ?? [])

  return <div className="stage-shell">
    {pathEditor && <div className="path-toolbox" role="toolbar" aria-label="动线绘制工具" onPointerDown={event => event.stopPropagation()}>
      <span>动线工具</span>
      <button type="button" className={pathEditor.tool === 'select' ? 'active' : ''} onClick={event => { event.stopPropagation(); onPathTool('select') }} title="选择并拖动已有点"><MousePointer2 size={15} /> 选择</button>
      <button type="button" className={pathEditor.tool === 'corner' ? 'active' : ''} onClick={event => { event.stopPropagation(); onPathTool('corner') }} title="点击动线添加直线或折点"><CornerDownRight size={15} /> 直线 / 折点</button>
      <button type="button" className={pathEditor.tool === 'smooth' ? 'active' : ''} onClick={event => { event.stopPropagation(); onPathTool('smooth') }} title="点击动线添加贝塞尔曲线点"><Spline size={15} /> 曲线点</button>
      <button type="button" className="path-done" onClick={event => { event.stopPropagation(); onPathDone() }}><Check size={15} /> 完成编辑</button>
    </div>}
    <div className="stage-direction top">后台 <span>UPSTAGE</span></div>
    <div className="stage-outer" style={{ aspectRatio: `${production.stage.width} / ${production.stage.depth}` } as CSSProperties} onPointerLeave={() => setHoverPoint(null)}>
      <span className="stage-frame-corner top-left" aria-hidden="true" /><span className="stage-frame-corner top-right" aria-hidden="true" /><span className="stage-frame-corner bottom-left" aria-hidden="true" /><span className="stage-frame-corner bottom-right" aria-hidden="true" /><span className="stage-frame-jewel top" aria-hidden="true" /><span className="stage-frame-jewel bottom" aria-hidden="true" />
      {(['left', 'right'] as const).map(side => <div key={side} className={`stage-ruler ${side}`} onPointerMove={event => setHoverPoint(pointFromEvent(event))} aria-label={`${side === 'left' ? '左' : '右'}侧舞台标尺`}>
        {ticks.map(meter => <span key={meter} className={meter % 2 === 0 ? 'major' : ''} style={{ top: `${clamp((1 - meter / production.stage.depth) * 100, 1, 99)}%` }}><i />{meter % 2 === 0 && <em>{meter}</em>}</span>)}
      </div>)}
      <div ref={ref} className={`stage-canvas ${production.stage.showGrid ? '' : 'grid-hidden'}`} style={{ backgroundSize: grid }}
        onPointerDown={event => { if (editable && event.target === ref.current) onSelect(null) }}
        onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
        onDragOver={event => { if (editable) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }} onDrop={handleDrop} aria-label="舞台画布">
        <div className="side-wing left-wing" aria-label="左侧下场区域"><span>下场</span></div><div className="side-wing right-wing" aria-label="右侧下场区域"><span>下场</span></div>
        <div className="stage-centerline" />
        {production.stage.showMarks !== false && <><div className="stage-zone-label upstage">US · 后台</div><div className="stage-zone-label centerstage">CS · 中台</div><div className="stage-zone-label downstage">DS · 前台</div></>}
        <div className="stage-tick tick-top" /><div className="stage-tick tick-bottom" /><div className="stage-tick tick-left" /><div className="stage-tick tick-right" />
        {production.stage.showMarks !== false && production.stage.marks.filter(mark => mark.visible !== false).map(mark => <button key={mark.id} type="button" className={`stage-mark ${marksUnlocked ? 'is-editable' : ''} ${selectedMarkId === mark.id ? 'selected' : ''}`} style={{ left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.length}%`, transform: `translate(-50%, -50%) rotate(${mark.angle}deg)`, borderTop: `${mark.width}px ${mark.dashed ? 'dashed' : 'solid'} ${mark.color}` }} onPointerDown={event => markPointerDown(event, mark.id)} aria-label={`舞台标记 ${mark.name}`} title={marksUnlocked ? '拖拽调整位置' : '解锁舞台标记后可编辑'}><span>{mark.name}</span></button>)}
        {pathEditor && <svg className="stage-path-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="当前动线轨迹">
          {nodes.filter(node => node.kind === 'smooth').map(node => <g key={node.id}><line x1={node.x} y1={node.y} x2={node.in?.x} y2={node.in?.y} className="curve-guide" /><line x1={node.x} y1={node.y} x2={node.out?.x} y2={node.out?.y} className="curve-guide" /></g>)}
          <polyline points={pathPoints.map(point => `${point.x},${point.y}`).join(' ')} className="curve-preview" />
          <polyline points={pathPoints.map(point => `${point.x},${point.y}`).join(' ')} className={`path-hitline ${pathEditor.tool}`} onPointerDown={insertNode} aria-label="点击动线添加控制点" />
        </svg>}
        {pathEditor && <><span className="curve-endpoint" style={{ left: `${pathEditor.from.x}%`, top: `${pathEditor.from.y}%` }} /><span className="curve-endpoint" style={{ left: `${pathEditor.to.x}%`, top: `${pathEditor.to.y}%` }} /></>}
        {pathEditor && nodes.map((node, index) => <div key={node.id}>
          <button className={`path-anchor ${node.kind}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onPointerDown={event => startNodeDrag(event, node.id, 'anchor')} aria-label={`动线节点 ${index + 1}`} title="拖动节点调整动线">{index + 1}</button>
          {node.kind === 'smooth' && (['in', 'out'] as const).map(part => node[part] && <button key={part} className="curve-handle" style={{ left: `${node[part]!.x}%`, top: `${node[part]!.y}%` }} onPointerDown={event => startNodeDrag(event, node.id, part)} aria-label={`节点 ${index + 1} ${part === 'in' ? '入' : '出'}曲线手柄`} />)}
        </div>)}
        {production.props.map(prop => {
          const placement = placements[prop.id]
          if (!placement?.present || hidden.has(prop.id)) return null
          return <button key={prop.id} type="button" className={`stage-prop ${prop.shape} ${selectedIds.includes(prop.id) ? 'selected' : ''}`} style={{ left: `${placement.x}%`, top: `${placement.y}%`, width: `${Math.max(4, prop.width / production.stage.width * 100)}%`, height: `${Math.max(4, (prop.shape === 'circle' ? prop.width : prop.depth) / production.stage.depth * 100)}%`, transform: `translate(-50%, -50%) rotate(${prop.rotation}deg)` }} onPointerDown={event => objectPointerDown(event, prop.id)} aria-label={prop.name}><span>{prop.name}</span></button>
        })}
        {production.actors.map((actor, index) => {
          const placement = placements[actor.id]
          if (!placement?.present || hidden.has(actor.id)) return null
          const selected = selectedIds.includes(actor.id)
          return <button key={actor.id} type="button" className={`stage-actor ${selected ? 'selected' : ''}`} style={{ left: `${placement.x}%`, top: `${placement.y}%` }} onPointerDown={event => objectPointerDown(event, actor.id)} aria-label={`${actor.name}，${selected ? '已选中' : '未选中'}`}><img src={actorArt[actor.color][selected ? 'selected' : 'normal']} alt="" draggable={false} /><strong>{index + 1}</strong><small>{actor.name}</small></button>
        })}
        {outsideDrag && <div className="stage-exit-overlay" aria-label="松手下场"><span>松手下场</span><small>松手后该对象将进入侧台</small></div>}
        {hoverPoint && !outsideDrag && <><div className="stage-hover-v" style={{ left: `${hoverPoint.x}%` }} /><div className="stage-hover-h" style={{ top: `${hoverPoint.y}%` }} /><div className="stage-coordinate-tooltip" style={{ left: `${clamp(hoverPoint.x, 14, 78)}%`, top: `${clamp(hoverPoint.y, 8, 88)}%` }}>X {xMeters.toFixed(1)}m · Y {yMeters.toFixed(1)}m</div></>}
      </div>
    </div>
    <div className="stage-direction bottom">观众 <span>AUDIENCE</span></div>
  </div>
}
