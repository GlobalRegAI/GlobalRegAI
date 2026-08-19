#!/usr/bin/env python3
"""
GlobalRegAI — 전 세계 규정 데이터 크롤러 & 수집 파이프라인 (v1.2.0)
소스: FDA · EMA · MFDS · NMPA · PMDA · AEMPS · WHO · ICH · PIC/S
      eCFR · EUR-Lex · Reddit · RAPS · Elsmar · PubMed · EFSA · Codex · HK DH (Hong Kong)

설치: pip install requests beautifulsoup4 pdfplumber tqdm feedparser
"""

import json
import os
import sys
import time
import hashlib
import re
import logging
from pathlib import Path
from typing import Optional, Generator
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# ── 로깅 설정 ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/crawler.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger("GlobalRegAI")

# ── 설정 ────────────────────────────────────────────────────
OLLAMA_URL  = os.getenv("OLLAMA_URL",  "http://localhost:11434")
QDRANT_URL  = os.getenv("QDRANT_URL",  "http://localhost:6333")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
COLLECTION  = "globalregai_regulations"
CHUNK_SIZE  = 800
CHUNK_OVERLAP = 150
PDF_DIR     = Path("rag/regulatory-docs")
HEADERS     = {
    "User-Agent": "GlobalRegAI/1.0 (Regulatory Knowledge Base; Educational Use)",
    "Accept": "application/json, text/html",
}

# 환경 변수 확장: 대한민국 공공데이터포털 API Key (무료 발급)
MFDS_API_KEY = os.getenv("MFDS_API_KEY", "YOUR_PUBLIC_DATA_KEY_HERE")

PDF_DIR.mkdir(parents=True, exist_ok=True)
Path("logs").mkdir(exist_ok=True)


# ════════════════════════════════════════════════════════════
# UTILITIES
# ════════════════════════════════════════════════════════════

def chunk_text(text: str) -> list[str]:
    """텍스트를 청크로 분할"""
    chunks, start = [], 0
    while start < len(text):
        chunks.append(text[start:start + CHUNK_SIZE])
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c.strip() for c in chunks if len(c.strip()) > 100]


def get_embedding(text: str) -> Optional[list]:
    """Ollama에서 임베딩 생성"""
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": EMBED_MODEL, "prompt": text[:2000]},
            timeout=60
        )
        return r.json().get("embedding")
    except Exception as e:
        log.warning(f"Embedding error: {e}")
        return None


def store_to_qdrant(points: list) -> bool:
    """Qdrant에 벡터 저장"""
    if not points:
        return True
    try:
        r = requests.put(
            f"{QDRANT_URL}/collections/{COLLECTION}/points",
            json={"points": points},
            timeout=30
        )
        return r.status_code in (200, 201)
    except Exception as e:
        log.error(f"Qdrant store error: {e}")
        return False


def make_id(text: str) -> int:
    """텍스트에서 고유 ID 생성"""
    return int(hashlib.md5(text.encode()).hexdigest()[:8], 16)


def ingest_text(text: str, metadata: dict) -> int:
    """텍스트를 청크 → 임베딩 → Qdrant 저장. 저장된 청크 수 반환"""
    chunks = chunk_text(text)
    points, count = [], 0
    for i, chunk in enumerate(chunks):
        embedding = get_embedding(chunk)
        if not embedding:
            continue
        points.append({
            "id": make_id(f"{metadata.get('title','')}-{i}-{chunk[:30]}"),
            "vector": embedding,
            "payload": {**metadata, "chunk": chunk, "chunk_idx": i,
                        "crawled_at": datetime.utcnow().isoformat()}
        })
        if len(points) >= 20:
            store_to_qdrant(points)
            count += len(points)
            points = []
            time.sleep(0.1)
    if points:
        store_to_qdrant(points)
        count += len(points)
    return count


def fetch_html(url: str, timeout: int = 20) -> Optional[str]:
    """URL에서 HTML 텍스트 추출"""
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        # 불필요한 태그 제거
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        return soup.get_text(separator="\n", strip=True)
    except Exception as e:
        log.warning(f"HTML fetch error {url}: {e}")
        return None


def download_pdf(url: str, filename: str) -> Optional[Path]:
    """PDF 파일 다운로드"""
    path = PDF_DIR / filename
    if path.exists():
        return path
    try:
        r = requests.get(url, headers=HEADERS, timeout=60, stream=True)
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        log.info(f"Downloaded: {filename}")
        return path
    except Exception as e:
        log.warning(f"PDF download error {url}: {e}")
        return None


