export type Point = { x: number; y: number }
export type ActorColor = 'burgundy' | 'ochre' | 'sage' | 'slate' | 'plum'
export type Actor = { id: string; name: string; color: ActorColor }
export type PropShape = 'rectangle' | 'circle' | 'ellipse'
export type Prop = { id: string; name: string; shape: PropShape; width: number; depth: number; rotation: number }
export type OffstageSide = 'left' | 'right'
export type Placement = Point & { present: boolean; offstageSide?: OffstageSide }
export type Position = { id: string; name: string; placements: Record<string, Placement> }
export type PathNode = Point & { id: string; kind: 'corner' | 'smooth'; in?: Point; out?: Point }
export type Movement = { offset: number; duration: number; path: Point[]; controls?: [Point, Point]; nodes?: PathNode[] }
export type Transition = { id: string; from: string; to: string; duration: number; movements: Record<string, Movement> }
export type StageMark = { id: string; name: string; x: number; y: number; length: number; angle: number; color: string; width: number; dashed: boolean; visible?: boolean; preset?: boolean }
export type MusicClip = { id: string; name: string; start: number; duration: number; fileId?: string }
export type Production = {
  id: string
  name: string
  sceneName: string
  stage: { width: number; depth: number; grid: number; showGrid: boolean; showMarks?: boolean; marks: StageMark[]; marksInitialized?: boolean }
  actors: Actor[]
  props: Prop[]
  hiddenObjectIds?: string[]
  positions: Position[]
  transitions: Transition[]
  music: MusicClip[]
  updatedAt: number
}

export const id = () => crypto.randomUUID()
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
export const clone = <T,>(value: T): T => structuredClone(value)

export function makeDefaultStageMarks(): StageMark[] {
  return [
    ['天幕', 9], ['三道幕', 24], ['二道幕', 39], ['一道幕', 56], ['大幕', 83],
  ].map(([name, y]) => ({ id: id(), name: String(name), x: 50, y: Number(y), length: 76, angle: 0, color: '#AA8656', width: 1, dashed: false, visible: true, preset: true }))
}

/** Migrates legacy productions that rendered preset marks without persisting them. */
export function normaliseStageMarks(stage: Production['stage']): Production['stage'] {
  const marks = (stage.marks ?? []).map(mark => ({ ...mark, visible: mark.visible !== false }))
  return { ...stage, marks: stage.marksInitialized ? marks : [...makeDefaultStageMarks(), ...marks], marksInitialized: true }
}

/** Maps an offstage placement to the centre of its visible side-stage zone. */
export function placementPoint(placement: Placement): Point {
  if (placement.present) return placement
  return {
    x: placement.offstageSide === 'right' ? 96 : 4,
    y: clamp(placement.y, 8, 92),
  }
}

export function bezierPoint(start: Point, first: Point, second: Point, end: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * u * start.x + 3 * u * u * t * first.x + 3 * u * t * t * second.x + t * t * t * end.x,
    y: u * u * u * start.y + 3 * u * u * t * first.y + 3 * u * t * t * second.y + t * t * t * end.y,
  }
}

export function bezierPath(start: Point, first: Point, second: Point, end: Point): Point[] {
  return Array.from({ length: 48 }, (_, index) => bezierPoint(start, first, second, end, (index + 1) / 49))
}

export function pathFromNodes(start: Point, nodes: PathNode[], end: Point): Point[] {
  const anchors: (Point & { in?: Point; out?: Point })[] = [start, ...nodes, end]
  const path: Point[] = []
  for (let index = 0; index < anchors.length - 1; index++) {
    const a = anchors[index], b = anchors[index + 1]
    const curved = Boolean(a.out || b.in)
    if (curved) {
      const first = a.out ?? a
      const second = b.in ?? b
      for (let step = 1; step <= 16; step++) path.push(bezierPoint(a, first, second, b, step / 16))
    } else path.push(b)
  }
  path.pop()
  return path
}

