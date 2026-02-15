# STEP 1: Choose the base image (has Python preinstalled)
FROM python:3.12-slim

# STEP 2: Stop Python from writing .pyc files and forcing stdout buffering
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# STEP 3: Set the working directory *inside the container*
WORKDIR /app

# STEP 4: Copy your dependency list into the container
COPY requirements.txt .

# STEP 5: Install your dependencies inside the container
RUN pip install --no-cache-dir -r requirements.txt

# STEP 6: Copy your whole backend project into the container
COPY . .

# STEP 6b: Ensure the db directory exists for the mounted volume
RUN mkdir -p /app/db

# STEP 7: Tell Docker which port Django will run on
EXPOSE 8000

# STEP 8: Command to run your Django server when the container starts
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]

