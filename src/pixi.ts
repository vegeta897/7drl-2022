import { Application, Container, Loader, Ticker } from 'pixi.js'
import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { runRender } from './ecs'

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST
// PIXI.settings.ROUND_PIXELS = true

const gameWidth = 640
const gameHeight = 640

export const PixiApp = new Application({
  backgroundColor: 0x0b1a2a,
  width: gameWidth,
  height: gameHeight,
})

export const PixiViewport = new Viewport({
  screenWidth: gameWidth,
  screenHeight: gameHeight,
})
PixiViewport.setZoom(2)

export const WorldSprites = new Container()
export const OverlaySprites = new Container()
PixiViewport.addChild(WorldSprites)
PixiViewport.addChild(OverlaySprites)

PixiApp.stage.addChild(PixiViewport)

export async function initPixi() {
  await loadGameAssets()

  document.body.appendChild(PixiApp.view)
  Ticker.shared.add(() => {
    runRender()
  })
}

async function loadGameAssets(): Promise<void> {
  return new Promise((res, rej) => {
    const loader = Loader.shared
    loader.add('sprites', './assets/sprites.json')
    loader.onComplete.once(() => res())
    loader.onError.once(() => rej())
    loader.load()
  })
}

export const promisedFrame = async (): Promise<DOMHighResTimeStamp> =>
  new Promise((res) => requestAnimationFrame((time) => res(time)))
