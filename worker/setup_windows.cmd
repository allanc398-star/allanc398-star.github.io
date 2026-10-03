@echo off
setlocal
where py >nul 2>nul || (echo Python 3 is required.& exit /b 1)
if not exist .venv py -3 -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
echo.
echo Javis worker dependencies installed.
echo Set JAVIS_BRIDGE_URL and JAVIS_WORKER_KEY as local user environment variables.
echo Keep the worker key private and never paste it into GitHub.
