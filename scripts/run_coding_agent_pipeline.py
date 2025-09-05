"""
Script to run chunk manifest indexing, embedding generation, and sample RAG retrieval using CodingAgent.
"""

import glob
import json
import numpy as np
from src.agents.coding_agent import CodingAgent

# --- CONFIG ---
DB_URL = "postgresql://postgres:postgres@localhost:6969/postgres"
CHUNK_MANIFEST_GLOB = "train-test-validate/**/**/*.manifest"

# Placeholder: Dummy embedding function (replace with real API/model)
def embedding_fn(text: str) -> np.ndarray:
    return np.random.rand(1536)  # Fake embedding; replace for real use.

if __name__ == "__main__":
    agent = CodingAgent(DB_URL)

    # 1. Index all chunk manifests and metadata
    manifest_paths = glob.glob(CHUNK_MANIFEST_GLOB, recursive=True)
    print(f"Discovered {len(manifest_paths)} manifests.")
    # Patch: skip/report broken manifests
    working_manifests = []
    for mf in manifest_paths:
        try:
            with open(mf) as f:
                json.load(f)
            working_manifests.append(mf)
        except Exception as e:
            print(f"SKIPPING BROKEN MANIFEST: {mf}\n  Reason: {e}")
    if working_manifests:
        agent.index_chunks_and_metadata(working_manifests)
        print(f"Chunks and metadata indexed from {len(working_manifests)}/{len(manifest_paths)} manifests.")
    else:
        print("No valid manifests were found to index.")

    # 2. Dummy docID/text inputs for vector table population
    doc_texts = ["sample text one", "sample text two", "sample text three"]
    doc_ids = ["doc-001", "doc-002", "doc-003"]
    chunk_indices = [1, 2, 3]
    agent.generate_and_insert_embeddings(doc_texts, doc_ids, chunk_indices, embedding_fn)
    print("Embeddings generated and inserted.")

    # 3. Simple vector search test
    query_vec = embedding_fn("search this")
    results = agent.rag_select_docs(query_vec, top_k=3)
    print("Top RAG search results:")
    for r in results:
        print(r)

    agent.close()
    print("Pipeline complete.")

