"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { NkBoard, NkHeaderPod, NkPod } from "./pod-kit"
import type { SlimForceGroup, SlimForceCharacter } from "@/components/forces-client"

// Night-ink port of the Forces index: same data (built server-side in
// app/forces/page.tsx) + same accordion logic, re-housed in the pod organism
// with the shared .nk-acc / .nk-unit primitives (app/night-ink-tools.css).

function UnitCard({ character }: { character: SlimForceCharacter }) {
  const epic = character.visualTier >= 8
  return (
    <Link href={`/characters/${character.master_pc_id}`} className="nk-unit-link">
      <div className={`nk-unit${epic ? " epic" : ""}`}>
        {epic ? (
          <div className="nk-unit-base" style={{ inset: "7%", width: "auto", height: "auto" }}>
            <img src={character.baseSrc} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
          </div>
        ) : (
          <img className="nk-unit-base" src={character.baseSrc} alt="" loading="lazy" decoding="async" />
        )}
        <div className="nk-unit-portrait">
          <img src={character.iconSrc} alt={character.name} loading="lazy" decoding="async" />
        </div>
        <img className="nk-unit-frame" src={character.frameSrc} alt="" loading="lazy" decoding="async" />
        <span className="nk-unit-name">{character.name}</span>
        <img className="nk-unit-stars" src={character.starsSrc} alt="" />
        <div className="nk-unit-tags">
          {character.firstIcon && <img src={character.firstIcon} alt="" />}
          {character.secondIcon && <img src={character.secondIcon} alt="" />}
        </div>
      </div>
    </Link>
  )
}

export default function NightInkForcesClient({ forceGroups }: { forceGroups: SlimForceGroup[] }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return forceGroups
    const q = searchTerm.toLowerCase()
    const result: SlimForceGroup[] = []
    for (const group of forceGroups) {
      const forceMatch = group.name.toLowerCase().includes(q)
      const matchedChars = group.characters.filter((c) => c.name.toLowerCase().includes(q))
      if (forceMatch || matchedChars.length > 0) {
        result.push({ ...group, characters: forceMatch ? group.characters : matchedChars })
      }
    }
    return result
  }, [forceGroups, searchTerm])

  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })

  return (
    <NkBoard>
      <NkHeaderPod
        kicker="Affiliation Index"
        title="For"
        accent="ces"
        sub="Every guild, faction and force in the game — expand one to see all of its members."
        actions={
          <div className="nk-searchbar" style={{ minWidth: 280 }}>
            <Search />
            <input
              placeholder="Search forces or characters"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        }
      />

      <div className="nk-stack" style={{ marginTop: 30, gap: 18 }}>
        {filteredGroups.map((group) => {
          const isOpen = expanded.has(group.name)
          return (
            <NkPod key={group.name} className="nk-acc" label={group.name}>
              <button className="nk-acc-head" onClick={() => toggle(group.name)} aria-expanded={isOpen}>
                <div className="nk-acc-head-left">
                  {group.forceIcon && <img className="nk-acc-icon" src={group.forceIcon} alt="" />}
                  <span className="nk-acc-title">{group.name}</span>
                </div>
                <div className="nk-acc-meta">
                  <span className="nk-acc-count">{group.characters.length}</span>
                  <img src="/icons/name.webp" alt="members" style={{ height: 18, width: 11, opacity: 0.7 }} />
                  <span className="nk-acc-chev">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>
              {isOpen && (
                <div className="nk-acc-body">
                  <div className="nk-unitgrid">
                    {group.characters.map((c) => (
                      <UnitCard key={c.master_pc_id} character={c} />
                    ))}
                  </div>
                </div>
              )}
            </NkPod>
          )
        })}
        {filteredGroups.length === 0 && (
          <p className="nk-muted" style={{ textAlign: "center", padding: "30px 0" }}>
            No forces found matching the current search.
          </p>
        )}
      </div>
    </NkBoard>
  )
}
