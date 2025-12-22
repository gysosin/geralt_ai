"""
Quiz Service

Handles quiz creation, management, and submission.
Extracted from bot_management_service.py for single responsibility.
"""
from datetime import datetime
from uuid import uuid4
from typing import Any, Dict, List, Optional

import jwt

from config import Config
from models.database import (
    quiz_collection,
    quiz_attempts_collection,
    quiz_results_collection,
    conversation_collection,
)
from services.bots import BaseService, ServiceResult


class QuizService(BaseService):
    """
    Service for quiz management.
    
    Responsibilities:
    - Start quiz attempts
    - Save quiz progress
    - Submit and score quizzes
    - Retrieve quiz details and results
    - Manage quiz lifecycle (CRUD)
    """
    
    def __init__(self):
        super().__init__()
        self.quizzes_db = quiz_collection
        self.attempts_db = quiz_attempts_collection
        self.results_db = quiz_results_collection
        self.conversations_db = conversation_collection
    
    # =========================================================================
    # Quiz Attempt Operations
    # =========================================================================
    
    def start_quiz(self, identity: str, quiz_id: str, bot_token: Optional[str] = None) -> ServiceResult:
        """
        Start or resume a quiz attempt.
        
        Args:
            identity: User's identity
            quiz_id: Quiz to start
            bot_token: Optional bot token for context
            
        Returns:
            ServiceResult with quiz data and attempt ID
        """
        try:
            username = self.extract_username(identity)
            
            quiz = self.quizzes_db.find_one({"_id": quiz_id})
            if not quiz:
                return ServiceResult.fail("Quiz not found.", 404)
            
            # Check for existing unsubmitted attempt
            existing_attempt = self.attempts_db.find_one({
                "quiz_id": quiz_id,
                "username": username,
                "submitted": False
            })
            
            if existing_attempt:
                # Resume existing attempt
                attempt_id = existing_attempt["_id"]
                current_answers = existing_attempt.get("answers", {})
            else:
                # Create new attempt
                attempt_id = str(uuid4())
                self.attempts_db.insert_one({
                    "_id": attempt_id,
                    "quiz_id": quiz_id,
                    "username": username,
                    "answers": {},
                    "submitted": False,
                    "started_at": datetime.utcnow(),
                })
                current_answers = {}
            
            # Remove correct_option from questions
            questions = []
            for q in quiz.get("questions", []):
                questions.append({
                    "question_id": q.get("question_id"),
                    "question": q.get("question"),
                    "options": q.get("options"),
                    "selected_option": current_answers.get(q.get("question_id"), ""),
                })
            
            return ServiceResult.ok({
                "quiz_id": quiz_id,
                "attempt_id": attempt_id,
                "category": quiz.get("category", "General"),
                "query": quiz.get("query", "Untitled Quiz"),
                "questions": questions,
                "inProgress": True,
                "isSubmitted": False,
                "isStarted": True,
            })
            
        except Exception as e:
            self.logger.error(f"Error starting quiz: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def save_progress(
        self,
        identity: str,
        quiz_id: str,
        attempt_id: str,
        question_id: str,
        selected_option: str
    ) -> ServiceResult:
        """
        Save answer for a specific question.
        
        Args:
            identity: User's identity
            quiz_id: Quiz ID
            attempt_id: Attempt ID
            question_id: Question being answered
            selected_option: Selected answer option
            
        Returns:
            ServiceResult with success message
        """
        try:
            username = self.extract_username(identity)
            
            attempt = self.attempts_db.find_one({
                "_id": attempt_id,
                "quiz_id": quiz_id,
                "username": username,
                "submitted": False
            })
            
            if not attempt:
                return ServiceResult.fail("Quiz attempt not found or already submitted.", 404)
            
            self.attempts_db.update_one(
                {"_id": attempt_id},
                {"$set": {f"answers.{question_id}": selected_option}}
            )
            
            return ServiceResult.ok({"message": "Progress saved successfully."})
            
        except Exception as e:
            self.logger.error(f"Error saving progress: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def submit_quiz(self, identity: str, quiz_id: str, attempt_id: str) -> ServiceResult:
        """
        Submit a quiz attempt and calculate score.
        
        Args:
            identity: User's identity
            quiz_id: Quiz ID
            attempt_id: Attempt ID
            
        Returns:
            ServiceResult with submission data and score
        """
        try:
            username = self.extract_username(identity)
            
            if not quiz_id or not attempt_id:
                return ServiceResult.fail("Quiz ID and Attempt ID are required.", 400)
            
            attempt = self.attempts_db.find_one({
                "_id": attempt_id,
                "quiz_id": quiz_id,
                "username": username
            })
            
            if not attempt:
                return ServiceResult.fail("Quiz attempt not found.", 404)
            
            if attempt.get("submitted", False):
                return ServiceResult.fail("Quiz already submitted.", 400)
            
            # Get user answers
            user_answers = attempt.get("answers", {})
            if isinstance(user_answers, list):
                user_answers = {
                    ans["question_id"]: ans["selected_option"]
                    for ans in user_answers
                }
            
            # Get quiz with correct answers
            quiz = self.quizzes_db.find_one({"_id": quiz_id})
            if not quiz:
                return ServiceResult.fail("Quiz not found.", 404)
            
            # Calculate score
            questions = quiz.get("questions", [])
            total_questions = len(questions)
            
            correct_answer_map = {
                q["question_id"]: q["correct_option"]
                for q in questions
                if "correct_option" in q
            }
            
            if not correct_answer_map:
                return ServiceResult.fail("Quiz has no correct answers configured.", 500)
            
            correct_count = sum(
                1 for qid, correct in correct_answer_map.items()
                if user_answers.get(qid) == correct
            )
            
            score_percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0
            current_time = datetime.utcnow()
            
            # Update attempt
            self.attempts_db.update_one(
                {"_id": attempt_id},
                {
                    "$set": {
                        "submitted": True,
                        "score_percentage": score_percentage,
                        "submitted_at": current_time,
                        "inProgress": False,
                        "isSubmitted": True,
                    }
                }
            )
            
            # Store result
            self.results_db.insert_one({
                "_id": attempt_id,
                "quiz_id": quiz_id,
                "username": username,
                "score_percentage": score_percentage,
                "submitted_at": current_time,
                "answers": user_answers,
            })
            
            # Update quiz stats
            self.quizzes_db.update_one(
                {"_id": quiz_id},
                {
                    "$inc": {"attempts": 1},
                    "$push": {
                        "user_attempts": {
                            "username": username,
                            "score_percentage": score_percentage,
                            "submitted_at": current_time,
                        }
                    }
                }
            )
            
            # Build answer map with correct/user answers
            answer_map = {
                qid: {"system": correct, "user": user_answers.get(qid)}
                for qid, correct in correct_answer_map.items()
            }
            
            submission_data = {
                "message": f"You scored {score_percentage:.2f}%.",
                "score_percentage": score_percentage,
                "correct_answers_count": correct_count,
                "total_questions": total_questions,
                "answer_map": answer_map,
            }
            
            # Update conversation quiz block
            self.conversations_db.update_one(
                {
                    "username": username,
                    "messages.content.quiz.quiz_id": quiz_id,
                    "messages.content.quiz.attempt_id": attempt_id,
                },
                {
                    "$set": {
                        "messages.$[m].content.quiz.isSubmitted": True,
                        "messages.$[m].content.quiz.inProgress": False,
                        "messages.$[m].content.quiz.submission_data": submission_data,
                    }
                },
                array_filters=[{
                    "m.content.quiz.quiz_id": quiz_id,
                    "m.content.quiz.attempt_id": attempt_id,
                }]
            )
            
            self.log_operation("submit_quiz", username=username, quiz_id=quiz_id, score=score_percentage)
            
            return ServiceResult.ok({"submission_data": submission_data})
            
        except Exception as e:
            self.logger.error(f"Error submitting quiz: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    # =========================================================================
    # Quiz CRUD Operations
    # =========================================================================
    
    def get_quiz(self, identity: str, quiz_id: str) -> ServiceResult:
        """Get quiz details by ID."""
        try:
            username = self.extract_username(identity)
            
            quiz = self.quizzes_db.find_one(
                {"_id": quiz_id},
                {
                    "_id": 1,
                    "category": 1,
                    "questions": 1,
                    "attempts": 1,
                    "query": 1,
                    "created_at": 1,
                }
            )
            
            if not quiz:
                return ServiceResult.fail("Quiz not found.", 404)
            
            # Remove correct_option from questions
            questions = [
                {
                    "question_id": q["question_id"],
                    "question": q["question"],
                    "options": q["options"],
                }
                for q in quiz.get("questions", [])
            ]
            
            # Get current attempt if exists
            attempt = self.attempts_db.find_one({
                "quiz_id": quiz_id,
                "username": username,
                "submitted": False
            })
            
            return ServiceResult.ok({
                "quiz_id": quiz["_id"],
                "category": quiz.get("category", "General"),
                "query": quiz.get("query", "Untitled Quiz"),
                "questions": questions,
                "attempts": quiz.get("attempts", 0),
                "attempt_id": attempt["_id"] if attempt else None,
                "current_answers": attempt.get("answers", {}) if attempt else {},
            })
            
        except Exception as e:
            self.logger.error(f"Error getting quiz: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def list_quizzes(self, identity: str) -> ServiceResult:
        """List all quizzes for a user."""
        try:
            username = self.extract_username(identity)
            
            quizzes = list(self.quizzes_db.find(
                {"username": username},
                {"_id": 1, "category": 1, "query": 1, "attempts": 1, "created_at": 1}
            ))
            
            return ServiceResult.ok({"quizzes": quizzes})
            
        except Exception as e:
            self.logger.error(f"Error listing quizzes: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def get_quiz_results(self, identity: str) -> ServiceResult:
        """Get all quiz results for a user."""
        try:
            username = self.extract_username(identity)
            
            results = list(self.results_db.find({"username": username}))
            
            return ServiceResult.ok({"results": results})
            
        except Exception as e:
            self.logger.error(f"Error getting quiz results: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def delete_quiz(self, identity: str, quiz_id: str) -> ServiceResult:
        """Delete a quiz and its attempts."""
        try:
            username = self.extract_username(identity)
            
            quiz = self.quizzes_db.find_one({"_id": quiz_id, "username": username})
            if not quiz:
                return ServiceResult.fail("Quiz not found or access denied.", 404)
            
            # Delete quiz, attempts, and results
            self.quizzes_db.delete_one({"_id": quiz_id})
            self.attempts_db.delete_many({"quiz_id": quiz_id})
            self.results_db.delete_many({"quiz_id": quiz_id})
            
            self.log_operation("delete_quiz", username=username, quiz_id=quiz_id)
            
            return ServiceResult.ok({"message": "Quiz deleted successfully."})
            
        except Exception as e:
            self.logger.error(f"Error deleting quiz: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def get_quiz_attempts(self, identity: str, quiz_id: str) -> ServiceResult:
        """Get all attempts for a quiz."""
        try:
            username = self.extract_username(identity)
            
            attempts = list(self.attempts_db.find({
                "quiz_id": quiz_id,
                "username": username
            }))
            
            return ServiceResult.ok({"attempts": attempts})
            
        except Exception as e:
            self.logger.error(f"Error getting quiz attempts: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)

    async def create_quiz_from_query(
        self, 
        query: str, 
        username: str, 
        bot_token: str,
        collection_ids: List[str]
    ) -> ServiceResult:
        """
        Creates a quiz from relevant chunks in Elasticsearch.
        """
        import json
        from core.ai.factory import AIProviderFactory
        from core.rag.retriever import HybridRetriever
        from clients import es_client

        try:
            # 1. Retrieve Content
            embedder = AIProviderFactory.get_embedding_provider()
            retriever = HybridRetriever(es_client, embedder)
            
            results = await retriever.retrieve(query, collection_ids=collection_ids, top_k=10)
            
            if not results:
                return ServiceResult.fail("No relevant content found for quiz generation.", 404)
                
            combined_text = "\n\n".join(r.content for r in results)
            
            # 2. Generate Quiz Questions via LLM
            llm = AIProviderFactory.get_llm_provider()
            
            prompt = f"""
You are an AI that generates multiple-choice quiz questions from the provided content.

Content:
\"\"\"{combined_text}\"\"\"

Instructions:
- Create exactly 5 MCQs with 4 options each: A,B,C,D.
- Indicate correct_option clearly.
- Return only JSON, no extra text.

Example:
[
  {{
    "question": "What is ...?",
    "options": {{
      "A": "...",
      "B": "...",
      "C": "...",
      "D": "..."
    }},
    "correct_option": "C"
  }},
  ...
]
"""
            quiz_resp = await llm.complete(prompt, max_tokens=1000)
            
            # Parse JSON
            try:
                json_start = quiz_resp.find("[")
                json_end = quiz_resp.rfind("]")
                if json_start == -1 or json_end == -1:
                    raise ValueError("Could not extract JSON array from response")
                
                raw_json = quiz_resp[json_start : json_end + 1]
                questions = json.loads(raw_json)
                
                for q in questions:
                    q["question_id"] = str(uuid4())
                    
            except Exception as e:
                return ServiceResult.fail(f"Failed to generate valid quiz format: {e}", 500)

            # 3. Create Quiz & Attempt
            quiz_id = str(uuid4())
            
            # Categorize
            cat_prompt = f"Classify the quiz category from the query: '{query}'. Output a short phrase."
            category = (await llm.complete(cat_prompt, max_tokens=10)).strip() or "General"
            
            quiz_data = {
                "_id": quiz_id,
                "username": username,
                "category": category,
                "questions": questions,
                "created_at": datetime.utcnow(),
                "query": query,
                "bot_token": bot_token,
            }
            self.quizzes_db.insert_one(quiz_data)
            
            # Start Attempt
            attempt_id = str(uuid4())
            self.attempts_db.insert_one({
                "_id": attempt_id,
                "quiz_id": quiz_id,
                "username": username,
                "answers": {},
                "submitted": False,
                "started_at": datetime.utcnow(),
            })
            
            # Prepare response (remove correct answers)
            questions_safe = [
                {k: v for k, v in q.items() if k != "correct_option"} 
                for q in questions
            ]

            return ServiceResult.ok({
                "message": "Quiz created successfully",
                "quiz_id": quiz_id,
                "attempt_id": attempt_id,
                "category": category,
                "questions": questions_safe,
                "query": query,
            })

        except Exception as e:
            self.logger.error(f"Error creating quiz: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)


# Singleton instance
_quiz_service_instance: Optional[QuizService] = None


def get_quiz_service() -> QuizService:
    """Get or create the quiz service singleton."""
    global _quiz_service_instance
    if _quiz_service_instance is None:
        _quiz_service_instance = QuizService()
    return _quiz_service_instance
