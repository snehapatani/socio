from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, businesses, posts, approve, dashboard
from config import settings
from scheduler import start_scheduler

app = FastAPI(title="Socio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/auth",      tags=["auth"])
app.include_router(businesses.router, prefix="/businesses", tags=["businesses"])
app.include_router(posts.router,      prefix="/posts",     tags=["posts"])
app.include_router(approve.router,    prefix="/approve",   tags=["approve"])
app.include_router(dashboard.router,  prefix="/dashboard", tags=["dashboard"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "Socio API"}

@app.on_event("startup")
def startup():
    start_scheduler()
