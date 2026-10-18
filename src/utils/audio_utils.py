"""Audio processing utilities for multimodal agents."""

import io
from pathlib import Path
from typing import Any

try:
    from pydub import AudioSegment
    from pydub.silence import detect_nonsilent

    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False
    AudioSegment = type("AudioSegment", (), {})  # Create dummy class for type hints
    print("Warning: pydub not available. Audio processing will be limited.")


class AudioProcessor:
    """Utility class for audio processing operations."""

    SUPPORTED_FORMATS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma"}
    DEFAULT_SAMPLE_RATE = 16000  # 16kHz for speech

    def __init__(self) -> None:
        """Initialize audio processor."""
        if not PYDUB_AVAILABLE:
            raise ImportError(
                "pydub is required for audio processing. Install with: pip install pydub"
            )

    @staticmethod
    def load_audio(audio_input: str | bytes | AudioSegment) -> AudioSegment:
        """Load audio from various input types.

        Args:
            audio_input: Audio as path, bytes, or AudioSegment

        Returns:
            AudioSegment object

        """
        if isinstance(audio_input, str):
            # File path
            path = Path(audio_input)
            if not path.exists():
                raise FileNotFoundError(f"Audio file not found: {audio_input}")
            if path.suffix.lower() not in AudioProcessor.SUPPORTED_FORMATS:
                raise ValueError(f"Unsupported audio format: {path.suffix}")

            # Detect format from extension
            format = path.suffix[1:].lower()
            if format == "m4a":
                format = "mp4"
            return AudioSegment.from_file(str(path), format=format)

        elif isinstance(audio_input, bytes):
            # Bytes
            return AudioSegment.from_file(io.BytesIO(audio_input))

        elif isinstance(audio_input, AudioSegment):
            # Already an AudioSegment
            return audio_input

        else:
            raise ValueError(f"Unsupported audio input type: {type(audio_input)}")

    @staticmethod
    def convert_format(audio: AudioSegment, output_format: str = "wav") -> bytes:
        """Convert audio to a different format.

        Args:
            audio: AudioSegment to convert
            output_format: Target format

        Returns:
            Converted audio as bytes

        """
        buffer = io.BytesIO()
        audio.export(buffer, format=output_format)
        return buffer.getvalue()

    @staticmethod
    def resample(audio: AudioSegment, sample_rate: int = 16000) -> AudioSegment:
        """Resample audio to a different sample rate.

        Args:
            audio: AudioSegment to resample
            sample_rate: Target sample rate in Hz

        Returns:
            Resampled AudioSegment

        """
        return audio.set_frame_rate(sample_rate)

    @staticmethod
    def normalize(audio: AudioSegment, target_dbfs: float = -20.0) -> AudioSegment:
        """Normalize audio volume.

        Args:
            audio: AudioSegment to normalize
            target_dbfs: Target volume in dBFS

        Returns:
            Normalized AudioSegment

        """
        change_in_dbfs = target_dbfs - audio.dBFS
        return audio.apply_gain(change_in_dbfs)

    @staticmethod
    def trim_silence(
        audio: AudioSegment,
        silence_thresh: int = -40,
        min_silence_len: int = 1000,
        keep_silence: int = 100,
    ) -> AudioSegment:
        """Remove silence from beginning and end of audio.

        Args:
            audio: AudioSegment to trim
            silence_thresh: Silence threshold in dBFS
            min_silence_len: Minimum length of silence in ms
            keep_silence: Amount of silence to keep at boundaries in ms

        Returns:
            Trimmed AudioSegment

        """
        nonsilent_ranges = detect_nonsilent(
            audio, min_silence_len=min_silence_len, silence_thresh=silence_thresh
        )

        if not nonsilent_ranges:
            return audio

        start_trim = max(0, nonsilent_ranges[0][0] - keep_silence)
        end_trim = min(len(audio), nonsilent_ranges[-1][1] + keep_silence)

        return audio[start_trim:end_trim]

    @staticmethod
    def split_on_silence(
        audio: AudioSegment,
        min_silence_len: int = 500,
        silence_thresh: int = -40,
        keep_silence: int = 200,
    ) -> list[AudioSegment]:
        """Split audio on silence.

        Args:
            audio: AudioSegment to split
            min_silence_len: Minimum length of silence for split in ms
            silence_thresh: Silence threshold in dBFS
            keep_silence: Amount of silence to keep at boundaries in ms

        Returns:
            List of AudioSegment chunks

        """
        chunks = []
        nonsilent_ranges = detect_nonsilent(
            audio, min_silence_len=min_silence_len, silence_thresh=silence_thresh
        )

        for start_i, end_i in nonsilent_ranges:
            start_i = max(0, start_i - keep_silence)
            end_i = min(len(audio), end_i + keep_silence)
            chunks.append(audio[start_i:end_i])

        return chunks

    @staticmethod
    def get_audio_info(audio: AudioSegment) -> dict[str, Any]:
        """Get audio metadata.

        Args:
            audio: AudioSegment

        Returns:
            Dictionary of audio information

        """
        return {
            "duration_seconds": len(audio) / 1000.0,
            "sample_rate": audio.frame_rate,
            "channels": audio.channels,
            "sample_width": audio.sample_width,
            "frame_count": audio.frame_count(),
            "max_dBFS": audio.max_dBFS,
            "rms": audio.rms,
            "dBFS": audio.dBFS,
        }

    @staticmethod
    def prepare_for_speech(
        audio: AudioSegment,
        target_sample_rate: int = 16000,
        mono: bool = True,
        normalize_volume: bool = True,
    ) -> AudioSegment:
        """Prepare audio for speech recognition.

        Args:
            audio: AudioSegment to prepare
            target_sample_rate: Target sample rate
            mono: Convert to mono
            normalize_volume: Normalize volume

        Returns:
            Prepared AudioSegment

        """
        # Convert to mono if needed
        if mono and audio.channels > 1:
            audio = audio.set_channels(1)

        # Resample
        if audio.frame_rate != target_sample_rate:
            audio = audio.set_frame_rate(target_sample_rate)

        # Normalize volume
        if normalize_volume:
            audio = AudioProcessor.normalize(audio, target_dbfs=-20.0)

        # Trim silence
        audio = AudioProcessor.trim_silence(audio)

        return audio

    @staticmethod
    def chunk_audio(
        audio: AudioSegment, chunk_length_ms: int = 30000, overlap_ms: int = 1000
    ) -> list[AudioSegment]:
        """Split audio into overlapping chunks.

        Args:
            audio: AudioSegment to chunk
            chunk_length_ms: Length of each chunk in ms
            overlap_ms: Overlap between chunks in ms

        Returns:
            List of AudioSegment chunks

        """
        chunks = []
        start = 0

        while start < len(audio):
            end = min(start + chunk_length_ms, len(audio))
            chunks.append(audio[start:end])
            start += chunk_length_ms - overlap_ms

            if start >= len(audio):
                break

        return chunks


