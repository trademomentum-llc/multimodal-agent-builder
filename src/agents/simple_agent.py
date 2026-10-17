"""Simple agent implementation for basic use cases."""

from typing import Any

from src.agents.base_agent import BaseAgent
from src.models.base_llm import Message, MessageRole


class SimpleAgent(BaseAgent):
    """Simple agent implementation for basic conversational AI."""

    async def think(
        self,
        input_data: str | dict[str, Any],
        context: list[Message] | None = None,
        **kwargs,
    ) -> str:
        """Simple thinking process - just process the input.

        Args:
            input_data: Input to process
            context: Optional context messages
            **kwargs: Additional parameters

        Returns:
            Processed thought

        """
        if isinstance(input_data, dict):
            # Convert dict to string representation
            input_str = str(input_data)
        else:
            input_str = str(input_data)

        # Simple thinking: just acknowledge the input
        return f"Processing request: {input_str}"

    async def act(
        self, thought: str, available_actions: list[dict[str, Any]] | None = None, **kwargs
    ) -> dict[str, Any]:
        """Simple action - generate response.

        Args:
            thought: The agent's thought process
            available_actions: Optional list of available actions
            **kwargs: Additional parameters

        Returns:
            Action result

        """
        # Extract the actual request from the thought
        request = thought.replace("Processing request: ", "")

        # Prepare messages
        messages = []
        sys_prompt = self._build_system_prompt()
        if sys_prompt:
            messages.append(Message(role=MessageRole.SYSTEM, content=sys_prompt))
        messages.append(Message(role=MessageRole.USER, content=request))

        # Generate response
        response = await self._stabilized_generate(
            messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            **kwargs,
        )

        return {"type": "response", "content": response.content, "usage": response.usage}

    async def observe(self, action_result: dict[str, Any], **kwargs) -> str:
        """Simple observation - return the response.

        Args:
            action_result: Result from the action
            **kwargs: Additional parameters

        Returns:
            Final response

        """
        return action_result.get("content", "No response generated")
