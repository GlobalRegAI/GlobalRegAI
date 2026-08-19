import sys
import httpx

def test_developer_login():
    print("=== TESTING DEVELOPER ADMIN LOGIN & AUTHENTICATION ===", flush=True)
    
    # 1. Invalid login attempt
    bad_res = httpx.post("http://localhost:8000/api/auth/login", json={
        "username": "invalid_user",
        "password": "wrong_password"
    })
    assert bad_res.status_code == 401
    print("SUCCESS: Rejected invalid developer login attempt (HTTP 401).", flush=True)

    # 2. Valid developer login attempt
    good_res = httpx.post("http://localhost:8000/api/auth/login", json={
        "username": "developer",
        "password": "globalregai2026!"
    })
    assert good_res.status_code == 200
    data = good_res.json()
    assert data["status"] == "SUCCESS"
    token = data["token"]
    print(f"SUCCESS [HTTP 200]: Developer Login authenticated successfully! Token: {token}", flush=True)

    # 3. Access protected developer console
    console_res = httpx.get("http://localhost:8000/developer-console", cookies={"dev_auth_token": token})
    assert console_res.status_code == 200
    assert "Developer Admin Cockpit" in console_res.text
    print("SUCCESS [HTTP 200]: Accessed protected Developer Admin Cockpit successfully!", flush=True)

    print("\nDEVELOPER LOGIN AUTHENTICATION PASSED 100% SUCCESS!", flush=True)

if __name__ == "__main__":
    test_developer_login()
