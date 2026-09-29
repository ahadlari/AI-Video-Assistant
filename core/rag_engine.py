import os
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage
from core.vector_store import build_vector_store, get_retriever

CHAT_SYSTEM_PROMPT = """\
You are a friendly, concise AI Video Assistant. You help users understand a video they just analyzed.

You handle three cases:

CASE A – Greeting, small talk, or formatting/language instruction (e.g. "hello", "reply in roman english", "shorter answer do"):
Respond naturally and briefly. No need to consult the transcript. Remember any language or format instructions for subsequent replies.

CASE B – A question about the video whose answer IS in the provided context:
Answer using ONLY the context below. Be concise and conversational.

CASE C – A factual or video-related question whose answer is NOT in the provided context:
Say briefly that this was not covered in the video. Do NOT guess or use outside knowledge. Do NOT hallucinate facts.

OUTPUT RULES (apply to ALL cases):
- No preamble like "Here's the answer based on..." or "Based on the transcript..."
- Never mention "context", "transcript", "instructions", or "provided text"
- No "Note:", no "---" dividers, no meta-commentary
- Plain conversational text, minimal markdown
- IMPORTANT: "Hinglish" means Hindi words written in Roman/Latin script ONLY. **ABSOLUTELY NO DEVANAGARI SCRIPT ALLOWED IN YOUR OUTPUT**. Even if the context contains Devanagari, you MUST TRANSLITERATE it into English alphabets (e.g., write "consistency" instead of "कंसिस्टेंट").
- Language priority: user's explicit instruction > their message language > default
- The fallback "not covered in the video" message must also be in the user's language/script (e.g. "Yeh video mein cover nahi hua.").

Context from the video:
{context}"""


def get_llm():
    return ChatMistralAI(
        model="ministral-8b-2512",
        mistral_api_key=os.getenv("MISTRAL_API_KEY"),
        temperature=0.3,
    )


def format_docs(docs):
    """Format retrieved documents. If no relevant docs, return empty string."""
    if not docs:
        return "(No relevant context found for this query.)"
    return "\n\n".join([doc.page_content for doc in docs])


def build_rag_chain(transcript: str):
    """Build an isolated RAG chain for a single video session."""
    vector_store = build_vector_store(transcript)
    retriever = get_retriever(vector_store, k=4)
    return {
        "retriever": retriever,
        "vector_store": vector_store,
    }


def _classify_query(question: str) -> str:
    """Quick heuristic: is this a greeting/instruction or a real question?"""
    q = question.strip().lower()
    greetings = ["hello", "hi", "hey", "hola", "namaste", "salam", "yo",
                 "thanks", "thank you", "shukriya", "dhanyavad", "ok", "okay",
                 "haan", "theek hai", "acha", "bye", "goodbye"]
    
    # Check if it's a pure greeting
    if q in greetings:
        return "greeting"
    
    # Check if it's a formatting/language instruction (no question words)
    instruction_keywords = ["reply in", "respond in", "answer in", "baat karo",
                            "roman english", "hinglish me", "hindi me", "english me",
                            "shorter", "chhota", "lambe", "detail me mat",
                            "bullet point", "simple language"]
    for kw in instruction_keywords:
        if kw in q:
            return "instruction"
    
    return "question"


def _rewrite_query_for_retrieval(question: str, history: list) -> str:
    """If the question is a follow-up like 'aur detail me batao', rewrite it
    using history so the retriever can find relevant chunks."""
    followup_phrases = ["aur", "aur batao", "detail", "elaborate", "explain more",
                        "iske baare mein", "yeh kya hai", "why", "kaise", "kyu"]
    q = question.strip().lower()
    
    is_followup = any(q.startswith(p) or q == p for p in followup_phrases)
    
    if is_followup and history:
        # Find the last substantive question (skip greetings/instructions)
        for msg in reversed(history):
            if msg["role"] == "user" and _classify_query(msg["content"]) == "question":
                return f"{msg['content']} — {question}"
        
    return question


def ask_question(rag_bundle, question: str, history: list = None, language: str = "english") -> str:
    """Ask a question with conversation history support."""
    if history is None:
        history = []
    
    retriever = rag_bundle["retriever"]
    llm = get_llm()
    
    query_type = _classify_query(question)
    
    # For greetings/instructions, don't waste a retrieval call
    if query_type in ("greeting", "instruction"):
        context_text = "(No retrieval needed — this is a greeting or instruction.)"
    else:
        # Rewrite follow-up queries using history
        search_query = _rewrite_query_for_retrieval(question, history)
        docs = retriever.invoke(search_query)
        context_text = format_docs(docs)
    
    # Build the prompt with history
    messages = [("system", CHAT_SYSTEM_PROMPT.format(context=context_text))]
    
    # Add last 6 messages of history
    recent_history = history[-6:] if history else []
    for msg in recent_history:
        if msg["role"] == "user":
            messages.append(("human", msg["content"]))
        else:
            messages.append(("assistant", msg["content"]))
    
    # Build the final user message with language enforcement
    lang_lower = language.strip().lower()
    if lang_lower == "hinglish":
        lang_instruction = "\n\n[LANGUAGE: Reply in Hinglish using ONLY Roman/Latin script. Do NOT use Devanagari characters. Transliterate all Hindi words into Roman letters.]"
    elif lang_lower == "hindi":
        lang_instruction = "\n\n[LANGUAGE: Reply in Hindi using Devanagari script.]"
    else:
        lang_instruction = "\n\n[LANGUAGE: Reply in English.]"
    
    messages.append(("human", question + lang_instruction))
    
    prompt = ChatPromptTemplate.from_messages(messages)
    chain = prompt | llm | StrOutputParser()
    
    answer = chain.invoke({})
    return answer
