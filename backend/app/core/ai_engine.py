import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("app.core.ai_engine")

class CloudAIEngine:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or getattr(settings, "GROQ_API_KEY", "PASTE_YOUR_GROQ_KEY_HERE")
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama-3.1-8b-instant"

    async def is_healthy(self) -> bool:
        """Check if the Groq Cloud API is configured."""
        return self.api_key is not None and self.api_key != "PASTE_YOUR_GROQ_KEY_HERE"

    async def generate_insight(self, prompt: str, system_prompt: str = None) -> str:
        """Asynchronously dispatches text completion requests to the Groq Cloud model."""
        if not self.api_key or self.api_key == "PASTE_YOUR_GROQ_KEY_HERE":
            logger.warning("Groq API key has not been configured. Running in offline fallback mode.")
            return "Local AI engine is in offline fallback mode because the Groq API key is not configured."

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system", 
                    "content": system_prompt or "You are a senior business intelligence data analyst."
                },
                {
                    "role": "user", 
                    "content": prompt
                }
            ],
            "temperature": 0.2
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        try:
            # 15-second timeout for cloud REST inference request
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()
                    return "No content returned from Groq completion API."
                elif response.status_code == 429:
                    msg = "Groq Cloud API rate limit exceeded (HTTP 429)."
                    logger.warning(msg)
                    return f"AI insight generation failed: {msg} Please try again shortly."
                else:
                    msg = f"Groq Cloud API returned status code {response.status_code}: {response.text}"
                    logger.warning(msg)
                    return f"AI insight generation failed. Connection Exception: {msg}"
                    
        except httpx.ConnectError as e:
            msg = f"Connection refused to Groq API endpoints: {str(e)}"
            logger.warning(msg)
            return f"Groq Cloud API is unreachable. Connection Exception: {msg}"
        except httpx.TimeoutException as e:
            msg = f"Groq Cloud API request timed out: {str(e)}"
            logger.warning(msg)
            return f"Groq Cloud API request timed out. Connection Exception: {msg}"
        except Exception as e:
            msg = f"Unexpected error executing Groq Cloud API request: {str(e)}"
            logger.warning(msg)
            return f"Unexpected error communicating with cloud AI service. Connection Exception: {msg}"

# Instantiate the default production engine
cloud_ai_engine = CloudAIEngine()