# Integration with Google Speech-to-Text (from localized-narratives)
def prepare_for_google_speech(audio_path: str, output_path: str | None = None) -> str:
    """Prepare audio for Google Speech-to-Text API.

    Args:
        audio_path: Path to input audio file
        output_path: Optional output path

    Returns:
        Path to prepared audio file

    """
    if not PYDUB_AVAILABLE:
        raise ImportError("pydub required for audio conversion")

    # Load audio
    audio = AudioSegment.from_file(audio_path)

    # Convert to format supported by Google
    # Google supports OGG Opus but not Vorbis
    if output_path is None:
        base_path = Path(audio_path).stem
        output_path = f"{base_path}_prepared.ogg"

    # Export as OGG Opus
    audio.export(output_path, format="ogg", codec="libopus")

    return output_path


# Convenience functions
def load_and_prepare_audio(audio_path: str, for_speech: bool = True) -> AudioSegment:
    """Load and prepare audio file.

    Args:
        audio_path: Path to audio file
        for_speech: Prepare for speech recognition

    Returns:
        Prepared AudioSegment

    """
    processor = AudioProcessor()
    audio = processor.load_audio(audio_path)

    if for_speech:
        audio = processor.prepare_for_speech(audio)

    return audio


def audio_to_wav_bytes(audio_path: str) -> bytes:
    """Convert audio file to WAV bytes.

    Args:
        audio_path: Path to audio file

    Returns:
        WAV audio as bytes

    """
    processor = AudioProcessor()
    audio = processor.load_audio(audio_path)
    return processor.convert_format(audio, "wav")


def validate_audio(audio_path: str) -> bool:
    """Validate if a file is supported audio.

    Args:
        audio_path: Path to file

    Returns:
        True if valid audio, False otherwise

    """
    try:
        path = Path(audio_path)
        if not path.exists():
            return False
        if path.suffix.lower() not in AudioProcessor.SUPPORTED_FORMATS:
            return False

        # Try to load the audio
        if PYDUB_AVAILABLE:
            AudioSegment.from_file(str(path))
        return True
    except Exception:
        return False
