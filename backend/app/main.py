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


@app.get("/health")
def health():
    """Which models are actually loaded. Check this before a demo: if the mic path
    is going to be slow, it will be visible here rather than mid-recording."""
    loaded = {
        "asr_primary": registry.asr_primary() is not None,
        "asr_atc": registry.asr_atc() is not None,
        "emotion_dim": registry.emotion_dim() is not None,
        "emotion_cat": registry.emotion_cat() is not None,
        "text_emotion": registry.text_emotion() is not None,
        "vad": registry.vad() is not None,
    }
    return {"models": loaded,
            "ready": all(loaded.values()),
            "mic_scoring": "real models" if loaded["emotion_dim"] else "heuristic fallback"}


@app.on_event("startup")
def startup():
    """Load every model before serving.

    This used to be skipped when OFFLINE=1, on the assumption that offline meant no
    models. It doesn't — the weights are in the local HF cache. The effect was that
    the first Try-the-Cockpit recording paid the entire five-model load cost with
    the UI stuck on "SCORING", which is the worst possible moment for it. Warming at
    boot moves that cost to a point where nobody is watching.

    Loaders already degrade to None individually, so a missing dependency still
    starts the server rather than crashing it.
    """
    registry.warmup()
