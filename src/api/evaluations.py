"""Evaluation and sanitation endpoints for agents."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.utils.logging_utils import logger

router = APIRouter(prefix="/evaluations", tags=["Evaluations"])


class EvaluationRequest(BaseModel):
    """Request to evaluate an agent against a dataset or prompt set."""

    agent_id: str = Field(..., description="Target agent identifier")
    dataset: Optional[str] = Field(default=None, description="Dataset name or URI")
    objectives: List[str] = Field(default_factory=list, description="Goals to score")
    max_examples: int = Field(default=20, ge=1, le=500, description="Cap number of samples")


class SanitizeRequest(BaseModel):
    """Request to run a safety/sanitation check."""

    agent_id: str
    content: str = Field(..., description="Content to sanitize or screen")
    ruleset: Optional[str] = Field(default="default", description="Safety ruleset identifier")


class EvaluationResult(BaseModel):
    """Stored evaluation result."""

    id: str
    agent_id: str
    dataset: Optional[str]
    objectives: List[str]
    created_at: str
    scores: Dict[str, float]
    summary: str


class SanitizeResult(BaseModel):
    """Response for sanitation run."""

    agent_id: str
    passed: bool
    flagged_categories: List[str]
    redactions: List[str]
    message: str


# In-memory stores; swap for persistent storage in production.
evaluation_results: Dict[str, EvaluationResult] = {}


@router.post("/run", response_model=EvaluationResult)
async def run_evaluation(request: EvaluationRequest) -> EvaluationResult:
    """Kick off a lightweight evaluation and return synthetic metrics."""
    from src.main import agent_store

    if request.agent_id not in agent_store:
        raise HTTPException(status_code=404, detail=f"Agent {request.agent_id} not found")

    # Placeholder scoring; replace with real harness/integration
    scores = {}
    for objective in request.objectives or ["helpfulness", "grounding", "safety"]:
        scores[objective] = round(0.7 + 0.2 * hash(objective + request.agent_id) % 100 / 1000, 3)

    result = EvaluationResult(
        id=str(uuid.uuid4()),
        agent_id=request.agent_id,
        dataset=request.dataset,
        objectives=request.objectives or ["helpfulness", "grounding", "safety"],
        created_at=datetime.utcnow().isoformat(),
        scores=scores,
        summary="Evaluation completed. Replace with task-specific metrics.",
    )
    evaluation_results[result.id] = result
    logger.info("Stored evaluation result for %s: %s", request.agent_id, result.id)
    return result


@router.get("/{evaluation_id}", response_model=EvaluationResult)
async def get_evaluation(evaluation_id: str) -> EvaluationResult:
    """Retrieve an evaluation result."""
    if evaluation_id not in evaluation_results:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return evaluation_results[evaluation_id]


@router.post("/sanitize", response_model=SanitizeResult)
async def sanitize_content(request: SanitizeRequest) -> SanitizeResult:
    """Perform a basic sanitation/safety check on content."""
    from src.main import agent_store

    if request.agent_id not in agent_store:
        raise HTTPException(status_code=404, detail=f"Agent {request.agent_id} not found")

    # Placeholder sanitization: check for simple redaction keywords
    blocked_keywords = ["api_key", "secret", "password"]
    flagged = [kw for kw in blocked_keywords if kw.lower() in request.content.lower()]
    redactions = [kw for kw in blocked_keywords if kw.lower() in request.content.lower()]

    return SanitizeResult(
        agent_id=request.agent_id,
        passed=not flagged,
        flagged_categories=flagged,
        redactions=redactions,
        message="Sanitation completed; replace with policy-enforced checks.",
    )