def extract_pdf_text(path: Path) -> Optional[str]:
    """PDF에서 텍스트 추출"""
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages[:50]:  # 최대 50페이지
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        return "\n".join(text_parts)
    except ImportError:
        log.warning("pdfplumber not installed. Run: pip install pdfplumber")
        return None
    except Exception as e:
        log.warning(f"PDF extract error {path}: {e}")
        return None


# ════════════════════════════════════════════════════════════
# CRAWLERS
# ════════════════════════════════════════════════════════════

class FDACrawler:
    """FDA openFDA API + 가이던스 문서 크롤러"""

    BASE_API = "https://api.fda.gov"

    def crawl_api(self, endpoint: str, query: str, limit: int = 100) -> Generator:
        """openFDA API에서 데이터 수집"""
        url = f"{self.BASE_API}/{endpoint}.json?search={query}&limit={limit}"
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                data = r.json()
                for item in data.get("results", []):
                    yield item
        except Exception as e:
            log.warning(f"FDA API error ({endpoint}): {e}")

    def crawl_device_recalls(self) -> int:
        """FDA 의료기기 리콜 데이터"""
        count = 0
        log.info("  [FDA] Crawling device recalls...")
        for item in self.crawl_api("device/recall", "_exists_:product_description", 200):
            text = (
                f"FDA DEVICE RECALL\n"
                f"Product: {item.get('product_description', '')}\n"
                f"Reason: {item.get('reason_for_recall', '')}\n"
                f"Classification: {item.get('classification', '')}\n"
                f"Date: {item.get('recall_initiation_date', '')}\n"
                f"Status: {item.get('status', '')}\n"
                f"Distribution: {item.get('distribution_pattern', '')}"
            )
            count += ingest_text(text, {
                "agency": "FDA", "category": "Medical Device Recall",
                "title": f"FDA Recall: {item.get('product_description', '')[:80]}",
                "source": "https://api.fda.gov/device/recall.json",
                "type": "recall", "language": "en"
            })
            time.sleep(0.05)
        return count

    def crawl_drug_enforcement(self) -> int:
        """FDA 의약품 리콜/시행 데이터"""
        count = 0
        log.info("  [FDA] Crawling drug enforcement...")
        for item in self.crawl_api("drug/enforcement", "_exists_:product_description", 200):
            text = (
                f"FDA DRUG ENFORCEMENT / RECALL\n"
                f"Product: {item.get('product_description', '')}\n"
                f"Reason: {item.get('reason_for_recall', '')}\n"
                f"Classification: {item.get('classification', '')}\n"
                f"Voluntary/Mandated: {item.get('voluntary_mandated', '')}\n"
                f"Date: {item.get('recall_initiation_date', '')}"
            )
            count += ingest_text(text, {
                "agency": "FDA", "category": "Drug Enforcement",
                "title": f"FDA Drug Recall: {item.get('product_description', '')[:80]}",
                "source": "https://api.fda.gov/drug/enforcement.json",
                "type": "enforcement", "language": "en"
            })
        return count

    def crawl_device_510k(self) -> int:
        """FDA 510(k) 승인 데이터"""
        count = 0
        log.info("  [FDA] Crawling 510(k) clearances...")
        for item in self.crawl_api("device/510k", "_exists_:device_name", 300):
            text = (
                f"FDA 510(k) CLEARANCE\n"
                f"Device: {item.get('device_name', '')}\n"
                f"Applicant: {item.get('applicant', '')}\n"
                f"Decision: {item.get('decision_description', '')}\n"
                f"Date: {item.get('decision_date', '')}\n"
                f"Product Code: {item.get('product_code', '')}\n"
                f"Regulation: {item.get('regulation_number', '')}\n"
                f"Statement: {item.get('statement_or_summary', '')[:500]}"
            )
            count += ingest_text(text, {
                "agency": "FDA", "category": "510(k) Clearance",
                "title": f"510(k): {item.get('device_name', '')[:80]}",
                "source": "https://api.fda.gov/device/510k.json",
                "type": "clearance", "language": "en"
            })
        return count

    def crawl_food_enforcement(self) -> int:
        """FDA 식품 리콜"""
        count = 0
        log.info("  [FDA] Crawling food enforcement...")
        for item in self.crawl_api("food/enforcement", "_exists_:product_description", 200):
            text = (
                f"FDA FOOD RECALL\n"
                f"Product: {item.get('product_description', '')}\n"
                f"Reason: {item.get('reason_for_recall', '')}\n"
                f"Classification: {item.get('classification', '')}\n"
                f"Date: {item.get('recall_initiation_date', '')}"
            )
            count += ingest_text(text, {
                "agency": "FDA", "category": "Food Recall",
                "title": f"FDA Food Recall: {item.get('product_description', '')[:80]}",
                "source": "https://api.fda.gov/food/enforcement.json",
                "type": "recall", "language": "en"
            })
        return count


