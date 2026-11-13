#!/usr/bin/env bash
# Pre-release check: runs a repository's unit and fitness suites on every Python version the CI
# battery's gate jobs use, the way the gate does (a fresh environment per version, dependencies
# from the repository's own pyproject.toml, so insetu gets akasa through its pin).
#
#   scripts/release_check.sh                 # check the repository this script lives in (insetu)
#   scripts/release_check.sh ../akasa        # check another repository (akasa, sutram)
#   scripts/release_check.sh --local-akasa   # insetu against ../akasa as checked out, not the pinned release
#   PYTHONS="3.12" scripts/release_check.sh  # override the version list
#
# Needs uv (https://docs.astral.sh/uv/); uv fetches any Python version that is missing.
# Environments are cached under ~/.cache/callosemic-release-check, so later runs are quick.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
insetu_root="$(cd "$script_dir/.." && pwd)"
repo="$insetu_root"
local_akasa=0
for arg in "$@"; do
    case "$arg" in
        --local-akasa) local_akasa=1 ;;
        -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
        *) repo="$(cd "$arg" && pwd)" ;;
    esac
done
name="$(basename "$repo")"

if ! command -v uv >/dev/null 2>&1; then
    echo "release_check: uv is not installed (https://docs.astral.sh/uv/)." >&2
    exit 2
fi

# Same versions as the battery's gate jobs, read from the workflow so the two never drift apart.
battery="$insetu_root/.github/workflows/battery.yml"
if [ -z "${PYTHONS:-}" ]; then
    PYTHONS="$(grep -E 'role: gate' "$battery" | sed -E 's/.*python: "([0-9.]+)".*/\1/' | tr '\n' ' ')"
fi
if [ -z "${PYTHONS// /}" ]; then
    echo "release_check: could not read the gate's Python versions from $battery; set PYTHONS." >&2
    exit 2
fi

extras=""
[ "$name" = "insetu" ] && extras="[all]"
cache_root="${XDG_CACHE_HOME:-$HOME/.cache}/callosemic-release-check"
mkdir -p "$cache_root"

declare -a summary=()
failed=0
for py in $PYTHONS; do
    venv="$cache_root/$name-py$py"
    echo
    echo "=== $name · Python $py ==="
    uv venv --quiet --allow-existing --python "$py" "$venv"
    # shellcheck disable=SC1091
    source "$venv/bin/activate"
    uv pip install --quiet -e "$repo$extras"
    if [ "$local_akasa" = 1 ] && [ "$name" = "insetu" ]; then
        uv pip install --quiet --no-deps -e "$insetu_root/../akasa"
    fi
    for suite in run_unit_tests fitness_functions; do
        suite_args=""
        [ "$suite" = run_unit_tests ] && [ "$name" = insetu ] && suite_args="--no-fitness"
        # shellcheck disable=SC2086
        if (cd "$repo" && python "tests/$suite.py" $suite_args >"$venv/last_$suite.log" 2>&1); then
            summary+=("ok    $name  py$py  $suite")
        else
            summary+=("FAIL  $name  py$py  $suite   (log: $venv/last_$suite.log)")
            failed=1
        fi
    done
    deactivate
done

echo
echo "=== Release check: $name ==="
printf '%s\n' "${summary[@]}"
if [ "$failed" = 1 ]; then
    echo "Not ready: fix the failures above (each log has the full output)."
    exit 1
fi
echo "Ready: every gate version passes."
