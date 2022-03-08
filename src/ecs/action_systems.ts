// Do player or enemy actions
import {
  AnimateMovement,
  Bait,
  changeEntGrid,
  deleteEntGrid,
  Fish,
  getEntGrid,
  GridPosition,
  Health,
  MoveAction,
  SeekWater,
  Stunned,
  Swimmer,
  Walker,
} from './components'
import { defineQuery, System, addComponent, removeComponent, hasComponent, removeEntity, entityExists } from 'bitecs'
import { EntityMap, Level } from '../level'
import { PlayerEntity, PlayerSprite, setGameState } from '../'
import { Log, logAttack, logKill } from '../hud'
import { addVector2, getDistance, getUnitVector2, Vector2, vectorsAreEqual } from '../vector2'
import { cutLine } from '../casting'
import { Tile } from '../map'
import { getTexture } from '../sprites'

const moveQuery = defineQuery([GridPosition, MoveAction])
export const moveSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    const move = { x: MoveAction.x[eid], y: MoveAction.y[eid] }
    removeComponent(world, MoveAction, eid)
    const distance = getDistance(move)
    const unitMove = getUnitVector2(move)
    const startGrid = getEntGrid(eid)
    let currentGrid = startGrid
    let targetGrid: Vector2
    for (let i = 0; i < distance; i++) {
      targetGrid = addVector2(currentGrid, unitMove)
      const targetEntity = EntityMap.get(targetGrid)
      if (targetEntity !== undefined) {
        const playerInvolved = [eid, targetEntity].includes(PlayerEntity)
        const attackedHasHealth = hasComponent(world, Health, targetEntity)
        if (playerInvolved && attackedHasHealth) {
          let damage = 1
          if (hasComponent(world, Stunned, targetEntity)) {
            damage = 5
            removeComponent(world, Stunned, targetEntity)
          }
          logAttack(eid, targetEntity, damage)
          const healthLeft = (Health.current[targetEntity] -= damage)
          if (healthLeft <= 0) {
            if (eid === PlayerEntity) logKill(targetEntity)
            deleteEntGrid(targetEntity)
            removeEntity(world, targetEntity)
          }
        }
        if (hasComponent(world, Bait, targetEntity)) {
          if (eid === PlayerEntity) Log.unshift('You ate the bait')
          if (hasComponent(world, Health, eid)) {
            Health.current[eid] = Math.min(Health.max[eid], Health.current[eid] + 1)
          }
          if (hasComponent(world, Fish, eid)) {
            addComponent(world, Stunned, eid)
            Stunned.remaining[eid] = 6
            cutLine()
            Log.unshift('The fish is eating the bait')
          }
          deleteEntGrid(targetEntity)
          removeEntity(world, targetEntity)
        } else {
          break
        }
      }
      const targetTile = Level.get(targetGrid)
      if (MoveAction.noclip[eid] === 0) {
        if (targetTile.solid) break
        if (targetTile.type === Tile.Water && !hasComponent(world, Swimmer, eid)) break
        if (targetTile.type === Tile.Floor && !hasComponent(world, Walker, eid)) break
      }
      currentGrid = targetGrid
    }
    if (vectorsAreEqual(startGrid, currentGrid)) continue
    changeEntGrid(eid, currentGrid)
    const currentTile = Level.get(currentGrid)
    if (eid === PlayerEntity) {
      if (Level.get(startGrid).type !== Tile.Water && currentTile.type === Tile.Water) {
        PlayerSprite.texture = getTexture('playerSwim')
      }
      if (Level.get(startGrid).type === Tile.Water && currentTile.type !== Tile.Water) {
        PlayerSprite.texture = getTexture('player')
      }
    } else if (hasComponent(world, Fish, eid)) {
      if (currentTile.type === Tile.Floor) {
        addComponent(world, SeekWater, eid)
        SeekWater.distance[eid] = 6
      } else if (currentTile.type === Tile.Water) {
        removeComponent(world, Walker, eid)
        removeComponent(world, SeekWater, eid)
      }
    }
    // TODO: Don't animate if enemy doesn't have Visible tag
    addComponent(world, AnimateMovement, eid)
    AnimateMovement.x[eid] = MoveAction.x[eid]
    AnimateMovement.y[eid] = MoveAction.y[eid]
    AnimateMovement.elapsed[eid] = 0
    AnimateMovement.length[eid] = 120
  }
  return world
}

export const gameSystem: System = (world) => {
  if (!entityExists(world, PlayerEntity)) {
    setGameState('Losing')
  }
  return world
}
