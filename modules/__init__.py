import os
import importlib

views = [f for f in os.listdir(os.path.dirname(os.path.abspath(__file__))) if f.endswith(".py") and f != "__init__.py"]

print("[MODULES]")
for view in views:
    importlib.import_module(os.path.basename(os.path.dirname(os.path.realpath(__file__))) + "." + view[:-3])
    print('App imported ' + view + ' successfully.')
