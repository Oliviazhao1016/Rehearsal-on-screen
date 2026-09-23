import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { actorColors, curtainArt, playbillArt } from './assets'
import type { Production } from './model'

export function OpeningExperience({ onBegin }: { onBegin: () => void }) {
  const [phase, setPhase] = useState<'playing' | 'landing' | 'guide'>('playing')
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    curtainArt.frames.forEach(src => { const image = new Image(); image.src = src })
    let current = 0
    const timer = window.setInterval(() => {
      current += 1
      if (current < curtainArt.frames.length) setFrame(current)
      else { window.clearInterval(timer); setPhase('landing') }
    }, 160)
    return () => window.clearInterval(timer)
  }, [])

  if (phase === 'guide') return (
    <main className="guidebook-page">
      <button className="guidebook-back" onClick={() => setPhase('landing')}><ArrowLeft size={18} /> Back to stage</button>
      <div className="guidebook-content">
        <span className="guidebook-kicker">GUIDEBOOK</span>
        <h1>From a blank stage<br />to a moving scene.</h1>
        <div className="guidebook-steps">
          <article><span>01</span><h2>Create a play</h2><p>为剧目命名，设定演员人数与舞台尺寸。</p></article>
          <article><span>02</span><h2>设置站位</h2><p>拖动演员和道具，保存每一个整体站位。</p></article>
          <article><span>03</span><h2>Shape transitions</h2><p>在动线编排中调整走位时间，并编辑动线曲线。</p></article>
          <article><span>04</span><h2>Rehearse & preview</h2><p>用 Next 现场排练，或自动播放整场预演。</p></article>
        </div>
        <button className="guidebook-cta" onClick={onBegin}>Begin to Craft <ArrowRight size={18} /></button>
      </div>
    </main>
  )

  return (
    <main className={`curtain-entry phase-${phase}`}>
      <img className="curtain-media" src={curtainArt.frames[frame]} alt={frame === 0 ? '合上的剧场幕布' : '逐帧展开的剧场幕布'} />
      {phase === 'landing' && <><div className="curtain-landing"><span className="curtain-eyebrow">STAGE NOTES</span><h1>Start to Craft<br />a Great Stage Play</h1><div className="curtain-actions"><button className="deco-link" onClick={onBegin}><span className="deco-wing" aria-hidden="true" /><span>Begin to Craft</span><span className="deco-wing" aria-hidden="true" /></button><button className="deco-link" onClick={() => setPhase('guide')}><span className="deco-wing" aria-hidden="true" /><span>Guidebook</span><span className="deco-wing" aria-hidden="true" /></button></div></div><footer className="curtain-credit">Created by SiriZhao, a crazy musical fan.</footer></>}
    </main>
  )
}

function TicketPreview({ production }: { production: Production }) {
  const first = production.positions[0]
  return <div className="ticket-preview" aria-hidden="true">
    {production.actors.map(actor => {
      const place = first?.placements[actor.id]
      return place?.present && !production.hiddenObjectIds?.includes(actor.id) ? <span key={actor.id} className="ticket-actor" style={{ left: `${place.x}%`, top: `${place.y}%`, backgroundColor: actorColors[actor.color] }} /> : null
    })}
  </div>
}

export function PlayLibrary({ projects, onCreate, onOpen, onDelete }: { projects: Production[]; onCreate: () => void; onOpen: (project: Production) => void; onDelete: (project: Production) => void }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(() => window.innerWidth <= 900 ? 1 : 2)
  useEffect(() => {
    const resize = () => setPageSize(window.innerWidth <= 900 ? 1 : 2)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const allTickets = [...projects, null]
  const pageCount = Math.ceil(allTickets.length / pageSize)
  const currentPage = Math.min(page, pageCount - 1)
  const tickets = allTickets.slice(currentPage * pageSize, currentPage * pageSize + pageSize)
  const requestDelete = (project: Production) => {
    if (!window.confirm(`删除「${project.name}」？此操作会同时删除该剧目的站位、动线和音乐。`)) return
    setDeletingId(project.id)
    setOpen(false)
    window.setTimeout(() => {
      onDelete(project)
      setDeletingId(current => current === project.id ? null : current)
    }, 760)
  }
  return <main className="play-library" style={{ '--playbill-background': `url(${playbillArt.background})` } as CSSProperties}>
    <header className="play-library-header"><div><h1>My Play</h1><p>点击票根以进入排练</p><span className="play-library-divider" aria-hidden="true" /></div></header>
    <div className="ticket-shelf" aria-label="我的剧目票夹">
      <div className={`ticket-scene ${open ? 'is-open' : ''}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <div className="ticket-stack">
          {tickets.map((project, index) => <article key={project?.id ?? 'new'} className={['ticket-card', project ? '' : 'blank', deletingId === project?.id ? 'is-deleting' : ''].filter(Boolean).join(' ')} style={{ '--ticket-index': index, '--ticket-art': 'url(' + playbillArt.ticket + ')', zIndex: tickets.length - index } as CSSProperties}>
            <img src={playbillArt.ticket} alt="" />
            <button className="ticket-open-surface" onClick={project ? () => onOpen(project) : onCreate} aria-label={project ? '打开剧目 ' + project.name : '新建剧目'}>
              <span className="ticket-content">{project ? <><span className="ticket-overline">ADMIT ONE · YOUR PLAY</span><span className="ticket-body"><strong title={project.name}>{project.name}</strong><TicketPreview production={project} /><span className="ticket-detail">{project.actors.length} 位演员 · {project.positions.length} 个站位</span></span></> : <><span className="ticket-overline">A NEW STORY AWAITS</span><span className="ticket-body"><span className="ticket-plus"><Plus size={31} /></span><strong>新建剧目</strong><span className="ticket-detail">为下一场排演准备舞台</span></span><span className="ticket-action">开始创作 <ArrowRight size={16} /></span></>}</span>
            </button>
            {project && <><span className="ticket-tear-seam" aria-hidden="true" /><div className="ticket-controls"><button className="ticket-action" onClick={() => onOpen(project)}>打开剧目 <ArrowRight size={14} /></button><button className="ticket-delete" onClick={() => requestDelete(project)}><Trash2 size={12} /> 删除剧目</button></div></>}
          </article>)}
        </div>
        <button className="ticket-folder" aria-label={open ? '收起票夹' : '展开票夹'} onClick={() => setOpen(value => !value)}><img src={playbillArt.folder} alt="My play 剧目票夹" /></button>
      </div>
    </div>
    {pageCount > 1 && <nav className="ticket-pages" aria-label="浏览剧目"><button onClick={() => { setPage(value => Math.max(0, value - 1)); setOpen(false) }} disabled={currentPage === 0} aria-label="上一组剧目">←</button><span>{currentPage + 1} / {pageCount}</span><button onClick={() => { setPage(value => Math.min(pageCount - 1, value + 1)); setOpen(false) }} disabled={currentPage === pageCount - 1} aria-label="下一组剧目">→</button></nav>}
  </main>
}
