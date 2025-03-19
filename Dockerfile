# Stage 1: Build stage 
FROM python:3.12.4 AS build

# Prevent Python from writing pyc files and enable unbuffered output for logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory in the container
WORKDIR /app

# Install virtualenv (optional, but useful for managing the environment)
RUN pip install --upgrade pip && pip install virtualenv

# Copy the application code into the container
COPY . /app

# Create a virtual environment inside the container
RUN python -m venv /app/venv

# Activate the virtual environment and install dependencies
RUN /app/venv/bin/pip install -r requirements.txt

# Stage 2: Final image
FROM python:3.12.4-slim

# Set environment variable for the final image
ENV APP_ENV=production

# Set the working directory in the container
WORKDIR /app

# Copy the virtual environment from the build stage
COPY --from=build /app/venv /app/venv 

# Copy application code
COPY --from=build /app /app

# Set the environment variable to point to the virtual environment
ENV PATH="/app/venv/bin:$PATH"

# Expose the port on which your app runs (change if your app uses a different port)
EXPOSE 5000

# Define the command to run your application using the virtual environment
CMD ["python", "/app/app.py"]