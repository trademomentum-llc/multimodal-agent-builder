#!/usr/bin/env python
# coding: utf-8

# In[ ]:


management_agent = builder.build_data_management_agent()

# Reassemble the testing split, dry run, verbose logging
result = management_agent.reassemble_split(kind="testing", dry_run=True, verbose=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)

