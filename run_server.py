import sys
import os
import subprocess
import time

# Force UTF-8 encoding for Python console output on Windows to prevent text corruption (Mojibake)
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"] = "1"

def free_port(port=8000):
    """Detects and terminates any process currently bound to the specified port."""
    print(f"[GlobalRegAI Launcher] Checking port {port} availability...")
    try:
        if sys.platform == "win32":
            output = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode('utf-8', errors='ignore')
            lines = output.strip().split('\n')
            pids = set()
            for line in lines:
                parts = line.split()
                if len(parts) >= 5 and "LISTENING" in line:
                    pids.add(parts[-1])
            for pid in pids:
                if pid and pid != "0":
                    print(f"[GlobalRegAI Launcher] Terminating stale process listening on port {port} (PID: {pid})...")
                    subprocess.call(f"taskkill /F /PID {pid}", shell=True)
            time.sleep(1)
    except Exception:
        print(f"[GlobalRegAI Launcher] Port {port} is free and ready.")

if __name__ == "__main__":
    free_port(8000)
    print("[GlobalRegAI Launcher] Starting Uvicorn FastAPI Server with UTF-8 encoding on http://localhost:8000...")
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
