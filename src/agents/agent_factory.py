"""Factory for creating different types of agents."""

from enum import Enum
from typing import Any

from langchain_core.tools import BaseTool

from src.agents.base_agent import AgentConfig, BaseAgent
from src.agents.langchain_agent import LangChainAgent, LangChainAgentConfig
from src.agents.multimodal_agent import MultimodalAgent, MultimodalAgentConfig
from src.models.base_llm import BaseLLMClient
from src.models.claude_client import ClaudeClient
from src.models.gemini_client import GeminiClient
from src.models.openai_client import OpenAIClient


class AgentType(Enum):
    """Available agent types."""

    BASE = "base"
    MULTIMODAL = "multimodal"
    LANGCHAIN = "langchain"
    CUSTOM = "custom"
    SIMPLE = "simple"


class LLMProvider(Enum):
    """Available LLM providers."""

    OPENAI = "openai"
    GEMINI = "gemini"
    ANTHROPIC = "anthropic"
    CLAUDE = "claude"  # Alias for anthropic


class AgentFactory:
    """Factory for creating AI agents."""

    @staticmethod
    def create_llm_client(
        provider: str | LLMProvider, model: str | None = None, **kwargs: Any
    ) -> BaseLLMClient:
        """Create an LLM client.

        Args:
            provider: LLM provider name or enum
            model: Optional model name
            **kwargs: Additional parameters for the client

        Returns:
            LLM client instance

        Raises:
            ValueError: If provider is not supported

        """
        # Convert string to enum if needed
        if isinstance(provider, str):
            provider = provider.lower()
            if provider == "claude":
                provider = "anthropic"
        else:
            provider = provider.value

        if provider == "openai":
            return OpenAIClient(model=model, **kwargs)
        elif provider == "gemini":
            return GeminiClient(model=model, **kwargs)
        elif provider in ["anthropic", "claude"]:
            return ClaudeClient(model=model, **kwargs)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    @staticmethod
    def create_agent(
        name: str,
        agent_type: str | AgentType = AgentType.MULTIMODAL,
        provider: str | LLMProvider = LLMProvider.OPENAI,
        model: str | None = None,
        description: str = "",
        system_prompt: str | None = None,
        tools: list[Any] | None = None,
        **kwargs: Any,
    ) -> BaseAgent:
        """Create an AI agent.

        Args:
            name: Agent name
            agent_type: Type of agent to create
            provider: LLM provider
            model: Optional model name
            description: Agent description
            system_prompt: Optional system prompt
            tools: Optional list of tools
            **kwargs: Additional configuration parameters

        Returns:
            Agent instance

        Raises:
            ValueError: If agent type is not supported

        """
        # Support alias 'type' provided by callers
        if "type" in kwargs and not isinstance(agent_type, str):
            agent_type = kwargs.pop("type")
        # Normalize agent_type to string
        if isinstance(agent_type, str):
            agent_type = agent_type.lower()
        else:
            agent_type = agent_type.value

        # Create LLM client
        llm_client = AgentFactory.create_llm_client(provider, model, **kwargs)

        # Create appropriate config based on agent type
        config: AgentConfig
        if agent_type in ["multimodal", AgentType.MULTIMODAL.value]:
            config = MultimodalAgentConfig(
                name=name,
                description=description,
                model_provider=provider if isinstance(provider, str) else provider.value,
                model=model,
                system_prompt=system_prompt,
                **kwargs,
            )
            return MultimodalAgent(config, llm_client, tools)

        elif agent_type in ["langchain", AgentType.LANGCHAIN.value]:
            config = LangChainAgentConfig(
                name=name,
                description=description,
                model_provider=provider if isinstance(provider, str) else provider.value,
                model=model,
                system_prompt=system_prompt,
                **kwargs,
            )
            return LangChainAgent(config, llm_client, tools)

        elif agent_type in ["base", AgentType.BASE.value, "simple", AgentType.SIMPLE.value]:
            config = AgentConfig(
                name=name,
                description=description,
                model_provider=provider if isinstance(provider, str) else provider.value,
                model=model,
                system_prompt=system_prompt,
                **kwargs,
            )
            # Base is abstract, so create a simple implementation
            from src.agents.simple_agent import SimpleAgent

            return SimpleAgent(config, llm_client, tools)

        else:
            raise ValueError(f"Unknown agent type: {agent_type}")

    @staticmethod
    def create_simple_agent(
        name: str,
        provider: str | LLMProvider = LLMProvider.OPENAI,
        model: str | None = None,
        description: str = "",
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> BaseAgent:
        """Create a simple (base) agent."""
        return AgentFactory.create_agent(
            name=name,
            agent_type="simple",
            provider=provider,
            model=model,
            description=description,
            system_prompt=system_prompt,
            **kwargs,
        )

    @staticmethod
    def create_multimodal_agent(
        name: str,
        provider: str | LLMProvider = LLMProvider.OPENAI,
        model: str | None = None,
        enable_vision: bool = True,
        enable_audio: bool = True,
        **kwargs: Any,
    ) -> MultimodalAgent:
        """Create a multimodal agent.

        Args:
            name: Agent name
            provider: LLM provider
            model: Optional model name
            enable_vision: Enable vision processing
            enable_audio: Enable audio processing
            **kwargs: Additional configuration

        Returns:
            Multimodal agent instance

        """
        agent = AgentFactory.create_agent(
            name=name,
            agent_type=AgentType.MULTIMODAL,
            provider=provider,
            model=model,
            enable_vision=enable_vision,
            enable_audio=enable_audio,
            **kwargs,
        )
        if not isinstance(agent, MultimodalAgent):
            raise TypeError(f"Expected MultimodalAgent, got {type(agent).__name__}")
        return agent

    @staticmethod
    def create_langchain_agent(
        name: str,
        provider: str | LLMProvider = LLMProvider.OPENAI,
        model: str | None = None,
        tools: list[BaseTool] | None = None,
        enable_search: bool = True,
        enable_calculator: bool = True,
        **kwargs: Any,
    ) -> LangChainAgent:
        """Create a LangChain agent with tools.

        Args:
            name: Agent name
            provider: LLM provider
            model: Optional model name
            tools: Optional list of LangChain tools
            enable_search: Enable web search
            enable_calculator: Enable calculator
            **kwargs: Additional configuration

        Returns:
            LangChain agent instance

        """
        agent = AgentFactory.create_agent(
            name=name,
            agent_type=AgentType.LANGCHAIN,
            provider=provider,
            model=model,
            tools=tools,
            enable_search=enable_search,
            enable_calculator=enable_calculator,
            **kwargs,
        )
        if not isinstance(agent, LangChainAgent):
            raise TypeError(f"Expected LangChainAgent, got {type(agent).__name__}")
        return agent

    @staticmethod
    def create_agent_from_config(config: dict[str, Any]) -> BaseAgent:
        """Create an agent from a configuration dictionary.

        Args:
            config: Configuration dictionary

        Returns:
            Agent instance

        """
        # Extract required fields
        name = config.get("name", "Agent")
        agent_type = config.get("type", "multimodal")
        provider = config.get("provider", "openai")

        # Extract optional fields
        model = config.get("model")
        description = config.get("description", "")
        system_prompt = config.get("system_prompt")
        tools = config.get("tools", [])

        # Get additional configuration
        agent_config = config.get("config", {})

        return AgentFactory.create_agent(
            name=name,
            agent_type=agent_type,
            provider=provider,
            model=model,
            description=description,
            system_prompt=system_prompt,
            tools=tools,
            **agent_config,
        )

    @staticmethod
    def get_available_providers() -> list[str]:
        """Get list of available LLM providers.

        Returns:
            List of provider names

        """
        return [provider.value for provider in LLMProvider]

    @staticmethod
    def get_available_agent_types() -> list[str]:
        """Get list of available agent types.

        Returns:
            List of agent type names

        """
        # Ensure common aliases are included
        types = {agent_type.value for agent_type in AgentType}
        types.add("simple")
        return sorted(types)

    @staticmethod
    def get_provider_models(provider: str | LLMProvider) -> list[str]:
        """Get available models for a provider.

        Args:
            provider: LLM provider

        Returns:
            List of model names

        """
        if isinstance(provider, LLMProvider):
            provider = provider.value

        models = {
            "openai": ["gpt-4-turbo-preview", "gpt-4-turbo", "gpt-4", "gpt-4-32k", "gpt-3.5-turbo"],
            "gemini": [
                "gemini-2.5-flash",
                "gemini-2.5-pro",
                "gemini-1.5-flash",
                "gemini-1.5-pro",
                "gemini-pro",
                "gemini-pro-vision",
            ],
            "anthropic": [
                "claude-3-opus-20240229",
                "claude-3-5-sonnet-20241022",
                "claude-3-sonnet-20240229",
                "claude-3-haiku-20240307",
                "claude-2.1",
                "claude-2.0",
            ],
        }

        return models.get(provider.lower(), [])
