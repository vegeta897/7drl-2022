import { Display } from 'rot-js'
import { Health } from './ecs/components'
import { PlayerEntity } from './index'
import { CastMode } from './ecs/input_systems'

export let HUD: Display

export function initHud() {
  HUD = new Display({ width: 30, height: 30, fontSize: 20, fontStyle: 'bold', bg: '#01162c' })
  document.body.appendChild(HUD.getContainer()!)
}

export function drawHud() {
  HUD.clear()
  HUD.drawText(3, 1, `Health: ${Health.current[PlayerEntity].toString().padStart(3)}`)
  if (CastMode) HUD.drawText(3, 3, 'CASTING ⟆')
}