class eCFRCrawler:
    """eCFR API — 미국 연방 규정집 크롤러"""

    BASE_API = "https://www.ecfr.gov/api/versioner/v1"

    PARTS = [
        ("Title 21 Part 820 - QMSR Medical Device", "21", "820"),
        ("Title 21 Part 211 - cGMP Pharmaceuticals", "21", "211"),
        ("Title 21 Part 210 - cGMP Definitions", "21", "210"),
        ("Title 21 Part 807 - 510(k) Premarket", "21", "807"),
        ("Title 21 Part 814 - PMA Premarket Approval", "21", "814"),
        ("Title 21 Part 312 - IND Applications", "21", "312"),
        ("Title 21 Part 314 - NDA Applications", "21", "314"),
        ("Title 21 Part 117 - FSMA Preventive Controls", "21", "117"),
        ("Title 21 Part 700 - Cosmetics General", "21", "700"),
        ("Title 21 Part 701 - Cosmetics Labeling", "21", "701"),
    ]

    def crawl_part(self, title: str, part: str) -> Optional[str]:
        """특정 CFR Part 텍스트 수집"""
        url = f"https://www.ecfr.gov/current/title-{title}/part-{part}"
        try:
            r = requests.get(url, headers={**HEADERS, "Accept": "text/html"}, timeout=30)
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            return soup.get_text(separator="\n", strip=True)[:50000]
        except Exception as e:
            log.warning(f"eCFR error {title}/{part}: {e}")
            return None

    def crawl_all(self) -> int:
        """모든 주요 CFR Parts 수집"""
        count = 0
        for name, title, part in self.PARTS:
            log.info(f"  [eCFR] {name}...")
            text = self.crawl_part(title, part)
            if text:
                count += ingest_text(text, {
                    "agency": "FDA/eCFR",
                    "category": "US Federal Regulation",
                    "title": name,
                    "source": f"https://www.ecfr.gov/current/title-{title}/part-{part}",
                    "type": "regulation",
                    "language": "en"
                })
            time.sleep(2)
        return count


class ICHCrawler:
    """ICH 가이드라인 크롤러"""

    GUIDELINES = [
        ("Q7 GMP Active Pharmaceutical Ingredients",
         "https://database.ich.org/sites/default/files/Q7%20Guideline.pdf"),
        ("Q8(R2) Pharmaceutical Development",
         "https://database.ich.org/sites/default/files/Q8%28R2%29%20Guideline.pdf"),
        ("Q9(R1) Quality Risk Management",
         "https://database.ich.org/sites/default/files/Q9-R1-Step4-Guideline_2023_0126.pdf"),
        ("Q10 Pharmaceutical Quality System",
         "https://database.ich.org/sites/default/files/Q10%20Guideline.pdf"),
        ("Q11 Development and Manufacture of Drug Substances",
         "https://database.ich.org/sites/default/files/Q11%20Guideline.pdf"),
        ("Q12 Pharmaceutical Product Lifecycle Management",
         "https://database.ich.org/sites/default/files/Q12_Guideline_Step4_2019_1119.pdf"),
        ("E6(R3) Good Clinical Practice",
         "https://database.ich.org/sites/default/files/ICH_E6(R3)_GuideLine_Step4_2024_0519.pdf"),
    ]

    def crawl_all(self) -> int:
        count = 0
        for title, url in self.GUIDELINES:
            log.info(f"  [ICH] {title}...")
            filename = f"ICH_{title[:30].replace(' ', '_')}.pdf"
            path = download_pdf(url, filename)
            if path:
                text = extract_pdf_text(path)
                if text:
                    count += ingest_text(text, {
                        "agency": "ICH", "category": "Pharmaceutical Guideline",
                        "title": title, "source": url,
                        "type": "guideline", "language": "en"
                    })
            time.sleep(1)
        return count


