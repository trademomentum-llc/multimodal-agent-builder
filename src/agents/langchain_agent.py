"""LangChain-integrated agent with advanced tool support."""

import ast
import json
import operator
from typing import Any

from langchain_classic.agents import AgentExecutor, create_react_agent
from langchain_classic.memory import ConversationBufferMemory
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.tools import BaseTool, Tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from pydantic import Field, SecretStr

from config.config import settings
from src.agents.base_agent import AgentConfig, AgentResponse, BaseAgent
from src.models.base_llm import BaseLLMClient, Message, MessageRole
from src.utils.grounding import get_grounding_summary

_BIN_OPS: dict[type[ast.operator], Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY_OPS: dict[type[ast.unaryop], Any] = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_CALC_FUNCS: dict[str, Any] = {
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sum": sum,
    "pow": pow,
    "len": len,
}
_MAX_EXPONENT = 1000


def _safe_eval(expression: str) -> Any:
    """Evaluate an arithmetic expression by walking its AST (no eval()).

    Supports numbers, + - * / // % **, unary +/-, list/tuple literals and the
    whitelisted functions in _CALC_FUNCS. Anything else raises ValueError.
    """

    def _eval(node: ast.AST) -> Any:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, int | float):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in _BIN_OPS:
            left, right = _eval(node.left), _eval(node.right)
            if isinstance(node.op, ast.Pow) and abs(right) > _MAX_EXPONENT:
                raise ValueError("Exponent too large")
            return _BIN_OPS[type(node.op)](left, right)
        if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPS:
            return _UNARY_OPS[type(node.op)](_eval(node.operand))
        if isinstance(node, ast.List | ast.Tuple):
            return [_eval(elt) for elt in node.elts]
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id in _CALC_FUNCS
            and not node.keywords
        ):
            return _CALC_FUNCS[node.func.id](*(_eval(arg) for arg in node.args))
        raise ValueError(f"Unsupported expression element: {type(node).__name__}")

    return _eval(ast.parse(expression, mode="eval"))


def _lc_content(msg: Message) -> str | list[str | dict[Any, Any]]:
    """Convert a Message's content into LangChain message content."""
    if isinstance(msg.content, str):
        return msg.content
    return [*msg.content]


class LangChainAgentConfig(AgentConfig):
    """Configuration for LangChain agent."""

    agent_type: str = Field(default="react", description="Agent type: react, conversational, etc.")
    enable_search: bool = Field(default=True, description="Enable web search")
    enable_calculator: bool = Field(default=True, description="Enable calculator")
    custom_tools: list[str] = Field(default_factory=list, description="List of custom tool names")
    max_execution_time: int = Field(default=60, description="Max execution time in seconds")


