# Multimodal Agent Builder

> **Enterprise-grade framework for building production-ready AI agents with multimodal capabilities**

A sophisticated, provider-agnostic API platform for creating, managing, and orchestrating AI agents that understand and process text, images, and audio. Built with FastAPI and designed for scalability, this framework abstracts away the complexity of working with multiple LLM providers while offering advanced features like memory management, tool integration, and recursive learning capabilities.

---

## 🎯 What is Multimodal Agent Builder?

**Multimodal Agent Builder** solves the critical challenge of building intelligent, multimodal AI applications without getting locked into a single LLM provider. It provides:

- **🔄 Unified API** across OpenAI GPT-4, Google Gemini 2.5, and Anthropic Claude-3
- **🧠 Multiple Agent Types** optimized for different use cases (conversational AI, coding, data analysis, safety monitoring)
- **💾 Sophisticated Memory Systems** with short-term, long-term, episodic, and semantic memory
- **🎨 True Multimodal Processing** for simultaneous text, image, and audio understanding
- **🔧 Tool Integration** via LangChain with ReAct workflow support
- **📊 Advanced Training** with recursive loop closure detection for continuous improvement
- **🚀 Production-Ready** with rate limiting, distributed tracing, security features, and async architecture

---

## ✨ Key Features

### 🤖 Multi-Provider LLM Support

Seamlessly switch between or combine multiple LLM providers:

- **OpenAI**: GPT-4, GPT-4-Turbo, GPT-3.5-Turbo
- **Google Gemini**: 2.5-Flash, 2.5-Pro, 1.5-Flash, 1.5-Pro
- **Anthropic Claude**: Claude-3 family

The unified client abstraction means you can change providers without rewriting your application code.

### 🎭 Specialized Agent Types

Choose the right agent for your use case:

| Agent Type              | Purpose                    | Key Features                    |
| ----------------------- | -------------------------- | ------------------------------- |
| **SimpleAgent**         | Basic conversational AI    | Lightweight, fast responses     |
| **MultimodalAgent**     | Full multimodal processing | Text, image, audio support      |
| **LangChainAgent**      | Advanced workflows         | Tool integration, ReAct pattern |
| **GuardianAgent**       | Safety & ethics monitoring | Content filtering, ethical AI   |
| **CodingAgent**         | Code execution & databases | SQL queries, code analysis      |
| **DataAnalysisAgent**   | Data processing            | Pandas integration, analytics   |
| **SearchReplaceAgent**  | Text manipulation          | Advanced search/replace         |
| **DataManagementAgent** | Data operations            | CRUD operations, validation     |
| **DataFiltrationAgent** | Data filtering             | Quality checks, cleansing       |

### 🧠 Advanced Memory Management

Four-tier memory system for sophisticated reasoning:

- **Short-term Memory**: Recent conversation context (configurable window)
- **Long-term Memory**: Persistent knowledge storage
- **Episodic Memory**: Timestamped interaction history
- **Semantic Memory**: Extracted patterns and learnings

| Agent Type | Purpose | Key Features |
|------------|---------|--------------|
| **SimpleAgent** | Basic conversational AI | Lightweight, fast responses |
| **MultimodalAgent** | Full multimodal processing | Text, image, audio support |
| **LangChainAgent** | Advanced workflows | Tool integration, ReAct pattern |
| **GuardianAgent** | Safety & ethics monitoring | Content filtering, ethical AI |
| **CodingAgent** | Code execution & databases | SQL queries, code analysis |
| **DataAnalysisAgent** | Data processing | Pandas integration, analytics |
| **SearchReplaceAgent** | Text manipulation | Advanced search/replace |
| **DataManagementAgent** | Data operations | CRUD operations, validation |
| **DataFiltrationAgent** | Data filtering | Quality checks, cleansing |

### 🧠 Advanced Memory Management

Four-tier memory system for sophisticated reasoning:

- **Short-term Memory**: Recent conversation context (configurable window)
- **Long-term Memory**: Persistent knowledge storage
- **Episodic Memory**: Timestamped interaction history
- **Semantic Memory**: Extracted patterns and learnings

### 🎨 Multimodal Capabilities

Process multiple input types simultaneously:

- **Vision**: Image analysis with configurable detail levels
- **Audio**: Transcription and audio understanding
- **Text**: Full conversational AI capabilities
- **Combined**: Analyze text + images + audio in a single request

### 🔧 Training & Learning

Advanced training infrastructure:

- **Recursive Loop Closure Detection**: Identifies learning patterns
- **Adaptive Training Manager**: Dynamic learning rate adjustment
- **Training Job Management**: API endpoints for training workflows
- **Dataset Integration**: Support for multiple dataset formats
- **Pattern Recognition**: Automated detection of improvement cycles

### 🛡️ Production-Ready Features

Built for enterprise deployments:

- **Rate Limiting**: IP-based with Redis support for distributed systems
- **Security**: CORS configuration, request validation, file type/size limits
- **Observability**: OpenTelemetry integration for distributed tracing
- **Async Architecture**: Non-blocking, high-concurrency support
- **Type Safety**: Full Pydantic validation and type hints
- **Error Handling**: Comprehensive exception handling and logging

### 🔍 RAG (Retrieval Augmented Generation)

Ground responses in your data:

- Vector embedding search
- Document chunk retrieval
- PostgreSQL-backed storage
- Integration with CodingAgent for database queries

---

## 📋 Prerequisites

- **Python 3.10+** (recommended: 3.11 or 3.12)
- **API Keys** for one or more providers:
  - OpenAI API key
  - Google Gemini API key
  - Anthropic API key
- **Optional** (for advanced features):
  - Redis (for distributed rate limiting)
  - PostgreSQL (for RAG capabilities)

---

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/anumethod/multimodal-agent-builder.git
cd multimodal-agent-builder

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -e .

# For development
pip install -e ".[dev]"
```

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor
```

Required environment variables:

```env
# LLM Provider API Keys (at least one required)
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional: Advanced features
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost/dbname

# Optional: Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_PERIOD=60

# Optional: Security
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-app.com
MAX_FILE_SIZE_MB=10
```

### 3. Run the Server

```bash
# Start the API server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 💡 Usage Examples

### Example 1: Create and Use a Simple Agent

```python
import httpx
import asyncio

async def main():
    async with httpx.AsyncClient() as client:
        # Create an agent
        response = await client.post(
            "http://localhost:8000/agents",
            json={
                "name": "MyAssistant",
                "agent_type": "multimodal",
                "llm_provider": "openai",
                "model": "gpt-4",
                "temperature": 0.7
            }
        )
        agent = response.json()
        agent_id = agent["id"]

        # Chat with the agent
        chat_response = await client.post(
            f"http://localhost:8000/agents/{agent_id}/chat",
            json={"message": "Explain quantum computing in simple terms"}
        )
        print(chat_response.json())

asyncio.run(main())
```

### Example 2: Process Image with Vision

# For development
pip install -e ".[dev]"
```

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor
```

Required environment variables:
```env
# LLM Provider API Keys (at least one required)
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional: Advanced features
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost/dbname

# Optional: Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_PERIOD=60

# Optional: Security
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-app.com
MAX_FILE_SIZE_MB=10
```

### 3. Run the Server

```bash
# Start the API server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 💡 Usage Examples

### Example 1: Create and Use a Simple Agent

```python
import httpx
import asyncio

async def main():
    async with httpx.AsyncClient() as client:
        # Create an agent
        response = await client.post(
            "http://localhost:8000/agents",
            json={
                "name": "MyAssistant",
                "agent_type": "multimodal",
                "llm_provider": "openai",
                "model": "gpt-4",
                "temperature": 0.7
            }
        )
        agent = response.json()
        agent_id = agent["id"]

        # Chat with the agent
        chat_response = await client.post(
            f"http://localhost:8000/agents/{agent_id}/chat",
            json={"message": "Explain quantum computing in simple terms"}
        )
        print(chat_response.json())

asyncio.run(main())
```

