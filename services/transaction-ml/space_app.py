"""Gradio Space entry point preserving Sentinel's authenticated REST contract."""
import os
from pathlib import Path

import gradio as gr
from fastapi import FastAPI, HTTPException
from fastapi.routing import APIRoute

# Apply defaults before importing the service, which constructs its model at import.
os.environ.setdefault("TRANSACTION_ML_MODE", "trained")
os.environ.setdefault("TRANSACTION_ML_ZERO_GPU", "1")
os.environ.setdefault(
    "TRANSACTION_ML_MODEL_PATH",
    str(Path(__file__).resolve().parent / "artifacts" / "model.joblib"),
)

from app.main import app as scoring_app, create_app


def create_demo(service=scoring_app):
    # The public UI offers a fixed synthetic GPU check. Customer scoring stays
    # behind X-ML-API-Key middleware, including in a public Space.
    with gr.Blocks(title="Sentinel Fraud Detection", analytics_enabled=False) as demo:
        gr.Markdown(
            "# Sentinel Fraud Detection\n\n"
            "PaySim transaction fraud scoring service.\n\n"
            "[Check model health](/health)\n\n"
            "Scoring is available to authorized Sentinel integrations. "
            "This page does not accept customer data or API keys."
        )
        scorer = service.state.scorer
        if scorer is not None and scorer.gpu_predict is not None:
            # ZeroGPU discovers allocations through registered Gradio events.
            # Only a fixed synthetic feature row is exposed by this demo.
            sample = gr.State([[0.] * len(scorer.bundle["featureNames"])])
            result = gr.JSON(label="Synthetic sample class probabilities")
            gr.Button("Run synthetic GPU check").click(
                fn=scorer.gpu_predict, inputs=sample, outputs=result,
            )
    return demo


def create_space_app():
    service = create_app()
    gateway = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    gateway = gr.mount_gradio_app(gateway, create_demo(service), path="/ui")
    gateway.mount("/", service)
    return gateway


if __name__ == "__main__":
    # Use Gradio's launch lifecycle so ZeroGPU registers its GPU callbacks.
    demo = create_demo()
    demo.launch(server_name="0.0.0.0", prevent_thread_lock=True, ssr_mode=False)
    # Gradio's frontend catch-all otherwise handles GET /health before mounts.
    def model_health():
        scorer = scoring_app.state.scorer
        if scorer is None or scorer.bundle is None or scorer.gpu_predict is None:
            raise HTTPException(503, "Trained GPU model unavailable")
        return {"status": "UP", "mode": scorer.mode, "modelLoaded": True, "backend": "zerogpu"}
    demo.app.router.routes.insert(0, APIRoute("/health", endpoint=model_health, methods=["GET"]))
    demo.app.mount("/", scoring_app)
    demo.block_thread()
else:
    app = create_space_app()
