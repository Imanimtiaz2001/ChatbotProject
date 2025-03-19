from flask import Flask, request, jsonify, render_template  # Flask for web framework
from werkzeug.utils import secure_filename  # Secure filename handling
import os  # OS module for file operations
import PyPDF2  # Library to extract text from PDF files
from dotenv import load_dotenv  # Load environment variables from a .env file
from groq import Groq  # API client for Groq's AI model
from pinecone import Pinecone, ServerlessSpec  # Pinecone for vector storage and retrieval
from sentence_transformers import SentenceTransformer  # Sentence embedding model
import uuid  # Library to generate unique identifiers
from flask_cors import CORS  # Enable Cross-Origin Resource Sharing (CORS)

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

UPLOAD_FOLDER = 'uploads/'
ALLOWED_EXTENSIONS = {'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize the SentenceTransformer model (producing 384-dim embeddings)
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

# Create a Pinecone client instance using the new API
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

# Define your index name and create it if it doesn't exist.
INDEX_NAME = "document-index"
if INDEX_NAME not in pc.list_indexes().names():
    pc.create_index(
        name=INDEX_NAME,
        dimension=384,
        metric="cosine",
        spec=ServerlessSpec(
            cloud=os.getenv("PINECONE_CLOUD", "aws"),
            region=os.getenv("PINECONE_REGION", "us-east-1")
        )
    )
pinecone_index = pc.Index(INDEX_NAME)

# Storing metadata for uploaded documents.
# Each chat_id maps to a dict with key "documents", a list of document info.
chat_sessions = {}  # Format: {chat_id: {"documents": [ { "document_id": ..., "file_path": ..., "extracted_text": ... }, ... ]}}

def allowed_file(filename):
    #Check if the uploaded file is a PDF.
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(pdf_path):
    #Extract text from the given PDF file.
    if not os.path.exists(pdf_path):
        return "Error: File not found."
    
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ''
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text
    return text.strip() if text else "No readable text found in the document."

def process_text(document_context, user_query):
    #Process text using the Groq API with the provided context and query.
    try:
        client = Groq(api_key=os.getenv('GROQ_API_KEY'))  # Initialize the Groq client
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an AI that answers questions based on the provided context."},
                {"role": "user", "content": f"Context: {document_context}"},
                {"role": "user", "content": f"Question: {user_query}"}
            ],
            model="llama3-8b-8192"
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        return f"An error occurred with Groq: {str(e)}"

def chunk_text(text, chunk_size=500, overlap=100):
    #Splits the text into overlapping chunks.
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def upsert_document_embeddings(chat_id, document_id, text):
    """Splits text into chunks, converts each chunk into an embedding, and upserts into Pinecone.
    The vector IDs include the unique document_id to avoid overwriting embeddings."""
    chunks = chunk_text(text)
    vectors = []
    for i, chunk in enumerate(chunks):
        vector_id = f"{chat_id}_{document_id}_{i}"
        embedding = model.encode(chunk).tolist()
        metadata = {"text": chunk, "document_id": document_id}
        vectors.append((vector_id, embedding, metadata))
    # Upsert all vectors into Pinecone under namespace = chat_id (all docs for a chat share the same namespace)
    pinecone_index.upsert(vectors=vectors, namespace=chat_id)


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    #Handle file upload, extract text, store document metadata, and upsert document embeddings into Pinecone.
    chat_id = request.args.get('chat_id')  # Retrieve chat_id from request
    if not chat_id:
        return jsonify({'error': 'chat_id is required'}), 400

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], chat_id, filename)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        file.save(file_path)

        # Log the saved file size
        file_size = os.path.getsize(file_path)
        print(f"Saved file at {file_path} with size: {file_size} bytes")
        if file_size == 0:
            return jsonify({'error': 'Uploaded file is empty'}), 400


        extracted_text = extract_text_from_pdf(file_path)

        # Ensure chat_sessions for this chat_id exists
        if chat_id not in chat_sessions:
            chat_sessions[chat_id] = {"documents": []}
        
        # Generate a unique document ID
        document_id = uuid.uuid4().hex
        # Save document metadata in the chat_sessions dictionary
        chat_sessions[chat_id]["documents"].append({
            "document_id": document_id,
            "file_path": file_path,
            "extracted_text": extracted_text
        })
        
        # Upsert document embeddings into Pinecone under namespace=chat_id
        upsert_document_embeddings(chat_id, document_id, extracted_text)

        print(f"Chat {chat_id} uploaded file at: {file_path}")
        print(f"Extracted text (first 500 chars): {extracted_text[:500]}...")

        return jsonify({
            'message': 'File successfully uploaded and document embeddings upserted',
            'file_path': file_path,
            'document_id': document_id
        }), 200
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/chat', methods=['POST'])
def chat():
    """
    Process user queries by retrieving document context from all uploaded documents (from namespace=chat_id)
    and conversation history (from namespace=f"{chat_id}_history") from Pinecone. Then, use the combined context
    to generate an answer.
    """
    chat_id = request.args.get('chat_id')
    if not chat_id:
        return jsonify({'error': 'chat_id is required'}), 400

    # Ensure that at least one document has been uploaded
    if chat_id not in chat_sessions or not chat_sessions[chat_id]["documents"]:
        return jsonify({'error': 'No document has been uploaded for this chat session'}), 400

    query = request.json.get('query')
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    # Compute query embedding
    query_embedding = model.encode(query).tolist()

    # Retrieve document context from namespace=chat_id (from all documents)
    doc_response = pinecone_index.query(
        vector=query_embedding,
        top_k=3,
        namespace=chat_id,
        include_metadata=True
    )
    document_context = " ".join([match['metadata']['text'] for match in doc_response.get('matches', [])])

    # Retrieve conversation history from namespace=f"{chat_id}_history"
    history_namespace = f"{chat_id}_history"
    history_response = pinecone_index.query(
        vector=query_embedding,
        top_k=3,
        namespace=history_namespace,
        include_metadata=True
    )
    conversation_history = " ".join([match['metadata']['turn'] for match in history_response.get('matches', [])])

    # Combine contexts: document context and conversation history
    combined_context = f"Document Context: {document_context}\nChat History: {conversation_history}"

    # Process the query using the combined context
    response = process_text(combined_context, query)

    # Upsert the new conversation turn into Pinecone under the history namespace.
    turn_text = f"User: {query}\nAI: {response}"
    turn_id = f"{chat_id}_turn_{uuid.uuid4().hex}"
    turn_embedding = model.encode(turn_text).tolist()
    pinecone_index.upsert(
        vectors=[(turn_id, turn_embedding, {"turn": turn_text})],
        namespace=history_namespace
    )

    return jsonify({'response': response})

@app.route('/chatbot', methods=['POST'])
def chatbot():
    #Fallback endpoint for interacting with the chatbot without a PDF document.
    query = request.json.get('query')
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    try:
        client = Groq(api_key=os.getenv('GROQ_API_KEY'))
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": query}],
            model="llama3-8b-8192"
        )
        response = chat_completion.choices[0].message.content
        return jsonify({'response': response})
    except Exception as e:
        return jsonify({'error': f"An error occurred with Groq: {str(e)}"}), 500

if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
