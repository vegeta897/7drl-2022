import { Display } from 'rot-js'
import { Fish, Health, Player } from './ecs/components'
import { PlayerEntity } from './index'
import { PlayerState } from './ecs/input_systems'
import { hasComponent } from 'bitecs'
import { World } from './ecs'

export let HUD: Display
export let Log: string[]

export function initHud() {
  HUD = new Display({ width: 30, height: 30, fontSize: 20, fontStyle: 'bold', bg: '#01162c' })
  document.body.appendChild(HUD.getContainer()!)
  Log = []
}

function getEntityName(entity: number, _capitalize = false) {
  let name = 'unknown'
  if (hasComponent(World, Player, entity)) name = 'you'
  if (hasComponent(World, Fish, entity)) name = 'the fish'
  return _capitalize ? capitalize(name) : name
}

export function logAttack(attacker: number, victim: number, damage: number) {
  Log.unshift(`${getEntityName(attacker, true)} hit ${getEntityName(victim)} for ${damage} dmg`)
}

export function logKill(victim: number) {
  Log.unshift(`You killed ${getEntityName(victim)}`)
}

const maxLogLines = 16
const lowestY = 30

export function drawHud() {
  HUD.clear()
  HUD.drawText(3, 1, `Health: ${Health.current[PlayerEntity].toString().padStart(3)}`)
  if (PlayerState === 'casting') HUD.drawText(3, 3, 'CASTING ⟆\n\nC to confirm\nEsc to cancel')
  if (PlayerState === 'angling') HUD.drawText(3, 3, 'ANGLING ⟆\n\nC to cut line')
  if (Log.length > 0) {
    HUD.drawText(1, 8, '=========== LOG ===========')
    let y = 9
    for (let i = 0; i < Log.length; i++) {
      y += HUD.drawText(
        2,
        y,
        `%c{#ffffff${Math.round(((maxLogLines - i) / maxLogLines) * 255)
          .toString(16)
          .padStart(2, '0')}}${Log[i]}`
      )
      if (y >= lowestY) {
        Log = Log.slice(0, i + 1)
        break
      }
    }
  }
}

const capitalize = (str: string) => str[0].toUpperCase() + str.slice(1)
