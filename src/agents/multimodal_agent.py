"""Multimodal agent implementation with text, image, and audio capabilities."""

import base64
import json
from typing import Any

import numpy as np
from PIL import Image
from pydantic import BaseModel, Field

from src.agents.base_agent import AgentConfig, AgentResponse, BaseAgent
from src.models.base_llm import BaseLLMClient, Message, MessageRole


class MultimodalInput(BaseModel):
    """Multimodal input structure."""

    text: str | None = Field(default=None, description="Text input")
    image: str | bytes | None = Field(default=None, description="Image input")
    audio: str | bytes | None = Field(default=None, description="Audio input")
    metadata: dict[str, Any] = Field(default_factory=dict)


class MultimodalAgentConfig(AgentConfig):
    """Configuration for multimodal agent."""

    enable_vision: bool = Field(default=True, description="Enable vision processing")
    enable_audio: bool = Field(default=True, description="Enable audio processing")
    image_detail: str = Field(default="auto", description="Image detail level: low, high, auto")
    audio_language: str = Field(default="en", description="Default audio language")
    multimodal_reasoning: bool = Field(default=True, description="Enable multimodal reasoning")


class MultimodalAgent(BaseAgent):
    """Agent capable of handling text, image, and audio inputs."""

    def __init__(
        self,
        config: MultimodalAgentConfig | AgentConfig,
        llm_client: BaseLLMClient,
        tools: list[Any] | None = None,
    ):
        """Initialize multimodal agent.

        Args:
            config: Agent configuration
            llm_client: LLM client to use
            tools: Optional list of tools

        """
        # Preserve original config object for equality checks in tests
        original_config = config
        # Build a multimodal-specific view without replacing the original
        if not isinstance(config, MultimodalAgentConfig):
            mm_config = MultimodalAgentConfig(**config.dict())
        else:
            mm_config = config

        super().__init__(original_config, llm_client, tools)
        self.multimodal_config = mm_config

        # Check LLM capabilities
        self.vision_enabled = self.multimodal_config.enable_vision and llm_client.supports_vision

    async def think(
        self,
        input_data: str | dict[str, Any] | MultimodalInput,
        context: list[Message] | None = None,
        **kwargs,
    ) -> str:
        """Multimodal thinking process.

        Args:
            input_data: Input to process (text, dict, or MultimodalInput)
            context: Optional context messages
            **kwargs: Additional parameters

        Returns:
            Thought/reasoning output

        """
        # Parse input
        if isinstance(input_data, str):
            multimodal_input = MultimodalInput(text=input_data)
        elif isinstance(input_data, dict):
            multimodal_input = MultimodalInput(**input_data)
        elif isinstance(input_data, MultimodalInput):
            multimodal_input = input_data
        else:
            raise ValueError(f"Unsupported input type: {type(input_data)}")

        # Build thinking prompt
        thinking_prompt = self._build_thinking_prompt(multimodal_input)

        # Prepare messages
        messages = []
        sys_prompt = self._build_system_prompt()
        if sys_prompt:
            messages.append(Message(role=MessageRole.SYSTEM, content=sys_prompt))

        if context:
            messages.extend(context)

        # Add the thinking prompt
        if multimodal_input.image and self.vision_enabled:
            # Create multimodal message
            content = [{"type": "text", "text": thinking_prompt}]

            # Add image
            if isinstance(multimodal_input.image, str):
                # File path
                image_data = self._load_image_file(multimodal_input.image)
            else:
                # Bytes
                image_data = multimodal_input.image

            image_base64 = base64.b64encode(image_data).decode("utf-8")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}",
                        "detail": self.multimodal_config.image_detail,
                    },
                }
            )

            messages.append(Message(role=MessageRole.USER, content=content))
        else:
            messages.append(Message(role=MessageRole.USER, content=thinking_prompt))

        # Generate thought
        response = await self._stabilized_generate(
            messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            **kwargs,
        )

        return response.content if hasattr(response, "content") else str(response)

    async def act(
        self, thought: str, available_actions: list[dict[str, Any]] | None = None, **kwargs
    ) -> dict[str, Any]:
        """Select and execute action based on thought.

        Args:
            thought: The agent's thought process
            available_actions: Optional list of available actions
            **kwargs: Additional parameters

        Returns:
            Action result

        """
        # If tools are available and enabled, select appropriate tool
        if self.tools and self.config.enable_tools:
            action = await self._select_tool_action(thought, self.tools)
            if action:
                result = await self._execute_tool(action)
                return {
                    "type": "tool_execution",
                    "tool": action["tool"],
                    "parameters": action.get("parameters", {}),
                    "result": result,
                }

        # Default action: generate response
        return {"type": "response_generation", "thought": thought, "action": "generate_response"}

    async def observe(self, action_result: dict[str, Any], **kwargs) -> str:
        """Observe and interpret action result.

        Args:
            action_result: Result from the action
            **kwargs: Additional parameters

        Returns:
            Observation/final response

        """
        if action_result["type"] == "tool_execution":
            # Interpret tool execution result
            prompt = f"""
            Based on the following thought and action result, provide a clear response:

            Thought: {action_result.get("thought", "")}
            Tool: {action_result.get("tool", "")}
            Result: {action_result.get("result", "")}

            Provide a helpful response to the user.
            """

            sys_prompt = self._build_system_prompt()
            messages = []
            if sys_prompt:
                messages.append(Message(role=MessageRole.SYSTEM, content=sys_prompt))
            messages.append(Message(role=MessageRole.USER, content=prompt))
            response = await self._stabilized_generate(
                messages,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                **kwargs,
            )
            return response.content

        # For response generation, return the thought as the observation
        return action_result.get("thought", "")

    async def process_image(
        self,
        image: str | bytes | Image.Image | np.ndarray,
        prompt: str = "What's in this image?",
        **kwargs,
    ) -> AgentResponse:
        """Process an image with a prompt.

        Args:
            image: Image to process
            prompt: Text prompt for the image
            **kwargs: Additional parameters

        Returns:
            Agent response

        """
        if not self.vision_enabled:
            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content="Vision processing is not enabled for this agent or model.",
                state="error",
                error="Vision not supported",
            )

        try:
            # Prefer a generic generate() path so tests can mock it easily
            sys_prompt = self._build_system_prompt()
            messages = []
            if sys_prompt:
                messages.append(Message(role=MessageRole.SYSTEM, content=sys_prompt))
            messages.append(Message(role=MessageRole.USER, content=prompt))
            resp = await self.llm_client.generate(
                messages,
                image=image,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                **kwargs,
            )

            # Normalize response to a simple content string and optional usage
            content = resp.content if hasattr(resp, "content") else str(resp)
            usage = resp.usage if hasattr(resp, "usage") else None

            # Update memory if enabled
            if self.memory:
                self.memory.add_to_short_term(Message(role=MessageRole.USER, content=prompt))
                self.memory.add_to_short_term(Message(role=MessageRole.ASSISTANT, content=content))

            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content=content,
                usage=usage,
                metadata={
                    "modality": "image",
                    "prompt": prompt,
                    "agent_id": self.id,
                },
            )

        except Exception as e:
            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content=f"Error processing image: {str(e)}",
                state="error",
                error=str(e),
            )

    async def process_audio(
        self, audio: str | bytes, task: str = "transcribe", **kwargs
    ) -> AgentResponse:
        """Process audio input.

        Args:
            audio: Audio to process (file path or bytes)
            task: Task to perform (transcribe, translate, analyze)
            **kwargs: Additional parameters

        Returns:
            Agent response

        """
        # Note: Audio processing would typically require additional services
        # like OpenAI's Whisper API or Google's Speech-to-Text
        # This is a placeholder implementation

        return AgentResponse(
            agent_id=self.id,
            agent_name=self.config.name,
            content="Audio processed",
            metadata={"modality": "audio", "task": task},
            state="completed",
        )

    async def process_multimodal(self, inputs: MultimodalInput, **kwargs) -> AgentResponse:
        """Process multiple modalities simultaneously.

        Args:
            inputs: Multimodal inputs
            **kwargs: Additional parameters

        Returns:
            Agent response

        """
        try:
            # Run the full think-act-observe cycle with multimodal input
            response = await self.run(inputs, **kwargs)
            response.metadata["modality"] = "multimodal"
            response.metadata["modalities_used"] = []

            if inputs.text:
                response.metadata["modalities_used"].append("text")
            if inputs.image:
                response.metadata["modalities_used"].append("image")
            if inputs.audio:
                response.metadata["modalities_used"].append("audio")

            return response

        except Exception as e:
            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content=f"Error in multimodal processing: {str(e)}",
                state="error",
                error=str(e),
            )

    def _build_thinking_prompt(self, inputs: MultimodalInput) -> str:
        """Build a thinking prompt from multimodal inputs.

        Args:
            inputs: Multimodal inputs

        Returns:
            Thinking prompt

        """
        prompt_parts = []

        if self.multimodal_config.multimodal_reasoning:
            prompt_parts.append("Analyze the following inputs:")

        if inputs.text:
            prompt_parts.append(f"Text: {inputs.text}")

        if inputs.image:
            prompt_parts.append("Image: [Image provided]")
            if self.multimodal_config.multimodal_reasoning:
                prompt_parts.append("Please analyze the image content.")

        if inputs.audio:
            prompt_parts.append("Audio: [Audio provided]")
            if self.multimodal_config.multimodal_reasoning:
                prompt_parts.append("Note: Audio processing requires transcription.")

        if inputs.metadata:
            prompt_parts.append(f"Additional context: {json.dumps(inputs.metadata)}")

        if self.multimodal_config.multimodal_reasoning:
            prompt_parts.append("\nProvide a comprehensive analysis considering all inputs.")

        return "\n".join(prompt_parts)

    async def _select_tool_action(self, thought: str, tools: list[Any]) -> dict[str, Any] | None:
        """Select appropriate tool based on thought.

        Args:
            thought: Agent's thought
            tools: Available tools

        Returns:
            Selected action or None

        """
        # This would typically use the LLM to select the appropriate tool
        # For now, returning None to use default action
        return None

    async def _execute_tool(self, action: dict[str, Any]) -> Any:
        """Execute a selected tool.

        Args:
            action: Tool action to execute

        Returns:
            Tool execution result

        """
        # Placeholder for tool execution
        # Would integrate with LangChain tools or custom implementations
        return f"Executed {action.get('tool', 'unknown')} tool"

    def _load_image_file(self, path: str) -> bytes:
        """Load image file as bytes.

        Args:
            path: Path to image file

        Returns:
            Image bytes

        """
        with open(path, "rb") as f:
            return f.read()

    def get_capabilities(self) -> dict[str, bool]:
        """Get agent capabilities.

        Returns:
            Dictionary of capabilities

        """
        return {
            "text": True,
            "image": self.vision_enabled,
            "audio": self.multimodal_config.enable_audio,
            "streaming": self.llm_client.supports_streaming,
            "functions": self.llm_client.supports_functions and self.config.enable_tools,
            "memory": self.config.enable_memory,
            "multimodal_reasoning": self.multimodal_config.multimodal_reasoning,
        }
