// Cream/dark dot overlay — port of orig s1 (renderOrder 10, opacity = sP).
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { sceneState, normProgress } from './sceneState.js'
import { useTheme } from './hooks.js'

const VERT = `
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `
const FRAG = `
          precision highp float;

          varying vec2 vUv;

          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uPixelSize;
          uniform float uRadiusScale;
          uniform vec2 uResolution;

          void main() {
            float a = clamp(uOpacity, 0.0, 1.0);

            vec2 normalizedPixelSize = vec2(
              uPixelSize / max(uResolution.x, 1.0),
              uPixelSize / max(uResolution.y, 1.0)
            );

            vec2 safePixelSize = max(normalizedPixelSize, vec2(1e-6));
            vec2 cellUV = fract(vUv / safePixelSize);

            // 与 route_transition 点阵一致：透明度直接映射圆半径。
            float radius = uRadiusScale * a;
            float distanceFromCenter = distance(cellUV, vec2(0.5));
            float aa = fwidth(distanceFromCenter) * 1.5;
            float circleMask = smoothstep(radius, radius - aa, distanceFromCenter);

            gl_FragColor = vec4(uColor, circleMask);
            #include <colorspace_fragment>
          }
        `

export default function DotOverlay({ overlayColors = ['#0F1111', '#FBFAF4'], overlayPixelSize = 8, overlayRadiusScale = 0.9 }) {
  const theme = useTheme()
  const size = useThree((s) => s.size)
  const ref = useRef(null)
  const [dark, light] = overlayColors
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color() },
    uOpacity: { value: 1 },
    uPixelSize: { value: overlayPixelSize },
    uRadiusScale: { value: overlayRadiusScale },
    uResolution: { value: new THREE.Vector2(1, 1) },
  }), [overlayPixelSize, overlayRadiusScale])
  useLayoutEffect(() => { ref.current?.uniforms.uColor.value.set(theme === 'dark' ? dark : light) }, [theme, dark, light, uniforms])
  useLayoutEffect(() => { ref.current?.uniforms.uResolution.value.set(Math.max(1, size.width), Math.max(1, size.height)) }, [size.width, size.height, uniforms])
  useFrame(() => {
    const e = normProgress(sceneState.sP)
    ref.current && (ref.current.uniforms.uOpacity.value = e)
  })
  return (
    <mesh renderOrder={10} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={ref} transparent depthTest={false} depthWrite={false} toneMapped={false} uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG} />
    </mesh>
  )
}
