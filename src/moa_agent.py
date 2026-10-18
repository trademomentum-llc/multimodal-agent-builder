import secrets
from typing import Any, Protocol


class ResponseGenerator(Protocol):
    def generate_response(self, prompt: str) -> Any: ...


class MOAAgent:
    def __init__(self, llm: ResponseGenerator) -> None:
        self.llm = llm

    def interact(self, user_context: Any, medical_data: str) -> tuple[Any, dict[str, str], str]:
        moa_state = self.estimate_moa(user_context, medical_data)
        prompt = self.build_prompt(medical_data, moa_state)
        response = self.llm.generate_response(prompt)
        return response, moa_state, self.explain_moa(moa_state)

    def estimate_moa(self, user_context: Any, medical_data: str) -> dict[str, str]:
        # Placeholder logic—replace with scoring models
        return {
            "motivation": secrets.choice(["high", "medium", "low"]),
            "opportunity": secrets.choice(["present", "missing"]),
            "ability": secrets.choice(["high", "medium", "low"]),
        }

    def build_prompt(self, medical_data: str, moa_state: dict[str, str]) -> str:
        return (
            f"{medical_data}\n\n"
            f"[Motivation: {moa_state['motivation']} "
            f"Opportunity: {moa_state['opportunity']} "
            f"Ability: {moa_state['ability']}]"
        )

    def explain_moa(self, moa_state: dict[str, str]) -> str:
        return (
            f"Motivation: {moa_state['motivation']} | "
            f"Opportunity: {moa_state['opportunity']} | "
            f"Ability: {moa_state['ability']}"
        )
