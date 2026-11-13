"""Parallel Python and JavaScript logic: every pair registered in tests/parity/ runs its shared cases through both implementations.

Each tests/parity/<pair>.json is the registry entry for one piece of logic that exists in both languages
(docs/01_engineering_standards.md §1, "Parallel Python and JavaScript Logic") and holds the cases both sides must pass.
"""
import importlib
import json
import random
import shutil
import unittest
from pathlib import Path
from typing import Any, Callable, Dict, List

from insetu.core.utils_core import execute_binary

PARITY_DIR = Path(__file__).resolve().parent.parent / "parity"
LOADER_PATH = (Path(__file__).resolve().parent / "js_loader.mjs").resolve()
STATUSES = {"covered", "diverges", "pending"}
REQUIRED_KEYS = {"pair", "status", "why", "python", "javascript", "cases"}


def load_pairs() -> List[Dict[str, Any]]:
    """Reads every registry entry in tests/parity/, keeping its file name for messages."""
    pairs = []
    for path in sorted(PARITY_DIR.glob("*.json")):
        entry = json.loads(path.read_text(encoding="utf-8"))
        entry["_file"] = path.name
        pairs.append(entry)
    return pairs


def resolve_python(spec: str) -> Callable:
    """Resolves "module:attr.path" to the Python callable it names."""
    module_name, _, attr_path = spec.partition(":")
    target: Any = importlib.import_module(module_name)
    for attr in attr_path.split("."):
        target = getattr(target, attr)
    return target


def python_merge_adapter(fn: Callable, args: List[Any]) -> Dict[str, Any]:
    """Maps (base, disk, incoming) -> (clean, merged) onto {clean, merged}."""
    clean, merged = fn(*args)
    return {"clean": bool(clean), "merged": merged}


PYTHON_ADAPTERS = {"merge": python_merge_adapter}

# Runs in Node: imports each JavaScript implementation and returns its results for every case
NODE_RUNNER = r"""
import fs from 'node:fs';
const jobs = JSON.parse(fs.readFileSync(0, 'utf8'));
const ADAPTERS = {
    // Python order is (base, disk, incoming); JavaScript is (base, local, remote) with local the incoming side
    merge: (fn, [base, disk, incoming]) => {
        const r = fn(base, incoming, disk);
        return { clean: Boolean(r.clean), merged: r.merged };
    },
};
const out = {};
for (const job of jobs) {
    const cut = job.javascript.lastIndexOf(':');
    const url = job.javascript.slice(0, cut);
    const path = job.javascript.slice(cut + 1).split('.');
    const mod = await import(url);
    const onWindow = path[0] === 'window';
    let target = onWindow ? (globalThis.window || globalThis) : mod;
    for (const key of (onWindow ? path.slice(1) : path)) target = target == null ? undefined : target[key];
    if (typeof target !== 'function') { out[job.pair] = { missing: true }; continue; }
    const adapter = ADAPTERS[job.adapter];
    out[job.pair] = { results: job.inputs.map(args => {
        try {
            return { value: adapter ? adapter(target, args) : target(...args) };
        } catch (e) {
            return { error: String(e && e.message || e) };
        }
    }) };
}
process.stdout.write(JSON.stringify(out));
"""


