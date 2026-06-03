FROM dromni/nerfstudio:1.1.3

# Install Node.js for splat-transform
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g @playcanvas/splat-transform

# Install AWS CLI for R2 access
RUN pip install awscli --upgrade --quiet

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# Copy handler
COPY run.py /app/run.py

WORKDIR /app

CMD ["python", "-u", "run.py"]
