# SHADERS — haoqi.design home (verbatim GLSL)

Source: https://haoqi.design/

Extracted with an AST walk (acorn) from the saved production bundles in `_reference/HAOQI©2026_files/` (`4d3f3b68dbbde33a.js` = home scene, `3c6cc5b2fcccdee5.js` = transition overlay). Strings are byte-for-byte the shipped source (Chinese comments included). three.js r184; `#include <...>` chunks are three's ShaderChunk includes and must stay. Line refs point to the prettier-formatted copy of each chunk.

One extra tiny shader, not captured by the walker (too short): Fluid "clear" fragment = `void main() {\n  gl_FragColor = vec4(0.0);\n}`.

## A. Hero bokeh background (sz/sV) — shared VERTEX for the 5 ping-pong pre-passes

_4d3f3b68dbbde33a.js:12774_ — ShaderMaterial created by helper `t(frag, uniforms)`; common uniforms: tInput, uResolution(=RT size), uTime, uPos, uMousePos(0.5,0.5), uTrackMouse(1). transparent:false, NoBlending, depthTest/Write false, toneMapped false.

```glsl
precision mediump float;
precision mediump int;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

## A1. Bokeh pre-pass 1 "vignette" FRAGMENT

_4d3f3b68dbbde33a.js:12791_ — uniforms: uRadius .354, uFalloff 1, uMix 1, uDisplace 0, uSkew .54, uAngle 0, uEdgeIntensity (light -0.16 / dark -0.82), uVignetteColor (light #6196ff / dark #00000d), uColorAlpha 1, uClearColor (light #ffead6 / dark #2c4bd5), uTrackMouse 1. uPos forced to (0.5,-0.1).

```glsl
precision mediump float;
precision mediump int;
varying vec2 vUv;
uniform float uRadius;
uniform float uFalloff;
uniform float uMix;
uniform float uDisplace;
uniform float uSkew;
uniform float uAngle;
uniform vec3 uVignetteColor;
uniform vec2 uPos; // 动态中心（跟随指针，如原始实现）
uniform vec2 uResolution;
uniform vec3 uClearColor;
// 边缘明暗强度：[-1,1]，负值加深暗角，正值提亮边缘
uniform float uEdgeIntensity;

mat2 rot(float a) {
  return mat2(cos(a),-sin(a),sin(a),cos(a));
}
void main() {
  vec2 uv = vUv;
  vec4 color = vec4(vec3(1.), 0.);
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float displacement = (luma - 0.5) * uDisplace * 0.5;
  vec2 aspectRatio = vec2(uResolution.x/uResolution.y, 1.0);
  vec2 skew = vec2(uSkew, 1.0 - uSkew);
  float halfRadius = uRadius * 0.5;
  float innerEdge = halfRadius - uFalloff * halfRadius * 0.5;
  float outerEdge = halfRadius + uFalloff * halfRadius * 0.5;
  // 使用动态指针位置作为暗角中心（原始方案）
  vec2 pos = uPos;
  vec2 scaledUV = uv * aspectRatio * rot(uAngle * 6.28318530718) * skew;
  vec2 scaledPos = pos * aspectRatio * rot(uAngle * 6.28318530718) * skew;
  float radius = distance(scaledUV, scaledPos);
  float falloff = smoothstep(innerEdge + displacement, outerEdge + displacement, radius);
  // 原始实现不额外乘 uMix（保留 uniform 以兼容但不使用）

  // 根据 uEdgeIntensity 调整边缘亮暗：
  // uEdgeIntensity > 0 推向 0（提亮边缘），< 0 推向 1（加深暗角）
  float brighten = max(uEdgeIntensity, 0.0);
  float darken = max(-uEdgeIntensity, 0.0);
  falloff = mix(falloff, 0.0, brighten);
  falloff = mix(falloff, 1.0, darken);

  vec3 mixed = mix(uClearColor, uVignetteColor, falloff);
  gl_FragColor = vec4(mixed, falloff);
}
```

## A2. Bokeh pre-pass 2 "swirl" FRAGMENT

_4d3f3b68dbbde33a.js:12807_ — uRadius .25, uAngle .1, uPhase 0, uMix .5, uPinch 0

```glsl
precision mediump float;
precision mediump int;
varying vec2 vUv;
uniform vec2 uResolution;
uniform sampler2D tInput;
uniform float uRadius;
uniform float uAngle;
uniform float uPhase;
uniform float uTime;
uniform float uMix;
uniform vec2 uPos;

void main() {
  vec2 uv = vUv;
  float angle = uAngle * 10.;
  vec2 originalUV = uv;
  vec2 pos = uPos;
  uv -= pos;
  vec2 R = vec2(uv.x * uResolution.x / uResolution.y, uv.y);
  float distanceToCenter = length(R);
  if (distanceToCenter <= uRadius) {
    float rot = atan(R.y, R.x) + angle * smoothstep(uRadius, 0., distanceToCenter);
    uv = vec2(cos(rot + uTime / 20. + uPhase * 6.28318530718), sin(rot + uTime / 20. + uPhase * 6.28318530718));
    uv = distanceToCenter * uv + pos;
  }
  float t = smoothstep(0., uRadius, distanceToCenter);
  vec2 mixedUV = mix(uv, originalUV, t);
  gl_FragColor = texture2D(tInput, mix(vUv, mixedUV, uMix));
}
```

## A3. Bokeh pre-pass 3 "sine" FRAGMENT

_4d3f3b68dbbde33a.js:12817_ — uMixRadius 1, uFrequency .35, uAmplitude 1.18, uRotation 0

```glsl
precision mediump float;
precision mediump int;
varying vec2 vUv;
uniform sampler2D tInput;
uniform float uMixRadius;
uniform vec2 uPos;
uniform float uFrequency;
uniform float uAmplitude;
uniform float uRotation;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMousePos;
uniform float uTrackMouse;

void main() {
  vec2 uv = vUv;
  vec2 waveCoord = vUv.xy * 2.0 - 1.0;
  float time = uTime * 0.25;
  float frequency = 20.0 * uFrequency;
  float amp = uAmplitude * 0.2;
  float waveX = sin((waveCoord.y + uPos.y) * frequency + (time)) * amp;
  float waveY = sin((waveCoord.x - uPos.x) * frequency + (time)) * amp;
  waveCoord.xy += vec2(mix(waveX, 0., uRotation), mix(0., waveY, uRotation));
  vec2 finalUV = waveCoord * 0.5 + 0.5;
  float aspectRatio = uResolution.x/uResolution.y;
  vec2 mPos = uPos + mix(vec2(0.), (uMousePos-0.5), uTrackMouse);
  float dist = (max(0.,1.-distance(uv * vec2(aspectRatio, 1.), mPos * vec2(aspectRatio, 1.)) * 4. * (1. - uMixRadius)));
  uv = mix(uv, finalUV, dist);
  gl_FragColor = texture2D(tInput, uv);
}
```

## A4. Bokeh pre-pass 4 "shatter" FRAGMENT

_4d3f3b68dbbde33a.js:12826_ — uAmount 1, uSpread .9, uAngle -45/360, uSkew .9, uCellScale 16, uMixRadius 1, uMixRadiusInvert 0, uEasing 1, uTrackMouse 0, uPos (0.5,-0.1 after effect), uRoundness .02

```glsl
precision mediump float;
precision mediump int;
varying vec2 vUv;
uniform sampler2D tInput;
uniform float uAmount;
uniform float uSpread;
uniform float uAngle;
uniform float uTime;
uniform float uSkew;
uniform float uCellScale;
uniform vec2 uPos;
uniform vec2 uResolution;
uniform float uMixRadius;
uniform int uMixRadiusInvert;
uniform int uEasing;
uniform vec2 uMousePos;
uniform float uTrackMouse;
uniform float uRoundness;

