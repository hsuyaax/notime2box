"""Exact architecture for audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim.

WHY THIS FILE EXISTS (important, and a Q&A exhibit):
The checkpoint declares `Wav2Vec2ForSpeechClassification` — a *custom* regression
head, not HF's stock `Wav2Vec2ForSequenceClassification`. Loading it through the
generic `pipeline("audio-classification", ...)` silently discards the trained head
("classifier.weight | MISSING ... newly initialized") and reads from a RANDOM one.
The symptom is subtle and easy to ship by accident: inference still "works" and
returns plausible-looking floats, but they're near-constant — we measured a spread
of 0.003 arousal across 16 real clips, which flat-lines every downstream z-score,
changepoint and alert.

So we declare the head ourselves and load the real weights. Output order is fixed by
the model config: [arousal, dominance, valence], each in [0, 1].
"""
import numpy as np
import torch
import torch.nn as nn
from transformers import Wav2Vec2Model, Wav2Vec2PreTrainedModel
from transformers.models.wav2vec2.modeling_wav2vec2 import Wav2Vec2Config

MODEL_ID = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"


class RegressionHead(nn.Module):
    """Verbatim from the model card — shapes must match or weights won't bind."""

    def __init__(self, config: Wav2Vec2Config):
        super().__init__()
        self.dense = nn.Linear(config.hidden_size, config.hidden_size)
        self.dropout = nn.Dropout(config.final_dropout)
        self.out_proj = nn.Linear(config.hidden_size, config.num_labels)

    def forward(self, features, **kwargs):
        x = self.dropout(features)
        x = self.dense(x)
        x = torch.tanh(x)
        x = self.dropout(x)
        return self.out_proj(x)


class EmotionModel(Wav2Vec2PreTrainedModel):
    # transformers v5 introspects these on every PreTrainedModel subclass; the
    # checkpoint ties nothing, so declare them empty rather than inherit surprises.
    _tied_weights_keys: dict = {}
    all_tied_weights_keys: dict = {}

    def __init__(self, config: Wav2Vec2Config):
        super().__init__(config)
        self.config = config
        self.wav2vec2 = Wav2Vec2Model(config)
        self.classifier = RegressionHead(config)
        self.init_weights()

    def forward(self, input_values):
        hidden = self.wav2vec2(input_values)[0]
        pooled = torch.mean(hidden, dim=1)      # mean-pool over time
        return pooled, self.classifier(pooled)


class AudeeringDimensional:
    """Thin wrapper: float32 mono 16k waveform -> {arousal, dominance, valence}."""

    def __init__(self, device: str = "cpu"):
        from transformers import Wav2Vec2Processor
        self.device = device
        self.processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
        self.model = EmotionModel.from_pretrained(MODEL_ID).to(device).eval()

    @torch.no_grad()
    def __call__(self, samples: np.ndarray, sr: int = 16000) -> dict:
        x = self.processor(samples, sampling_rate=sr, return_tensors="pt").input_values
        _, logits = self.model(x.to(self.device))
        a, d, v = logits[0].float().cpu().numpy().tolist()
        clamp = lambda t: float(np.clip(t, 0.0, 1.0))
        return {"arousal": clamp(a), "dominance": clamp(d), "valence": clamp(v)}


def self_check() -> None:
    """Regression guard against the silent-random-head failure.

    Must run on REAL SPEECH: wav2vec2 is trained on speech, so synthetic tones are
    out-of-distribution and compress the output range (they gave only ~0.01 spread
    even with correct weights — not a useful signal either way). On real radio clips
    a correctly-bound head spreads arousal ~0.19; the broken one gave 0.003.
    """
    from pathlib import Path
    from . import audio

    files = sorted(Path("demo-data/audio").glob("*.mp3"))[:8]
    if len(files) < 2:
        print("SKIP: needs demo-data/audio clips")
        return
    m = AudeeringDimensional()
    vals = [m(audio.prepare(f)[0])["arousal"] for f in files]
    spread = max(vals) - min(vals)
    print(f"arousal spread over {len(vals)} real clips: {spread:.4f}")
    assert spread > 0.05, f"head looks untrained/constant (spread {spread:.4f}) — weights did not bind"
    print("OK: audeering head is live and discriminating")


if __name__ == "__main__":
    self_check()
