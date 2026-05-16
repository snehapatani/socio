"""Service layer — business logic split out from routers.

Each module owns one concern:
  - captions.py         AI caption generation (Claude)
  - image_generator.py  AI image generation (Imagen)
  - media_selector.py   Pick which media to use
  - post_scheduler.py   Pick when posts go out
  - ig_publisher.py     Instagram Graph API
  - post_insights.py    Fetch & store metrics
"""
