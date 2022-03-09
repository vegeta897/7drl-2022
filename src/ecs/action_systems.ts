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
  CanSwim,
  CanWalk,
  OnTileType,
  Scent,
} from './components'
import { defineQuery, System, addComponent, removeComponent, hasComponent, removeEntity, entityExists } from 'bitecs'
import { EntityMap, Level } from '../level'
import { PlayerEntity, PlayerSprite, setGameState } from '../'
import { Log, logAttack, logKill } from '../hud'
import { addVector2, getDistance, getUnitVector2, Vector2, vectorsAreEqual } from '../vector2'
import { cutLine } from '../casting'
import { Tile } from '../map'
import { getTexture, SpritesByEID } from '../sprites'

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
        if (eid === PlayerEntity && OnTileType.current[eid] === Tile.Water) {
          Log.unshift(`You can't attack while swimming!`)
          break
        }
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
        if (targetTile.type === Tile.Water && !hasComponent(world, CanSwim, eid)) break
        if (targetTile.type === Tile.Floor && !hasComponent(world, CanWalk, eid)) break
      }
      currentGrid = targetGrid
    }
    if (vectorsAreEqual(startGrid, currentGrid)) continue
    changeEntGrid(eid, currentGrid)
    // TODO: Don't animate if enemy doesn't have Visible tag
    addComponent(world, AnimateMovement, eid)
    AnimateMovement.x[eid] = MoveAction.x[eid]
    AnimateMovement.y[eid] = MoveAction.y[eid]
    AnimateMovement.elapsed[eid] = 0
    AnimateMovement.length[eid] = 120
  }
  return world
}

export const playerSystem: System = (world) => {
  const prevTileType = OnTileType.previous[PlayerEntity]
  const currentTileType = OnTileType.current[PlayerEntity]
  if (currentTileType === Tile.Floor) {
    const scentStrength = Scent.strength[PlayerEntity]
    if (scentStrength > 1) {
      Scent.strength[PlayerEntity] = Math.max(1, scentStrength * 0.9)
      if (Scent.strength[PlayerEntity] === 1) Log.unshift('You are no longer wet')
    }
    if (prevTileType !== currentTileType) PlayerSprite.texture = getTexture('player')
  } else if (currentTileType === Tile.Water) {
    if (prevTileType !== currentTileType) {
      if (Scent.strength[PlayerEntity] <= 1) Log.unshift('You are wet')
      Scent.strength[PlayerEntity] = 2.5
      PlayerSprite.texture = getTexture('playerSwim')
    }
  }
  return world
}

const theFish = defineQuery([Fish, GridPosition])
export const fishSystem: System = (world) => {
  for (const eid of theFish(world)) {
    if (GridPosition.dirty[eid] === 0) continue
    const prevTileType = OnTileType.previous[eid]
    const currentTileType = OnTileType.current[eid]
    if (prevTileType === currentTileType) continue
    if (currentTileType === Tile.Floor) {
      SpritesByEID[eid].texture = getTexture('fish')
      addComponent(world, SeekWater, eid)
      SeekWater.distance[eid] = 6
    } else if (currentTileType === Tile.Water) {
      SpritesByEID[eid].texture = getTexture('fishSwim')
      removeComponent(world, CanWalk, eid)
      removeComponent(world, SeekWater, eid)
    }
  }
  return world
}

export const gameSystem: System = (world) => {
  if (!entityExists(world, PlayerEntity)) {
    setGameState('Losing')
  }
  return world
}
