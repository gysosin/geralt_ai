import os
from typing import Optional
from langchain_google_genai import GoogleGenerativeAIEmbeddings  # Updated import for embeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAI  # Updated import for the LLM
from langchain_classic.chains import RetrievalQA
from langchain_core.prompts import PromptTemplate
from elasticsearch import Elasticsearch
from config import Config
from minio import Minio
from mistralai.client import MistralClient
from pymilvus import connections  # still available if needed
import redis
from dotenv import load_dotenv
from langchain_core.retrievers import BaseRetriever
from pydantic import PrivateAttr
from langchain_core.documents import Document  # Import Document for conversion

# Constants
ELASTICSEARCH_HOST = Config.ELASTICSEARCH_URL
INDEX_NAME = "documents"

# Updated strict prompt template: only use the provided context (ingested documents) and no external knowledge.
PROFILE_TEMPLATE = """
You are RecruitBot, an AI assistant that fetches candidate profiles from our database.
You are friendly, conversational, and approachable. Begin your response with a warm greeting and a short introductory sentence that tells the user you have found the candidate profile.
Below is the context extracted from candidate profiles:
{context}
Based strictly on the provided context only (do not incorporate any external knowledge or assumptions), output the candidate profile in a structured JSON format using these keys:
- "Name": Candidate's full name (if available)
- "Role": Their current or past role(s)
- "Skills": A list of relevant skills
- "Experience": A summary of their work experience

If multiple profiles match the query, output them as a JSON array. If no matching profile is found, return:
{{"error": "No matching profile found."}}

Question: {question}
"""


prompt = PromptTemplate(
    template=PROFILE_TEMPLATE,
    input_variables=["context", "question"]
)

###############################################################################
# Hybrid Elasticsearch Retriever
###############################################################################
class HybridElasticsearchRetriever(BaseRetriever):
    """
    A custom retriever that performs hybrid search using both vector similarity
    and keyword matching in Elasticsearch.
    """
    _es: Elasticsearch = PrivateAttr()
    _index_name: str = PrivateAttr()
    _embedding: GoogleGenerativeAIEmbeddings = PrivateAttr()

    def __init__(self, es_url: str, index_name: str, embedding: GoogleGenerativeAIEmbeddings, **kwargs):
        super().__init__(**kwargs)
        self._es = Elasticsearch(es_url)
        self._index_name = index_name
        self._embedding = embedding

    def _get_relevant_documents(self, query: str, k: int = 5):
        # Compute the query's dense vector using OpenAIEmbeddings.
        query_vector = self._embedding.embed_query(query)
        # Build a hybrid query: combine a multi_match (keyword) query with vector similarity.
        body = {
            "size": k,
            "query": {
                "script_score": {
                    "query": {
                        "bool": {
                            "should": [
                                {
                                    "multi_match": {
                                        "query": query,
                                        "fields": ["content"]
                                    }
                                }
                            ]
                        }
                    },
                    "script": {
                        "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                        "params": {"query_vector": query_vector}
                    }
                }
            }
        }
        results = self._es.search(index=self._index_name, body=body)
        documents = []
        for hit in results["hits"]["hits"]:
            # Convert each hit into a LangChain Document.
            source = hit["_source"]
            # Create a Document with page_content and store all source fields in metadata.
            doc = Document(page_content=source.get("content", ""), metadata=source)
            documents.append(doc)
        return documents

    async def _aget_relevant_documents(self, query: str, k: int = 5):
        return self._get_relevant_documents(query, k)

    @property
    def es(self):
        return self._es

    @property
    def embedding(self):
        return self._embedding

###############################################################################
# Elasticsearch Setup and Document Ingestion
###############################################################################
def setup_elasticsearch():
    print(f"Connecting to Elasticsearch at {ELASTICSEARCH_HOST}")
    try:
        embedding = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=Config.GEMINI_API_KEY,
            task_type="retrieval_document",
            output_dimensionality=Config.EMBEDDING_DIMENSION
        )
    except Exception as e:
        print(f"Error initializing Gemini Embeddings: {e}")
        raise e

    retriever = HybridElasticsearchRetriever(
        es_url=ELASTICSEARCH_HOST, 
        index_name=INDEX_NAME, 
        embedding=embedding
    )
    return retriever

def ingest_documents(file_path: str, es_client: Elasticsearch, embedding: GoogleGenerativeAIEmbeddings):
    print(f"Ingesting documents from {file_path}...")
    loader = TextLoader(file_path)
    documents = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    chunks = splitter.split_documents(documents)
    for chunk in chunks:
        # Assuming each chunk has a 'page_content' attribute containing text.
        text = chunk.page_content
        # Compute embedding for the chunk.
        embedding_vector = embedding.embed_query(text)
        # Prepare the document for indexing.
        doc = {
            "content": text,
            "embedding": embedding_vector
        }
        # Index the document into Elasticsearch.
        es_client.index(index=INDEX_NAME, body=doc)
    print("Document ingestion complete.")

###############################################################################
# Retrieval QA Chain Setup
###############################################################################
def create_qa_chain(retriever: HybridElasticsearchRetriever, api_key: Optional[str] = None):
    openai_api_key = api_key or Config.OPENAI_API_KEY
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY is required to create the QA chain")
    llm = OpenAI(api_key=openai_api_key)
    # Build the RetrievalQA chain using the custom prompt template.
    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        chain_type_kwargs={"prompt": prompt}
    )

###############################################################################
# Interactive Chat Console
###############################################################################
import json

def chat_console(qa_chain):
    print("\nWelcome to RecruitBot! I can help you find recruiter or developer profiles from our database.")
    print("Type your query below (or type 'exit' to quit):\n")
    while True:
        user_query = input("You: ").strip()
        if user_query.lower() in ("exit", "quit"):
            print("RecruitBot: Goodbye!")
            break
        # Get the response from the RetrievalQA chain.
        response = qa_chain.invoke(user_query)
        # Attempt to extract the JSON from the response.
        try:
            # Assume the friendly part is on the first line and JSON follows.
            lines = response.strip().splitlines()
            # Find the first line that starts with "{" to extract JSON.
            json_str = ""
            for line in lines:
                if line.strip().startswith("{"):
                    json_str = "\n".join(lines[lines.index(line):])
                    break
            data = json.loads(json_str)
            # Print the friendly greeting (if any) and then the formatted JSON.
            greeting = lines[0] if not lines[0].strip().startswith("{") else ""
            if greeting:
                print("RecruitBot:", greeting)
            print("Candidate Profile:")
            print(json.dumps(data, indent=2))
        except Exception as e:
            # Fallback: print the raw response if parsing fails.
            print("RecruitBot:", response)
        print("\n")


###############################################################################
# Main Execution
###############################################################################
if __name__ == "__main__":
    # Setup the hybrid Elasticsearch retriever.
    retriever = setup_elasticsearch()
    # Retrieve the Elasticsearch client and embedding instance from our retriever.
    es_client = retriever.es
    embedding = retriever.embedding

    # Ingest documents from "sample.txt" into Elasticsearch.
    ingest_documents("sample.txt", es_client, embedding)

    # Create the RetrievalQA chain.
    qa_chain = create_qa_chain(retriever)
    
    # Start the interactive chat console.
    chat_console(qa_chain)
