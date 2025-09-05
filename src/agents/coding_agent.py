"""
CodingAgent for chunk indexing, embedding generation, and RAG integration.
"""

from typing import List, Dict, Optional, Any
from pathlib import Path
import os
import json
import psycopg2
import numpy as np
from dataclasses import dataclass

@dataclass
class ChunkRecord:
    dataset: str
    chunk_path: str
    chunk_index: int
    chunk_checksum: str
    manifest_path: str
    restored: bool = False

@dataclass
class DocumentRecord:
    doc_id: str
    source: str
    label: str
    parent_chunk_id: int
    extra: Optional[dict] = None

class CodingAgent:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn = psycopg2.connect(self.db_url)
        self.conn.autocommit = True

    def index_chunks_and_metadata(self, manifest_paths: List[str]):
        cur = self.conn.cursor()
        for manifest_file in manifest_paths:
            with open(manifest_file) as f:
                manifest = json.load(f)
                dataset = manifest.get("dataset", Path(manifest_file).stem)
                for chunk in manifest.get("chunks", []):
                    chunk_rec = ChunkRecord(
                        dataset=dataset,
                        chunk_path=chunk["path"],
                        chunk_index=int(chunk["index"]),
                        chunk_checksum=chunk["checksum"],
                        manifest_path=manifest_file
                    )
                    cur.execute(
                        """
                        INSERT INTO chunk_chemistry
                          (dataset, chunk_path, chunk_index, chunk_checksum, manifest_path, restored)
                        VALUES (%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (chunk_path) DO NOTHING
                        """,
                        (chunk_rec.dataset, chunk_rec.chunk_path, chunk_rec.chunk_index, chunk_rec.chunk_checksum, chunk_rec.manifest_path, chunk_rec.restored)
                    )
                    # Optional: Insert per-document metadata as well...
        cur.close()

    def generate_and_insert_embeddings(self, doc_texts: List[str], doc_ids: List[str], chunk_indices: List[int], embedding_fn):
        """embedding_fn(doc_text) returns ndarray (1536,)"""
        cur = self.conn.cursor()
        for doc_id, chunk_idx, text in zip(doc_ids, chunk_indices, doc_texts):
            embedding = embedding_fn(text)
            cur.execute(
                """
                INSERT INTO vector_embeddings (doc_id, chunk_index, embedding)
                VALUES (%s, %s, %s::vector)
                """,
                (doc_id, chunk_idx, embedding.tolist())
            )
        cur.close()

    def rag_select_docs(self, query_embedding: np.ndarray, top_k: int = 5) -> List[Dict[str, Any]]:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT doc_id, chunk_index, embedding, label FROM vector_embeddings
            ORDER BY embedding <-> %s
            LIMIT %s
            """,
            (query_embedding.tolist(), top_k)
        )
        results = [dict(zip([desc[0] for desc in cur.description], row)) for row in cur.fetchall()]
        cur.close()
        return results

    def close(self):
        self.conn.close()

# USAGE EXAMPLE (Put in scripts or notebook)
# agent = CodingAgent("postgresql://postgres:postgres@localhost:6969/postgres")
# agent.index_chunks_and_metadata(["path/to/manifest1.json", "path/to/manifest2.json"])
# agent.generate_and_insert_embeddings([...], [...], [...], embedding_fn)  # embedding_fn could be e.g. from OpenAI API
# query_vec = embedding_fn("Search this text...")
# top_docs = agent.rag_select_docs(query_vec)
# agent.close()
