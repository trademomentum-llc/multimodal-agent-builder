"""Training API endpoints for recursive loop closure and adaptive learning."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from src.utils.logging_utils import logger
from src.utils.training_utils import (
    AdaptiveTrainingManager,
    RecursiveLoopClosureLedger,
    create_enhanced_training_pipeline,
)

# Router for training endpoints
router = APIRouter(prefix="/training", tags=["training"])


# Request/Response models
class TrainingRequest(BaseModel):
    """Request to start training with recursive loop closure."""

    agent_name: str = Field(..., description="Name of agent to train")
    dataset_type: str = Field(default="open_images", description="Dataset type")
    epochs: int = Field(default=3, ge=1, le=100, description="Number of epochs")
    enable_closure: bool = Field(default=True, description="Enable loop closure detection")


class LoopClosureRequest(BaseModel):
    """Request to log a recursive loop closure."""

    hypothesis: str = Field(..., description="Hypothesis being tested")
    pattern: str = Field(..., description="Pattern identified")
    structure: str = Field(..., description="Structure used")
    explanation: str = Field(..., description="Why the loop was closed")
    topic: str | None = Field(default="", description="Topic description")


class TrainingStatus(BaseModel):
    """Training status response."""

    status: str
    agent_name: str
    current_epoch: int | None = None
    total_epochs: int | None = None
    loops_closed: int = 0
    patterns_found: int = 0
    accuracy: float | None = None
    message: str


class LedgerResponse(BaseModel):
    """Response containing ledger information."""

    total_loops: int
    recent_loops: list[dict[str, Any]]
    closure_rate: float


# Global training managers (in production, use a database)
training_managers: dict[str, AdaptiveTrainingManager] = {}
training_status: dict[str, dict[str, Any]] = {}


@router.post("/start", response_model=TrainingStatus)
async def start_training(
    request: TrainingRequest, background_tasks: BackgroundTasks
) -> TrainingStatus:
    """Start adaptive training with recursive loop closure.

    Args:
        request: Training configuration
        background_tasks: FastAPI background tasks

    Returns:
        Initial training status

    """
    try:
        # Check if already training
        if request.agent_name in training_status:
            existing = training_status[request.agent_name]
            if existing.get("status") == "training":
                raise HTTPException(
                    status_code=400, detail=f"Agent {request.agent_name} is already training"
                )

        # Initialize training manager
        manager = AdaptiveTrainingManager()
        training_managers[request.agent_name] = manager

        # Initialize status
        training_status[request.agent_name] = {
            "status": "initializing",
            "agent_name": request.agent_name,
            "current_epoch": 0,
            "total_epochs": request.epochs,
            "loops_closed": 0,
            "patterns_found": 0,
            "started_at": datetime.utcnow().isoformat(),
        }

        # Start training in background
        background_tasks.add_task(
            run_training_async,
            request.agent_name,
            request.dataset_type,
            request.epochs,
            request.enable_closure,
        )

        return TrainingStatus(
            status="initializing",
            agent_name=request.agent_name,
            total_epochs=request.epochs,
            message=f"Training initialized for {request.agent_name}",
        )

    except Exception as e:
        logger.error(f"Failed to start training: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


async def run_training_async(agent_name: str, dataset_type: str, epochs: int, enable_closure: bool):
    """Run training asynchronously.

    Args:
        agent_name: Name of agent
        dataset_type: Type of dataset
        epochs: Number of epochs
        enable_closure: Whether to enable closure detection

    """
    try:
        manager = training_managers[agent_name]

        # Update status
        training_status[agent_name]["status"] = "loading_data"

        # Load training data
        training_data = manager.load_training_data(dataset_type)

        # Update status
        training_status[agent_name]["status"] = "training"

        # Run training loop
        results = manager.create_training_loop(
            model_name=agent_name, training_data=training_data, epochs=epochs
        )

        # Update status with results
        training_status[agent_name].update(
            {
                "status": "validating",
                "loops_closed": len(results["loops_closed"]),
                "patterns_found": len(results["final_metrics"]["patterns_found"]),
            }
        )

        # Run validation
        val_results = manager.validate_with_closure(agent_name)

        # Final status update
        training_status[agent_name].update(
            {
                "status": "completed",
                "accuracy": val_results["validation_accuracy"],
                "completed_at": datetime.utcnow().isoformat(),
            }
        )

        logger.info(f"Training completed for {agent_name}")

    except Exception as e:
        logger.error(f"Training failed for {agent_name}: {e}")
        training_status[agent_name].update(
            {"status": "failed", "error": str(e), "failed_at": datetime.utcnow().isoformat()}
        )


@router.get("/status/{agent_name}", response_model=TrainingStatus)
async def get_training_status(agent_name: str) -> TrainingStatus:
    """Get current training status for an agent.

    Args:
        agent_name: Name of the agent

    Returns:
        Current training status

    """
    if agent_name not in training_status:
        raise HTTPException(status_code=404, detail=f"No training found for agent {agent_name}")

    status = training_status[agent_name]

    return TrainingStatus(
        status=status["status"],
        agent_name=agent_name,
        current_epoch=status.get("current_epoch"),
        total_epochs=status.get("total_epochs"),
        loops_closed=status.get("loops_closed", 0),
        patterns_found=status.get("patterns_found", 0),
        accuracy=status.get("accuracy"),
        message=f"Training {status['status']} for {agent_name}",
    )


@router.post("/closure", response_model=dict[str, Any])
async def log_loop_closure(request: LoopClosureRequest) -> dict[str, Any]:
    """Manually log a recursive loop closure.

    Args:
        request: Loop closure details

    Returns:
        Closure confirmation

    """
    try:
        # Create or get global ledger
        ledger = RecursiveLoopClosureLedger(ledger_file="manual_closure_ledger.csv")

        # Log the closure
        success = ledger.detect_and_log_closure(
            hypothesis=request.hypothesis,
            pattern=request.pattern,
            structure=request.structure,
            explanation=request.explanation,
            topic=request.topic or "Manual Closure",
        )

        if success:
            return {
                "success": True,
                "message": "Loop closure logged successfully",
                "total_loops": len(ledger.closed_loops),
                "loop_id": f"RL-{len(ledger.closed_loops):03d}",
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to detect valid closure")

    except Exception as e:
        logger.error(f"Failed to log closure: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/ledger/{agent_name}", response_model=LedgerResponse)
async def get_training_ledger(agent_name: str) -> LedgerResponse:
    """Get the recursive loop closure ledger for an agent.

    Args:
        agent_name: Name of the agent

    Returns:
        Ledger information

    """
    if agent_name not in training_managers:
        raise HTTPException(
            status_code=404, detail=f"No training manager found for agent {agent_name}"
        )

    manager = training_managers[agent_name]
    ledger_df = manager.ledger.get_ledger_df()

    # Get recent loops (last 5)
    recent_loops = ledger_df.tail(5).to_dict("records") if not ledger_df.empty else []

    # Calculate closure rate
    summary = manager.get_training_summary()

    return LedgerResponse(
        total_loops=len(manager.ledger.closed_loops),
        recent_loops=recent_loops,
        closure_rate=summary["closure_rate"],
    )


@router.get("/summary/{agent_name}", response_model=dict[str, Any])
async def get_training_summary(agent_name: str) -> dict[str, Any]:
    """Get comprehensive training summary for an agent.

    Args:
        agent_name: Name of the agent

    Returns:
        Training summary with metrics

    """
    if agent_name not in training_managers:
        raise HTTPException(
            status_code=404, detail=f"No training manager found for agent {agent_name}"
        )

    manager = training_managers[agent_name]
    summary = manager.get_training_summary()

    # Add status information
    if agent_name in training_status:
        summary["training_status"] = training_status[agent_name]

    return summary


@router.delete("/reset/{agent_name}")
async def reset_training(agent_name: str) -> dict[str, str]:
    """Reset training for an agent.

    Args:
        agent_name: Name of the agent

    Returns:
        Confirmation message

    """
    # Remove from managers and status
    if agent_name in training_managers:
        del training_managers[agent_name]

    if agent_name in training_status:
        del training_status[agent_name]

    return {"message": f"Training reset for agent {agent_name}", "agent_name": agent_name}


@router.post("/pipeline/{agent_name}", response_model=dict[str, Any])
async def create_training_pipeline(
    agent_name: str, dataset_type: str = "open_images"
) -> dict[str, Any]:
    """Create and run a complete training pipeline.

    Args:
        agent_name: Name of the agent
        dataset_type: Type of dataset to use

    Returns:
        Pipeline results

    """
    try:
        # Create enhanced pipeline
        manager = create_enhanced_training_pipeline(
            agent_name=agent_name, dataset_type=dataset_type
        )

        # Store manager
        training_managers[agent_name] = manager

        # Get summary
        summary = manager.get_training_summary()

        return {
            "success": True,
            "agent_name": agent_name,
            "summary": summary,
            "message": f"Pipeline completed for {agent_name}",
        }

    except Exception as e:
        logger.error(f"Pipeline failed for {agent_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/datasets", response_model=dict[str, Any])
async def list_available_datasets() -> dict[str, Any]:
    """List available training datasets.

    Returns:
        Available datasets and their information

    """
    from pathlib import Path

    datasets = {
        "open_images": {
            "description": "Open Images Localized Narratives dataset",
            "training_files": [],
            "validation_files": [],
            "test_files": [],
        }
    }

    # Check for actual files
    base_path = Path("train-test-validate")

    if base_path.exists():
        # Training files
        train_path = base_path / "ML-Training"
        if train_path.exists():
            datasets["open_images"]["training_files"] = [
                f.name for f in train_path.glob("*.jsonl")
            ][:5]  # Limit to 5 for display

        # Validation files
        val_path = base_path / "ML-Validation"
        if val_path.exists():
            datasets["open_images"]["validation_files"] = [
                f.name for f in val_path.glob("*.jsonl")
            ][:5]

        # Test files
        test_path = base_path / "ML-Testing"
        if test_path.exists():
            datasets["open_images"]["test_files"] = [f.name for f in test_path.glob("*.jsonl")][:5]

    return {"datasets": datasets, "total_datasets": len(datasets)}
