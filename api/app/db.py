# D:\Projects\aura\api\app\db.py
from sqlmodel import SQLModel, create_engine, Session
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DB_PATH, exist_ok=True)
DATABASE_URL = f"sqlite:///{os.path.abspath(os.path.join(DB_PATH, 'aura.db'))}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session() -> Session:
    return Session(engine)
