"""Base agent abstract class for building AI agents."""

import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from src.models.base_llm import BaseLLMClient, LLMResponse, Message, MessageRole
from src.utils.grounding import get_grounding_summary
from src.utils.training_utils import RecursiveLoopClosureLedger

_log = logging.getLogger(__name__)


class AgentState(Enum):
    """Agent state enumeration."""

    IDLE = "idle"
    THINKING = "thinking"
    EXECUTING = "executing"
    WAITING = "waiting"
    ERROR = "error"
    COMPLETED = "completed"


class AgentMemoryType(Enum):
    """Types of agent memory."""

    SHORT_TERM = "short_term"
    LONG_TERM = "long_term"
    EPISODIC = "episodic"
    SEMANTIC = "semantic"


@dataclass
class AgentMemory:
    """Agent memory storage."""

    short_term: list[Message] = field(default_factory=list)
    long_term: dict[str, Any] = field(default_factory=dict)
    episodic: list[dict[str, Any]] = field(default_factory=list)
    semantic: dict[str, Any] = field(default_factory=dict)
    max_short_term_size: int = 50

    def add_to_short_term(self, message: Message) -> None:
        """Add a message to short-term memory."""
        self.short_term.append(message)
        # Trim if exceeds max size
        if len(self.short_term) > self.max_short_term_size:
            self.short_term = self.short_term[-self.max_short_term_size :]

    def add_episodic_memory(self, episode: dict[str, Any]) -> None:
        """Add an episode to episodic memory."""
        episode["timestamp"] = datetime.utcnow().isoformat()
        self.episodic.append(episode)

    def clear_short_term(self) -> None:
        """Clear short-term memory."""
        self.short_term.clear()

    def get_context(self, max_messages: int = 10) -> list[Message]:
        """Get recent context from memory."""
        return self.short_term[-max_messages:] if self.short_term else []


class AgentConfig(BaseModel):
    """Configuration for an agent."""

    name: str = Field(description="Agent name")
    description: str = Field(default="", description="Agent description")
    model_provider: str = Field(default="openai", description="LLM provider")
    model: str | None = Field(default=None, description="Model to use")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, gt=0)
    system_prompt: str | None = Field(default=None, description="System prompt")
    enable_memory: bool = Field(default=True, description="Enable memory")
    enable_tools: bool = Field(default=True, description="Enable tool usage")
    max_iterations: int = Field(default=10, description="Max reasoning iterations")
    verbose: bool = Field(default=False, description="Verbose output")
    enable_recursive_closure: bool = Field(
        default=True, description="Enable recursive loop closure tracking"
    )

    class Config:
        extra = "allow"


class AgentResponse(BaseModel):
    """Response from an agent."""

    agent_id: str
    agent_name: str
    content: str
    raw_response: Any | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    state: str = Field(default=AgentState.COMPLETED.value)
    error: str | None = None
    usage: dict[str, int] | None = None


