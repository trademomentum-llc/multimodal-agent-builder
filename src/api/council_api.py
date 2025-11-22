"""Endpoints for council-style, multi-provider deliberation."""

from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.agents.council_agent import CouncilAgent, CouncilMemberResult, CouncilOutcome

router = APIRouter(prefix="/council", tags=["council"])

# In-memory session cache; swap for DB/cache in production
council_sessions: Dict[str, CouncilOutcome] = {}
default_agent = CouncilAgent()


class MessageContext(BaseModel):
    role: str = Field(description="Message role: user|assistant|system")
    content: str = Field(description="Message text content")


class CouncilChatRequest(BaseModel):
    prompt: str = Field(description="User prompt to deliberate on")
    context: Optional[List[MessageContext]] = Field(
        default=None, description="Optional prior conversation turns"
    )
    providers: Optional[List[str]] = Field(
        default=None,
        description="Override providers (default: openai, gemini, anthropic)",
    )
    summarizer_provider: Optional[str] = Field(
        default=None, description="Provider to summarize council results"
    )
    conversation_id: Optional[str] = Field(
        default=None, description="Conversation ID to reuse/track rounds"
    )


class CouncilMemberDTO(BaseModel):
    provider: str
    model: str
    reasoning: str
    recommendation: str
    usage: Optional[Dict[str, int]] = None
    error: Optional[str] = None
    finished_at: str

    @staticmethod
    def from_result(result: CouncilMemberResult) -> "CouncilMemberDTO":
        return CouncilMemberDTO(
            provider=result.provider,
            model=result.model,
            reasoning=result.reasoning,
            recommendation=result.recommendation,
            usage=result.usage,
            error=result.error,
            finished_at=result.finished_at,
        )


class CouncilChatResponse(BaseModel):
    conversation_id: str
    prompt: str
    council_summary: str
    recommended_action: str
    members: List[CouncilMemberDTO]
    created_at: str


class CouncilDecisionRequest(BaseModel):
    conversation_id: str = Field(description="Conversation to update")
    decision: str = Field(
        description="approve|deny|edit|revise",
        pattern="^(approve|deny|edit|revise)$",
    )
    edited_prompt: Optional[str] = Field(
        default=None, description="New prompt if editing the request"
    )
    comments: Optional[str] = Field(default=None, description="Reviewer notes")


class CouncilDecisionResponse(BaseModel):
    conversation_id: str
    status: str
    prompt: str
    council_summary: str
    recommended_action: str
    members: List[CouncilMemberDTO]
    reviewer_comments: Optional[str] = None
    created_at: str


def _to_response(outcome: CouncilOutcome) -> CouncilChatResponse:
    return CouncilChatResponse(
        conversation_id=outcome.conversation_id,
        prompt=outcome.prompt,
        council_summary=outcome.council_summary,
        recommended_action=outcome.recommended_action,
        members=[CouncilMemberDTO.from_result(m) for m in outcome.members],
        created_at=outcome.created_at,
    )


@router.post("/chat", response_model=CouncilChatResponse)
async def council_chat(request: CouncilChatRequest) -> CouncilChatResponse:
    """Run a council round and return both individual and unified reasoning."""
    agent = (
        CouncilAgent(
            providers=request.providers,
            summarizer_provider=request.summarizer_provider or "openai",
        )
        if request.providers or request.summarizer_provider
        else default_agent
    )

    outcome = await agent.deliberate(
        prompt=request.prompt,
        context=[c.model_dump() for c in request.context or []],
        conversation_id=request.conversation_id or str(uuid4()),
    )
    council_sessions[outcome.conversation_id] = outcome
    return _to_response(outcome)


@router.post("/decision", response_model=CouncilDecisionResponse)
async def submit_decision(request: CouncilDecisionRequest) -> CouncilDecisionResponse:
    """Approve/deny/edit a council recommendation and optionally re-run on edits."""
    existing = council_sessions.get(request.conversation_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")

    updated = existing
    if request.decision == "edit" and request.edited_prompt:
        # Re-run council with edited prompt
        updated = await default_agent.deliberate(
            prompt=request.edited_prompt,
            context=[],
            conversation_id=request.conversation_id,
        )
        council_sessions[request.conversation_id] = updated

    return CouncilDecisionResponse(
        conversation_id=updated.conversation_id,
        status=request.decision,
        prompt=updated.prompt,
        council_summary=updated.council_summary,
        recommended_action=updated.recommended_action,
        members=[CouncilMemberDTO.from_result(m) for m in updated.members],
        reviewer_comments=request.comments,
        created_at=updated.created_at,
    )
