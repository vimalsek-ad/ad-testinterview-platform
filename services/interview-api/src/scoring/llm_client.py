"""LLM Gateway Client — calls Alter Domus AI Gateway for interview scoring.

Uses the OpenAI-compatible format via the centralized LLM Gateway.
Auth: M2M (Agent) flow with Bearer token + x-organization-id header.
"""

import json
from typing import Optional

import httpx

from src.config.settings import settings


async def call_llm(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 1024,
) -> str:
    """Call the LLM Gateway and return the assistant's response text.
    
    Args:
        messages: OpenAI-format messages [{"role": "user", "content": "..."}]
        model: Model ID (default from settings)
        temperature: Sampling temperature (low = deterministic)
        max_tokens: Max response tokens
    
    Returns:
        The assistant's response content as a string.
    """
    url = f"{settings.llm_gateway_url}/chat/completions"
    
    headers = {
        "Content-Type": "application/json",
    }
    
    # Add auth token if configured
    if settings.llm_gateway_token:
        headers["Authorization"] = f"Bearer {settings.llm_gateway_token}"
    
    # Add organization ID for M2M tenant resolution
    if settings.llm_gateway_org_id:
        headers["x-organization-id"] = settings.llm_gateway_org_id

    payload = {
        "model": model or settings.llm_gateway_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()

    # Extract assistant message content
    return result["choices"][0]["message"]["content"]


async def score_interview_response(
    question_prompt: str,
    candidate_response: str,
    scoring_rubric: Optional[dict] = None,
) -> dict:
    """Score a candidate's interview response using the LLM Gateway.
    
    Returns:
        Dict with dimension scores, composite score, confidence, and reasoning.
    """
    rubric_text = ""
    if scoring_rubric:
        rubric_text = f"\n**Scoring Rubric:** {json.dumps(scoring_rubric)}"

    system_prompt = """You are an expert technical interviewer evaluating a candidate's response.
Score the response objectively on these dimensions (0-100 each):
1. Relevance — Does it directly answer the question asked?
2. Completeness — Are all key points and considerations covered?
3. Technical Accuracy — Are the technical claims factually correct?
4. Communication Clarity — Is it well-structured, concise, and easy to follow?

Also provide:
- confidence: A float 0.0-1.0 indicating how confident you are in your scoring
- reasoning: A brief 1-2 sentence explanation of the scores

Respond ONLY in valid JSON format:
{"relevance": <0-100>, "completeness": <0-100>, "accuracy": <0-100>, "clarity": <0-100>, "confidence": <0.0-1.0>, "reasoning": "<explanation>"}"""

    user_message = f"""**Interview Question:** {question_prompt}
{rubric_text}
**Candidate's Response:** {candidate_response}

Score this response. Respond ONLY in JSON format."""

    try:
        response_text = await call_llm(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,  # Low temp for consistent scoring
            max_tokens=512,
        )

        # Parse JSON response
        # Handle potential markdown code blocks in response
        clean_text = response_text.strip()
        if clean_text.startswith("```"):
            clean_text = clean_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        scores = json.loads(clean_text)

        # Calculate composite score (equal weights by default)
        composite = (
            scores.get("relevance", 0) +
            scores.get("completeness", 0) +
            scores.get("accuracy", 0) +
            scores.get("clarity", 0)
        ) / 4

        return {
            "relevance": scores.get("relevance", 0),
            "completeness": scores.get("completeness", 0),
            "accuracy": scores.get("accuracy", 0),
            "clarity": scores.get("clarity", 0),
            "composite_score": round(composite, 1),
            "confidence": scores.get("confidence", 0.5),
            "reasoning": scores.get("reasoning", ""),
            "model_used": settings.llm_gateway_model,
        }

    except (json.JSONDecodeError, KeyError, httpx.HTTPError) as e:
        # Fallback if LLM response can't be parsed
        return {
            "relevance": 0,
            "completeness": 0,
            "accuracy": 0,
            "clarity": 0,
            "composite_score": 0,
            "confidence": 0.0,
            "reasoning": f"Scoring failed: {str(e)}",
            "model_used": settings.llm_gateway_model,
            "error": True,
        }
