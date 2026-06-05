FROM dromni/nerfstudio:1.1.3

USER root

# Install Node.js 20 for splat-transform (remove conflicting libnode-dev first)
RUN apt-get remove -y nodejs libnode-dev libnode72 2>/dev/null || true && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y -o Dpkg::Options::="--force-overwrite" nodejs && \
    npm install -g @playcanvas/splat-transform

# Install Python dependencies as the 'user' (so nerfstudio env is accessible)
COPY requirements.txt /tmp/requirements.txt
RUN pip install awscli --upgrade --quiet && \
    pip install -r /tmp/requirements.txt

# Copy handler into the user's home directory
COPY --chown=user run.py /home/user/run.py

# Switch back to 'user' so nerfstudio packages are on PYTHONPATH
USER user
WORKDIR /home/user

CMD ["python3", "-u", "run.py"]
