from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, registry
from .routes import router

app = FastAPI(title="The Silent Co-Driver")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])
app.include_router(router)


@app.get("/")
def root():
    return {"app": "silent-codriver", "engine": config.ENGINE, "offline": config.OFFLINE}


@app.on_event("startup")
def startup():
    if not config.OFFLINE:
        registry.warmup()
