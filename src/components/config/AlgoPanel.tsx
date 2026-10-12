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
          Fairness proof and randomness
          <Info>
            How the site proves (or does not prove) that a draw was fixed before you bet. In plain words: the site writes down a secret number, shows you only its fingerprint, mixes it with a number of yours and a counter, and later reveals the secret so you can check. Each entry here is a real site&apos;s recipe, reproduced exactly, plus ours. Changing it affects only this lab.
          </Info>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Fairness proof (whose recipe)"
          hint={
            <>
              Which site&apos;s recipe is used to commit to the secret and mix the numbers. <b>No commitment</b> means nothing is published and nothing can be checked, which is how the vendor platform and IcyBox work.
              {doc && (
                <>
                  <div className="mt-2">
                    <b>{doc.name}.</b> {doc.summary}
                  </div>
                  <div className="mt-1 font-mono text-[11px] opacity-80">{scheme.messageLayout}</div>
                  <div className="mt-1">
                    <b>Used by:</b> {doc.usedBy}
                  </div>
                  <div>
                    <b>Weak spots:</b> {doc.weaknesses}
                  </div>
                </>
              )}
            </>
          }
        >
          <Select<SchemeId> value={algo.scheme} onChange={(v) => onChange({ ...algo, scheme: v, mapping: "native" })} options={SCHEME_IDS.map((id) => ({ value: id, label: SCHEMES[id].name }))} />
        </Field>
        <Field
          label="How the big number becomes a ticket"
          hint={
            <>
              The mixing produces a huge number; this is how it is squeezed into a ticket number. Done carelessly (a small slice and a remainder), some tickets come up slightly less often. Done properly, every ticket is equally likely. &ldquo;Native&rdquo; uses the recipe&apos;s own documented way.
              {mapDoc && (
                <>
                  <div className="mt-2">
                    <b>{mapDoc.name}.</b> {mapDoc.summary}
                  </div>
                  <div className="mt-1">
                    <b>Weak spots:</b> {mapDoc.weaknesses}
                  </div>
                </>
              )}
            </>
          }
        >
          <Select<MappingId | "native">
            value={algo.mapping}
            onChange={(v) => onChange({ ...algo, mapping: v })}
            options={[{ value: "native", label: `Native to the recipe (${MAPPING_DOCS.find((d) => d.id === scheme.nativeMapping)?.name})` }, ...MAPPING_DOCS.map((d) => ({ value: d.id, label: d.name }))]}
          />
        </Field>
        {algo.scheme === "none" && (
          <Field label="Random number generator" hint="With no proof, this is the dice behind the draw. A weak generator (the old-fashioned kind) is predictable; a strong one is not. Players cannot tell which one a site uses.">
            <Select<RngId> value={algo.rng} onChange={(v) => onChange({ ...algo, rng: v })} options={RNG_DOCS.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
        )}
        {algo.scheme !== "none" && (
          <>
            <Field label="How often the site changes its secret" hint="One secret for a whole run means nothing can be checked until the run ends. A fresh secret every open, revealed immediately, lets you check at once. Cases.gg changes it every 1,000 bets.">
              <Select<RotationId>
                value={algo.rotation}
                onChange={(v) => onChange({ ...algo, rotation: v })}
                options={[
                  { value: "on-retire", label: "One secret for the whole run, revealed at the end" },
                  { value: "every-n", label: "New secret every N opens (Cases.gg: 1,000)" },
                  { value: "per-open", label: "New secret every open, revealed immediately (Packs.com, Glass Box)" },
                ]}
              />
            </Field>
            {algo.rotation === "every-n" && (
              <Field label="Change the secret every N opens" hint="How many opens share one secret before it is replaced and revealed.">
                <NumberInput value={algo.rotateEvery} min={1} step={1} onChange={(v) => onChange({ ...algo, rotateEvery: Math.max(1, Math.floor(v)) })} />
              </Field>
            )}
            {scheme.usesClientSeed && (
              <Field label="Your number (client seed)" hint="The number of yours that gets mixed in. Most players never change the one the site generates for them, which lets a dishonest site pick it. A number you set yourself defeats that trick.">
                <Select<AlgoConfig["clientSeedMode"]>
                  value={algo.clientSeedMode}
                  onChange={(v) => onChange({ ...algo, clientSeedMode: v })}
                  options={[
                    { value: "site-default", label: "Generated by the site (what most players use)" },
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