### Example 2: Process Image with Vision

```python
import httpx
import asyncio

async def analyze_image():
    async with httpx.AsyncClient() as client:
        # Create a multimodal agent
        response = await client.post(
            "http://localhost:8000/agents",
            json={
                "agent_type": "multimodal",
                "llm_provider": "openai",
                "model": "gpt-4-vision-preview"
            }
        )
        agent_id = response.json()["id"]

        # Process image
        with open("diagram.png", "rb") as img:
            files = {"image": img}
            data = {"prompt": "Explain what's in this diagram"}

            response = await client.post(
                f"http://localhost:8000/agents/{agent_id}/process-image",
                files=files,
                data=data
            )
            print(response.json())

asyncio.run(analyze_image())
```

### Example 3: Multimodal Processing (Text + Image + Audio)

```python
import httpx
import asyncio

async def multimodal_analysis():
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Create multimodal agent
        agent_response = await client.post(
            "http://localhost:8000/agents",
            json={"agent_type": "multimodal", "llm_provider": "gemini"}
        )
        agent_id = agent_response.json()["id"]

        # Process multiple modalities
        with open("meeting_screenshot.png", "rb") as img, \
             open("meeting_audio.mp3", "rb") as audio:

            files = {
                "image": img,
                "audio": audio
            }
            data = {
                "text_prompt": "Summarize this meeting based on the screenshot and audio"
            }

            response = await client.post(
                f"http://localhost:8000/agents/{agent_id}/process-multimodal",
                files=files,
                data=data
            )
            print(response.json())

asyncio.run(multimodal_analysis())
```

### Example 4: Using Python SDK Directly

```python
from src.agents.agent_factory import AgentFactory
from src.models.openai_client import OpenAIClient
import asyncio

async def main():
    # Initialize LLM client
    llm_client = OpenAIClient(model="gpt-4")

    # Create agent using factory
    agent = AgentFactory.create_agent(
        agent_type="multimodal",
        llm_client=llm_client,
        name="MyAgent",
        description="Helpful assistant"
    )

    # Use the agent
    response = await agent.process_text("What are the latest AI trends?")
    print(response)

    # Process image
    image_response = await agent.process_image(
        image_path="chart.png",
        prompt="Analyze this chart and provide insights"
    )
    print(image_response)

asyncio.run(main())
```

---

## 📚 API Reference

### Core Endpoints

#### Agent Management

```http
POST   /agents                          # Create new agent
GET    /agents                          # List all agents
GET    /agents/{id}                     # Get agent details
DELETE /agents/{id}                     # Delete agent
```

#### Agent Interaction

```http
POST   /agents/{id}/chat                # Chat with agent
POST   /agents/{id}/invoke              # Custom invocation
POST   /agents/{id}/process-image       # Process image
POST   /agents/{id}/process-audio       # Process audio
POST   /agents/{id}/process-multimodal  # Process multiple modalities
```

#### Memory Management

```http
POST   /agents/{id}/clear-memory        # Clear agent memory
GET    /agents/{id}/memory              # View memory state
```

#### Tools & Capabilities

```http
GET    /agents/{id}/tools               # List available tools
POST   /agents/{id}/tools               # Add tools to agent
```

#### Training

```http
POST   /training/start                  # Start training job
GET    /training/status/{job_id}        # Get training status
POST   /training/log-closure            # Log loop closure event
```

#### RAG (Retrieval Augmented Generation)

```http
GET    /rag/chunks                      # Retrieve document chunks
GET    /rag/documents                   # Get document metadata
POST   /rag/embeddings/search           # Vector similarity search
```

#### System

```http
GET    /                                # API info
GET    /health                          # Health check
GET    /providers                       # List available LLM providers
GET    /agent-types                     # List available agent types
```

### Request/Response Examples

#### Create Agent

