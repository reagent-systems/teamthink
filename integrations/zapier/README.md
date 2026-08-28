# Zapier integration (ROADMAP #79)

Trigger TeamThink webhooks from Zapier:

1. Create a webhook subscription in the session **Integrations** panel
2. In Zapier, use **Webhooks by Zapier → Catch Hook** with your URL
3. Map events: `job.completed`, `peer.joined`, `crawl.finished`

Alternatively call the OpenAI gateway:

```
POST http://127.0.0.1:11434/v1/chat/completions
```

Use a TeamThink API key from Profile when keys are configured.
