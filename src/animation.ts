import { Vector2 } from './vector2'
import { circIn, circOut, cubicIn, cubicInOut, cubicOut } from '@gamestdio/easing'

export enum AnimationType {
  Hop = 1,
  Lunge,
  Attack,
  LungeAttack,
  Swim,
}

type Ease = (p: number) => number

// I wrote this myself!
const splitEasing = (p: number, firstPortion: number, ease1: Ease, ease2: Ease) =>
  p < firstPortion ? ease1(p * (1 / firstPortion)) : 1 - ease2((p - firstPortion) * (1 / (1 - firstPortion)))

const getHop = (p: number, height: number) => height * splitEasing(p, 0.5, circOut, circIn)

export const Animations: Map<AnimationType, (p: number, sx: number, sy: number, dx: number, dy: number) => Vector2> =
  new Map()

Animations.set(AnimationType.Hop, (p, sx, sy, dx, dy) => {
  return {
    x: sx + dx * p,
    y: sy + dy * p - getHop(p, 0.2),
  }
})

Animations.set(AnimationType.Lunge, (p, sx, sy, dx, dy) => {
  return {
    x: sx + dx * p,
    y: sy + dy * p - getHop(p, 0.4),
  }
})

Animations.set(AnimationType.Attack, (p, sx, sy, dx, dy) => {
  let yHop = (dy > 0 ? 0 : -0.2) * splitEasing(p, 0.2, circOut, circIn)
  return {
    x: sx + dx * splitEasing(p, 0.2, cubicIn, cubicOut) * 0.6,
    y: sy + dy * splitEasing(p, 0.2, cubicIn, cubicOut) * 0.6 + yHop,
  }
})

const getLungeAttack = (p: number, d: number) => {
  const unit = d > 0 ? 1 : d < 0 ? -1 : 0
  let lunge
  if (p < 0.5) lunge = (d + unit * 0.3) * p * 2
  else if (p < 0.7) lunge = d + unit * 0.3
  else lunge = d + (1 - p) * unit
  return lunge
}
Animations.set(AnimationType.LungeAttack, (p, sx, sy, dx, dy) => {
  return {
    x: sx + getLungeAttack(p, dx),
    y: sy + getLungeAttack(p, dy) - getHop(p, 0.3),
  }
})

Animations.set(AnimationType.Swim, (p, sx, sy, dx, dy) => {
  return {
    x: sx + dx * cubicInOut(p),
    y: sy + dy * cubicInOut(p),
  }
})
