"use client";
import type { AlgoConfig, MappingId, RngId, RotationId, SchemeId } from "@/engine/types";
import { SCHEMES, SCHEME_IDS } from "@/engine/schemes";
import { MAPPING_DOCS, RNG_DOCS, SCHEME_DOCS } from "@/engine/registry";
import { Card, Field, Info, NumberInput, Select } from "../ui";

export function AlgoPanel({ algo, onChange }: { algo: AlgoConfig; onChange: (a: AlgoConfig) => void }) {
  const scheme = SCHEMES[algo.scheme];
  const doc = SCHEME_DOCS.find((d) => d.id === algo.scheme);
  const mapDoc = MAPPING_DOCS.find((d) => d.id === (algo.mapping === "native" ? scheme.nativeMapping : algo.mapping));
  return (
    <Card
      title={
        <>
          Algorithm
          <Info>Every scheme and mapping is documented on the Docs page. Changing them here changes only this lab.</Info>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Commitment scheme"
          hint={
            doc ? (
              <>
                <b>{doc.name}.</b> {doc.summary}
                <div className="mt-1 font-mono text-[11px] opacity-80">{scheme.messageLayout}</div>
                <div className="mt-1">
                  <b>Used by:</b> {doc.usedBy}
                </div>
                <div>
                  <b>Weaknesses:</b> {doc.weaknesses}
                </div>
              </>
            ) : undefined
          }
        >
          <Select<SchemeId> value={algo.scheme} onChange={(v) => onChange({ ...algo, scheme: v, mapping: "native" })} options={SCHEME_IDS.map((id) => ({ value: id, label: SCHEMES[id].name }))} />
        </Field>
        <Field label="Ticket mapping" hint={mapDoc ? <><b>{mapDoc.name}.</b> {mapDoc.summary} <div className="mt-1"><b>Weaknesses:</b> {mapDoc.weaknesses}</div></> : undefined}>
          <Select<MappingId | "native">
            value={algo.mapping}
            onChange={(v) => onChange({ ...algo, mapping: v })}
            options={[{ value: "native", label: `Native to the scheme (${MAPPING_DOCS.find((d) => d.id === scheme.nativeMapping)?.name})` }, ...MAPPING_DOCS.map((d) => ({ value: d.id, label: d.name }))]}
          />
        </Field>
        {algo.scheme === "none" && (
          <Field label="Randomness source" hint="With no commitment, this is the generator behind the draw.">
            <Select<RngId> value={algo.rng} onChange={(v) => onChange({ ...algo, rng: v })} options={RNG_DOCS.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
        )}
        {algo.scheme !== "none" && (
          <>
            <Field label="Server seed rotation" hint="How often the server seed is replaced and revealed.">
              <Select<RotationId>
                value={algo.rotation}
                onChange={(v) => onChange({ ...algo, rotation: v })}
                options={[
                  { value: "on-retire", label: "One seed for the whole run (reveal on retire)" },
                  { value: "every-n", label: "Rotate every N opens (Cases.gg: 1,000)" },
                  { value: "per-open", label: "Fresh seed every open, revealed immediately (Packs.com, Glass Box)" },
                ]}
              />
            </Field>
            {algo.rotation === "every-n" && (
              <Field label="Rotate every N opens">
                <NumberInput value={algo.rotateEvery} min={1} step={1} onChange={(v) => onChange({ ...algo, rotateEvery: Math.max(1, Math.floor(v)) })} />
              </Field>
            )}
            {scheme.usesClientSeed && (
              <Field label="Client seed" hint="Most players never change the default the site generates for them. A player-set seed defeats seed grinding.">
                <Select<AlgoConfig["clientSeedMode"]>
                  value={algo.clientSeedMode}
                  onChange={(v) => onChange({ ...algo, clientSeedMode: v })}
                  options={[
                    { value: "site-default", label: "Site-generated default (typical player)" },
                    { value: "player-set", label: "Set by the player" },
                  ]}
                />
              </Field>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
