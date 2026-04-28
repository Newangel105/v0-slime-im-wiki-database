"use client"

import { Suspense, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Stage, Environment } from "@react-three/drei"
import * as THREE from "three"

export type ModelEntry = {
  id: string
  name: string
  affiliation_name?: string
  glb: string
  icon?: string
}

function Model({ url, autoRotate, scale }: { url: string; autoRotate: boolean; scale: number }) {
  const { scene } = useGLTF(url)
  const root = useRef<THREE.Group>(null)
  const cloned = useMemo(() => scene.clone(true), [scene])

  useFrame((_, dt) => {
    if (autoRotate && root.current) root.current.rotation.y += dt * 0.4
  })

  return (
    <group ref={root} scale={scale}>
      <primitive object={cloned} />
    </group>
  )
}

export default function ModelViewerClient({ models }: { models: ModelEntry[] }) {
  const [selectedId, setSelectedId] = useState(models[0]?.id ?? "")
  const [autoRotate, setAutoRotate] = useState(true)
  const [scale, setScale] = useState(1)

  const selected = models.find(m => m.id === selectedId) ?? models[0]

  if (!selected) {
    return <p className="text-gray-400">No models available yet.</p>
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-xl border border-gray-700 bg-[#0d1320] p-3 max-h-[70vh] overflow-y-auto">
        <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Models</h2>
        <ul className="space-y-1">
          {models.map(m => {
            const active = m.id === selected.id
            return (
              <li key={m.id}>
                <button
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors ${active ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"}`}
                >
                  <div className="font-medium">{m.name}</div>
                  {m.affiliation_name && (
                    <div className="text-[11px] text-gray-400">{m.affiliation_name}</div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="rounded-xl border border-gray-700 bg-[#0d1320] overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-800 px-3 py-2 text-sm">
          <div className="font-semibold text-white">{selected.name}</div>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-gray-300">
              <input
                type="checkbox"
                checked={autoRotate}
                onChange={e => setAutoRotate(e.target.checked)}
              />
              Auto-rotate
            </label>
            <label className="flex items-center gap-1.5 text-gray-300">
              Scale
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.05}
                value={scale}
                onChange={e => setScale(Number(e.target.value))}
                className="w-28"
              />
              <span className="w-8 tabular-nums text-right">{scale.toFixed(2)}</span>
            </label>
          </div>
        </div>

        <div className="h-[70vh] bg-gradient-to-b from-[#1a2438] to-[#0a0f1c]">
          <Canvas camera={{ position: [0, 1.4, 2.4], fov: 35 }} dpr={[1, 2]}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[3, 5, 2]} intensity={1.2} />
            <Suspense fallback={null}>
              <Stage adjustCamera={false} environment="city" intensity={0.4}>
                <Model url={selected.glb} autoRotate={autoRotate} scale={scale} />
              </Stage>
              <Environment preset="city" />
            </Suspense>
            <OrbitControls
              makeDefault
              enableDamping
              minDistance={0.6}
              maxDistance={6}
              target={[0, 1, 0]}
            />
          </Canvas>
        </div>
      </div>
    </div>
  )
}

