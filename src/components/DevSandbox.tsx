"use client";
import { useMemo, useState } from "react";
import { MISTY_BOXES, bonusHashOfBox, buildBonus, buildTable, liveWeights, lookup, lookupBonus, mistyBox, mistyDigest, mistyMath, rollOf } from "@/engine/labs/misty";
import type { MistyOutcome } from "@/engine/types";
import { randomHex, sha256Hex } from "@/engine/hash";
import { Badge, Button, Card, Select } from "@/components/ui";

/** Kit 1.1 policies as the main site decided them. */
const CONFIG = { defaultClientSeed: "grailnoir-default", tradeInPercent: 90, openTtlMs: 15 * 60 * 1000 };
const apiKind = (o: MistyOutcome): "item" | "credit" | "bonus" => (o.kind === "item" ? "item" : o.freeSpins > 0 ? "bonus" : "credit");
const toCents = (usd: number | null) => (usd == null ? null : Math.round(usd * 100));

interface Open {
  openId: string;
  boxSlug: string;
  priceCents: number;
  serverSeed: string; // server side only until reveal
  serverHash: string;
  tableHash: string;
  bonusHash: string;
  clientSeed: string | null;
  clientSeedSource: "player" | "server-default" | null;
  status: "created" | "paid" | "resolved";
  nonce: number;
  expiresAt: string;
}
interface Resolved {
  digest: string;
  roll: number;
  outcome: { id: string; label: string; rarity: string; kind: string; credits: number; freeSpins: number; valueCents: number | null; percent: number; bandFrom: number; bandTo: number };
  bonusSpins: { nonce: number; digest: string; roll: number; credits: number }[];
  creditsAwarded: number;
  itemAward: { awardId: string; valueCents: number; tradeInPercent: number; tradeInCredits: number } | null;
  serverSeed: string;
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

function Step({ n, title, method, path, request, response, children }: { n: number; title: string; method: string; path: string; request?: unknown; response?: unknown; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-accent px-2 text-[11px] font-semibold text-white">{n}</span>
        <b>{title}</b>
        <code className="text-[11px]">
          {method} {path}
        </code>
        <span className="ml-auto flex gap-2">{children}</span>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-ink-3">request</div>
          <pre className="max-h-48 overflow-auto rounded bg-surface p-2 text-[11px] leading-5">{request === undefined ? "–" : json(request)}</pre>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-ink-3">response</div>
          <pre className="max-h-48 overflow-auto rounded bg-surface p-2 text-[11px] leading-5">{response === undefined ? "(not called yet)" : json(response)}</pre>
        </div>
      </div>
    </div>
  );
}

/** The API flow, run in the browser with the same engine the backend kit ships. Kit 1.1 shapes. */
export function DevSandbox() {
  const [slug, setSlug] = useState("timepiece-suite");
  const [seedInput, setSeedInput] = useState("alice");
  const [open, setOpen] = useState<Open | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [verify, setVerify] = useState<unknown>(undefined);
  const box = mistyBox(slug);
  const table = useMemo(() => buildTable(box, liveWeights(box)), [box]);
  const bHash = useMemo(() => bonusHashOfBox(box), [box]);
  const maths = useMemo(() => mistyMath(box, liveWeights(box), box.bonus, { misteeFace: 1, misteeReal: 0.37, itemRealized: 0.7 }), [box]);

  const boxResponse = {
    slug: box.slug,
    name: box.name,
    tagline: box.tagline,
    price: box.price,
    priceCents: Math.round(box.price * 100),
    tradeInPercent: CONFIG.tradeInPercent,
    tableHash: table.hash,
    bonusHash: bHash,
    outcomes: table.entries.map((e) => ({ id: e.outcome.id, label: e.outcome.label, rarity: e.outcome.rarity, kind: apiKind(e.outcome), credits: e.outcome.mistees, freeSpins: e.outcome.freeSpins, valueCents: toCents(e.outcome.valueUsd), percent: e.percent, brand: null, category: null, imageUrl: null })),
    bonus: box.bonus.map((b) => ({ credits: b.mistees, percent: b.weight })),
    maths: { pItem: maths.pItem, evItemsCents: Math.round(maths.evItems * 100), evCredits: maths.evMistees, payFaceCents: Math.round(maths.payFace * 100), returnFace: maths.returnFace },
  };

  const createOpen = () => {
    const serverSeed = randomHex(32);
    const o: Open = { openId: crypto.randomUUID(), boxSlug: slug, priceCents: Math.round(box.price * 100), serverSeed, serverHash: sha256Hex(serverSeed), tableHash: table.hash, bonusHash: bHash, clientSeed: null, clientSeedSource: null, status: "created", nonce: 1, expiresAt: new Date(Date.now() + CONFIG.openTtlMs).toISOString() };
    setOpen(o);
    setResolved(null);
    setVerify(undefined);
  };
  const setSeed = () => open && open.status === "created" && setOpen({ ...open, clientSeed: seedInput, clientSeedSource: "player" });
  const pay = () => open && open.status === "created" && setOpen({ ...open, status: "paid", clientSeed: open.clientSeed ?? CONFIG.defaultClientSeed, clientSeedSource: open.clientSeedSource ?? "server-default" });
  const spin = () => {
    if (!open || open.status !== "paid") return;
    const clientSeed = open.clientSeed ?? CONFIG.defaultClientSeed;
    const digest = mistyDigest(box.slug, open.serverSeed, clientSeed, 1);
    const roll = rollOf(digest);
    const e = lookup(table, roll);
    const bt = buildBonus(box.bonus);
    const bonusSpins = [] as Resolved["bonusSpins"];
    for (let i = 0; i < e.outcome.freeSpins; i++) {
      const nonce = i + 2;
      const d = mistyDigest(box.slug, open.serverSeed, clientSeed, nonce);
      const r = rollOf(d);
      bonusSpins.push({ nonce, digest: d, roll: r, credits: lookupBonus(bt, r).mistees });
    }
    const valueCents = toCents(e.outcome.valueUsd);
    const itemAward = e.outcome.kind === "item" && valueCents != null ? { awardId: crypto.randomUUID(), valueCents, tradeInPercent: CONFIG.tradeInPercent, tradeInCredits: Math.round((valueCents * CONFIG.tradeInPercent) / 100 / 100) } : null;
    setResolved({
      digest,
      roll,
      outcome: { id: e.outcome.id, label: e.outcome.label, rarity: e.outcome.rarity, kind: apiKind(e.outcome), credits: e.outcome.mistees, freeSpins: e.outcome.freeSpins, valueCents, percent: e.percent, bandFrom: e.from, bandTo: e.to },
      bonusSpins,
      creditsAwarded: e.outcome.mistees + bonusSpins.reduce((s, b) => s + b.credits, 0),
      itemAward,
      serverSeed: open.serverSeed,
    });
    setOpen({ ...open, status: "resolved" });
  };
  const verifyRequest = resolved && open ? { slug, serverSeed: resolved.serverSeed, clientSeed: open.clientSeed, nonce: 1, tableHash: open.tableHash, bonusHash: open.bonusHash, serverHash: open.serverHash, outcomeId: resolved.outcome.id, bonusCredits: resolved.bonusSpins.map((b) => b.credits).join(",") } : undefined;
  const doVerify = () => {
    if (!open || !resolved) return;
    const serverHash = sha256Hex(resolved.serverSeed);
    const clientSeed = open.clientSeed ?? CONFIG.defaultClientSeed;
    const digest = mistyDigest(box.slug, resolved.serverSeed, clientSeed, 1);
    const roll = rollOf(digest);
    const e = lookup(table, roll);
    const bt = buildBonus(box.bonus);
    const spins = Array.from({ length: e.outcome.freeSpins }, (_, i) => {
      const d = mistyDigest(box.slug, resolved.serverSeed, clientSeed, i + 2);
      return { nonce: i + 2, digest: d, roll: rollOf(d), credits: lookupBonus(bt, rollOf(d)).mistees };
    });
    const checks = {
      serverHash: serverHash === open.serverHash,
      tableHash: table.hash === open.tableHash,
      bonusHash: bHash === open.bonusHash,
      outcome: e.outcome.id === resolved.outcome.id,
      bonusSpins: spins.length === resolved.bonusSpins.length && spins.every((s, i) => s.credits === resolved.bonusSpins[i].credits),
    };
    const ok = Object.values(checks).every(Boolean);
    setVerify({ ok, checks, serverHash, digest, roll, outcomeId: e.outcome.id, outcomeLabel: e.outcome.label, bonusSpins: spins, reason: ok ? null : "mismatch" });
  };

  const publicOpen = open && { ...open, serverSeed: open.status === "resolved" ? open.serverSeed : "(hidden until reveal)" };
  const verifyUrl = verifyRequest ? `/v1/verify?${new URLSearchParams(Object.fromEntries(Object.entries(verifyRequest).map(([k, v]) => [k, String(v ?? "")]))).toString()}` : "";

  return (
    <Card title="API sandbox: the flow, step by step, with real hashes (kit 1.1)">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-3">Box</span>
        <span className="w-64">
          <Select<string>
            value={slug}
            onChange={(v) => {
              setSlug(v);
              setOpen(null);
              setResolved(null);
              setVerify(undefined);
            }}
            options={MISTY_BOXES.map((b) => ({ value: b.slug, label: `${b.name} · $${b.price}` }))}
          />
        </span>
        <span className="text-ink-3">Client seed</span>
        <input className="w-44 rounded-md border border-line bg-paper px-2 py-1 text-sm" value={seedInput} onChange={(e) => setSeedInput(e.target.value)} />
        {open && <Badge tone={open.status === "resolved" ? "good" : "accent"}>open {open.status}</Badge>}
      </div>
      <div className="space-y-3">
        <Step n={1} title="Read the box: ordered table, bonus table, both hashes, maths, trade-in rate" method="GET" path={`/v1/boxes/${slug}`} response={boxResponse} />
        <Step n={2} title="Create the open: the server commits to a secret before any payment" method="POST" path="/v1/opens" request={{ boxSlug: slug }} response={publicOpen ? { openId: publicOpen.openId, boxSlug: slug, status: publicOpen.status, priceCents: publicOpen.priceCents, serverHash: publicOpen.serverHash, tableHash: publicOpen.tableHash, bonusHash: publicOpen.bonusHash, nonce: 1, clientSeed: publicOpen.clientSeed, clientSeedSource: publicOpen.clientSeedSource, expiresAt: publicOpen.expiresAt } : undefined}>
          <Button onClick={createOpen}>Create open</Button>
        </Step>
        <Step n={3} title="Player sets a seed (only before payment; 409 seed_locked afterwards)" method="PUT" path={`/v1/opens/${open?.openId ?? "{openId}"}/client-seed`} request={{ clientSeed: seedInput }} response={open?.clientSeed ? { status: 204, stored: open.clientSeed, source: open.clientSeedSource } : undefined}>
          <Button kind="ghost" onClick={setSeed} disabled={!open || open.status !== "created"}>
            Set seed
          </Button>
        </Step>
        <Step n={4} title="Pay (idempotent). If no seed was set, the server fills grailnoir-default and records it" method="POST" path={`/v1/opens/${open?.openId ?? "{openId}"}/pay`} request={{ method: "card", paymentToken: "tok_test", idempotencyKey: "demo-1" }} response={open && open.status !== "created" ? { status: "paid", clientSeed: open.clientSeed, clientSeedSource: open.clientSeedSource, creditBalance: 0 } : undefined}>
          <Button kind="ghost" onClick={pay} disabled={!open || open.status !== "created"}>
            Pay
          </Button>
        </Step>
        <Step n={5} title="Spin: resolve from the pinned snapshots, write the award and the ledger, reveal the secret" method="POST" path={`/v1/opens/${open?.openId ?? "{openId}"}/spin`} response={resolved && open ? { openId: open.openId, boxSlug: slug, status: "resolved", priceCents: open.priceCents, serverHash: open.serverHash, tableHash: open.tableHash, bonusHash: open.bonusHash, nonce: 1, clientSeed: open.clientSeed, clientSeedSource: open.clientSeedSource, ...resolved, verifyUrl } : undefined}>
          <Button kind="ghost" onClick={spin} disabled={!open || open.status !== "paid"}>
            Spin
          </Button>
        </Step>
        <Step n={6} title="Anyone recomputes it: one check per claim (seed hash, table hash, bonus hash, outcome, free spins)" method="GET" path="/v1/verify" request={verifyRequest} response={verify}>
          <Button kind="ghost" onClick={doVerify} disabled={!resolved}>
            Verify
          </Button>
        </Step>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Everything above runs in your browser with the same functions the kit ships (buildTable, bonusHash, mistyDigest, rollOf, lookup, buildBonus, lookupBonus, mistyMath, sha256Hex). The server seed here comes from the browser&apos;s CSPRNG; on the server use crypto.randomBytes(32). Free-spin rows are sent as kind bonus; credit-only rows as credit. Try it: create an open, change the seed after paying (the button is disabled, as the API must refuse), and verify.
      </p>
    </Card>
  );
}
