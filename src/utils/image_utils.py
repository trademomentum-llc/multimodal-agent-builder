"""Image processing utilities with Localized Narratives integration."""

import base64
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from src.utils.logging_utils import handle_exception, logger
from src.utils.narrative_utils import NarrativeEnhancer


class ImageProcessor:
    """Advanced image processing with narrative enhancement."""

    SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff"}
    MAX_SIZE = (1920, 1080)

    def __init__(self, enable_narratives: bool = False):
        """Initialize image processor.

        Args:
            enable_narratives: Enable Localized Narratives enhancement

        """
        self.narrative_enhancer = None
        if enable_narratives:
            try:
                self.narrative_enhancer = NarrativeEnhancer()
                logger.info("Initialized with Localized Narratives support")
            except Exception as e:
                logger.warning(f"Could not initialize narrative enhancer: {e}")

    @staticmethod
    def load_image(image_input: str | bytes | Image.Image | np.ndarray) -> Image.Image:
        """Load image from various input types."""
        try:
            if isinstance(image_input, str):
                path = Path(image_input)
                if not path.exists():
                    raise FileNotFoundError(f"Image file not found: {image_input}")
                if path.suffix.lower() not in ImageProcessor.SUPPORTED_FORMATS:
                    raise ValueError(f"Unsupported image format: {path.suffix}")
                return Image.open(path)

            elif isinstance(image_input, bytes):
                return Image.open(io.BytesIO(image_input))

            elif isinstance(image_input, Image.Image):
                return image_input

            elif isinstance(image_input, np.ndarray):
                return Image.fromarray(image_input.astype("uint8"))

            else:
                raise ValueError(f"Unsupported image input type: {type(image_input)}")

        except Exception as e:
            handle_exception(e, {"input_type": type(image_input).__name__})
            raise

    @staticmethod
    def resize_image(
        image: Image.Image,
        max_size: tuple[int, int] | None = None,
        maintain_aspect_ratio: bool = True,
    ) -> Image.Image:
        """Resize image to fit within max dimensions."""
        if max_size is None:
            max_size = ImageProcessor.MAX_SIZE

        if maintain_aspect_ratio:
            image.thumbnail(max_size, Image.Resampling.LANCZOS)
            return image
        else:
            return image.resize(max_size, Image.Resampling.LANCZOS)

    @staticmethod
    def optimize_for_api(
        image: Image.Image,
        max_size: tuple[int, int] | None = None,
        quality: int = 85,
        format: str = "JPEG",
    ) -> bytes:
        """Optimize image for API transmission."""
        if max_size:
            image = ImageProcessor.resize_image(image, max_size)

        # Convert RGBA to RGB if saving as JPEG
        if format.upper() == "JPEG" and image.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            background.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
            image = background

        buffer = io.BytesIO()
        image.save(buffer, format=format, quality=quality, optimize=True)

        logger.debug(f"Optimized image: format={format}, size={image.size}, quality={quality}")

        return buffer.getvalue()

    @staticmethod
    def to_base64(
        image: Image.Image | bytes, format: str = "JPEG", add_data_url: bool = True
    ) -> str:
        """Convert image to base64 string."""
        if isinstance(image, Image.Image):
            buffer = io.BytesIO()
            image.save(buffer, format=format)
            image_bytes = buffer.getvalue()
        else:
            image_bytes = image

        base64_str = base64.b64encode(image_bytes).decode("utf-8")

        if add_data_url:
            mime_type = f"image/{format.lower()}"
            return f"data:{mime_type};base64,{base64_str}"

        return base64_str

    @staticmethod
    def from_base64(base64_str: str) -> Image.Image:
        """Load image from base64 string."""
        if base64_str.startswith("data:"):
            base64_str = base64_str.split(",")[1]

        image_bytes = base64.b64decode(base64_str)
        return Image.open(io.BytesIO(image_bytes))

    def analyze_with_narratives(
        self, image: str | Image.Image, image_id: str | None = None
    ) -> dict:
        """Analyze image with narrative enhancement if available.

        Args:
            image: Image to analyze
            image_id: Optional image ID for narrative lookup

        Returns:
            Analysis results

        """
        # Load image if path
        if isinstance(image, str):
            img = self.load_image(image)
            if not image_id:
                image_id = Path(image).stem
        else:
            img = image

        # Basic analysis
        analysis = {
            "size": img.size,
            "mode": img.mode,
            "format": img.format,
            "width": img.width,
            "height": img.height,
        }

        # Add narrative enhancement if available
        if self.narrative_enhancer and image_id:
            narrative = self.narrative_enhancer.get_narrative_for_image(image_id)
            if narrative:
                analysis["narrative"] = self.narrative_enhancer.extract_image_description(narrative)
                analysis["enhanced_caption"] = self.narrative_enhancer.enhance_image_caption(
                    f"Image {image_id}", narrative
                )
                logger.info(f"Added narrative enhancement for image {image_id}")

        return analysis

    @staticmethod
    def create_thumbnail(image: Image.Image, size: tuple[int, int] = (256, 256)) -> Image.Image:
        """Create a thumbnail of the image."""
        thumbnail = image.copy()
        thumbnail.thumbnail(size, Image.Resampling.LANCZOS)
        return thumbnail

    @staticmethod
    def apply_transforms(
        image: Image.Image,
        rotate: int | None = None,
        flip_horizontal: bool = False,
        flip_vertical: bool = False,
        brightness: float | None = None,
        contrast: float | None = None,
        blur: float | None = None,
        sharpen: bool = False,
    ) -> Image.Image:
        """Apply various transformations to an image."""
        result = image.copy()

        if rotate:
            result = result.rotate(rotate, expand=True)

        if flip_horizontal:
            result = ImageOps.mirror(result)
        if flip_vertical:
            result = ImageOps.flip(result)

        if brightness is not None:
            enhancer = ImageEnhance.Brightness(result)
            result = enhancer.enhance(brightness)

        if contrast is not None:
            enhancer = ImageEnhance.Contrast(result)
            result = enhancer.enhance(contrast)

        if blur:
            result = result.filter(ImageFilter.GaussianBlur(radius=blur))

        if sharpen:
            result = result.filter(ImageFilter.SHARPEN)

        return result

    @staticmethod
    def extract_metadata(image: Image.Image) -> dict:
        """Extract comprehensive image metadata."""
        metadata = {
            "format": image.format,
            "mode": image.mode,
            "size": image.size,
            "width": image.width,
            "height": image.height,
            "info": image.info,
        }

        # Add EXIF data if available
        if hasattr(image, "_getexif") and image._getexif():
            from PIL.ExifTags import TAGS

            exif_data = {}
            for tag_id, value in image._getexif().items():
                tag = TAGS.get(tag_id, tag_id)
                exif_data[tag] = value
            metadata["exif"] = exif_data

        return metadata

    @staticmethod
    def prepare_for_ocr(image: Image.Image) -> Image.Image:
        """Prepare image for OCR processing."""
        # Convert to grayscale
        if image.mode != "L":
            image = image.convert("L")

        # Enhance contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)

        # Apply slight sharpening
        image = image.filter(ImageFilter.SHARPEN)

        return image

    def batch_process(self, images: list, operation: callable, **kwargs) -> list:
        """Apply an operation to multiple images."""
        results = []
        for idx, img_input in enumerate(images):
            try:
                img = self.load_image(img_input)
                processed = operation(img, **kwargs)
                results.append(processed)
                logger.debug(f"Processed image {idx + 1}/{len(images)}")
            except Exception as e:
                logger.error(f"Error processing image {idx}: {e}")
                results.append(None)

        return results


# Convenience functions
def load_and_optimize(image_path: str, max_size: tuple[int, int] | None = None) -> bytes:
    """Load and optimize an image for API use."""
    processor = ImageProcessor()
    image = processor.load_image(image_path)
    return processor.optimize_for_api(image, max_size)


def image_to_base64(image_path: str) -> str:
    """Convert image file to base64."""
    processor = ImageProcessor()
    image = processor.load_image(image_path)
    return processor.to_base64(image)


def validate_image(image_path: str) -> bool:
    """Validate if a file is a supported image."""
    try:
        path = Path(image_path)
        if not path.exists():
            return False
        if path.suffix.lower() not in ImageProcessor.SUPPORTED_FORMATS:
            return False

        Image.open(path).verify()
        return True
    except:
        return False


def create_enhanced_processor() -> ImageProcessor:
    """Create an image processor with narrative enhancement."""
    return ImageProcessor(enable_narratives=True)
