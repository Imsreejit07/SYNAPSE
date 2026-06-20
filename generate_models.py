import torch
import torch.nn as nn

if __name__ == "__main__":
    # The SYNAPSE compiler expects pure nn.Sequential state_dicts 
    # where the keys start with digits (e.g., '0.weight', '2.weight')
    
    # Basic Model (TinyMNIST)
    basic_model = nn.Sequential(
        nn.Linear(16, 64),
        nn.ReLU(),
        nn.Linear(64, 32),
        nn.ReLU(),
        nn.Linear(32, 10)
    )
    
    # Fill with random weights for visualization
    for param in basic_model.parameters():
        nn.init.uniform_(param, -1.0, 1.0)
        
    torch.save(basic_model.state_dict(), "sample_basic_model.pt")
    print("Generated sample_basic_model.pt with Sequential layers.")
    
    # Massive Model (DenseNet)
    massive_model = nn.Sequential(
        nn.Linear(64, 128),
        nn.ReLU(),
        nn.Linear(128, 64)
    )
    
    for param in massive_model.parameters():
        nn.init.uniform_(param, -1.0, 1.0)
        
    torch.save(massive_model.state_dict(), "sample_massive_model.pt")
    print("Generated sample_massive_model.pt with massive connections.")