class WHOCrawler:
    """WHO 가이드라인 크롤러"""

    DOCUMENTS = [
        ("WHO GMP Pharmaceuticals TRS986",
         "https://www.who.int/docs/default-source/medicines/norms-and-standards/guidelines/production/trs986-annex2-gmp-pharmaceuticals.pdf"),
        ("WHO Prequalification GMP Requirements",
         "https://extranet.who.int/prequal/sites/default/files/documents/GMP%20guide.pdf"),
    ]

    def crawl_pages(self) -> int:
        count = 0
        pages = [
            ("WHO GMP Overview",
             "https://www.who.int/teams/health-product-and-policy-standards/standards-and-specifications/norms-and-standards-for-pharmaceuticals/guidelines/production"),
            ("WHO Medical Devices",
             "https://www.who.int/teams/health-product-and-policy-standards/assistive-and-medical-technology/medical-devices"),
        ]
        for title, url in pages:
            log.info(f"  [WHO] {title}...")
            text = fetch_html(url)
            if text:
                count += ingest_text(text, {
                    "agency": "WHO", "category": "Global Guideline",
                    "title": title, "source": url,
                    "type": "guideline", "language": "en"
                })
            time.sleep(2)
        return count


class RedditCrawler:
    """Reddit 규정 커뮤니티 Q&A 크롤러"""

    SUBREDDITS = [
        ("regulatoryaffairs", "Medical Device / Pharma / Regulatory Q&A"),
        ("medicaldevices", "Medical Device Discussion"),
        ("pharma", "Pharmaceutical Industry"),
        ("FDA", "FDA Regulatory Discussions"),
        ("clinicalresearch", "Clinical Research"),
    ]

    def crawl_subreddit(self, subreddit: str, limit: int = 100) -> int:
        count = 0
        url = f"https://www.reddit.com/r/{subreddit}/top.json?limit={limit}&t=year"
        try:
            r = requests.get(url, headers={**HEADERS, "User-Agent": "GlobalRegAI:1.0 (by /u/globalregai)"}, timeout=20)
            if r.status_code != 200:
                return 0
            posts = r.json().get("data", {}).get("children", [])
            for post in posts:
                d = post.get("data", {})
                if d.get("score", 0) < 5:  # 최소 5 upvotes
                    continue
                title = d.get("title", "")
                selftext = d.get("selftext", "")[:2000]
                if not title or len(selftext) < 50:
                    continue
                text = f"REDDIT Q&A — r/{subreddit}\nTitle: {title}\n\n{selftext}"
                count += ingest_text(text, {
                    "agency": f"Reddit/r/{subreddit}",
                    "category": "Community Q&A",
                    "title": title[:100],
                    "source": f"https://reddit.com{d.get('permalink', '')}",
                    "type": "community_qa",
                    "language": "en",
                    "score": d.get("score", 0)
                })
            time.sleep(2)
        except Exception as e:
            log.warning(f"Reddit error r/{subreddit}: {e}")
        return count

    def crawl_all(self) -> int:
        count = 0
        for subreddit, desc in self.SUBREDDITS:
            log.info(f"  [Reddit] r/{subreddit} — {desc}")
            count += self.crawl_subreddit(subreddit)
        return count


class RSSCrawler:
    """RSS 피드 크롤러 (FDA, EMA, RAPS, ISPE)"""

    FEEDS = [
        ("FDA Medical Devices RSS", "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medical-devices/rss.xml", "FDA", "Medical Device"),
        ("FDA Drugs RSS", "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml", "FDA", "Pharmaceutical"),
        ("FDA Food RSS", "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/food/rss.xml", "FDA", "Food"),
        ("RAPS Regulatory Focus", "https://www.raps.org/rss/news", "RAPS", "Regulatory News"),
        ("ISPE News", "https://ispe.org/rss.xml", "ISPE", "Pharmaceutical Engineering"),
    ]

    def crawl_feed(self, url: str, agency: str, category: str) -> int:
        count = 0
        try:
            import feedparser
            feed = feedparser.parse(url)
            for entry in feed.entries[:50]:
                title = entry.get("title", "")
                summary = entry.get("summary", "")
                link = entry.get("link", "")
                if not title:
                    continue
                text = f"{agency} — {category}\nTitle: {title}\n{summary}"
                count += ingest_text(text, {
                    "agency": agency, "category": category,
                    "title": title[:100], "source": link,
                    "type": "news", "language": "en",
                    "published": entry.get("published", "")
                })
                time.sleep(0.2)
        except ImportError:
            log.warning("feedparser not installed. Run: pip install feedparser")
        except Exception as e:
            log.warning(f"RSS error {url}: {e}")
        return count

    def crawl_all(self) -> int:
        count = 0
        for name, url, agency, category in self.FEEDS:
            log.info(f"  [RSS] {name}...")
            count += self.crawl_feed(url, agency, category)
        return count