export function makeTransition(from: string, to: string, duration = 5): Transition {
  return { id: id(), from, to, duration, movements: {} }
}

export function makeProduction(name: string, actorCount: number, width: number, depth: number): Production {
  const actors: Actor[] = Array.from({ length: actorCount }, (_, i) => ({
    id: id(), name: `演员 ${i + 1}`, color: 'burgundy',
  }))
  return {
    id: id(), name, sceneName: 'Scene 1',
    stage: { width, depth, grid: 1, showGrid: true, marks: makeDefaultStageMarks(), marksInitialized: true },
    actors, props: [], hiddenObjectIds: [], positions: [], transitions: [], music: [], updatedAt: Date.now(),
  }
}

export function makeFirstPosition(actors: Actor[], preset: 'backstage' | 'custom'): Position {
  const placements: Record<string, Placement> = {}
  actors.forEach((actor, index) => {
    const left = index % 2 === 0
    const sideCount = Math.ceil(actors.length / 2)
    const row = Math.floor(index / 2)
    placements[actor.id] = preset === 'backstage'
      ? { x: left ? 5 : 95, y: 20 + (row + 0.5) * 60 / sideCount, present: true }
      : { x: 50, y: 50, present: false }
  })
  return { id: id(), name: '站位 1', placements }
}

export function reconcileTransitions(positions: Position[], previous: Transition[]): Transition[] {
  return positions.slice(1).map((position, index) => {
    const from = positions[index].id
    return previous.find(t => t.from === from && t.to === position.id) ?? makeTransition(from, position.id)
  })
}

export function positionTimes(production: Production): number[] {
  const times = [0]
  for (const transition of production.transitions) times.push(times[times.length - 1] + transition.duration)
  return times
}

function onPath(path: Point[], t: number): Point {
  if (path.length === 0) return { x: 50, y: 50 }
  if (path.length === 1) return path[0]
  const lengths = path.slice(1).map((point, i) => Math.hypot(point.x - path[i].x, point.y - path[i].y))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  if (total === 0) return path[path.length - 1]
  let target = clamp(t, 0, 1) * total
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i]) {
      const f = lengths[i] ? target / lengths[i] : 0
      return { x: path[i].x + (path[i + 1].x - path[i].x) * f, y: path[i].y + (path[i + 1].y - path[i].y) * f }
    }
    target -= lengths[i]
  }
  return path[path.length - 1]
}

export function placementAt(production: Production, time: number): Record<string, Placement> {
  if (!production.positions.length) return {}
  const times = positionTimes(production)
  let index = 0
  while (index < production.transitions.length && time >= times[index + 1]) index++
  if (index >= production.transitions.length) return production.positions.at(-1)!.placements
  const from = production.positions[index]
  const to = production.positions[index + 1]
  const transition = production.transitions[index]
  const local = clamp(time - times[index], 0, transition.duration)
  const ids = new Set([...Object.keys(from.placements), ...Object.keys(to.placements)])
  const output: Record<string, Placement> = {}
  ids.forEach(objectId => {
    const a = from.placements[objectId]
    const b = to.placements[objectId]
    if (!a?.present && !b?.present) return
    if (!a || !b) return
    const movement = transition.movements[objectId]
    const offset = movement?.offset ?? 0
    const duration = movement?.duration ?? transition.duration
    const f = clamp((local - offset) / Math.max(0.01, duration), 0, 1)
    const start = placementPoint(a)
    const end = placementPoint(b)
    const path = movement?.nodes ? pathFromNodes(start, movement.nodes, end) : movement?.controls ? bezierPath(start, movement.controls[0], movement.controls[1], end) : movement?.path ?? []
    const point = path.length ? onPath([start, ...path, end], f) : { x: start.x + (end.x - start.x) * f, y: start.y + (end.y - start.y) * f }
    output[objectId] = { ...point, present: local < transition.duration || b.present }
  })
  return output
}
