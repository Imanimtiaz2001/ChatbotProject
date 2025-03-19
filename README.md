# ChatApp

ChatApp is an interactive web-based chat application supporting two modes:
- **PDFChat**: Allows users to upload PDF files and interact with their content through AI-powered chat.
- **DirectChat**: A standard chatbot for conversational queries.

The application integrates AI services for intelligent response generation, vector databases for context storage, and a user-friendly interface for seamless interaction.

---

## Features
- **PDF-based Conversational AI**: Upload PDFs and ask contextual questions based on the document's content.
- **Direct Chat**: Engage in AI-powered conversations without document dependency.
- **Session Management**: Saves chat history for reference.
- **AI-Powered Responses**: Uses Groq API for intelligent responses.
- **Vector Storage**: Embeds and retrieves document content using Pinecone.
- **User-Friendly Interface**: Intuitive layout with dark mode support.

---

## Setup Instructions

### Prerequisites
Ensure you have the following installed:
- Python 3.8+
- Node.js 
- Pip & Virtual Environment

### Installation
1. Clone the repository:
   
   git clone https://github.com/your-repo/chatapp.git
   cd chatapp
   

2. Create and activate a virtual environment:
   
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   

3. Install backend dependencies:
   
   pip install -r requirements.txt
   

4. Set up environment variables in a `.env` file:
   
   GROQ_API_KEY=your_api_key
   PINECONE_API_KEY=your_api_key


5. Start the Flask backend:
   
   python app.py
   

6. Open URL given by flask app in a browser to access the frontend.



## API Documentation

### 1. Upload PDF
- **Endpoint**: `/upload`
- **Method**: `POST`
- **Request**:
  ```json
  {
    "file": "PDF file",
    "chat_id": "session_id"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "File uploaded successfully"
  }
  ```

### 2. Chat with PDF
- **Endpoint**: `/chat`
- **Method**: `POST`
- **Request**:
  ```json
  {
    "chat_id": "session_id",
    "message": "Your query"
  }
  ```
- **Response**:
  ```json
  {
    "reply": "Generated AI response"
  }
  ```

### 3. Direct Chat
- **Endpoint**: `/chatbot`
- **Method**: `POST`
- **Request**:
  ```json
  {
    "message": "Your query"
  }
  ```
- **Response**:
  ```json
  {
    "reply": "AI-generated response"
  }
  ```

---

## Technologies Used
- **Backend**: Flask, Pinecone, Groq API, SentenceTransformers
- **Frontend**: HTML, CSS, JavaScript
- **Database**: Pinecone for vector storage

---
## Deployment

### Docker Deployment

#### Creating a Dockerfile
Create a `Dockerfile` in the root directory:

#### Building and Running the Docker Container

1. **Build the Docker image:**
  
   docker build --no-cache -t chatapp . 
  

2. **Run the container:**
  
   docker run -p 5000:5000 chatapp:latest 
   

3. **Stopping the container:**
   
   docker ps 
   docker stop <container_id>
   
**Deployment on Render**
Setup

Push code to GitHub and connect it to Render.
Select Docker as the environment.
Configuration

Set Dockerfile path: ./Dockerfile
Add environment variables:
FLASK_ENV=production
KEY=your_secret_key
PORT=5000
**Deployment**

Create Web Service and deploy.
Access via the provided Render URL.
