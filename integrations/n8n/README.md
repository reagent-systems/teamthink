# n8n integration (ROADMAP #79)

## Webhook trigger

Use n8n **Webhook** node pointing at your TeamThink webhook URL.

## HTTP Request node

```
POST http://127.0.0.1:11434/v1/chat/completions
Headers: Authorization: Bearer <api-key>
Body: { "model": "smollm2-360m", "messages": [{ "role": "user", "content": "{{ $json.prompt }}" }] }
```

Import workflow template from this directory (create webhook → HTTP request → respond).
