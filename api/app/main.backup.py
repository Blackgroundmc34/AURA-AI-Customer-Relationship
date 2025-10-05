from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from uuid import uuid4
import re

app = FastAPI(title="AURA API", version="0.2.0")

# ---------------- CORS (dev) ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # dev only; lock down for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- In-memory stores ----------------
CONVERSATIONS: Dict[str, dict] = {}
MESSAGES: Dict[str, dict] = {}
SENTIMENT: Dict[str, dict] = {}
FAQ: Dict[str, dict] = {}

AGENT_API_KEY = "manager-demo-key"  # demo key

# ---------------- Models ----------------
class SendMessageReq(BaseModel):
    customer_id: str
    message: str
    conversation_id: Optional[str] = None

class Message(BaseModel):
    id: str
    conversation_id: str
    sender: str  # 'customer' | 'bot' | 'agent'
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

# ---------------- Helpers: sentiment ----------------
POS_WORDS = {"great", "thanks", "thank you", "love", "awesome", "helpful", "happy", "amazing", "perfect"}
NEG_WORDS = {
    "angry","upset","terrible","hate","late","broken","refund","worst","delay","ridiculous","issue","complaint"
}
URGENT_TOKENS = {
    "urgent","asap","now","immediately","right away","cant","can't","cannot","down","escalate","manager","supervisor"
}

def simple_sentiment(text: str) -> dict:
    t = text.lower()
    # count keyword hits (crude but effective for demo)
    pos = sum(1 for w in POS_WORDS if w in t)
    neg = sum(1 for w in NEG_WORDS if w in t)
    score = 0.0
    if pos > neg:
        score = min(1.0, 0.25 * (pos - neg))
    elif neg > pos:
        score = max(-1.0, -0.25 * (neg - pos))
    label = "pos" if score > 0.05 else ("neg" if score < -0.05 else "neu")
    urgent = any(tok in t for tok in URGENT_TOKENS) or (label == "neg" and neg >= 2)
    return {"score": score, "label": label, "urgent": urgent}

# ---------------- Helpers: intent + replies ----------------
INTENT_RULES = [
    ("refund",   ["refund", "money back", "return"]),
    ("pricing",  ["pricing", "price", "cost", "plan", "plans", "upgrade"]),
    ("delivery", ["delivery", "deliver", "shipping", "ship", "track", "tracking", "order status", "where is my order"]),
    ("payment",  ["payment", "charge", "charged", "bill", "billing", "invoice", "card", "failed", "declined"]),
    ("account",  ["support", "help", "contact", "agent", "human", "login", "password", "reset"]),
    ("greeting", ["hello", "hi ", "hey", "good morning", "good evening", "thanks", "thank you"]),
]

def detect_intent(text: str) -> Optional[str]:
    t = text.lower()
    for intent, keys in INTENT_RULES:
        if any(k in t for k in keys):
            return intent
    return None

def match_faq(text: str) -> Optional[FAQItem]:
    """
    Very small-mvp matcher:
    - token overlap on words >= 4 chars with FAQ question/tags
    - returns first best match over a minimal threshold
    """
    if not FAQ:
        return None

    tokens = set(re.findall(r"[a-zA-Z]{4,}", text.lower()))
    best = None
    best_score = 0
    for item in FAQ.values():
        q_tokens = set(re.findall(r"[a-zA-Z]{4,}", item["question"].lower()))
        tag_tokens = set([t.lower() for t in item.get("tags", [])])
        overlap = len(tokens & (q_tokens | tag_tokens))
        if overlap > best_score:
            best_score = overlap
            best = item
    return FAQItem(**best) if best and best_score >= 1 else None

def generate_reply(user_text: str) -> str:
    # 1) If an FAQ clearly matches, use it
    faq = match_faq(user_text)
    if faq:
        return faq.answer

    # 2) Otherwise use intent rules
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
        return "You can reach support 24/7 via the Help page or email support@example.com. For password resets, use the Reset link on Sign In."
    if intent == "greeting":
        return "Hi! I’m here to help. What can I assist you with today?"

    # 3) Fallback
    return "Thanks for reaching out! I’m here to help. Could you give me a few more details?"

def require_agent(x_api_key: Optional[str]):
    if x_api_key != AGENT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

