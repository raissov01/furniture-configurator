# -*- mode: python ; coding: utf-8 -*-
# PyInstaller: бір файлды pro100-bridge.exe. Жинау тек Windows-та: build.bat.
from PyInstaller.utils.hooks import collect_submodules

hidden = (
    collect_submodules("pywinauto")
    + ["win32clipboard", "win32gui", "win32api", "win32process", "mss", "mss.tools",
       "pro100_bridge.ui_pro100", "pro100_bridge.dryrun"]
)

a = Analysis(
    ["run_bridge.py"],
    pathex=["."],
    binaries=[],
    datas=[],
    hiddenimports=hidden,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "pytest", "numpy", "PIL.ImageQt"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="pro100-bridge",
    console=True,          # тестер прогресті консольден көреді
    upx=False,             # UPX антивирусты жиі шошытады
    debug=False,
    strip=False,
    runtime_tmpdir=None,
)
