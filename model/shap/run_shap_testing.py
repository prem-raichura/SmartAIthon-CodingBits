import json
import sys
import os

# Force matplotlib to use non-interactive Agg backend before any other matplotlib import
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
# Make plt.show a no-op so it never blocks
plt.show = lambda *args, **kwargs: None

def run_notebook(nb_path):
    print(f"Reading notebook: {nb_path}")
    with open(nb_path, "r", encoding="utf-8") as f:
        nb = json.load(f)
    
    global_env = {"__file__": nb_path}
    
    # Add containing folder (model/shap) and its parent (model) to sys.path
    shap_dir = os.path.dirname(os.path.abspath(nb_path))
    model_dir = os.path.dirname(shap_dir)
    if shap_dir not in sys.path:
        sys.path.insert(0, shap_dir)
    if model_dir not in sys.path:
        sys.path.insert(0, model_dir)
    
    # We will execute code cells sequentially
    cell_idx = 0
    for cell in nb.get("cells", []):
        if cell.get("cell_type") == "code":
            cell_idx += 1
            source_lines = cell.get("source", [])
            # Filter magic commands
            cleaned_source = []
            for line in source_lines:
                stripped = line.strip()
                if stripped.startswith("%") or stripped.startswith("!"):
                    print(f"Skipping magic line: {line.strip()}")
                    continue
                cleaned_source.append(line)
            
            code = "".join(cleaned_source)
            if not code.strip():
                continue
                
            print(f"\n--- Running Cell {cell_idx} ---")
            sys.stdout.flush()
            try:
                exec(code, global_env)
            except Exception as e:
                print(f"Error in Cell {cell_idx}: {e}")
                import traceback
                traceback.print_exc()
                sys.stdout.flush()

if __name__ == "__main__":
    # Find notebook in the same directory as this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    notebook_path = os.path.join(script_dir, "shap_testing.ipynb")
    run_notebook(notebook_path)
