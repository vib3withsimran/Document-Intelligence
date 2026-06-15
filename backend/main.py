# backend/main.py - DEPLOYMENT READY VERSION
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import tempfile
import uuid
from typing import List

# Load environment variables from .env file
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(dotenv_path):
    with open(dotenv_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

import sys
# Add backend directory to sys.path to resolve imports on Render
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from parser import DocumentParser
from classifier import DocumentClassifier
from vector_store import VectorStore
from rag_agent import RAGAgent

app = FastAPI()

# CORS for your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize pipeline modules
doc_parser = DocumentParser()
doc_classifier = DocumentClassifier()
vector_store = VectorStore()

# Database migration to enriched format
def migrate_database():
    try:
        results = vector_store.collection.get()
        ids_to_delete = []
        docs_to_add = []
        metadatas_to_add = []
        
        for i in range(len(results['ids'])):
            doc_id = results['ids'][i]
            text = results['documents'][i]
            meta = results['metadatas'][i]
            
            if not text.startswith("Document: "):
                filename = meta.get('filename', 'unknown')
                page = meta.get('page', 1)
                enriched_text = f"Document: {filename}\nPage: {page}\nContent:\n{text}"
                
                ids_to_delete.append(doc_id)
                docs_to_add.append(enriched_text)
                metadatas_to_add.append(meta)
                
        if ids_to_delete:
            print(f"Migrating {len(ids_to_delete)} database documents to enriched format...")
            vector_store.collection.delete(ids=ids_to_delete)
            vector_store.collection.add(
                documents=docs_to_add,
                metadatas=metadatas_to_add,
                ids=ids_to_delete
            )
            print("Database migration completed successfully!")
    except Exception as e:
        print(f"Database migration failed: {e}")

migrate_database()

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

# Background processing task
def process_document_task(task_id: str, temp_path: str, filename: str):
    try:
        # 1. Parse document
        parsed_result = doc_parser.parse(temp_path, filename)
        
        # 2. Extract full text
        full_text = "\n".join([page['text'] for page in parsed_result['pages']])
        
        # 3. Classify document
        classification = doc_classifier.classify(full_text, filename)
        
        # 4. Ingest pages into VectorStore
        topics_list = classification.get("topics", [])
        topics_str = ", ".join(topics_list) if isinstance(topics_list, list) else str(topics_list)
        
        for page in parsed_result['pages']:
            meta = {
                "filename": filename,
                "page": page['page_number'],
                "document_type": classification.get("document_type", "other"),
                "sensitivity": classification.get("sensitivity", "internal"),
                "has_tables": page.get('has_tables', False),
                "topics": topics_str
            }
            enriched_text = f"Document: {filename}\nPage: {page['page_number']}\nContent:\n{page['text']}"
            vector_store.add_document(enriched_text, meta)
            
        # 5. Update global documents_db state
        for doc in documents_db:
            if doc["task_id"] == task_id:
                doc["status"] = "completed"
                doc["classification"] = {
                    "document_type": classification.get("document_type", "other"),
                    "sensitivity": classification.get("sensitivity", "internal"),
                    "has_tables": any(page.get('has_tables', False) for page in parsed_result['pages']),
                    "topics": topics_list
                }
                doc["parsed_data"] = {
                    "total_pages": parsed_result.get("total_pages", 1)
                }
                break
                
    except Exception as e:
        print(f"Error in background task for {filename}: {str(e)}")
        # Update state to failed
        for doc in documents_db:
            if doc["task_id"] == task_id:
                doc["status"] = "failed"
                doc["error"] = str(e)
                break
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as cleanup_err:
                print(f"Error deleting temporary file {temp_path}: {str(cleanup_err)}")

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
            return {"status": doc["status"], "filename": doc["filename"], "error": doc.get("error")}
    raise HTTPException(status_code=404, detail="Task not found")

# Upload endpoint (fixed parameter name to match frontend append)
@app.post("/api/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    task_id = str(uuid.uuid4())
    
    # Save file contents temporarily
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"{task_id}_{file.filename}")
    
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)
        
    # Create the pending document entry
    new_doc = {
        "task_id": task_id,
        "status": "processing",
        "filename": file.filename,
        "classification": None,
        "parsed_data": None
    }
    
    # Insert new uploads at the beginning of the repository list
    documents_db.insert(0, new_doc)
    
    # Enqueue background task
    background_tasks.add_task(process_document_task, task_id, temp_path, file.filename)
    
    return {"task_id": task_id, "status": "processing"}

# Simplified chat endpoint
@app.post("/api/chat")
async def chat(query: str):
    api_key = os.environ.get("GROQ_API_KEY")
    if api_key:
        try:
            agent = RAGAgent(api_key=api_key)
            result = agent.answer(query)
            return result
        except Exception as e:
            print(f"RAG agent answer error: {e}")
            # Fall back to local search if Groq client throws exception

    # Fallback to local semantic search
    relevant_docs = vector_store.search(query, top_k=3)
    if not relevant_docs:
        return {
            "answer": "I couldn't find any relevant information in the uploaded documents to answer your question.",
            "citations": []
        }
    
    answer_text = "Based on local semantic search, here is the relevant context found in your documents:\n\n"
    citations = []
    for doc in relevant_docs:
        filename = doc['metadata'].get('filename', 'Unknown Document')
        page = doc['metadata'].get('page', 1)
        score = doc.get('relevance_score', 0)
        
        answer_text += f"- From {filename} (Page {page}):\n  ... {doc['text'][:300].strip()} ...\n\n"
        citations.append({
            "document": filename,
            "page": page,
            "relevance": score
        })
        
    answer_text += "\n*(Note: Groq LLM API is not configured or failed. Showing raw text context retrieved via local SentenceTransformer embeddings.)*"
    
    return {
        "answer": answer_text,
        "citations": citations
    }

# Mount static frontend files
frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../frontend/out")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

