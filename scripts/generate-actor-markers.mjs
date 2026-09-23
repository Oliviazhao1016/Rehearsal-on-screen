import { mkdir, writeFile } from 'node:fs/promises'

const palette = {
  burgundy: '#8F302D',
  ochre: '#A27439',
  sage: '#62745B',
  slate: '#667589',
  plum: '#765767',
}

await mkdir(new URL('../ui/actor/vintage/', import.meta.url), { recursive: true })

for (const [name, fill] of Object.entries(palette)) {
  for (const selected of [false, true]) {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${name} actor marker">
  <circle cx="32" cy="32" r="29" fill="#171513" stroke="${selected ? '#E8D8BC' : '#AA8656'}" stroke-width="${selected ? '3' : '2'}"/>
  <circle cx="32" cy="32" r="24" fill="${fill}" stroke="#D4AF37" stroke-width="1.5"/>
  <circle cx="32" cy="32" r="19" fill="none" stroke="#E8D8BC" stroke-opacity=".48" stroke-width="1"/>
  <path d="M32 5v7M32 52v7M5 32h7M52 32h7" fill="none" stroke="#D4AF37" stroke-width="1.5"/>
  <path d="M32 13l2.3 2.3L32 17.6l-2.3-2.3zM32 46.4l2.3 2.3L32 51l-2.3-2.3z" fill="#E8D8BC" fill-opacity=".85"/>
  ${selected ? '<circle cx="32" cy="32" r="31" fill="none" stroke="#D4AF37" stroke-width="1"/>' : ''}
</svg>`
    await writeFile(new URL(`../ui/actor/vintage/${name}${selected ? '-selected' : ''}.svg`, import.meta.url), source)
  }
}
