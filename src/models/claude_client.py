"""Anthropic Claude client implementation."""

import base64
import io
from collections.abc import AsyncGenerator
from typing import Any

import numpy as np
from anthropic import AsyncAnthropic
from PIL import Image

from config.config import settings
from src.models.base_llm import BaseLLMClient, LLMResponse, Message, MessageRole, ModelCapabilities


class ClaudeClient(BaseLLMClient):
    """Anthropic Claude client implementation."""

    # Model capabilities mapping
    MODEL_CAPABILITIES: dict[str, ModelCapabilities] = {
        "claude-3-opus-20240229": {
            "vision": True,
            "functions": True,
            "streaming": True,
            "max_context": 200000,
            "max_output": 4096,
        },
        "claude-3-5-sonnet-20241022": {
            "vision": True,
            "functions": True,
            "streaming": True,
            "max_context": 200000,
            "max_output": 8192,
        },
        "claude-3-sonnet-20240229": {
            "vision": True,
            "functions": True,
            "streaming": True,
            "max_context": 200000,
            "max_output": 4096,
        },
        "claude-3-haiku-20240307": {
            "vision": True,
            "functions": True,
            "streaming": True,
            "max_context": 200000,
            "max_output": 4096,
        },
        "claude-2.1": {
            "vision": False,
            "functions": False,
            "streaming": True,
            "max_context": 200000,
            "max_output": 4096,
        },
        "claude-2.0": {
            "vision": False,
            "functions": False,
            "streaming": True,
            "max_context": 100000,
            "max_output": 4096,
        },
    }

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        **kwargs: Any,
    ) -> None:
        """Initialize Claude client.

        Args:
            api_key: Anthropic API key (defaults to settings)
            model: Model name (defaults to settings)
            max_tokens: Maximum tokens to generate
            temperature: Temperature for sampling
            **kwargs: Additional parameters

        """
        # Use settings as defaults
        config = settings.get_llm_config("anthropic")
        api_key = api_key or config["api_key"]
        model = model or config["model"]
        max_tokens = max_tokens or config["max_tokens"]
        temperature = temperature if temperature is not None else config["temperature"]

        super().__init__(api_key, model, max_tokens, temperature, **kwargs)

        # Initialize Anthropic client
        self.client = AsyncAnthropic(api_key=self.api_key)

    async def generate(
        self,
        messages: list[Message],
        system_prompt: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Generate a response from Claude.

        Args:
            messages: List of messages in the conversation
            system_prompt: Optional system prompt
            tools: Optional list of tool definitions
            **kwargs: Additional parameters

        Returns:
            LLMResponse object

        """
        # Convert messages to Claude format
        claude_messages = self._convert_messages_to_claude(messages)

        # Build request parameters
        params = {
            "model": self.model,
            "messages": claude_messages,
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
        }

        # Add system prompt if provided
        if system_prompt:
            params["system"] = system_prompt
        elif any(msg.role == MessageRole.SYSTEM for msg in messages):
            # Extract system message from messages
            system_msgs = [msg for msg in messages if msg.role == MessageRole.SYSTEM]
            if system_msgs:
                params["system"] = (
                    system_msgs[0].content
                    if isinstance(system_msgs[0].content, str)
                    else str(system_msgs[0].content)
                )

        # Add tools if supported and provided
        if self.supports_functions and tools:
            params["tools"] = tools
            if "tool_choice" in kwargs:
                params["tool_choice"] = kwargs["tool_choice"]

        # Add optional parameters
        if "top_p" in kwargs:
            params["top_p"] = kwargs["top_p"]
        if "top_k" in kwargs:
            params["top_k"] = kwargs["top_k"]
        if "stop_sequences" in kwargs:
            params["stop_sequences"] = kwargs["stop_sequences"]

        # Make API call
        response = await self.client.messages.create(**params)

        # Extract content
        content = self._extract_content(response)

        # Extract tool calls if present
        tool_calls = None
        if hasattr(response, "content") and isinstance(response.content, list):
            for item in response.content:
                if hasattr(item, "type") and item.type == "tool_use":
                    if tool_calls is None:
                        tool_calls = []
                    tool_calls.append({"id": item.id, "name": item.name, "input": item.input})

        return LLMResponse(
            content=content,
            model=response.model,
            usage={
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
            },
            finish_reason=response.stop_reason,
            function_call={"tool_calls": tool_calls} if tool_calls else None,
            raw_response=response,
        )

    async def generate_stream(
        self, messages: list[Message], system_prompt: str | None = None, **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response from Claude.

        Args:
            messages: List of messages
            system_prompt: Optional system prompt
            **kwargs: Additional parameters

        Yields:
            Response chunks

        """
        claude_messages = self._convert_messages_to_claude(messages)

        params = {
            "model": self.model,
            "messages": claude_messages,
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
        }

        if system_prompt:
            params["system"] = system_prompt

        async with self.client.messages.stream(**params) as stream:
            async for text in stream.text_stream:
                yield text

    async def generate_with_image(
        self, prompt: str, image: str | bytes | Image.Image | np.ndarray, **kwargs: Any
    ) -> LLMResponse:
        """Generate a response based on text and image input.

        Args:
            prompt: Text prompt
            image: Image input
            **kwargs: Additional parameters

        Returns:
            LLMResponse object

        """
        if not self.supports_vision:
            raise ValueError(f"Model {self.model} does not support vision inputs")

        # Process image to base64
        image_base64, media_type = self._process_image_for_claude(image)

        # Create message with image
        messages = [
            Message(
                role=MessageRole.USER,
                content=[
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            )
        ]

        return await self.generate(messages, **kwargs)

    async def generate_embeddings(
        self, text: str | list[str], **kwargs: Any
    ) -> list[float] | list[list[float]]:
        """Generate embeddings for text.

        Note: Claude doesn't have a native embedding API.
        This method raises NotImplementedError.

        Args:
            text: Text or list of texts
            **kwargs: Additional parameters

        Raises:
            NotImplementedError: Claude doesn't support embeddings

        """
        raise NotImplementedError(
            "Claude doesn't have a native embedding API. "
            "Consider using OpenAI or another provider for embeddings."
        )

    def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: Text to count tokens for

        Returns:
            Estimated number of tokens

        """
        # Claude uses a similar tokenization to GPT models
        # Rough estimation: 1 token ≈ 4 characters
        return len(text) // 4

    def _convert_messages_to_claude(self, messages: list[Message]) -> list[dict[str, Any]]:
        """Convert messages to Claude format.

        Args:
            messages: List of Message objects

        Returns:
            List of Claude-formatted messages

        """
        claude_messages = []

        for msg in messages:
            # Skip system messages as they're handled separately
            if msg.role == MessageRole.SYSTEM:
                continue

            # Map roles
            role = "user" if msg.role == MessageRole.USER else "assistant"

            # Handle content
            content: str | list[dict[str, Any]]
            if isinstance(msg.content, str):
                content = msg.content
            elif isinstance(msg.content, list):
                # Already in the right format for multimodal
                content = msg.content
            else:
                content = str(msg.content)

            claude_messages.append({"role": role, "content": content})

        return claude_messages

    def _process_image_for_claude(
        self, image: str | bytes | Image.Image | np.ndarray
    ) -> tuple[str, str]:
        """Process image for Claude API.

        Args:
            image: Image in various formats

        Returns:
            Tuple of (base64_string, media_type)

        """
        # Convert to PIL Image first
        pil_image: Image.Image
        if isinstance(image, str):
            pil_image = Image.open(image)
        elif isinstance(image, bytes):
            pil_image = Image.open(io.BytesIO(image))
        elif isinstance(image, Image.Image):
            pil_image = image
        elif isinstance(image, np.ndarray):
            pil_image = Image.fromarray(image)
        else:
            raise ValueError(f"Unsupported image type: {type(image)}")

        # Convert to bytes
        buffer = io.BytesIO()

        # Determine format and media type
        if pil_image.mode in ("RGBA", "LA"):
            # Convert images with alpha channel to RGB
            rgb_image = Image.new("RGB", pil_image.size, (255, 255, 255))
            rgb_image.paste(
                pil_image, mask=pil_image.split()[-1] if pil_image.mode == "RGBA" else None
            )
            rgb_image.save(buffer, format="JPEG", quality=95)
            media_type = "image/jpeg"
        else:
            pil_image.save(buffer, format="JPEG", quality=95)
            media_type = "image/jpeg"

        image_bytes = buffer.getvalue()
        base64_string = base64.b64encode(image_bytes).decode("utf-8")

        return base64_string, media_type

    def _extract_content(self, response: Any) -> str:
        """Extract text content from Claude response.

        Args:
            response: Claude response object

        Returns:
            Extracted text content

        """
        if hasattr(response, "content"):
            if isinstance(response.content, str):
                return response.content
            elif isinstance(response.content, list):
                # Extract text from content blocks
                text_parts = []
                for item in response.content:
                    if hasattr(item, "text"):
                        text_parts.append(item.text)
                    elif hasattr(item, "type") and item.type == "text":
                        if hasattr(item, "text"):
                            text_parts.append(item.text)
                return " ".join(text_parts)
        return ""

    @property
    def supports_functions(self) -> bool:
        """Check if model supports function calling."""
        return self.MODEL_CAPABILITIES.get(self.model, {}).get("functions", False)

    @property
    def supports_vision(self) -> bool:
        """Check if model supports vision inputs."""
        return self.MODEL_CAPABILITIES.get(self.model, {}).get("vision", False)

    @property
    def supports_streaming(self) -> bool:
        """Check if model supports streaming."""
        return self.MODEL_CAPABILITIES.get(self.model, {}).get("streaming", True)

    @property
    def max_context_length(self) -> int:
        """Get maximum context length."""
        return self.MODEL_CAPABILITIES.get(self.model, {"max_context": 100000})["max_context"]
