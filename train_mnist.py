"""SYNAPSE v3.0: MNIST Digit Classifier Training Script

Trains a neural network on sklearn's 8x8 digit dataset and exports:
  - mnist_model.pt      (PyTorch state_dict)
  - mnist_test_vectors.json (3 random test images, flattened to 64-d arrays)
"""
import torch
import torch.nn as nn
import torch.optim as optim
import json
import numpy as np
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

def main():
    torch.manual_seed(42)
    np.random.seed(42)

    # ── Load 8x8 digit images (1797 samples, 64 features, 10 classes) ──
    digits = load_digits()
    X, y = digits.data, digits.target  # X: (1797, 64), y: (1797,)

    # Normalize pixel values to [-1, 1] range for analog voltage compatibility
    scaler = StandardScaler()
    X = scaler.fit_transform(X)
    X = np.clip(X, -1.0, 1.0)  # Clamp to analog voltage rail limits

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Convert to tensors
    X_train_t = torch.tensor(X_train, dtype=torch.float32)
    y_train_t = torch.tensor(y_train, dtype=torch.long)
    X_test_t = torch.tensor(X_test, dtype=torch.float32)
    y_test_t = torch.tensor(y_test, dtype=torch.long)

    # ── Build model: 64 → 32 (ReLU) → 10 ──
    model = nn.Sequential(
        nn.Linear(64, 32),
        nn.ReLU(),
        nn.Linear(32, 10)
    )

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.01)

    # ── Train for 100 epochs ──
    print("Training MNIST digit classifier...")
    print(f"  Architecture: Linear(64->32) -> ReLU -> Linear(32->10)")
    print(f"  Training samples: {len(X_train)}")
    print(f"  Test samples:     {len(X_test)}")
    print()

    for epoch in range(100):
        model.train()
        optimizer.zero_grad()
        logits = model(X_train_t)
        loss = criterion(logits, y_train_t)
        loss.backward()
        optimizer.step()

        if (epoch + 1) % 20 == 0:
            model.eval()
            with torch.no_grad():
                test_logits = model(X_test_t)
                preds = test_logits.argmax(dim=1)
                acc = (preds == y_test_t).float().mean().item() * 100
            print(f"  Epoch {epoch+1:3d}/100  |  Loss: {loss.item():.4f}  |  Test Acc: {acc:.1f}%")

    # ── Final evaluation ──
    model.eval()
    with torch.no_grad():
        test_logits = model(X_test_t)
        preds = test_logits.argmax(dim=1)
        final_acc = (preds == y_test_t).float().mean().item() * 100
    print(f"\n  Final Test Accuracy: {final_acc:.1f}%")

    # ── Pick 3 random test images ──
    rng = np.random.RandomState(123)
    indices = rng.choice(len(X_test), size=3, replace=False)

    test_vectors = []
    print(f"\n  Selected test images (indices {indices.tolist()}):")
    for i, idx in enumerate(indices):
        vec = X_test[idx].tolist()
        true_label = int(y_test[idx])
        with torch.no_grad():
            pred_logits = model(torch.tensor([vec], dtype=torch.float32))
            pred_label = pred_logits.argmax(dim=1).item()
        print(f"    Image {i}: true_label={true_label}, predicted={pred_label}")
        test_vectors.append(vec)

    # ── Save artifacts ──
    with open("mnist_test_vectors.json", "w") as f:
        json.dump(test_vectors, f)
    print(f"\n  Saved mnist_test_vectors.json ({len(test_vectors)} vectors, {len(test_vectors[0])} features each)")

    torch.save(model.state_dict(), "mnist_model.pt")
    print("  Saved mnist_model.pt")

    # ── Print scale summary ──
    sd = model.state_dict()
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n  -- Circuit Scale --")
    print(f"  Total parameters:  {total_params}")
    print(f"  Input voltage rails:   64")
    print(f"  Hidden rectifiers:     32")
    print(f"  Output classifiers:    10")
    print(f"  Estimated IR nodes:    ~{64 + 32*2 + 32 + 10*2 + 10 + 3}")
    print(f"  Estimated IR edges:    ~{64*32*2 + 32 + 32*10*2 + 10}")

if __name__ == "__main__":
    main()