class PubMedCrawler:
    """PubMed 규정 관련 논문 크롤러"""

    BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    QUERIES = [
        "GMP compliance medical device quality",
        "FDA 510k regulatory submission",
        "ISO 13485 quality management system",
        "pharmaceutical regulatory compliance CAPA",
        "clinical evaluation medical device EU MDR",
        "food safety HACCP regulatory",
        "cosmetic safety assessment regulation",
        "chemical REACH compliance safety",
    ]

    def crawl_query(self, query: str, max_results: int = 20) -> int:
        count = 0
        try:
            # 1. 검색
            search_url = f"{self.BASE}/esearch.fcgi?db=pubmed&term={requests.utils.quote(query)}&retmax={max_results}&retmode=json"
            r = requests.get(search_url, timeout=15)
            ids = r.json().get("esearchresult", {}).get("idlist", [])
            if not ids:
                return 0
            # 2. 상세 정보
            fetch_url = f"{self.BASE}/efetch.fcgi?db=pubmed&id={','.join(ids)}&rettype=abstract&retmode=text"
            r2 = requests.get(fetch_url, timeout=30)
            articles = r2.text.split("\n\n\n")
            for article in articles[:10]:
                if len(article.strip()) < 100:
                    continue
                count += ingest_text(article, {
                    "agency": "PubMed/NCBI",
                    "category": "Scientific Literature",
                    "title": article[:100],
                    "source": "https://pubmed.ncbi.nlm.nih.gov",
                    "type": "literature",
                    "language": "en",
                    "query": query
                })
            time.sleep(0.5)
        except Exception as e:
            log.warning(f"PubMed error: {e}")
        return count

    def crawl_all(self) -> int:
        count = 0
        for query in self.QUERIES:
            log.info(f"  [PubMed] Query: {query[:50]}...")
            count += self.crawl_query(query)
        return count


class MFDSCrawler:
    """한국 MFDS (식품의약품안전처) 크롤러 및 실시간 공공 API 수집 엔진"""

    PAGES = [
        ("MFDS Medical Device English", "https://www.mfds.go.kr/eng/brd/m_60/list.do", "ko"),
        ("MFDS 의료기기 가이드라인 목록", "https://www.mfds.go.kr/brd/m_218/list.do", "ko"),
        ("MFDS 의약품 가이드라인", "https://www.mfds.go.kr/brd/m_217/list.do", "ko"),
        ("MFDS 화장품 정보", "https://www.mfds.go.kr/brd/m_76/list.do", "ko"),
        ("MFDS 식품안전정보", "https://www.foodsafetykorea.go.kr", "ko"),
    ]

    def crawl_api_ingredients(self) -> int:
        """
        k-mfds-fooddb-mcp-server 통합 모델: 
        대한민국 공공데이터포털의 식약처 공인 건강기능식품 인정 원료 성분 동기화
        """
        if not MFDS_API_KEY or "YOUR_PUBLIC" in MFDS_API_KEY:
            log.warning("  [MFDS API] 서비스 키가 기본값이거나 누락되어 API 동기화를 건너뜁니다.")
            return 0
            
        count = 0
        log.info("  [MFDS API] 식약처 건강기능식품 원료 고시 데이터 동기화 중...")
        
        # 다국적 실버 푸드 진출 핵심 연동 카테고리 키워드
        sync_targets = ["홍삼", "인삼", "유산균", "프로바이오틱스", "비타민", "오메가"]
        url = "http://apis.data.go.kr/1471000/MdcinGrntInfoService05/getMdcinGrntInq05"
        
        for keyword in sync_targets:
            params = {
                'serviceKey': MFDS_API_KEY,
                'prduct': keyword,
                'type': 'json',
                'numOfRows': 30,
                'pageNo': 1
            }
            try:
                r = requests.get(url, params=params, timeout=15)
                if r.status_code == 200:
                    items = r.json().get('body', {}).get('items', [])
                    for item in items:
                        text = (
                            f"대한민국 식약처 고시 원료 정보\n"
                            f"원료/제품명: {item.get('PRDLST_NM', '')}\n"
                            f"원재료 구성성분: {item.get('RAWMTRL_NM', '')}\n"
                            f"인정된 기능성 내용: {item.get('FNCLTY_CN', '')}\n"
                            f"제조 규격 및 흡수 제한: {item.get('STNDRD_CN', '')}"
                        )
                        count += ingest_text(text, {
                            "agency": "MFDS", "category": "Korean Certified Ingredients",
                            "title": f"식약처 고시: {item.get('PRDLST_NM', keyword)[:80]}",
                            "source": "https://data.go.kr/data/1471000",
                            "type": "regulation_api", "language": "ko"
                        })
                time.sleep(0.5)
            except Exception as e:
                log.warning(f"MFDS API 연결 에러 ({keyword}): {e}")
        return count

    def crawl_all(self) -> int:
        count = 0
        # 1. 기존 가이드라인 HTML 웹 스크래핑
        for title, url, lang in self.PAGES:
            log.info(f"  [MFDS 웹] {title}...")
            text = fetch_html(url)
            if text and len(text) > 200:
                count += ingest_text(text[:30000], {
                    "agency": "MFDS", "category": "Korean Regulation",
                    "title": title, "source": url,
                    "type": "regulation", "language": lang
                })
            time.sleep(2)
            
        # 2. 신규 확장: 식약처 원료성분 DB 실시간 API 연동 추가
        count += self.crawl_api_ingredients()
        return count


