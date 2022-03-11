import { Colors, logMessage } from './hud'
import { deleteEntGrid } from './ecs/components'
import { removeEntity } from 'bitecs'
import { World } from './ecs'

export const Inventory: Set<Artifact> = new Set()

export enum Artifact {
  Pickaxe = 1,
  MagicSponge, // Lets you soak up ponds and then wring them out elsewhere
}

export function openChest(eid: number) {
  logMessage(`You got the %c{${Colors.Gold}}Pickaxe!`)
  Inventory.add(Artifact.Pickaxe)
  deleteEntGrid(eid)
  removeEntity(World, eid)
}
