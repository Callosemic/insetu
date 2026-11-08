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

    @unittest.expectedFailure
    def test_known_bugs_are_fixed(self):
        """Cases marked known_bug pass on both sides. Expected to fail until they are fixed; then remove the markers and this decorator."""
        for entry in self._entries():
            cases = [c for c in entry["cases"] if "known_bug" in c]
            for case, actual in zip(cases, self._python_results(entry, [c["args"] for c in cases])):
                self.assertTrue(matches(case["expect"], actual), f"{entry['pair']}: {case['known_bug']}")
        if not any("known_bug" in c for e in self._entries() for c in e["cases"]):
            raise AssertionError("no known bugs are registered; remove @expectedFailure from this test")

    @unittest.skipUnless(shutil.which("node"), "Node.js binary is not installed in PATH")
    def test_covered_pairs_agree_on_seeded_random_inputs(self):
        """For covered pairs with a differential block, both sides give the same result on every seeded random input."""
        self._run_differential(status="covered")

    @unittest.skipUnless(shutil.which("node"), "Node.js binary is not installed in PATH")
    @unittest.expectedFailure
    def test_diverging_pairs_agree_on_seeded_random_inputs(self):
        """Pairs marked diverges disagree today. Expected to fail until they agree; then mark them covered and this stays green with nothing to run."""
        self._run_differential(status="diverges")

    def _run_differential(self, status: str):
        entries = [e for e in load_pairs() if e["status"] == status and e.get("differential")]
        if status == "diverges" and not entries:
            raise AssertionError("no pair is marked diverges; remove @expectedFailure from this test")
        for entry in entries:
            spec = entry["differential"]
            inputs = random_merge_inputs(spec["seed"], spec["count"]) if entry.get("adapter") == "merge" else []
            py_results = self._python_results(entry, inputs)
            js_results = run_javascript([{"pair": entry["pair"], "javascript": entry["javascript"], "adapter": entry.get("adapter"), "inputs": inputs}])[entry["pair"]]["results"]
            for args, py, js in zip(inputs, py_results, js_results):
                self.assertEqual(py, js.get("value"), f"{entry['pair']} differs (seed {spec['seed']}) on {args!r}")


if __name__ == "__main__":
    unittest.main()
