FROM public.ecr.aws/docker/library/ubuntu:24.04

ARG NB_USER="sagemaker-user"
ARG NB_UID="1000"
ARG NB_GID="100"

RUN apt update -y && \
    apt install -y python3 python3-pip unzip sudo cron curl && \
    apt clean all && \
    apt remove awscli && \
    pip3 install ipykernel && \
    pip3 install jupyterlab && \
    python3 -m ipykernel install
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip -q awscliv2.zip && \
    ./aws/install
RUN curl -s https://deb.nodesource.com/setup_18.x | bash && \
    apt install nodejs -y  && \
    node -v

COPY jlab/requirements.txt requirements.txt
RUN pip3 install --upgrade urllib3==1.26.6 && \
    pip3 install --quiet -r requirements.txt

RUN useradd --create-home --shell /bin/bash --gid "${NB_GID}" --uid ${NB_UID} ${NB_USER} && \
    echo "${NB_USER} ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

ENV PYTHONUNBUFFERED=TRUE  
ENV PYTHONDONTWRITEBYTECODE=TRUE  

WORKDIR /home/${NB_UID}
USER ${NB_UID}

CMD jupyter lab --ip 0.0.0.0 --port 8888 \
  --ServerApp.base_url="/jupyterlab/default" \
  --ServerApp.token='' \
  --ServerApp.allow_origin='*'

