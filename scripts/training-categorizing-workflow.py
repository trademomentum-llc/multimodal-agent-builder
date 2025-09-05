#!/usr/bin/env python
# coding: utf-8

# In[ ]:


mgmt = builder.build_data_management_agent()
mgmt.reassemble_split(kind="all")

filtration = builder.build_data_filtration_agent()
filtered_train = filtration.filter_split("train")

analysis = builder.build_data_analysis_agent()
print("Analysis of filtered train set:", analysis.analyze_split("train"))

