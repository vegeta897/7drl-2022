import { Application, Container, Loader, Ticker } from 'pixi.js'
import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { runRender } from './ecs'
import { initTextures } from './sprites'

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST
PIXI.settings.ROUND_PIXELS = true
Ticker.shared.autoStart = false

const gameWidth = 640
const gameHeight = 640

export const PixiApp = new Application({
  backgroundColor: 0x221e3a,
  width: gameWidth,
  height: gameHeight,
})

export const PixiViewport = new Viewport({
  screenWidth: gameWidth,
  screenHeight: gameHeight,
})
// PixiViewport.setZoom(2)
PixiViewport.setZoom(1)
PixiViewport.visible = false

export let WorldSprites: Container
export let EntitySprites: Container
export let OverlaySprites: Container

PixiApp.stage.addChild(PixiViewport)

export async function initPixi() {
  await loadGameAssets()
  initTextures() // Create Textures
  resetPixi()
  document.body.appendChild(PixiApp.view)
}

export function startPixi() {
  Ticker.shared.add(() => {
    runRender()
  })
  Ticker.shared.start()
  PixiViewport.visible = true
}

export function resetPixi() {
  WorldSprites?.destroy({ children: true })
  EntitySprites?.destroy({ children: true })
  OverlaySprites?.destroy({ children: true })
  WorldSprites = new Container()
  EntitySprites = new Container()
  OverlaySprites = new Container()
  PixiViewport.addChild(WorldSprites)
  PixiViewport.addChild(EntitySprites)
  PixiViewport.addChild(OverlaySprites)
  PixiViewport.alpha = 1
  PixiViewport.filters = null
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
