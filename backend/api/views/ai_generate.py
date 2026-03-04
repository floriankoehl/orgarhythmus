"""
Thin proxy that forwards a prompt to OpenAI and returns the raw
assistant response.  Uses only stdlib (urllib) — zero extra deps.

The OPENAI_API_KEY is read from the .env already loaded by Django
settings (via python-dotenv).
"""

import json
import os
import urllib.request
import urllib.error

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


# Model to use — gpt-4o-mini is cheap (~$0.002 / request)
MODEL = "gpt-4o-mini"
MAX_TOKENS = 4096
TEMPERATURE = 0.7
TIMEOUT_S = 90  # generous timeout for slow responses


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_generate(request):
    """
    POST /api/ai/generate/
    Body: { "prompt": "<assembled prompt text>" }
    Returns: { "content": "<raw assistant message>" }
    """

    prompt = (request.data.get("prompt") or "").strip()
    if not prompt:
        return Response({"error": "No prompt provided"}, status=400)

    api_key = os.getenv("OPENAI_API_KEY", "")
    # python-dotenv may keep surrounding quotes
    api_key = api_key.strip('"').strip("'")
    if not api_key:
        return Response(
            {"error": "OPENAI_API_KEY is not configured on the server"},
            status=500,
        )

    # ── Call OpenAI Chat Completions ──
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": TEMPERATURE,
        "max_tokens": MAX_TOKENS,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Forward the OpenAI error status + body for debugging
        err_body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return Response(
            {"error": f"OpenAI API error {e.code}", "detail": err_body},
            status=502,
        )
    except urllib.error.URLError as e:
        return Response(
            {"error": f"Could not reach OpenAI: {e.reason}"},
            status=502,
        )
    except Exception as e:
        return Response({"error": str(e)}, status=500)

    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )

    return Response({"content": content})
