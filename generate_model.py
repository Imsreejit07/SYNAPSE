import torch
import torch.nn as nn
import json

def main():
    # Set seed for reproducibility
    torch.manual_seed(42)

    # Define a sequential model with ReLU: 2 inputs -> 4 hidden (ReLU) -> 2 outputs
    model = nn.Sequential(
        nn.Linear(2, 4),
        nn.ReLU(),
        nn.Linear(4, 2)
    )

    # Generate 3 random floating point test vectors of shape [3, 2]
    # Input range [-1.0, 1.0]
    test_vectors = (torch.rand(3, 2) * 2) - 1.0

    print("Test vectors:")
    print(test_vectors)

    # Run forward pass (outputs now go through ReLU)
    with torch.no_grad():
        outputs = model(test_vectors)

    print("\nExpected outputs (with ReLU):")
    print(outputs)

    # Save test vectors to JSON
    vectors_list = test_vectors.tolist()
    with open("test_vectors.json", "w") as f:
        json.dump(vectors_list, f, indent=2)
    print("\nSaved test_vectors.json")

    # Save model state_dict
    torch.save(model.state_dict(), "model.pt")
    print("Saved model.pt")

if __name__ == "__main__":
    main()
