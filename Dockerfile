# lumo — one container: the sync API plus the web app on the same origin.
#   docker build -t lumo .
#   docker run -p 8000:8000 -v lumo-data:/data lumo
# Put HTTPS in front of it (phones won't sync to plain http).

# ---- 1. build the web app -----------------------------------------------------
FROM node:22-slim AS web
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
# The bundle calls the API on whatever origin served it.
ENV EXPO_PUBLIC_API_URL=same-origin
RUN npx expo export --platform web --output-dir dist

# ---- 2. the server ------------------------------------------------------------
FROM python:3.13-slim
WORKDIR /srv
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server/*.py ./
COPY --from=web /app/dist ./web
ENV DATA_DIR=/data \
    FRONTEND_DIST=/srv/web \
    PORT=8000
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
RUN useradd --create-home lumo && mkdir -p /data && chown lumo /data
USER lumo
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers"]
