"""
Database Module

OOP-based database connection and collection management.
"""
import logging
from typing import Optional, Dict, Any

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from config import Config


class DatabaseManager:
    """
    Singleton database manager for MongoDB connections.

    Provides:
    - Connection management
    - Collection access
    - Connection health checks
    """

    _instance: Optional["DatabaseManager"] = None

    def __init__(self):
        """Initialize the database manager."""
        self.logger = logging.getLogger(self.__class__.__name__)
        self._client: MongoClient = MongoClient(
            Config.MONGO_URI,
            serverSelectionTimeoutMS=Config.MONGO_SERVER_SELECTION_TIMEOUT_MS,
        )
        self.logger.info(f"MongoDB connected to {Config.MONGO_URI}")

    @classmethod
    def get_instance(cls) -> "DatabaseManager":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def client(self) -> MongoClient:
        """Get the MongoDB client."""
        return self._client

    # =========================================================================
    # Database Access
    # =========================================================================

    def get_database(self, name: str = "document_db") -> Database:
        """
        Get a database by name.

        Args:
            name: Database name

        Returns:
            MongoDB database instance
        """
        return self._client[name]

    def get_collection(self, collection_name: str, db_name: str = "document_db") -> Collection:
        """
        Get a collection from a database.

        Args:
            collection_name: Collection name
            db_name: Database name

        Returns:
            MongoDB collection instance
        """
        return self._client[db_name][collection_name]

    # =========================================================================
    # Health Checks
    # =========================================================================

    def ping(self) -> bool:
        """
        Check if database connection is healthy.

        Returns:
            True if connection is healthy, False otherwise
        """
        try:
            self._client.admin.command("ping")
            return True
        except Exception as e:
            self.logger.error(f"Database ping failed: {e}")
            return False

    def get_server_info(self) -> Dict[str, Any]:
        """
        Get MongoDB server information.

        Returns:
            Server info dictionary
        """
        try:
            return self._client.server_info()
        except Exception as e:
            self.logger.error(f"Failed to get server info: {e}")
            return {}

    # =========================================================================
    # Cleanup
    # =========================================================================

    def close(self) -> None:
        """Close the database connection."""
        if self._client:
            self._client.close()
            self.logger.info("MongoDB connection closed")


class DocumentDatabase:
    """
    Document database wrapper providing typed access to document-related collections.
    """

    _instance: Optional["DocumentDatabase"] = None

    def __init__(self, manager: Optional[DatabaseManager] = None):
        """
        Initialize document database.

        Args:
            manager: Optional DatabaseManager instance
        """
        self._manager = manager or DatabaseManager.get_instance()
        self._db = self._manager.get_database("document_db")

    @classmethod
    def get_instance(cls) -> "DocumentDatabase":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def embeddings(self) -> Collection:
        """Private embeddings collection."""
        return self._db.embeddings

    @property
    def public_embeddings(self) -> Collection:
        """Public embeddings collection."""
        return self._db.public_embeddings

    @property
    def collections(self) -> Collection:
        """Collections collection."""
        return self._db.collections

    @property
    def public_collections(self) -> Collection:
        """Public collections collection."""
        return self._db.public_collections

    @property
    def conversations(self) -> Collection:
        """Conversations collection."""
        return self._db.conversations

    @property
    def documents(self) -> Collection:
        """Documents collection."""
        return self._db.documents

    @property
    def users(self) -> Collection:
        """Users collection."""
        return self._db.users

    @property
    def tenants(self) -> Collection:
        """Tenants collection."""
        return self._db.tenants

    @property
    def extractions(self) -> Collection:
        """Structured extractions from documents."""
        return self._db.document_extractions


class BotDatabase:
    """
    Bot database wrapper providing typed access to bot-related collections.
    """

    _instance: Optional["BotDatabase"] = None

    def __init__(self, manager: Optional[DatabaseManager] = None):
        """
        Initialize bot database.

        Args:
            manager: Optional DatabaseManager instance
        """
        self._manager = manager or DatabaseManager.get_instance()
        self._db = self._manager.get_database("bot_db")

    @classmethod
    def get_instance(cls) -> "BotDatabase":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def tokens(self) -> Collection:
        """Bot tokens collection."""
        return self._db.tokens

    @property
    def embed_codes(self) -> Collection:
        """Embed codes collection."""
        return self._db.embed_codes

    @property
    def templates(self) -> Collection:
        """Templates collection."""
        return self._db.templates

    @property
    def token_logs(self) -> Collection:
        """Token logs collection."""
        return self._db.token_logs

    @property
    def quizzes(self) -> Collection:
        """Quizzes collection."""
        return self._db.quizzes

    @property
    def quiz_results(self) -> Collection:
        """Quiz results collection."""
        return self._db.quiz_results

    @property
    def quiz_attempts(self) -> Collection:
        """Quiz attempts collection."""
        return self._db.quiz_attempts


# =============================================================================
# Singleton Factory Functions
# =============================================================================

def get_database_manager() -> DatabaseManager:
    """Get the database manager singleton."""
    return DatabaseManager.get_instance()


def get_document_database() -> DocumentDatabase:
    """Get the document database singleton."""
    return DocumentDatabase.get_instance()


def get_bot_database() -> BotDatabase:
    """Get the bot database singleton."""
    return BotDatabase.get_instance()


# =============================================================================
# Backwards Compatibility - Direct Collection Access
# =============================================================================

# Initialize client and database
mongo_client = MongoClient(
    Config.MONGO_URI,
    serverSelectionTimeoutMS=Config.MONGO_SERVER_SELECTION_TIMEOUT_MS,
)
db = mongo_client.document_db

# Document-related collections
embedding_collection = db.embeddings
public_embedding_collection = db.public_embeddings
collection_collection = db.collections
public_collection = db.public_collections
conversation_collection = db.conversations
document_collection = db.documents
users_collection = db.users
tenants_collection = db.tenants

# Bot-related collections
tokens_collection = mongo_client.bot_db.tokens
embed_code_collection = mongo_client.bot_db.embed_codes
templates_collection = mongo_client.bot_db.templates
token_logs_collection = mongo_client.bot_db.token_logs
quiz_collection = mongo_client.bot_db.quizzes
quiz_results_collection = mongo_client.bot_db.quiz_results
quiz_attempts_collection = mongo_client.bot_db.quiz_attempts

# Notification collection
notifications_collection = db.notifications

# Structured extraction collection
extraction_collection = db.document_extractions

# Agent platform collections
agent_definitions_collection = db.agent_definitions
workflow_definitions_collection = db.workflow_definitions
workflow_runs_collection = db.workflow_runs


__all__ = [
    # OOP Classes
    "DatabaseManager",
    "DocumentDatabase",
    "BotDatabase",
    # Factory functions
    "get_database_manager",
    "get_document_database",
    "get_bot_database",
    # Backwards compatible collections
    "mongo_client",
    "db",
    "embedding_collection",
    "public_embedding_collection",
    "collection_collection",
    "public_collection",
    "conversation_collection",
    "document_collection",
    "users_collection",
    "tokens_collection",
    "embed_code_collection",
    "templates_collection",
    "token_logs_collection",
    "quiz_collection",
    "quiz_results_collection",
    "quiz_attempts_collection",
    "notifications_collection",
    "extraction_collection",
    "agent_definitions_collection",
    "workflow_definitions_collection",
    "workflow_runs_collection",
]