vec2 random2( vec2 p ) {
  return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}
mat2 rot(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }

float ease(int mode, float t){
  if(mode==1){ return 1.0 - (1.0 - t)*(1.0 - t); }
  if(mode==2){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0)/2.0; }
  return t;
}

void main(){
  vec2 uv = vUv;
  float aspectRatio = uResolution.x / uResolution.y;
  vec2 skew = mix(vec2(1.0), vec2(1.0, 0.0), uSkew);
  vec2 st = (uv - uPos) * vec2(aspectRatio, 1.0) * uCellScale * uAmount;
  st = st * rot(uAngle * 2.0 * 3.14159265359) * skew;
  vec2 i_st = floor(st);
  vec2 f_st = fract(st);

  float m_dist = 15.0;
  float m_dist2 = 15.0;
  vec2 m_point = vec2(0.0);
  vec2 diffBest = vec2(0.0);
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 neighbor = vec2(float(i), float(j));
      vec2 point = random2(i_st + neighbor);
      point = 0.5 + 0.5 * sin(5.0 + uTime * 0.2 + 6.2831 * point);
      vec2 diff = neighbor + point - f_st;
      float dist = length(diff);
      if(dist < m_dist){
        m_dist2 = m_dist;
        m_dist = dist;
        m_point = point;
        diffBest = diff;
      } else if (dist < m_dist2) {
        m_dist2 = dist;
      }
    }
  }

  vec2 offset = (m_point * 0.2 * uSpread * 2.0) - (uSpread * 0.2);
  // soften offsets near cell edges to get rounder pieces
  // Use F2-F1 (second nearest minus nearest) to detect corners and soften further
  float cornerSoft = smoothstep(0.0, max(0.0001, uRoundness) * 2.0, m_dist2 - m_dist);
  float edgeSoft = smoothstep(0.0, max(0.0001, uRoundness), m_dist) * cornerSoft;
  offset *= edgeSoft;

  vec2 mPos = uPos + mix(vec2(0.0), (uMousePos - 0.5), uTrackMouse);
  vec2 pos = mix(uPos, mPos, floor(uMixRadius));

  float rawDist = max(0.0, 1.0 - distance(uv * vec2(aspectRatio,1.0), mPos * vec2(aspectRatio,1.0)) * 4.0 * (1.0 - uMixRadius));
  if(uMixRadiusInvert == 1){ rawDist = 1.0 - rawDist; }
  float dist = ease(uEasing, rawDist);

  vec4 color = texture2D(tInput, uv + offset * dist);
  gl_FragColor = color;
}
```

## A5. Bokeh pre-pass 5 "bokeh" (blue-noise blur) FRAGMENT

_4d3f3b68dbbde33a.js:12842_ — tBlueNoise = 128x128 random grey DataTexture (RepeatWrapping), uBlueNoiseResolution (128,128), uAmount = 3.125*0.754, uTilt .5, uPos (0.5,-0.1), uTrackMouse 0

```glsl
precision mediump float;
precision mediump int;
varying vec2 vUv;
uniform sampler2D tInput;
uniform sampler2D tBlueNoise;
uniform float uAmount;
uniform float uTilt;
uniform float uTime;
uniform vec2 uPos;
uniform vec2 uResolution;
uniform vec2 uBlueNoiseResolution;
uniform vec2 uMousePos;
uniform float uTrackMouse;

#define PI 3.14159265
#define PI2 6.28318530718
// 优化：降低采样迭代次数 (原 50.0 -> 24.0) 以大幅提升性能
#define ITERATIONS 32.0
#define GOLDEN_ANGLE 2.39996323

vec2 Sample(in float theta, inout float r) {
  r += 1.0 / r;
  return (r - 1.0) * vec2(cos(theta), sin(theta));
}

float getBlueNoiseOffset(vec2 st) {
  vec2 texSize = uBlueNoiseResolution;
  vec2 uv = fract(st * (uResolution/texSize) * vec2(texSize.x/texSize.y, 1.0));
  vec4 blueNoise = texture2D(tBlueNoise, uv);
  return mod((blueNoise.r - 0.5) * PI2, PI2);
}

vec4 Bokeh(sampler2D tex, vec2 uv, float blurRadius) {
  vec3 accumulatedColor = vec3(0.0);
  vec3 accumulatedWeights = vec3(0.0);
  float accumulatedAlpha = 0.0;
  float aspectRatio = uResolution.x / uResolution.y;
  vec2 basePixelSize = vec2(1.0 / aspectRatio, 1.0) * 0.04 * 0.075;
  float r = 1.0;
  float noiseOffset = (getBlueNoiseOffset(uv) - 0.5) * 0.01;
  float noiseAngle = noiseOffset * PI2;
  mat2 rotationMatrix = mat2(
    cos(noiseAngle), -sin(noiseAngle),
    sin(noiseAngle),  cos(noiseAngle)
  );
  for (float j = 0.0; j < GOLDEN_ANGLE * ITERATIONS; j += GOLDEN_ANGLE) {
    vec2 offset = Sample(j, r) * basePixelSize * blurRadius;
    float jitterAmount = 0.05 * (sin(j * 0.1) * 0.5 + 0.5);
    offset *= 1.0 + jitterAmount * sin(j * 0.7 + noiseOffset);
    vec2 sampleOffset = rotationMatrix * offset;
    vec4 colorSample = texture2D(tex, uv + sampleOffset);
    // Render targets are in Three.js working space (linear) by default.
    vec3 linearSample = colorSample.rgb;
    vec3 bokehWeight = vec3(5.0) + pow(linearSample, vec3(9.0)) * 150.0;
    accumulatedAlpha += colorSample.a;
    accumulatedColor += linearSample * bokehWeight;
    accumulatedWeights += bokehWeight;
  }
  vec3 linearOut = accumulatedColor / accumulatedWeights;
  return vec4(linearOut, accumulatedAlpha / ITERATIONS);
}

void main() {
  vec2 uv = vUv;
  if(uAmount == 0.0) { gl_FragColor = vec4(0.0); return; }
  vec2 pos = uPos + mix(vec2(0.0), (uMousePos - 0.5), uTrackMouse);
  float dis = distance(uv, pos) * 1000.0;
  float tilt = mix(1.0 - dis * 0.001, dis * 0.001, uTilt);
  float blurRadius = uAmount * tilt;
  gl_FragColor = Bokeh(tInput, uv, blurRadius);
}
```

## A6. Bokeh OUTPUT composite FRAGMENT (drawn on fullscreen plane, renderOrder -10, in main scene)

_4d3f3b68dbbde33a.js:12853_ — uBgColor (=bg color), uOutputColor (light #acffb9 / dark #00344C), uLoaded 1, uOutputMix (light .65 / dark .95). tInput = last ping-pong RT.

```glsl
precision mediump float;
precision mediump int;
varying vec2 vUv;
uniform sampler2D tInput;
uniform vec3 uBgColor;
uniform vec3 uOutputColor;
uniform int uLoaded;
// 可调输出混合权重（0.0~1.0），用于替代固定 0.6
uniform float uOutputMix;
// 方案A：更接近 before.js 的合成逻辑 (base * mix(1, blend, 0.26))

vec3 overlay(vec3 base, vec3 blend){
  return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), step(0.5, base));
}

