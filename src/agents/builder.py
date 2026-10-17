from src.agents.data_analysis_agent import DataAnalysisAgent
from src.agents.data_filtration_agent import DataFiltrationAgent
from src.agents.data_management_agent import DataManagementAgent
from src.agents.search_replace_agent import SearchReplaceAgent
from src.utils.dataset_manager import DatasetManager


class AgentBuilder:
    """Factory for building specialized agent classes, injecting dependencies.

    Usage:
        builder = AgentBuilder(dataset_root="train-test-validate")
        analysis = builder.build_data_analysis_agent()
        filtering = builder.build_data_filtration_agent()
        mgmt = builder.build_data_management_agent()
    """

    def __init__(self, dataset_root: str = "train-test-validate"):
        self.dataset_manager = DatasetManager(dataset_root)

    def build_data_analysis_agent(self):
        return DataAnalysisAgent(self.dataset_manager)

    def build_data_filtration_agent(self):
        return DataFiltrationAgent(self.dataset_manager)

    def build_data_management_agent(self):
        return DataManagementAgent(self.dataset_manager)

    def build_search_replace_agent(self):
        return SearchReplaceAgent(repo_root=str(self.dataset_manager.root))