```bash
curl -X POST "http://localhost:8000/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CodeHelper",
    "agent_type": "coding",
    "llm_provider": "openai",
    "model": "gpt-4",
    "temperature": 0.3,
    "max_tokens": 2000
  }'
```

Response:

```json
{
  "id": "agent_abc123",
  "name": "CodeHelper",
  "agent_type": "coding",
  "llm_provider": "openai",
  "model": "gpt-4",
  "created_at": "2025-11-16T10:30:00Z",
  "status": "active"
}
```

#### Chat with Agent

```bash
curl -X POST "http://localhost:8000/agents/agent_abc123/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Write a Python function to calculate fibonacci numbers",
    "stream": false
  }'
```

---

## 🏗️ Architecture

### Project Structure

```
multimodal-agent-builder/
├── src/
│   ├── agents/                    # Agent implementations
│   │   ├── base_agent.py         # Base agent class
│   │   ├── simple_agent.py       # Basic conversational agent
│   │   ├── multimodal_agent.py   # Full multimodal agent
│   │   ├── langchain_agent.py    # LangChain integration
│   │   ├── guardian_agent.py     # Safety monitoring
│   │   ├── coding_agent.py       # Code execution
│   │   ├── data_analysis_agent.py
│   │   ├── search_replace_agent.py
│   │   ├── data_management_agent.py
│   │   ├── data_filtration_agent.py
│   │   └── agent_factory.py      # Agent factory pattern
│   ├── models/                    # LLM client implementations
│   │   ├── base_client.py        # Abstract base client
│   │   ├── openai_client.py      # OpenAI integration
│   │   ├── gemini_client.py      # Google Gemini integration
│   │   └── claude_client.py      # Anthropic Claude integration
│   ├── memory/                    # Memory management
│   │   ├── short_term_memory.py
│   │   ├── long_term_memory.py
│   │   ├── episodic_memory.py
│   │   └── semantic_memory.py
│   ├── training/                  # Training infrastructure
│   │   ├── recursive_loop_closure.py
│   │   ├── adaptive_trainer.py
│   │   └── training_manager.py
│   ├── rag/                       # RAG capabilities
│   │   ├── vector_store.py
│   │   ├── embeddings.py
│   │   └── retrieval.py
│   ├── utils/                     # Utilities
│   │   ├── image_utils.py        # Image processing
│   │   ├── audio_utils.py        # Audio processing
│   │   ├── logging.py            # Logging configuration
│   │   └── narrative_enhancement.py
│   ├── middleware/                # API middleware
│   │   ├── rate_limiter.py
│   │   └── security.py
│   ├── routers/                   # API routers
│   │   ├── agents.py
│   │   ├── training.py
│   │   └── rag.py
│   ├── config/                    # Configuration
│   │   └── config.py
│   └── main.py                    # FastAPI application
├── tests/                         # Test suite
│   ├── test_agents/
│   ├── test_models/
│   ├── test_training/
│   └── test_api/
├── scripts/                       # Utility scripts
├── datasets/                      # Training datasets
├── .env.example                   # Environment template
├── pyproject.toml                # Project configuration
├── docker-compose.yml            # Docker setup
└── README.md
```

### Design Patterns

- **Factory Pattern**: `AgentFactory` for flexible agent creation
- **Strategy Pattern**: Interchangeable LLM clients via base class
- **Middleware Pattern**: Rate limiting and security layers
- **Repository Pattern**: Memory and data persistence
- **Async/Await**: Non-blocking I/O throughout

### Key Components

