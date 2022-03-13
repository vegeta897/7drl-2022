import { Display } from 'rot-js'
import { Health, Statuses, WaterCreature, Wetness } from './ecs/components'
import { CurrentLevel, GameState, LastLevel, PlayerEntity } from './index'
import { PlayerState } from './ecs/input_systems'
import { hasComponent } from 'bitecs'
import { World } from './ecs'
import { promisedFrame } from './pixi'
import { Creature, CreatureProps } from './creatures'
import { ActiveLures, getLureInfo, Inventory, Supplies } from './inventory'

let HUD: Display
let log: string[]
let killedFish = 0
const turtlePetLevels = new Set()

export enum Colors {
  White = '#ffffff',
  Default = '#c0c7cc',
  Good = '#14a02e',
  Bad = '#e86a73',
  Warning = '#f5a097',
  Danger = '#f57221',
  Dim = '#8098a1',
  Water = '#477d85',
  StrongWater = '#328e98',
  GoodWater = '#5daf8d',
  DeepWater = '#102b3b',
  DeepCave = '#221E3A',
  Gold = '#ffd541',
  Sponge = '#f5c96c',
  Blood = '#d01e2a',
  DeepestBlood = '#25141c',
  Sky = '#6bb9e1',
}

const hudDefaults = {
  width: 34,
  height: 32,
  fontSize: 20,
  fontFamily: 'Consolas,monospace',
  fg: Colors.Default,
  bg: Colors.DeepCave,
}
const bigHudDefaults = { ...hudDefaults, width: 47, height: 16, fontSize: 40 }

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
  if (hasComponent(World, WaterCreature, eid))
    name = `the ${CreatureProps[WaterCreature.type[eid]].name || CreatureProps[WaterCreature.type[eid]].texture}`
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

export function logAttack(attacker: number, victim: number, damage: number, extra = '') {
  let color = Colors.Default
  if (victim === PlayerEntity) color = Colors.Bad
  logMessage(
    `${getEntityName(attacker, true)} ${getEntityAttack(attacker)} ${getEntityName(
      victim
    )} for ${damage} damage${extra}`,
    color
  )
}

export function logKill(victim: number) {
  if (hasComponent(World, WaterCreature, victim) && WaterCreature.type[victim] === Creature.Fish) killedFish++
  logMessage(`You killed ${getEntityName(victim)}`, Colors.White)
}

export function logLunge(attacker: number) {
  logMessage(`The ${getEntityName(attacker)} lunges at you!`, Colors.Danger)
}

export function logBaitEat(baited: number) {
  logMessage(`The ${getEntityName(baited)} is eating the bait`, Colors.GoodWater)
}

export function logPetting() {
  turtlePetLevels.add(CurrentLevel)
  logMessage(`You pet the turtle`, Colors.Good)
}

const statusNames = ['', 'eating', 'stunned']
export function logCreatureStatus(eid: number, status: Statuses, ended = false, extra = '') {
  let verb = 'is'
  if (ended) {
    verb = status === Statuses.Eating ? 'has finished' : 'is no longer'
  }
  logMessage(
    `${getEntityName(eid, true)} ${verb} ${statusNames[status]}${ended ? '' : '!'}${extra}`,
    ended ? Colors.Dim : Colors.Default
  )
}

const maxLogLines = 23
export function logMessage(message: string, color: Colors = Colors.Default) {
  log.unshift(`%c{${color ?? ''}}${message}`)
  if (log.length > maxLogLines) log.length = maxLogLines
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
    HUD.drawText(19, 7, `%c{${Colors.Blood}}GAME OVER`)
    setTimeout(() => {
      if (GameState === 'Lost') HUD.drawText(14, 11, `%c{${Colors.Bad}}[enter] to restart`)
    }, 2500)
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
      9,
      4,
      `%c{${Colors.Sky}}At last, you made it back up to the dry, daylit surface\n\n\n\n\n%c{${Colors.GoodWater}}You killed ${killedFish} fish\n\n${turtlePetResult}`,
      30
    )
    return
  }
  if (GameState === 'CriticalFailure') {
    HUD.setOptions(bigHudDefaults)
    HUD.drawText(
      10,
      6,
      `%c{${Colors.Blood}}Level generation failed\nafter 10000 attempts\n\nReload the page to try again`
    )
    return
  }
  const health = Health.current[PlayerEntity]
  HUD.drawText(
    3,
    1,
    `%c{${Colors.Dim}}Health %c{${health <= 3 ? Colors.Bad : Colors.Default}}${health.toString().padStart(4)}`
  )
  const wet = hasComponent(World, Wetness, PlayerEntity)
  HUD.drawText(28, 1, `%c{${wet ? Colors.StrongWater : Colors.Dim}}${wet ? 'Wet' : 'Dry'}`)
  HUD.drawText(
    3,
    2,
    `%c{${Colors.Dim}}Bait   %c{${Supplies.bait === 0 ? Colors.Water : Colors.Default}}${Supplies.bait
      .toString()
      .padStart(4)}`
  )
  let nextY = 4
  if (PlayerState === 'Idle') {
    for (const lure of Inventory) {
      const active = ActiveLures.has(lure)
      const number = [...Inventory].indexOf(lure) + 1
      const { color, name } = getLureInfo(lure)
      HUD.drawText(3, nextY++, `[${number}] %c{${active ? color : Colors.Dim}}${name} lure`)
    }
    HUD.drawText(3, nextY++, '[C] Cast')
    HUD.drawText(
      3,
      nextY++,
      `%c{${Health.current[PlayerEntity] < Health.max[PlayerEntity] ? Colors.Default : Colors.Dim}}[E] Eat bait`
    )
  }
  if (PlayerState === 'Casting') {
    nextY += HUD.drawText(3, nextY, 'CASTING ⟆\n\n[C] Confirm cast\n[Esc] Cancel')
  }
  if (PlayerState === 'Angling') {
    nextY += HUD.drawText(3, nextY, 'ANGLING ⟆\n\n[C] Cut line')
  }
  if (log.length > 0) {
    nextY += 1
    const logStartY = nextY
    HUD.drawText(1, nextY, `%c{${Colors.Dim}}------------- LOG -------------`)
    nextY += 2
    for (let i = 0; i < log.length; i++) {
      nextY += HUD.drawText(
        2,
        nextY,
        log[i].replaceAll(
          /%c{#[a-z0-9]+/gi,
          '$&' +
            Math.round((1 - (nextY - logStartY) / (lowestY - logStartY)) * 255)
              .toString(16)
              .padStart(2, '0')
        ),
        29
      )
      if (i >= lowestY) {
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
