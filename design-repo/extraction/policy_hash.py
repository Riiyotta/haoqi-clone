#!/usr/bin/env python3
"""Content hash of the files the design policy is enforced by (R15).

    python3 extraction/policy_hash.py            # print sha256:...
    python3 extraction/policy_hash.py --write    # write it into registry.manifest.json + policy/design-policy.json

sha256 over, for each file in ENFORCED_BY (fixed order): relative path, NUL, file bytes, NUL.
verify_all.py recomputes it and fails on drift.
"""
import hashlib, json, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENFORCED_BY = ["tokens/llm/token-policy.json", "tokens/llm/token-catalog.json", "compatibility/graph.json", "schema/pagespec.schema.json",
               "schema/semantic_validate.py", "policy/source-identity.json", "assets/asset-roles.json"]


def compute():
    h = hashlib.sha256()
    for rel in ENFORCED_BY:
        h.update(rel.encode() + b"\0" + (REPO / rel).read_bytes() + b"\0")
    return "sha256:" + h.hexdigest()


if __name__ == "__main__":
    v = compute()
    if "--write" in sys.argv:
        for rel, getter in (("registry.manifest.json", lambda d: d["designPolicy"]), ("policy/design-policy.json", lambda d: d)):
            p = REPO / rel
            d = json.loads(p.read_text())
            getter(d)["contentHash"] = v
            p.write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n")
    print(v)
