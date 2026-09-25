@echo off
rem PRO100 көпірі: pro100-bridge.exe жинау (Windows, Python 3.12).
rem Қолдану: build.bat  -> dist\pro100-bridge.exe
setlocal
cd /d "%~dp0"
where py >nul 2>nul && (set PY=py -3.12) || (set PY=python)
%PY% -m venv .venv-build || goto :err
call .venv-build\Scripts\activate.bat || goto :err
python -m pip install --upgrade pip || goto :err
python -m pip install -r requirements.txt -r requirements-dev.txt "pyinstaller>=6,<7" || goto :err
rem Алдымен таза логиканың тесттері (GUI-сіз)
python -m pytest -q || goto :err
pyinstaller --clean --noconfirm pro100-bridge.spec || goto :err
dist\pro100-bridge.exe --version || goto :err
echo.
echo OK: dist\pro100-bridge.exe
exit /b 0
:err
echo.
echo BUILD FAILED (errorlevel %errorlevel%)
exit /b 1
