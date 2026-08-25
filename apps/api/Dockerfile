FROM python:3.11-slim
WORKDIR /srv
COPY apps/api/requirements.txt /srv/apps/api/requirements.txt
# CPU-only torch first: 10x smaller than the default CUDA wheel.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
# or-tools arrives via local wheel (network filter blocks its index page;
# files.pythonhosted.org itself is reachable).
COPY build_wheels /wheels
RUN pip install --no-cache-dir -r /srv/apps/api/requirements.txt
RUN pip install --no-cache-dir --no-deps /wheels/*.whl && python -c "import ortools.sat.python.cp_model"
COPY . /srv
ENV PYTHONPATH=/srv:/srv/packages
EXPOSE 8000
