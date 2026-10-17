"""Utilities for integrating Localized Narratives for enhanced image understanding."""

# Postpone annotation evaluation: LocalizedNarrative may be None when the optional
# localized_narratives package is unavailable.
from __future__ import annotations

import json
import sys
from pathlib import Path

# Add localized-narratives to path
project_root = Path(__file__).parent.parent.parent
ln_path = project_root / "localized-narratives"
sys.path.insert(0, str(ln_path))

try:
    from localized_narratives import DataLoader, LocalizedNarrative
except ImportError:
    print("Warning: Could not import localized_narratives module")
    DataLoader = None
    LocalizedNarrative = None


class NarrativeEnhancer:
    """Enhances image understanding using Localized Narratives dataset."""

    def __init__(self, data_dir: str | None = None):
        """Initialize the Narrative Enhancer.

        Args:
            data_dir: Directory for storing narrative data

        """
        if data_dir is None:
            data_dir = str(project_root / "data" / "narratives")

        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.loader = DataLoader(str(self.data_dir)) if DataLoader else None
        self._narrative_cache = {}

    def download_narratives(self, dataset: str = "coco_val"):
        """Download narrative annotations for a dataset.

        Args:
            dataset: Dataset to download (e.g., 'coco_train', 'coco_val',
                    'open_images_train', 'flickr30k_train')

        """
        if not self.loader:
            raise ImportError("Localized Narratives module not available")

        print(f"Downloading {dataset} narratives...")
        self.loader.download_annotations(dataset)
        print(f"Downloaded {dataset} narratives to {self.data_dir}")

    def load_narratives(
        self, dataset: str = "coco_val", max_narratives: int = 100
    ) -> list[LocalizedNarrative]:
        """Load narrative annotations from local files.

        Args:
            dataset: Dataset to load
            max_narratives: Maximum number of narratives to load

        Returns:
            List of LocalizedNarrative objects

        """
        if not self.loader:
            raise ImportError("Localized Narratives module not available")

        narratives = []
        for narrative in self.loader.load_annotations(dataset, max_narratives):
            narratives.append(narrative)
            # Cache by image_id
            self._narrative_cache[narrative.image_id] = narrative

        return narratives

    def get_narrative_for_image(self, image_id: str) -> LocalizedNarrative | None:
        """Get narrative for a specific image ID.

        Args:
            image_id: Image identifier

        Returns:
            LocalizedNarrative object or None

        """
        return self._narrative_cache.get(image_id)

    def extract_image_description(self, narrative: LocalizedNarrative) -> dict:
        """Extract structured description from a narrative.

        Args:
            narrative: LocalizedNarrative object

        Returns:
            Dictionary with structured description

        """
        return {
            "image_id": narrative.image_id,
            "caption": narrative.caption,
            "timed_words": [
                {
                    "text": utterance.utterance,
                    "start_time": utterance.start_time,
                    "end_time": utterance.end_time,
                }
                for utterance in narrative.timed_caption
            ],
            "trace_points": len(narrative.traces),
            "dataset": narrative.dataset_id,
            "voice_url": narrative.voice_recording_url
            if hasattr(narrative, "voice_recording_url")
            else None,
        }

    def generate_training_prompt(
        self, narrative: LocalizedNarrative, task: str = "describe"
    ) -> str:
        """Generate a training prompt from a narrative.

        Args:
            narrative: LocalizedNarrative object
            task: Type of prompt ('describe', 'locate', 'analyze')

        Returns:
            Training prompt string

        """
        if task == "describe":
            return f"Describe this image in detail: {narrative.caption}"

        elif task == "locate":
            # Extract key objects from caption
            words = narrative.caption.lower().split()
            objects = [w for w in words if len(w) > 4][:5]  # Simple heuristic
            return f"Locate these objects in the image: {', '.join(objects)}"

        elif task == "analyze":
            return (
                f"Analyze this image considering the following description: "
                f"{narrative.caption[:100]}... What details can you add?"
            )

        else:
            return narrative.caption

    def create_multimodal_training_data(
        self, narratives: list[LocalizedNarrative], output_file: str
    ):
        """Create training data for multimodal models.

        Args:
            narratives: List of narratives
            output_file: Output JSON file path

        """
        training_data = []

        for narrative in narratives:
            data_point = {
                "image_id": narrative.image_id,
                "dataset": narrative.dataset_id,
                "prompts": {
                    "describe": self.generate_training_prompt(narrative, "describe"),
                    "locate": self.generate_training_prompt(narrative, "locate"),
                    "analyze": self.generate_training_prompt(narrative, "analyze"),
                },
                "ground_truth": narrative.caption,
                "temporal_annotations": [
                    {"text": u.utterance, "start": u.start_time, "end": u.end_time}
                    for u in narrative.timed_caption
                ],
                "spatial_traces": {
                    "num_traces": len(narrative.traces),
                    "total_points": sum(len(trace) for trace in narrative.traces),
                },
            }
            training_data.append(data_point)

        # Save to file
        with open(output_file, "w") as f:
            json.dump(training_data, f, indent=2)

        print(f"Created training data with {len(training_data)} examples")
        return training_data

    def enhance_image_caption(
        self, basic_caption: str, narrative: LocalizedNarrative | None = None
    ) -> str:
        """Enhance a basic caption using narrative data.

        Args:
            basic_caption: Basic image caption
            narrative: Optional narrative for enhancement

        Returns:
            Enhanced caption

        """
        if not narrative:
            return basic_caption

        # Combine basic caption with narrative insights
        enhanced = f"{basic_caption} "

        # Add temporal information
        if narrative.timed_caption:
            key_phrases = [u.utterance for u in narrative.timed_caption[:3]]
            enhanced += f"Key details: {', '.join(key_phrases)}. "

        # Add spatial information
        if narrative.traces:
            enhanced += f"The description covers {len(narrative.traces)} main areas of interest. "

        return enhanced.strip()


def create_narrative_enhanced_agent_prompt(
    image_id: str, task: str, enhancer: NarrativeEnhancer
) -> str:
    """Create an enhanced prompt using narrative data.

    Args:
        image_id: Image identifier
        task: Task description
        enhancer: NarrativeEnhancer instance

    Returns:
        Enhanced prompt string

    """
    narrative = enhancer.get_narrative_for_image(image_id)

    if not narrative:
        return task

    description = enhancer.extract_image_description(narrative)

    prompt = f"""Task: {task}

Based on detailed analysis, this image contains: {description["caption"][:200]}...

Key temporal elements detected at:
"""

    for timed in description["timed_words"][:3]:
        prompt += f"- {timed['text']} (timing: {timed['start_time']:.1f}s)\n"

    prompt += f"\nSpatial analysis shows {description['trace_points']} areas of interest."

    return prompt
