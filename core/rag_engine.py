import os
from langchain_mistralai import ChatMistralAI, MistralAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

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


def get_embeddings():
    """Returns Mistral Embeddings model which produces 1024-dim vectors."""
    return MistralAIEmbeddings(
        model="mistral-embed",
        mistral_api_key=os.getenv("MISTRAL_API_KEY")
    )


def classify_query(question: str) -> str:
    """Quick heuristic: is this a greeting/instruction or a real question?"""
    q = question.strip().lower()
    greetings = ["hello", "hi", "hey", "hola", "namaste", "salam", "yo",
                 "thanks", "thank you", "shukriya", "dhanyavad", "ok", "okay",
                 "haan", "theek hai", "acha", "bye", "goodbye"]
    
    if q in greetings:
        return "greeting"
    
    instruction_keywords = ["reply in", "respond in", "answer in", "baat karo",
                            "roman english", "hinglish me", "hindi me", "english me",
                            "shorter", "chhota", "lambe", "detail me mat",
                            "bullet point", "simple language"]
    for kw in instruction_keywords:
        if kw in q:
            return "instruction"
    
    return "question"


def rewrite_query_for_retrieval(question: str, history: list) -> str:
    """If the question is a follow-up like 'aur detail me batao', rewrite it
    using history so the retriever can find relevant chunks."""
    followup_phrases = ["aur", "aur batao", "detail", "elaborate", "explain more",
                        "iske baare mein", "yeh kya hai", "why", "kaise", "kyu"]
    q = question.strip().lower()
    
    is_followup = any(q.startswith(p) or q == p for p in followup_phrases)
    
    if is_followup and history:
        for msg in reversed(history):
            if msg["role"] == "user" and classify_query(msg["content"]) == "question":
                return f"{msg['content']} — {question}"
        
    return question


def ask_question(context_text: str, question: str, history: list = None, language: str = "english") -> str:
    """Ask a question with conversation history support using raw context text."""
    if history is None:
        history = []
    
    llm = get_llm()
    query_type = classify_query(question)
    
    if query_type in ("greeting", "instruction"):
        context_text = "(No retrieval needed — this is a greeting or instruction.)"
    
    messages = [("system", CHAT_SYSTEM_PROMPT.format(context=context_text))]
    
    recent_history = history[-6:] if history else []
    for msg in recent_history:
        if msg["role"] == "user":
            messages.append(("human", msg["content"]))
        else:
            messages.append(("assistant", msg["content"]))
    
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

