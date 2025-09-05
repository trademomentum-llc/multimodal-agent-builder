"""
RAG-aware data loader FastAPI endpoints.
- REST API for chunk, document, and embedding retrieval from the RAG backend.
- Uses CodingAgent for actual Postgres access.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
import numpy as np
from src.agents.coding_agent import CodingAgent

router = APIRouter(prefix="/rag", tags=["rag"])

DB_URL = "postgresql://postgres:postgres@localhost:6969/postgres"

@router.get("/chunks", response_model=List[Dict[str,Any]])
def list_chunks(dataset: Optional[str] = None) -> List[Dict[str,Any]]:
    agent = CodingAgent(DB_URL)
    cur = agent.conn.cursor()
    if dataset:
        cur.execute("SELECT * FROM chunk_chemistry WHERE dataset=%s", (dataset,))
    else:
        cur.execute("SELECT * FROM chunk_chemistry")
    colnames = [desc[0] for desc in cur.description]
    chunks = [dict(zip(colnames, row)) for row in cur.fetchall()]
    cur.close()
    agent.close()
    return chunks

@router.get("/documents", response_model=List[Dict[str,Any]])
def list_documents(doc_id: Optional[str] = None) -> List[Dict[str,Any]]:
    agent = CodingAgent(DB_URL)
    cur = agent.conn.cursor()
    if doc_id:
        cur.execute("SELECT * FROM document_metadata WHERE doc_id=%s", (doc_id,))
    else:
        cur.execute("SELECT * FROM document_metadata")
    colnames = [desc[0] for desc in cur.description]
    docs = [dict(zip(colnames, row)) for row in cur.fetchall()]
    cur.close()
    agent.close()
    return docs

@router.get("/embeddings/search", response_model=List[Dict[str,Any]])
def search_embeddings(
    query: List[float] = Query(..., description="1536-dim embedding vector as comma separated list"),
    top_k: int = 5
):
    agent = CodingAgent(DB_URL)
    query_vec = np.array(query, dtype=np.float32)
    results = agent.rag_select_docs(query_vec, top_k=top_k)
    agent.close()
    return results

# To use: include router in your src/main.py's FastAPI app.
# app.include_router(rag_api_router)
