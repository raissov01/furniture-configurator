"""PyInstaller кіру нүктесі: `pro100-bridge.exe <command>` = `python -m pro100_bridge <command>`."""
from pro100_bridge.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
