import Scene from '../webgl/Scene.jsx'

// Fixed container for the main R3F scene (track B1 owns <Scene />).
export default function CanvasHost() {
  return (
    <div className="top-0 left-0 -z-1 fixed w-full h-dvh lg:h-screen">
      <Scene />
    </div>
  )
}
