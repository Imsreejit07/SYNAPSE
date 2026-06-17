from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
import torch
import json
import io
import os
from dataclasses import asdict

from synapse_compiler import SynapseCompiler, CompilationError, ModelValidationError

app = FastAPI(title="SYNAPSE Backend v4.0", default_response_class=ORJSONResponse)

# CORS: allow configurable origins via env var, default to wildcard for production
_cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reuse a single compiler instance across requests
_compiler = SynapseCompiler()

@app.post("/compile")
async def compile_model(
    model_file: UploadFile = File(...),
    test_vectors: str = Form(...)
):
    try:
        # Load the PyTorch state_dict from uploaded bytes
        content = await model_file.read()
        buffer = io.BytesIO(content)
        
        # We use map_location="cpu" to ensure it works without GPU
        state_dict = torch.load(buffer, map_location="cpu", weights_only=False)
        
        # If the saved object has a nested state_dict (not the case in our generator, but good practice)
        if isinstance(state_dict, dict) and "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]

        # Parse test vectors JSON string
        vectors = json.loads(test_vectors)
        if not isinstance(vectors, list):
            raise ValueError("Test vectors must be a JSON array.")

        # Run compilation
        result = _compiler.compile_state_dict(state_dict, vectors)

        # Build response — pre-compute dicts to avoid serialization overhead
        ir_dict = result.ir.to_dict()
        validation_dict = asdict(result.validation)

        return {
            "ir": ir_dict,
            "netlist": result.netlist,
            "validation": validation_dict,
            "stats": {
                "total_nodes": len(ir_dict["nodes"]),
                "total_edges": len(ir_dict["edges"]),
                "layers": ir_dict["metadata"].get("layers", 0),
            }
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in test_vectors")
    except (CompilationError, ModelValidationError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