class LangChainAgent(BaseAgent):
    """Agent powered by LangChain with advanced tool support."""

    def __init__(
        self,
        config: LangChainAgentConfig | AgentConfig,
        llm_client: BaseLLMClient | None = None,
        tools: list[BaseTool] | None = None,
        langchain_llm: BaseChatModel | None = None,
    ) -> None:
        """Initialize LangChain agent.

        Args:
            config: Agent configuration
            llm_client: Optional base LLM client
            tools: Optional list of LangChain tools
            langchain_llm: Optional LangChain LLM

        """
        # Convert config if needed
        if not isinstance(config, LangChainAgentConfig):
            config = LangChainAgentConfig(**config.dict())

        # Create LangChain LLM if not provided
        if langchain_llm is None:
            langchain_llm = self._create_langchain_llm(config)

        # Initialize base agent (pass llm_client if available)
        if llm_client:
            super().__init__(config, llm_client, tools)
        else:
            # Create a dummy client for base class
            from src.models.openai_client import OpenAIClient

            dummy_client = OpenAIClient(
                api_key=settings.openai_api_key or "dummy", model=config.model or "gpt-4"
            )
            super().__init__(config, dummy_client, tools)

        self.langchain_config = config
        self.langchain_llm = langchain_llm

        # Initialize LangChain components
        # Kept separate from BaseAgent.memory (AgentMemory), which the base cycle uses.
        self.lc_memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

        # Initialize tools
        self.langchain_tools = self._initialize_tools(tools)

        # Create agent executor
        self.agent_executor = self._create_agent_executor()

    def _create_langchain_llm(self, config: LangChainAgentConfig) -> BaseChatModel:
        """Create LangChain LLM from config.

        Args:
            config: Agent configuration

        Returns:
            LangChain LLM instance

        """
        if config.model_provider == "openai":
            return ChatOpenAI(
                model=config.model or "gpt-4",
                temperature=config.temperature,
                max_completion_tokens=config.max_tokens,
                api_key=SecretStr(settings.openai_api_key) if settings.openai_api_key else None,
            )
        elif config.model_provider == "gemini":
            return ChatGoogleGenerativeAI(
                model=config.model or "gemini-pro",
                temperature=config.temperature,
                max_output_tokens=config.max_tokens,
                google_api_key=settings.gemini_api_key,
            )
        else:
            # Default to OpenAI
            return ChatOpenAI(
                model="gpt-4",
                temperature=config.temperature,
                max_completion_tokens=config.max_tokens,
                api_key=SecretStr(settings.openai_api_key) if settings.openai_api_key else None,
            )

    def _initialize_tools(self, custom_tools: list[BaseTool] | None = None) -> list[BaseTool]:
        """Initialize LangChain tools.

        Args:
            custom_tools: Optional custom tools

        Returns:
            List of tools

        """
        tools = []

        # Add custom tools if provided
        if custom_tools:
            tools.extend(custom_tools)

        # Add search tool if enabled
        if self.langchain_config.enable_search:
            search = DuckDuckGoSearchRun()
            tools.append(
                Tool(
                    name="Search",
                    func=search.run,
                    description="Search the web for current information",
                )
            )

        # Add calculator if enabled
        if self.langchain_config.enable_calculator:
            tools.append(
                Tool(
                    name="Calculator",
                    func=self._calculator,
                    description="Perform mathematical calculations",
                )
            )

        # Add more built-in tools as needed
        return tools

    def _create_agent_executor(self) -> AgentExecutor:
        """Create the LangChain agent executor.

        Returns:
            Agent executor

        """
        # Build optional ethics grounding header
        ethics = get_grounding_summary()
        ethics_header = f"System guidelines:\n{ethics}\n\n" if ethics else ""

        # Define the ReAct prompt template (prepend ethics if configured)
        react_prompt = PromptTemplate(
            input_variables=["input", "chat_history", "agent_scratchpad", "tools", "tool_names"],
            template=ethics_header + """You are a helpful AI assistant with access to various tools.

{chat_history}

You have access to the following tools:
{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought: {agent_scratchpad}""",
        )

        # Create the ReAct agent
        agent = create_react_agent(
            llm=self.langchain_llm, tools=self.langchain_tools, prompt=react_prompt
        )

        # Create agent executor
        return AgentExecutor(
            agent=agent,
            tools=self.langchain_tools,
            memory=self.lc_memory,
            verbose=self.config.verbose,
            max_iterations=self.config.max_iterations,
            handle_parsing_errors=True,
        )

    async def think(
        self,
        input_data: str | dict[str, Any],
        context: list[Message] | None = None,
        **kwargs: Any,
    ) -> str:
        """LangChain thinking process.

        Args:
            input_data: Input to process
            context: Optional context messages
            **kwargs: Additional parameters

        Returns:
            Thought/reasoning output

        """
        # Convert input to string if needed
        if isinstance(input_data, dict):
            input_str = json.dumps(input_data)
        else:
            input_str = str(input_data)

        # Add context to memory if provided
        if context:
            for msg in context:
                if msg.role == MessageRole.USER:
                    self.lc_memory.chat_memory.add_user_message(
                        HumanMessage(content=_lc_content(msg))
                    )
                elif msg.role == MessageRole.ASSISTANT:
                    self.lc_memory.chat_memory.add_ai_message(AIMessage(content=_lc_content(msg)))

        # For LangChain, the thinking is integrated into the execution
        return f"Processing: {input_str[:100]}..."

    async def act(
        self, thought: str, available_actions: list[dict[str, Any]] | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        """Execute action using LangChain agent.

        Args:
            thought: The agent's thought process
            available_actions: Optional list of available actions
            **kwargs: Additional parameters

        Returns:
            Action result

        """
        # Extract the actual input from the thought
        input_str = thought.replace("Processing: ", "").removesuffix("...")

        try:
            # Run the agent executor
            result = await self.agent_executor.ainvoke({"input": input_str})

            return {
                "type": "langchain_execution",
                "input": input_str,
                "output": result.get("output", ""),
                "intermediate_steps": result.get("intermediate_steps", []),
            }
        except Exception as e:
            return {"type": "error", "input": input_str, "error": str(e)}

    async def observe(self, action_result: dict[str, Any], **kwargs: Any) -> str:
        """Observe LangChain action result.

        Args:
            action_result: Result from the action
            **kwargs: Additional parameters

        Returns:
            Observation/final response

        """
        if action_result["type"] == "error":
            return f"Error occurred: {action_result.get('error', 'Unknown error')}"

        return str(action_result.get("output", "No output generated"))

    async def chat_with_tools(self, message: str, **kwargs: Any) -> AgentResponse:
        """Chat interface with tool usage.

        Args:
            message: User message
            **kwargs: Additional parameters

        Returns:
            Agent response with tool usage details

        """
        try:
            # Run the agent
            result = await self.agent_executor.ainvoke({"input": message})

            # Extract tool usage from intermediate steps
            tools_used = []
            for step in result.get("intermediate_steps", []):
                if len(step) >= 2:
                    action = step[0]
                    if hasattr(action, "tool"):
                        tools_used.append(
                            {
                                "tool": action.tool,
                                "input": action.tool_input,
                                "output": str(step[1])[:200],  # Truncate long outputs
                            }
                        )

            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content=result.get("output", ""),
                metadata={
                    "tools_used": tools_used,
                    "num_iterations": len(result.get("intermediate_steps", [])),
                    "type": "tool_assisted_response",
                },
                state="completed",
            )

        except Exception as e:
            return AgentResponse(
                agent_id=self.id,
                agent_name=self.config.name,
                content=f"Error: {str(e)}",
                state="error",
                error=str(e),
            )

    def add_langchain_tool(self, tool: BaseTool) -> None:
        """Add a LangChain tool to the agent.

        Args:
            tool: LangChain tool to add

        """
        self.langchain_tools.append(tool)
        # Recreate agent executor with new tools
        self.agent_executor = self._create_agent_executor()

    def _calculator(self, expression: str) -> str:
        """Evaluate a simple arithmetic expression.

        Args:
            expression: Mathematical expression

        Returns:
            Calculation result

        """
        try:
            return str(_safe_eval(expression))
        except Exception as e:
            return f"Error in calculation: {str(e)}"

    def get_tool_descriptions(self) -> list[dict[str, str]]:
        """Get descriptions of available tools.

        Returns:
            List of tool descriptions

        """
        return [
            {"name": tool.name, "description": tool.description} for tool in self.langchain_tools
        ]
