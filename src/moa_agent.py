import random

class MOAAgent:
    def __init__(self, llm):
        self.llm = llm
    def interact(self, user_context, medical_data):
        moa_state = self.estimate_moa(user_context, medical_data)
        prompt = self.build_prompt(medical_data, moa_state)
        response = self.llm.generate_response(prompt)
        return response, moa_state, self.explain_moa(moa_state)
    def estimate_moa(self, user_context, medical_data):
        # Placeholder logic—replace with scoring models
        return {
            "motivation": random.choice(["high", "medium", "low"]),
            "opportunity": random.choice(["present", "missing"]),
            "ability": random.choice(["high", "medium", "low"]),
        }
    def build_prompt(self, medical_data, moa_state):
        return f"{medical_data}\n\n[Motivation: {moa_state['motivation']} Opportunity: {moa_state['opportunity']} Ability: {moa_state['ability']}]"
    def explain_moa(self, moa_state):
        return (
            f"Motivation: {moa_state['motivation']} | "
            f"Opportunity: {moa_state['opportunity']} | "
            f"Ability: {moa_state['ability']}"
        )