class EMAWebCrawler:
    """EMA 웹사이트 가이드라인 크롤러"""

    PAGES = [
        ("EMA GMP Guidelines Overview",
         "https://www.ema.europa.eu/en/human-regulatory-overview/research-development/compliance/good-manufacturing-practice"),
        ("EMA Scientific Guidelines Overview",
         "https://www.ema.europa.eu/en/human-regulatory-overview/research-development/scientific-guidelines"),
        ("EMA Medical Device Regulation",
         "https://www.ema.europa.eu/en/human-regulatory-overview/research-development/medical-devices"),
        ("EMA Pharmacovigilance",
         "https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/pharmacovigilance-overview"),
    ]

    def crawl_all(self) -> int:
        count = 0
        for title, url in self.PAGES:
            log.info(f"  [EMA] {title}...")
            text = fetch_html(url)
            if text:
                count += ingest_text(text[:30000], {
                    "agency": "EMA", "category": "EU Regulatory",
                    "title": title, "source": url,
                    "type": "guideline", "language": "en"
                })
            time.sleep(2)
        return count


class SpanishRegCrawler:
    """스페인/중남미 규정기관 크롤러"""

    PAGES = [
        ("AEMPS Medicamentos", "https://www.aemps.gob.es/medicamentosUsoHumano/informesPublicos/home.htm", "AEMPS", "es"),
        ("AEMPS Productos Sanitarios", "https://www.aemps.gob.es/productosSanitarios/home.htm", "AEMPS", "es"),
        ("COFEPRIS Normas", "https://www.gob.mx/cofepris/documentos/normas-oficiales-mexicanas", "COFEPRIS", "es"),
        ("ANMAT Argentina", "https://www.argentina.gob.ar/anmat/regulacion-y-registros", "ANMAT", "es"),
        ("INVIMA Colombia", "https://www.invima.gov.co/normativa", "INVIMA", "es"),
    ]

    def crawl_all(self) -> int:
        count = 0
        for title, url, agency, lang in self.PAGES:
            log.info(f"  [{agency}] {title}...")
            text = fetch_html(url)
            if text:
                count += ingest_text(text[:20000], {
                    "agency": agency,
                    "category": "Regulación Sanitaria",
                    "title": title, "source": url,
                    "type": "regulation", "language": lang
                })
            time.sleep(2)
        return count


class ChemicalRegCrawler:
    """화학물질/전기 규정 크롤러"""

    PAGES = [
        ("EU REACH Understanding", "https://echa.europa.eu/regulations/reach/understanding-reach", "ECHA", "en"),
        ("EU CLP Regulation", "https://echa.europa.eu/regulations/clp/understanding-clp", "ECHA", "en"),
        ("EU RoHS Directive", "https://single-market-economy.ec.europa.eu/sectors/electrical-and-electronic-engineering-industries-eei/rohs-directive_en", "EC", "en"),
        ("OSHA Hazard Communication", "https://www.osha.gov/hazcom", "OSHA", "en"),
        ("FCC Equipment Authorization", "https://www.fcc.gov/engineering-technology/laboratory-division/general/equipment-authorization", "FCC", "en"),
        ("Korea Chemical REACH", "https://www.nier.go.kr/NIER/EngIndexMain.do", "NIER Korea", "en"),
    ]

    def crawl_all(self) -> int:
        count = 0
        for title, url, agency, lang in self.PAGES:
            log.info(f"  [{agency}] {title}...")
            text = fetch_html(url)
            if text:
                count += ingest_text(text[:20000], {
                    "agency": agency,
                    "category": "Chemical/Electrical Regulation",
                    "title": title, "source": url,
                    "type": "regulation", "language": lang
                })
            time.sleep(2)
        return count


