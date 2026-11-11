"""JSON stdio worker（唯一の入口）。正典源はリポジトリ直下、ビルド時に runtime/python へコピー。"""
import json
import re
import sys
from pathlib import Path
from dynamicprompts.wildcards import WildcardManager
from dynamicprompts.generators import RandomPromptGenerator, CombinatorialPromptGenerator

REF = re.compile(r"__([A-Za-z0-9_]+)__")
KINDS = {"txt", "csv", "json", "yaml"}
LORA_SUFFIXES = {".safetensors", ".pt"}


def detect_encoding(data: bytes) -> str:
    # R6: utf-8-sig → cp932 の順で判定
    for enc in ("utf-8-sig", "cp932"):
        try:
            data.decode(enc)
            return enc
        except UnicodeDecodeError:
            continue
    raise ValueError("encoding undetectable")


def collections(root: Path):
    return sorted(
        p for p in root.rglob("*")
        if p.is_file() and p.suffix[1:] in KINDS
    )


def handle(req: dict) -> dict:
    root = Path(req.get("root", ""))
    cmd = req["command"]
    if cmd == "index":
        wm = WildcardManager(root)
        return {"collections": [
            {"name": p.relative_to(root).with_suffix("").as_posix(),
             "path": p.relative_to(root).as_posix(),
             "count": len(wm.get_values(p.relative_to(root).with_suffix("").as_posix())),
             "kind": p.suffix[1:]}
            for p in collections(root)
        ]}
    if cmd == "refs":
        edges = {
            p.relative_to(root).with_suffix("").as_posix():
                sorted({m.group(1) for m in REF.finditer(p.read_text(encoding="utf-8", errors="ignore"))})
            for p in collections(root)
        }
        seen = set()
        def dfs(node, stack):
            seen.add(node)
            for ref in edges.get(node, ()):
                if ref in edges:
                    if ref in stack:
                        return stack[stack.index(ref):] + [ref]
                    if ref not in seen:
                        cycle = dfs(ref, stack + [ref])
                        if cycle:
                            return cycle
            return None
        cycle = next((c for n in edges if n not in seen and (c := dfs(n, [n]))), None)
        return {"edges": edges, "cycle": cycle}
    if cmd == "list_loras":
        return {"loras": sorted(p.name for p in root.rglob("*") if p.is_file() and p.suffix in LORA_SUFFIXES)}
    if cmd == "read":
        data = (root / req["file"]).read_bytes()
        enc = detect_encoding(data)
        return {"encoding": enc, "text": data.decode(enc)}
    if cmd == "write":
        try:
            Path(req["path"]).write_bytes(req["text"].encode(req["encoding"]))
        except UnicodeEncodeError as e:
            return {"error": f"{req['encoding']} で表現できない文字があります: {e.object[e.start]}（{e.start + 1} 文字目）"}
        return {"ok": True}
    if cmd == "expand":
        wm = WildcardManager(root)
        # shortcut: seeds マルチ未対応（複数 seed 比較が要るまで seed のみ）
        if req.get("generator") == "combinatorial":
            gen = CombinatorialPromptGenerator(wildcard_manager=wm)
        else:
            gen = RandomPromptGenerator(wildcard_manager=wm, seed=req.get("seed"))
        return {"results": gen.generate(req["prompt"], req.get("count", 8))}
    raise ValueError(f"unknown command: {cmd}")


def main():
    sys.stdin.reconfigure(encoding="utf-8-sig")
    sys.stdout.reconfigure(encoding="utf-8")
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            resp = handle(json.loads(line))
        except Exception as e:
            resp = {"error": str(e)}
        print(json.dumps(resp, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
