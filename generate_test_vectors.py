import json
import random

# Generate test vectors for the basic model (TinyMNIST expects input dim 16)
basic_vectors = [[round(random.uniform(-1.0, 1.0), 3) for _ in range(16)] for _ in range(5)]

with open("sample_basic_vectors.json", "w") as f:
    json.dump(basic_vectors, f, indent=2)

# Generate test vectors for the massive model (DenseNet expects input dim 64)
massive_vectors = [[round(random.uniform(-1.0, 1.0), 3) for _ in range(64)] for _ in range(5)]

with open("sample_massive_vectors.json", "w") as f:
    json.dump(massive_vectors, f, indent=2)

print("Successfully generated valid JSON test vector arrays.")
