"use client";
import { useMemo, useState } from "react";
import { SCHEMES, SCHEME_IDS } from "@/engine/schemes";
import { mapTicket } from "@/engine/mapping";
import { MAPPING_DOCS } from "@/engine/registry";
import type { MappingId, SchemeId } from "@/engine/types";
import { verifyRecord } from "@/engine/opener";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { GLASSBOX_BOX, VENDOR_BOX } from "@/lib/presets";
import { Badge, Card, Field, Help, NumberInput, Select } from "./ui";

export function Verifier() {
  const [scheme, setScheme] = useState<SchemeId>("jemlit");
  const [mapping, setMapping] = useState<MappingId | "native">("native");
  const [serverSeed, setServerSeed] = useState("server seed");
  const [clientSeed, setClientSeed] = useState("your client seed");
  const [nonce, setNonce] = useState(1);
  const [opening, setOpening] = useState(1);
  const [beaconRound, setBeaconRound] = useState(1000001);
  const [beaconValue, setBeaconValue] = useState("");
  const [T, setT] = useState(100_000_000);
  const [slug, setSlug] = useState("box");
  const [recordJson, setRecordJson] = useState("");
  const [boxId, setBoxId] = useState<"vendor" | "glassbox">("vendor");

  const s = SCHEMES[scheme];
  const calc = useMemo(() => {
    try {
      const commit = s.commit(serverSeed);
      const digest = s.digest({ serverSeed, clientSeed, nonce, opening, beaconRound, beaconValue, slug });
      const m = mapTicket(mapping === "native" ? s.nativeMapping : mapping, digest, T);
      return { commit, digest, ticket: m.ticket, u: m.u };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [s, serverSeed, clientSeed, nonce, opening, beaconRound, beaconValue, slug, mapping, T]);

  const recordCheck = useMemo(() => {
    if (!recordJson.trim()) return null;
    try {
      const rec = JSON.parse(recordJson);
      const box = boxId === "vendor" ? VENDOR_BOX : GLASSBOX_BOX;
      const r = verifyRecord(rec, box, { scheme, mapping, rng: "sfc32", rotation: "on-retire", rotateEvery: 1, clientSeedMode: "player-set" }, CATALOG_BY_ID);
      return r;
    } catch (e) {
      return { ok: false, reason: "invalid JSON: " + (e instanceof Error ? e.message : String(e)) };
    }
  }, [recordJson, boxId, scheme, mapping]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Verifier</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          The same code the engine uses, exposed as a tool. Enter seeds to see the commitment, the digest and the ticket a scheme produces, or paste a record from a run&apos;s sample to recompute it against a box. Defaults reproduce Jemlit&apos;s published example.
        </p>
      </header>
      <Card title="Recompute from inputs">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Scheme">
            <Select<SchemeId> value={scheme} onChange={(v) => { setScheme(v); setMapping("native"); }} options={SCHEME_IDS.map((id) => ({ value: id, label: SCHEMES[id].name }))} />
          </Field>
          <Field label="Mapping">
            <Select<MappingId | "native"> value={mapping} onChange={setMapping} options={[{ value: "native", label: "Native to scheme" }, ...MAPPING_DOCS.map((d) => ({ value: d.id, label: d.name }))]} />
          </Field>
          <Field label="Ticket total T">
            <NumberInput value={T} min={2} step={1} onChange={(v) => setT(Math.max(2, Math.floor(v)))} />
          </Field>
          <Field label="Server seed">
            <input type="text" value={serverSeed} onChange={(e) => setServerSeed(e.target.value)} />
          </Field>
          <Field label="Client seed">
            <input type="text" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} disabled={!s.usesClientSeed} />
          </Field>
          <Field label="Nonce">
            <NumberInput value={nonce} min={0} step={1} onChange={setNonce} />
          </Field>
          <Field label="Opening number (Packs.com)">
            <NumberInput value={opening} min={1} step={1} onChange={setOpening} />
          </Field>
          <Field label="Slug (Misty)">
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={scheme !== "misty"} />
          </Field>
          <Field label="Beacon round / value (Razed, Glass Box)">
            <div className="flex gap-1">
              <NumberInput value={beaconRound} min={0} step={1} onChange={setBeaconRound} disabled={!s.usesBeacon} />
              <input type="text" value={beaconValue} onChange={(e) => setBeaconValue(e.target.value)} disabled={!s.usesBeacon} placeholder="block hash or drand value" />
            </div>
          </Field>
        </div>
        <div className="mt-3 rounded-lg bg-paper p-3 font-mono text-xs">
          <div className="mb-1 text-ink-3">{s.messageLayout}</div>
          {"error" in calc ? (
            <div className="text-bad">{calc.error}</div>
          ) : (
            <>
              <div>
                <span className="text-ink-3">commitment </span>
                {calc.commit || "(none)"}
              </div>
              <div className="break-all">
                <span className="text-ink-3">digest </span>
                {calc.digest}
              </div>
              <div>
                <span className="text-ink-3">ticket </span>
                {calc.ticket.toLocaleString()} of {T.toLocaleString()}
                {calc.u !== undefined && <span className="text-ink-3"> · u = {calc.u.toFixed(8)} · roll ×100 = {(calc.u * 100).toFixed(4)}</span>}
              </div>
            </>
          )}
        </div>
        <Help>With the defaults and the Jemlit scheme the digest should begin with 38611068f693, which is the example on Jemlit&apos;s provably-fair page.</Help>
      </Card>
      <Card title="Verify a record from a run">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Box the record was drawn from">
            <Select<"vendor" | "glassbox"> value={boxId} onChange={setBoxId} options={[{ value: "vendor", label: VENDOR_BOX.name }, { value: "glassbox", label: GLASSBOX_BOX.name }]} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Record JSON (copy one row's fields from a run's sample, or the whole record from an exported run)">
              <textarea rows={5} value={recordJson} onChange={(e) => setRecordJson(e.target.value)} className="font-mono text-xs" placeholder='{"serverSeed":"…","serverHash":"…","clientSeed":"…","nonce":1,"opening":1,"digest":"…","ticket":123,"itemId":"f-credit-1"}' />
            </Field>
          </div>
        </div>
        {recordCheck && (
          <div className="mt-2">
            <Badge tone={recordCheck.ok ? "good" : "bad"}>{recordCheck.ok ? "verifies" : "fails"}</Badge> <span className="text-xs text-ink-2">{recordCheck.reason}</span>
          </div>
        )}
        <Help>Uses the scheme and mapping selected above. A record from a rigged run that passes here demonstrates the point of the research: the proof covers the dice, not the box.</Help>
      </Card>
    </div>
  );
}
