# backend/main.py - DEPLOYMENT READY VERSION
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import tempfile
import hashlib
from typing import List
import json

app = FastAPI()

# CORS for your frontend (update with your actual Vercel URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to your frontend URL after deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint (VERY IMPORTANT for Render)
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "DocPulse-Intelligence"}

# Simplified upload endpoint for testing
@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    results = []
    for file in files:
        # Save temporarily
        temp_path = os.path.join(tempfile.gettempdir(), file.filename)
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        
        results.append({
            "original_name": file.filename,
            "status": "uploaded",
            "size": len(content)
        })
    
    return {"uploads": results}

# Simplified chat endpoint
@app.post("/api/chat")
async def chat(query: str):
    return {
        "answer": "Deployment successful! Now integrate with your full RAG system.",
        "citations": []
    }

# Mount static frontend files
frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../frontend/out")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