class CommunityForumCrawler:
    """규정 전문 포럼/커뮤니티 크롤러"""

    def crawl_raps(self) -> int:
        """RAPS Regulatory Focus 최신 기사"""
        count = 0
        pages = [
            "https://www.raps.org/news-and-articles/news-articles/2026/1",
            "https://www.raps.org/news-and-articles/news-articles/2025/12",
        ]
        for url in pages:
            log.info(f"  [RAPS] {url}...")
            text = fetch_html(url)
            if text:
                count += ingest_text(text[:20000], {
                    "agency": "RAPS",
                    "category": "Regulatory News",
                    "title": f"RAPS Regulatory Focus — {url.split('/')[-2:][-1]}",
                    "source": url,
                    "type": "news", "language": "en"
                })
            time.sleep(3)
        return count

    def crawl_gmp_compliance(self) -> int:
        """GMP-Compliance.org (ECA Academy) 무료 가이드라인"""
        count = 0
        url = "https://www.gmp-compliance.org/guidelines/gmp-guideline"
        log.info(f"  [ECA] GMP Guidelines Database...")
        text = fetch_html(url)
        if text:
            count += ingest_text(text[:30000], {
                "agency": "ECA Academy",
                "category": "GMP Guidelines Database",
                "title": "ECA GMP Guidelines Collection",
                "source": url,
                "type": "guideline", "language": "en"
            })
        time.sleep(2)
        return count


class PMDACrawler:
    """일본 PMDA 크롤러"""

    PAGES = [
        ("PMDA Medical Device Guidance", "https://www.pmda.go.jp/english/rs-sb-std/standards-development/0001.html"),
        ("PMDA Approved Devices", "https://www.pmda.go.jp/english/review-services/reviews/approved-information/md/0001.html"),
        ("PMDA Drug Review", "https://www.pmda.go.jp/english/review-services/reviews/approved-information/drugs/0001.html"),
    ]

    def crawl_all(self) -> int:
        count = 0
        for title, url in self.PAGES:
            log.info(f"  [PMDA] {title}...")
            text = fetch_html(url)
            if text:
                count += ingest_text(text[:20000], {
                    "agency": "PMDA", "category": "Japan Regulatory",
                    "title": title, "source": url,
                    "type": "guideline", "language": "ja"
                })
            time.sleep(2)
        return count


class HKDHOfficeCrawler:
    """홍콩 의약품사무소(DH Drug Office) 공식 규제 가이드라인 크롤러 (신규 확장)"""

    BASE_URL = "https://www.drugoffice.gov.hk/eps/do/en/pharmaceutical_trade/guidelines_forms/useful_guidelines_forms.html"

    def crawl_all(self) -> int:
        count = 0
        log.info("  [HK DH] Crawling Hong Kong Drug Office Guidelines...")
        try:
            r = requests.get(self.BASE_URL, headers=HEADERS, timeout=20)
            if r.status_code != 200:
                return 0
                
            soup = BeautifulSoup(r.text, "html.parser")
            
            # 홍콩 보건 허가 관련 주요 신약 매커니즘("1+") 및 건강 기능성 표기 조항 앵커 추출
            links = soup.find_all("a", href=re.compile(r"\.pdf"))
            
            # 중복 제거 및 도메인 결합
            pdf_targets = []
            for link in links:
                href = link.get("href", "")
                title = link.get_text(strip=True)
                if not href or len(title) < 5:
                    continue
                if href.startswith("/"):
                    href = "https://www.drugoffice.gov.hk" + href
                elif not href.startswith("http"):
                    href = "https://www.drugoffice.gov.hk/eps/do/en/pharmaceutical_trade/guidelines_forms/" + href
                pdf_targets.append((title, href))

            # 최대 5개의 상위 핵심 가이드라인 우선 분석 기동 (서버 트래픽 조절 목적)
            for title, url in pdf_targets[:5]:
                log.info(f"  [HK DH] 수집 가이드라인 다운로드: {title[:40]}...")
                safe_name = f"HK_DH_{hashlib.md5(url.encode()).hexdigest()[:6]}.pdf"
                path = download_pdf(url, safe_name)
                if path:
                    text = extract_pdf_text(path)
                    if text and len(text) > 100:
                        count += ingest_text(text, {
                            "agency": "HK_DH", "category": "Hong Kong Pharmaceutical Guideline",
                            "title": f"HK DH: {title[:80]}", "source": url,
                            "type": "guideline", "language": "en"
                        })
                time.sleep(1.5)
        except Exception as e:
            log.warning(f"Hong Kong Drug Office 수집 중 에러 발생: {e}")
        return count


