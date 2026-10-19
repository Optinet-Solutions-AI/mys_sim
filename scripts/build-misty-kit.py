"""Assemble the developer kit: copies the engine files with flattened imports, the kit docs and the vectors,
and writes public/downloads/misty-backend-kit.zip plus the readable files next to it.

Run from the simulator folder:  python scripts/build-misty-kit.py   (after: npx tsx scripts/misty-vectors.ts)
"""
import io, os, re, shutil, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(ROOT, "kit", "misty-backend")
OUT_DIR = os.path.join(ROOT, "public", "downloads", "misty-backend-kit")
ZIP = os.path.join(ROOT, "public", "downloads", "misty-backend-kit.zip")


def read(p):
    return io.open(p, encoding="utf-8").read()


def flatten(src):
    # ../hash -> ./hash, ../types -> ./types, ../mistyLive.generated -> ./mistyLive.generated, ../rng, ../metrics
    return re.sub(r'from "\.\./([A-Za-z.]+)"', r'from "./\1"', src)


def misty_types():
    s = read(os.path.join(ROOT, "src", "engine", "types.ts"))
    start = s.index("/* ---------- Misty: a copy of the live box mechanism")
    end = s.index("export type LabId")
    block = s[start:end]
    # the engine also needs these three small types
    extra = []
    for name in ("ChiSquare", "Verifier"):
        m = re.search(r"export interface %s \{.*?\n\}\n" % name, s, flags=re.S)
        extra.append(m.group(0))
    extra.append("export type Progress = (done: number, total: number) => void;\n")
    return "// Types used by the Misty engine. Extracted from the simulator's types.ts (kit v1.1).\n// API vocabulary differs: kind oroos -> credit (freeSpins >= 1 -> bonus), mistees -> credits, weight -> percent, valueUsd -> valueCents.\n\n" + block + "\n" + "\n".join(extra)


files = {}
files["misty.ts"] = flatten(read(os.path.join(ROOT, "src", "engine", "labs", "misty.ts")))
files["battleKit.ts"] = flatten(read(os.path.join(ROOT, "src", "engine", "labs", "battleKit.ts"))).replace('from "./misty"', 'from "./misty"')
files["mistyLive.generated.ts"] = read(os.path.join(ROOT, "src", "engine", "mistyLive.generated.ts"))
files["hash.ts"] = read(os.path.join(ROOT, "src", "engine", "hash.ts"))
files["rng.ts"] = flatten(read(os.path.join(ROOT, "src", "engine", "rng.ts")))
files["metrics.ts"] = flatten(read(os.path.join(ROOT, "src", "engine", "metrics.ts")))
files["types.ts"] = misty_types()
for name in ("README.md", "schema.sql", "openapi.yaml", "server-reference.ts", "test-vectors.json", "BATTLES.md", "schema-battles.sql", "battles-reference.ts", "test-vectors-battles.json"):
    files[name] = read(os.path.join(KIT, name))
files["misty-boxes-2026-10-12.json"] = read(os.path.join(ROOT, "public", "captures", "misty-boxes-2026-10-12.json"))
_fp = read(os.path.join(ROOT, "src", "lib", "frontendPrompt.ts"))
_bp = read(os.path.join(ROOT, "src", "lib", "battlesPrompt.ts"))
files["BATTLES_PROMPT.md"] = "# Prompt for the main repository: battles\n\nPaste everything below into a Claude session opened in the main project repository.\n\n---\n\n" + _bp[_bp.index("`") + 1 : _bp.rindex("`")] + "\n"
files["FRONTEND_PROMPT.md"] = "# Prompt for the front-end session\n\nPaste everything below into a Claude session opened in the front-end repository.\n\n---\n\n" + _fp[_fp.index("`") + 1 : _fp.rindex("`")] + "\n"
files["package.json"] = '{\n  "name": "misty-backend-kit",\n  "version": "1.2.0",\n  "private": true,\n  "type": "module",\n  "dependencies": { "@noble/hashes": "^2.4.0" },\n  "devDependencies": { "typescript": "^5.6.0", "tsx": "^4.19.0" }\n}\n'

# rng.ts and metrics.ts import from ./types: make sure the names they need exist
need = set(re.findall(r"import type \{([^}]*)\} from \"\./types\"", files["rng.ts"] + files["metrics.ts"]))
missing = []
for group in need:
    for n in [x.strip() for x in group.split(",") if x.strip()]:
        if not re.search(r"export (interface|type) %s\b" % n, files["types.ts"]):
            missing.append(n)
src_types = read(os.path.join(ROOT, "src", "engine", "types.ts"))
for n in sorted(set(missing)):
    m = re.search(r"export (?:interface %s \{.*?\n\}|type %s = [^;]*;)\n" % (n, n), src_types, flags=re.S)
    if m:
        files["types.ts"] += "\n" + m.group(0)
    else:
        print("WARNING: type not found for kit:", n)

os.makedirs(OUT_DIR, exist_ok=True)
for name, content in files.items():
    io.open(os.path.join(OUT_DIR, name), "w", encoding="utf-8", newline="\n").write(content)
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for name, content in files.items():
        z.writestr("misty-backend-kit/" + name, content)
print("wrote", ZIP, "with", len(files), "files;", sum(len(c) for c in files.values()), "bytes")
