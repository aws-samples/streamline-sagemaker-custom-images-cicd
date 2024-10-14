FROM public.ecr.aws/amazonlinux/amazonlinux:2023

ARG NB_USER="sagemaker-user"
ARG NB_UID="1000"
ARG NB_GID="100"

# Update and install necessary packages
RUN dnf update -y && \
    dnf remove -y curl-minimal && \
    dnf install -y python3 python3-pip unzip sudo cronie curl shadow-utils && \
    dnf clean all

# Install and set up Python packages
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir ipykernel jupyterlab && \
    python3 -m ipykernel install

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip -q awscliv2.zip && \
    ./aws/install && \
    rm -rf aws awscliv2.zip

# Install Node.js
RUN dnf install -y nodejs npm && \
    npm install -g npm@latest && \
    node -v

# Copy and install Python requirements
COPY jlab/requirements.txt requirements.txt
RUN pip3 install --no-cache-dir -r requirements.txt && \
    rm requirements.txt

# Create user
RUN useradd --create-home --shell /bin/bash --gid "${NB_GID}" --uid ${NB_UID} ${NB_USER} && \
    echo "${NB_USER} ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

# Clean up
RUN dnf remove -y unzip && \
    dnf clean all && \
    rm -rf /var/cache/dnf

ENV PYTHONUNBUFFERED=TRUE  
ENV PYTHONDONTWRITEBYTECODE=TRUE  

WORKDIR /home/${NB_UID}
USER ${NB_UID}

CMD ["jupyter", "lab", "--ip", "0.0.0.0", "--port", "8888", \
     "--ServerApp.base_url=/jupyterlab/default", \
     "--ServerApp.token=''", \
     "--ServerApp.allow_origin='*'"]