def run_javascript(jobs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Runs every job's inputs through its JavaScript implementation in one Node process."""
    res = execute_binary(
        ["node", "--import", LOADER_PATH.as_posix(), "--input-type=module", "-e", NODE_RUNNER],
        input=json.dumps(jobs),
        capture_output=True,
        text=True,
        timeout=60.0,
    )
    if res.returncode != 0:
        raise AssertionError(f"Node runner failed:\n{res.stderr}")
    lines = [line for line in res.stdout.splitlines() if line.startswith("{")]
    return json.loads(lines[-1])


def matches(expect: Any, actual: Any) -> bool:
    """A dict expectation names only the keys that must match; anything else must be equal."""
    if isinstance(expect, dict) and isinstance(actual, dict):
        return all(key in actual and actual[key] == value for key, value in expect.items())
    return expect == actual


def random_merge_inputs(seed: int, count: int) -> List[List[str]]:
    """Seeded small three-way inputs: a base of up to six short lines and two sides with one to three line edits each."""
    rng = random.Random(seed)

    def mutate(lines: List[str]) -> List[str]:
        out = list(lines)
        for _ in range(rng.randint(1, 3)):
            op = rng.choice(["insert", "delete", "change"])
            i = rng.randint(0, len(out))
            if op == "insert":
                out.insert(i, rng.choice("abcxyz") + str(rng.randint(0, 9)))
            elif out and i < len(out):
                if op == "delete":
                    del out[i]
                else:
                    out[i] = out[i] + "*"
        return out

    inputs = []
    for _ in range(count):
        base = [rng.choice("abcdef") for _ in range(rng.randint(0, 6))]
        inputs.append(["\n".join(base), "\n".join(mutate(base)), "\n".join(mutate(base))])
    return inputs


def wide_merge_inputs(seed: int, count: int) -> List[List[str]]:
    """Seeded harder three-way inputs: files of up to 200 lines mixing distinct and repeated lines, block edits,
    duplicated and swapped lines, one side built on the other, trailing newlines and Windows line endings."""
    rng = random.Random(seed)

    def line(repeated: float) -> str:
        if rng.random() < repeated:
            return rng.choice(["", "}", "    pass", "end", "x", "    return x"])
        return f"line {rng.randint(0, 10 ** 6)}"

    def mutate(lines: List[str], edits: int) -> List[str]:
        out = list(lines)
        for _ in range(edits):
            op = rng.choice(["insert", "delete", "change", "block_insert", "block_delete", "duplicate", "swap"])
            i = rng.randint(0, len(out))
            if op == "insert":
                out.insert(i, line(0.3))
            elif op == "block_insert":
                out[i:i] = [line(0.3) for _ in range(rng.randint(2, 6))]
            elif out and i < len(out):
                if op == "delete":
                    del out[i]
                elif op == "block_delete":
                    del out[i:i + rng.randint(2, 6)]
                elif op == "change":
                    out[i] = out[i] + rng.choice(["*", " # edit", "!"])
                elif op == "duplicate":
                    out.insert(i, out[i])
                elif op == "swap" and i + 1 < len(out):
                    out[i], out[i + 1] = out[i + 1], out[i]
        return out

    inputs = []
    for _ in range(count):
        repeated = rng.choice([0.0, 0.2, 0.6, 1.0])
        base = [line(repeated) for _ in range(rng.choice([0, 1, 3, 8, 20, 60, 200]))]
        disk = mutate(base, rng.randint(1, 5))
        incoming = mutate(disk if rng.random() < 0.15 else base, rng.randint(1, 5))
        texts = ["\n".join(base), "\n".join(disk), "\n".join(incoming)]
        if rng.random() < 0.2:
            texts = [text + "\n" for text in texts]
        for index in range(3):
            if rng.random() < 0.1:
                texts[index] = texts[index].replace("\n", "\r\n")
        inputs.append(texts)
    return inputs


def differential_inputs(entry: Dict[str, Any]) -> List[List[str]]:
    """The seeded random inputs an entry's differential block asks for."""
    spec = entry["differential"]
    if entry.get("adapter") != "merge":
        return []
    inputs = random_merge_inputs(spec["seed"], spec["count"])
    if spec.get("wide_count"):
        inputs += wide_merge_inputs(spec.get("wide_seed", spec["seed"]), spec["wide_count"])
    return inputs


class TestParallelLogicRegistry(unittest.TestCase):
    """The registry itself: complete entries whose named definitions exist on both sides."""

    def test_every_entry_is_complete(self):
        """Each entry names its pair after its file, has a known status and a reason, and lists cases unless pending."""
        pairs = load_pairs()
        self.assertTrue(pairs, "tests/parity/ holds no registry entries")
        for entry in pairs:
            with self.subTest(file=entry["_file"]):
                self.assertLessEqual(REQUIRED_KEYS, set(entry), f"missing keys: {REQUIRED_KEYS - set(entry)}")
                self.assertEqual(entry["_file"], f"{entry['pair']}.json")
                self.assertIn(entry["status"], STATUSES)
                self.assertTrue(entry["why"].strip())
                if entry["status"] != "pending":
                    self.assertTrue(entry["cases"], "a covered or diverging pair needs cases")
                    self.assertTrue(entry["javascript"], "a covered or diverging pair names its JavaScript side")

    def test_python_definitions_exist(self):
        """A renamed or moved Python twin fails here, so the registry cannot point at nothing."""
        for entry in load_pairs():
            with self.subTest(pair=entry["pair"]):
                self.assertTrue(callable(resolve_python(entry["python"])))

    @unittest.skipUnless(shutil.which("node"), "Node.js binary is not installed in PATH")
    def test_javascript_definitions_exist(self):
        """A renamed or moved JavaScript twin fails here."""
        jobs = [{"pair": e["pair"], "javascript": e["javascript"], "adapter": None, "inputs": []} for e in load_pairs() if e["javascript"]]
        out = run_javascript(jobs)
        for job in jobs:
            with self.subTest(pair=job["pair"]):
                self.assertNotIn("missing", out.get(job["pair"], {"missing": True}), f"{job['javascript']} is not a function")


class TestParallelLogicCases(unittest.TestCase):
    """The shared cases, run through both implementations."""

    def _entries(self):
        return [e for e in load_pairs() if e["status"] != "pending"]

    def _python_results(self, entry, inputs):
        fn = resolve_python(entry["python"])
        adapter = PYTHON_ADAPTERS.get(entry.get("adapter"))
        return [adapter(fn, args) if adapter else fn(*args) for args in inputs]

    def test_python_passes_shared_cases(self):
        """Every case not marked known_bug passes in Python."""
        for entry in self._entries():
            cases = [c for c in entry["cases"] if "known_bug" not in c]
            for case, actual in zip(cases, self._python_results(entry, [c["args"] for c in cases])):
                with self.subTest(pair=entry["pair"], case=case.get("label", case["args"])):
                    self.assertTrue(matches(case["expect"], actual), f"expected {case['expect']!r}, got {actual!r}")

    @unittest.skipUnless(shutil.which("node"), "Node.js binary is not installed in PATH")
    def test_javascript_passes_shared_cases(self):
        """Every case not marked known_bug passes in JavaScript."""
        entries = self._entries()
        jobs = []
        for entry in entries:
            cases = [c for c in entry["cases"] if "known_bug" not in c]
            jobs.append({"pair": entry["pair"], "javascript": entry["javascript"], "adapter": entry.get("adapter"), "inputs": [c["args"] for c in cases], "_cases": cases})
        out = run_javascript([{k: v for k, v in j.items() if k != "_cases"} for j in jobs])
        for job in jobs:
            for case, result in zip(job["_cases"], out[job["pair"]]["results"]):
                with self.subTest(pair=job["pair"], case=case.get("label", case["args"])):
                    self.assertNotIn("error", result, result.get("error"))
                    self.assertTrue(matches(case["expect"], result["value"]), f"expected {case['expect']!r}, got {result['value']!r}")

    def test_known_bugs_still_fail(self):
        """A case marked known_bug is expected to fail in Python. When one passes, the bug is fixed: remove its marker so the case is enforced."""
        for entry in self._entries():
            cases = [c for c in entry["cases"] if "known_bug" in c]
            for case, actual in zip(cases, self._python_results(entry, [c["args"] for c in cases])):
                with self.subTest(pair=entry["pair"], case=case.get("label", case["args"])):
                    self.assertFalse(matches(case["expect"], actual), f"{entry['pair']}: this known bug now passes; remove its known_bug marker ({case['known_bug']})")

    @unittest.skipUnless(shutil.which("node"), "Node.js binary is not installed in PATH")
    def test_covered_pairs_agree_on_seeded_random_inputs(self):
        """For covered pairs with a differential block, both sides give the same result on every seeded random input."""
        for entry in [e for e in load_pairs() if e["status"] == "covered" and e.get("differential")]:
            inputs, py_results, js_results = self._differential(entry)
            for args, py, js in zip(inputs, py_results, js_results):
                self.assertEqual(py, js.get("value"), f"{entry['pair']} differs on {args!r}")

    @unittest.skipUnless(shutil.which("node"), "Node.js binary is not installed in PATH")
    def test_diverging_pairs_still_diverge(self):
        """A pair marked diverges is expected to disagree somewhere. When the two sides agree on every input, mark the pair covered so agreement is enforced."""
        for entry in [e for e in load_pairs() if e["status"] == "diverges" and e.get("differential")]:
            inputs, py_results, js_results = self._differential(entry)
            differing = sum(1 for py, js in zip(py_results, js_results) if py != js.get("value"))
            self.assertGreater(differing, 0, f"{entry['pair']}: the two sides now agree on all {len(inputs)} inputs; mark the pair covered")

    def _differential(self, entry):
        inputs = differential_inputs(entry)
        py_results = self._python_results(entry, inputs)
        js_results = run_javascript([{"pair": entry["pair"], "javascript": entry["javascript"], "adapter": entry.get("adapter"), "inputs": inputs}])[entry["pair"]]["results"]
        self.assertEqual(len(js_results), len(inputs))
        return inputs, py_results, js_results

if __name__ == "__main__":
    unittest.main()