# ════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ════════════════════════════════════════════════════════════

def setup_qdrant():
    """Qdrant 컬렉션 초기화"""
    try:
        r = requests.get(f"{QDRANT_URL}/collections/{COLLECTION}", timeout=5)
        if r.status_code == 200:
            log.info(f"Collection '{COLLECTION}' exists.")
            return True
    except:
        pass

    test = get_embedding("regulatory compliance test")
    if not test:
        log.error("Cannot get embedding from Ollama. Is it running?")
        return False

    dim = len(test)
    r = requests.put(f"{QDRANT_URL}/collections/{COLLECTION}",
                     json={"vectors": {"size": dim, "distance": "Cosine"}})
    if r.status_code in (200, 201):
        log.info(f"Collection created (dim={dim})")
        return True
    return False


def run_full_pipeline(sources: list = None):
    """전체 수집 파이프라인 실행"""

    print("\n" + "="*60)
    print(" GlobalRegAI — Regulatory Data Collection Pipeline")
    print(f" Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    # 신규 확장 소스 'hk_dh' 목록 기본값에 편입
    all_sources = sources or [
        "fda_recalls", "fda_510k", "fda_drug", "fda_food",
        "ecfr", "ich", "who", "ema",
        "mfds", "pmda", "spanish", "hk_dh",
        "chemical", "reddit", "rss", "pubmed",
        "community"
    ]

    # 1. Ollama & Qdrant 확인
    log.info("Checking services...")
    try:
        requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        log.info("✓ Ollama connected")
    except:
        log.error("✗ Ollama not running. Start GlobalRegAI first.")
        sys.exit(1)

    if not setup_qdrant():
        sys.exit(1)

    results = {}

    crawlers = {
        "fda_recalls":  (FDACrawler(), "crawl_device_recalls"),
        "fda_510k":     (FDACrawler(), "crawl_device_510k"),
        "fda_drug":     (FDACrawler(), "crawl_drug_enforcement"),
        "fda_food":     (FDACrawler(), "crawl_food_enforcement"),
        "ecfr":         (eCFRCrawler(), "crawl_all"),
        "ich":          (ICHCrawler(), "crawl_all"),
        "who":          (WHOCrawler(), "crawl_pages"),
        "ema":          (EMAWebCrawler(), "crawl_all"),
        "mfds":         (MFDSCrawler(), "crawl_all"),
        "pmda":         (PMDACrawler(), "crawl_all"),
        "spanish":      (SpanishRegCrawler(), "crawl_all"),
        "hk_dh":        (HKDHOfficeCrawler(), "crawl_all"),  # 홍콩 의약품 안전처 바인딩
        "chemical":     (ChemicalRegCrawler(), "crawl_all"),
        "reddit":       (RedditCrawler(), "crawl_all"),
        "rss":          (RSSCrawler(), "crawl_all"),
        "pubmed":       (PubMedCrawler(), "crawl_all"),
        "community":    (CommunityForumCrawler(), "crawl_raps"),
    }

    total_chunks = 0
    for source_name in all_sources:
        if source_name not in crawlers:
            continue
        obj, method = crawlers[source_name]
        print(f"\n[{source_name.upper()}] Starting...")
        try:
            n = getattr(obj, method)()
            results[source_name] = n
            total_chunks += n
            print(f"[{source_name.upper()}] ✓ {n} chunks stored")
        except Exception as e:
            log.error(f"[{source_name}] FAILED: {e}")
            results[source_name] = 0

    # 결과 저장
    report = {
        "run_at": datetime.utcnow().isoformat(),
        "total_chunks": total_chunks,
        "by_source": results
    }
    with open("logs/crawl_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\n" + "="*60)
    print(f" PIPELINE COMPLETE")
    print(f" Total chunks ingested: {total_chunks:,}")
    print(f" Report saved: logs/crawl_report.json")
    print("="*60)
    for src, n in results.items():
        print(f"  {src:<20} {n:>6} chunks")
    print("="*60 + "\n")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="GlobalRegAI Data Crawler")
    parser.add_argument("--sources", nargs="+",
                        help="Specific sources to crawl (e.g. fda_recalls ecfr ich mfds hk_dh)")
    parser.add_argument("--all", action="store_true", default=True,
                        help="Crawl all sources")
    args = parser.parse_args()
    run_full_pipeline(args.sources if args.sources else None)