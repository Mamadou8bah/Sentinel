"""ZeroGPU hosting lifecycle; public entry point remains the authenticated KYC REST API."""
import os
from pathlib import Path

os.environ.setdefault('OMP_NUM_THREADS', '2')
os.environ.setdefault('MKL_NUM_THREADS', '2')
os.environ.setdefault('CV_ZERO_GPU', 'true')
os.environ.setdefault('CV_DOCUMENT_OCR', 'true')
os.environ.setdefault('CV_PRETRAINED_DIR', str(Path(__file__).parent / 'artifacts/pretrained'))
os.environ.setdefault('CV_ML_ARTIFACT_DIR', str(Path(__file__).parent / 'artifacts'))

import gradio as gr
from fastapi import HTTPException
from fastapi.routing import APIRoute
import numpy as np

from app.main import app as service
from app.api.security import InferenceAuth


class RuntimeAuth(InferenceAuth):
    async def __call__(self, scope, receive, send):
        if scope['type'] == 'websocket':
            # The product API needs no public websocket transport.
            await send({'type': 'websocket.close', 'code': 1008})
            return
        return await super().__call__(scope, receive, send)


def runtime_check():
    pretrained = service.state.models.pretrained
    if pretrained is None or not pretrained.loaded or pretrained.gpu_predict is None:
        raise HTTPException(503, 'GPU anti-spoof backend unavailable')
    try:
        batches = [np.zeros((1, 3, 80, 80), dtype=np.float32) for _ in range(2)]
        result = pretrained.gpu_predict(batches, os.getenv('ML_SERVICE_API_KEY', ''))
        if result.get('device') != 'cuda':
            raise RuntimeError('CUDA execution not confirmed')
        return {'backend': 'zerogpu', 'device': result['device'], 'antiSpoofModelsRan': 2,
                'verificationReady': service.state.models.ready}
    except Exception:
        raise HTTPException(503, 'GPU allocation unavailable; retry later') from None


def create_runtime():
    # Hidden registration is required for ZeroGPU lifecycle discovery. There is
    # no public data-entry demo; authentication protects Gradio routes as well.
    with gr.Blocks(title='Sentinel KYC API', analytics_enabled=False) as runtime:
        pretrained = service.state.models.pretrained
        if pretrained is not None and pretrained.gpu_predict is not None:
            batches = gr.JSON(visible=False)
            key = gr.Textbox(visible=False)
            result = gr.JSON(visible=False)
            gr.Button(visible=False).click(pretrained.gpu_predict, [batches, key], result, api_name=False)
    return runtime


def configure(app):
    # Put the real REST routes ahead of Gradio's frontend catch-all. Mounted
    # service middleware retains body limits and service-to-service auth.
    for route in reversed(service.routes):
        if isinstance(route, APIRoute) and route.path in ('/', '/health'):
            app.router.routes.insert(0, route)
    app.router.routes.insert(0, APIRoute('/cv/runtime-check', runtime_check, methods=['POST']))
    app.mount('/', service)
    if app.middleware_stack is None:
        app.add_middleware(RuntimeAuth)
    else:
        # Gradio launch has completed its internal startup HTTP calls. Wrap the
        # existing ASGI stack before exposing any application inference routes.
        app.middleware_stack = RuntimeAuth(app.middleware_stack)
    return app


if __name__ == '__main__':
    runtime = create_runtime()
    runtime.launch(server_name='0.0.0.0', prevent_thread_lock=True, ssr_mode=False)
    configure(runtime.app)
    runtime.block_thread()