1. **Agent Factory**: Centralized agent creation with dependency injection
2. **LLM Client Abstraction**: Provider-agnostic interface for all LLMs
3. **Memory Manager**: Multi-tier memory system for context retention
4. **Training Orchestrator**: Manages training jobs and loop closure detection
5. **RAG Engine**: Vector search and document retrieval
6. **API Layer**: FastAPI routers with Pydantic validation

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API key | - | If using OpenAI |
| `GEMINI_API_KEY` | Google Gemini API key | - | If using Gemini |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | If using Claude |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `false` | No |
| `RATE_LIMIT_REQUESTS` | Requests per period | `100` | No |
| `RATE_LIMIT_PERIOD` | Period in seconds | `60` | No |
| `REDIS_URL` | Redis connection URL | - | For distributed rate limiting |
| `DATABASE_URL` | PostgreSQL connection | - | For RAG features |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `*` | No |
| `MAX_FILE_SIZE_MB` | Max upload size | `10` | No |
| `ALLOWED_IMAGE_TYPES` | Image MIME types | Standard types | No |
| `ALLOWED_AUDIO_TYPES` | Audio MIME types | Standard types | No |
| `LOG_LEVEL` | Logging level | `INFO` | No |
| `ENVIRONMENT` | Environment name | `development` | No |

### Model Configuration

Configure default model parameters in your `.env`:

```env
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=2000
DEFAULT_TOP_P=1.0
DEFAULT_FREQUENCY_PENALTY=0.0
DEFAULT_PRESENCE_PENALTY=0.0
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_agents/test_multimodal_agent.py

# Run with verbose output
pytest -v

# Run only unit tests
pytest tests/test_agents/

# Run only integration tests
pytest tests/test_api/
```

### Test Structure

- **Unit Tests**: `tests/test_agents/`, `tests/test_models/`
- **Integration Tests**: `tests/test_api/`
- **Training Tests**: `tests/test_training/`

---

## 🛡️ Security

### Built-in Security Features

1. **Rate Limiting**: Prevent abuse with configurable rate limits
   - IP-based limiting
   - Redis support for distributed systems
   - Configurable via environment variables

2. **CORS**: Environment-aware CORS configuration
   - Development: Permissive (`*` allowed)
   - Production: Strict origin validation

3. **Input Validation**:
   - File type validation (images, audio)
   - File size limits
   - Request payload validation with Pydantic
   - Content-Type checking

4. **CI Security Checks**:
   - Semgrep for code security analysis
   - Bandit for Python-specific security issues
   - Automated in GitHub Actions

5. **Ethics Framework**:
   - Optional ethics grounding via `ETHICS_FRAMEWORK_PATH`
   - Load custom ethical guidelines from markdown/text/JSON files
   - GuardianAgent for content monitoring

### Best Practices

- Store API keys in `.env` (never commit to version control)
- Use environment-specific configurations
- Enable rate limiting in production
- Restrict CORS origins in production
- Regularly update dependencies
- Monitor logs for suspicious activity
- Use HTTPS in production deployments

---

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: multimodal_agents
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 📊 Monitoring & Observability

### OpenTelemetry Integration

The framework includes built-in OpenTelemetry support for distributed tracing:

```python
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Automatic instrumentation in src/main.py
FastAPIInstrumentor.instrument_app(app)
```

### Metrics Collected

- Request latency
- Error rates
- LLM provider response times
- Memory usage
- Agent creation/deletion rates
- Training job metrics

### Logging

Structured logging with configurable levels:

```python
import logging
from src.utils.logging import get_logger

logger = get_logger(__name__)
logger.info("Agent created", extra={"agent_id": agent.id})
```

---

## 🚀 Production Deployment

### Deployment Checklist

- [ ] Set all required environment variables
- [ ] Configure CORS with specific origins
- [ ] Enable rate limiting
- [ ] Set up Redis for distributed rate limiting
- [ ] Configure PostgreSQL for RAG features
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set appropriate file upload limits
- [ ] Review and apply security best practices
- [ ] Set up backup strategy for databases
- [ ] Configure auto-scaling policies

### Recommended Production Stack

- **Reverse Proxy**: Nginx or Traefik
- **Process Manager**: Gunicorn with Uvicorn workers
- **Container Orchestration**: Kubernetes or Docker Swarm
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack or Loki
- **Tracing**: Jaeger or Zipkin
- **Cache**: Redis Cluster
- **Database**: PostgreSQL with replicas

### Example Production Command

