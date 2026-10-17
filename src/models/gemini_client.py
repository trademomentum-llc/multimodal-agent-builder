"""Google Gemini client implementation."""

import io
from collections.abc import AsyncGenerator
from typing import Any

import google.generativeai as genai
import numpy as np
from PIL import Image

from config.config import settings
from src.models.base_llm import BaseLLMClient, LLMResponse, Message, MessageRole


class GeminiClient(BaseLLMClient):
    """Google Gemini client implementation."""

    # Model capabilities mapping
    MODEL_CAPABILITIES = {
        "gemini-2.5-flash": {
            "vision": True,
            "functions": True,
            "streaming": True,
            "max_context": 1048576,  # 1M tokens
            "max_output": 8192,
        },
        "gemini-2.5-pro": {
            "vision": True,
            "functions": True,
            "streaming": True,
            "max_context": 2097152,  # 2M tokens
            "max_output": 8192,
        },
        "gemini-1.5-flash": {
            "vision": True,
            "functions": True,
            "streaming": True,
            "max_context": 1048576,
            "max_output": 8192,
        },
        "gemini-1.5-pro": {
            "vision": True,
            "functions": True,
            "streaming": True,
            "max_context": 2097152,
            "max_output": 8192,
        },
        "gemini-pro": {
            "vision": False,
            "functions": True,
            "streaming": True,
            "max_context": 32768,
            "max_output": 8192,
        },
        "gemini-pro-vision": {
            "vision": True,
            "functions": False,
            "streaming": True,
            "max_context": 16384,
            "max_output": 2048,
        },
    }

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        **kwargs,
    ):
        """Initialize Gemini client.

        Args:
            api_key: Google API key (defaults to settings)
            model: Model name (defaults to settings)
            max_tokens: Maximum tokens to generate
            temperature: Temperature for sampling
            **kwargs: Additional parameters

        """
        # Use settings as defaults
        config = settings.get_llm_config("gemini")
        api_key = api_key or config["api_key"]
        model = model or config["model"]
        max_tokens = max_tokens or config["max_tokens"]
        temperature = temperature if temperature is not None else config["temperature"]

        super().__init__(api_key, model, max_tokens, temperature, **kwargs)

        # Configure the Gemini API
        genai.configure(api_key=self.api_key)

        # Initialize the model
        self.model_instance = genai.GenerativeModel(self.model)

        # Safety settings
        self.safety_settings = kwargs.get(
            "safety_settings",
            [
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            ],
        )

    async def generate(
        self, messages: list[Message], functions: list[dict[str, Any]] | None = None, **kwargs
    ) -> LLMResponse:
        """Generate a response from Gemini.

        Args:
            messages: List of messages in the conversation
            functions: Optional list of function definitions
            **kwargs: Additional parameters

        Returns:
            LLMResponse object

        """
        # Convert messages to Gemini format
        gemini_messages = self._convert_messages_to_gemini(messages)

        # Generation configuration
        generation_config = genai.GenerationConfig(
            max_output_tokens=kwargs.get("max_tokens", self.max_tokens),
            temperature=kwargs.get("temperature", self.temperature),
            top_p=kwargs.get("top_p", 1.0),
            top_k=kwargs.get("top_k", 1),
        )

        # Add tools if functions are provided
        tools = None
        if self.supports_functions and functions:
            tools = self._convert_functions_to_tools(functions)

        # Generate response
        response = await self.model_instance.generate_content_async(
            gemini_messages,
            generation_config=generation_config,
            safety_settings=self.safety_settings,
            tools=tools,
        )

        # Extract content
        content = response.text if hasattr(response, "text") else ""

        # Extract usage information
        usage = self._extract_usage(response)

        return LLMResponse(
            content=content,
            model=self.model,
            usage=usage,
            finish_reason=self._get_finish_reason(response),
            raw_response=response,
        )

    async def generate_stream(self, messages: list[Message], **kwargs) -> AsyncGenerator[str, None]:
        """Generate a streaming response from Gemini.

        Args:
            messages: List of messages
            **kwargs: Additional parameters

        Yields:
            Response chunks

        """
        gemini_messages = self._convert_messages_to_gemini(messages)

        generation_config = genai.GenerationConfig(
            max_output_tokens=kwargs.get("max_tokens", self.max_tokens),
            temperature=kwargs.get("temperature", self.temperature),
            top_p=kwargs.get("top_p", 1.0),
            top_k=kwargs.get("top_k", 1),
        )

        response = await self.model_instance.generate_content_async(
            gemini_messages,
            generation_config=generation_config,
            safety_settings=self.safety_settings,
            stream=True,
        )

        async for chunk in response:
            if chunk.text:
                yield chunk.text

    async def generate_with_image(
        self, prompt: str, image: str | bytes | Image.Image | np.ndarray, **kwargs
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

        # Process image
        processed_image = self._process_image_for_gemini(image)

        # Create content with image
        content = [prompt, processed_image]

        generation_config = genai.GenerationConfig(
            max_output_tokens=kwargs.get("max_tokens", self.max_tokens),
            temperature=kwargs.get("temperature", self.temperature),
        )

        response = await self.model_instance.generate_content_async(
            content, generation_config=generation_config, safety_settings=self.safety_settings
        )

        return LLMResponse(
            content=response.text if hasattr(response, "text") else "",
            model=self.model,
            usage=self._extract_usage(response),
            finish_reason=self._get_finish_reason(response),
            raw_response=response,
        )

    async def generate_embeddings(
        self, text: str | list[str], model: str = "models/text-embedding-004", **kwargs
    ) -> list[float] | list[list[float]]:
        """Generate embeddings for text.

        Args:
            text: Text or list of texts
            model: Embedding model to use
            **kwargs: Additional parameters

        Returns:
            Embeddings

        """
        is_single = isinstance(text, str)
        texts = [text] if is_single else text

        embeddings = []
        for t in texts:
            result = genai.embed_content(
                model=model,
                content=t,
                task_type="retrieval_document",
                title=kwargs.get("title", "Embedding"),
            )
            embeddings.append(result["embedding"])

        return embeddings[0] if is_single else embeddings

    def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: Text to count tokens for

        Returns:
            Number of tokens

        """
        # Use Gemini's count_tokens method
        return self.model_instance.count_tokens(text).total_tokens

    def _convert_messages_to_gemini(self, messages: list[Message]) -> list[dict[str, Any]]:
        """Convert messages to Gemini format.

        Args:
            messages: List of Message objects

        Returns:
            List of Gemini-formatted messages

        """
        gemini_messages = []

        for msg in messages:
            role = "user" if msg.role in [MessageRole.USER, MessageRole.SYSTEM] else "model"

            # Handle content that might be a list (for multimodal)
            if isinstance(msg.content, list):
                parts = []
                for item in msg.content:
                    if isinstance(item, dict):
                        if item.get("type") == "text":
                            parts.append(item["text"])
                        elif item.get("type") == "image_url":
                            # Handle image URLs if needed
                            pass
                    else:
                        parts.append(str(item))
                content = " ".join(parts)
            else:
                content = msg.content

            gemini_messages.append({"role": role, "parts": [content]})

        return gemini_messages

    def _convert_functions_to_tools(self, functions: list[dict[str, Any]]) -> list[Any]:
        """Convert OpenAI-style functions to Gemini tools.

        Args:
            functions: List of function definitions

        Returns:
            List of Gemini tool definitions

        """
        # This would need proper implementation based on Gemini's tool format
        # For now, returning None as Gemini's function calling API may differ
        return None

    def _process_image_for_gemini(
        self, image: str | bytes | Image.Image | np.ndarray
    ) -> Image.Image:
        """Process image for Gemini API.

        Args:
            image: Image in various formats

        Returns:
            PIL Image object

        """
        if isinstance(image, str):
            # If it's a file path
            return Image.open(image)
        elif isinstance(image, bytes):
            return Image.open(io.BytesIO(image))
        elif isinstance(image, Image.Image):
            return image
        elif isinstance(image, np.ndarray):
            return Image.fromarray(image)
        else:
            raise ValueError(f"Unsupported image type: {type(image)}")

    def _extract_usage(self, response) -> dict[str, int]:
        """Extract usage information from response.

        Args:
            response: Gemini response object

        Returns:
            Usage dictionary

        """
        # Gemini doesn't always provide detailed token counts
        # This is a simplified version
        usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        if hasattr(response, "usage_metadata"):
            metadata = response.usage_metadata
            usage["prompt_tokens"] = getattr(metadata, "prompt_token_count", 0)
            usage["completion_tokens"] = getattr(metadata, "candidates_token_count", 0)
            usage["total_tokens"] = usage["prompt_tokens"] + usage["completion_tokens"]

        return usage

    def _get_finish_reason(self, response) -> str:
        """Get finish reason from response.

        Args:
            response: Gemini response object

        Returns:
            Finish reason string

        """
        if hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "finish_reason"):
                return str(candidate.finish_reason)
        return "stop"

    @property
    def supports_functions(self) -> bool:
        """Check if model supports function calling."""
        return self.MODEL_CAPABILITIES.get(self.model, {"functions": False})["functions"]

    @property
    def supports_vision(self) -> bool:
        """Check if model supports vision inputs."""
        return self.MODEL_CAPABILITIES.get(self.model, {"vision": False})["vision"]

    @property
    def supports_streaming(self) -> bool:
        """Check if model supports streaming."""
        return self.MODEL_CAPABILITIES.get(self.model, {"streaming": True})["streaming"]

    @property
    def max_context_length(self) -> int:
        """Get maximum context length."""
        return self.MODEL_CAPABILITIES.get(self.model, {"max_context": 32768})["max_context"]