void main(){
  if(uLoaded!=1){
    gl_FragColor = vec4(197./255.,136./255.,122./255.,1.);
    return;
  }

  // uBgColor/uOutputColor are provided in Three.js working space (linear).
  vec3 bgTex = vec3(1.0); // 无背景贴图时近似常量
  vec3 base = mix(uBgColor, overlay(uBgColor, bgTex), 0.61);

  vec4 inTex = texture2D(tInput, vUv);
  // 作为 tint 加色，不依赖 alpha，保证 OUTPUT_COLOR 可见
  vec3 tint = uOutputColor * 0.35;
  vec3 blend = clamp(inTex.rgb + tint, 0.0, 1.0);
  vec3 finalColor = base * mix(vec3(1.0), blend, clamp(uOutputMix, 0.0, 1.0));
  
  gl_FragColor = vec4(finalColor, 1.0);
  
  #include <colorspace_fragment>
}
```

## A7. Bokeh OUTPUT VERTEX (clip-space fullscreen)

_4d3f3b68dbbde33a.js:12861_

```glsl
precision mediump float;
precision mediump int;

varying vec2 vUv;

void main() {
  vUv = uv;
  // Render in clip-space to fill the screen, ignoring camera transforms
  gl_Position = vec4(position, 1.0);
}
```

## B. Scene dot-overlay (s1) VERTEX — the cream "grid" layer

_4d3f3b68dbbde33a.js:13176_ — Fullscreen plane, renderOrder 10, transparent, depthTest/Write false, toneMapped false.

```glsl

          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
```

## B. Scene dot-overlay (s1) FRAGMENT

_4d3f3b68dbbde33a.js:13184_ — uColor = dark "#0F1111" / light "#FBFAF4"; uOpacity = sP (scene progress, see spec); uPixelSize 4 (CSS px, NOT multiplied by dpr); uRadiusScale 0.9; uResolution = canvas CSS size.

```glsl

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
```

## C. Falling stickers (instanced atlas) VERTEX

_4d3f3b68dbbde33a.js:13289_ — InstancedMesh(PlaneGeometry(2,2) + InstancedBufferAttribute uvRect(4), max 2048)

```glsl

attribute vec4 uvRect;

varying vec2 vAtlasUv;

