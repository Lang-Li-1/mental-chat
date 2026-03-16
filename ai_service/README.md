# AI Service -- Depression Intervention Mock API

Mock Flask service that provides keyword-based response generation and crisis detection.

## Endpoints

| Method | Path            | Description                          |
|--------|-----------------|--------------------------------------|
| POST   | `/respond`      | Generate an empathetic AI reply      |
| POST   | `/crisis_check` | Detect crisis keywords & risk level  |
| GET    | `/health`       | Service health check                 |

## Setup

```bash
cd ai_service
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py              # runs on http://localhost:5000
```

## Example requests

```bash
# Respond
curl -X POST http://localhost:5000/respond \
  -H "Content-Type: application/json" \
  -d '{"text": "我今天好难过"}'

# Crisis check
curl -X POST http://localhost:5000/crisis_check \
  -H "Content-Type: application/json" \
  -d '{"text": "我不想活了"}'

# Health
curl http://localhost:5000/health
```
