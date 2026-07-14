"""Code execution service — supports Judge0 CE and Piston (fallback for Apple Silicon)."""

import asyncio
from typing import Optional

import httpx

from src.config.settings import settings

# Judge0 language IDs
JUDGE0_LANGUAGE_MAP = {
    "python": 71,
    "javascript": 63,
    "java": 62,
    "cpp": 54,
    "c": 50,
    "go": 60,
    "ruby": 72,
    "rust": 73,
    "typescript": 74,
    "csharp": 51,
}

# Piston language versions
PISTON_LANGUAGE_MAP = {
    "python": ("python", "3.10"),
    "javascript": ("javascript", "18.15.0"),
    "java": ("java", "15.0.2"),
    "cpp": ("c++", "10.2.0"),
    "c": ("c", "10.2.0"),
    "go": ("go", "1.16.2"),
    "ruby": ("ruby", "3.0.1"),
    "rust": ("rust", "1.68.2"),
    "typescript": ("typescript", "5.0.3"),
    "csharp": ("csharp.net", "5.0.201"),
}


async def _try_judge0(source_code: str, language: str, stdin: str, expected_output: Optional[str]) -> Optional[dict]:
    """Execute via Judge0 CE (RapidAPI cloud or local)."""
    language_id = JUDGE0_LANGUAGE_MAP.get(language)
    if not language_id:
        return None

    headers = {"Content-Type": "application/json"}

    # Add RapidAPI headers if key is configured
    if settings.rapidapi_key:
        headers["X-RapidAPI-Key"] = settings.rapidapi_key
        headers["X-RapidAPI-Host"] = settings.rapidapi_host

    payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin,
        "cpu_time_limit": 10.0,
        "memory_limit": 262144,
        "enable_network": False,
    }
    if expected_output:
        payload["expected_output"] = expected_output

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.judge0_url}/submissions?base64_encoded=false&wait=true",
                headers=headers,
                json=payload,
            )
            if response.status_code not in (200, 201):
                return None
            result = response.json()
            status_id = result.get("status", {}).get("id", 0)
            return {
                "status": result["status"]["description"],
                "status_id": status_id,
                "stdout": (result.get("stdout") or "").strip(),
                "stderr": result.get("stderr") or "",
                "compile_output": result.get("compile_output") or "",
                "time": result.get("time"),
                "memory": result.get("memory"),
                "passed": status_id == 3,
            }
    except Exception as e:
        print(f"Judge0 error: {e}")
        return None


async def _run_piston(source_code: str, language: str, stdin: str) -> dict:
    """Execute code locally using subprocess (prototype fallback for Apple Silicon)."""
    import subprocess
    import tempfile
    import os

    if language != "python":
        return {"status": "Error", "status_id": 0, "passed": False, "stdout": "", "stderr": f"Local execution only supports Python for now. Deploy on Linux for all languages."}

    # Write code to temp file and execute
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(source_code)
        temp_path = f.name

    try:
        result = subprocess.run(
            ["python3", temp_path],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=10,
        )
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        if result.returncode != 0:
            return {
                "status": "Runtime Error",
                "status_id": 11,
                "stdout": stdout,
                "stderr": stderr,
                "compile_output": "",
                "time": None,
                "memory": None,
                "passed": False,
            }

        return {
            "status": "Completed",
            "status_id": 3,
            "stdout": stdout,
            "stderr": stderr,
            "compile_output": "",
            "time": None,
            "memory": None,
            "passed": True,
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "Time Limit Exceeded",
            "status_id": 5,
            "stdout": "",
            "stderr": "Execution exceeded 10 second time limit",
            "compile_output": "",
            "time": None,
            "memory": None,
            "passed": False,
        }
    finally:
        os.unlink(temp_path)


async def run_and_wait(
    source_code: str,
    language: str,
    stdin: str = "",
    expected_output: Optional[str] = None,
    max_wait_seconds: int = 15,
) -> dict:
    """Execute code — tries Judge0 first, falls back to Piston if unavailable."""

    # Try Judge0 first (works on Linux/Intel, fast)
    judge0_result = await _try_judge0(source_code, language, stdin, expected_output)
    if judge0_result is not None:
        return judge0_result

    # Fallback to Piston (works everywhere, including Apple Silicon Macs)
    result = await _run_piston(source_code, language, stdin)

    # Compare output manually if Piston succeeded
    if result["status_id"] == 3 and expected_output:
        actual = result["stdout"].strip()
        expected = expected_output.strip()
        result["passed"] = actual == expected
        if result["passed"]:
            result["status"] = "Accepted"
        else:
            result["status"] = "Wrong Answer"
            result["status_id"] = 4

    return result
