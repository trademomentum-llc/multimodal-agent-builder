"""Main FastAPI application for the Multimodal Agent Builder."""

import asyncio
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config.config import settings
from src.agents.agent_factory import AgentFactory, AgentType, LLMProvider
from src.agents.base_agent import AgentResponse, BaseAgent
from src.agents.multimodal_agent import MultimodalInput
from src.api.training_endpoints import router as training_router


# Global agent storage (in production, use a database)
agent_store: Dict[str, BaseAgent] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print(f"Starting {settings.app_name} v{settings.app_version}")
    print(f"Environment: {settings.app_env}")

    # Check API keys
    api_keys = settings.validate_api_keys()
    # Do not log sensitive values!
    if isinstance(api_keys, dict):
        print(f"API keys configured: {len(api_keys)}")
    elif isinstance(api_keys, (list, tuple, set)):
        print(f"API keys present: {len(api_keys)} configured.")
    elif isinstance(api_keys, bool):
        print("API keys validated.") if api_keys else print("API key validation failed.")
    else:
        print("API keys validation complete.")

    yield

    # Shutdown
    print("Shutting down application...")
    # Clean up agents
    agent_store.clear()


# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="A powerful framework for building multimodal AI agents",
    lifespan=lifespan,
    debug=settings.app_debug,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include training router
app.include_router(training_router)


# Request/Response Models
class CreateAgentRequest(BaseModel):
    """Request model for creating an agent."""

    name: str = Field(description="Agent name")
    type: str = Field(default="multimodal", description="Agent type")
    provider: str = Field(default="openai", description="LLM provider")
    model: Optional[str] = Field(default=None, description="Model name")
    description: Optional[str] = Field(default="", description="Agent description")
    system_prompt: Optional[str] = Field(default=None, description="System prompt")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, gt=0)
    enable_memory: bool = Field(default=True)
    enable_tools: bool = Field(default=True)
    enable_vision: bool = Field(default=True)
    enable_audio: bool = Field(default=True)
    config: Dict[str, Any] = Field(default_factory=dict, description="Additional configuration")


class ChatRequest(BaseModel):
    """Request model for chat interaction."""

    message: str = Field(description="User message")
    context: Optional[List[Dict[str, str]]] = Field(
        default=None, description="Conversation context"
    )
    stream: bool = Field(default=False, description="Enable streaming response")


class MultimodalRequest(BaseModel):
    """Request model for multimodal input."""

    text: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class InvokeRequest(BaseModel):
    """Request model for agent invocation."""

    input: Union[str, Dict[str, Any]] = Field(description="Input data")
    stream: bool = Field(default=False)
    kwargs: Dict[str, Any] = Field(default_factory=dict)


class AgentInfo(BaseModel):
    """Agent information response."""

    id: str
    name: str
    description: str
    type: str
    provider: str
    model: str
    state: str
    memory_enabled: bool
    tools_enabled: bool
    created_at: str
    last_activity: str
    capabilities: Dict[str, bool] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
    environment: str
    api_keys_configured: Dict[str, bool]


# API Endpoints


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        environment=settings.app_env,
        api_keys_configured=settings.validate_api_keys(),
    )


@app.get("/providers", tags=["System"])
async def list_providers():
    """List available LLM providers."""
    return {
        "providers": AgentFactory.get_available_providers(),
        "details": {
            "openai": {
                "models": AgentFactory.get_provider_models("openai"),
                "configured": bool(settings.openai_api_key),
            },
            "gemini": {
                "models": AgentFactory.get_provider_models("gemini"),
                "configured": bool(settings.gemini_api_key),
            },
            "anthropic": {
                "models": AgentFactory.get_provider_models("anthropic"),
                "configured": bool(settings.anthropic_api_key),
            },
        },
    }


@app.get("/agent-types", tags=["System"])
async def list_agent_types():
    """List available agent types."""
    return {
        "types": AgentFactory.get_available_agent_types(),
        "details": {
            "simple": "Basic conversational agent",
            "multimodal": "Agent with text, image, and audio capabilities",
            "langchain": "Agent with advanced tool support via LangChain",
        },
    }


