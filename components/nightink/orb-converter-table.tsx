"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { toPublicAssetPath } from "@/lib/pc-wiki"
import {
  getOrbCellEntries,
  getOrbTableRows,
  groupOrbTableRows,
  ORB_TARGET_CONFIG,
  FROM_TYPE_CONFIG,
  ORB_AMOUNTS,
  type OrbTarget,
  type OrbAmount,
  type OrbConvertEntry,
} from "@/lib/orb-converter-parser"
import { NkBoard, NkHeaderPod, NkPod } from "./pod-kit"

// Night-ink port of the orb-converter: identical data/logic (the lib parser),
// re-housed in the pod organism with the shared .nk-table / .nk-tabs primitives
// (app/night-ink-tools.css). The ocean/classic tables stay wired for rollback.
const SOLO_TABS: OrbTarget[] = ["blue", "green", "orange"]
const COMBINED_TARGETS: OrbTarget[] = ["unity", "steal", "give", "reset"]
const TAB_TONE: Record<string, string> = { blue: "t-blue", green: "t-green", orange: "t-orange" }

type Entry = OrbConvertEntry

function CharCell({ entry }: { entry: Entry }) {
  return (
    <Link
      href={`/characters/${entry.character.master_pc_id}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`${entry.character.name}${entry.character.affiliation_name ? ` — ${entry.character.affiliation_name}` : ""}${entry.isSkillChange ? " (Skill Change)" : ""}\n${entry.conversionLine}`}
      className="nk-ico"
    >
      <Image src={toPublicAssetPath(entry.character.images.icon)} alt={entry.character.name} fill className="object-cover" />
      {entry.isSkillChange && (
        <img
          src="/skill-icons/skill_integrated_3400001_ItemM.webp"
          alt="Skill Change"
          className="nk-ico-badge"
          draggable={false}
        />
      )}
    </Link>
  )
}

function CellGroup({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return <div className="nk-empty">—</div>
  return (
    <div className="nk-cell-grid">
      {entries.map((entry) => (
        <CharCell key={`${entry.character.master_pc_id}-${entry.skillSlot}-${entry.isSkillChange}`} entry={entry} />
      ))}
    </div>
  )
}

export default function NightInkOrbConverterTable({ entries }: { entries: Entry[] }) {
  const [tab, setTab] = useState<string>("blue")

  const OrbTable = ({ toOrb }: { toOrb: OrbTarget }) => {
    const count = new Set(
      entries.filter((e) => e.toOrb === toOrb).map((e) => `${e.character.master_pc_id}-${e.skillSlot}`),
    ).size
    const groups = groupOrbTableRows(getOrbTableRows(entries, toOrb))
    if (groups.length === 0) return <p className="nk-muted">No data found.</p>

    return (
      <div className="nk-stack" style={{ gap: 16 }}>
        <span className="nk-count">
          Showing&nbsp;<b>{count} entries</b>&nbsp;with orb-convert skills
        </span>
        <div className="nk-table-shell">
          <table className="nk-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th className="nk-sticky" style={{ left: 0, textAlign: "left", minWidth: 124 }}>From / Type</th>
                <th className="nk-sticky" style={{ left: 124, minWidth: 56 }}>SP Cost</th>
                {ORB_AMOUNTS.map((amt) => (
                  <th key={amt} style={{ minWidth: 160 }}>{amt}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIdx) => {
                const cfg = FROM_TYPE_CONFIG[group.fromType] ?? { label: group.fromType, bgClass: "" }
                const altGroup = groupIdx % 2 !== 0
                return group.subRows.map((subRow, subIdx) => {
                  const altSub = subIdx % 2 !== 0
                  const rowAlt = altGroup ? (altSub ? "is-alt2" : "is-alt") : altSub ? "is-alt" : ""
                  return (
                    <tr key={`${group.fromType}-${subRow.spCostLabel}`} className={rowAlt}>
                      {subIdx === 0 && (
                        <td
                          rowSpan={group.subRows.length}
                          className="nk-sticky nk-rowlabel"
                          style={{ left: 0, textAlign: "left", minWidth: 124 }}
                        >
                          {cfg.label}
                        </td>
                      )}
                      <td className="nk-sticky" style={{ left: 124, textAlign: "center", minWidth: 56, fontSize: 12, fontWeight: 700 }}>
                        {subRow.spCostLabel}
                      </td>
                      {(ORB_AMOUNTS as readonly OrbAmount[]).map((amount) => (
                        <td key={amount} style={{ padding: 0 }}>
                          <CellGroup entries={getOrbCellEntries(entries, toOrb, group.fromType, subRow.spCostLabel, amount)} />
                        </td>
                      ))}
                    </tr>
                  )
                })
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const CombinedTable = () => {
    const count = new Set(
      entries.filter((e) => COMBINED_TARGETS.includes(e.toOrb)).map((e) => `${e.character.master_pc_id}-${e.skillSlot}`),
    ).size
    const sections = COMBINED_TARGETS.flatMap((toOrb) => {
      const groups = groupOrbTableRows(getOrbTableRows(entries, toOrb))
      return groups.length === 0 ? [] : [{ toOrb, groups }]
    })
    if (sections.length === 0) return <p className="nk-muted">No data found.</p>

    return (
      <div className="nk-stack" style={{ gap: 16 }}>
        <span className="nk-count">
          Showing&nbsp;<b>{count} entries</b>&nbsp;with orb-convert skills
        </span>
        <div className="nk-table-shell">
          <table className="nk-table" style={{ minWidth: 1040 }}>
            <thead>
              <tr>
                <th className="nk-sticky" style={{ left: 0, minWidth: 80 }}>To Orb</th>
                <th className="nk-sticky" style={{ left: 80, textAlign: "left", minWidth: 124 }}>From / Type</th>
                <th className="nk-sticky" style={{ left: 204, minWidth: 56 }}>SP Cost</th>
                {ORB_AMOUNTS.map((amt) => (
                  <th key={amt} style={{ minWidth: 160 }}>{amt}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map(({ toOrb, groups }, sectionIdx) => {
                const orbCfg = ORB_TARGET_CONFIG[toOrb]
                const totalSubRows = groups.reduce((s, g) => s + g.subRows.length, 0)
                let orbCellRendered = false
                const altSection = sectionIdx % 2 !== 0
                return groups.map((group, groupIdx) => {
                  const cfg = FROM_TYPE_CONFIG[group.fromType] ?? { label: group.fromType, bgClass: "" }
                  const altGroup = groupIdx % 2 !== 0
                  return group.subRows.map((subRow, subIdx) => {
                    const altSub = subIdx % 2 !== 0
                    const rowAlt = altGroup ? (altSub ? "is-alt2" : "is-alt") : altSub ? "is-alt" : ""
                    const isFirstOfSection = !orbCellRendered && subIdx === 0
                    if (isFirstOfSection) orbCellRendered = true
                    const sectionTop = sectionIdx > 0 && groupIdx === 0 && subIdx === 0 ? " nk-section-top" : ""
                    return (
                      <tr key={`${toOrb}-${group.fromType}-${subRow.spCostLabel}`} className={`${rowAlt}${sectionTop}`}>
                        {isFirstOfSection && (
                          <td
                            rowSpan={totalSubRows}
                            className="nk-sticky nk-rowlabel"
                            style={{ left: 0, textAlign: "center", minWidth: 80, color: "var(--red-bright)" }}
                          >
                            {orbCfg.label}
                          </td>
                        )}
                        {subIdx === 0 && (
                          <td
                            rowSpan={group.subRows.length}
                            className="nk-sticky nk-rowlabel"
                            style={{ left: 80, textAlign: "left", minWidth: 124 }}
                          >
                            {cfg.label}
                          </td>
                        )}
                        <td className="nk-sticky" style={{ left: 204, textAlign: "center", minWidth: 56, fontSize: 12, fontWeight: 700 }}>
                          {subRow.spCostLabel}
                        </td>
                        {(ORB_AMOUNTS as readonly OrbAmount[]).map((amount) => (
                          <td key={amount} style={{ padding: 0 }}>
                            <CellGroup entries={getOrbCellEntries(entries, toOrb, group.fromType, subRow.spCostLabel, amount)} />
                          </td>
                        ))}
                      </tr>
                    )
                  })
                })
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <NkBoard>
      <NkHeaderPod
        kicker="Conversion Index"
        title="Orb "
        accent="Converter"
        sub="Every character whose skills convert battle orbs — grouped by target orb, source type and SP cost. Tap an icon to open that unit."
      />
      <NkPod style={{ marginTop: 30 }} label="Orb conversions">
        <div className="nk-tabs">
          {SOLO_TABS.map((target) => (
            <button
              key={target}
              type="button"
              className={`nk-tab-btn ${TAB_TONE[target] ?? ""}${tab === target ? " is-active" : ""}`}
              onClick={() => setTab(target)}
            >
              {ORB_TARGET_CONFIG[target].label}
            </button>
          ))}
          <button
            type="button"
            className={`nk-tab-btn t-violet${tab === "combined" ? " is-active" : ""}`}
            onClick={() => setTab("combined")}
          >
            Unity / Steal / Give / Reset
          </button>
        </div>
        {tab === "combined" ? <CombinedTable /> : <OrbTable toOrb={tab as OrbTarget} />}
      </NkPod>
    </NkBoard>
  )
}
