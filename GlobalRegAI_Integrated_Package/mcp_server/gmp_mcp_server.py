# Claude Model Context Protocol (MCP) Server for Local Secure Document Extraction
import os
import json
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("GlobalRegAI-Local-Connector")

@mcp.tool()
def index_local_gmp_vault(vault_dir: str) -> str:
    """Scan and index local GMP SOPs, Batch Records, and Validation reports."""
    if not os.path.exists(vault_dir):
        return json.dumps({"error": "Directory does not exist."})
    
    file_list = []
    for root, _, files in os.walk(vault_dir):
        for f in files:
            if f.endswith(('.pdf', '.docx', '.xlsx', '.hwp')):
                file_list.append({
                    "file_name": f,
                    "relative_path": os.path.relpath(os.path.join(root, f), vault_dir),
                    "size_kb": round(os.path.getsize(os.path.join(root, f)) / 1024, 2)
                })
    return json.dumps({"status": "SUCCESS", "total_files": len(file_list), "files": file_list}, ensure_ascii=False)

@mcp.tool()
def read_audit_document_secure(file_path: str) -> str:
    """Read and structure text within local secure environment without uploading raw files."""
    if not os.path.exists(file_path):
        return json.dumps({"error": "File not found."})
    
    # Text abstraction simulation
    return json.dumps({
        "status": "PARSED",
        "file_path": file_path,
        "sample_meta": {"approver": "QA Director", "effective_date": "2026-01-15"}
    }, ensure_ascii=False)

if __name__ == "__main__":
    mcp.run()
