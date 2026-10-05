# ChatApp — PDF & Conversational AI

An AI-powered web application with two chat experiences: ask questions about uploaded PDF documents or use a general conversational assistant. The project combines a Flask backend with Groq-powered generation, Sentence Transformers embeddings, and Pinecone vector retrieval.

## Capabilities

- **Chat with PDFs:** Upload a document and ask questions grounded in its content.
- **Direct chat:** Send general questions without uploading a document.
- **Session history:** Keep conversations associated with chat sessions.
- **Semantic retrieval:** Embed document text and retrieve relevant context through Pinecone.
- **Web interface:** HTML, CSS, and JavaScript frontend with a dark-mode experience.

## Technology stack

| Area | Technology |
| --- | --- |
| Backend | Python, Flask |
| LLM inference | Groq API |
| Embeddings | Sentence Transformers |
| Vector database | Pinecone |
| Frontend | HTML, CSS, JavaScript |

## Local setup

1. Clone this repository and enter its directory.
2. Create and activate a virtual environment.
3. Install the Python dependencies from the repository's dependency file (if present).
4. Configure the required credentials in environment variables. Do not commit API keys.

Example environment variables:

```env
GROQ_API_KEY=your_groq_api_key
PINECONE_API_KEY=your_pinecone_api_key
```

5. Start the Flask application using the repository's application entry point and open the local URL printed by Flask.

> Configuration and startup details may need adjustment to match the current source tree and installed dependency versions. Never commit real credentials or a populated `.env` file.

## API overview

The original application exposes these operations:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/upload` | POST | Upload a PDF and associate it with a chat session |
| `/chat` | POST | Ask a question about a session's PDF |
| `/chatbot` | POST | Send a general chatbot message |

See the application source for the exact request fields and response schema.

## Engineering notes

The PDF workflow follows a retrieval-augmented generation pattern: document content is transformed into embeddings, relevant context is retrieved from the vector store, and the language model generates a response using that context. Retrieval quality depends on document parsing, chunking, embedding configuration, and the selected index.

## Future improvements

- Add automated tests for parsing, retrieval, and API behavior.
- Document chunking strategy, index configuration, and supported file limits.
- Add request validation, structured error responses, and upload safeguards.
- Provide reproducible dependency locking and a Docker-based development setup.
- Add screenshots and a short end-to-end demo.

## Security

Keep provider credentials in environment variables or a secrets manager. Rotate any key that has ever been committed to source control. Avoid uploading confidential documents to third-party model or embedding services without authorization.