@app.post("/agents", response_model=AgentInfo, tags=["Agents"])
async def create_agent(request: CreateAgentRequest):
    """Create a new agent."""
    try:
        # Create agent configuration
        agent_config = {
            "name": request.name,
            "type": request.type,
            "provider": request.provider,
            "model": request.model,
            "description": request.description,
            "system_prompt": request.system_prompt,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "enable_memory": request.enable_memory,
            "enable_tools": request.enable_tools,
            "enable_vision": request.enable_vision,
            "enable_audio": request.enable_audio,
            **request.config,
        }

        # Create agent using factory
        agent = AgentFactory.create_agent(**agent_config)

        # Store agent
        agent_store[agent.id] = agent

        # Get capabilities for multimodal agents
        capabilities = {}
        if hasattr(agent, "get_capabilities"):
            capabilities = agent.get_capabilities()

        return AgentInfo(
            id=agent.id,
            name=agent.config.name,
            description=agent.config.description,
            type=request.type,
            provider=request.provider,
            model=agent.llm_client.model,
            state=agent.state.value,
            memory_enabled=agent.config.enable_memory,
            tools_enabled=agent.config.enable_tools,
            created_at=agent.created_at.isoformat(),
            last_activity=agent.last_activity.isoformat(),
            capabilities=capabilities,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to create agent: {str(e)}"
        )


@app.get("/agents", response_model=List[AgentInfo], tags=["Agents"])
async def list_agents():
    """List all agents."""
    agents_info = []

    for agent_id, agent in agent_store.items():
        capabilities = {}
        if hasattr(agent, "get_capabilities"):
            capabilities = agent.get_capabilities()

        agents_info.append(
            AgentInfo(
                id=agent.id,
                name=agent.config.name,
                description=agent.config.description,
                type=agent.config.model_provider,
                provider=agent.config.model_provider,
                model=agent.llm_client.model,
                state=agent.state.value,
                memory_enabled=agent.config.enable_memory,
                tools_enabled=agent.config.enable_tools,
                created_at=agent.created_at.isoformat(),
                last_activity=agent.last_activity.isoformat(),
                capabilities=capabilities,
            )
        )

    return agents_info


@app.get("/agents/{agent_id}", response_model=AgentInfo, tags=["Agents"])
async def get_agent(agent_id: str):
    """Get agent information."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    agent = agent_store[agent_id]
    capabilities = {}
    if hasattr(agent, "get_capabilities"):
        capabilities = agent.get_capabilities()

    return AgentInfo(
        id=agent.id,
        name=agent.config.name,
        description=agent.config.description,
        type=agent.__class__.__name__,
        provider=agent.config.model_provider,
        model=agent.llm_client.model,
        state=agent.state.value,
        memory_enabled=agent.config.enable_memory,
        tools_enabled=agent.config.enable_tools,
        created_at=agent.created_at.isoformat(),
        last_activity=agent.last_activity.isoformat(),
        capabilities=capabilities,
    )


@app.delete("/agents/{agent_id}", tags=["Agents"])
async def delete_agent(agent_id: str):
    """Delete an agent."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    del agent_store[agent_id]
    return {"message": f"Agent {agent_id} deleted successfully"}


@app.post("/agents/{agent_id}/chat", response_model=AgentResponse, tags=["Agent Interaction"])
async def chat_with_agent(agent_id: str, request: ChatRequest):
    """Chat with an agent."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    agent = agent_store[agent_id]

    try:
        if request.stream:
            # Streaming response
            async def generate():
                async for chunk in agent.llm_client.generate_stream(
                    [{"role": "user", "content": request.message}]
                ):
                    yield chunk

            return StreamingResponse(generate(), media_type="text/plain")
        else:
            # Regular response
            response = await agent.chat(request.message)
            return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Chat failed: {str(e)}"
        )


@app.post("/agents/{agent_id}/invoke", response_model=AgentResponse, tags=["Agent Interaction"])
async def invoke_agent(agent_id: str, request: InvokeRequest):
    """Invoke agent with custom input."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    agent = agent_store[agent_id]

    try:
        response = await agent.run(request.input, **request.kwargs)
        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Invocation failed: {str(e)}"
        )


