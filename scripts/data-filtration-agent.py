#!/usr/bin/env python
# coding: utf-8

# In[ ]:


filtration_agent = builder.build_data_filtration_agent()

# Filter outliers/duplicates, currently just lists files
filtered = filtration_agent.filter_split("validation")
print("Filtered (placeholder):", [str(f) for f in filtered])

