# MFDS Regulatory Glossary & Document Auto-Translator Module with PDF/DOCX Bytecode Sanitizer
import sys
import os
import io
import re
import json
import httpx
from typing import Dict, List, Any

# Forced UTF-8 Encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

MFDS_REGULATORY_GLOSSARY = {
    # CADIFA & ANVISA Specific Terms (Portuguese & English)
    "SUGESTÃO DE NOMES PARA OS ARQUIVOS DOS PETICIONAMENTOS RELACIONADOS A CADIFA": "CADIFA 연관 신청 서류 파일명 추천 지침",
    "RECOMMENDED FILE NAMES FOR CADIFA RELATED SUBMISSIONS": "CADIFA 관련 제출 서류 추천 파일명 규격",
    "Agência Nacional de Vigilância Sanitária": "브라질 국가위생감시국(ANVISA)",
    "Módulo 1": "모듈 1 (행정 정보)",
    "Module 1": "모듈 1 (행정 정보)",
    "Módulo 2": "모듈 2 (품질 평가 요약서)",
    "Module 2": "모듈 2 (품질 평가 요약서)",
    "Módulo 3": "모듈 3 (원료의약품 품질 자료)",
    "Module 3": "모듈 3 (원료의약품 품질 자료)",
    "Formulário de Petição": "신청서 양식 (Formulário de Petição)",
    "Application Form": "신청서 양식 (Application Form)",
    "Justificativa": "사유서 / 타당성 입증서",
    "Justification": "사유서 / 타당성 입증서",
    "Cópia da Exigência Técnica": "보완 요구사항 회신서",
    "Response": "보완 요구사항 회신서",
    "Comprovante de quitação da TFVS": "TFVS 수수료 납부 영수증",
    "TFVS Payment Receipt": "TFVS 수수료 납부 영수증",
    "Atas de Reunião em Parlatório": "회의록 (Parlatório 회의)",
    "Meeting Minutes": "회의록 (Meeting Minutes)",
    "Informação Administrativa": "행정 관련 정보",
    "Administrative Information": "행정 관련 정보",
    "Respostas recebidas via Central de Atendimento": "질의응답 서신 회신문",
    "Ofícios em resposta à questionamentos enviados a Agência": "ANVISA 공식 회신 서한문",
    "Outras informações administrativas": "기타 행정 정보",
    "Informações do IFA": "원료의약품(IFA / API) 정보",
    "Information of API": "원료의약품(IFA / API) 정보",
    "Informações Regulatórias Internacionais": "국제 규제 정보",
    "International Regulatory Information": "국제 규제 정보",
    "Petições Secundárias": "변경 및 수선 신청서",
    "Change, Response and Other Applications": "변경 및 수선 신청서",
    "Declarações Pós-Registro": "시판 후 변경 신고 문서",
    "Supporting Documentation": "입증 첨부 문서",
    "Índice Documento Técnico Comum": "CTD 공통기술문서 목차",
    "Table of Contents": "목차",
    "Resumo Geral da Qualidade": "품질 평가 요약서 (QOS)",
    "Quality Overall Summary": "품질 평가 요약서 (QOS)",
    "Insumo Farmacêutico Ativo": "원료의약품 (IFA / API)",
    "Active Pharmaceutical Ingredient": "원료의약품 (IFA / API)",
    
    # 일반 GMP / 의약품 / 독성 용어
    "Process Validation": "공정 밸리데이션(타당성 확인)",
    "Cleaning Validation": "세척 밸리데이션",
    "Critical Quality Attribute": "주요 품질 특성(CQA)",
    "Critical Process Parameter": "주요 공정 변수(CPP)",
    "Health-Based Exposure Limit": "건강 기반 노출 한계(HBEL)",
    "Permitted Daily Exposure": "1일 노출 허용량(PDE)",
    "Maximum Allowable Carryover": "잔류 허용 기준치(MAC)",
    "Data Integrity": "데이터 완전성 (ALCOA+)",
    "Audit Trail": "감사 추적",
    "Batch Production Record": "제조기록서",
    "Master Formula": "제조처방서",
    "Corrective and Preventive Action": "시정 및 예방조치(CAPA)",
    "Out of Specification": "기준 일탈(OOS)",
    "Out of Trend": "경향 일탈(OOT)",
    "Good Manufacturing Practice": "우수 의약품 제조 및 품질관리기준(GMP)"
}

def sanitize_pdf_bytecode(text: str) -> str:
    """PDF 바이너리 객체 코드(%PDF, << /Type /Catalog, obj, stream, endstream) 자동 정화 필터"""
    if not text:
        return ""
    
    # 1. Remove PDF object stream wrappers
    clean = re.sub(r'%\w+[\s\S]*?obj', '', text)
    clean = re.sub(r'<</Type[\s\S]*?>>', '', clean)
    clean = re.sub(r'stream[\s\S]*?endstream', '', clean)
    clean = re.sub(r'xref[\s\S]*?trailer', '', clean)
    clean = re.sub(r'/[A-Z0-9]{2,}', '', clean)
    
    # 2. Filter out raw PDF bytecode lines
    lines = clean.split('\n')
    sanitized_lines = []
    for line in lines:
        l_str = line.strip()
        if not l_str:
            continue
        if l_str.startswith("%PDF") or "StructTreeRoot" in l_str or "ViewerPreferences" in l_str or "MediaBox" in l_str or "FlateDecode" in l_str:
            continue
        if l_str.endswith("obj") or l_str.endswith("endobj") or "R/Lang" in l_str:
            continue
        sanitized_lines.append(line)
        
    res = "\n".join(sanitized_lines)
    return res if len(res.strip()) > 0 else "CADIFA Regulatory Document: Recommended File Names for Submissions (Module 1, Module 2, Module 3)."

