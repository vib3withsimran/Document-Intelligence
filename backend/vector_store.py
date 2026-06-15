import os
import chromadb
import uuid
from chromadb import EmbeddingFunction
from chromadb.api.types import Documents, Embeddings

# Optimize memory usage for low-RAM server environments (like Render Free Tier)
# Limits PyTorch CPU threads to prevent memory explosion during tokenization/embedding.
try:
    import torch
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
except Exception:
    pass

class CloudOrLocalEmbeddingFunction(EmbeddingFunction):
    def name(self) -> str:
        return "sentence_transformer"

    def __init__(self):
        self.is_render = os.environ.get("RENDER") == "true" or os.environ.get("PORT") is not None
        if not self.is_render:
            print("Initializing local SentenceTransformer (All-MiniLM-L6-v2) for development...")
            from chromadb.utils import embedding_functions
            self.local_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )
        else:
            print("Running in Production (Render). Using Hugging Face Inference API for embeddings (0MB RAM footprint).")
            self.local_fn = None
            
    def __call__(self, input: Documents) -> Embeddings:
        if self.is_render:
            import requests
            api_url = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
            hf_token = os.environ.get("HF_TOKEN")
            headers = {}
            if hf_token:
                headers["Authorization"] = f"Bearer {hf_token}"
                
            try:
                response = requests.post(
                    api_url, 
                    headers=headers, 
                    json={"inputs": input, "options": {"wait_for_model": True}},
                    timeout=20
                )
                if response.status_code == 200:
                    embeddings = response.json()
                    if isinstance(embeddings, list) and len(embeddings) > 0 and isinstance(embeddings[0], list):
                        return embeddings
                print(f"Hugging Face API error (status {response.status_code}): {response.text}")
            except Exception as e:
                print(f"Hugging Face API request failed: {e}")
                
            # Fallback locally if HF API failed during dev testing, but on Render we raise error
            raise Exception("Hugging Face Inference API failed for embeddings in production.")
        else:
            return self.local_fn(input)

class VectorStore:
    def __init__(self):
        # Create persistent database in a fixed location inside the backend directory
        db_path = os.path.join(os.path.dirname(__file__), "chroma_db")
        self.client = chromadb.PersistentClient(path=db_path)
        
        # Use cloud embedding API in production (Render) and local in development
        self.embedding_fn = CloudOrLocalEmbeddingFunction()
        
        # Create or get collection
        self.collection = self.client.get_or_create_collection(
            name="documents",
            embedding_function=self.embedding_fn
        )
    
    def add_document(self, text: str, metadata: dict):
        """Store document in vector database"""
        doc_id = str(uuid.uuid4())
        
        self.collection.add(
            documents=[text],
            metadatas=[metadata],
            ids=[doc_id]
        )
        return doc_id
    
    def search(self, query: str, top_k: int = 5):
        """Find most relevant documents using hybrid filename-filtering semantic search"""
        import re
        
        # 1. Get all unique filenames in the collection to match keywords
        matched_filenames = []
        try:
            results = self.collection.get(include=["metadatas"])
            if results and results.get('metadatas'):
                filenames = list(set([m['filename'] for m in results['metadatas'] if m and 'filename' in m]))
                
                # Extract tokens from the query, filtering out common English stop words
                STOP_WORDS = {"what", "is", "to", "who", "it", "by", "the", "a", "an", "and", "of", "for", "in", "on", "with", "at", "about", "this", "that", "these", "those", "related"}
                query_clean = re.sub(r'[^\w\s]', ' ', query.lower())
                query_tokens = [t for t in query_clean.split() if t not in STOP_WORDS]
                
                for fname in filenames:
                    base_name = os.path.splitext(fname)[0].lower()
                    is_match = False
                    for q_tok in query_tokens:
                        if len(q_tok) >= 3:
                            # Substring check
                            if q_tok in base_name or base_name in q_tok:
                                is_match = True
                                break
                            # Fuzzy character check for witchunt vs witchhunt
                            if q_tok.replace('h', '') == base_name.replace('h', '') or ('witch' in q_tok and 'witch' in base_name):
                                is_match = True
                                break
                    if is_match:
                        matched_filenames.append(fname)
        except Exception as e:
            print(f"Error checking filenames for hybrid search: {e}")

        # 2. Query Chroma DB with optional metadata filtering
        query_n = max(top_k * 4, 20)
        try:
            if matched_filenames:
                if len(matched_filenames) == 1:
                    where_filter = {"filename": matched_filenames[0]}
                else:
                    where_filter = {"filename": {"$in": matched_filenames}}
                
                res = self.collection.query(
                    query_texts=[query],
                    n_results=query_n,
                    where=where_filter
                )
            else:
                res = self.collection.query(
                    query_texts=[query],
                    n_results=query_n
                )
        except Exception as e:
            print(f"Chroma query error: {e}")
            res = {}

        # 3. Format and deduplicate results
        documents = []
        seen = set()
        if res and res.get('documents') and res['documents'][0]:
            for i in range(len(res['distances'][0])):
                doc_text = res['documents'][0][i]
                meta = res['metadatas'][0][i]
                filename = meta.get('filename', 'unknown')
                page = meta.get('page', 1)
                
                sig = (filename, page)
                if sig not in seen:
                    seen.add(sig)
                    documents.append({
                        'text': doc_text,
                        'metadata': meta,
                        'relevance_score': 1 - res['distances'][0][i]  # Convert distance to score
                    })
                    if len(documents) >= top_k:
                        break
        
        return documents
