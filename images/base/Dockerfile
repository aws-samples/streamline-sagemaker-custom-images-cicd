
FROM public.ecr.aws/sagemaker/sagemaker-distribution:1.6.0-cpu
ARG NB_USER="sagemaker-user"
ARG NB_UID=1000
ARG NB_GID=100

ENV MAMBA_USER=$NB_USER

USER root

RUN apt-get update
RUN micromamba install sagemaker-inference --freeze-installed --yes --channel conda-forge --name base
COPY base/requirements.txt requirements.txt
#COPY requirements.txt requirements.txt
RUN python3 -m pip install --quiet -r requirements.txt
USER $MAMBA_USER

ENTRYPOINT ["jupyter-lab"]
CMD ["--ServerApp.ip=0.0.0.0", "--ServerApp.port=8888", "--ServerApp.allow_origin=*", "--ServerApp.token=''", "--ServerApp.base_url=/jupyterlab/default"]