from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import uuid4
import re
from collections import Counter, defaultdict

from .db import init_db, get_session
from .models import Conversation, Message, Sentiment, FAQ as FAQModel
from sqlmodel import select

app = FastAPI(title="AURA API", version="0.3.0")

# --- CORS (dev) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AGENT_API_KEY = "manager-demo-key"  # demo key

# ---------- Pydantic I/O ----------
class SendMessageReq(BaseModel):
    customer_id: str
    message: str
    conversation_id: Optional[str] = None

class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender: str
    text: str
    ts: datetime

class ChatReply(BaseModel):
    reply: str
    sentiment: dict
    urgent: bool
    conversation_id: str
    message_id: str

class FAQItem(BaseModel):
    id: str
    question: str
    answer: str
    tags: List[str] = []

# ---------- Sentiment & intent ----------
POS_WORDS = {"great","thanks","thank you","love","awesome","helpful","happy","amazing","perfect"}
NEG_WORDS = {"angry","upset","terrible","hate","late","broken","refund","worst","delay","ridiculous","issue","complaint"}
URGENT_TOKENS = {"urgent","asap","now","immediately","right away","cant","can't","cannot","down","escalate","manager","supervisor"}

INTENT_RULES = [
    ("refund",   ["refund","money back","return"]),
    ("pricing",  ["pricing","price","cost","plan","plans","upgrade"]),
    ("delivery", ["delivery","deliver","shipping","ship","track","tracking","order status","where is my order"]),
    ("payment",  ["payment","charge","charged","bill","billing","invoice","card","failed","declined"]),
    ("account",  ["support","help","contact","agent","human","login","password","reset"]),
    ("greeting", ["hello","hi ","hey","good morning","good evening","thanks","thank you"]),
]
# --- Conversation summary DTO ---
class ConversationSummary(BaseModel):
    id: str
    customer_id: str
    last_text: str
    last_ts: datetime

@app.get("/api/conversations", response_model=List[ConversationSummary])
def list_conversations(x_api_key: Optional[str] = Header(None)):
    # Optional: restrict to managers; remove next line if you want it public
    require_agent(x_api_key)

    with get_session() as session:
        # Pull all messages ordered by ts desc, then keep the first per conversation
        rows = session.exec(
            select(Message, Conversation)
            .where(Message.conversation_id == Conversation.id)
            .order_by(Message.ts.desc())
        ).all()

        seen = set()
        out: List[ConversationSummary] = []
        for m, c in rows:
            if c.id in seen:
                continue
            seen.add(c.id)
            out.append(ConversationSummary(
                id=c.id,
                customer_id=c.customer_id,
                last_text=m.text,
                last_ts=m.ts
            ))
        # newest first already, but you can sort again if needed
        return out


def simple_sentiment(text: str) -> dict:
    t = text.lower()
    pos = sum(1 for w in POS_WORDS if w in t)
    neg = sum(1 for w in NEG_WORDS if w in t)
    score = 0.0
    if pos > neg: score = min(1.0, 0.25*(pos-neg))
    elif neg > pos: score = max(-1.0, -0.25*(neg-pos))
    label = "pos" if score > 0.05 else ("neg" if score < -0.05 else "neu")
    urgent = any(tok in t for tok in URGENT_TOKENS) or (label=="neg" and neg>=2)
    return {"score": score, "label": label, "urgent": urgent}

def detect_intent(text: str) -> Optional[str]:
    t = text.lower()
    for intent, keys in INTENT_RULES:
        if any(k in t for k in keys):
            return intent
    return None

def match_faq(text: str, session) -> Optional[FAQModel]:
    tokens = set(re.findall(r"[a-zA-Z]{4,}", text.lower()))
    if not tokens: return None
    best, best_score = None, 0
    for faq in session.exec(select(FAQModel)).all():
        q_tokens = set(re.findall(r"[a-zA-Z]{4,}", faq.question.lower()))
        tag_tokens = set([t.lower() for t in (faq.tags or [])])
        overlap = len(tokens & (q_tokens | tag_tokens))
        if overlap > best_score:
            best_score, best = overlap, faq
    return best if best_score >= 1 else None

def generate_reply(user_text: str, session) -> str:
    f = match_faq(user_text, session)
    if f: return f.answer
    intent = detect_intent(user_text)
    if intent == "refund":
        return "I’m sorry about the trouble. I can help with refunds. Could you share your order ID?"
    if intent == "pricing":
        return "Sure — our Standard plan is $20/month and Pro is $49/month. Would you like monthly or annual details?"
    if intent == "delivery":
        return "I can check that. Please share your order ID and I’ll look up your shipment status right away."
    if intent == "payment":
        return "Got it — payment issues are frustrating. Do you see an error message? I can help retry or switch the method."
    if intent == "account":
        return "You can reach support 24/7 via the Help page or email support@example.com. For password resets, use the Reset link."
    if intent == "greeting":
        return "Hi! I’m here to help. What can I assist you with today?"
    return "Thanks for reaching out! I’m here to help. Could you give me a few more details?"

def require_agent(x_api_key: Optional[str]):
    if x_api_key != AGENT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