# ---------------- Routes ----------------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/chat/send", response_model=ChatReply)
async def chat_send(req: SendMessageReq):
    conv_id = req.conversation_id or str(uuid4())
    if conv_id not in CONVERSATIONS:
        CONVERSATIONS[conv_id] = {"id": conv_id, "customer_id": req.customer_id, "created_at": datetime.utcnow()}

    msg_id = str(uuid4())
    msg = Message(id=msg_id, conversation_id=conv_id, sender="customer", text=req.message, ts=datetime.utcnow())
    MESSAGES[msg_id] = msg.dict()

    sent = simple_sentiment(req.message)
    SENTIMENT[msg_id] = sent

    reply_text = generate_reply(req.message)

    bot_id = str(uuid4())
    bot_msg = Message(id=bot_id, conversation_id=conv_id, sender="bot", text=reply_text, ts=datetime.utcnow())
    MESSAGES[bot_id] = bot_msg.dict()

    return ChatReply(
        reply=reply_text,
        sentiment={"score": sent["score"], "label": sent["label"]},
        urgent=sent["urgent"],
        conversation_id=conv_id,
        message_id=msg_id,
    )

@app.get("/api/chat/history", response_model=List[Message])
async def chat_history(conversation_id: str):
    return [Message(**m) for m in MESSAGES.values() if m["conversation_id"] == conversation_id]

@app.get("/api/analytics/summary")
async def analytics_summary(since: Optional[str] = None, x_api_key: Optional[str] = Header(None)):
    require_agent(x_api_key)
    total = len(MESSAGES)
    neg = sum(1 for _, s in SENTIMENT.items() if s["label"] == "neg")
    pos = sum(1 for _, s in SENTIMENT.items() if s["label"] == "pos")
    trend = {"pos": pos, "neg": neg, "neu": total - pos - neg}

    from collections import Counter, defaultdict
    texts = [m["text"].lower() for m in MESSAGES.values() if m["sender"] == "customer"]
    tokens = [t for txt in texts for t in re.findall(r"[a-zA-Z]{4,}", txt)]
    stop = {"please", "thank", "thanks", "order", "issue", "could", "would"}
    keywords = [t for t in tokens if t not in stop]
    top_issues = Counter(keywords).most_common(5)

    urgent_neg_by_customer = defaultdict(int)
    for mid, s in SENTIMENT.items():
        msg = MESSAGES[mid]
        if s["label"] == "neg" and s["urgent"] and msg["sender"] == "customer":
            conv = CONVERSATIONS[msg["conversation_id"]]
            urgent_neg_by_customer[conv["customer_id"]] += 1
    churn = [{"customer_id": cid, "risk": min(1.0, 0.3 * n)} for cid, n in urgent_neg_by_customer.items()]

    return {"volume": total, "sentiment_trend": trend, "top_issues": top_issues, "churn": {"by_customer": churn}}

@app.post("/api/faq", response_model=FAQItem)
async def faq_create(item: FAQItem, x_api_key: Optional[str] = Header(None)):
    require_agent(x_api_key)
    FAQ[item.id] = item.dict()
    return item

@app.get("/api/faq", response_model=List[FAQItem])
async def faq_list(x_api_key: Optional[str] = Header(None)):
    require_agent(x_api_key)
    return [FAQItem(**v) for v in FAQ.values()]

# ---------------- Seed demo data on startup ----------------
@app.on_event("startup")
async def seed_demo_data():
    # add a couple of FAQs so pricing/returns can answer directly
    if not FAQ:
        FAQ["faq_refund"] = FAQItem(
            id="faq_refund",
            question="How do refunds work?",
            answer="Refunds are processed within 5–7 business days to your original payment method.",
            tags=["refund","return","money back"],
        ).dict()
        FAQ["faq_pricing"] = FAQItem(
            id="faq_pricing",
            question="What are your pricing plans?",
            answer="Standard $20/month, Pro $49/month. Annual saves 2 months.",
            tags=["pricing","plans","cost"],
        ).dict()

    if len(MESSAGES) == 0:
        print("🌱 Seeding demo data...")
        sample_msgs = [
            ("cust_001", "I am angry my order is late and want a refund asap"),
            ("cust_002", "Love the product but your support was slow last week"),
            ("cust_003", "Everything was awesome, thank you team!"),
            ("cust_004", "My payment failed again, please fix this now!"),
            ("cust_005", "Website keeps crashing when I try to check out"),
            ("cust_006", "Great experience overall"),
            ("cust_007", "Hate that my delivery was delayed twice"),
        ]
        for cid, msg in sample_msgs:
            req = SendMessageReq(customer_id=cid, message=msg)
            # call handler to reuse sentiment + storage flow
            await chat_send(req)
        print(f"✅ Seeded {len(MESSAGES)} messages across {len(CONVERSATIONS)} conversations.")