void main() {
  vAtlasUv = uvRect.xy + uv * uvRect.zw;

  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
```

## C. Falling stickers FRAGMENT

_4d3f3b68dbbde33a.js:13301_ — transparent, depthWrite false, FrontSide, toneMapped false

```glsl

uniform sampler2D map;

varying vec2 vAtlasUv;

void main() {
  vec4 color = texture2D(map, vAtlasUv);
  if (color.a < 0.01) discard;

  gl_FragColor = color;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
```

## D. Glass models (hello.gltf / cursor.glb / cnt.gltf) VERTEX

_4d3f3b68dbbde33a.js:17568_

```glsl
varying vec3 worldNormal;
varying vec3 eyeVector;
varying float modelLocalY;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * worldPos;

  gl_Position = projectionMatrix * mvPosition;

  // vec3 transformedNormal = modelMatrix * normal;
  worldNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
  eyeVector = normalize(worldPos.xyz - cameraPosition);
  modelLocalY = position.y;
}
```

## D. Glass models FRAGMENT (custom refraction, NOT MeshPhysicalMaterial)

_4d3f3b68dbbde33a.js:17570_ — See CLONE_SPEC.md §WebGL/Glass for uniform values. toneMapped false, transparent true.

```glsl
uniform float uIorR;
uniform float uIorY;
uniform float uIorG;
uniform float uIorC;
uniform float uIorB;
uniform float uIorP;

uniform float uSaturation;
uniform float uChromaticAberration;
uniform float uRefractPower;
uniform float uFresnelPower;
uniform float uShininess;
uniform float uDiffuseness;
uniform vec3 uLight;
// New tone controls
uniform float uBrightness;      // scales base refracted color
uniform float uContrast;        // adjusts contrast around 0.5
uniform float uGamma;           // gamma correction (1.0 = neutral)
uniform float uSpecularStrength;// scales specular contribution
uniform float uFresnelStrength; // scales fresnel contribution
uniform vec3 uFresnelSideDir;   // fresnel side direction (world space)

// Tint controls for colored glass effect
uniform vec4 uTintColorA;      // gradient color A (rgb) + alpha
uniform vec4 uTintColorB;      // gradient color B (rgb) + alpha
uniform vec2 uTintLocalYRange; // model local y min/max for vertical gradient normalization
uniform float uTintEnabled;   // 0.0 = off, 1.0 = on
uniform float uTintMix;       // blend amount [0,1]
uniform float uTintThicknessMinAlpha; // min alpha at grazing angles [0,1]
uniform float uTintThicknessMaxAlpha; // max alpha at facing angles [0,1]

uniform vec2 uScreenResolutionPx;
uniform sampler2D uTexture;
// 1.0：多采样折射；0.0：单次采样（FBO skip 时省算力，遮罩全屏时几乎不可见）
uniform float uSceneRefractionEnabled;
// 1.0：每 loop 三次 texture2D（RGB）；0.0：六通道光谱路径
uniform float uRgbRefraction;

// 0.0 = Beer-Lambert transmission, 1.0 = Hard Light duotone mix
uniform float uDark;

varying vec3 worldNormal;
varying vec3 eyeVector;
varying float modelLocalY;

float random(vec2 p){
  return fract(sin(dot(p.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec3 sat(vec3 rgb, float adjustment) {
  const vec3 W = vec3(0.2125, 0.7154, 0.0721);
  vec3 intensity = vec3(dot(rgb, W));
  return mix(intensity, rgb, adjustment);
}

float fresnel(vec3 eyeDir, vec3 normal, float power) {
  float fresnelFactor = abs(dot(eyeDir, normal));
  float inversefresnelFactor = 1.0 - fresnelFactor;
  return pow(inversefresnelFactor, power);
}

float specular(vec3 light, vec3 normal, vec3 eyeDir, float shininess, float diffuseness) {
  vec3 lightVector = normalize(-light);
  vec3 halfVector = normalize(eyeDir + lightVector);

  float NdotL = dot(normal, lightVector);
  float NdotH = abs(dot(normal, halfVector));
  float kDiffuse = max(0.0, NdotL);

  float kSpecular = pow(NdotH, shininess);
  // 可选：使用 smoothstep 进一步柔化高光边缘
  // kSpecular = smoothstep(0.0, 1.0, kSpecular);
  return kSpecular + kDiffuse * diffuseness;
}

uniform int uLoop;

void main() {
  vec2 uv = gl_FragCoord.xy / uScreenResolutionPx.xy;
  // 确保法线归一化，这对平滑高光至关重要
  vec3 normal = normalize(worldNormal);
  vec3 eyeDir = normalize(eyeVector);
  vec3 color;

  if (uSceneRefractionEnabled > 0.5) {
    color = vec3(0.0);

    float noiseIntensity = 0.025;
    float noise = random(uv) * noiseIntensity;

    if (uRgbRefraction > 0.5) {
      vec3 refractVecR = refract(eyeDir, normal, (1.0 / uIorR));
      vec3 refractVecG = refract(eyeDir, normal, (1.0 / uIorG));
      vec3 refractVecB = refract(eyeDir, normal, (1.0 / uIorB));

      for (int i = 0; i < uLoop; i++) {
        float slide = float(i) / float(uLoop) * 0.1 + noise;
        float offset = (uRefractPower + slide) * uChromaticAberration;

        color.r += texture2D(uTexture, uv + refractVecR.xy * offset).r;
        color.g += texture2D(uTexture, uv + refractVecG.xy * offset).g;
        color.b += texture2D(uTexture, uv + refractVecB.xy * offset).b;
      }
    } else {
      vec3 refractVecR = refract(eyeDir, normal, (1.0 / uIorR));
      vec3 refractVecY = refract(eyeDir, normal, (1.0 / uIorY));
      vec3 refractVecG = refract(eyeDir, normal, (1.0 / uIorG));
      vec3 refractVecC = refract(eyeDir, normal, (1.0 / uIorC));
      vec3 refractVecB = refract(eyeDir, normal, (1.0 / uIorB));
      vec3 refractVecP = refract(eyeDir, normal, (1.0 / uIorP));

      for (int i = 0; i < uLoop; i++) {
        float slide = float(i) / float(uLoop) * 0.1 + noise;

        float offsetR = (uRefractPower + slide * 1.0) * uChromaticAberration;
        float offsetY = (uRefractPower + slide * 1.0) * uChromaticAberration;
        float offsetG = (uRefractPower + slide * 2.0) * uChromaticAberration;
        float offsetC = (uRefractPower + slide * 2.5) * uChromaticAberration;
        float offsetB = (uRefractPower + slide * 3.0) * uChromaticAberration;
        float offsetP = (uRefractPower + slide * 1.0) * uChromaticAberration;

        float r = texture2D(uTexture, uv + refractVecR.xy * offsetR).x * 0.5;

        vec3 ySample = texture2D(uTexture, uv + refractVecY.xy * offsetY).xyz;
        float y = (ySample.x * 2.0 + ySample.y * 2.0 - ySample.z) / 6.0;

        float g = texture2D(uTexture, uv + refractVecG.xy * offsetG).y * 0.5;

        vec3 cSample = texture2D(uTexture, uv + refractVecC.xy * offsetC).xyz;
        float c = (cSample.y * 2.0 + cSample.z * 2.0 - cSample.x) / 6.0;

        float b = texture2D(uTexture, uv + refractVecB.xy * offsetB).z * 0.5;

        vec3 pSample = texture2D(uTexture, uv + refractVecP.xy * offsetP).xyz;
        float p = (pSample.z * 2.0 + pSample.x * 2.0 - pSample.y) / 6.0;

        float R = r + (2.0 * p + 2.0 * y - c) / 3.0;
        float G = g + (2.0 * y + 2.0 * c - p) / 3.0;
        float B = b + (2.0 * c + 2.0 * p - y) / 3.0;

        color.r += R;
        color.g += G;
        color.b += B;
      }
    }

    color /= float(uLoop);
  } else {
    color = texture2D(uTexture, uv).rgb;
  }

  color = sat(color, uSaturation);

  // Tone adjustments to counter light/dark inversion
  color *= uBrightness;
  color = (color - 0.5) * uContrast + 0.5;
  // prevent division by zero; apply gamma correction
  float invGamma = 1.0 / max(uGamma, 0.0001);
  color = pow(max(color, 0.0), vec3(invGamma));

  // 有色玻璃透射/混合：保持原计算逻辑不变
  // uDark = 0 -> Beer-Lambert
  // uDark = 1 -> Hard Light
  float mode = clamp(uDark, 0.0, 1.0);

  // --- Beer-Lambert (原逻辑) ---
  float localYMin = uTintLocalYRange.x;
  float localYMax = uTintLocalYRange.y;
  float localYDenominator = max(localYMax - localYMin, 1e-5);
  float tintGradientFactor = clamp((modelLocalY - localYMin) / localYDenominator, 0.0, 1.0);
  vec4 tintColorGradient = mix(uTintColorB, uTintColorA, tintGradientFactor);

  float ndotv = abs(dot(normal, eyeDir));
  float thicknessMask = clamp(1.0 - ndotv, 0.0, 1.0);
  float tintAlpha = clamp(tintColorGradient.a, 0.0, 1.0);
  float minAlpha = clamp(uTintThicknessMinAlpha, 0.0, 1.0);
  float maxAlpha = clamp(uTintThicknessMaxAlpha, 0.0, 1.0);
  tintAlpha *= mix(maxAlpha, minAlpha, thicknessMask);

  float tintK_beer = clamp(uTintEnabled, 0.0, 1.0) * tintAlpha;
  vec3 tintColorClamped = clamp(tintColorGradient.rgb, 0.001, 1.0);
  float thickness = clamp(uTintMix, 0.01, 3.0);
  vec3 transmittance = pow(tintColorClamped, vec3(thickness));
  vec3 beerColor = mix(color, color * transmittance, tintK_beer);

  // --- Hard Light (原逻辑) ---
  float tintK_hard = clamp(uTintEnabled, 0.0, 1.0) * clamp(uTintMix, 0.0, 1.0) * tintAlpha;
  vec3 baseClamped = clamp(color, 0.0, 1.0);
  vec3 blendClamped = clamp(tintColorGradient.rgb, 0.0, 1.0);
  vec3 h = step(vec3(0.5), blendClamped);
  vec3 hard = mix(2.0 * baseClamped * blendClamped,
                  1.0 - 2.0 * (1.0 - blendClamped) * (1.0 - baseClamped),
                  h);
  vec3 hardColor = mix(color, hard, tintK_hard);

  color = mix(beerColor, hardColor, mode);

  // Specular
  float specularLight = specular(uLight, normal, eyeDir, uShininess, uDiffuseness);
  color += specularLight * uSpecularStrength;

  // Fresnel
  float f = fresnel(eyeDir, normal, uFresnelPower);
  float sideDot = dot(normal, normalize(uFresnelSideDir));
  float sideMask = smoothstep(-0.5, 0.5, sideDot);
  color.rgb += f * sideMask * vec3(uFresnelStrength);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
```

## E. Hyper-space giant cursor VERTEX

_4d3f3b68dbbde33a.js:17917_

```glsl
varying vec3 vWorldNormal;
varying vec3 vEyeVector;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * worldPos;

  gl_Position = projectionMatrix * mvPosition;

  vWorldNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
  vEyeVector = normalize(worldPos.xyz - cameraPosition);
}
```

## E. Hyper-space giant cursor FRAGMENT (warp-speed stripes painted in screen space on the cursor mesh)

_4d3f3b68dbbde33a.js:17919_ — iResolution=(w*dpr,h*dpr,1), iTime = 0..2 from scroll, uScrollDuration 2, uOpacity 1, uAccentColor #009dff, uStripeColorA #009dff, uStripeColorB #64c3ff, uStripeReveal 0..1, lighting uniforms from glass controls. renderOrder 12, transparent, depthWrite false, depthTest true, FrontSide, toneMapped false.

```glsl
uniform vec3 iResolution;
uniform float iTime;
uniform float uScrollDuration;

uniform vec3 uAccentColor;
uniform vec3 uStripeColorA;
uniform vec3 uStripeColorB;
uniform float uStripeReveal;

uniform float uOpacity;
uniform vec3 uLight;
uniform float uShininess;
uniform float uDiffuseness;
uniform float uSpecularStrength;
uniform float uFresnelPower;
uniform float uFresnelStrength;
uniform vec3 uFresnelSideDir;

varying vec3 vWorldNormal;
varying vec3 vEyeVector;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 sampleHyperspace(vec2 fragCoord) {
  vec2 R = iResolution.xy;
  float baseScale = max(1.0, min(R.x, R.y));
  vec2 u = (fragCoord * 2.0 - R) / baseScale;

  float dur = max(uScrollDuration, 1e-4);
  float time = clamp(iTime, 0.0, dur);
  float t = clamp(time / dur, 0.0, 1.0);

  const float cellDensity = 100.0;
  vec2 polar = vec2(atan(u.y, u.x) / 3.0, length(u));
  float angleCoord = (6.0 - polar.x) * cellDensity;
  float angleId = floor(angleCoord) + 0.5;
  float angleCell = abs(fract(angleCoord) - 0.5);
  float radialCoord = (6.0 - polar.y) * cellDensity;
  vec2 q = vec2(angleId, radialCoord);

  float travel = smoothstep(0.0, 1.0, t);
  float keepProbability = mix(0.18, 1.0, travel);
  float scrollSpeed = mix(0.7, 3.6, travel);
  float trailLength = mix(2.7, 0.975, travel);
  float raySeq = fract((angleId + 0.5) * 0.61803398875);
  float keepEdge = 0.025;
  float keepMask = 1.0 - smoothstep(keepProbability - keepEdge, keepProbability + keepEdge, raySeq);

  float phaseBase = (q.y * 0.02 + q.x * 0.4) * fract(q.x * 0.61);
  vec4 spark = max(
    1.0 - fract(vec4(7.0, 6.0, 4.0, 0.0) * 0.02 + phaseBase + time * scrollSpeed) * trailLength,
    0.0
  );

  float channelMix = max(max(spark.r, spark.g), spark.b);
  float edge = max(fwidth(channelMix) * 1.5, 2.0 / max(iResolution.y, 1.0));
  float star = smoothstep(0.12 - edge, 0.12 + edge, channelMix);

  const float starThinness = 0.13;
  float thinEdge = max(fwidth(angleCell) * 1.5, 0.002);
  float thinMask = 1.0 - smoothstep(starThinness - thinEdge, starThinness + thinEdge, angleCell);
  star *= thinMask * keepMask;

  float radialBoost = pow(smoothstep(0.1, 1.0, polar.y), 1.25);
  float intensity = mix(0.0, 6.5, t * 1.2);

  float stripeBlend = hash21(vec2(angleId, 19.713));
  vec3 stripeRgb = mix(uStripeColorA, uStripeColorB, stripeBlend);

  vec3 hsvA = rgb2hsv(max(uStripeColorA, vec3(1e-5)));
  vec3 hsvB = rgb2hsv(max(uStripeColorB, vec3(1e-5)));
  float dh = abs(hsvA.x - hsvB.x);
  dh = min(dh, 1.0 - dh);
  float hueBand = clamp(dh * 1.25 + 0.04, 0.07, 0.24);

  vec3 hsv = rgb2hsv(max(stripeRgb, vec3(1e-5)));
  float idHash = hash21(vec2(angleId, 6.18));
  float idHash2 = hash21(vec2(angleId, 91.7));

  float scrollPhase = time * scrollSpeed;
  float hueAnim =
    sin(scrollPhase * 0.52 + angleId * 0.29 + idHash * 6.2831853) * (hueBand * 0.85);
  float hueStripe = (idHash - 0.5) * hueBand * 2.0;

  hsv.x = fract(hsv.x + hueStripe + hueAnim);
  hsv.y = clamp(hsv.y * mix(0.96, 1.06, idHash2), 0.0, 1.0);
  hsv.z = clamp(hsv.z * mix(0.97, 1.05, idHash), 0.0, 1.0);

  vec3 sparkColor = hsv2rgb(hsv);
  float pulse = mix(0.78, 1.0, smoothstep(0.14, 0.5, channelMix));
  sparkColor *= pulse;

  return intensity * radialBoost * sparkColor * star;
}

float fresnel(vec3 eyeDir, vec3 normal, float power) {
  float fresnelFactor = abs(dot(eyeDir, normal));
  float inversefresnelFactor = 1.0 - fresnelFactor;
  return pow(inversefresnelFactor, power);
}

float specular(vec3 light, vec3 normal, vec3 eyeDir, float shininess, float diffuseness) {
  vec3 lightVector = normalize(-light);
  vec3 halfVector = normalize(eyeDir + lightVector);

  float NdotL = dot(normal, lightVector);
  float NdotH = abs(dot(normal, halfVector));
  float kDiffuse = max(0.0, NdotL);

  float kSpecular = pow(NdotH, shininess);
  return kSpecular + kDiffuse * diffuseness;
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec3 stripes = sampleHyperspace(fragCoord);

  float reveal = clamp(uStripeReveal, 0.0, 1.0);

  float stripeLuma = dot(stripes, vec3(0.299, 0.587, 0.114));
  // 蓝→黑：全屏前压到纯黑底；满 reveal 不再填 accent，间隙为 #000
  float darken = smoothstep(0.0, 0.88, reveal);
  vec3 darkBase = mix(uAccentColor, vec3(0.0), darken);
  float gapMask = (1.0 - smoothstep(0.035, 0.12, stripeLuma)) * reveal;
  float crackGuard = 1.0 - smoothstep(0.68, 0.94, reveal);
  vec3 rgb = darkBase + stripes * reveal + uAccentColor * gapMask * 0.07 * crackGuard;

  vec3 normal = normalize(vWorldNormal);
  // DoubleSide：背面剔除关掉后须翻转法线，否则高光/Fresnel 在背对相机时会错且易像「穿模」
  if (!gl_FrontFacing) {
    normal = -normal;
  }
  vec3 eyeDir = normalize(vEyeVector);

  float glossMask = mix(1.0, smoothstep(0.1, 0.48, stripeLuma), reveal);

  float specularLight = specular(uLight, normal, eyeDir, uShininess, uDiffuseness);
  rgb += specularLight * uSpecularStrength * glossMask;

  float f = fresnel(eyeDir, normal, uFresnelPower);
  float sideDot = dot(normal, normalize(uFresnelSideDir));
  float sideMask = smoothstep(-0.5, 0.5, sideDot);
  rgb += f * sideMask * vec3(uFresnelStrength) * glossMask;

  float alpha = clamp(uOpacity, 0.0, 1.0);
  if (alpha <= 0.0001) discard;

  gl_FragColor = vec4(rgb, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
```

## F. Project/about image layers VERTEX (clip-space fullscreen quad; rect done in frag)

_4d3f3b68dbbde33a.js:18019_

```glsl
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
```

## F. Project/about image layers FRAGMENT (DOM-synced images: negative->positive reveal, hover square-dot wipe, scroll curl)

_4d3f3b68dbbde33a.js:18021_ — renderOrder 20, transparent, depthTest/Write false, polygonOffset -1/-1, toneMapped false. uDotPixelSize 18.

```glsl
uniform float uCurlStrength;

vec2 applyCurl(vec2 screenUv) {
  float centered = 2.0 * screenUv.y - 1.0;
  float profile = 1.0 - sqrt(max(0.0, 1.0 - centered * centered));
  float uvScale = 1.0 - profile * uCurlStrength;
  float distortedX = (screenUv.x - 0.5) * uvScale + 0.5;
  return vec2(distortedX, screenUv.y);
}

uniform sampler2D map;
uniform sampler2D mapHover;
uniform vec4 uRect;
uniform float uPolarityPositive;
uniform float uLayerOpacity;
uniform float uRevealProgress;
uniform float uRevealSoftness;
uniform float uRevealDirection;
uniform float uHoverRevealProgress;
uniform float uDotPixelSize;
uniform vec2 uViewportPx;
varying vec2 vUv;

vec3 applyPolarity(vec3 rgb) {
  float t = clamp(uPolarityPositive, 0.0, 1.0);
  return mix(1.0 - rgb, rgb, t);
}

float hoverDotCoverage(vec2 screenUv) {
  float hoverProgress = clamp(uHoverRevealProgress, 0.0, 1.0);
  if (hoverProgress <= 0.0) return 0.0;

  vec2 viewportPx = max(uViewportPx, vec2(1.0));
  float dotPx = max(2.0, uDotPixelSize);
  vec2 cellSizeUv = vec2(dotPx) / viewportPx;
  vec2 safeCellSize = max(cellSizeUv, vec2(1.0 / 4096.0));

  float rectWidthPx = max(uRect.z * uViewportPx.x, 1.0);
  float rectHeightPx = max(uRect.w * uViewportPx.y, 1.0);
  float rectAspect = max(rectWidthPx / rectHeightPx, 1e-5);
  vec2 localUv = (screenUv - uRect.xy) / uRect.zw;
  vec2 centered = localUv * 2.0 - 1.0;
  centered.x *= rectAspect;
  float distToCenter = length(centered);

  float maxRadius = sqrt(1.0 + rectAspect * rectAspect);
  // 拉长中心向外的过渡环宽度，让 hover 扩散更柔和，不会出现短促硬边
  float revealBand = max(length(safeCellSize) * 18.0, 0.08);
  float revealRadius = hoverProgress * (maxRadius + revealBand);
  float grow = clamp((revealRadius - distToCenter) / revealBand, 0.0, 1.0);
  grow = smoothstep(0.0, 1.0, grow);

  vec2 cellUv = fract(screenUv / safeCellSize);
  vec2 cellFromCenter = abs(cellUv - vec2(0.5));
  float squareExtent = mix(0.0, 0.5, grow);
  float squareDist = max(cellFromCenter.x, cellFromCenter.y);
  float squareAa = max(fwidth(squareDist), 0.0001) * 1.5;
  if (squareExtent <= squareAa) {
    return 0.0;
  }
  if (grow >= 0.999) {
    return 1.0;
  }
  float squareMask = 1.0 - smoothstep(
    squareExtent - squareAa,
    squareExtent + squareAa,
    squareDist
  );

  return squareMask;
}

/** hover 未生效时 0；此时跳过 mapHover 采样省一半 tex2D（mip-0 路径下分支安全） */
vec4 sampleSourceRgba(vec2 localUv, float hoverCoverage) {
  vec2 lu = clamp(localUv, 0.0, 1.0);
  vec4 baseColor = texture2D(map, lu);
  if (hoverCoverage < 0.001) return baseColor;
  vec4 hoverColor = texture2D(mapHover, lu);
  return mix(baseColor, hoverColor, clamp(hoverCoverage, 0.0, 1.0));
}

/** 边缘 AA；aaRef = fwidth(localUv)，下限避免除零 */
float edgeAaMask(vec2 uv, vec2 aaRef) {
  vec2 edgeDist = min(uv, 1.0 - uv);
  float xClip = smoothstep(0.0, aaRef.x, edgeDist.x);
  float yClip = smoothstep(0.0, aaRef.y, edgeDist.y);
  return xClip * yClip;
}

void main() {
  vec2 distortedScreenUv = applyCurl(vUv);
  vec2 revealLocalUv = (vUv - uRect.xy) / uRect.zw;
  vec2 localUv = (distortedScreenUv - uRect.xy) / uRect.zw;

  vec2 aa = max(fwidth(localUv), vec2(1e-5));

  float revealProgress = clamp(uRevealProgress, 0.0, 1.0);
  float revealMask = 1.0;
  if (revealProgress <= 0.001) {
    revealMask = 0.0;
  } else if (revealProgress < 0.999) {
    float revealCoord = uRevealDirection < 0.0 ? 1.0 - revealLocalUv.x : revealLocalUv.x;
    float revealFeather = max(uRevealSoftness, 0.0);
    revealMask = revealFeather <= 0.0
      ? step(revealCoord, revealProgress)
      : 1.0 - smoothstep(
          revealProgress - revealFeather,
          revealProgress + revealFeather,
          revealCoord
        );
  }

  float hoverCov = hoverDotCoverage(vUv);
  vec4 sourceColor = sampleSourceRgba(localUv, hoverCov);
  float inside = edgeAaMask(localUv, aa);
  float outA = sourceColor.a * inside * revealMask * clamp(uLayerOpacity, 0.0, 1.0);
  if (outA < 0.001) {
    discard;
  }

  vec3 sourcePolar = applyPolarity(sourceColor.rgb);
  gl_FragColor = vec4(sourcePolar, outA);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
```

## G. Shared fullscreen VERTEX for LensFlarePass (minified, verbatim)

_4d3f3b68dbbde33a.js:18229_

```glsl
varying vec2 vUv;void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,1.0,1.0);}
```

## H. Shared fullscreen VERTEX for FluidPushPass sim materials

_4d3f3b68dbbde33a.js:18442_

```glsl
varying vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
```

## H1. Fluid: curl FRAGMENT

_4d3f3b68dbbde33a.js:18495_

```glsl
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
varying vec2 vUv;

void main() {
  float left = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
  float right = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
  float top = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
  float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
  float value = 0.5 * (right - left - top + bottom);
  gl_FragColor = vec4(value, 0.0, 0.0, 1.0);
}
```

## H2. Fluid: vorticity + pointer splat FRAGMENT

_4d3f3b68dbbde33a.js:18499_

```glsl
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexelSize;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec2 uPointerDelta;
uniform float uCurlStrength;
uniform float uSplatRadius;
uniform float uSplatForce;
varying vec2 vUv;

void main() {
  float left = abs(texture2D(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x);
  float right = abs(texture2D(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x);
  float top = abs(texture2D(uCurl, vUv + vec2(0.0, uTexelSize.y)).x);
  float bottom = abs(texture2D(uCurl, vUv - vec2(0.0, uTexelSize.y)).x);
  float center = texture2D(uCurl, vUv).x;

  vec2 force = vec2(top - bottom, right - left);
  float forceLength = length(force);
  if (forceLength > 0.0001) {
    force /= forceLength;
  } else {
    force = vec2(0.0);
  }

  force *= uCurlStrength * center;
  force.y *= -1.0;

  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity += force * 0.016;
  velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));

  vec2 mouseUv = uPointer / max(uResolution, vec2(0.0001));
  vec2 diff = vUv - mouseUv;
  diff.x *= uResolution.x / max(uResolution.y, 0.0001);
  float pointerMask = exp(-dot(diff, diff) / max(uSplatRadius, 0.0001));
  velocity += (uPointerDelta / max(uResolution, vec2(0.0001))) * pointerMask * uSplatForce;

  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
```

## H3. Fluid: divergence FRAGMENT

_4d3f3b68dbbde33a.js:18513_

```glsl
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
varying vec2 vUv;

void main() {
  float left = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
  float right = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
  float top = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
  float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
  float divergence = 0.5 * (right - left + top - bottom);
  gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
}
```

## H4. Fluid: pressure (Jacobi) FRAGMENT

_4d3f3b68dbbde33a.js:18521_

```glsl
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;
varying vec2 vUv;

void main() {
  float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float divergence = texture2D(uDivergence, vUv).x;
  float pressure = (left + right + top + bottom - divergence) * 0.25;
  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
```

## H5. Fluid: gradient subtract FRAGMENT

_4d3f3b68dbbde33a.js:18529_

```glsl
uniform sampler2D uVelocity;
uniform sampler2D uPressure;
uniform vec2 uTexelSize;
varying vec2 vUv;

void main() {
  float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity -= vec2(right - left, top - bottom);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
```

## H6. Fluid: advect/dissipate FRAGMENT

_4d3f3b68dbbde33a.js:18537_

```glsl
uniform sampler2D uVelocity;
uniform sampler2D uProjectedVelocity;
uniform vec2 uTexelSize;
uniform float uDissipation;
varying vec2 vUv;

void main() {
  vec2 velocity = texture2D(uProjectedVelocity, vUv).xy;
  vec2 coord = clamp(vUv - velocity * uTexelSize * 0.016, 0.0, 1.0);
  vec2 advected = texture2D(uProjectedVelocity, coord).xy;
  advected /= 1.0 + uDissipation * 0.016;
  gl_FragColor = vec4(advected, 0.0, 1.0);
}
```

## H7. Fluid DISPLAY FRAGMENT (chromatic displacement + lime #c0fe04 pixel pointer trail)

_4d3f3b68dbbde33a.js:18546_ — Final pass to screen. Pointer overlay uniforms: uTrail[16], uTrailStrength[16], uTrailCount 14, uPointerColor #c0fe04, uPointerOpacity 0|1, uPointerDotRadius .8, uPointerPixelSize 16, uResolution, uDevicePixelRatio.

```glsl
uniform sampler2D tDiffuse;
uniform sampler2D uVelocity;
uniform vec2 uSimSize;
uniform float uDisplacementStrength;
uniform float uChromaticBoost;
uniform float uEffectEnabled;

vec3 spectrum(float x) {
  return cos((x - vec3(0.0, 0.5, 1.0)) * vec3(0.6, 1.0, 0.5) * 3.14);
}

vec4 getFluidDisplayColor(vec2 uv) {
  vec2 velocity = texture2D(uVelocity, uv).xy;
  float effectEnabled = step(0.5, uEffectEnabled);
  vec2 displacement = velocity / max(uSimSize, vec2(1.0)) * uDisplacementStrength * effectEnabled;
  float velocityMagnitude = length(displacement);

  const int samples = 4; // 采样次数
  vec4 color = vec4(0.0);
  vec3 weightSum = vec3(0.0);

  for (int index = 0; index < samples; index++) {
    float t = float(index) / float(samples - 1);
    vec3 weight = max(vec3(0.0), cos((t - vec3(0.0, 0.5, 1.0)) * 3.14159 * 0.5));
    vec4 sampleColor = texture2D(tDiffuse, clamp(uv - displacement * 0.3 * (t + 0.3) * velocityMagnitude, 0.0, 1.0));
    color.rgb += sampleColor.rgb * weight;
    color.a += sampleColor.a * (weight.r + weight.g + weight.b) / 3.0;
    weightSum += weight;
  }

  color.rgb /= max(weightSum, vec3(0.0001));
  color.a /= max((weightSum.r + weightSum.g + weightSum.b) / 3.0, 0.0001);

  vec3 spectralHighlight = spectrum(sin(velocityMagnitude * 2.0) * 0.4 + 0.6);
  color.rgb += spectralHighlight * smoothstep(0.2, 0.8, velocityMagnitude) * 0.5 * uChromaticBoost * effectEnabled;

  return color;
}

uniform vec2 uTrail[16];
uniform float uTrailStrength[16];
uniform float uTrailCount;
uniform vec3 uPointerColor;
uniform float uPointerOpacity;
uniform float uPointerDotRadius;
uniform float uPointerPixelSize;
uniform vec2 uResolution;
uniform float uDevicePixelRatio;

float cellEquals(vec2 a, vec2 b) {
  vec2 d = abs(a - b);
  return 1.0 - step(0.5, max(d.x, d.y));
}

vec4 applyPointerOverlay(vec2 uv, vec4 baseColor) {
  float cssPixelSize = uPointerPixelSize * max(uDevicePixelRatio, 1.0);
  vec2 normalizedPixelSize = vec2(
    cssPixelSize / max(uResolution.x, 1.0),
    cssPixelSize / max(uResolution.y, 1.0)
  );

  vec2 safePixelSize = max(normalizedPixelSize, vec2(1e-6));
  vec2 cellId = floor(uv / safePixelSize);
  vec2 cellUV = fract(uv / safePixelSize);

  float highlight = 0.0;
  for (int i = 0; i < 16; i++) {
    float enabled = step(float(i), uTrailCount - 1.0);
    vec2 pointerCell = floor(uTrail[i] / safePixelSize);
    float isSame = cellEquals(cellId, pointerCell);
    float weight = clamp(uTrailStrength[i], 0.0, 1.0);
    highlight = max(highlight, enabled * isSame * weight);
  }

  float distToCenter = distance(cellUV, vec2(0.5));
  float aa = fwidth(distToCenter) * 1.5;
  float radius = clamp(uPointerDotRadius, 0.0, 1.0);
  float circleMask = smoothstep(radius, radius - aa, distToCenter);
  float overlayAlpha = circleMask * highlight * clamp(uPointerOpacity, 0.0, 1.0);
  baseColor.rgb = mix(baseColor.rgb, uPointerColor, overlayAlpha);

  return baseColor;
}

varying vec2 vUv;

void main() {
  vec4 color = getFluidDisplayColor(vUv);
  gl_FragColor = applyPointerOverlay(vUv, color);
  #include <colorspace_fragment>
}
```

## I. Lens flare FRAGMENT (star streaks from bright pixels)

_4d3f3b68dbbde33a.js:18917_ — `#include <colorspace_fragment>` is stripped from this one at runtime (regex replace). Uniforms: uStarRays 6, uIntensity .7, uThreshold .99, uStreakScale 8*(width/1920)*(mobile?2:1), uHotspotPower 32, uGate .88, uTailColor light #ffa300 / dark #1600ff, uEnabled 1.

```glsl
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uEnabled;
uniform float uIntensity;
uniform float uThreshold;
uniform float uStreakScale;
uniform float uHotspotPower;
uniform float uGate;
uniform float uStarRays;

uniform vec3 uTailColor;

const float TAIL_MIX = 1.0;
const float TAIL_START = 0.0;
const float TAIL_FALLOFF = 0.5;

varying vec2 vUv;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float brightMask(float lum) {
  // 适配 LDR/sRGB：阈值一般在 0.8~0.95
  float x = max(lum - uThreshold, 0.0);
  float m = x / max(1.0 - uThreshold, 1e-5);
  // smoothstep(0,1,m) 的多项式形式（避免多余 clamp；smoothstep 本身会夹紧）
  m = clamp(m, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);

  float hp = max(uHotspotPower, 1.0);
  if (hp > 1.01) {
    m = pow(m, hp);
  }

  // 线性软门控：减少断裂感且便宜
  float gate = clamp(uGate, 0.0, 1.0);
  float gm = (m - gate) / max(1.0 - gate, 1e-5);
  gm = clamp(gm, 0.0, 1.0);
  return m * gm;
}

vec3 sampleBright(vec2 uv) {
  vec3 c = texture2D(tDiffuse, uv).rgb;
  return c * brightMask(luma(c));
}

vec3 streak(vec2 dirPx) {
  vec3 acc = vec3(0.0);
  // 固定 8 次采样：用“半步相位”打散离散采样间隙（更像连续直线），且不引入 sin/exp
  vec2 pixel = floor(vUv * uResolution);
  float h = fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  float phase = step(0.5, h) * 0.5; // 0 或 0.5（半步）
  for (int i = 1; i <= 8; i++) {
    float fi = float(i);
    // 增加步长以维持拖尾长度 (原 1 -> 1.5)
    float dist = fi * 1.5 + phase;
    // 放缓衰减：视觉上更“长”，同时保持成本低
    float w = 1.0 / (1.0 + dist * 0.22);
    w *= w;

    // 末端颜色：中心偏白，越靠近末端越靠近 uTailColor
    float t = clamp(dist / 8.0, 0.0, 1.0);
    float start = clamp(TAIL_START, 0.0, 0.95);
    float tt = clamp((t - start) / max(1.0 - start, 1e-5), 0.0, 1.0);
    tt = pow(tt, max(TAIL_FALLOFF, 0.001));
    vec3 ramp = mix(vec3(1.0), uTailColor, clamp(TAIL_MIX, 0.0, 1.0) * tt);

    vec2 o = dirPx * dist;
    acc += sampleBright(vUv + o) * (w * ramp);
    acc += sampleBright(vUv - o) * (w * ramp);
  }
  return acc;
}

void main() {
  vec3 flare = vec3(0.0);
  if (uEnabled >= 0.5 && uIntensity > 0.0001) {
    vec3 base = texture2D(tDiffuse, vUv).rgb;
    vec2 px = (1.0 / max(uResolution, vec2(1.0))) * uStreakScale;

    // 中心热点（让亮点像“星芒”有核心）
    flare += base * brightMask(luma(base)) * 1.2;
    // 4/6/8 芒：每条 streak 是“一条线”（包含正反两个方向）
    // 4 芒：0° + 90°（十字）
    // 6 芒：0° + (+60°) + (-60°)（三条线）
    // 8 芒：0° + 90° + (+45°) + (-45°)
    if (uStarRays >= 7.5) {
      // 8 rays
      flare += streak(vec2(px.x, 0.0));
      flare += streak(vec2(0.0, px.y));
      const float c45 = 0.70710678;
      flare += streak(vec2(px.x * c45, px.y * c45));
      flare += streak(vec2(px.x * c45, -px.y * c45));
    } else if (uStarRays >= 5.5) {
      // 6 rays（整体旋转 30°，保证有一根竖线）：90° + (+30°) + (-30°)
      flare += streak(vec2(0.0, px.y));
      const float c30 = 0.8660254;
      const float s30 = 0.5;
      flare += streak(vec2(px.x * c30, px.y * s30));
      flare += streak(vec2(px.x * c30, -px.y * s30));
    } else {
      // 4 rays
      flare += streak(vec2(px.x, 0.0));
      flare += streak(vec2(0.0, px.y));
    }

    // 保持核心尽量中性（末端颜色由 streak 内的 ramp 控制）
  }

  flare *= (uIntensity * 0.75);
  gl_FragColor = vec4(flare, 1.0);
  #include <colorspace_fragment>
}
```

## I. Lens flare COMPOSITE FRAGMENT

_4d3f3b68dbbde33a.js:18919_

```glsl
uniform sampler2D tBase;
uniform sampler2D tFlare;

varying vec2 vUv;

void main() {
  vec3 base = texture2D(tBase, vUv).rgb;
  vec3 flare = texture2D(tFlare, vUv).rgb;

  gl_FragColor = vec4(base + flare, 1.0);
  #include <colorspace_fragment>
}
```

## J. Route/entry/menu transition mask VERTEX (separate fixed canvas, z-30)

_3c6cc5b2fcccdee5.js:452_

```glsl
varying vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
```

## J. Route/entry/menu transition radial mask FRAGMENT

_3c6cc5b2fcccdee5.js:454_ — uColor dark #191b1b / light #efede7, uFeather .8, uAspect w/h, uHoleRadius lerp(sqrt(max(a,1/a)^2+1) -> 0, p), uProgress p. p animates over 0.8s with customCubic.

```glsl
precision highp float;

uniform vec3 uColor;
uniform float uFeather;
uniform float uAspect;
uniform float uHoleRadius;
uniform float uProgress;

varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  if (uAspect > 1.0) {
    p.x *= uAspect;
  } else {
    p.y /= max(uAspect, 0.0001);
  }

  float d = length(p);

  float edge = max(uFeather, uHoleRadius * 0.12);

  // 洞内为 0，洞外为 1。
  float alphaHole = smoothstep(uHoleRadius, uHoleRadius + edge, d);

  // 只在动画结束前一小段把“针孔”补满，让洞像是彻底消失。
  float fillMix = smoothstep(0.92, 1.0, uProgress);
  float alpha = mix(alphaHole, 1.0, fillMix);
  // 预乘 alpha，避免透明像素携带 rgb 导致后期采样出现黑边/暗圈。
  gl_FragColor = vec4(uColor * alpha, alpha);
  #include <colorspace_fragment>
}
```

## J. MaskedDotsEffect (postprocessing Effect, BlendFunction.SRC) fragment

_3c6cc5b2fcccdee5.js:494_ — pixelSize = 16 * dpr, values copied every frame from the mask material.

```glsl
uniform float pixelSize;

uniform float uFeather;
uniform float uAspect;
uniform float uHoleRadius;
uniform float uProgress;
uniform vec3 uOverlayColor;

void dotsMainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 normalizedPixelSize = pixelSize / resolution;
    // 用传入的 inputColor.a 驱动圆点大小：越不透明圆点越大，越透明圆点越小。
    float a = clamp(inputColor.a, 0.0, 1.0);

    vec2 cellUV = fract(uv / normalizedPixelSize);

    // 透明度 -> 圆点半径：a=1 时覆盖整个 cell，避免蒙版填充区漏出底图。
    // sqrt(2)/2 是单位正方形中心到角的距离。
    float radius = 0.8 * a;
    vec2 circleCenter = vec2(0.5, 0.5);

    float distanceFromCenter = distance(cellUV, circleCenter);
    float aa = fwidth(distanceFromCenter) * 1.5;
    float circleMask = smoothstep(radius, radius - aa, distanceFromCenter);

    // 输出为 mask：rgb/alpha 都是 circleMask，供后期用来替换 opacity。
    outputColor = vec4(vec3(circleMask), circleMask);
}

float radialMaskAlpha(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  if (uAspect > 1.0) {
    p.x *= uAspect;
  } else {
    p.y /= max(uAspect, 0.0001);
  }

  float d = length(p);
  float edge = max(uFeather, uHoleRadius * 0.12);

  // 洞内为 0，洞外为 1。
  float alphaHole = smoothstep(uHoleRadius, uHoleRadius + edge, d);

  // 与 radial_mask.frag.glsl 保持一致：末段补满针孔。
  float fillMix = smoothstep(0.92, 1.0, uProgress);
  return mix(alphaHole, 1.0, fillMix);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // 用蒙版 alpha 直接驱动点阵大小（0=最小，1=最大），不再只处理过渡带。
  // 为了让点阵在一个 cell 内保持一致：用 cell 中心点的 alpha 驱动圆点大小。
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 cellId = floor(uv / normalizedPixelSize);
  vec2 uvCellCenter = (cellId + vec2(0.5)) * normalizedPixelSize;
  float cellAlpha = clamp(radialMaskAlpha(uvCellCenter), 0.0, 1.0);

  vec4 dotOut;
  dotsMainImage(vec4(0.0, 0.0, 0.0, cellAlpha), uv, dotOut);
  float dotMask = clamp(dotOut.a, 0.0, 1.0);

  float finalAlpha = dotMask;

  // 直接输出 overlay 颜色（预乘 alpha），避免颜色混合导致点边黑描边。
  vec3 outRgb = uOverlayColor * finalAlpha;
  outputColor = vec4(outRgb, finalAlpha);
}
```

