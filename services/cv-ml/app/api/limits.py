"""Bound HTTP body memory before JSON/base64 parsing, including chunked requests."""
from starlette.responses import JSONResponse

class BodyLimit:
    def __init__(self, app, maximum=16_000_000):
        self.app, self.maximum = app, maximum

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope.get('method') != 'POST':
            return await self.app(scope, receive, send)
        headers = dict(scope.get('headers', []))
        try:
            length = int(headers.get(b'content-length', b'0'))
        except ValueError:
            return await JSONResponse({'detail': 'Invalid content length'}, status_code=400)(scope, receive, send)
        if length > self.maximum:
            return await JSONResponse({'detail': 'Request exceeds 16 MB'}, status_code=413)(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            body.extend(message.get('body', b''))
            if len(body) > self.maximum:
                return await JSONResponse({'detail': 'Request exceeds 16 MB'}, status_code=413)(scope, receive, send)
            if not message.get('more_body', False):
                break
        delivered = False
        async def replay():
            nonlocal delivered
            if delivered: return await receive()
            delivered = True
            return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
        await self.app(scope, replay, send)
