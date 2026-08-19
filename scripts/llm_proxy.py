#!/usr/bin/env python3
"""
GlobalRegAI — LLM Intelligence Proxy (v1.2.0)
Acts as an OpenAI-compatible API that adds multilingual intelligence and real-time FDA interceptor.
"""

import os
import sys
import uvicorn
import requests
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from groq_client import GroqClient
from language_manager import LanguageManager

load_dotenv()

app = FastAPI(title="GlobalRegAI Proxy Enhanced")
groq_client = GroqClient()
lang_manager = LanguageManager()

def fetch_realtime_openfda_alert(text_content: str) -> str:
    """
    비용 0원 / 인증키 없이 openFDA 데이터를 실시간 쿼리하여
    질문 내 성분과 매칭되는 미국 규제 경고 컨텍스트 반환 (안티-환각 보완)
    """
    # 글로벌 실버 타겟 및 주요 건기식/의약품 핵심 스크리닝 키워드
    common_substances = [
        "Aspirin", "Ibuprofen", "Acetaminophen", "Ginseng", "Vitamin", 
        "Red Ginseng", "Probiotics", "Omega", "Omega-3", "Penicillin"
    ]
    detected_substance = None
    
    for substance in common_substances:
        if substance.lower() in text_content.lower():
            detected_substance = substance
            break
            
    if not detected_substance:
        return ""

    # openFDA Drug Event API 실시간 호출 (무료, 별도 키 불필요)
    fda_url = f"https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:{detected_substance}&limit=1"
    try:
        res = requests.get(fda_url, timeout=3)
        if res.status_code == 200:
            data = res.json()
            results = data.get("results", [])
            if results:
                safety_report = results[0].get("serious", "N/A")
                serious_details = "심각한 부작용 보고 이력 존재 (Serious Adverse Event Reported)" if safety_report == "1" else "일반적인 부작용 레포트 존재"
                
                context_str = (
                    f"\n\n[REAL-TIME FDA INTELLIGENCE INTERCEPTOR]\n"
                    f"- Detected Substance: {detected_substance}\n"
                    f"- Current FDA Safety Report Status: {serious_details}\n"
                    f"*Instruction: Incorporate this real-time U.S. FDA safety data into your comparative regulation analysis seamlessly.*"
                )
                return context_str
    except Exception:
        # 오픈소스 외부 API 장애 혹은 타임아웃 시 메인 LLM 인프라 서빙은 끊기지 않도록 가볍게 패스
        pass
    return ""

@app.post("/v1/chat/completions")
async def chat_proxy(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    messages = body.get("messages", [])
    
    if not messages:
        raise HTTPException(status_code=400, detail="Messages are required")

    # 1. 마지막 사용자의 질문(User Content) 추출[cite: 2]
    user_content = ""
    for msg in reversed(messages):
        if msg["role"] == "user":
            user_content = msg["content"]
            break
    
    # 2. 언어 감지 및 규제 용어집 로드[cite: 2]
    lang_code = lang_manager.detect_language(user_content)
    system_addon = lang_manager.get_system_prompt_addon(lang_code)
    
    # 3. 실시간 openFDA 인터셉터를 통한 데이터 수집 및 컨텍스트 강화 (무료)
    fda_alert_context = fetch_realtime_openfda_alert(user_content)
    if fda_alert_context:
        system_addon += fda_alert_context
    
    # 4. 시스템 프롬프트 업데이트 또는 최상단 삽입[cite: 2]
    has_system = False
    for msg in messages:
        if msg["role"] == "system":
            msg["content"] = msg["content"] + "\n" + system_addon
            has_system = True
            break
    
    if not has_system:
        messages.insert(0, {"role": "system", "content": system_addon})

    # 5. Groq API 호출[cite: 2]
    print(f"[Proxy] Detected language: {lang_code} (FDA Interceptor Active). Calling Groq...")
    
    try:
        response_content = groq_client.chat_completion(
            messages=messages,
            temperature=body.get("temperature", 0.2),
            max_tokens=body.get("max_tokens", 8192)  # 14시간 전 커밋 스펙인 8192 상한선으로 동기화 확장
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq Client Error: {str(e)}")

    # 6. OpenAI 호환 응답 생성[cite: 2]
    return {
        "id": "globalregai-proxy-id",
        "object": "chat.completion",
        "created": int(time.time()) if 'time' in sys.modules else 123456789,
        "model": groq_client.model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_content
                },
                "finish_reason": "stop"
            }
        ]
    }

@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": "globalregai-llama3-70b", "object": "model", "owned_by": "globalregai"}
        ]
    }

if __name__ == "__main__":
    import time
    # 기존 Electron 환경 호환 및 IPv4 강제 바인딩 레이아웃 유지 (ERR_CONNECTION_REFUSED 전면 방어)
    uvicorn.run(app, host="0.0.0.0", port=8000)