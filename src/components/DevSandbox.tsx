"use client";
import { useMemo, useState } from "react";
import { MISTY_BOXES, buildBonus, buildTable, liveWeights, lookup, lookupBonus, mistyBox, mistyDigest, rollOf } from "@/engine/labs/misty";
import { randomHex, sha256Hex } from "@/engine/hash";
import { Badge, Button, Card, Select } from "@/components/ui";

interface Open {
  openId: string;
  boxSlug: string;
  priceCents: number;
  serverSeed: string; // server side only until reveal
  serverHash: string;
  tableHash: string;
  clientSeed: string | null;
  clientSeedSource: "player" | "server-default" | null;
  status: "created" | "paid" | "resolved";
  nonce: number;
  expiresAt: string;
}
interface Resolved {
  digest: string;
  roll: number;
  outcome: { id: string; label: string; kind: string; credits: number; freeSpins: number; valueCents: number | null; bandFrom: number; bandTo: number };
  bonusSpins: { nonce: number; digest: string; roll: number; credits: number }[];
  creditsAwarded: number;
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

/** The API flow, run in the browser with the same engine the backend kit ships. */
export function DevSandbox() {
  const [slug, setSlug] = useState("timepiece-suite");
  const [seedInput, setSeedInput] = useState("alice");
  const [open, setOpen] = useState<Open | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [verify, setVerify] = useState<unknown>(undefined);
  const box = mistyBox(slug);
  const table = useMemo(() => buildTable(box, liveWeights(box)), [box]);

  const boxResponse = {
    slug: box.slug,
    name: box.name,
    priceCents: Math.round(box.price * 100),
    tableHash: table.hash,
    outcomes: table.entries.map((e) => ({ id: e.outcome.id, label: e.outcome.label, kind: e.outcome.kind === "oroos" ? "credit" : e.outcome.kind, credits: e.outcome.mistees, freeSpins: e.outcome.freeSpins, valueCents: e.outcome.valueUsd == null ? null : Math.round(e.outcome.valueUsd * 100), percent: e.percent })),
    bonus: box.bonus.map((b) => ({ credits: b.mistees, percent: b.weight })),
  };

  const createOpen = () => {
    const serverSeed = randomHex(32);
    const o: Open = { openId: crypto.randomUUID(), boxSlug: slug, priceCents: Math.round(box.price * 100), serverSeed, serverHash: sha256Hex(serverSeed), tableHash: table.hash, clientSeed: null, clientSeedSource: null, status: "created", nonce: 1, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
    setOpen(o);
    setResolved(null);
    setVerify(undefined);
  };
  const setSeed = () => open && open.status === "created" && setOpen({ ...open, clientSeed: seedInput, clientSeedSource: "player" });
  const pay = () => open && open.status === "created" && setOpen({ ...open, status: "paid", clientSeed: open.clientSeed ?? "misty-default", clientSeedSource: open.clientSeedSource ?? "server-default" });
  const spin = () => {
    if (!open || open.status !== "paid") return;
    const clientSeed = open.clientSeed ?? "misty-default";
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
    setResolved({ digest, roll, outcome: { id: e.outcome.id, label: e.outcome.label, kind: e.outcome.kind === "oroos" ? "credit" : e.outcome.kind, credits: e.outcome.mistees, freeSpins: e.outcome.freeSpins, valueCents: e.outcome.valueUsd == null ? null : Math.round(e.outcome.valueUsd * 100), bandFrom: e.from, bandTo: e.to }, bonusSpins, creditsAwarded: e.outcome.mistees + bonusSpins.reduce((s, b) => s + b.credits, 0), serverSeed: open.serverSeed });
    setOpen({ ...open, status: "resolved" });
  };
  const doVerify = () => {
    if (!open || !resolved) return;
    const serverHash = sha256Hex(resolved.serverSeed);
    const digest = mistyDigest(box.slug, resolved.serverSeed, open.clientSeed ?? "misty-default", 1);
    const roll = rollOf(digest);
    const e = lookup(table, roll);
    const ok = serverHash === open.serverHash && digest === resolved.digest && e.outcome.id === resolved.outcome.id && table.hash === open.tableHash;
    setVerify({ ok, serverHash, matchesCommitment: serverHash === open.serverHash, digest, roll, outcomeId: e.outcome.id, outcomeLabel: e.outcome.label, tableHash: table.hash, reason: ok ? null : "mismatch" });
  };

  const publicOpen = open && { ...open, serverSeed: open.status === "resolved" ? open.serverSeed : "(hidden until reveal)" };

  return (
    <Card title="API sandbox: the flow, step by step, with real hashes">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-3">Box</span>
        <span className="w-64">
          <Select<string> value={slug} onChange={(v) => { setSlug(v); setOpen(null); setResolved(null); setVerify(undefined); }} options={MISTY_BOXES.map((b) => ({ value: b.slug, label: `${b.name} · $${b.price}` }))} />
        </span>
        <span className="text-ink-3">Client seed</span>
        <input className="w-44 rounded-md border border-line bg-paper px-2 py-1 text-sm" value={seedInput} onChange={(e) => setSeedInput(e.target.value)} />
        {open && <Badge tone={open.status === "resolved" ? "good" : "accent"}>open {open.status}</Badge>}
      </div>
      <div className="space-y-3">
        <Step n={1} title="Read the box and its frozen table hash" method="GET" path={`/v1/boxes/${slug}`} response={boxResponse} />
        <Step n={2} title="Create the open: the server commits to a secret before any payment" method="POST" path="/v1/opens" request={{ boxSlug: slug }} response={publicOpen ? { openId: publicOpen.openId, status: publicOpen.status, priceCents: publicOpen.priceCents, serverHash: publicOpen.serverHash, tableHash: publicOpen.tableHash, nonce: 1, expiresAt: publicOpen.expiresAt } : undefined}>
          <Button onClick={createOpen}>Create open</Button>
        </Step>
        <Step n={3} title="Player sets a seed (only before payment)" method="PUT" path={`/v1/opens/${open?.openId ?? "{openId}"}/client-seed`} request={{ clientSeed: seedInput }} response={open?.clientSeed ? { status: 204, stored: open.clientSeed, source: open.clientSeedSource } : undefined}>
          <Button kind="ghost" onClick={setSeed} disabled={!open || open.status !== "created"}>
            Set seed
          </Button>
        </Step>
        <Step n={4} title="Pay (idempotent). If no seed was set, the server fills the published default and records it" method="POST" path={`/v1/opens/${open?.openId ?? "{openId}"}/pay`} request={{ method: "card", paymentToken: "tok_test", idempotencyKey: "demo-1" }} response={open && open.status !== "created" ? { status: "paid", clientSeed: open.clientSeed, clientSeedSource: open.clientSeedSource } : undefined}>
          <Button kind="ghost" onClick={pay} disabled={!open || open.status !== "created"}>
            Pay
          </Button>
        </Step>
        <Step n={5} title="Spin: resolve once, write the award and the ledger, reveal the secret" method="POST" path={`/v1/opens/${open?.openId ?? "{openId}"}/spin`} response={resolved ? { status: "resolved", ...resolved, verifyUrl: `/v1/verify?slug=${slug}&serverSeed=${resolved.serverSeed}&clientSeed=${encodeURIComponent(open?.clientSeed ?? "")}&tableHash=${open?.tableHash}` } : undefined}>
          <Button kind="ghost" onClick={spin} disabled={!open || open.status !== "paid"}>
            Spin
          </Button>
        </Step>
        <Step n={6} title="Anyone recomputes it: seed against the hash, digest, roll, band" method="GET" path="/v1/verify" request={resolved ? { slug, serverSeed: resolved.serverSeed, clientSeed: open?.clientSeed, nonce: 1, tableHash: open?.tableHash } : undefined} response={verify}>
          <Button kind="ghost" onClick={doVerify} disabled={!resolved}>
            Verify
          </Button>
        </Step>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Everything above runs in your browser with the same functions the kit ships (buildTable, mistyDigest, rollOf, lookup, buildBonus, lookupBonus, sha256Hex). The server seed here comes from the browser&apos;s CSPRNG; on the server use crypto.randomBytes(32). Try it: create an open, change the seed after paying (the button is disabled, as the API must refuse), and verify.
      </p>
    </Card>
  );
}
