# GlobalRegAI Production Launcher with Forced UTF-8 Encoding
import sys
import os
import subprocess
import time

# Force UTF-8 Encoding for stdout/stderr to prevent CP949 garbling
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')
os.environ["PYTHONUTF8"] = "1"
os.environ["PYTHONIOENCODING"] = "utf-8"

def clean_port_8000():
    print("[GlobalRegAI Launcher] Checking port 8000 availability...", flush=True)
    try:
        cmd = "netstat -ano | findstr :8000"
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='cp949', errors='ignore')
        if res.stdout:
            lines = res.stdout.strip().split('\n')
            for line in lines:
                parts = line.split()
                if len(parts) >= 5 and "LISTENING" in line:
                    pid = parts[-1]
                    print(f"[GlobalRegAI Launcher] Terminating stale process listening on port 8000 (PID: {pid})...", flush=True)
                    subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
                    time.sleep(1.0)
    except Exception as e:
        print(f"[GlobalRegAI Launcher] Port check note: {e}", flush=True)

def main():
    clean_port_8000()
    print("[GlobalRegAI Launcher] Starting Uvicorn FastAPI Server with UTF-8 encoding on http://localhost:8000...", flush=True)
    import uvicorn
    from app import app
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

if __name__ == "__main__":
    main()
