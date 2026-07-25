import sys
from fitness import run_all
from fitness.core import FitnessState

if __name__ == "__main__":
    print("============================================================")
    print("      inSetu Architectural Fitness Functions Validator      ")
    print("============================================================\n")

    run_all()

    print("============================================================")
    if FitnessState.violations_found == 0:
        print("✅ SUCCESS: Codebase complies with all engineering standards.")
        sys.exit(0)
    else:
        print(f"❌ FAILED: Found {FitnessState.violations_found} architectural violations.")
        sys.exit(1)