class BaseAgent(ABC):
    """Abstract base class for AI agents."""

    def __init__(
        self,
        config: AgentConfig,
        llm_client: BaseLLMClient,
        tools: list[Any] | None = None,
    ) -> None:
        """Initialize the agent.

        Args:
            config: Agent configuration
            llm_client: LLM client to use
            tools: Optional list of tools/functions

        """
        self.id = str(uuid.uuid4())
        self.config = config
        self.llm_client = llm_client
        self.tools = tools or []
        self.state = AgentState.IDLE
        self.memory = AgentMemory() if config.enable_memory else None
        self.conversation_history: list[Message] = []
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()

        # Optional recursive loop closure ledger per-agent instance
        self._closure_ledger: RecursiveLoopClosureLedger | None = None
        if getattr(self.config, "enable_recursive_closure", False):
            # Per-agent ledger file keeps runs isolated and auditable
            ledger_path = f"agent_{self.id}_closure_ledger.csv"
            self._closure_ledger = RecursiveLoopClosureLedger(ledger_file=ledger_path)

        # Stabilizer configuration
        self._stabilizer_max_retries: int = 2
        self._stabilizer_backoff_sec: float = 0.3

    # Shared prompt builders
    def _build_system_prompt(self) -> str | None:
        base = self.config.system_prompt or ""
        ethics = get_grounding_summary()
        if ethics:
            if base:
                return ethics + "\n\n" + base
            return ethics
        return base or None

    @abstractmethod
    async def think(
        self,
        input_data: str | dict[str, Any],
        context: list[Message] | None = None,
        **kwargs: Any,
    ) -> str:
        """Agent's thinking/reasoning process.

        Args:
            input_data: Input to process
            context: Optional context messages
            **kwargs: Additional parameters

        Returns:
            Thought/reasoning output

        """
        pass

    @abstractmethod
    async def act(
        self, thought: str, available_actions: list[dict[str, Any]] | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        """Agent's action selection and execution.

        Args:
            thought: The agent's thought process
            available_actions: Optional list of available actions
            **kwargs: Additional parameters

        Returns:
            Action result

        """
        pass

    @abstractmethod
    async def observe(self, action_result: dict[str, Any], **kwargs: Any) -> str:
        """Agent observes the result of its action.

        Args:
            action_result: Result from the action
            **kwargs: Additional parameters

        Returns:
            Observation

        """
        pass

    async def run(self, input_data: str | dict[str, Any], **kwargs: Any) -> AgentResponse:
        """Run the agent's complete cycle.

        Args:
            input_data: Input to process
            **kwargs: Additional parameters

        Returns:
            Agent response

        """
        try:
            self.state = AgentState.THINKING
            self.last_activity = datetime.utcnow()

            # Get context from memory if enabled
            context = None
            if self.memory:
                context = self.memory.get_context()

            # Think phase
            thought = await self.think(input_data, context, **kwargs)

            # Act phase
            self.state = AgentState.EXECUTING
            action_result = await self.act(thought, **kwargs)

            # Observe phase
            observation = await self.observe(action_result, **kwargs)

            # Optionally detect and log recursive loop closure for this cycle
            try:
                self._maybe_log_loop_closure(
                    input_data=input_data,
                    thought=thought,
                    action=action_result,
                    observation=observation,
                )
            except Exception:
                # Closure logging must never affect core agent execution
                _log.debug("Loop-closure logging failed", exc_info=True)

            # Update memory if enabled
            if self.memory and isinstance(input_data, str):
                self.memory.add_to_short_term(Message(role=MessageRole.USER, content=input_data))
                self.memory.add_to_short_term(
                    Message(role=MessageRole.ASSISTANT, content=observation)
                )

            self.state = AgentState.COMPLETED

            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content=observation,
                metadata={
                    "thought": thought,
                    "action": action_result,
                },
                state=self.state.value,
            )
        except Exception as e:
            self.state = AgentState.ERROR
            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content="An error occurred while processing your request.",
                state=self.state.value,
                error=str(e),
            )

    # Internal helpers
    def _maybe_log_loop_closure(
        self,
        input_data: str | dict[str, Any],
        thought: str,
        action: dict[str, Any],
        observation: str,
    ) -> None:
        """Attempt to log a recursive loop closure for a single run cycle.

        Uses a lightweight heuristic mapping of the agent's think-act-observe cycle
        to the closure ledger's (hypothesis, pattern, structure) tuple.
        """
        if not self._closure_ledger:
            return

        # Build hypothesis/pattern/structure from the current cycle
        hypothesis = (
            thought
            if isinstance(thought, str) and thought.strip()
            else "Agent reasoning produced a hypothesis"
        )
        action_type = action.get("type", "action") if isinstance(action, dict) else "action"
        pattern = f"Action={action_type}; Provider={self.config.model_provider}"
        structure = f"{self.__class__.__name__}::think->act->observe"

        explanation = (
            f"Closed loop for input of type {type(input_data).__name__} "
            f"with observation length {len(str(observation))}."
        )

        # Best effort detection and logging (validation happens in the ledger)
        self._closure_ledger.detect_and_log_closure(
            hypothesis=hypothesis,
            pattern=pattern,
            structure=structure,
            explanation=explanation,
            topic=self.config.name or self.__class__.__name__,
        )

    async def _stabilized_generate(self, *args: Any, **kwargs: Any) -> LLMResponse:
        """Call LLM with simple retry/backoff to self-stabilize transient failures."""
        last_exc: Exception | None = None
        for attempt in range(self._stabilizer_max_retries + 1):
            try:
                return await self.llm_client.generate(*args, **kwargs)
            except Exception as e:  # noqa: BLE001 broad by design to stabilize
                last_exc = e
                if attempt >= self._stabilizer_max_retries:
                    break
                # Backoff
                import asyncio as _asyncio

                await _asyncio.sleep(self._stabilizer_backoff_sec * (2**attempt))
        raise last_exc  # type: ignore[misc]

    async def chat(self, message: str, **kwargs: Any) -> AgentResponse:
        """Chat with the agent through a simple interface.

        Args:
            message: User message
            **kwargs: Additional parameters

        Returns:
            Agent response

        """
        try:
            self.state = AgentState.THINKING
            self.last_activity = datetime.utcnow()

            # Add user message to conversation history
            user_message = Message(role=MessageRole.USER, content=message)
            self.conversation_history.append(user_message)

            # Prepare messages with system prompt
            messages = []
            if self.config.system_prompt:
                messages.append(Message(role=MessageRole.SYSTEM, content=self.config.system_prompt))

            # Add conversation history or memory context
            if self.memory:
                messages.extend(self.memory.get_context())
            else:
                # Limit conversation history to prevent token overflow
                messages.extend(self.conversation_history[-10:])

            # Generate response
            llm_response = await self.llm_client.generate(
                messages,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                **kwargs,
            )

            # Add assistant response to conversation history
            assistant_message = Message(role=MessageRole.ASSISTANT, content=llm_response.content)
            self.conversation_history.append(assistant_message)

            # Update memory if enabled
            if self.memory:
                self.memory.add_to_short_term(user_message)
                self.memory.add_to_short_term(assistant_message)

            self.state = AgentState.COMPLETED

            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content=llm_response.content,
                usage=llm_response.usage,
                state=self.state.value,
                raw_response=llm_response.raw_response,
            )

        except Exception as e:
            self.state = AgentState.ERROR
            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content=f"Error: {str(e)}",
                state=self.state.value,
                error=str(e),
            )

    def add_tool(self, tool: Any) -> None:
        """Add a tool to the agent."""
        if self.config.enable_tools:
            self.tools.append(tool)

    def remove_tool(self, tool_name: str) -> None:
        """Remove a tool from the agent."""
        self.tools = [t for t in self.tools if getattr(t, "name", "") != tool_name]

    def clear_memory(self) -> None:
        """Clear the agent's memory."""
        if self.memory:
            self.memory.clear_short_term()
        self.conversation_history.clear()

    def get_info(self) -> dict[str, Any]:
        """Get agent information."""
        return {
            "id": self.id,
            "name": self.config.name,
            "description": self.config.description,
            "state": self.state.value,
            "model_provider": self.config.model_provider,
            "model": self.llm_client.model,
            "tools_count": len(self.tools),
            "memory_enabled": self.config.enable_memory,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "conversation_length": len(self.conversation_history),
        }

    def __repr__(self) -> str:
        """Return a string representation of the agent."""
        return f"{self.__class__.__name__}(name='{self.config.name}', id='{self.id}')"
