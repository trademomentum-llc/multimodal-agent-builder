"""Training utilities with recursive loop closure and dataset management."""

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from src.utils.logging_utils import logger, setup_logger
from src.utils.narrative_utils import NarrativeEnhancer


@dataclass
class RecursiveLoop:
    """Represents a recursive loop in the learning process."""

    loop_id: str
    topic: str
    hypothesis: str
    pattern: str
    structure: str
    why_closed: str
    timestamp: str = None

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()


class RecursiveLoopClosureLedger:
    """Manages recursive loop closure tracking inspired by living_system.ts."""

    def __init__(self, ledger_file: str | None = None):
        """Initialize the ledger.

        Args:
            ledger_file: Optional path to persist ledger

        """
        self.ledger_file = ledger_file
        self.closed_loops: list[RecursiveLoop] = []
        self.closure_recognition_agent = ClosureRecognitionAgent()

        if ledger_file and Path(ledger_file).exists():
            self.load_ledger()

    def detect_and_log_closure(
        self, hypothesis: str, pattern: str, structure: str, explanation: str, topic: str = ""
    ) -> bool:
        """Detect and log a closure.

        Args:
            hypothesis: The hypothesis being tested
            pattern: Pattern identified
            structure: Structure used for analysis
            explanation: Why the loop was closed
            topic: Optional topic description

        Returns:
            True if closure was detected and logged

        """
        # Use closure recognition agent to validate
        if self.closure_recognition_agent.detect_closure(hypothesis, pattern, structure):
            loop_id = f"RL-{len(self.closed_loops) + 1:03d}"

            loop = RecursiveLoop(
                loop_id=loop_id,
                topic=topic or f"Loop {len(self.closed_loops) + 1}",
                hypothesis=hypothesis,
                pattern=pattern,
                structure=structure,
                why_closed=explanation,
            )

            self.closed_loops.append(loop)
            logger.info(f"Closed recursive loop {loop_id}: {topic}")

            # Save ledger if file specified
            if self.ledger_file:
                self.save_ledger()

            return True

        logger.warning("Failed to detect closure")
        return False

    def get_ledger_df(self) -> pd.DataFrame:
        """Get ledger as pandas DataFrame.

        Returns:
            DataFrame of closed loops

        """
        data = [
            {
                "Loop ID": loop.loop_id,
                "Topic": loop.topic,
                "Hypothesis": loop.hypothesis,
                "Pattern": loop.pattern,
                "Structure": loop.structure,
                "Why Closed": loop.why_closed,
                "Timestamp": loop.timestamp,
            }
            for loop in self.closed_loops
        ]

        return pd.DataFrame(data)

    def save_ledger(self):
        """Save ledger to file."""
        if self.ledger_file:
            df = self.get_ledger_df()
            df.to_csv(self.ledger_file, index=False)
            logger.info(f"Saved ledger to {self.ledger_file}")

    def load_ledger(self):
        """Load ledger from file."""
        if self.ledger_file and Path(self.ledger_file).exists():
            df = pd.read_csv(self.ledger_file)
            self.closed_loops = []

            for _, row in df.iterrows():
                loop = RecursiveLoop(
                    loop_id=row["Loop ID"],
                    topic=row["Topic"],
                    hypothesis=row["Hypothesis"],
                    pattern=row["Pattern"],
                    structure=row["Structure"],
                    why_closed=row["Why Closed"],
                    timestamp=row.get("Timestamp", ""),
                )
                self.closed_loops.append(loop)

            logger.info(f"Loaded {len(self.closed_loops)} loops from ledger")


class ClosureRecognitionAgent:
    """Agent for recognizing loop closure patterns (Python version of TypeScript class)."""

    def __init__(self):
        """Initialize the closure recognition agent."""
        self.closed_loops = []
        self.logger = setup_logger("closure_agent")

    def detect_closure(self, hypothesis: str, pattern: str, structure: str) -> bool:
        """Detect if a loop can be closed.

        Args:
            hypothesis: Hypothesis to test
            pattern: Pattern identified
            structure: Structure used

        Returns:
            True if closure is detected

        """
        self.logger.debug(
            f"Attempting closure detection: h={hypothesis}, p={pattern}, s={structure}"
        )

        # Validate inputs
        valid = all(isinstance(v, str) and v.strip() for v in [hypothesis, pattern, structure])

        if valid:
            self.closed_loops.append(
                {"hypothesis": hypothesis, "pattern": pattern, "structure": structure}
            )
            self.logger.info("Closure detected and stored")
            return True

        self.logger.warning("Closure not detected - invalid parameters")
        return False

    def report(self) -> list[dict[str, str]]:
        """Report all closed loops.

        Returns:
            List of closed loops

        """
        return self.closed_loops