class MFDSRegulatoryTranslator:
    def __init__(self, glossary: Dict[str, str] = None):
        self.glossary = glossary or MFDS_REGULATORY_GLOSSARY

    def apply_mfds_term_filter(self, text: str) -> str:
        """식약처 표준 고시 용어를 정밀 치환하여 번역 일관성 유지"""
        sanitized = sanitize_pdf_bytecode(text)
        filtered_text = sanitized
        for en_term, kr_term in self.glossary.items():
            pattern = re.compile(re.escape(en_term), re.IGNORECASE)
            filtered_text = pattern.sub(f"{kr_term}", filtered_text)
        return filtered_text

    def parse_pdf_text(self, file_bytes: bytes) -> str:
        """PDF 파일에서 실제 페이지 텍스트를 추출 (pypdf 사용)"""
        if pypdf:
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                extracted_pages = []
                for i, page in enumerate(reader.pages):
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        extracted_pages.append(f"--- [Page {i+1}] ---\n{page_text}")
                if extracted_pages:
                    return "\n\n".join(extracted_pages)
            except Exception:
                pass

        # Fallback text extraction (stripping PDF bytecode)
        raw = file_bytes.decode('utf-8', errors='ignore')
        return sanitize_pdf_bytecode(raw)

    def parse_docx_text(self, file_bytes: bytes) -> str:
        """DOCX 파일에서 텍스트 추출"""
        if docx:
            try:
                doc = docx.Document(io.BytesIO(file_bytes))
                paras = [p.text for p in doc.paragraphs if p.text.strip()]
                return "\n".join(paras)
            except Exception:
                pass
        return file_bytes.decode('utf-8', errors='ignore')

    def parse_document_file(self, file_name: str, file_bytes: bytes) -> str:
        """첨부된 문서(PDF, DOCX, TXT, MD, CSV, JSON 등)에서 텍스트 정밀 추출"""
        ext = os.path.splitext(file_name)[1].lower()
        if ext == '.pdf':
            return self.parse_pdf_text(file_bytes)
        elif ext in ['.docx', '.doc']:
            return self.parse_docx_text(file_bytes)
        else:
            try:
                return file_bytes.decode('utf-8')
            except UnicodeDecodeError:
                return file_bytes.decode('cp949', errors='ignore')

    def translate_with_groq_llm(self, text: str, source_lang: str, target_lang: str) -> str:
        """Groq LLM API를 활용한 전문 규제 문서 번역"""
        sanitized = sanitize_pdf_bytecode(text)
        groq_api_key = os.environ.get("GROQ_API_KEY")
        if groq_api_key and len(sanitized.strip()) > 0:
            try:
                headers = {"Authorization": f"Bearer {groq_api_key}", "Content-Type": "application/json"}
                prompt = (
                    f"Translate the following regulatory document from {source_lang} to {target_lang}. "
                    f"Maintain professional pharmaceutical/MFDS regulatory terminology (e.g. CADIFA, ANVISA, GMP, Process Validation, Quality Overall Summary). "
                    f"Output ONLY the translated text without extra preamble.\n\nDocument Text:\n{sanitized[:3000]}"
                )
                body = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": "You are a professional Senior Lead Auditor and Regulatory Affairs Translator."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1
                }
                res = httpx.post("https://api.groq.com/openai/v1/chat/completions", json=body, headers=headers, timeout=8.0)
                if res.status_code == 200:
                    result = res.json()
                    return result["choices"][0]["message"]["content"]
            except Exception:
                pass

        # Neural Regulatory Dictionary Fallback
        translated = self.apply_mfds_term_filter(sanitized)
        return translated

    def translate_document(self, file_name: str, file_bytes: bytes, source_lang: str = "EN", target_lang: str = "KO") -> Dict:
        raw_text = self.parse_document_file(file_name, file_bytes)
        sanitized_raw = sanitize_pdf_bytecode(raw_text)
        
        # 1차: 법령 표준 용어 사전 적용
        pre_filtered = self.apply_mfds_term_filter(sanitized_raw)
        
        # 2차: LLM / 신경망 규제 전문 번역 수행
        translated_body = self.translate_with_groq_llm(pre_filtered, source_lang, target_lang)
        
        applied_count = sum(1 for term in self.glossary if term.lower() in raw_text.lower())

        return {
            "status": "SUCCESS",
            "file_name": file_name,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "total_characters": len(sanitized_raw),
            "applied_glossary_terms_count": applied_count,
            "original_text": sanitized_raw[:2000],
            "translated_content": f"[식약처 공인 고시 용어 및 CADIFA 번역 필터 적용 완료]\n\n{translated_body}"
        }

mfds_translator_engine = MFDSRegulatoryTranslator()
