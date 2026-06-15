# backend/main.py - DEPLOYMENT READY VERSION
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import tempfile
import uuid
from typing import List

app = FastAPI()

# CORS for your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory document database simulation
documents_db = [
    {
        "task_id": "mock-invoice-1",
        "status": "completed",
        "filename": "invoice_june.pdf",
        "classification": {
            "document_type": "Invoice",
            "sensitivity": "Confidential",
            "has_tables": True,
            "topics": ["finance", "invoice", "june"]
        },
        "parsed_data": {
            "total_pages": 3
        }
    },
    {
        "task_id": "mock-report-1",
        "status": "completed",
        "filename": "quarterly_report.docx",
        "classification": {
            "document_type": "Report",
            "sensitivity": "Public",
            "has_tables": False,
            "topics": ["corporate", "quarterly"]
        },
        "parsed_data": {
            "total_pages": 12
        }
    }
]

# Health check endpoint (VERY IMPORTANT for Render)
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "DocPulse-Intelligence"}

# Fetch all documents
@app.get("/api/documents")
def get_documents():
    return documents_db

# Check status of specific ingestion task
@app.get("/status/{task_id}")
def get_status(task_id: str):
    for doc in documents_db:
        if doc["task_id"] == task_id:
            return {"status": doc["status"], "filename": doc["filename"]}
    raise HTTPException(status_code=404, detail="Task not found")

# Upload endpoint (fixed parameter name to match frontend append)
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    task_id = str(uuid.uuid4())
    
    # Save file contents temporarily
    temp_path = os.path.join(tempfile.gettempdir(), file.filename)
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)
        
    # Simulate processing result
    new_doc = {
        "task_id": task_id,
        "status": "completed",  # Complete immediately so polling works instantly
        "filename": file.filename,
        "classification": {
            "document_type": "PDF Document" if file.filename.endswith('.pdf') else "Text Document",
            "sensitivity": "Internal",
            "has_tables": True if "invoice" in file.filename.lower() else False,
            "topics": ["uploaded", file.filename.split('.')[-1].lower()]
        },
        "parsed_data": {
            "total_pages": 1
        }
    }
    
    # Insert new uploads at the beginning of the repository list
    documents_db.insert(0, new_doc)
    
    return {"task_id": task_id, "status": "processing"}

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