class AdaptiveTrainingManager:
    """Manages adaptive training with recursive loop closure."""

    def __init__(
        self,
        train_path: str = "train-test-validate/ML-Training",
        test_path: str = "train-test-validate/ML-Testing",
        val_path: str = "train-test-validate/ML-Validation",
    ):
        """Initialize training manager.

        Args:
            train_path: Path to training data
            test_path: Path to test data
            val_path: Path to validation data

        """
        self.train_path = Path(train_path)
        self.test_path = Path(test_path)
        self.val_path = Path(val_path)

        # Initialize ledger
        self.ledger = RecursiveLoopClosureLedger(ledger_file="training_closure_ledger.csv")

        # Initialize narrative enhancer for training data
        self.narrative_enhancer = NarrativeEnhancer()

        # Track training metrics
        self.training_metrics = {
            "iterations": 0,
            "closures": 0,
            "patterns_found": [],
            "hypotheses_tested": [],
        }

    def load_training_data(self, dataset_type: str = "open_images") -> list[dict]:
        """Load training data from files.

        Args:
            dataset_type: Type of dataset to load

        Returns:
            List of training examples

        """
        training_data = []

        # Load Open Images narratives from training folder
        if dataset_type == "open_images":
            train_files = list(self.train_path.glob("open_images_train_*.jsonl"))

            for file_path in train_files[:1]:  # Limit for demo
                logger.info(f"Loading training data from {file_path.name}")

                with open(file_path) as f:
                    for idx, line in enumerate(f):
                        if idx >= 100:  # Limit for demo
                            break
                        try:
                            data = json.loads(line)
                            training_data.append(data)
                        except json.JSONDecodeError:
                            continue

        logger.info(f"Loaded {len(training_data)} training examples")
        return training_data

    def create_training_loop(
        self, model_name: str, training_data: list[dict], epochs: int = 3
    ) -> dict[str, Any]:
        """Create an adaptive training loop with closure detection.

        Args:
            model_name: Name of the model being trained
            training_data: Training examples
            epochs: Number of training epochs

        Returns:
            Training results

        """
        results = {"model": model_name, "epochs": epochs, "loops_closed": [], "final_metrics": {}}

        for epoch in range(epochs):
            logger.info(f"Starting epoch {epoch + 1}/{epochs}")

            # Hypothesis for this epoch
            hypothesis = f"Model can learn patterns in epoch {epoch + 1}"

            # Train on data (simplified simulation)
            patterns_found = self._simulate_training(training_data, epoch)

            # Check for pattern emergence and loop closure
            if patterns_found:
                pattern = f"Found {len(patterns_found)} patterns"
                structure = f"Epoch {epoch + 1} training structure"
                explanation = f"Patterns converged with {len(patterns_found)} discoveries"

                # Attempt to close loop
                if self.ledger.detect_and_log_closure(
                    hypothesis=hypothesis,
                    pattern=pattern,
                    structure=structure,
                    explanation=explanation,
                    topic=f"Training Epoch {epoch + 1}",
                ):
                    results["loops_closed"].append({"epoch": epoch + 1, "patterns": patterns_found})
                    self.training_metrics["closures"] += 1

            self.training_metrics["iterations"] += 1

        results["final_metrics"] = self.training_metrics
        return results

    def _simulate_training(self, training_data: list[dict], epoch: int) -> list[str]:
        """Simulate training process.

        Args:
            training_data: Training examples
            epoch: Current epoch

        Returns:
            List of patterns found

        """
        patterns = []

        # Simulate pattern discovery
        for idx, data in enumerate(training_data[:10]):  # Sample
            if "caption" in data:
                # Simulate finding patterns in captions
                if epoch > 0 and idx % 3 == 0:
                    patterns.append(f"Pattern_{epoch}_{idx}")

        self.training_metrics["patterns_found"].extend(patterns)
        return patterns

    def validate_with_closure(
        self, model_name: str, validation_data: list[dict] | None = None
    ) -> dict[str, Any]:
        """Validate model with recursive closure checking.

        Args:
            model_name: Name of model to validate
            validation_data: Optional validation data

        Returns:
            Validation results

        """
        # Load validation data if not provided
        if validation_data is None:
            val_files = list(self.val_path.glob("*.jsonl"))
            validation_data = []

            for file_path in val_files[:1]:
                with open(file_path) as f:
                    for idx, line in enumerate(f):
                        if idx >= 50:  # Limit for demo
                            break
                        try:
                            validation_data.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

        # Validate and check for closure
        hypothesis = f"Model {model_name} generalizes to validation set"
        pattern = "Validation accuracy patterns"
        structure = "Validation loop structure"

        # Simulate validation metrics
        accuracy = 0.85 + (0.1 if self.training_metrics["closures"] > 0 else 0)

        if accuracy > 0.9:
            explanation = f"High validation accuracy ({accuracy:.2%}) confirms generalization"
            self.ledger.detect_and_log_closure(
                hypothesis=hypothesis,
                pattern=pattern,
                structure=structure,
                explanation=explanation,
                topic="Model Validation",
            )

        return {
            "model": model_name,
            "validation_accuracy": accuracy,
            "samples_validated": len(validation_data),
            "closure_achieved": accuracy > 0.9,
        }

    def get_training_summary(self) -> dict[str, Any]:
        """Get comprehensive training summary.

        Returns:
            Training summary with metrics and closures

        """
        return {
            "total_iterations": self.training_metrics["iterations"],
            "loops_closed": self.training_metrics["closures"],
            "patterns_discovered": len(self.training_metrics["patterns_found"]),
            "ledger": self.ledger.get_ledger_df().to_dict("records"),
            "closure_rate": (
                self.training_metrics["closures"] / self.training_metrics["iterations"]
                if self.training_metrics["iterations"] > 0
                else 0
            ),
        }


def create_enhanced_training_pipeline(
    agent_name: str, dataset_type: str = "open_images"
) -> AdaptiveTrainingManager:
    """Create an enhanced training pipeline with closure tracking.

    Args:
        agent_name: Name of the agent being trained
        dataset_type: Type of dataset to use

    Returns:
        Configured training manager

    """
    logger.info(f"Creating enhanced training pipeline for {agent_name}")

    # Initialize manager
    manager = AdaptiveTrainingManager()

    # Load initial training data
    training_data = manager.load_training_data(dataset_type)

    # Run training with closure detection
    results = manager.create_training_loop(
        model_name=agent_name, training_data=training_data, epochs=3
    )

    # Validate
    validation_results = manager.validate_with_closure(agent_name)

    logger.info(f"Training complete: {results['loops_closed']} loops closed")
    logger.info(f"Validation accuracy: {validation_results['validation_accuracy']:.2%}")

    return manager
