import folder from '../ui/playbill/票夹.png'
import ticket from '../ui/playbill/票根.png'
import playbillBackground from '../ui/playbill/background.png'
import proscenium from '../ui/stagetype/镜框式.png'
import arena from '../ui/stagetype/环形.png'
import burgundy from '../ui/actor/vintage/burgundy.svg'
import burgundySelected from '../ui/actor/vintage/burgundy-selected.svg'
import ochre from '../ui/actor/vintage/ochre.svg'
import ochreSelected from '../ui/actor/vintage/ochre-selected.svg'
import sage from '../ui/actor/vintage/sage.svg'
import sageSelected from '../ui/actor/vintage/sage-selected.svg'
import slate from '../ui/actor/vintage/slate.svg'
import slateSelected from '../ui/actor/vintage/slate-selected.svg'
import plum from '../ui/actor/vintage/plum.svg'
import plumSelected from '../ui/actor/vintage/plum-selected.svg'
import openCurtainFallback from '../ui/opening animation/幕布完全展开.png'

const curtainFrameModules = import.meta.glob<string>(
  '../ui/opening animation/幕布拉开定格动画_关键帧_加密版/*.jpg',
  { eager: true, query: '?url', import: 'default' },
)
const rootCurtainFrameModules = import.meta.glob<string>(
  '../ui/opening animation/*.jpg',
  { eager: true, query: '?url', import: 'default' },
)

const curtainFrames = (Object.keys(curtainFrameModules).length
  ? Object.entries(curtainFrameModules)
  : Object.entries(rootCurtainFrameModules).filter(([path]) => /\/(\d+|幕布拉开定格动画2)\.jpg$/i.test(path)))
  .sort(([left], [right]) => {
    if (left.includes('最终态')) return 1
    if (right.includes('最终态')) return -1
    const number = (path: string) => path.includes('幕布拉开定格动画2') ? 2 : Number(path.match(/(\d+)\.jpg$/)?.[1] ?? 0)
    return number(left) - number(right)
  })
  .map(([, source]) => source)
if (!Object.keys(curtainFrameModules).length) curtainFrames.push(openCurtainFallback)

export const curtainArt = { frames: curtainFrames }
export const playbillArt = { folder, ticket, background: playbillBackground }
export const actorColors = {
  burgundy: '#8F302D',
  ochre: '#A27439',
  sage: '#62745B',
  slate: '#667589',
  plum: '#765767',
} as const
export const stageArt = { proscenium, arena }
export const actorArt = {
  burgundy: { normal: burgundy, selected: burgundySelected },
  ochre: { normal: ochre, selected: ochreSelected },
  sage: { normal: sage, selected: sageSelected },
  slate: { normal: slate, selected: slateSelected },
  plum: { normal: plum, selected: plumSelected },
}