```bash
gunicorn src.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Write/update tests
5. Run linting: `npm run lint:fix` and `black src/`
6. Run tests: `pytest`
7. Commit: `git commit -m 'Add amazing feature'`
8. Push: `git push origin feature/amazing-feature`
9. Open a Pull Request

### Code Standards

- Follow PEP 8 style guide
- Use type hints for all functions
- Write docstrings for all public methods
- Maintain test coverage above 80%
- Use Black for code formatting
- Use Ruff for linting

### Pull Request Process

1. Update documentation for any new features
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md (if applicable)
5. Request review from maintainers

---

## 🗺️ Roadmap

### Current Version (v0.1.0)

- ✅ Multi-provider LLM integration
- ✅ Multimodal processing (text, image, audio)
- ✅ Multiple agent types
- ✅ Memory management system
- ✅ REST API with FastAPI
- ✅ Basic training infrastructure
- ✅ Rate limiting and security

### Upcoming Features

- [ ] WebSocket support for real-time streaming
- [ ] Agent collaboration and multi-agent systems
- [ ] Enhanced RAG with vector database options (Pinecone, Weaviate)
- [ ] Fine-tuning pipeline for custom models
- [ ] Agent marketplace for sharing configurations
- [ ] GraphQL API option
- [ ] Enhanced training with RL from human feedback
- [ ] Multi-language support
- [ ] Agent versioning and rollback
- [ ] Cost tracking and optimization

---

## 📖 Additional Resources

### Documentation

- [API Documentation](http://localhost:8000/docs) - Interactive Swagger UI
- [ReDoc Documentation](http://localhost:8000/redoc) - Alternative API docs

### Tutorials

- [Building Your First Agent](docs/tutorials/first-agent.md)
- [Multimodal Processing Guide](docs/tutorials/multimodal.md)
- [Training Custom Agents](docs/tutorials/training.md)
- [Production Deployment](docs/tutorials/deployment.md)

### Community

- [GitHub Issues](https://github.com/anumethod/multimodal-agent-builder/issues) - Bug reports and feature requests
- [Discussions](https://github.com/anumethod/multimodal-agent-builder/discussions) - Community discussions

---

## ❓ Troubleshooting

### Common Issues

#### Issue: "Module not found" errors

```bash
# Ensure you're in the virtual environment
source .venv/bin/activate

# Reinstall dependencies
pip install -e .
```

#### Issue: API key errors

```bash
# Verify .env file exists and contains keys
cat .env | grep API_KEY

# Ensure no extra spaces or quotes
# Correct: OPENAI_API_KEY=sk-abc123
# Wrong: OPENAI_API_KEY = "sk-abc123"
```

#### Issue: Rate limit errors

```bash
# Adjust rate limiting in .env
RATE_LIMIT_REQUESTS=500
RATE_LIMIT_PERIOD=60
```

#### Issue: File upload failures

```bash
# Check file size and type
# Adjust limits in .env
MAX_FILE_SIZE_MB=50
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif,image/webp
```

### Developer Notes

- **Shell Scripts**: Use `bash script.sh` (not `sh` or `zsh`)
- **Formatting**: Run `black src/` before committing
- **Linting**: Run `ruff check src/` to check for issues
- **Type Checking**: Run `mypy src/` for type validation
- **Editor Setup**: VSCode recommended with Python extension

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for current edge cases and limitations.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 and the OpenAI API
- **Google** for Gemini and Generative AI
- **Anthropic** for Claude and Constitutional AI research
- **LangChain** community for agent orchestration patterns
- **FastAPI** team for the excellent web framework
- **Pydantic** for data validation
- All contributors and users of this framework

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/anumethod/multimodal-agent-builder/issues)
- **Discussions**: [GitHub Discussions](https://github.com/anumethod/multimodal-agent-builder/discussions)
- **Email**: Open an issue for support requests

---

## 🌟 Star History

If you find this project useful, please consider giving it a star ⭐️

---

**Status**: Active Development | **Version**: 0.1.0 | **License**: MIT

*Built with ❤️ for the AI community*
