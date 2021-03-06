import { addScore, Colors, logMessage, updateHud } from './hud'
import { deleteEntGrid, Health, Loot } from './ecs/components'
import { removeEntity } from 'bitecs'
import { World } from './ecs'
import { RNG } from 'rot-js'
import { PlayerEntity } from './'

const START_LINE_LENGTH = 4
const START_BAIT = 8
export const Supplies = {
  bait: START_BAIT,
  lineLength: START_LINE_LENGTH,
}

export const Inventory: Set<Lure> = new Set()
export const ActiveLures: Set<Lure> = new Set()

export enum Lure {
  WreckingBall = 1,
  MagicSponge,
  SecondSight,
  Telecasting,
}
const lures = [Lure.WreckingBall, Lure.MagicSponge, Lure.SecondSight, Lure.Telecasting]

export function getLureInfo(lure: Lure): { name: string; color: Colors; hint: string } {
  switch (lure) {
    case Lure.WreckingBall:
      return { name: 'Wrecking Ball', color: Colors.Danger, hint: 'Try angling your lure into a wall...' }
    case Lure.MagicSponge:
      return { name: 'Magic Sponge', color: Colors.Sponge, hint: 'Try casting onto water...' }
    case Lure.SecondSight:
      return {
        name: 'Second Sight',
        color: Colors.Mystical,
        hint: 'Try casting into the darkness...',
      }
    case Lure.Telecasting:
      return { name: 'Telecasting', color: Colors.Spooky, hint: 'Try casting somewhere hard to reach...' }
  }
}

export enum LootType {
  Bag = 1,
  Chest,
}

const bagLootChances = {
  bait: 15,
  extraLine: 1,
}

const chestLootChances = {
  bait: 1,
  extraLine: 1,
  lure: 30,
}

const getChestLootChances = () => {
  return {
    ...chestLootChances,
    bait: (Supplies.lineLength - 4) * 2,
  }
}

export function getLoot(eid: number) {
  const lootType = Loot.type[eid]
  const isChest = lootType === LootType.Chest
  let loot: string
  do {
    loot = RNG.getWeightedValue(isChest ? getChestLootChances() : bagLootChances)!
  } while (Inventory.size === lures.length && loot === 'lure')
  if (loot === 'bait') {
    let baitAmount = Math.max(1, Math.round(RNG.getNormal(6, 2)))
    if (isChest) baitAmount *= 2
    Supplies.bait += baitAmount
    logMessage(`You picked up ${baitAmount} bait`, Colors.White)
  } else if (loot === 'extraLine') {
    Supplies.lineLength++
    if (isChest) Supplies.lineLength++
    logMessage(`You picked up some extra fishing line`, Colors.White)
  } else if (loot === 'lure') {
    const lure = RNG.getItem(lures.filter((l) => !Inventory.has(l)))!
    Inventory.add(lure)
    const { color, name } = getLureInfo(lure)
    let info = Inventory.size === 1 ? ' Use the number keys to attach lures' : ''
    info = Inventory.size === 2 ? ' Tip: Multiple lures can be attached at once!' : info
    logMessage(`You found the %c{${color}}${name} lure!%c{${Colors.White}}${info}`, Colors.White)
  }
  addScore(isChest ? 250 : 25)
  deleteEntGrid(eid)
  removeEntity(World, eid)
}

const PreviouslyToggled: Set<Lure> = new Set()
export function toggleLure(lure: number) {
  const toToggle = [...Inventory][lure - 1]
  if (!toToggle) return
  if (ActiveLures.has(toToggle)) ActiveLures.delete(toToggle)
  else {
    ActiveLures.add(toToggle)
    if (!PreviouslyToggled.has(toToggle)) {
      PreviouslyToggled.add(toToggle)
      const { hint, color } = getLureInfo(toToggle)
      logMessage(hint, color)
    }
  }
  updateHud()
}

export function eatBait() {
  if (Supplies.bait === 0) return
  if (Health.current[PlayerEntity] === Health.max[PlayerEntity]) {
    logMessage(`You already have max health`)
    return
  }
  Supplies.bait--
  logMessage('You ate 1 bait (+1 hp)', Colors.GoodWater)
  Health.current[PlayerEntity]++
}

export function clearInventory() {
  Supplies.bait = START_BAIT
  Supplies.lineLength = START_LINE_LENGTH
  Inventory.clear()
  ActiveLures.clear()
  PreviouslyToggled.clear()
}
