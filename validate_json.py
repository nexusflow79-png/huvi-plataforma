import json

try:
    with open('c:/PROJETOS_ANTIGRAVITY/huvi_hub-de-vendas-inteligente/n8n/workflows/huvi_opportunity_pipeline.json', 'r', encoding='utf-8') as f:
        json.load(f)
    print("JSON is valid!")
except Exception as e:
    print(f"JSON validation error: {e}")