# ---------- Routes ----------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/chat/send", response_model=ChatReply)
def chat_send(req: SendMessageReq):
    from sqlmodel import select
    with get_session() as session:
        conv_id = req.conversation_id or str(uuid4())
        conv = session.get(Conversation, conv_id)
        if not conv:
            conv = Conversation(id=conv_id, customer_id=req.customer_id)
            session.add(conv); session.commit()

        msg_id = str(uuid4())
        m = Message(id=msg_id, conversation_id=conv_id, sender="customer", text=req.message)
        session.add(m)

        sent = simple_sentiment(req.message)
        s = Sentiment(id=str(uuid4()), message_id=msg_id, score=sent["score"], label=sent["label"], urgent=sent["urgent"])
        session.add(s)

        reply_text = generate_reply(req.message, session)

        bot_id = str(uuid4())
        session.add(Message(id=bot_id, conversation_id=conv_id, sender="bot", text=reply_text))
        session.commit()

        return ChatReply(
            reply=reply_text,
            sentiment={"score": sent["score"], "label": sent["label"]},
            urgent=sent["urgent"],
            conversation_id=conv_id,
            message_id=msg_id,
        )

@app.get("/api/chat/history", response_model=List[MessageOut])
def chat_history(conversation_id: str):
    with get_session() as session:
        rows = session.exec(
            select(Message).where(Message.conversation_id==conversation_id).order_by(Message.ts.asc())
        ).all()
        return [MessageOut(id=r.id, conversation_id=r.conversation_id, sender=r.sender, text=r.text, ts=r.ts) for r in rows]

@app.get("/api/analytics/summary")
def analytics_summary(since: Optional[str] = None, x_api_key: Optional[str] = Header(None)):
    require_agent(x_api_key)
    with get_session() as session:
        # Get all customer messages once; reuse for total + tokens
        customer_msgs = session.exec(
            select(Message).where(Message.sender == "customer")
        ).all()
        total_count = len(customer_msgs)

        # sentiment counts from Sentiment table
        labels = {"pos": 0, "neg": 0, "neu": 0}
        for s in session.exec(select(Sentiment)).all():
            labels[s.label] = labels.get(s.label, 0) + 1

        # top issues from customer messages
        texts = [m.text.lower() for m in customer_msgs]
        tokens = [t for txt in texts for t in re.findall(r"[a-zA-Z]{4,}", txt)]
        stop = {"please", "thank", "thanks", "order", "issue", "could", "would"}
        keywords = [t for t in tokens if t not in stop]
        top_issues = Counter(keywords).most_common(5)

        # churn heuristic: urgent negative per customer
        urgent_neg_by_customer = defaultdict(int)
        q = session.exec(
            select(Message, Sentiment, Conversation)
            .where(Message.id == Sentiment.message_id)
            .where(Message.sender == "customer")
            .where(Message.conversation_id == Conversation.id)
        ).all()
        for m, s, c in q:
            if s.label == "neg" and s.urgent:
                urgent_neg_by_customer[c.customer_id] += 1
        churn = [{"customer_id": cid, "risk": min(1.0, 0.3 * n)} for cid, n in urgent_neg_by_customer.items()]

        return {
            "volume": total_count,
            "sentiment_trend": {"pos": labels["pos"], "neg": labels["neg"], "neu": labels["neu"]},
            "top_issues": top_issues,
            "churn": {"by_customer": churn},
        }


@app.post("/api/faq", response_model=FAQItem)
def faq_create(item: FAQItem, x_api_key: Optional[str] = Header(None)):
    require_agent(x_api_key)
    with get_session() as session:
        faq = FAQModel(id=item.id, question=item.question, answer=item.answer, tags=item.tags or [])
        session.add(faq); session.commit()
        return item

@app.get("/api/faq", response_model=List[FAQItem])
def faq_list(x_api_key: Optional[str] = Header(None)):
    require_agent(x_api_key)
    with get_session() as session:
        rows = session.exec(select(FAQModel)).all()
        return [FAQItem(id=r.id, question=r.question, answer=r.answer, tags=r.tags or []) for r in rows]

# ---------- Startup: init DB + seed ----------
@app.on_event("startup")
def on_startup():
    init_db()
    with get_session() as session:
        # seed FAQs once
        if session.exec(select(FAQModel)).first() is None:
            session.add_all([
                FAQModel(id="faq_refund",  question="How do refunds work?",
                         answer="Refunds are processed within 5–7 business days to your original payment method.",
                         tags=["refund","return","money back"]),
                FAQModel(id="faq_pricing", question="What are your pricing plans?",
                         answer="Standard $20/month, Pro $49/month. Annual saves 2 months.",
                         tags=["pricing","plans","cost"]),
            ])
            session.commit()

        # seed sample messages once
        if session.exec(select(Message)).first() is None:
            print("🌱 Seeding demo data...")
            seeds = [
                ("cust_001","I am angry my order is late and want a refund asap"),
                ("cust_002","Love the product but your support was slow last week"),
                ("cust_003","Everything was awesome, thank you team!"),
                ("cust_004","My payment failed again, please fix this now!"),
                ("cust_005","Website keeps crashing when I try to check out"),
                ("cust_006","Great experience overall"),
                ("cust_007","Hate that my delivery was delayed twice"),
            ]
            for cid, text in seeds:
                conv_id = str(uuid4())
                session.add(Conversation(id=conv_id, customer_id=cid))
                msg_id = str(uuid4())
                session.add(Message(id=msg_id, conversation_id=conv_id, sender="customer", text=text))
                s = simple_sentiment(text)
                session.add(Sentiment(id=str(uuid4()), message_id=msg_id, score=s["score"], label=s["label"], urgent=s["urgent"]))
                session.add(Message(id=str(uuid4()), conversation_id=conv_id, sender="bot", text="Thanks! Noted."))
            session.commit()
            print("✅ Seed complete.")

