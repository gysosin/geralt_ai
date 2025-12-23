"""
Analytics Service

Handles quiz analytics, performance analysis, and dashboard summaries.
Extracted from bot_management_service.py for single responsibility.
"""
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Optional

from models.database import (
    quiz_collection,
    quiz_attempts_collection,
    quiz_results_collection,
)
from services.bots import BaseService, ServiceResult


class AnalyticsService(BaseService):
    """
    Service for quiz analytics and performance tracking.
    
    Responsibilities:
    - Dashboard summary generation
    - Performance analysis
    - Progress tracking
    - Quiz recommendations
    - Category-based analytics
    """
    
    def __init__(self):
        super().__init__()
        self.quizzes_db = quiz_collection
        self.attempts_db = quiz_attempts_collection
        self.results_db = quiz_results_collection
    
    def get_dashboard_summary(self, identity: str) -> ServiceResult:
        """
        Get dashboard summary with overall stats.
        
        Args:
            identity: User's identity
            
        Returns:
            ServiceResult with summary stats
        """
        try:
            username = self.extract_username(identity)
            
            # Get user's quiz stats
            total_quizzes = self.quizzes_db.count_documents({"username": username})
            total_attempts = self.attempts_db.count_documents({"username": username, "submitted": True})
            
            # Calculate average score
            results = list(self.results_db.find({"username": username}))
            if results:
                avg_score = sum(r.get("score_percentage", 0) for r in results) / len(results)
            else:
                avg_score = 0
            
            # Recent activity
            recent_attempts = list(self.attempts_db.find(
                {"username": username, "submitted": True}
            ).sort("submitted_at", -1).limit(5))
            
            # Get quiz details for recent attempts
            recent_activity = []
            for attempt in recent_attempts:
                quiz = self.quizzes_db.find_one({"_id": attempt["quiz_id"]})
                if quiz:
                    recent_activity.append({
                        "quiz_id": attempt["quiz_id"],
                        "quiz_title": quiz.get("query", "Untitled"),
                        "category": quiz.get("category", "General"),
                        "score": attempt.get("score_percentage", 0),
                        "submitted_at": attempt.get("submitted_at"),
                    })
            
            return ServiceResult.ok({
                "total_quizzes": total_quizzes,
                "total_attempts": total_attempts,
                "average_score": round(avg_score, 2),
                "recent_activity": recent_activity,
            })
            
        except Exception as e:
            self.logger.error(f"Error getting dashboard summary: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def analyze_performance(self, identity: str) -> ServiceResult:
        """
        Analyze user's quiz performance.
        
        Args:
            identity: User's identity
            
        Returns:
            ServiceResult with performance analysis
        """
        try:
            username = self.extract_username(identity)
            
            results = list(self.results_db.find({"username": username}))
            
            if not results:
                return ServiceResult.ok({
                    "message": "No quiz results found.",
                    "performance": {}
                })
            
            # Group by category
            category_scores = defaultdict(list)
            for result in results:
                quiz = self.quizzes_db.find_one({"_id": result["quiz_id"]})
                if quiz:
                    category = quiz.get("category", "General")
                    category_scores[category].append(result.get("score_percentage", 0))
            
            # Calculate category averages
            category_performance = {
                category: {
                    "average_score": round(sum(scores) / len(scores), 2),
                    "total_attempts": len(scores),
                    "best_score": max(scores),
                    "worst_score": min(scores),
                }
                for category, scores in category_scores.items()
            }
            
            # Overall trends
            scores_over_time = [
                {"date": r.get("submitted_at"), "score": r.get("score_percentage", 0)}
                for r in sorted(results, key=lambda x: x.get("submitted_at", datetime.min))
            ]
            
            return ServiceResult.ok({
                "category_performance": category_performance,
                "scores_over_time": scores_over_time,
                "total_quizzes_taken": len(results),
                "overall_average": round(sum(r.get("score_percentage", 0) for r in results) / len(results), 2),
            })
            
        except Exception as e:
            self.logger.error(f"Error analyzing performance: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def get_progress(self, identity: str) -> ServiceResult:
        """
        Get user's learning progress.
        
        Args:
            identity: User's identity
            
        Returns:
            ServiceResult with progress data
        """
        try:
            username = self.extract_username(identity)
            
            # Get all results sorted by date
            results = list(self.results_db.find(
                {"username": username}
            ).sort("submitted_at", 1))
            
            if not results:
                return ServiceResult.ok({
                    "message": "No progress data available.",
                    "progress": []
                })
            
            # Calculate cumulative average over time
            progress = []
            cumulative_total = 0
            for i, result in enumerate(results):
                cumulative_total += result.get("score_percentage", 0)
                cumulative_avg = cumulative_total / (i + 1)
                progress.append({
                    "attempt_number": i + 1,
                    "score": result.get("score_percentage", 0),
                    "cumulative_average": round(cumulative_avg, 2),
                    "date": result.get("submitted_at"),
                })
            
            return ServiceResult.ok({
                "progress": progress,
                "total_attempts": len(results),
                "improvement": progress[-1]["cumulative_average"] - progress[0]["score"] if len(progress) > 1 else 0,
            })
            
        except Exception as e:
            self.logger.error(f"Error getting progress: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def get_recommendations(self, identity: str) -> ServiceResult:
        """
        Get quiz recommendations based on performance.
        
        Args:
            identity: User's identity
            
        Returns:
            ServiceResult with recommendations
        """
        try:
            username = self.extract_username(identity)
            
            results = list(self.results_db.find({"username": username}))
            
            if not results:
                # No results, recommend popular quizzes
                popular_quizzes = list(self.quizzes_db.find().sort("attempts", -1).limit(5))
                return ServiceResult.ok({
                    "recommendations": [
                        {
                            "quiz_id": q["_id"],
                            "title": q.get("query", "Untitled"),
                            "category": q.get("category", "General"),
                            "reason": "Popular quiz",
                        }
                        for q in popular_quizzes
                    ]
                })
            
            # Find weak categories
            category_scores = defaultdict(list)
            for result in results:
                quiz = self.quizzes_db.find_one({"_id": result["quiz_id"]})
                if quiz:
                    category = quiz.get("category", "General")
                    category_scores[category].append(result.get("score_percentage", 0))
            
            category_averages = {
                cat: sum(scores) / len(scores)
                for cat, scores in category_scores.items()
            }
            
            # Sort categories by average score (ascending - weakest first)
            weak_categories = sorted(category_averages.items(), key=lambda x: x[1])[:3]
            
            # Find quizzes in weak categories that user hasn't taken
            taken_quiz_ids = {r["quiz_id"] for r in results}
            recommendations = []
            
            for category, _ in weak_categories:
                quizzes_in_category = list(self.quizzes_db.find({
                    "category": category,
                    "_id": {"$nin": list(taken_quiz_ids)}
                }).limit(2))
                
                for quiz in quizzes_in_category:
                    recommendations.append({
                        "quiz_id": quiz["_id"],
                        "title": quiz.get("query", "Untitled"),
                        "category": category,
                        "reason": f"Improve your {category} skills",
                    })
            
            return ServiceResult.ok({"recommendations": recommendations[:5]})
            
        except Exception as e:
            self.logger.error(f"Error getting recommendations: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def get_quizzes_by_category(self, identity: str) -> ServiceResult:
        """
        Get quizzes grouped by category.
        
        Args:
            identity: User's identity
            
        Returns:
            ServiceResult with quizzes by category
        """
        try:
            username = self.extract_username(identity)
            
            quizzes = list(self.quizzes_db.find({"username": username}))
            
            # Group by category
            by_category = defaultdict(list)
            for quiz in quizzes:
                category = quiz.get("category", "General")
                by_category[category].append({
                    "quiz_id": quiz["_id"],
                    "title": quiz.get("query", "Untitled"),
                    "attempts": quiz.get("attempts", 0),
                    "created_at": quiz.get("created_at"),
                })
            
            return ServiceResult.ok({"quizzes_by_category": dict(by_category)})
            
        except Exception as e:
            self.logger.error(f"Error getting quizzes by category: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    def get_categories(self, identity: str) -> ServiceResult:
        """
        Get all quiz categories for a user.
        
        Args:
            identity: User's identity
            
        Returns:
            ServiceResult with categories
        """
        try:
            username = self.extract_username(identity)
            
            categories = self.quizzes_db.distinct("category", {"username": username})
            
            return ServiceResult.ok({"categories": categories})
            
        except Exception as e:
            self.logger.error(f"Error getting categories: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)

    # =========================================================================
    # Token Analytics
    # =========================================================================
    
    def view_token_logs(self, filters=None, aggregate_by=None, limit=100) -> ServiceResult:
        """Retrieve token log documents with optional grouping."""
        try:
            from models.database import token_logs_collection
            q = filters or {}
            
            def serialize_doc(doc):
                """Convert MongoDB document to JSON-serializable dict."""
                if doc is None:
                    return None
                result = {}
                for key, value in doc.items():
                    if hasattr(value, '__str__') and type(value).__name__ == 'ObjectId':
                        result[key] = str(value)
                    elif isinstance(value, dict):
                        result[key] = serialize_doc(value)
                    else:
                        result[key] = value
                return result
            
            if aggregate_by:
                group_fields = {field: f"${field}" for field in aggregate_by}
                pipeline = [
                    {"$match": q},
                    {
                        "$group": {
                            "_id": group_fields,
                            "total_tokens": {"$sum": "$total_tokens"},
                            "prompt_tokens": {"$sum": "$prompt_tokens"},
                            "completion_tokens": {"$sum": "$completion_tokens"},
                            "logs_count": {"$sum": 1},
                        }
                    },
                    {"$sort": {"total_tokens": -1}},
                    {"$limit": limit},
                ]
                res = [serialize_doc(doc) for doc in token_logs_collection.aggregate(pipeline)]
                return ServiceResult.ok({"data": res})
            else:
                cur = token_logs_collection.find(q).sort("timestamp", -1).limit(limit)
                data = [serialize_doc(doc) for doc in cur]
                return ServiceResult.ok({"data": data})
        except Exception as e:
            self.logger.error(f"Error viewing token logs: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)

    def delete_token_logs(self, query: Dict) -> ServiceResult:
        """Delete token logs based on query."""
        try:
            from models.database import token_logs_collection
            if not query:
                return ServiceResult.ok({"deleted_count": 0})
            
            res = token_logs_collection.delete_many(query)
            return ServiceResult.ok({"deleted_count": res.deleted_count})
        except Exception as e:
            self.logger.error(f"Error deleting token logs: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)
    
    # Model pricing per 1M tokens (USD)
    MODEL_PRICING = {
        # Gemini models
        "gemini-2.5-flash-lite": {"input": 0.10, "output": 0.40},
        "gemini-2.0-flash": {"input": 0.10, "output": 0.40},
        "gemini-2.0-flash-lite": {"input": 0.10, "output": 0.40},
        "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
        "gemini-1.5-flash-8b": {"input": 0.0375, "output": 0.15},
        "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
        "gemini-2.5-pro": {"input": 1.25, "output": 10.00},
        "gemini-embedding-001": {"input": 0.15, "output": 0.0},
        # OpenAI models
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "gpt-4-turbo": {"input": 10.00, "output": 30.00},
        "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
        "text-embedding-3-small": {"input": 0.02, "output": 0.0},
        "text-embedding-3-large": {"input": 0.13, "output": 0.0},
        # Mistral models
        "mistral-small": {"input": 0.20, "output": 0.60},
        "mistral-medium": {"input": 2.70, "output": 8.10},
        "mistral-large": {"input": 2.00, "output": 6.00},
        "mistral-embed": {"input": 0.10, "output": 0.0},
        # Default fallback
        "_default": {"input": 0.50, "output": 1.50},
    }
    
    def _get_model_pricing(self, model_name: str) -> dict:
        """Get pricing for a model, with fuzzy matching for model variants."""
        if not model_name:
            return self.MODEL_PRICING["_default"]
        
        model_lower = model_name.lower()
        
        # Exact match first
        if model_lower in self.MODEL_PRICING:
            return self.MODEL_PRICING[model_lower]
        
        # Fuzzy match for model variants (e.g., gemini-2.0-flash-001)
        for key in self.MODEL_PRICING:
            if key != "_default" and key in model_lower:
                return self.MODEL_PRICING[key]
        
        return self.MODEL_PRICING["_default"]
    
    def _calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        """Calculate cost for tokens based on model pricing."""
        pricing = self._get_model_pricing(model)
        # Pricing is per 1M tokens
        input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
        output_cost = (completion_tokens / 1_000_000) * pricing["output"]
        return input_cost + output_cost
    
    def usage_summary(self, start_date=None, end_date=None, bot_token=None) -> ServiceResult:
        """Summarize total tokens, unique users, unique models with per-model cost calculation."""
        try:
            from models.database import token_logs_collection
            match_filter = {}
            if start_date or end_date:
                match_filter["timestamp"] = {}
                if start_date:
                    match_filter["timestamp"]["$gte"] = start_date
                if end_date:
                    match_filter["timestamp"]["$lte"] = end_date
            
            if bot_token:
                match_filter["bot_token"] = bot_token

            # Aggregate by model to calculate per-model costs
            pipeline = [
                {"$match": match_filter},
                {
                    "$group": {
                        "_id": "$model",
                        "prompt_tokens": {"$sum": "$prompt_tokens"},
                        "completion_tokens": {"$sum": "$completion_tokens"},
                        "total_tokens": {"$sum": "$total_tokens"},
                        "count": {"$sum": 1},
                    }
                },
            ]
            model_results = list(token_logs_collection.aggregate(pipeline))
            
            if not model_results:
                return ServiceResult.ok({
                    "total_tokens": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "unique_users_count": 0,
                    "unique_models_count": 0,
                    "estimated_cost": 0.0,
                    "cost_by_model": {},
                })
            
            # Calculate costs per model
            total_cost = 0.0
            total_tokens = 0
            total_prompt = 0
            total_completion = 0
            cost_by_model = {}
            
            for r in model_results:
                model = r["_id"] or "unknown"
                prompt = r["prompt_tokens"] or 0
                completion = r["completion_tokens"] or 0
                tokens = r["total_tokens"] or 0
                
                model_cost = self._calculate_cost(model, prompt, completion)
                cost_by_model[model] = {
                    "prompt_tokens": prompt,
                    "completion_tokens": completion,
                    "total_tokens": tokens,
                    "cost": round(model_cost, 6),
                    "requests": r["count"],
                }
                
                total_cost += model_cost
                total_tokens += tokens
                total_prompt += prompt
                total_completion += completion
            
            # Get unique users count separately
            users_pipeline = [
                {"$match": match_filter},
                {"$group": {"_id": "$user_id"}},
                {"$count": "count"},
            ]
            users_result = list(token_logs_collection.aggregate(users_pipeline))
            unique_users = users_result[0]["count"] if users_result else 0

            return ServiceResult.ok({
                "total_tokens": total_tokens,
                "prompt_tokens": total_prompt,
                "completion_tokens": total_completion,
                "unique_users_count": unique_users,
                "unique_models_count": len(model_results),
                "estimated_cost": round(total_cost, 4),
                "cost_by_model": cost_by_model,
            })
        except Exception as e:
            self.logger.error(f"Error getting usage summary: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)

    def daily_usage(self, start_date=None, end_date=None, bot_token=None) -> ServiceResult:
        """Returns daily usage stats."""
        try:
            from models.database import token_logs_collection
            match_filter = {}
            if start_date or end_date:
                match_filter["timestamp"] = {}
                if start_date:
                    match_filter["timestamp"]["$gte"] = start_date
                if end_date:
                    match_filter["timestamp"]["$lte"] = end_date
            
            if bot_token:
                match_filter["bot_token"] = bot_token

            pipeline = [
                {"$match": match_filter},
                {
                    "$group": {
                        "_id": {
                            "day": {"$dayOfMonth": "$timestamp"},
                            "month": {"$month": "$timestamp"},
                            "year": {"$year": "$timestamp"},
                        },
                        "total_tokens": {"$sum": "$total_tokens"},
                    }
                },
                {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}},
            ]
            result = list(token_logs_collection.aggregate(pipeline))

            daily_data = []
            for r in result:
                ds = f"{r['_id']['year']}-{r['_id']['month']:02d}-{r['_id']['day']:02d}"
                daily_data.append({"date": ds, "total_tokens": r["total_tokens"]})
            return ServiceResult.ok({"data": daily_data})
        except Exception as e:
            self.logger.error(f"Error getting daily usage: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)

    def top_users(self, limit=5, start_date=None, end_date=None, bot_token=None) -> ServiceResult:
        """Return top N users by total_tokens usage."""
        try:
            from models.database import token_logs_collection
            match_filter = {}
            if start_date or end_date:
                match_filter["timestamp"] = {}
                if start_date:
                    match_filter["timestamp"]["$gte"] = start_date
                if end_date:
                    match_filter["timestamp"]["$lte"] = end_date
            
            if bot_token:
                match_filter["bot_token"] = bot_token

            pipeline = [
                {"$match": match_filter},
                {"$group": {"_id": "$user_id", "total_tokens": {"$sum": "$total_tokens"}}},
                {"$sort": {"total_tokens": -1}},
                {"$limit": limit},
            ]
            result = list(token_logs_collection.aggregate(pipeline))
            return ServiceResult.ok({"data": [{"user_id": r["_id"], "total_tokens": r["total_tokens"]} for r in result]})
        except Exception as e:
            self.logger.error(f"Error getting top users: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)

    def top_models(self, limit=5, start_date=None, end_date=None, bot_token=None) -> ServiceResult:
        """Return top N models by total_tokens usage."""
        try:
            from models.database import token_logs_collection
            match_filter = {}
            if start_date or end_date:
                match_filter["timestamp"] = {}
                if start_date:
                    match_filter["timestamp"]["$gte"] = start_date
                if end_date:
                    match_filter["timestamp"]["$lte"] = end_date
            
            if bot_token:
                match_filter["bot_token"] = bot_token

            pipeline = [
                {"$match": match_filter},
                {"$group": {"_id": "$model", "total_tokens": {"$sum": "$total_tokens"}}},
                {"$sort": {"total_tokens": -1}},
                {"$limit": limit},
            ]
            result = list(token_logs_collection.aggregate(pipeline))
            return ServiceResult.ok({"data": [{"model": r["_id"], "total_tokens": r["total_tokens"]} for r in result]})
        except Exception as e:
            self.logger.error(f"Error getting top models: {e}")
            return ServiceResult.fail(f"Internal server error: {str(e)}", 500)


# Singleton instance
_analytics_service_instance: Optional[AnalyticsService] = None


def get_analytics_service() -> AnalyticsService:
    """Get or create the analytics service singleton."""
    global _analytics_service_instance
    if _analytics_service_instance is None:
        _analytics_service_instance = AnalyticsService()
    return _analytics_service_instance
