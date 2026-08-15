"""ModelRegistry — every HF model loads once, lazily, and degrades gracefully.

If a heavy dep (torch / faster-whisper / funasr) is missing on this machine, the
corresponding loader returns None and the pipeline falls back to signal-level
heuristics. Cached ClipScores in demo-data/ always carry real model outputs, so
OFFLINE demos are unaffected by what's installed locally. Uses CUDA automatically
when available — ~2s/clip on GPU vs ~5s on CPU (Part F4 latency answer).
"""
import functools


def _try(fn):
    @functools.lru_cache(maxsize=1)
    def wrapper():
        try:
            return fn()
        except Exception as e:  # missing dep, no HF auth, no network — all fine
            print(f"[registry] {fn.__name__} unavailable: {e}")
            return None
    return wrapper


def _has_cuda() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except Exception:
        return False


@_try
def asr_primary():
    from faster_whisper import WhisperModel
    device, compute = ("cuda", "float16") if _has_cuda() else ("cpu", "int8")
    # faster-whisper needs a CTranslate2 conversion, not the raw HF checkpoint
    return WhisperModel("distil-whisper/distil-large-v3.5-ct2", device=device, compute_type=compute)


def _local_ct2_path(hf_repo: str):
    """jacktol's ATC fine-tune has no published CT2 conversion — convert once,
    cache the result under CACHE_DIR, reuse on every later boot."""
    from . import config
    out = config.CACHE_DIR / "ct2_atc_whisper"
    if not (out / "model.bin").exists():
        from ctranslate2.converters import TransformersConverter
        TransformersConverter(hf_repo).convert(str(out), quantization="float16", force=True)
    return str(out)


@_try
def asr_atc():
    from faster_whisper import WhisperModel
    device, compute = ("cuda", "float16") if _has_cuda() else ("cpu", "int8")
    path = _local_ct2_path("jacktol/whisper-medium.en-fine-tuned-for-atc")
    return WhisperModel(path, device=device, compute_type=compute)


@_try
def emotion_dim():
    # audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim → arousal/valence/dominance
    from transformers import pipeline
    return pipeline("audio-classification",
                    model="audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim",
                    function_to_apply="none", device=0 if _has_cuda() else -1)


@_try
def emotion_cat():
    from funasr import AutoModel
    return AutoModel(model="iic/emotion2vec_plus_large", device="cuda:0" if _has_cuda() else "cpu")


@_try
def text_emotion():
    from transformers import pipeline
    return pipeline("text-classification",
                    model="j-hartmann/emotion-english-distilroberta-base", top_k=None,
                    device=0 if _has_cuda() else -1)


@_try
def vad():
    import torch
    model, utils = torch.hub.load("snakers4/silero-vad", "silero_vad", trust_repo=True)
    return model, utils


def warmup():
    """Call at startup so first request isn't the one paying load cost."""
    for f in (asr_primary, emotion_dim, emotion_cat, text_emotion, vad):
        f()
