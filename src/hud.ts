import { Display } from 'rot-js'
import { Health, WaterCreature, Wetness } from './ecs/components'
import { CurrentLevel, GameState, LastLevel, PlayerEntity } from './index'
import { PlayerState } from './ecs/input_systems'
import { hasComponent } from 'bitecs'
import { World } from './ecs'
import { promisedFrame } from './pixi'
import { Creature, CreatureProps } from './creatures'

let HUD: Display
let log: string[]
let killedFish = 0
const turtlePetLevels = new Set()

export enum Colors {
  White = '#ffffff',
  Good = '#14a02e',
  Bad = '#e86a73',
  Warning = '#f5a097',
  Danger = '#f57221',
  Dim = '#8098a1',
  Water = '#477d85',
  StrongWater = '#328e98',
  GoodWater = '#5daf8d',
  DeepWater = '#102b3b',
  Gold = '#ffd541',
  Blood = '#d01e2a',
  DeepestBlood = '#25141c',
  Sky = '#6bb9e1',
}

const hudDefaults = { width: 30, height: 32, fontSize: 20, bg: Colors.DeepWater }
const bigHudDefaults = { width: 44, height: 16, fontSize: 40, bg: Colors.DeepWater }

export function initHud() {
  HUD = new Display({ ...bigHudDefaults, fontStyle: 'bold' })
  HUD.drawText(19, 8, `%c{${Colors.Dim}}LOADING`)
  document.body.appendChild(HUD.getContainer()!)
  log = []
}

export function showLevelGen(attempt: number) {
  HUD.clear()
  HUD.drawText(8, 8, `%c{${Colors.Dim}}Level generation attempt #${attempt}`)
}

function getEntityName(eid: number, _capitalize = false) {
  let name = 'unknown'
  if (eid === PlayerEntity) name = 'you'
  if (hasComponent(World, WaterCreature, eid)) name = 'the ' + CreatureProps[WaterCreature.type[eid]].texture
  return _capitalize ? capitalize(name) : name
}

function getEntityAttack(eid: number) {
  let verb = 'hit'
  if (hasComponent(World, WaterCreature, eid)) {
    if (WaterCreature.type[eid] === Creature.Fish) verb = 'bit'
    if (WaterCreature.type[eid] === Creature.Alligator) verb = 'chomped'
  }
  return verb
}

export function logAttack(attacker: number, victim: number, damage: number) {
  let color = Colors.White
  if (victim === PlayerEntity) color = Colors.Bad
  logMessage(
    `${getEntityName(attacker, true)} ${getEntityAttack(attacker)} ${getEntityName(victim)} for ${damage} damage`,
    color
  )
}

export function logKill(victim: number) {
  if (hasComponent(World, WaterCreature, victim) && WaterCreature.type[victim] === Creature.Fish) killedFish++
  logMessage(`You killed ${getEntityName(victim)}`)
}

export function logLunge(attacker: number) {
  logMessage(`The ${getEntityName(attacker)} lunges at you!`, Colors.Danger)
}

export function logBaiting(baited: number) {
  logMessage(`The ${getEntityName(baited)} took the bait`, Colors.GoodWater)
}

export function logPetting() {
  turtlePetLevels.add(CurrentLevel)
  logMessage(`You pet the turtle`, Colors.Good)
}

export function logMessage(message: string, color: Colors = Colors.White) {
  log.unshift(`%c{${color ?? ''}}${message}`)
  updateHud()
}

export function updateHud() {
  dirty = true
}

export function defaultHud() {
  HUD.clear()
  HUD.setOptions(hudDefaults)
  updateHud()
}

export function bigHud() {
  HUD.clear()
  HUD.setOptions(bigHudDefaults)
  updateHud()
}

const maxLogLines = 20
const lowestY = 32

let dirty = true

export async function drawHud() {
  if (!dirty) return
  dirty = false
  await promisedFrame()
  HUD.clear()
  if (GameState === 'Losing') return
  if (GameState === 'Lost') {
    HUD.setOptions({ ...bigHudDefaults, fontStyle: 'bold', bg: Colors.DeepestBlood })
    HUD.drawText(17, 7, `%c{${Colors.Blood}}GAME OVER`)
    return
  }
  if (GameState === 'Won') {
    HUD.setOptions(bigHudDefaults)
    let turtlePetResult = `%c{${Colors.Water}}You didn't pet any turtles`
    if (turtlePetLevels.size > 0)
      turtlePetResult = `%c{${Colors.Good}}You pet ${turtlePetLevels.size} out of ${LastLevel} turtles`
    if (turtlePetLevels.size === LastLevel)
      turtlePetResult = `%c{${Colors.Good}}You pet all ${turtlePetLevels.size} turtles!`
    HUD.drawText(
      7,
      4,
      `%c{${Colors.Sky}}At last, you made it back up to the dry, daylit surface\n\n\n\n\n%c{${Colors.GoodWater}}You killed ${killedFish} fish\n\n${turtlePetResult}`,
      30
    )
    return
  }
  if (GameState === 'CriticalFailure') {
    HUD.setOptions(bigHudDefaults)
    HUD.drawText(
      9,
      6,
      `%c{${Colors.Blood}}Level generation failed\n after 1000 attempts\n\nReload the page to try again`
    )
    return
  }
  const health = Health.current[PlayerEntity]
  HUD.drawText(3, 1, `Health: %c{${health <= 3 ? Colors.Bad : ''}}${health.toString().padStart(3)}`)
  const wet = hasComponent(World, Wetness, PlayerEntity)
  HUD.drawText(24, 1, `%c{${wet ? Colors.StrongWater : Colors.Dim}}${wet ? 'Wet' : 'Dry'}`)
  if (PlayerState === 'Idle') HUD.drawText(3, 3, '[C] to cast')
  if (PlayerState === 'Casting') HUD.drawText(3, 3, 'CASTING ⟆\n\n[C] to confirm\n[Esc] to cancel')
  if (PlayerState === 'Angling') HUD.drawText(3, 3, 'ANGLING ⟆\n\n[C] to cut line')
  if (log.length > 0) {
    HUD.drawText(1, 8, `%c{${Colors.Dim}}=========== LOG ===========`)
    let y = 10
    for (let i = 0; i < log.length; i++) {
      y += HUD.drawText(
        2,
        y,
        log[i].replaceAll(
          /%c{#[a-z0-9]+/gi,
          '$&' +
            Math.round(Math.min(255, (maxLogLines - i) / maxLogLines) * 255)
              .toString(16)
              .padStart(2, '0')
        ),
        25
      )
      if (y >= lowestY) {
        log = log.slice(0, i + 1)
        break
      }
    }
  }
}

export function clearLog() {
  log = []
  killedFish = 0
  turtlePetLevels.clear()
  updateHud()
}

const capitalize = (str: string) => str[0].toUpperCase() + str.slice(1)
