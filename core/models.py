from typing import List, Literal, Optional
from pydantic import BaseModel, Field

class KeyPoint(BaseModel):
    text: str = Field(description="A key takeaway or point from the video.")

class SectionItem(BaseModel):
    text: str = Field(description="The text content of the item.")

class Section(BaseModel):
    heading: str = Field(description="The heading of the section (e.g., 'Steps', 'Tools Mentioned', 'Arguments For', 'Topics Discussed', 'Action Items').")
    items: List[SectionItem] = Field(description="List of items under this heading.")

class VideoAnalysisResult(BaseModel):
    title: str = Field(description="A catchy, descriptive AI generated title for the video.")
    video_type: Literal["tutorial", "lecture", "debate", "podcast", "news", "entertainment", "meeting", "other"] = Field(description="The classified type of the video.")
    tldr: str = Field(description="A 2-3 line TL;DR summary of the video. Should scale with video length.")
    key_points: List[KeyPoint] = Field(description="A list of 3-5 main key points from the video.")
    sections: List[Section] = Field(description="Adaptive sections based on the video type. Do not include empty sections. Example: tutorial -> 'Steps', 'Tools Mentioned'; debate -> 'Arguments For', 'Arguments Against'; lecture -> 'Key Concepts'; meeting -> 'Action Items', 'Key Decisions'.")
    suggested_questions: List[str] = Field(description="List of 3 specific questions the user could ask the RAG chat about this video.")