@app.post("/agents/{agent_id}/process-image", response_model=AgentResponse, tags=["Multimodal"])
async def process_image(
    agent_id: str,
    image: UploadFile = File(...),
    prompt: str = Form(default="What's in this image?"),
):
    """Process an image with the agent."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    agent = agent_store[agent_id]

    # Check if agent supports vision
    if not hasattr(agent, "process_image"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This agent does not support image processing",
        )

    try:
        # Read image data
        image_data = await image.read()

        # Process image
        response = await agent.process_image(image=image_data, prompt=prompt)

        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image processing failed: {str(e)}",
        )


@app.post("/agents/{agent_id}/process-audio", response_model=AgentResponse, tags=["Multimodal"])
async def process_audio(
    agent_id: str,
    audio: UploadFile = File(...),
    task: str = Form(default="transcribe"),
):
    """Process audio with the agent."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    agent = agent_store[agent_id]

    # Check if agent supports audio
    if not hasattr(agent, "process_audio"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This agent does not support audio processing",
        )

    try:
        # Read audio data
        audio_data = await audio.read()

        # Process audio
        response = await agent.process_audio(audio=audio_data, task=task)

        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audio processing failed: {str(e)}",
        )


@app.post(
    "/agents/{agent_id}/process-multimodal", response_model=AgentResponse, tags=["Multimodal"]
)
async def process_multimodal(
    agent_id: str,
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
):
    """Process multimodal input with the agent."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    agent = agent_store[agent_id]

    # Check if agent supports multimodal
    if not hasattr(agent, "process_multimodal"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This agent does not support multimodal processing",
        )

    try:
        # Build multimodal input
        multimodal_input = MultimodalInput(text=text)

        if image:
            multimodal_input.image = await image.read()

        if audio:
            multimodal_input.audio = await audio.read()

        # Process multimodal input
        response = await agent.process_multimodal(multimodal_input)

        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multimodal processing failed: {str(e)}",
        )


@app.post("/agents/{agent_id}/clear-memory", tags=["Agent Management"])
async def clear_agent_memory(agent_id: str):
    """Clear an agent's memory."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    agent = agent_store[agent_id]
    agent.clear_memory()

    return {"message": f"Memory cleared for agent {agent_id}"}


@app.post("/agents/{agent_id}/tools", tags=["Agent Management"])
async def add_tool_to_agent(
    agent_id: str, tool_name: str = Form(...), tool_description: str = Form(...)
):
    """Add a tool to an agent."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    # This is a placeholder - actual tool implementation would be needed
    return {
        "message": f"Tool '{tool_name}' added to agent {agent_id}",
        "note": "Tool functionality requires implementation",
    }


@app.get("/agents/{agent_id}/tools", tags=["Agent Management"])
async def get_agent_tools(agent_id: str):
    """Get tools available to an agent."""
    if agent_id not in agent_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    agent = agent_store[agent_id]

    # Get tool descriptions if available
    if hasattr(agent, "get_tool_descriptions"):
        return {"tools": agent.get_tool_descriptions()}
    elif hasattr(agent, "tools"):
        return {"tools": [str(tool) for tool in agent.tools]}
    else:
        return {"tools": []}


# Quick start endpoints
@app.post("/quick-start/chat-gpt4", response_model=AgentResponse, tags=["Quick Start"])
async def quick_chat_gpt4(message: str = Form(...)):
    """Quick chat with GPT-4."""
    # Create a temporary agent if not exists
    temp_agent_id = "quick-gpt4"

    if temp_agent_id not in agent_store:
        agent = AgentFactory.create_multimodal_agent(
            name="Quick GPT-4", provider="openai", model="gpt-4-turbo-preview"
        )
        agent_store[temp_agent_id] = agent

    response = await agent_store[temp_agent_id].chat(message)
    return response


@app.post("/quick-start/chat-gemini", response_model=AgentResponse, tags=["Quick Start"])
async def quick_chat_gemini(message: str = Form(...)):
    """Quick chat with Gemini."""
    # Create a temporary agent if not exists
    temp_agent_id = "quick-gemini"

    if temp_agent_id not in agent_store:
        agent = AgentFactory.create_multimodal_agent(
            name="Quick Gemini", provider="gemini", model="gemini-2.5-flash"
        )
        agent_store[temp_agent_id] = agent

    response = await agent_store[temp_agent_id].chat(message)
    return response


@app.post("/quick-start/chat-claude", response_model=AgentResponse, tags=["Quick Start"])
async def quick_chat_claude(message: str = Form(...)):
    """Quick chat with Claude."""
    # Create a temporary agent if not exists
    temp_agent_id = "quick-claude"

    if temp_agent_id not in agent_store:
        agent = AgentFactory.create_multimodal_agent(
            name="Quick Claude", provider="anthropic", model="claude-3-opus-20240229"
        )
        agent_store[temp_agent_id] = agent

    response = await agent_store[temp_agent_id].chat(message)
    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_debug,
        log_level=settings.log_level.lower(),
    )
