# D:\Projects\aura\api\app\models.py
from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Column, JSON

class Conversation(SQLModel, table=True):
    id: str = Field(primary_key=True, index=True)
    customer_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    messages: List["Message"] = Relationship(back_populates="conversation")

class Message(SQLModel, table=True):
    id: str = Field(primary_key=True, index=True)
    conversation_id: str = Field(foreign_key="conversation.id", index=True)
    sender: str
    text: str
    ts: datetime = Field(default_factory=datetime.utcnow)
    conversation: Optional[Conversation] = Relationship(back_populates="messages")
    sentiment: Optional["Sentiment"] = Relationship(back_populates="message")

class Sentiment(SQLModel, table=True):
    id: str = Field(primary_key=True, index=True)
    message_id: str = Field(foreign_key="message.id", unique=True)
    score: float
    label: str
    urgent: bool = False
    message: Optional[Message] = Relationship(back_populates="sentiment")

class FAQ(SQLModel, table=True):
    id: str = Field(primary_key=True, index=True)
    question: str
    answer: str
    tags: List[str] = Field(sa_column=Column(JSON))
