import { Display } from 'rot-js'
import { Fish, Health } from './ecs/components'
import { GameState, PlayerEntity } from './index'
import { PlayerState } from './ecs/input_systems'
import { hasComponent } from 'bitecs'
import { World } from './ecs'

export let HUD: Display
export let Log: string[]

const hudDefaults = { width: 30, height: 32, fontSize: 20 }

export function initHud() {
  HUD = new Display({ ...hudDefaults, fontStyle: 'bold', bg: '#102b3b' })
  document.body.appendChild(HUD.getContainer()!)
  Log = []
}

export function resetHud() {
  HUD.setOptions(hudDefaults)
  Log = []
}

function getEntityName(entity: number, _capitalize = false) {
  let name = 'unknown'
  if (entity === PlayerEntity) name = 'you'
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
const lowestY = 32

export function drawHud() {
  HUD.clear()
  if (GameState === 'Losing') return
  if (GameState === 'Lost') {
    HUD.setOptions({ width: 15, height: 16, fontSize: 40 })
    HUD.drawText(5, 7, 'GAME')
    HUD.drawText(5, 8, 'OVER')
    return
  }
  HUD.drawText(3, 1, `Health: ${Health.current[PlayerEntity].toString().padStart(3)}`)
  if (PlayerState === 'Casting') HUD.drawText(3, 3, 'CASTING ⟆\n\nC to confirm\nEsc to cancel')
  if (PlayerState === 'Angling') HUD.drawText(3, 3, 'ANGLING ⟆\n\nC to cut line')
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
