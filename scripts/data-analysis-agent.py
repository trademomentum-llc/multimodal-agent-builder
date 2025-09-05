#!/usr/bin/env python
# coding: utf-8

# In[ ]:


# Get an analysis agent
analysis_agent = builder.build_data_analysis_agent()

# Analyze the "train" split
analysis_report = analysis_agent.analyze_split("train")
print(f"Files in training split: {analysis_report['num_files']}")
for path in analysis_report['files']:
    print(" -", path)

