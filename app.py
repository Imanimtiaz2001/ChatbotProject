from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os

# Initialize Flask app
app = Flask(__name__)

# Configure upload folder and allowed file extension
UPLOAD_FOLDER = 'uploads/'
ALLOWED_EXTENSIONS = {'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Helper function to check if the uploaded file is a PDF
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# API endpoint for uploading files
@app.route('/upload', methods=['POST'])
def upload_file():
    # Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    # If the user does not select a file, the browser submits an empty part without a filename
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        return jsonify({'message': 'File successfully uploaded', 'file_path': file_path}), 200
    else:
        return jsonify({'error': 'Invalid file type'}), 400

# Run the Flask application
if __name__ == '__main__':
    # Ensure the upload folder exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True)
