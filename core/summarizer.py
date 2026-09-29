import os
import re
import time
from rapidfuzz import process, fuzz
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate
from core.models import VideoAnalysisResult

def get_llm(model="mistral-small-latest"):
    return ChatMistralAI(model=model, mistral_api_key=os.getenv("MISTRAL_API_KEY"), temperature=0.0)

def fuzzy_match_proper_nouns(transcript: str, metadata: dict) -> str:
    """
    Extracts title-cased words from transcript and attempts to fuzzy match them 
    against words found in metadata (title/description/tags) to fix basic OCR/STT spelling issues.
    """
    if not metadata:
        return transcript

    meta_text = (metadata.get("title", "") + " " + 
                 metadata.get("description", "") + " " + 
                 " ".join(metadata.get("tags", [])))
    
    # Simple proper noun candidate extraction (words starting with Capital letter)
    candidates = set([w.strip('.,!?"\'') for w in meta_text.split() if w.strip('.,!?"\'').istitle() and len(w) > 2])
    
    if not candidates:
        return transcript

    # Process transcript to find potential mismatches
    words = transcript.split()
    corrected_words = []
    
    for word in words:
        clean_word = word.strip('.,!?"\'')
        # Only fuzzy match if it looks like a proper noun and isn't too short
        if clean_word.istitle() and len(clean_word) > 2:
            # Find best match in metadata candidates
            match = process.extractOne(clean_word, candidates, scorer=fuzz.WRatio)
            if match and match[1] >= 95: # 95 is a very strict high confidence threshold
                # Replace the core word but keep punctuation
                corrected = word.replace(clean_word, match[0])
                corrected_words.append(corrected)
                continue
        corrected_words.append(word)
        
    return " ".join(corrected_words)

def translate_analysis(analysis_dict: dict, target_language: str) -> dict:
    """
    Translates an existing analysis JSON dictionary into a target language quickly.
    """
    import json
    llm = get_llm(model="ministral-8b-2512")
    structured_llm = llm.with_structured_output(VideoAnalysisResult)
    
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are an expert technical translator. You will be provided with a JSON summary of a video.\n"
            "Your task is to translate the string values into {language} and return a valid JSON object matching the exact schema.\n"
            "IMPORTANT RULES:\n"
            "- If {language} is 'hinglish', you MUST use ONLY Roman/Latin script for Hindi words. DO NOT use Devanagari script (e.g., write 'kaam' not 'काम').\n"
            "- If {language} is 'hindi', you MUST use Devanagari script.\n"
            "- Keep technical terms in English if appropriate.\n"
            "- Do not change the JSON structure or keys, only translate the values."
        ),
        ("human", "{json_data}"),
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({
            "language": target_language,
            "json_data": json.dumps(analysis_dict, ensure_ascii=False)
        })
        if result:
            return result.model_dump()
        return analysis_dict # fallback to original if failed
    except Exception as e:
        print(f"Translation failed: {e}")
        return analysis_dict

def analyze_video(transcript: str, language: str = "english", metadata: dict = None) -> VideoAnalysisResult:
    """
    Performs a single-pass extraction to get title, summary, adaptive sections, 
    and suggested questions based on the video type.
    """
    corrected_transcript = fuzzy_match_proper_nouns(transcript, metadata)

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are an expert video assistant. You will be provided with a transcript of a video, along with its metadata (title, description).\n"
            "Your task is to analyze it and output a strict JSON structure matching the required schema.\n"
            "1. First, classify the 'video_type' (e.g., tutorial, meeting, entertainment, debate, lecture, etc.).\n"
            "2. TITLE: Create a factual and short title that describes the actual content. Do NOT use hype words (e.g., fascinating, ultimate, amazing, world of, journey). Keep it direct and factual.\n"
            "3. TLDR: Write a concise tldr summary. Scale the length to the transcript length (e.g. 1 sentence for a 20-second clip). Only include claims explicitly stated in the transcript. Do not add any claims or exaggerations of your own (e.g., do not say 'exponentially faster' or 'instantaneously' unless explicitly stated).\n"
            "4. KEY POINTS: Extract key points. Scale the number of points to the video length (1-2 points for short clips). Do NOT repeat the same point in different words. Keep them distinct.\n"
            "5. SECTIONS: Generate adaptive sections based strictly on the 'video_type' and the actual content spoken. For example, if tutorial, 'Steps' and 'Tools'. If debate, 'Arguments For' and 'Against'. If meeting, 'Action Items'. DO NOT write meta-commentary about the video's quality, tone, or 'entertainment value'. If the video lacks enough content to create sections, return an empty array.\n"
            "6. PROPER NOUNS: Do not blindly trust any single source for proper noun spelling. Consider the transcript, video title, and description as evidence. Do NOT consider the metadata title more authoritative than the transcript. Decide the speaker's identity and proper spelling based on the transcript context. If the title/description seems to have a misspelling, do not copy it. If confidence is low, use a descriptive reference (e.g., 'the England captain') instead of guessing.\n"
            "7. SUGGESTED QUESTIONS: Generate 3 'suggested_questions' that the user could ask a RAG chatbot. Crucially, ONLY suggest questions whose answers are actually present in the transcript.\n"
            "The output MUST be written in {language}."
        ),
        ("human", "Video Title: {title}\nVideo Description: {description}\n\nTranscript:\n\n{text}"),
    ])

    title = metadata.get("title", "") if metadata else ""
    description = metadata.get("description", "") if metadata else ""
    
    models_to_try = ["mistral-small-latest", "ministral-8b-2512"]
    
    for model_name in models_to_try:
        llm = get_llm(model=model_name)
        structured_llm = llm.with_structured_output(VideoAnalysisResult)
        chain = prompt | structured_llm
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                result = chain.invoke({
                    "text": corrected_transcript,
                    "title": title,
                    "description": description,
                    "language": language
                })
                if result:
                    return result
            except Exception as e:
                err_str = str(e).lower()
                if "401" in err_str or "403" in err_str:
                    print(f"Auth/Tier error with {model_name}: {e}. Falling back to next model.")
                    break # Break out of retries for this model, try next model
                
                if attempt == max_retries - 1:
                    if model_name == models_to_try[-1]:
                        raise Exception(f"Failed to extract structured data after {max_retries} attempts: {e}")
                    else:
                        print(f"Failed all retries with {model_name}, trying next model.")
                        break
                
                print(f"Retrying structured extraction with {model_name}... ({attempt + 1}/{max_retries})")
                time.sleep(2 ** attempt) # Simple exponential backoff
    
    raise Exception("Extraction failed to return a result.")
