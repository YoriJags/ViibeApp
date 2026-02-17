from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"status": "alive", "app": "Vibe Scout API"}

@app.get("/api/health")
async def health():
    return {"status": "healthy"}

handler = app
