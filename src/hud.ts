import { Display } from 'rot-js'
import { Fish, Health, Player } from './ecs/components'
import { PlayerEntity } from './index'
import { CastMode } from './ecs/input_systems'
import { hasComponent } from 'bitecs'
import { World } from './ecs'

export let HUD: Display
export let Log: string[]

export function initHud() {
  HUD = new Display({ width: 30, height: 30, fontSize: 20, fontStyle: 'bold', bg: '#01162c' })
  document.body.appendChild(HUD.getContainer()!)
  Log = []
}

function getEntityName(entity: number) {
  if (hasComponent(World, Player, entity)) return 'you'
  if (hasComponent(World, Fish, entity)) return 'the fish'
  return 'Unknown'
}

export function logAttack(attacker: number, victim: number, damage: number) {
  Log.push(`${getEntityName(attacker)} hit ${getEntityName(victim)} for ${damage} dmg`)
}

export function logKill(victim: number) {
  Log.push(`You killed ${getEntityName(victim)}`)
}

export function drawHud() {
  HUD.clear()
  HUD.drawText(3, 1, `Health: ${Health.current[PlayerEntity].toString().padStart(3)}`)
  if (CastMode) HUD.drawText(3, 3, 'CASTING ⟆\n\nC to confirm\nEsc to cancel')
  if (Log.length > 0) {
    HUD.drawText(1, 8, '=========== LOG ===========')
    HUD.drawText(2, 9, Log.map(capitalize).join('\n'))
  }
}

const capitalize = (str: string) => str[0].toUpperCase() + str.slice(1)
