"""Council orchestrator that gathers model reasoning and a unified recommendation."""

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

from src.agents.agent_factory import AgentFactory
from src.models.base_llm import BaseLLMClient, LLMResponse, Message, MessageRole


def _to_message(role: str, content: str) -> Message:
    """Convert a role/content pair into a Message object with safe defaults."""
    role_map = {
        "system": MessageRole.SYSTEM,
        "assistant": MessageRole.ASSISTANT,
        "function": MessageRole.FUNCTION,
    }
    return Message(role=role_map.get(role.lower(), MessageRole.USER), content=content)


@dataclass
class CouncilMemberResult:
    """Individual model output within a council round."""

    provider: str
    model: str
    reasoning: str
    recommendation: str
    usage: Optional[Dict[str, int]] = None
    raw_response: Optional[Any] = None
    error: Optional[str] = None
    finished_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class CouncilOutcome:
    """Aggregated council response."""

    conversation_id: str
    prompt: str
    members: List[CouncilMemberResult]
    council_summary: str
    recommended_action: str
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


class CouncilAgent:
    """Orchestrates multiple provider calls and produces a unified decision."""

    def __init__(
        self,
        providers: Optional[Sequence[str]] = None,
        summarizer_provider: str = "openai",
        system_prompt: Optional[str] = None,
    ):
        self.providers = list(providers) if providers else ["openai", "gemini", "anthropic"]
        self.summarizer_provider = summarizer_provider
        self.system_prompt = system_prompt or (
            "You are a council chair. Combine model viewpoints into a concise, "
            "actionable recommendation. Make disagreements explicit."
        )

    async def deliberate(
        self,
        prompt: str,
        context: Optional[List[Dict[str, str]]] = None,
        conversation_id: Optional[str] = None,
    ) -> CouncilOutcome:
        """Fan out to configured providers and summarize the collective recommendation."""
        convo_id = conversation_id or str(uuid.uuid4())
        member_results = await self._gather_members(prompt, context or [])
        summary_text, recommended_action = await self._summarize(member_results, prompt)

        return CouncilOutcome(
            conversation_id=convo_id,
            prompt=prompt,
            members=member_results,
            council_summary=summary_text,
            recommended_action=recommended_action,
        )

    async def _gather_members(
        self, prompt: str, context: List[Dict[str, str]]
    ) -> List[CouncilMemberResult]:
        """Collect individual model reasoning concurrently."""

        async def run_member(provider: str) -> CouncilMemberResult:
            try:
                client = self._build_client(provider)
                messages = self._build_messages(prompt, context)
                llm_response: LLMResponse = await client.generate(messages)
                return CouncilMemberResult(
                    provider=provider,
                    model=llm_response.model,
                    reasoning=llm_response.content,
                    recommendation=llm_response.content,
                    usage=llm_response.usage,
                    raw_response=llm_response.raw_response,
                )
            except Exception as exc:  # pragma: no cover - defensive
                return CouncilMemberResult(
                    provider=provider,
                    model="unknown",
                    reasoning="",
                    recommendation="",
                    error=str(exc),
                )

        tasks = [run_member(provider) for provider in self.providers]
        results = await asyncio.gather(*tasks)
        return results

    def _build_client(self, provider: str) -> BaseLLMClient:
        """Create an LLM client for a provider."""
        return AgentFactory.create_llm_client(provider=provider)

    def _build_messages(self, prompt: str, context: List[Dict[str, str]]) -> List[Message]:
        """Prepare conversation messages for provider calls."""
        messages: List[Message] = []
        for item in context:
            role = item.get("role", "user")
            content = item.get("content", "")
            if not content:
                continue
            messages.append(_to_message(role, content))
        messages.append(_to_message("user", prompt))
        return messages

    async def _summarize(
        self, members: List[CouncilMemberResult], prompt: str
    ) -> Tuple[str, str]:
        """Produce a unified summary and recommended action."""
        # If every model failed, bail out early with a clear message.
        successful = [m for m in members if not m.error and m.reasoning]
        if not successful:
            return ("All providers failed to respond. Try again or check keys.", "deny")

        summary_client = self._build_client(self.summarizer_provider)
        summary_messages = [
            Message(role=MessageRole.SYSTEM, content=self.system_prompt),
            Message(
                role=MessageRole.USER,
                content=(
                    "User prompt:\n"
                    f"{prompt}\n\n"
                    "Model deliberations:\n"
                    + "\n\n".join(
                        [
                            f"- {m.provider} ({m.model}): {m.reasoning or 'no reasoning'}"
                            for m in members
                        ]
                    )
                    + "\n\nReturn a concise council summary and recommended action "
                    "('approve', 'revise', or 'deny') in two sentences."
                ),
            ),
        ]

        try:
            llm_response: LLMResponse = await summary_client.generate(summary_messages)
            text = llm_response.content.strip()
            action = "revise"
            lowered = text.lower()
            if "approve" in lowered:
                action = "approve"
            elif "deny" in lowered or "reject" in lowered:
                action = "deny"
            return (text, action)
        except Exception:  # pragma: no cover - defensive fallback
            return (
                "Council summary unavailable; defaulting to cautious proceed with manual review.",
                "revise",
            )
