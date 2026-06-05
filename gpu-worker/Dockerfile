FROM dromni/nerfstudio:1.1.3

USER root

# Install Node.js 20 for splat-transform (remove conflicting libnode-dev first)
RUN apt-get remove -y nodejs libnode-dev libnode72 2>/dev/null || true && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y -o Dpkg::Options::="--force-overwrite" nodejs && \
    npm install -g @playcanvas/splat-transform

# Install AWS CLI for R2 access
RUN pip install awscli --upgrade --quiet

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# Copy handler
COPY run.py /app/run.py

WORKDIR /app

CMD ["python3", "-u", "run.py"]
